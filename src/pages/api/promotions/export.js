// src/pages/api/promotions/export.js
import { createClient } from "@supabase/supabase-js";

function makeServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // server-only!
  if (!url || !serviceKey) {
    throw new Error(
      "Missing env vars: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  // Server client (no session persistence needed in API routes)
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      res.status(405).send("Method Not Allowed");
      return;
    }

    const supabase = makeServerClient();

    const promotion_id = req.query.promotion_id || req.query.promotionId;
    if (!promotion_id) {
      res.status(400).send("promotion_id is required");
      return;
    }

    // 1) Load promotion config
    const { data: promo, error: promoErr } = await supabase
      .from("promotions")
      .select("id, horse_id, quota, min_shares_required, start_at, end_at, label")
      .eq("id", promotion_id)
      .maybeSingle();

    if (promoErr) {
      console.error("[export] promotion fetch error:", promoErr);
      res.status(500).send("Could not fetch promotion");
      return;
    }
    if (!promo) {
      res.status(404).send("Promotion not found");
      return;
    }

    const quota = Number(promo.quota || 0);
    const minReq = Number(promo.min_shares_required || 0);
    if (quota <= 0 || minReq <= 0) {
      res
        .status(400)
        .send("Promotion must have positive quota and min_shares_required");
      return;
    }

    // 2) Qualifying purchases (>= min shares, within window), oldest first
    let q = supabase
      .from("purchases")
      .select("user_id, horse_id, qty, created_at")
      .eq("horse_id", promo.horse_id)
      .gte("qty", minReq)
      .order("created_at", { ascending: true });

    if (promo.start_at) q = q.gte("created_at", promo.start_at);
    if (promo.end_at) q = q.lte("created_at", promo.end_at);

    const { data: rows, error: rowsErr } = await q;
    if (rowsErr) {
      console.error("[export] purchases fetch error:", rowsErr);
      res.status(500).send("Could not fetch qualifying purchases");
      return;
    }

    // Distinct users by time, limited by quota
    const seen = new Set();
    const qualifiers = [];
    for (const r of rows || []) {
      if (!seen.has(r.user_id)) {
        seen.add(r.user_id);
        qualifiers.push({
          user_id: r.user_id,
          horse_id: r.horse_id,
          qualified_at: r.created_at,
        });
        if (qualifiers.length >= quota) break;
      }
    }

    // If none, still return header
    const header = "email,user_id,horse_id,qualified_at\n";
    if (qualifiers.length === 0) {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="promotion_${promotion_id}_emails.csv"`
      );
      res.status(200).send(header);
      return;
    }

    // 3) Resolve emails
    const userIds = qualifiers.map((q) => q.user_id);
    const emailsById = {};

    // 3a) Try profiles mirror (id, email) if you have it
    try {
      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", userIds);
      if (profErr) {
        console.warn("[export] profiles fetch warning:", profErr?.message || profErr);
      } else {
        for (const p of profiles || []) {
          if (p?.id && p?.email) emailsById[p.id] = p.email;
        }
      }
    } catch (e) {
      console.warn("[export] profiles lookup threw:", e?.message || e);
    }

    // 3b) Fill gaps via Admin API (requires service role key)
    const missing = userIds.filter((id) => !emailsById[id]);
    for (const uid of missing) {
      try {
        const { data: ures, error: uerr } = await supabase.auth.admin.getUserById(
          uid
        );
        if (!uerr && ures?.user?.email) emailsById[uid] = ures.user.email;
      } catch (e) {
        console.warn(`[export] admin.getUserById(${uid}) failed:`, e?.message || e);
      }
    }

    // 4) CSV
    const body = qualifiers
      .map((q) =>
        [
          (emailsById[q.user_id] || "").replaceAll(",", " "),
          q.user_id,
          q.horse_id,
          q.qualified_at,
        ].join(",")
      )
      .join("\n");

    const csv = header + body;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="promotion_${promotion_id}_emails.csv"`
    );
    res.status(200).send(csv);
  } catch (e) {
    console.error("[export] unexpected error:", e);
    res.status(500).send(e?.message || "Export failed");
  }
}