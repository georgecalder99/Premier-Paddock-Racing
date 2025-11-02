// src/lib/cartClient.js
import { supabase } from "./supabaseClient";

/* --------------------------------------------
   Helpers
-------------------------------------------- */

// require a signed-in user
async function requireUserId() {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess?.session?.user?.id;
  if (!uid) throw new Error("Must be signed in.");
  return uid;
}

/**
 * Load renew cycles by ids and index them
 * returns: { [id]: { id, horse_id, price_per_share, term_label? } }
 */
async function fetchRenewCycleMap(cycleIds) {
  if (!cycleIds?.length) return {};
  const { data, error } = await supabase
    .from("renew_cycles")
    .select(`
      id,
      horse_id,
      price_per_share,
      term_label,
      renew_period_start,
      renew_period_end,
      term_end_date,
      status
    `)
    .in("id", cycleIds);
  if (error) throw new Error(error.message || "Failed to load renewal cycles.");
  return Object.fromEntries((data || []).map((rc) => [rc.id, rc]));
}

/* --------------------------------------------
   Cart core
-------------------------------------------- */

export async function getOrCreateCart() {
  const userId = await requireUserId();

  const { data: existing, error: selErr } = await supabase
    .from("carts")
    .select("id, status")
    .eq("user_id", userId)
    .eq("status", "open")
    .maybeSingle();

  // PostgREST "not found" is PGRST116 – ignore
  if (selErr && selErr.code !== "PGRST116") {
    throw new Error(selErr.message || "Failed to read cart.");
  }

  if (existing?.id) return existing;

  const { data: created, error: insErr } = await supabase
    .from("carts")
    .insert({ user_id: userId, status: "open" })
    .select("id, status")
    .single();
  if (insErr) throw new Error(insErr.message || "Failed to create cart.");
  return created;
}

/**
 * Add a share purchase to cart
 * SHARES: item_type='share', horse_id set, renew_cycle_id = null
 */
export async function addShareToCart(cartId, horseId, qty) {
  if (!cartId || !horseId) throw new Error("Missing cartId or horseId");
  const n = Math.min(100, Math.max(1, Number(qty || 1)));

  // get price from horses
  const { data: horse, error: hErr } = await supabase
    .from("horses")
    .select("share_price")
    .eq("id", horseId)
    .single();
  if (hErr || !horse) throw new Error(hErr?.message || "Could not fetch horse price.");

  const unitPriceCents = Math.round(Number(horse.share_price || 0) * 100);
  if (!Number.isFinite(unitPriceCents) || unitPriceCents <= 0) {
    throw new Error("Invalid share price for this horse.");
  }

  // try to merge with existing cart line
  const { data: existing, error: selErr } = await supabase
    .from("cart_items")
    .select("id, qty, unit_price_cents")
    .eq("cart_id", cartId)
    .eq("item_type", "share")
    .eq("horse_id", horseId)
    .is("renew_cycle_id", null)
    .maybeSingle();

  if (selErr && selErr.code !== "PGRST116") {
    throw new Error(selErr.message || "Failed to read cart items.");
  }

  if (existing?.id) {
    const patch = { qty: Number(existing.qty || 0) + n };
    if (existing.unit_price_cents == null) patch.unit_price_cents = unitPriceCents;
    const { error: updErr } = await supabase.from("cart_items").update(patch).eq("id", existing.id);
    if (updErr) throw new Error(updErr.message || "Failed to update basket item.");
    return;
  }

  const { error: insErr } = await supabase.from("cart_items").insert({
    cart_id: cartId,
    item_type: "share",
    horse_id: horseId,
    renew_cycle_id: null,
    qty: n,
    unit_price_cents: unitPriceCents,
  });
  if (insErr) throw new Error(insErr.message || "Failed to add item to cart");
}

/**
 * Add a renewal to cart
 * RENEWALS: item_type='renewal', renew_cycle_id set, horse_id=null
 * We always keep just 1 line per (cart, renew_cycle_id)
 */
export async function addRenewalToCart({ cartId, renewCycleId, qty, pricePerShareGBP }) {
  if (!cartId) throw new Error("Missing cartId");
  if (!renewCycleId) throw new Error("Missing renewCycleId");
  const n = Math.min(1000, Math.max(1, Number(qty || 1)));

  // load price from cycle if not provided
  let priceGBP = pricePerShareGBP;
  if (priceGBP == null) {
    const { data: cycle, error: cErr } = await supabase
      .from("renew_cycles")
      .select("price_per_share")
      .eq("id", renewCycleId)
      .single();
    if (cErr || !cycle) throw new Error(cErr?.message || "Could not load renewal cycle.");
    priceGBP = cycle.price_per_share;
  }

  const unitPriceCents = Math.round(Number(priceGBP || 0) * 100);
  if (!Number.isFinite(unitPriceCents) || unitPriceCents <= 0) {
    throw new Error("Invalid renewal price.");
  }

  // see if we already have this cycle in cart
  const { data: existing, error: selErr } = await supabase
    .from("cart_items")
    .select("id, qty, unit_price_cents")
    .eq("cart_id", cartId)
    .eq("item_type", "renewal")
    .eq("renew_cycle_id", renewCycleId)
    .is("horse_id", null)
    .maybeSingle();

  if (selErr && selErr.code !== "PGRST116") {
    throw new Error(selErr.message || "Failed to read basket items.");
  }

  if (existing?.id) {
    const patch = { qty: Number(existing.qty || 0) + n };
    if (existing.unit_price_cents == null) patch.unit_price_cents = unitPriceCents;
    const { error: updErr } = await supabase.from("cart_items").update(patch).eq("id", existing.id);
    if (updErr) throw new Error(updErr.message || "Failed to update renewal item.");
    return;
  }

  // create line
  const { error: insErr } = await supabase.from("cart_items").insert({
    cart_id: cartId,
    item_type: "renewal",
    horse_id: null,
    renew_cycle_id: renewCycleId,
    qty: n,
    unit_price_cents: unitPriceCents,
  });
  if (insErr) throw new Error(insErr.message || "Failed to add renewal to cart");
}

