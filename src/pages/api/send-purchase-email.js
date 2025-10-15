// src/pages/api/send-purchase-email.js
import { Resend } from "resend";
import { purchaseEmailHTML, purchaseEmailText } from "../../lib/emailtemplates";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL =
  process.env.FROM_EMAIL || "Premier Paddock <no-reply@premierpaddockracing.co.uk>";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Return providedName → Supabase full_name/name → raw email (no formatting)
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
      console.log("[send-purchase-email] name lookup error:", e?.message || e);
    }
  }

  // Fallback: the full email address (no formatting)
  return email;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const {
      to,
      horseName,
      qty,
      pricePerShare,
      total,
      name,
      buyerName,
      buyerEmail,
    } = req.body || {};

    if (!to || !horseName || !qty) {
      return res.status(400).json({ error: "Missing required fields: to, horseName, qty" });
    }

    const displayName = await resolveDisplayName(to, name || buyerName);
    const subject = `Your ${horseName} purchase confirmation`;

    const html = purchaseEmailHTML({
      name: displayName,
      horseName,
      qty,
      pricePerShare,
      total,
    });

    const text = purchaseEmailText({
      name: displayName,
      horseName,
      qty,
      pricePerShare,
      total,
    });

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
      text,
      reply_to: buyerEmail || undefined,
    });

    if (error) {
      console.error("[send-purchase-email] Resend error:", error);
      return res.status(500).json({ ok: false, error });
    }

    return res.status(200).json({ ok: true, id: data?.id || null });
  } catch (err) {
    console.error("[send-purchase-email] error", err);
    return res.status(500).json({ ok: false, error: "Failed to send email" });
  }
}