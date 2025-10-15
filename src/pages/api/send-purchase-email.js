// src/pages/api/send-purchase-email.js
import { Resend } from "resend";
import { purchaseEmailHTML } from "../../lib/emailtemplates"; // <-- lowercase t, relative path

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL =
  process.env.FROM_EMAIL || "Premier Paddock <no-reply@premierpaddockracing.co.uk>";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { to, horseName, qty, pricePerShare, total, buyerName } = req.body || {};
    if (!to || !horseName || !qty) {
      return res.status(400).json({ error: "Missing required fields: to, horseName, qty" });
    }

    const name = buyerName?.trim() || (to.includes("@") ? to.split("@")[0] : "Owner");
    const html = purchaseEmailHTML({ name, horseName, qty, pricePerShare, total });

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to, // must be an email like "you@example.com" or "Name <you@example.com>"
      subject: `Your ${horseName} purchase confirmation`,
      html,
    });

    if (error) return res.status(422).json({ ok: false, error });
    return res.status(200).json({ ok: true, id: data?.id || null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}