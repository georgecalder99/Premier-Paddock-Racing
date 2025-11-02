// src/pages/purchase/success.js
/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const fmtGBP = (n) =>
  `£${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function PurchaseSuccess() {
  const router = useRouter();
  const { horse: horseId, qty: qtyParam, mode } = router.query;

  // When basket mode, we’ll read from sessionStorage.lastCheckout
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]); // [{ horse_id, qty, unit_price_cents }]
  const [horsesById, setHorsesById] = useState({}); // { [id]: {id,name,photo_url,share_price,trainer,specialty} }

  // totals (cents)
  const [subtotalCents, setSubtotalCents] = useState(0);
  const [walletUsedCents, setWalletUsedCents] = useState(0);
  const [paidCents, setPaidCents] = useState(0);

  // ----- load data depending on mode
  useEffect(() => {
    async function loadSingle() {
      // legacy single-horse success
      const qty = Math.max(1, Number(qtyParam || 1));
      if (!horseId) {
        setLoading(false);
        return;
      }
      // fetch the horse
      const { data: h } = await supabase
        .from("horses")
        .select("id,name,share_price,trainer,specialty,photo_url")
        .eq("id", horseId)
        .maybeSingle();

      const priceCents = Math.round(Number(h?.share_price || 0) * 100);
      const lineTotal = priceCents * qty;

      setItems([{ horse_id: horseId, qty, unit_price_cents: priceCents }]);
      setHorsesById(h ? { [h.id]: h } : {});
      setSubtotalCents(lineTotal);

      // read optional query totals if present
      const qsSubtotal = Number(router.query.subtotal || 0) * 100;
      const qsWallet = Number(router.query.wallet || 0) * 100;
      const qsPaid = Number(router.query.paid || 0) * 100;

      if (qsSubtotal > 0) setSubtotalCents(Math.round(qsSubtotal));
      setWalletUsedCents(Math.max(0, Math.round(qsWallet)));
      setPaidCents(
        Math.max(0, Math.round(qsPaid || (lineTotal - Math.max(0, Math.round(qsWallet)))))
      );

      setLoading(false);
    }

    async function loadBasket() {
      // Try to read sessionStorage receipt
      let receipt = null;
      try {
        const raw = sessionStorage.getItem("lastCheckout");
        if (raw) receipt = JSON.parse(raw);
      } catch {}

      // Fallback from query if needed
      const qsSubtotal = Math.round(Number(router.query.subtotal || 0) * 100);
      const qsWallet = Math.round(Number(router.query.wallet || 0) * 100);
      const qsPaid = Math.round(Number(router.query.paid || 0) * 100);

      const itemsFromReceipt = Array.isArray(receipt?.items) ? receipt.items : [];
      const subCents = receipt?.subtotalCents ?? qsSubtotal ?? 0;
      const walCents = receipt?.walletUsedCents ?? qsWallet ?? 0;
      const paid = receipt?.totalDueCents ?? qsPaid ?? Math.max(0, subCents - walCents);

      setItems(itemsFromReceipt);
      setSubtotalCents(Number(subCents || 0));
      setWalletUsedCents(Number(walCents || 0));
      setPaidCents(Number(paid || 0));

      // Fetch horses for all items
      const ids = [...new Set(itemsFromReceipt.map((it) => it.horse_id).filter(Boolean))];
      if (ids.length) {
        const { data: horses } = await supabase
          .from("horses")
          .select("id,name,share_price,trainer,specialty,photo_url")
          .in("id", ids);

        const map = Object.fromEntries((horses || []).map((h) => [h.id, h]));
        setHorsesById(map);
      }

      setLoading(false);
    }

    if (!router.isReady) return;
    setLoading(true);

    if (mode === "basket") {
      loadBasket();
    } else {
      loadSingle();
    }
  }, [router.isReady, mode, horseId, qtyParam, router.query.subtotal, router.query.wallet, router.query.paid]);

  // derived: if basket but we didn’t have receipt, compute subtotal from items
  const derivedSubtotalCents = useMemo(() => {
    if (subtotalCents > 0) return subtotalCents;
    return items.reduce(
      (s, it) => s + Number(it.unit_price_cents || 0) * Number(it.qty || 0),
      0
    );
  }, [items, subtotalCents]);

  return (
    <>
      <Head>
        <title>Purchase confirmed | Premier Paddock Racing</title>
        <meta name="robots" content="noindex" />
      </Head>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              ✅
            </span>
            <h1 className="text-2xl font-bold text-green-900">Purchase confirmed</h1>
          </div>

          {loading ? (
            <p className="mt-4 text-gray-600">Loading details…</p>
          ) : items.length === 0 ? (
            <>
              <p className="mt-4 text-gray-700">
                Your order was completed, but we couldn’t load the item details.
              </p>
              <div className="mt-6 border-t pt-6 grid sm:grid-cols-2 gap-3">
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
            </>
          ) : (
            <>
              {/* One or many: same card layout per horse */}
              <div className="mt-6 space-y-5">
                {items.map((it, idx) => {
                  const h = horsesById[it.horse_id] || {};
                  const unit =
                    Number(it.unit_price_cents || 0) > 0
                      ? it.unit_price_cents / 100
                      : Number(h?.share_price || 0);
                  const qty = Number(it.qty || 0);
                  const lineTotal = unit * qty;

                  return (
                    <div key={`${it.horse_id}-${idx}`} className="flex gap-5">
                      <img
                        src={h.photo_url || "https://placehold.co/320x200?text=Horse"}
                        alt={h.name || "Horse"}
                        className="w-44 h-28 object-cover rounded"
                      />
                      <div>
                        <h2 className="text-xl font-semibold">{h.name || "Horse"}</h2>
                        <p className="text-sm text-gray-600">
                          {(h.specialty || "—")} • Trainer: {(h.trainer || "—")}
                        </p>
                        <div className="mt-3 text-sm">
                          <div>
                            Quantity: <strong>{qty}</strong>
                          </div>
                          <div>
                            Price per share: <strong>{fmtGBP(unit)}</strong>
                          </div>
                          <div className="mt-1">
                            Total: <strong>{fmtGBP(lineTotal)}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary */}
              <div className="mt-6 rounded-lg border p-4 bg-gray-50">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{fmtGBP(derivedSubtotalCents / 100)}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span>Wallet used</span>
                  <span className="text-emerald-700">−{fmtGBP(walletUsedCents / 100)}</span>
                </div>
                <div className="flex justify-between text-base font-semibold mt-2">
                  <span>Amount paid</span>
                  <span>{fmtGBP((paidCents || Math.max(0, derivedSubtotalCents - walletUsedCents)) / 100)}</span>
                </div>
              </div>

              {/* CTAs */}
              <div className="mt-6 border-t pt-6 grid sm:grid-cols-2 gap-3">
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
                You’ll receive trainer updates and can enter ballots for owners’ badges and stable visits
                from your My Paddock dashboard.
              </p>
            </>
          )}
        </div>
      </main>
    </>
  );
}