// src/pages/api/send-renewal-email.js
import { Resend } from "resend";
import { renewalEmailHTML, renewalEmailText } from "../../lib/emailtemplates";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL =
  process.env.FROM_EMAIL ||
  "Premier Paddock <no-reply@premierpaddockracing.co.uk>";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Try to get a nice name for the recipient
async function resolveDisplayName(to, providedName) {
  if (providedName && String(providedName).trim()) {
    return String(providedName).trim();
  }

  const email = (to || "").trim();

  try {
    if (email) {
      const { data, error } =
        await supabaseAdmin.auth.admin.getUserByEmail(email);
      if (!error && data?.user?.user_metadata) {
        const meta = data.user.user_metadata;
        const full = (meta.full_name || meta.name || "").trim();
        if (full) return full;
      }
    }
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        "[send-renewal-email] name lookup error:",
        e?.message || e
      );
    }
  }

  return email; // fallback
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const {
      // existing fields
      to,
      horseName,
      renewalPeriod, // old label – we will keep for backwards compat
      amount,

      // new / better fields
      renewCycleId,        // we'll fetch term_end_date from DB if this is present
      termEndDate,         // you can pass it directly instead of renewCycleId
      sharesRenewed,       // number of shares in THIS renewal
      pricePerShare,       // in GBP, e.g. 49.0
      lineTotal,           // optional – if client already calculated
      name,                // optional
      buyerName,           // optional
    } = req.body || {};

    if (!to || !horseName) {
      return res
        .status(400)
        .json({ error: "Missing required fields: to, horseName" });
    }

    // 1) Who to address
    const displayName = await resolveDisplayName(to, name || buyerName);

    // 2) Work out the real "term ends" date
    let finalTermEnd = null;
    let finalTermLabel = null;

    // a) if the client already sent termEndDate, trust it
    if (termEndDate) {
      finalTermEnd = termEndDate;
    }
    // b) otherwise if we have a cycle id, fetch it
    else if (renewCycleId) {
      const { data: cycle, error: cycleErr } = await supabaseAdmin
        .from("renew_cycles")
        .select(
          "term_end_date, term_label, renew_period_end"
        )
        .eq("id", renewCycleId)
        .maybeSingle();

      if (!cycleErr && cycle) {
        finalTermEnd =
          cycle.term_end_date || cycle.renew_period_end || null;
        finalTermLabel = cycle.term_label || null;
      }
    }

    // 3) work out the line totals / breakdown
    // sharesRenewed -> number
    const sharesN =
      sharesRenewed != null ? Number(sharesRenewed) : null;
    const priceN =
      pricePerShare != null ? Number(pricePerShare) : null;

    // we prefer the explicit lineTotal the client sends
    let totalGBP = lineTotal != null ? Number(lineTotal) : null;

    // if not sent, derive it from shares * price
    if (totalGBP == null && sharesN != null && priceN != null) {
      totalGBP = sharesN * priceN;
    }

    // final amount (for backwards compat)
    // if they still send `amount`, keep it,
    // otherwise use the derived total
    const finalAmount = amount != null ? amount : totalGBP;

    const subject = `Your ${horseName} renewal confirmation`;

    // 4) Build HTML + text with NEW fields
    const html = renewalEmailHTML({
      name: displayName,
      horseName,
      // old field, keep for templates that still expect it:
      renewalPeriod,
      // new field:
      termEnds: finalTermEnd,
      termLabel: finalTermLabel,
      amount: finalAmount,
      sharesRenewed: sharesN,
      pricePerShare: priceN,
      lineTotal: totalGBP,
    });

    const text = renewalEmailText({
      name: displayName,
      horseName,
      renewalPeriod,
      termEnds: finalTermEnd,
      termLabel: finalTermLabel,
      amount: finalAmount,
      sharesRenewed: sharesN,
      pricePerShare: priceN,
      lineTotal: totalGBP,
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