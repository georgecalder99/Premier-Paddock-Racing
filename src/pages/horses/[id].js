// src/pages/horses/[id].js
import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";

// helpers
const fmtGBP = (n) => `£${Number(n || 0).toLocaleString()}`;

export default function HorseDetailPage() {
  const router = useRouter();
  const { id: horseId } = router.query;

  const [loading, setLoading] = useState(true);
  const [horse, setHorse] = useState(null);

  const [session, setSession] = useState(null);
  const [yourShares, setYourShares] = useState(0);
  const [soldTotal, setSoldTotal] = useState(0);
  const [qty, setQty] = useState(1);

  // auth
  useEffect(() => {
    let sub;
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);
      const { data: s } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess));
      sub = s;
    })();
    return () => sub?.subscription?.unsubscribe();
  }, []);

  // core horse + sold/ownership
  useEffect(() => {
    if (!horseId) return;
    (async () => {
      setLoading(true);
const { data: h, error: hErr } = await supabase
  .from("horses")
  .select("*")
  .eq("id", horseId)
  .maybeSingle();

if (hErr) console.error("[HorseDetail] horse load error:", hErr);

      if (hErr || !h) {
        console.error("[HorseDetail] horse load error:", hErr);
        setHorse(null);
        setLoading(false);
        return;
      }

      setHorse(h);

      // sold across all users
      const { data: ownsAll } = await supabase
        .from("ownerships")
        .select("shares")
        .eq("horse_id", horseId);

      const totalSold = (ownsAll || []).reduce((s, o) => s + (o.shares || 0), 0);
      setSoldTotal(totalSold);

      // your shares
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

      setLoading(false);
    })();
  }, [horseId, session?.user?.id]);

  // derived availability
  const derived = useMemo(() => {
    if (!horse) return { total: 0, sold: 0, remaining: 0, pct: 0 };
    const total = horse.total_shares ?? 0;
    const sold = soldTotal ?? 0;
    const remaining = Math.max(0, total - sold);
    const rawPct = total > 0 ? (sold / total) * 100 : 0;
    const pct = sold > 0 && rawPct < 1 ? 1 : Math.round(rawPct);
    return { total, sold, remaining, pct };
  }, [horse, soldTotal]);

  // gallery photos
  const photos = useMemo(() => {
    const arr = Array.isArray(horse?.photos) ? horse.photos : [];
    const list = [...arr];
    if (!list.length && horse?.photo_url) list.push(horse.photo_url);
    return list.slice(0, 4);
  }, [horse?.photos, horse?.photo_url]);

  // quick buy
  async function buyShares() {
    if (!session) {
      alert("Please log in first to buy shares.");
      window.location.href = "/my-paddock";
      return;
    }
    const n = Math.min(100, Math.max(1, Number(qty || 1)));

    const { data: liveHorse, error: liveErr } = await supabase
      .from("horses")
      .select("id,total_shares")
      .eq("id", horseId)
      .single();
    if (liveErr || !liveHorse) {
      alert("Could not verify availability. Try again.");
      return;
    }
    const { data: ownsOne } = await supabase
      .from("ownerships")
      .select("horse_id, shares")
      .eq("horse_id", horseId);
    const soldLive = (ownsOne || []).reduce((s, o) => s + (o.shares || 0), 0);
    const remainingLive = Math.max(0, (liveHorse.total_shares ?? 0) - soldLive);

    if (remainingLive <= 0) {
      alert("Sorry, this horse is sold out.");
      return;
    }
    if (n > remainingLive) {
      alert(`Only ${remainingLive} share(s) remaining for ${horse?.name || "this horse"}.`);
      return;
    }

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
      if (error) {
        alert("Could not update your shares.");
        return;
      }
    } else {
      const { error } = await supabase.from("ownerships").insert({
        user_id: userId,
        horse_id: horseId,
        shares: n,
      });
      if (error) {
        alert("Could not add your shares.");
        return;
      }
    }

    window.location.href = `/purchase/success?horse=${encodeURIComponent(
      horseId
    )}&qty=${encodeURIComponent(n)}`;
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

  const OWNERSHIP_BENEFITS = [
    "Regular trainer & stable updates",
    "Entry/dec declarations and race-day info",
    "Owners’ badge ballots & stable visit ballots",
    "Share of prize money (pro-rata after costs)",
    "Member events and behind-the-scenes content",
    "Owner portal with results, updates and payments",
  ];

  const cost = {
    horse_value: Number(horse.horse_value || 0),
    training_vet: Number(horse.training_vet || 0),
    insurance_race: Number(horse.insurance_race || 0),
    management_fee: Number(horse.management_fee || 0),
    contingency: Number(horse.contingency || 0),
  };
  const breakdownTotal =
    horse.breakdown_total ??
    cost.horse_value +
      cost.training_vet +
      cost.insurance_race +
      cost.management_fee +
      cost.contingency;

  return (
    <>
      <Head>
        <title>{horse.name} | Premier Paddock Racing</title>
        <meta name="description" content={`Meet ${horse.name}. Info, pedigree, costs and how to buy shares.`} />
      </Head>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Title */}
        <div className="flex items-end justify-between mb-6">
          <h1 className="text-3xl md:text-4xl font-extrabold text-green-900">Meet {horse.name}</h1>
          <Link href="/horses" className="text-green-800 hover:underline">← Back to all horses</Link>
        </div>

        {/* Grid: content + sticky purchase */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* LEFT: content */}
          <div className="lg:col-span-2 space-y-10">
            {/* Gallery */}
            <section>
              {photos.length > 0 ? (
                <div className="grid sm:grid-cols-2 gap-3">
                  {photos.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt={`${horse.name} photo ${i + 1}`}
                      className="w-full aspect-[4/3] object-cover rounded-xl border"
                    />
                  ))}
                </div>
              ) : (
                <img
                  src={horse.photo_url || "https://placehold.co/1200x800?text=Horse"}
                  alt={horse.name}
                  className="w-full aspect-[4/3] object-cover rounded-xl border"
                />
              )}
            </section>

            {/* Description */}
            <section className="bg-white rounded-xl border p-6 shadow-sm">
              <h2 className="text-2xl font-bold text-green-900">About {horse.name}</h2>
              <p className="text-gray-800 leading-relaxed mt-3 whitespace-pre-wrap">
                {horse.description || "No description yet."}
              </p>
            </section>

            {/* Trainer (no 'stayer' word) */}
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

            {/* Share breakdown (LIST with total at bottom) */}
            <section className="bg-white rounded-xl border p-6 shadow-sm">
              <h2 className="text-2xl font-bold text-green-900">Share Breakdown & Costs</h2>
              <p className="text-sm text-gray-600 mt-1">Transparent, one-off upfront costs.</p>
              <ul className="mt-4 space-y-2">
                <BreakdownRow label="Horse value" value={cost.horse_value} />
                <BreakdownRow label="Training & vet bills" value={cost.training_vet} />
                <BreakdownRow label="Insurance & race fees" value={cost.insurance_race} />
                <BreakdownRow label="Management fee" value={cost.management_fee} />
                <BreakdownRow label="Contingency" value={cost.contingency} />
                <BreakdownRow label="Total" value={breakdownTotal} bold />
              </ul>
            </section>

            {/* Breeding */}
            <section className="bg-white rounded-xl border p-6 shadow-sm">
              <h2 className="text-2xl font-bold text-green-900">Breeding</h2>
              <div className="mt-3 grid sm:grid-cols-2 gap-3 text-gray-800">
                <Detail label="Sire" value={horse.sire} />
                <Detail label="Dam" value={horse.dam} />
                <Detail label="Damsire" value={horse.damsire} />
                <Detail label="Foaled" value={horse.foaled} />
                <Detail label="Sex" value={horse.sex} />
                <Detail label="Colour" value={horse.color} />
                <Detail label="Breeder" value={horse.breeder} />
              </div>
            </section>

            {/* Recent form */}
            <section className="bg-white rounded-xl border p-6 shadow-sm">
              <h2 className="text-2xl font-bold text-green-900">Recent Form</h2>
              <p className="text-gray-800 mt-3 whitespace-pre-wrap">
                {horse.form_text || "No form entered yet."}
              </p>
            </section>

            {/* Ownership benefits (boxed rows) */}
            <section className="bg-white rounded-xl border p-6 shadow-sm">
              <h2 className="text-2xl font-bold text-green-900">Ownership Benefits</h2>
              <ul className="mt-4 space-y-2">
                {OWNERSHIP_BENEFITS.map((b, i) => (
                  <li key={i} className="flex items-center justify-between rounded-lg border p-3">
                    <span className="text-sm text-gray-800">{b}</span>
                    <span className="text-sm text-green-700">✓</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* RIGHT: sticky purchase */}
          <aside className="lg:col-span-1">
            <div className="lg:sticky lg:top-24">
              <PurchaseCard
                horse={horse}
                derived={derived}
                session={session}
                yourShares={yourShares}
                qty={qty}
                setQty={setQty}
                buyShares={buyShares}
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

function PurchaseCard({ horse, derived, session, yourShares, qty, setQty, buyShares }) {
  const soldOut = derived.remaining <= 0;
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
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
            onChange={(e) =>
              setQty(Math.min(100, Math.max(1, parseInt(e.target.value || "1", 10))))
            }
            className="border rounded px-2 py-1 text-sm"
            disabled={soldOut}
            aria-label={`Select quantity for ${horse.name}`}
          >
            {Array.from({ length: 100 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        {!session ? (
          <button
            onClick={() => (window.location.href = "/my-paddock")}
            className="px-3 py-2 bg-green-700 text-white rounded text-sm hover:bg-green-800"
          >
            Sign in to purchase
          </button>
        ) : (
          <button
            onClick={buyShares}
            className="px-3 py-2 bg-amber-500 text-white rounded text-sm disabled:opacity-50"
            disabled={soldOut}
            title={soldOut ? "Sold out" : "Quick Buy"}
          >
            {soldOut ? "Sold out" : "Buy shares"}
          </button>
        )}
      </div>
    </div>
  );
}

function BreakdownRow({ label, value, bold }) {
  return (
    <li className="flex items-center justify-between rounded-lg border p-3">
      <span className="text-sm text-gray-700">{label}</span>
      <span className={`text-sm ${bold ? "font-extrabold text-green-900" : "font-semibold text-gray-900"}`}>
        {fmtGBP(value)}
      </span>
    </li>
  );
}

function Detail({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <span className="text-sm text-gray-700">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value || "—"}</span>
    </div>
  );
}