/**
 * Get cart + items + horse info
 * We also resolve "display_horse_id" on renewal lines
 */
export async function getCartWithItems() {
  const cart = await getOrCreateCart();

  const { data: items, error: itErr } = await supabase
    .from("cart_items")
    .select("id, item_type, horse_id, renew_cycle_id, qty, unit_price_cents, created_at")
    .eq("cart_id", cart.id)
    .order("created_at", { ascending: true });
  if (itErr) throw new Error(itErr.message || "Failed to load cart items.");

  if (!items?.length) return { cart, items: [], horses: {}, subtotalCents: 0 };

  // which renewal cycles do we need to resolve
  const renewalCycleIds = [
    ...new Set(
      items
        .filter((i) => i.item_type === "renewal" && i.renew_cycle_id)
        .map((i) => i.renew_cycle_id)
    ),
  ];

  let renewCycleToHorse = {};
  if (renewalCycleIds.length) {
    const { data: cycles, error: rcErr } = await supabase
      .from("renew_cycles")
      .select("id, horse_id, term_label")
      .in("id", renewalCycleIds);
    if (rcErr) throw new Error(rcErr.message || "Failed to load renewal cycles.");
    renewCycleToHorse = Object.fromEntries((cycles || []).map((rc) => [rc.id, rc.horse_id]));
  }

  // collect horse ids we need
  const horseIds = [
    ...new Set(
      items.flatMap((i) => {
        if (i.item_type === "share" && i.horse_id) return [i.horse_id];
        if (i.item_type === "renewal" && i.renew_cycle_id) {
          const hid = renewCycleToHorse[i.renew_cycle_id];
          return hid ? [hid] : [];
        }
        return [];
      })
    ),
  ];

  let horsesById = {};
  if (horseIds.length) {
    const { data: horses, error: hErr } = await supabase
      .from("horses")
      .select("id, name, photo_url, share_price")
      .in("id", horseIds);
    if (hErr) throw new Error(hErr.message || "Failed to load horse info.");
    horsesById = Object.fromEntries((horses || []).map((h) => [h.id, h]));
  }

  const itemsWithDisplay = items.map((i) => {
    if (i.item_type === "renewal") {
      return {
        ...i,
        display_horse_id: renewCycleToHorse[i.renew_cycle_id] || null,
      };
    }
    return { ...i, display_horse_id: i.horse_id || null };
  });

  const subtotalCents = itemsWithDisplay.reduce(
    (sum, i) => sum + Number(i.unit_price_cents || 0) * Number(i.qty || 0),
    0
  );

  return { cart, items: itemsWithDisplay, horses: horsesById, subtotalCents };
}

export async function updateCartItemQty(itemId, qty) {
  const n = Math.min(1000, Math.max(1, Number(qty || 1)));
  const { error } = await supabase.from("cart_items").update({ qty: n }).eq("id", itemId);
  if (error) throw new Error(error.message || "Failed to update quantity.");
}

