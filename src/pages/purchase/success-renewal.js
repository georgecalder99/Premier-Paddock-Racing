/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient"; // ⬅️ change to ../lib/... if your file is not in /purchase/

const fmtGBP = (n) =>
  `£${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function fmtDateUK(v) {
  if (!v) return null;
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

export default function RenewalSuccessPage() {
  const router = useRouter();
  const { subtotal, wallet, paid } = router.query;

  const [receipt, setReceipt] = useState(null);
  const [renewalHorses, setRenewalHorses] = useState({}); // horse_id -> { name, photo_url? }
  const [renewalCycles, setRenewalCycles] = useState({}); // horse_id -> { term_end_date, renew_period_end, term_label }

  // 1) load receipt from sessionStorage
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("lastCheckout");
      if (raw) {
        const parsed = JSON.parse(raw);
        setReceipt(parsed);
      }
    } catch {
      setReceipt(null);
    }
  }, []);

  // 2) pull out renewal lines from receipt
  const renewals = useMemo(() => {
    const items = receipt?.items || [];
    return items.filter((i) => i.item_type === "renewal");
  }, [receipt]);

  const hasDetails = renewals.length > 0;

  // 3) once we know which horse_ids we need, fetch their names AND latest cycle info
  useEffect(() => {
    (async () => {
      if (!hasDetails) return;

      // unique horse ids from the renewed items
      const horseIds = [
        ...new Set(
          renewals
            .map((r) => r.horse_id)
            .filter(Boolean)
        ),
      ];
      if (!horseIds.length) return;

      // if we already have horses and cycles for them, skip
      const missingHorse = horseIds.some((id) => !renewalHorses[id]);
      const missingCycle = horseIds.some((id) => !renewalCycles[id]);

      // fetch horses
      if (missingHorse) {
        const { data, error } = await supabase
          .from("horses")
          .select("id, name, photo_url")
          .in("id", horseIds);
        if (!error && data) {
          const map = Object.fromEntries(
            data.map((h) => [h.id, { name: h.name, photo_url: h.photo_url }])
          );
          setRenewalHorses((prev) => ({ ...prev, ...map }));
        }
      }

      // fetch cycles (to get term_end_date)
      if (missingCycle) {
        const { data: cycles, error: cErr } = await supabase
          .from("renew_cycles")
          .select("id, horse_id, term_end_date, renew_period_end, term_label")
          .in("horse_id", horseIds);
        if (!cErr && cycles) {
          // we might get multiple cycles per horse; pick the "latest"
          const byHorse = {};
          for (const c of cycles) {
            const key = c.horse_id;
            const current = byHorse[key];
            // pick the one with the later end (term_end_date OR renew_period_end)
            const thisEnd = c.term_end_date || c.renew_period_end || null;
            const currentEnd = current
              ? current.term_end_date || current.renew_period_end || null
              : null;

            // if we don't have one yet, or this one is later, take it
            if (!currentEnd) {
              byHorse[key] = c;
            } else if (thisEnd && new Date(thisEnd) > new Date(currentEnd)) {
              byHorse[key] = c;
            }
          }
          setRenewalCycles((prev) => ({ ...prev, ...byHorse }));
        }
      }
    })();
  }, [hasDetails, renewals, renewalHorses, renewalCycles]);

  // 4) amounts (top summary)
  const subtotalGBP =
    subtotal ?? (receipt ? (receipt.subtotalCents / 100).toFixed(2) : "0.00");
  const walletGBP =
    wallet ?? (receipt ? (receipt.walletUsedCents / 100).toFixed(2) : "0.00");
  const paidGBP =
    paid ?? (receipt ? (receipt.totalDueCents / 100).toFixed(2) : "0.00");

  return (
    <>
      <Head>
        <title>Renewal Successful | Premier Paddock Racing</title>
      </Head>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="rounded-xl border bg-white p-8 shadow-sm">
          <h1 className="text-2xl md:text-3xl font-extrabold text-green-900">
            Renewal successful 🎉
          </h1>
          <p className="mt-2 text-gray-700">
            Thanks! Your renewal payment has been recorded. You’ll get a confirmation email shortly.
          </p>

          {/* summary */}
          <div className="mt-6 space-y-2 text-sm text-gray-700">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{fmtGBP(subtotalGBP)}</span>
            </div>
            <div className="flex justify-between">
              <span>Wallet credit applied</span>
              <span className="text-emerald-700">−{fmtGBP(walletGBP)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Paid</span>
              <span>{fmtGBP(paidGBP)}</span>
            </div>
          </div>

          {/* details */}
          {hasDetails ? (
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-green-900">Renewed items</h2>
              <ul className="mt-3 space-y-3">
                {renewals.map((it, idx) => {
                  const h = it.horse_id ? renewalHorses[it.horse_id] : null;
                  const cycle = it.horse_id ? renewalCycles[it.horse_id] : null;

                  const displayName =
                    it.horse_name || h?.name || `Horse #${it.horse_id || "—"}`;
                  const lineTotal =
                    (Number(it.unit_price_cents || 0) * Number(it.qty || 0)) / 100;
                  const pricePerShare = Number(it.unit_price_cents || 0) / 100;
                  const sharesRenewed = Number(it.qty || 0);

                  // pick a date to show
                  const termEndsDate =
                    cycle?.term_end_date || cycle?.renew_period_end || null;
                  const termEndsText = termEndsDate ? fmtDateUK(termEndsDate) : null;

                  return (
                    <li
                      key={`${it.horse_id || "horse"}-${idx}`}
                      className="rounded border p-3 bg-gray-50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-green-900 truncate">
                          {displayName}
                        </div>
                        <div className="font-semibold">{fmtGBP(lineTotal)}</div>
                      </div>

                      {/* extras */}
                      <div className="mt-2 text-xs text-gray-700 space-y-1">
                        {termEndsText && (
                          <div>
                            <span className="font-semibold">Term ends:</span>{" "}
                            {termEndsText}
                          </div>
                        )}
                        <div>
                          <span className="font-semibold">Shares renewed:</span>{" "}
                          {sharesRenewed}
                        </div>
                        <div>
                          <span className="font-semibold">Price per share:</span>{" "}
                          {fmtGBP(pricePerShare)}
                        </div>
                        <div>
                          <span className="font-semibold">Total:</span>{" "}
                          {fmtGBP(lineTotal)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="mt-6 text-sm text-gray-600">
              Your renewal has been processed. You’ll find full details in <em>My Paddock</em> and in your email.
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/my-paddock"
              className="inline-flex items-center px-4 py-2 rounded bg-green-900 text-white hover:bg-green-800"
            >
              Go to My Paddock
            </Link>
            <Link
              href="/horses"
              className="inline-flex items-center px-4 py-2 rounded border text-green-900 hover:bg-white"
            >
              Browse more horses
            </Link>
          </div>

          <p className="mt-6 text-xs text-gray-500">
          </p>
        </div>
      </main>
    </>
  );
}