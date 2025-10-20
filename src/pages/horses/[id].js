/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";

const fmtGBP = (n) => `£${Number(n || 0).toLocaleString()}`;
const plural = (n, one, many) => (n === 1 ? one : many);

// --- server-count fetcher
async function fetchPromoStats(horseId) {
  try {
    const r = await fetch(`/api/promotions/stats?horse_id=${encodeURIComponent(horseId)}`);
    if (!r.ok) return { promotion: null, claimed: 0, left: 0, active: false };
    return await r.json();
  } catch {
    return { promotion: null, claimed: 0, left: 0, active: false };
  }
}

// --- normalize any label to "... {N} or more shares"
function normalizePromoLabel({ quota, min, startAt, raw }) {
  // Fallback label if none provided
  const base =
    startAt
      ? `Next ${quota} who buy ${min} or more shares`
      : `First ${quota} who buy ${min} or more shares`;

  if (!raw || typeof raw !== "string") return base;

  let s = raw;

  // Replace symbols like "≥2" with "2 or more"
  s = s.replace(/≥\s*(\d+)/gi, (_m, n) => `${n} or more`);

  // Replace "2+ shares" with "2 or more shares"
  s = s.replace(/\b(\d+)\+\s*shares?\b/gi, (_m, n) => `${n} or more shares`);

  // If it's "buy 2" WITHOUT already having "or more" after the 2, add "or more"
  s = s.replace(/\bbuy\s+(\d+)(?!\s*or\s+more)\b/gi, (_m, n) => `buy ${n} or more`);

  // If it's "buy 2 or more" WITHOUT "shares" after, append "shares"
  s = s.replace(/\b(buy\s+\d+\s+or\s+more)(?!\s+shares)\b/gi, (_m, grp) => `${grp} shares`);

  // If it's "buy 2 or more shares shares" (double), collapse
  s = s.replace(/\bshares\s+shares\b/gi, "shares");

  // If we accidentally got "... or more or more", collapse duplicates
  s = s.replace(/\bor more(?:\s+shares)?\s+or more\b/gi, "or more");

  return s;
}

