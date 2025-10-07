// src/pages/api/interest.js
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") return res.status(200).json({ ok: true, method: "GET" });
    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { email, source } = (req.body ?? {});
    const e = String(email || "").trim().toLowerCase();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
    if (!ok) return res.status(400).json({ error: "Invalid email" });

    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("interest_signups")
      .upsert(
        { email: e, source: (source || "home").slice(0, 200) },
        { onConflict: "email" }
      );

    if (error) {
      // EXPOSE THE REAL DB ERROR WHILE DEBUGGING
      console.error("[interest] upsert error:", error);
      return res.status(500).json({ error: error.message }); // ← now you’ll see the exact cause
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[interest] fatal error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}