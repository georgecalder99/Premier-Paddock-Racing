// src/pages/purchase/success.js
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function PurchaseSuccess() {
  const router = useRouter();
  const { horse: horseId, qty: qtyParam } = router.query;

  const [horse, setHorse] = useState(null);
  const [loading, setLoading] = useState(true);
  const qty = Math.max(1, Number(qtyParam || 1));

  useEffect(() => {
    if (!horseId) return;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("horses")
        .select("id,name,share_price,trainer,specialty,photo_url")
        .eq("id", horseId)
        .single();
      if (!error) setHorse(data || null);
      setLoading(false);
    }
    load();
  }, [horseId]);

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
          ) : !horse ? (
            <p className="mt-4 text-gray-600">We couldn’t find that horse record.</p>
          ) : (
            <>
              <div className="mt-6 flex gap-5">
                <img
                  src={horse.photo_url || "https://placehold.co/320x200?text=Horse"}
                  alt={horse.name}
                  className="w-44 h-28 object-cover rounded"
                />
                <div>
                  <h2 className="text-xl font-semibold">{horse.name}</h2>
                  <p className="text-sm text-gray-600">
                    {horse.specialty || "—"} • Trainer: {horse.trainer || "—"}
                  </p>
                  <div className="mt-3 text-sm">
                    <div>Quantity: <strong>{qty}</strong></div>
                    <div>Price per share: <strong>£{horse.share_price ?? 60}</strong></div>
                    <div className="mt-1">
                      Total paid:{" "}
                      <strong>£{((horse.share_price ?? 60) * qty).toLocaleString()}</strong>
                    </div>
                  </div>
                </div>
              </div>

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