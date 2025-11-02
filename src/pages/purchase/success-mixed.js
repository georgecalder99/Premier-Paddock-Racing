// src/pages/purchase/success-mixed.js
import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

function fmtGBP(n) {
  return `£${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

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

export default function MixedSuccessPage() {
  const [receipt, setReceipt] = useState(null);
  const [horseNames, setHorseNames] = useState({});   // id -> name
  const [horseCycles, setHorseCycles] = useState({}); // id -> { term_end_date, renew_period_end, term_label }

  // 1) load receipt from sessionStorage
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("lastCheckout");
      if (raw) {
        setReceipt(JSON.parse(raw));
      }
    } catch {
      // ignore
    }
  }, []);

  // 2) figure out shares + renewals from receipt
  const shares = useMemo(
    () => (receipt?.items || []).filter((i) => i.item_type === "share"),
    [receipt]
  );
  const renewals = useMemo(
    () => (receipt?.items || []).filter((i) => i.item_type === "renewal"),
    [receipt]
  );

  // helper to collect all horse ids used in receipt
  const allHorseIds = useMemo(() => {
    const ids = new Set();
    (receipt?.items || []).forEach((line) => {
      if (line.horse_id) ids.add(line.horse_id);
      if (line.display_horse_id) ids.add(line.display_horse_id);
    });
    return Array.from(ids);
  }, [receipt]);

  // 3) fetch horse names (like you already had)
  useEffect(() => {
    (async () => {
      if (!allHorseIds.length) return;
      const { data, error } = await supabase
        .from("horses")
        .select("id, name")
        .in("id", allHorseIds);

      if (error) {
        console.warn("[success-mixed] horse fetch error:", error);
        return;
      }

      const map = Object.fromEntries((data || []).map((h) => [h.id, h.name]));
      setHorseNames(map);
    })();
  }, [allHorseIds]);

  // 4) fetch the latest renew_cycle per horse (so we can show Term ends)
  useEffect(() => {
    (async () => {
      if (!renewals.length) return;

      // only renewals need cycle info
      const renewalHorseIds = [
        ...new Set(
          renewals
            .map((r) => r.horse_id || r.display_horse_id)
            .filter(Boolean)
        ),
      ];
      if (!renewalHorseIds.length) return;

      const { data: cycles, error } = await supabase
        .from("renew_cycles")
        .select("id, horse_id, term_end_date, renew_period_end, term_label")
        .in("horse_id", renewalHorseIds);

      if (error) {
        console.warn("[success-mixed] renew_cycle fetch error:", error);
        return;
      }

      // pick latest per horse
      const byHorse = {};
      for (const c of cycles || []) {
        const key = c.horse_id;
        const existing = byHorse[key];
        const thisEnd = c.term_end_date || c.renew_period_end || null;
        const existingEnd = existing
          ? existing.term_end_date || existing.renew_period_end || null
          : null;

        if (!existingEnd) {
          byHorse[key] = c;
        } else if (thisEnd && new Date(thisEnd) > new Date(existingEnd)) {
          byHorse[key] = c;
        }
      }

      setHorseCycles((prev) => ({ ...prev, ...byHorse }));
    })();
  }, [renewals]);

  // helper to resolve name
  const getHorseLabel = (line) => {
    if (line.horse_name) return line.horse_name;
    if (line.horse_id && horseNames[line.horse_id]) {
      return horseNames[line.horse_id];
    }
    if (line.display_horse_id && horseNames[line.display_horse_id]) {
      return horseNames[line.display_horse_id];
    }
    if (line.horse_id) return `Horse #${line.horse_id}`;
    if (line.display_horse_id) return `Horse #${line.display_horse_id}`;
    return "Horse";
  };

  return (
    <>
      <Head>
        <title>Purchase & renewal confirmed | Premier Paddock Racing</title>
        <meta name="robots" content="noindex" />
      </Head>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              ✅
            </span>
            <h1 className="text-2xl font-bold text-green-900">All set!</h1>
          </div>

          {!receipt ? (
            <p className="mt-4 text-gray-600">
              Your purchases and renewals have been processed.
            </p>
          ) : (
            <>
              {/* Purchases */}
              {shares.length > 0 && (
                <div className="mt-6">
                  <h2 className="text-lg font-semibold text-green-900">
                    New shares
                  </h2>
                  <ul className="mt-3 space-y-3">
                    {shares.map((s, idx) => {
                      const horseLabel = getHorseLabel(s);
                      const total = (s.unit_price_cents || 0) * (s.qty || 0);
                      return (
                        <li key={idx} className="rounded border p-3">
                          <div className="text-sm space-y-1">
                            <div>
                              <span className="font-medium">Horse:</span>{" "}
                              {horseLabel}
                            </div>
                            <div>
                              <span className="font-medium">Shares:</span>{" "}
                              {s.qty}
                            </div>
                            <div>
                              <span className="font-medium">
                                Price per share:
                              </span>{" "}
                              {fmtGBP((s.unit_price_cents || 0) / 100)}
                            </div>
                            <div>
                              <span className="font-medium">Total:</span>{" "}
                              {fmtGBP(total / 100)}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Renewals */}
              {renewals.length > 0 && (
                <div className="mt-6">
                  <h2 className="text-lg font-semibold text-green-900">
                    Renewals
                  </h2>
                  <ul className="mt-3 space-y-3">
                    {renewals.map((r, idx) => {
                      const horseLabel = getHorseLabel(r);
                      const total = (r.unit_price_cents || 0) * (r.qty || 0);
                      const horseId = r.horse_id || r.display_horse_id || null;
                      const cycle = horseId ? horseCycles[horseId] : null;
                      const termEnds =
                        cycle?.term_end_date || cycle?.renew_period_end || null;
                      const termEndsText = termEnds ? fmtDateUK(termEnds) : null;

                      return (
                        <li key={idx} className="rounded border p-3 bg-gray-50">
                          <div className="text-sm space-y-1">
                            <div>
                              <span className="font-medium">Horse:</span>{" "}
                              {horseLabel}
                            </div>

                            {r.renew_title ? (
                              <div>
                                <span className="font-medium">Renewal:</span>{" "}
                                {r.renew_title}
                              </div>
                            ) : null}

                            {/* NEW: term ends */}
                            {termEndsText ? (
                              <div>
                                <span className="font-medium">Term ends:</span>{" "}
                                {termEndsText}
                              </div>
                            ) : null}

                            <div>
                              <span className="font-medium">
                                Shares renewed:
                              </span>{" "}
                              {r.qty}
                            </div>
                            <div>
                              <span className="font-medium">
                                Price per share:
                              </span>{" "}
                              {fmtGBP((r.unit_price_cents || 0) / 100)}
                            </div>
                            <div>
                              <span className="font-medium">Total:</span>{" "}
                              {fmtGBP(total / 100)}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Totals */}
              <div className="mt-6 border-t pt-4 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{fmtGBP((receipt.subtotalCents || 0) / 100)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Wallet used</span>
                  <span>
                    −{fmtGBP((receipt.walletUsedCents || 0) / 100)}
                  </span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Paid</span>
                  <span>{fmtGBP((receipt.totalDueCents || 0) / 100)}</span>
                </div>
              </div>
            </>
          )}

          <div className="mt-6 grid sm:grid-cols-2 gap-3">
            <Link
              href="/my-paddock"
              className="inline-block text-center px-5 py-3 bg-green-900 text-white rounded-lg"
            >
              Go to My Paddock
            </Link>
            <Link
              href="/horses"
              className="inline-block text-center px-5 py-3 border rounded-lg text-green-900 hover:bg-green-50"
            >
              See more horses
            </Link>
          </div>

          <p className="mt-6 text-xs text-gray-500">
            You’ll receive separate confirmation emails for purchases and renewals.
          </p>
        </div>
      </main>
    </>
  );
}