export default function HorseDetailPage() {
  const router = useRouter();
  const { id: horseId } = router.query;

  const [loading, setLoading] = useState(true);
  const [horse, setHorse] = useState(null);

  const [session, setSession] = useState(null);
  const [yourShares, setYourShares] = useState(0);
  const [soldTotal, setSoldTotal] = useState(0);
  const [qty, setQty] = useState(1);

  // promo row & live counters (from server)
  const [promoRow, setPromoRow] = useState(null);
  const [promoStats, setPromoStats] = useState(null); // {claimed,left,active}

  // auth
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub?.subscription?.unsubscribe();
  }, []);

  // load horse + totals + server promo
  const refreshAll = useCallback(async () => {
    if (!horseId) return;
    setLoading(true);

    // Horse
    const { data: h, error: hErr } = await supabase
      .from("horses")
      .select("*")
      .eq("id", horseId)
      .maybeSingle();
    if (hErr || !h) {
      console.error("[HorseDetail] horse load error:", hErr);
      setHorse(null);
      setLoading(false);
      return;
    }
    setHorse(h);

    // Totals sold
    const { data: ownsAll } = await supabase
      .from("ownerships")
      .select("shares")
      .eq("horse_id", horseId);
    const totalSold = (ownsAll || []).reduce((s, o) => s + (o.shares || 0), 0);
    setSoldTotal(totalSold);

    // Your holdings
    if (session?.user?.id) {
      const { data: ownMine } = await supabase
        .from("ownerships")
        .select("shares")
        .eq("horse_id", horseId)
        .eq("user_id", session.user.id)
        .maybeSingle();
      setYourShares(ownMine?.shares || 0);
    } else {
      setYourShares(0);
    }

    // Promo via server API
    const stats = await fetchPromoStats(horseId);
    setPromoRow(stats.promotion);
    setPromoStats(stats);

    setLoading(false);
  }, [horseId, session?.user?.id]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  // realtime: when purchases/promotions change, re-fetch server stats + refresh sold
  useEffect(() => {
    if (!horseId) return;
    const channel = supabase.channel(`horse-${horseId}-live`);

    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "purchases", filter: `horse_id=eq.${horseId}` },
      async () => {
        const stats = await fetchPromoStats(horseId);
        setPromoRow(stats.promotion);
        setPromoStats(stats);

        // refresh sold progress
        const { data: ownsAll } = await supabase
          .from("ownerships")
          .select("shares")
          .eq("horse_id", horseId);
        const totalSold = (ownsAll || []).reduce((s, o) => s + (o.shares || 0), 0);
        setSoldTotal(totalSold);
      }
    );

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "promotions", filter: `horse_id=eq.${horseId}` },
      async () => {
        const stats = await fetchPromoStats(horseId);
        setPromoRow(stats.promotion);
        setPromoStats(stats);
      }
    );

    channel.subscribe();
    return () => supabase.removeChannel(channel);
  }, [horseId]);

  // derived progress
  const derived = useMemo(() => {
    if (!horse) return { total: 0, sold: 0, remaining: 0, pct: 0 };
    const total = horse.total_shares ?? 0;
    const sold = soldTotal ?? 0;
    const remaining = Math.max(0, total - sold);
    const rawPct = total > 0 ? (sold / total) * 100 : 0;
    const pct = sold > 0 && rawPct < 1 ? 1 : Math.round(rawPct);
    return { total, sold, remaining, pct };
  }, [horse, soldTotal]);

  // buy
  async function buyShares() {
    if (!session) {
      alert("Please log in first to buy shares.");
      window.location.href = "/my-paddock";
      return;
    }
    const n = Math.min(100, Math.max(1, Number(qty || 1)));

    const { data: liveHorse, error: liveErr } = await supabase
      .from("horses")
      .select("id,total_shares, name, share_price")
      .eq("id", horseId)
      .single();
    if (liveErr || !liveHorse) { alert("Could not verify availability. Try again."); return; }

    const { data: ownsOne } = await supabase
      .from("ownerships")
      .select("horse_id, shares")
      .eq("horse_id", horseId);
    const soldLive = (ownsOne || []).reduce((s, o) => s + (o.shares || 0), 0);
    const remainingLive = Math.max(0, (liveHorse.total_shares ?? 0) - soldLive);
    if (remainingLive <= 0) { alert("Sorry, this horse is sold out."); return; }
    if (n > remainingLive) { alert(`Only ${remainingLive} share(s) remaining for ${liveHorse?.name || "this horse"}.`); return; }

    const userId = session.user.id;
    const { data: existing, error: checkError } = await supabase
      .from("ownerships")
      .select("id, shares")
      .eq("user_id", userId)
      .eq("horse_id", horseId)
      .maybeSingle();
    if (checkError && checkError.code !== "PGRST116") {
      console.error("Ownership check error:", checkError);
      alert("Something went wrong. Try again.");
      return;
    }

    if (existing) {
      const { error } = await supabase
        .from("ownerships")
        .update({ shares: (existing.shares || 0) + n })
        .eq("id", existing.id);
      if (error) { alert("Could not update your shares."); return; }
    } else {
      const { error } = await supabase.from("ownerships").insert({ user_id: userId, horse_id: horseId, shares: n });
      if (error) { alert("Could not add your shares."); return; }
    }

    // purchases row (for promo tracking)
    try {
      const { error: purchaseErr } = await supabase
        .from("purchases")
        .insert({ user_id: userId, horse_id: horseId, qty: n, metadata: { source: "detail_buy" } });
      if (purchaseErr) console.error("[purchase log] insert failed:", purchaseErr);
    } catch (e) {
      console.error("[purchase log] unexpected:", e);
    }

    // optional email
    try {
      const to = session.user?.email || "";
      if (to) {
        const pricePerShare = Number(liveHorse?.share_price ?? 0);
        const total = pricePerShare * n;
        await fetch("/api/send-purchase-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to,
            horseName: liveHorse?.name || "Horse",
            qty: n,
            pricePerShare,
            total,
          }),
        });
      }
    } catch (e) {
      console.error("[purchase email] failed:", e);
    }

    window.location.href = `/purchase/success?horse=${encodeURIComponent(horseId)}&qty=${encodeURIComponent(n)}`;
  }

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto px-6 py-12">
        <p className="text-gray-600">Loading…</p>
      </main>
    );
  }

  if (!horse) {
    return (
      <main className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-red-700">Horse not found</h1>
        <p className="mt-2">
          <Link className="text-green-800 underline" href="/horses">← Back to horses</Link>
        </p>
      </main>
    );
  }

  // Build promo with normalized label
  const promo =
    promoRow && promoStats
      ? {
          label: normalizePromoLabel({
            quota: promoRow.quota,
            min: promoRow.min_shares_required,
            startAt: promoRow.start_at,
            raw: promoRow.label,
          }),
          reward: promoRow.reward || "Bonus reward",
          quota: promoRow.quota,
          minShares: promoRow.min_shares_required,
          claimed: promoStats.claimed,
          left: promoStats.left,
          active: promoStats.active,
        }
      : null;

  return (
    <>
      <Head>
        <title>{horse.name} | Premier Paddock Racing</title>
        <meta name="description" content={`Meet ${horse.name}. Info, pedigree, costs and how to buy shares.`} />
      </Head>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-end justify-between mb-6">
          <h1 className="text-3xl md:text-4xl font-extrabold text-green-900">Meet {horse.name}</h1>
          <Link href="/horses" className="text-green-800 hover:underline">← Back to all horses</Link>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* LEFT */}
          <div className="lg:col-span-2 space-y-10">
            {/* Gallery */}
            <section>
              {Array.isArray(horse?.photos) && horse.photos.length ? (
                <div className="grid sm:grid-cols-2 gap-3">
                  {horse.photos.slice(0, 4).map((src, i) => (
                    <img key={i} src={src} alt={`${horse.name} photo ${i + 1}`} className="w-full h-56 sm:h-72 md:h-96 object-cover rounded-xl border" />
                  ))}
                </div>
              ) : (
                <img
                  src={horse.photo_url || "https://placehold.co/1200x800?text=Horse"}
                  alt={horse.name}
                  className="w-full h-56 sm:h-72 md:h-96 object-cover rounded-xl border"
                />
              )}
            </section>

            {/* About */}
            <section className="bg-white rounded-xl border p-6 shadow-sm">
              <h2 className="text-2xl font-bold text-green-900">About {horse.name}</h2>
              <p className="text-gray-800 leading-relaxed mt-3 whitespace-pre-wrap">
                {horse.description || "No description yet."}
              </p>
            </section>

            {/* Trainer */}
            <section className="bg-white rounded-xl border p-6 shadow-sm">
              <h2 className="text-2xl font-bold text-green-900">About the Trainer</h2>
              <div className="mt-4 flex gap-4 items-start">
                {horse.trainer_photo_url ? (
                  <img
                    src={horse.trainer_photo_url}
                    alt={horse.trainer ? `${horse.trainer} — trainer` : "Trainer"}
                    className="w-28 h-28 object-cover rounded-full border"
                  />
                ) : null}
                <div className="flex-1">
                  <p className="text-sm text-gray-600">
                    {horse.trainer ? <span className="font-semibold">{horse.trainer}</span> : "Trainer TBC"}
                  </p>
                  <p className="text-gray-800 leading-relaxed mt-2 whitespace-pre-wrap">
                    {horse.trainer_bio || "Trainer biography coming soon."}
                  </p>
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT: sticky purchase */}
          <aside className="lg:col-span-1">
            <div className="lg:sticky lg:top-24">
              <PurchaseCard
                horse={horse}
                derived={{
                  total: horse.total_shares ?? 0,
                  sold: soldTotal ?? 0,
                  remaining: Math.max(0, (horse.total_shares ?? 0) - (soldTotal ?? 0)),
                  pct:
                    (horse.total_shares ?? 0) > 0
                      ? Math.max(1, Math.round(((soldTotal ?? 0) / (horse.total_shares ?? 0)) * 100))
                      : 0,
                }}
                session={session}
                yourShares={yourShares}
                qty={qty}
                setQty={setQty}
                buyShares={buyShares}
                promo={promo}
              />
            </div>
          </aside>
        </div>

        <div className="mt-12">
          <Link href="/horses" className="text-green-800 hover:underline">← Back to all horses</Link>
        </div>
      </main>
    </>
  );
}

