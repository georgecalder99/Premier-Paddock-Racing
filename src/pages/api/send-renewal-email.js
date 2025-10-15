// src/pages/api/send-renewal-email.js
import { Resend } from "resend";
import { renewalEmailHTML } from "../../lib/emailtemplates"; // <-- lowercase t, relative path

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL =
  process.env.FROM_EMAIL || "Premier Paddock <no-reply@premierpaddockracing.co.uk>";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { to, horseName, renewalPeriod, amount, buyerName } = req.body || {};
    if (!to || !horseName) {
      return res.status(400).json({ error: "Missing required fields: to, horseName" });
    }

    const name = buyerName?.trim() || (to.includes("@") ? to.split("@")[0] : "Owner");
    const html = renewalEmailHTML({ name, horseName, renewalPeriod, amount });

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to, // "you@example.com" or "Name <you@example.com>"
      subject: `Your ${horseName} renewal confirmation`,
      html,
    });

    if (error) return res.status(422).json({ ok: false, error });
    return res.status(200).json({ ok: true, id: data?.id || null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}