export async function removeCartItem(itemId) {
  const { error } = await supabase.from("cart_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message || "Failed to remove item.");
}

/** Wallet balance (in cents) */
export async function getWalletBalance() {
  const { data: sess } = await supabase.auth.getSession();
  const userId = sess?.session?.user?.id;
  if (!userId) return 0;

  const { data: tx, error } = await supabase
    .from("wallet_transactions")
    .select("amount, type, status")
    .eq("user_id", userId)
    .eq("status", "posted");
  if (error) return 0;

  const credits = (tx || [])
    .filter((t) => t.type === "credit")
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const debits = (tx || [])
    .filter((t) => t.type === "debit")
    .reduce((s, t) => s + Number(t.amount || 0), 0);

  // wallet_transactions.amount is GBP, so *100
  return Math.max(0, Math.round((credits - debits) * 100));
}

/* --------------------------------------------
   Checkout
-------------------------------------------- */

export async function completeCheckout({ walletAppliedCents = 0 } = {}) {
  const { data: sess } = await supabase.auth.getSession();
  const user = sess?.session?.user;
  if (!user?.id) throw new Error("Not signed in.");
  const userId = user.id;

  // 1) get cart snapshot
  const { cart, items, horses, subtotalCents } = await getCartWithItems();
  if (!cart?.id) throw new Error("No open basket found.");
  if (!items?.length) throw new Error("Your basket is empty.");

  // 2) resolve renew cycles
  const renewalCycleIds = [...new Set(items.map((i) => i.renew_cycle_id).filter(Boolean))];
  const cycleMap = await fetchRenewCycleMap(renewalCycleIds);

  // 3) wallet math
  const balanceCents = await getWalletBalance();
  const walletUsedCents = Math.min(
    Math.max(0, Number(walletAppliedCents || 0)),
    balanceCents,
    subtotalCents
  );
  const totalDueCents = Math.max(0, subtotalCents - walletUsedCents);

  if (walletUsedCents > 0) {
    const { error: wErr } = await supabase.from("wallet_transactions").insert({
      user_id: userId,
      type: "debit",
      status: "posted",
      amount: (walletUsedCents / 100).toFixed(2),
      memo: "Applied to checkout",
    });
    if (wErr) throw new Error(wErr.message || "Failed to debit wallet.");
  }

  // helper: stamp ownership renewed_at
  async function stampRenewed(horseId) {
    if (!horseId) return;
    try {
      await supabase
        .from("ownerships")
        .update({ renewed_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("horse_id", horseId);
    } catch {
      // ignore
    }
  }

  // We'll build an array to return to UI
  const receiptItems = [];

  // 4) process each line
  for (const it of items) {
    const qty = Number(it.qty || 0);
    const unitCents = Number(it.unit_price_cents || 0);
    if (qty <= 0) continue;

    // ---------------------------
    // SHARES
    // ---------------------------
    if (it.item_type === "share") {
      const horseId = it.horse_id || it.display_horse_id;
      if (!horseId) throw new Error("Missing horse for share item.");

      // upsert ownership
      const { data: existing } = await supabase
        .from("ownerships")
        .select("id, shares")
        .eq("user_id", userId)
        .eq("horse_id", horseId)
        .maybeSingle();

      if (existing?.id) {
        const { error: updErr } = await supabase
          .from("ownerships")
          .update({ shares: Number(existing.shares || 0) + qty })
          .eq("id", existing.id);
        if (updErr) throw new Error(updErr.message || "Could not update your shares.");
      } else {
        const { error: insErr } = await supabase
          .from("ownerships")
          .insert({ user_id: userId, horse_id: horseId, shares: qty });
        if (insErr) throw new Error(insErr.message || "Could not add your shares.");
      }

      // 👇 NEW: also write to purchases so promo triggers fire
      try {
        const lineTotalGBP = (unitCents * qty) / 100;
        await supabase.from("purchases").insert({
          user_id: userId,
          horse_id: horseId,
          qty,
          metadata: {
            source: "cart",
            cart_id: cart.id,
            unit_price_gbp: unitCents / 100,
            line_total_gbp: lineTotalGBP,
          },
          created_at: new Date().toISOString(),
        });
      } catch (pErr) {
        console.warn("[checkout] purchases insert failed:", pErr);
      }

      // add to receipt
      receiptItems.push({
        item_type: "share",
        horse_id: horseId,
        horse_name: horses[horseId]?.name || null,
        qty,
        unit_price_cents: unitCents,
      });

      continue;
    }

    // ---------------------------
    // RENEWALS
    // ---------------------------
    if (it.item_type === "renewal") {
      const cycleId = it.renew_cycle_id;
      const cycle = cycleId ? cycleMap[cycleId] : null;
      const horseId = cycle?.horse_id || it.display_horse_id || null;
      if (!cycleId || !horseId) throw new Error("Could not resolve horse/cycle for renewal item.");

      const { error: rpcErr } = await supabase.rpc("add_renew_shares", {
        p_user_id: userId,
        p_cycle_id: cycleId,
        p_add_shares: qty,
      });
      if (rpcErr) {
        throw new Error(rpcErr.message || "Failed to write renew_responses");
      }

      await stampRenewed(horseId);

      receiptItems.push({
        item_type: "renewal",
        horse_id: horseId,
        horse_name: horses[horseId]?.name || null,
        renew_cycle_id: cycleId,
        renew_title: cycle?.term_label || null,
        qty,
        unit_price_cents: unitCents,
      });

      continue;
    }
  }

  // 5) clear cart
  await supabase.from("cart_items").delete().eq("cart_id", cart.id);
  await supabase.from("carts").update({ status: "closed" }).eq("id", cart.id);

  // 6) return for success page
  return {
    ok: true,
    subtotalCents,
    walletUsedCents,
    totalDueCents,
    items: receiptItems,
  };
}

/* --------------------------------------------
   Default export
-------------------------------------------- */
const cartApi = {
  getOrCreateCart,
  addShareToCart,
  addRenewalToCart,
  getCartWithItems,
  updateCartItemQty,
  removeCartItem,
  getWalletBalance,
  completeCheckout,
};
export default cartApi;