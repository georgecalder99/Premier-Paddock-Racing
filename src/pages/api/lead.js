// src/pages/api/lead.js
import { createClient } from "@supabase/supabase-js";

// Service role is optional now. If not present, we just no-op successfully.
const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = hasServiceKey
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    )
  : null;

// Optionally allow overriding the table name via env, defaults to "leads"
const LEADS_TABLE =
  process.env.NEXT_PUBLIC_LEADS_TABLE?.trim() || "leads";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { email } = req.body || {};
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Invalid email" });
    }

    // Basic email validation
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!ok) return res.status(400).json({ error: "Invalid email" });

    const source =
      (req.headers.referer && String(req.headers.referer).slice(0, 300)) ||
      "unknown";

    // If we don't have a service key, or you don't want to store leads,
    // just succeed without hitting the DB.
    if (!hasServiceKey) {
      return res.status(200).json({ ok: true, stored: false });
    }

    // Attempt to store in a generic "leads" table (if it exists).
    const { error } = await supabaseAdmin
      .from(LEADS_TABLE)
      .upsert(
        { email: email.trim().toLowerCase(), source },
        { onConflict: "email" }
      );

    // If the table doesn't exist or any error happens, log and still succeed
    if (error) {
      // Postgres "relation does not exist" is 42P01; but just treat any error as non-fatal.
      console.warn(`[lead] DB write skipped: ${error.message}`);
      return res.status(200).json({ ok: true, stored: false });
    }

    return res.status(200).json({ ok: true, stored: true });
  } catch (e) {
    console.error("lead endpoint error:", e);
    // Even on unexpected errors, don't block the UX:
    return res.status(200).json({ ok: true, stored: false });
  }
}