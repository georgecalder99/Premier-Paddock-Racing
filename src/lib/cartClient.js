// src/lib/cartClient.js
import { supabase } from "./supabaseClient";

/* --------------------------------------------
   Small utils
-------------------------------------------- */

function fireCartChanged() {
  try { window?.dispatchEvent?.(new Event("cart:changed")); } catch {}
}

async function requireUser() {
  const { data: sess, error } = await supabase.auth.getSession();
  if (error) throw error;
  const user = sess?.session?.user || null;
  if (!user?.id) throw new Error("Must be signed in.");
  return user;
}

/** Try to ensure a profiles row exists for this auth user (handles FK gotcha). */
async function ensureProfileExists(user) {
  try {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (existing?.id) return true;

    const email = user.email || user.user_metadata?.email || null;
    const full_name =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      null;

    const { error: insErr } = await supabase
      .from("profiles")
      .insert({ id: user.id, email, full_name })
      .single();

    if (!insErr) return true;
  } catch {}
  return false;
}

/** Detects an FK to profiles error on carts insert. */
function looksLikeProfilesFK(err) {
  if (!err) return false;
  const msg = (err.message || err.details || err.hint || "").toLowerCase();
  return (
    msg.includes("foreign key") &&
    (msg.includes("profiles") || msg.includes("profile"))
  );
}

/* --------------------------------------------
   Cart core
-------------------------------------------- */

export async function getOrCreateCart() {
  const user = await requireUser();

  // Always pick the newest open cart deterministically (no maybeSingle)
  const { data: rows, error: selErr } = await supabase
    .from("carts")
    .select("id, status, created_at")
    .eq("user_id", user.id)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1);

  if (selErr) throw new Error(selErr.message || "Failed to read cart.");

  const existing = Array.isArray(rows) ? rows[0] : null;
  if (existing?.id) return existing;

  // Create a new open cart if none found
  const tryInsert = async () => {
    const { data, error } = await supabase
      .from("carts")
      .insert({ user_id: user.id, status: "open" })
      .select("id, status, created_at")
      .single();
    if (error) throw error;
    return data;
  };

  try {
    return await tryInsert();
  } catch (e1) {
    // If your schema has a profiles FK and it's missing for brand-new users
    if (looksLikeProfilesFK(e1)) {
      const ok = await ensureProfileExists(user);
      if (ok) return await tryInsert().catch(e2 => { throw new Error(e2.message || "Failed to create cart (after profile)."); });
    }
    throw new Error(e1.message || "Failed to create cart.");
  }
}

/**
 * Add a share line.
 * Accepts optional cartId – if null/undefined, it will create/fetch one.
 */
export async function addShareToCart(cartId, horseId, qty, fallbackPriceGBP) {
  if (!horseId) throw new Error("Missing horseId");

  const cart = cartId ? { id: cartId } : await getOrCreateCart();
  const n = Math.min(100, Math.max(1, Number(qty || 1)));

  // Try DB first, then fallback
  let unitPriceCents;
  const { data: horse, error: hErr } = await supabase
    .from("horses")
    .select("share_price")
    .eq("id", horseId)
    .single();

  if (!hErr && horse?.share_price != null) {
    unitPriceCents = Math.round(Number(String(horse.share_price).replace(/[^0-9.]/g, "")) * 100);
  } else if (fallbackPriceGBP != null) {
    unitPriceCents = Math.round(Number(String(fallbackPriceGBP).replace(/[^0-9.]/g, "")) * 100);
  } else {
    throw new Error(hErr?.message || "Could not fetch horse price.");
  }

  if (!Number.isFinite(unitPriceCents) || unitPriceCents <= 0) {
    throw new Error("Invalid share price for this horse.");
  }

  const { data: existing, error: selErr } = await supabase
    .from("cart_items")
    .select("id, qty, unit_price_cents")
    .eq("cart_id", cart.id)
    .eq("item_type", "share")
    .eq("horse_id", horseId)
    .is("renew_cycle_id", null)
    .maybeSingle();
  if (selErr && selErr.code !== "PGRST116") throw new Error(selErr.message || "Failed to read cart items.");

  if (existing?.id) {
    const patch = { qty: Number(existing.qty || 0) + n };
    if (existing.unit_price_cents == null) patch.unit_price_cents = unitPriceCents;
    const { error: updErr } = await supabase.from("cart_items").update(patch).eq("id", existing.id);
    if (updErr) throw new Error(updErr.message || "Failed to update basket item.");
    return;
  }

  const { error: insErr } = await supabase.from("cart_items").insert({
    cart_id: cart.id,
    item_type: "share",
    horse_id: horseId,
    renew_cycle_id: null,
    qty: n,
    unit_price_cents: unitPriceCents,
  });
  if (insErr) throw new Error(insErr.message || "Failed to add item to cart");
}

