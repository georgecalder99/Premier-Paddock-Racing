// src/lib/emailtemplates.js

const siteName = process.env.SITE_NAME || "Premier Paddock Racing";
const siteUrl  = process.env.NEXT_PUBLIC_SITE_URL || "https://premierpaddockracing.co.uk";
const logoUrl  = process.env.NEXT_PUBLIC_EMAIL_LOGO_URL || `${siteUrl}/logo.jpg`;

function shell({ title, bodyHtml }) {
  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="x-apple-disable-message-reformatting">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7f9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#fff;border:1px solid #e6e8eb;border-radius:12px;overflow:hidden">
        <tr>
          <td style="padding:20px 24px;text-align:center;border-bottom:1px solid #eef1f4;">
            <a href="${siteUrl}" target="_blank" rel="noopener" style="text-decoration:none;">
              <img src="${logoUrl}" alt="${escapeHtml(siteName)}" style="height:40px;vertical-align:middle;display:inline-block;" />
            </a>
          </td>
        </tr>
        <tr><td style="padding:24px;">${bodyHtml}</td></tr>
        <tr>
          <td style="padding:16px 24px;background:#f9fafb;color:#6b7280;font-size:12px;text-align:center;">
            © ${new Date().getFullYear()} ${escapeHtml(siteName)} ·
            <a href="${siteUrl}" style="color:#6b7280;text-decoration:underline;">
              ${siteUrl.replace(/^https?:\/\/(www\.)?/, "")}
            </a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function purchaseEmailHTML({ name, horseName, qty, pricePerShare, total }) {
  const title = `Thanks for your purchase — ${horseName}`;
  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:16px;">Dear ${escapeHtml(name)},</p>
    <p style="margin:0 0 16px;font-size:16px;">Thank you for purchasing shares in <strong>${escapeHtml(horseName)}</strong>!</p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:16px 0;border-collapse:collapse;width:100%;">
      <tr><td style="padding:8px 0;color:#6b7280;">Shares purchased</td><td style="padding:8px 0;text-align:right;"><strong>${Number(qty).toLocaleString()}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;">Price per share</td><td style="padding:8px 0;text-align:right;"><strong>£${Number(pricePerShare || 0).toLocaleString()}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;">Total</td><td style="padding:8px 0;text-align:right;"><strong>£${Number(total || 0).toLocaleString()}</strong></td></tr>
    </table>
    <p style="margin:0 0 16px;font-size:16px;">You can view your holdings and updates anytime in your owner portal.</p>
    <p style="margin:20px 0 0;font-size:16px;">Warm regards,<br/>The ${escapeHtml(siteName)} Team</p>`;
  return shell({ title, bodyHtml });
}

export function renewalEmailHTML({ name, horseName, renewalPeriod, amount }) {
  const title = `Renewal confirmed — ${horseName}`;
  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:16px;">Dear ${escapeHtml(name)},</p>
    <p style="margin:0 0 16px;font-size:16px;">Thank you for renewing your ownership in <strong>${escapeHtml(horseName)}</strong>.</p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:16px 0;border-collapse:collapse;width:100%;">
      <tr><td style="padding:8px 0;color:#6b7280;">Renewal period</td><td style="padding:8px 0;text-align:right;"><strong>${escapeHtml(renewalPeriod || "")}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;">Amount</td><td style="padding:8px 0;text-align:right;"><strong>£${Number(amount || 0).toLocaleString()}</strong></td></tr>
    </table>
    <p style="margin:0 0 16px;font-size:16px;">We’re excited to have you on board for the next chapter.</p>
    <p style="margin:20px 0 0;font-size:16px;">Warm regards,<br/>The ${escapeHtml(siteName)} Team</p>`;
  return shell({ title, bodyHtml });
}

function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}