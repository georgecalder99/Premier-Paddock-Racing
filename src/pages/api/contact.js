// /src/pages/api/contact.js
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function htmlEmail({ name, email, phone, message }) {
  return `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6">
      <h2>New contact form message</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ""}
      <p><strong>Message:</strong></p>
      <pre style="white-space:pre-wrap;background:#f9f9f9;padding:12px;border-radius:8px">${message}</pre>
    </div>
  `;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { name, email, phone, message } = req.body || {};
    if (!name || !email || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const from = process.env.CONTACT_FROM_EMAIL;
    const to = process.env.CONTACT_TO_EMAIL;

    const { error } = await resend.emails.send({
      from, // must be from your verified domain
      to: [to],
      subject: `New contact form message from ${name}`,
      reply_to: email,
      html: htmlEmail({ name, email, phone, message }),
    });

    if (error) {
      console.error("[contact] Resend error:", error);
      return res.status(500).json({ error: error.message || "Email send failed" });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[contact] Handler error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}