export async function addRenewalToCart({ cartId, renewCycleId, qty, pricePerShareGBP }) {
  if (!renewCycleId) throw new Error("Missing renewCycleId");

  const cart = cartId ? { id: cartId } : await getOrCreateCart();
  const n = Math.min(1000, Math.max(1, Number(qty || 1)));

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

  const unitPriceCents = Math.round(
    Number(String(priceGBP ?? 0).replace(/[^0-9.]/g, "")) * 100
  );
  if (!Number.isFinite(unitPriceCents) || unitPriceCents <= 0) {
    throw new Error("Invalid renewal price.");
  }

  const { data: existing, error: selErr } = await supabase
    .from("cart_items")
    .select("id, qty, unit_price_cents")
    .eq("cart_id", cart.id)
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

  const { error: insErr } = await supabase.from("cart_items").insert({
    cart_id: cart.id,
    item_type: "renewal",
    horse_id: null,
    renew_cycle_id: renewCycleId,
    qty: n,
    unit_price_cents: unitPriceCents,
  });
  if (insErr) throw new Error(insErr.message || "Failed to add renewal to cart");
}

/**
 * Get cart + items + resolved horse info
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

  const renewalCycleIds = [
    ...new Set(items.filter(i => i.item_type === "renewal" && i.renew_cycle_id).map(i => i.renew_cycle_id)),
  ];

  let renewCycleToHorse = {};
  if (renewalCycleIds.length) {
    const { data: cycles, error: rcErr } = await supabase
      .from("renew_cycles")
      .select("id, horse_id, term_label")
      .in("id", renewalCycleIds);
    if (rcErr) throw new Error(rcErr.message || "Failed to load renewal cycles.");
    renewCycleToHorse = Object.fromEntries((cycles || []).map(rc => [rc.id, rc.horse_id]));
  }

  const horseIds = [
    ...new Set(
      items.flatMap(i => {
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
    horsesById = Object.fromEntries((horses || []).map(h => [h.id, h]));
  }

  const itemsWithDisplay = items.map(i => {
    if (i.item_type === "renewal") {
      return { ...i, display_horse_id: renewCycleToHorse[i.renew_cycle_id] || null };
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
  fireCartChanged();
}

export async function removeCartItem(itemId) {
  const { error } = await supabase.from("cart_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message || "Failed to remove item.");
  fireCartChanged();
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
    .filter(t => t.type === "credit")
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const debits = (tx || [])
    .filter(t => t.type === "debit")
    .reduce((s, t) => s + Number(t.amount || 0), 0);

  return Math.max(0, Math.round((credits - debits) * 100));
}

/* --------------------------------------------
   Checkout
-------------------------------------------- */

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
  return Object.fromEntries((data || []).map(rc => [rc.id, rc]));
}

export async function completeCheckout({ walletAppliedCents = 0 } = {}) {
  const user = await requireUser();
  const userId = user.id;

  const { cart, items, horses, subtotalCents } = await getCartWithItems();
  if (!cart?.id) throw new Error("No open basket found.");
  if (!items?.length) throw new Error("Your basket is empty.");

  const renewalCycleIds = [...new Set(items.map(i => i.renew_cycle_id).filter(Boolean))];
  const cycleMap = await fetchRenewCycleMap(renewalCycleIds);

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

  async function stampRenewed(horseId) {
    if (!horseId) return;
    try {
      await supabase
        .from("ownerships")
        .update({ renewed_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("horse_id", horseId);
    } catch {}
  }

  const receiptItems = [];

  for (const it of items) {
    const qty = Number(it.qty || 0);
    const unitCents = Number(it.unit_price_cents || 0);
    if (qty <= 0) continue;

    if (it.item_type === "share") {
      const horseId = it.horse_id || it.display_horse_id;
      if (!horseId) throw new Error("Missing horse for share item.");

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

      receiptItems.push({
        item_type: "share",
        horse_id: horseId,
        horse_name: horses[horseId]?.name || null,
        qty,
        unit_price_cents: unitCents,
      });
      continue;
    }

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
      if (rpcErr) throw new Error(rpcErr.message || "Failed to write renew_responses");

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

  await supabase.from("cart_items").delete().eq("cart_id", cart.id);
  await supabase.from("carts").update({ status: "closed" }).eq("id", cart.id);

  fireCartChanged();

  return {
    ok: true,
    subtotalCents,
    walletUsedCents,
    totalDueCents,
    items: receiptItems,
  };
}

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