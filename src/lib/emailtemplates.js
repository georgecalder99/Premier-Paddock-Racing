// src/lib/emailtemplates.js

const siteName = process.env.SITE_NAME || "Premier Paddock Racing";
const siteUrl  = process.env.NEXT_PUBLIC_SITE_URL || "https://premierpaddockracing.co.uk";
const logoUrl  = process.env.NEXT_PUBLIC_EMAIL_LOGO_URL || `${siteUrl}/logo.jpg`;

/** Turn an email or raw string into a friendly display name. */
function friendlyName(input = "") {
  const raw = String(input || "").trim();
  if (!raw) return "Owner";

  // If it's an email, start with the part before @
  let base = raw.includes("@") ? raw.split("@")[0] : raw;

  // Replace separators with spaces, drop digits
  base = base.replace(/[._-]+/g, " ").replace(/\d+/g, " ").replace(/\s+/g, " ").trim();

  // If we still only have a single chunk like 'georgecalder', split roughly in half
  if (base && !base.includes(" ") && base.length >= 6) {
    const mid = Math.floor(base.length / 2);
    base = `${base.slice(0, mid)} ${base.slice(mid)}`;
  }

  // Title case
  return base
    ? base
        .split(" ")
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ")
    : "Owner";
}

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

/* ---------------- Purchase ---------------- */

export function purchaseEmailHTML({ name, horseName, qty, pricePerShare, total }) {
  const title = `Thanks for your purchase — ${horseName}`;
  const display = friendlyName(name);
  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:16px;">Dear ${escapeHtml(display)},</p>
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

export function purchaseEmailText({ name, horseName, qty, pricePerShare, total }) {
  const display = friendlyName(name);
  return [
    `Dear ${display},`,
    ``,
    `Thank you for purchasing shares in ${horseName}!`,
    ``,
    `Shares purchased: ${qty}`,
    `Price per share: £${Number(pricePerShare || 0).toLocaleString()}`,
    `Total: £${Number(total || 0).toLocaleString()}`,
    ``,
    `You can view your holdings and updates anytime in your owner portal.`,
    ``,
    `Warm regards,`,
    `The ${siteName} Team`,
  ].join("\n");
}

/* ---------------- Renewal (upgraded) ---------------- */
/**
 * We now accept extra fields:
 * - termEnds: ISO string (the real “term end date”)
 * - termLabel: optional human label e.g. "2025 Season"
 * - sharesRenewed: number of shares renewed
 * - pricePerShare: GBP number
 * - lineTotal: final amount for this line
 *
 * We still accept the old fields:
 * - renewalPeriod
 * - amount
 */
export function renewalEmailHTML({
  name,
  horseName,
  renewalPeriod,
  amount,
  termEnds,
  termLabel,
  sharesRenewed,
  pricePerShare,
  lineTotal,
}) {
  const title = `Renewal confirmed — ${horseName}`;
  const display = friendlyName(name);

  // pick the best total we have
  const finalTotal =
    lineTotal != null
      ? Number(lineTotal || 0)
      : amount != null
      ? Number(amount || 0)
      : null;

  // helper for date
  const termEndsHtml = termEnds
    ? `<tr><td style="padding:8px 0;color:#6b7280;">Term ends</td><td style="padding:8px 0;text-align:right;"><strong>${formatDateUK(
        termEnds
      )}</strong></td></tr>`
    : "";

  // only render breakdown rows if we actually got values
  const sharesRow =
    sharesRenewed != null
      ? `<tr><td style="padding:8px 0;color:#6b7280;">Shares renewed</td><td style="padding:8px 0;text-align:right;"><strong>${Number(
          sharesRenewed
        ).toLocaleString()}</strong></td></tr>`
      : "";

  const ppsRow =
    pricePerShare != null
      ? `<tr><td style="padding:8px 0;color:#6b7280;">Price per share</td><td style="padding:8px 0;text-align:right;"><strong>£${Number(
          pricePerShare || 0
        ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td></tr>`
      : "";

  const totalRow =
    finalTotal != null
      ? `<tr><td style="padding:8px 0;color:#6b7280;">Total paid</td><td style="padding:8px 0;text-align:right;"><strong>£${finalTotal.toLocaleString(
          undefined,
          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
        )}</strong></td></tr>`
      : "";

  // if we didn’t get termEnds, fall back to your old “renewal period”
  const fallbackPeriod =
    !termEnds && renewalPeriod
      ? `<tr><td style="padding:8px 0;color:#6b7280;">Renewal period</td><td style="padding:8px 0;text-align:right;"><strong>${escapeHtml(
          renewalPeriod
        )}</strong></td></tr>`
      : "";

  // if we got a term label, show it
  const termLabelRow = termLabel
    ? `<tr><td style="padding:8px 0;color:#6b7280;">Term</td><td style="padding:8px 0;text-align:right;"><strong>${escapeHtml(
        termLabel
      )}</strong></td></tr>`
    : "";

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:16px;">Dear ${escapeHtml(display)},</p>
    <p style="margin:0 0 16px;font-size:16px;">Thank you for renewing your ownership in <strong>${escapeHtml(
      horseName
    )}</strong>.</p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:16px 0;border-collapse:collapse;width:100%;">
      ${termEndsHtml}
      ${termLabelRow}
      ${fallbackPeriod}
      ${sharesRow}
      ${ppsRow}
      ${totalRow}
    </table>
    <p style="margin:0 0 16px;font-size:16px;">You can view this renewal in your paddock.</p>
    <p style="margin:20px 0 0;font-size:16px;">Warm regards,<br/>The ${escapeHtml(siteName)} Team</p>
  `;

  return shell({ title, bodyHtml });
}

export function renewalEmailText({
  name,
  horseName,
  renewalPeriod,
  amount,
  termEnds,
  termLabel,
  sharesRenewed,
  pricePerShare,
  lineTotal,
}) {
  const display = friendlyName(name);
  const lines = [];

  lines.push(`Dear ${display},`);
  lines.push("");
  lines.push(`Thank you for renewing your ownership in ${horseName}.`);
  lines.push("");

  if (termEnds) {
    lines.push(`Term ends: ${formatDateUK(termEnds)}`);
  } else if (renewalPeriod) {
    lines.push(`Renewal period: ${renewalPeriod}`);
  }

  if (termLabel) {
    lines.push(`Term: ${termLabel}`);
  }

  if (sharesRenewed != null) {
    lines.push(`Shares renewed: ${sharesRenewed}`);
  }
  if (pricePerShare != null) {
    lines.push(
      `Price per share: £${Number(pricePerShare || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    );
  }

  const finalTotal =
    lineTotal != null
      ? Number(lineTotal || 0)
      : amount != null
      ? Number(amount || 0)
      : null;

  if (finalTotal != null) {
    lines.push(
      `Total paid: £${finalTotal.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    );
  }

  lines.push("");
  lines.push("You can view this renewal in your paddock.");
  lines.push("");
  lines.push("Warm regards,");
  lines.push(`The ${siteName} Team`);

  return lines.join("\n");
}

/* ---------------- Utils ---------------- */

function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDateUK(v) {
  try {
    return new Date(v).toLocaleDateString("en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return v;
  }
}