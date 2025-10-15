// src/pages/api/test-email.js
import { Resend } from "resend";
import { purchaseEmailHTML, purchaseEmailText } from "../../lib/emailtemplates";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL =
  process.env.FROM_EMAIL || "Premier Paddock <no-reply@premierpaddockracing.co.uk>";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    // Use ?to=you@yourmail.com in the URL, or fall back to CONTACT_TO_EMAIL
    const to =
      req.query.to ||
      process.env.CONTACT_TO_EMAIL ||
      "georgecalder99@gmail.com";

    const html = purchaseEmailHTML({
      name: "Test User",
      horseName: "Test Horse",
      qty: 3,
      pricePerShare: 60,
      total: 180,
    });

    const text = purchaseEmailText({
      name: "Test User",
      horseName: "Test Horse",
      qty: 3,
      pricePerShare: 60,
      total: 180,
    });

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: "Test purchase email — Premier Paddock Racing",
      html,
      text,
    });

    if (error) {
      console.error("[test-email] Resend error:", error);
      return res.status(500).json({ ok: false, error });
    }

    return res.status(200).json({ ok: true, id: data?.id || null });
  } catch (err) {
    console.error("[test-email] error:", err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}