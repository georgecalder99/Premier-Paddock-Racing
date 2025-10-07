export const config = { api: { bodyParser: true } };

export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const passcode = process.env.SITE_LOCK_PASSCODE;
  if (!passcode) return res.redirect("/"); // no lock if not configured

  // works with application/x-www-form-urlencoded (default for HTML forms)
  const code = (req.body?.code || "").toString();

  if (code === passcode) {
    const cookie = [
      `site_lock=${passcode}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${60 * 60 * 24 * 7}`, // 7 days
    ].join("; ");
    res.setHeader("Set-Cookie", cookie);
    return res.redirect("/");
  }

  // Optional: bounce back to /lock with a tiny delay/message
  return res.status(401).send("Invalid code");
}