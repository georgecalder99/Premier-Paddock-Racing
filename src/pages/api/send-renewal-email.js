// src/pages/api/send-renewal-email.js
import { Resend } from "resend";
import { renewalEmailHTML, renewalEmailText } from "../../lib/emailtemplates";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL =
  process.env.FROM_EMAIL || "Premier Paddock <no-reply@premierpaddockracing.co.uk>";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Use provided name → Supabase (full_name/name) → raw email as fallback
async function resolveDisplayName(to, providedName) {
  if (providedName && String(providedName).trim()) {
    return String(providedName).trim();
  }

  const email = (to || "").trim();

  try {
    if (email) {
      const { data, error } = await supabaseAdmin.auth.admin.getUserByEmail(email);
      if (!error && data?.user?.user_metadata) {
        const meta = data.user.user_metadata;
        const full = (meta.full_name || meta.name || "").trim();
        if (full) return full;
      }
    }
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[send-renewal-email] name lookup error:", e?.message || e);
    }
  }

  // Fallback: show the full email exactly as-is
  return email;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const {
      to,
      horseName,
      renewalPeriod,
      amount,
      name,       // optional
      buyerName,  // optional
    } = req.body || {};

    if (!to || !horseName) {
      return res.status(400).json({ error: "Missing required fields: to, horseName" });
    }

    const displayName = await resolveDisplayName(to, name || buyerName);
    const subject = `Your ${horseName} renewal confirmation`;

    const html = renewalEmailHTML({
      name: displayName,
      horseName,
      renewalPeriod,
      amount,
    });

    const text = renewalEmailText({
      name: displayName,
      horseName,
      renewalPeriod,
      amount,
    });

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
      text,
    });

    if (error) {
      console.error("[send-renewal-email] Resend error:", error);
      return res.status(500).json({ ok: false, error });
    }

    return res.status(200).json({ ok: true, id: data?.id || null });
  } catch (err) {
    console.error("[send-renewal-email] error", err);
    return res.status(500).json({ ok: false, error: "Failed to send email" });
  }
}