function PurchaseCard({ horse, derived, session, yourShares, qty, setQty, buyShares, promo }) {
  const soldOut = derived.remaining <= 0;
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      {/* Promo panel */}
      {promo && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm ring-1
                         ${promo.active ? "bg-amber-50 text-amber-900 ring-amber-200"
                                         : "bg-gray-50 text-gray-700 ring-gray-200"}`}>
          <div className="font-semibold">{promo.label}</div>
          <div className="mt-1">{promo.reward}</div>
          <div className="mt-1 text-xs">
            {promo.active
              ? `${promo.claimed} claimed · ${promo.left} ${plural(promo.left,"left","left")}`
              : `All ${promo.quota} claimed`}
          </div>
        </div>
      )}

      <div className="text-sm text-gray-600">Share price</div>
      <div className="text-2xl font-extrabold text-green-900">
        {horse.share_price ? fmtGBP(horse.share_price) : "—"}{" "}
        <span className="text-base font-medium text-gray-700">/ share</span>
      </div>

      {/* Progress */}
      <div className="mt-4">
        <div className="h-2 w-full bg-gray-200 rounded">
          <div className="h-2 bg-green-600 rounded" style={{ width: `${derived.pct}%` }} />
        </div>
        <div className="mt-1 text-xs text-gray-600 flex justify-between">
          <span>{derived.sold.toLocaleString()} sold</span>
          <span>{derived.remaining > 0 ? `${derived.remaining.toLocaleString()} available` : "Sold out"}</span>
        </div>
      </div>

      <div className="mt-4 rounded-lg border p-3">
        <div className="text-xs text-gray-600">Your holdings</div>
        <div className="text-lg font-semibold">
          {session ? `${yourShares} share${yourShares === 1 ? "" : "s"}` : "Sign in to see"}
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <label className="text-sm text-gray-700">
          Qty:&nbsp;
          <select
            value={qty}
            onChange={(e) => setQty(Math.min(100, Math.max(1, parseInt(e.target.value || "1", 10))))}
            className="border rounded px-2 py-1 text-sm"
            disabled={soldOut}
            aria-label={`Select quantity for ${horse.name}`}
          >
            {Array.from({ length: 100 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>

        {!session ? (
          <button onClick={() => (window.location.href = "/my-paddock")} className="px-3 py-2 bg-green-700 text-white rounded text-sm hover:bg-green-800">
            Sign in to purchase
          </button>
        ) : (
          <button
            onClick={buyShares}
            className="px-3 py-2 bg-amber-500 text-white rounded text-sm disabled:opacity-50"
            disabled={soldOut}
            title={soldOut ? "Sold out" : "Buy shares"}
          >
            {soldOut ? "Sold out" : "Buy shares"}
          </button>
        )}
      </div>
    </div>
  );
}