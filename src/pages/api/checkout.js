// src/pages/api/checkout.js
import { createServerSupabaseClient } from "@supabase/auth-helpers-nextjs";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const supabase = createServerSupabaseClient({ req, res });

  try {
    // Auth from cookies (server-side)
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    if (!user?.id) return res.status(401).json({ error: "Not signed in." });
    const userId = user.id;

    // Input: chosen wallet amount (GBP)
    const { walletAppliedGBP } = req.body || {};
    const requestedWalletCents = Math.max(0, Math.round(Number(walletAppliedGBP || 0) * 100));

    // Load open cart
    const { data: cart, error: cartErr } = await supabase
      .from("carts")
      .select("id, status, created_at")
      .eq("user_id", userId)
      .eq("status", "open")
      .maybeSingle();
    if (cartErr) throw cartErr;
    if (!cart?.id) return res.status(400).json({ error: "No open basket found." });

    // Items
    const { data: items, error: itErr } = await supabase
      .from("cart_items")
      .select("id, item_type, horse_id, qty, unit_price_cents")
      .eq("cart_id", cart.id)
      .order("created_at", { ascending: true });
    if (itErr) throw itErr;
    if (!items?.length) return res.status(400).json({ error: "Your basket is empty." });

    // Join horses (for email)
    const horseIds = [...new Set(items.map(i => i.horse_id).filter(Boolean))];
    let horsesById = {};
    if (horseIds.length) {
      const { data: horses, error: hErr } = await supabase
        .from("horses")
        .select("id, name, share_price, photo_url")
        .in("id", horseIds);
      if (hErr) throw hErr;
      horsesById = Object.fromEntries((horses || []).map(h => [h.id, h]));
    }

    // Subtotal
    const subtotalCents = items.reduce(
      (sum, it) => sum + (Number(it.unit_price_cents || 0) * Number(it.qty || 0)),
      0
    );
    if (subtotalCents <= 0) return res.status(400).json({ error: "Invalid basket subtotal." });

    // Wallet balance (posted credits - posted debits)
    const { data: txRows, error: txErr } = await supabase
      .from("wallet_transactions")
      .select("amount, type, status")
      .eq("user_id", userId);
    if (txErr) throw txErr;

    const postedCredits = (txRows || [])
      .filter(t => t.status === "posted" && t.type === "credit")
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const postedDebits = (txRows || [])
      .filter(t => t.status === "posted" && t.type === "debit")
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const walletBalanceCents = Math.max(0, Math.round((postedCredits - postedDebits) * 100));

    // Apply wallet (clamped)
    const walletUsedCents = Math.min(requestedWalletCents, walletBalanceCents, subtotalCents);
    const totalDueCents = Math.max(0, subtotalCents - walletUsedCents);

    // If wallet used, record posted debit
    if (walletUsedCents > 0) {
      const { error: wErr } = await supabase.from("wallet_transactions").insert({
        user_id: userId,
        type: "debit",
        status: "posted",
        amount: (walletUsedCents / 100).toFixed(2),
        memo: "Applied to purchase",
      });
      if (wErr) throw wErr;
    }

    // Close cart + clear items
    const { error: closeErr } = await supabase
      .from("carts")
      .update({ status: "closed" })
      .eq("id", cart.id);
    if (closeErr) throw closeErr;

    const { error: delErr } = await supabase
      .from("cart_items")
      .delete()
      .eq("cart_id", cart.id);
    if (delErr) throw delErr;

    // Compose email summary
    const lines = items.map(it => {
      const h = horsesById[it.horse_id] || {};
      const name = h.name || "Horse";
      const unit = (Number(it.unit_price_cents || 0) / 100).toFixed(2);
      const qty = Number(it.qty || 0);
      const lineTotal = ((Number(it.unit_price_cents || 0) * qty) / 100).toFixed(2);
      const label = it.item_type === "renewal" ? "Renewal" : "Share";
      return `• ${name} — ${label} — £${unit} × ${qty} = £${lineTotal}`;
    });
    const summary = [
      ...lines, "",
      `Subtotal: £${(subtotalCents / 100).toFixed(2)}`,
      `Wallet used: £${(walletUsedCents / 100).toFixed(2)}`,
      `Amount paid: £${(totalDueCents / 100).toFixed(2)}`
    ].join("\n");

    // Send confirmation email (don’t fail checkout if it errors)
    try {
      if (user.email) {
        await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/send-purchase-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: user.email,
            horseName: "Basket purchase",
            qty: items.reduce((s, it) => s + Number(it.qty || 0), 0),
            pricePerShare: 0,
            total: subtotalCents / 100,
            extraText: summary,
          }),
        }).catch(() => {});
      }
    } catch (_) {}

    return res.status(200).json({
      ok: true,
      subtotalCents,
      walletUsedCents,
      totalDueCents,
      message: "Order completed.",
    });
  } catch (e) {
    console.error("[/api/checkout] error:", e);
    return res.status(500).json({ error: e.message || "Checkout failed." });
  }
}