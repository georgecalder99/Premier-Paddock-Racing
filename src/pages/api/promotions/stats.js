// src/pages/api/promotions/stats.js
import { createClient } from "@supabase/supabase-js";

// Use the service role key server-side so we can read what we need even with RLS.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

function pickActivePromo(nowISO, rows) {
  return (rows || []).find((p) => {
    if (!p.enabled) return false;
    const hasNums = (p.quota || 0) > 0 && (p.min_shares_required || 0) > 0;
    if (!hasNums) return false;
    const startsOk = !p.start_at || p.start_at <= nowISO;
    const endsOk = !p.end_at || p.end_at >= nowISO;
    return startsOk && endsOk;
  }) || null;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).json({ error: "Method not allowed" });
    }

    const horse_id = String(req.query.horse_id || "").trim();
    if (!horse_id) {
      return res.status(400).json({ error: "Missing horse_id" });
    }

    const nowISO = new Date().toISOString();

    // 1) Get enabled promotions for this horse
    const { data: promos, error: pErr } = await supabase
      .from("promotions")
      .select("id,horse_id,enabled,quota,min_shares_required,start_at,end_at,label,reward")
      .eq("horse_id", horse_id)
      .eq("enabled", true);

    if (pErr) {
      console.error("[/api/promotions/stats] promotions error:", pErr);
      return res.status(200).json({ promotion: null, claimed: 0, left: 0, active: false });
    }

    const promotion = pickActivePromo(nowISO, promos);
    if (!promotion) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ promotion: null, claimed: 0, left: 0, active: false });
    }

    // 2) Count unique eligible purchasers since promotion start (and before end, if set)
    let q = supabase
      .from("purchases")
      .select("user_id, qty, created_at")
      .eq("horse_id", horse_id)
      .gte("qty", promotion.min_shares_required);

    if (promotion.start_at) q = q.gte("created_at", promotion.start_at);
    if (promotion.end_at) q = q.lte("created_at", promotion.end_at);

    const { data: rows, error: cErr } = await q.order("created_at", { ascending: true });
    if (cErr) {
      console.error("[/api/promotions/stats] purchases error:", cErr);
      // If we can’t fetch, show zero rather than breaking the page
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({
        promotion,
        claimed: 0,
        left: promotion.quota || 0,
        active: (promotion.quota || 0) > 0
      });
    }

    // Unique-by-user, in order, up to quota
    const seen = new Set();
    let claimed = 0;
    for (const r of rows || []) {
      if (seen.has(r.user_id)) continue;
      seen.add(r.user_id);
      claimed += 1;
      if (claimed >= (promotion.quota || 0)) break;
    }

    const left = Math.max(0, (promotion.quota || 0) - claimed);
    const active = left > 0;

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      promotion,
      claimed,
      left,
      active,
    });
  } catch (e) {
    console.error("[/api/promotions/stats] unexpected:", e);
    return res.status(500).json({ error: "Server error" });
  }
}