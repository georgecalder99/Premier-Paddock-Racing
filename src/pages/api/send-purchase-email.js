// src/pages/api/send-purchase-email.js
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resendApiKey = process.env.RESEND_API_KEY;
const FROM_EMAIL =
  process.env.FROM_EMAIL || "Premier Paddock <no-reply@premierpaddockracing.co.uk>";

const resend = new Resend(resendApiKey);

// Server-side Supabase (service role) to optionally resolve a user's name
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Resolve a display name if one wasn't provided
async function resolveDisplayName(to, providedName) {
  if (providedName && String(providedName).trim()) return String(providedName).trim();

  const email = (to || "").trim();
  if (!email) return "";

  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserByEmail(email);
    if (!error && data?.user?.user_metadata) {
      const meta = data.user.user_metadata;
      const full = (meta.full_name || meta.name || "").trim();
      if (full) return full;
    }
  } catch (e) {
    console.warn("[send-purchase-email] name lookup error:", e?.message || e);
  }
  return email;
}

function buildEmailHTML({ name, horses, total }) {
  const rows = horses
    .map(
      (h) => `
      <tr>
        <td style="padding:8px 12px;border:1px solid #ddd;">${h.horseName}</td>
        <td style="padding:8px 12px;border:1px solid #ddd;">${h.qty}</td>
        <td style="padding:8px 12px;border:1px solid #ddd;">£${h.pricePerShare}</td>
        <td style="padding:8px 12px;border:1px solid #ddd;">£${h.total}</td>
      </tr>`
    )
    .join("");

  return `
  <div style="font-family:Arial, sans-serif;max-width:600px;margin:auto;">
    <h2 style="color:#004225;">Thank you for your purchase${name ? `, ${name}` : ""}!</h2>
    <p>Here ${horses.length === 1 ? "is your share purchase" : "are your recent share purchases"}:</p>

    <table style="border-collapse:collapse;width:100%;margin-top:10px;">
      <thead>
        <tr style="background:#f8f8f8;">
          <th style="text-align:left;padding:8px 12px;border:1px solid #ddd;">Horse</th>
          <th style="text-align:left;padding:8px 12px;border:1px solid #ddd;">Qty</th>
          <th style="text-align:left;padding:8px 12px;border:1px solid #ddd;">Price</th>
          <th style="text-align:left;padding:8px 12px;border:1px solid #ddd;">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="background:#f8f8f8;font-weight:bold;">
          <td colspan="3" style="padding:8px 12px;border:1px solid #ddd;text-align:right;">Grand Total</td>
          <td style="padding:8px 12px;border:1px solid #ddd;">£${total}</td>
        </tr>
      </tfoot>
    </table>

    <p style="margin-top:16px;color:#004225;font-weight:500;">
      If you have qualified for a promotion, we’ll contact you in due course.
    </p>

    <p style="margin-top:16px;">
      You can view your horses and updates anytime in
      <a href="https://premierpaddockracing.co.uk/my-paddock">My Paddock</a>.
    </p>

    <p style="color:#666;font-size:12px;margin-top:16px;">
      — Premier Paddock Racing Team
    </p>
  </div>`;
}

function buildEmailText({ name, horses, total }) {
  let lines = [
    `Thank you for your purchase${name ? `, ${name}` : ""}!`,
    "",
    horses.length === 1 ? "Your share purchase:" : "Your share purchases:",
  ];
  horses.forEach((h) => {
    lines.push(`• ${h.horseName} — ${h.qty} @ £${h.pricePerShare} = £${h.total}`);
  });
  lines.push(
    "",
    `Grand Total: £${total}`,
    "",
    "If you have qualified for a promotion, we’ll contact you in due course.",
    "",
    "Visit your paddock: https://premierpaddockracing.co.uk/my-paddock"
  );
  return lines.join("\n");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!resendApiKey) {
    console.error("[send-purchase-email] Missing RESEND_API_KEY env var.");
    return res.status(500).json({ error: "Email is temporarily unavailable (missing API key)." });
  }
  if (!FROM_EMAIL) {
    console.error("[send-purchase-email] Missing FROM_EMAIL env var.");
    return res.status(500).json({ error: "Email is temporarily unavailable (missing FROM address)." });
  }

  try {
    const { to, horses, name, buyerEmail } = req.body || {};
    if (!to) return res.status(400).json({ error: "Missing 'to'." });
    if (!Array.isArray(horses) || horses.length === 0) {
      return res.status(400).json({ error: "Missing 'horses' array." });
    }

    const normalized = horses.map((h) => ({
      horseName: String(h.horseName || "Horse"),
      qty: Number(h.qty || 0),
      pricePerShare: Number(h.pricePerShare || 0).toFixed(2),
      total: Number(h.total || (Number(h.qty || 0) * Number(h.pricePerShare || 0))).toFixed(2),
    }));
    const grandTotal = normalized.reduce((sum, h) => sum + Number(h.total || 0), 0).toFixed(2);

    const displayName = await resolveDisplayName(to, name);

    const subject =
      normalized.length === 1
        ? `Your ${normalized[0].horseName} purchase confirmation`
        : `Your Premier Paddock Racing purchases`;

    const html = buildEmailHTML({ name: displayName, horses: normalized, total: grandTotal });
    const text = buildEmailText({ name: displayName, horses: normalized, total: grandTotal });

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
      return res.status(502).json({ error: "Resend rejected the email." });
    }

    return res.status(200).json({ ok: true, id: data?.id || null });
  } catch (err) {
    console.error("[send-purchase-email] Unhandled error:", err);
    return res.status(500).json({ error: "Failed to send email" });
  }
}