/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

/** ClientOnly wrapper to prevent hydration flicker without touching hook order */
function ClientOnly({ children }) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  if (!hydrated) return <div style={{ visibility: "hidden" }} />;
  return children;
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function plural(n, one, many) { return n === 1 ? one : many; }

function pickActivePromo(nowISO, rows) {
  return (rows || []).filter((p) => {
    if (!p.enabled) return false;
    const startsOk = !p.start_at || p.start_at <= nowISO;
    const endsOk = !p.end_at || p.end_at >= nowISO;
    const hasNums = (p.quota || 0) > 0 && (p.min_shares_required || 0) > 0;
    return startsOk && endsOk && hasNums;
  });
}

async function computePromoClaims(horseId, promo) {
  let q = supabase
    .from("purchases")
    .select("user_id, qty, created_at")
    .eq("horse_id", horseId)
    .gte("qty", promo.min_shares_required);

  if (promo.start_at) q = q.gte("created_at", promo.start_at);
  if (promo.end_at) q = q.lte("created_at", promo.end_at);

  const { data: rows, error } = await q.order("created_at", { ascending: true });
  if (error) {
    console.warn("[promo claims] fetch error:", error);
    return { claimed: 0, left: promo.quota, active: true };
  }

  const seen = new Set();
  const ordered = [];
  for (const r of rows || []) {
    if (!seen.has(r.user_id)) {
      seen.add(r.user_id);
      ordered.push(r.user_id);
      if (ordered.length >= (promo.quota || 0)) break;
    }
  }
  const claimed = ordered.length;
  const left = clamp((promo.quota || 0) - claimed, 0, promo.quota || 0);
  return { claimed, left, active: left > 0 };
}

export default function HorsesPage() {
  const [horses, setHorses] = useState([]);
  const [session, setSession] = useState(null);
  const [ownerships, setOwnerships] = useState({});   // { horseId: sharesOwnedByCurrentUser }
  const [soldByHorse, setSoldByHorse] = useState({}); // { horseId: totalSharesSold }
  const [qtyByHorse, setQtyByHorse] = useState({});   // { horseId: selectedQty }
  const [loading, setLoading] = useState(true);

  // promo state
  const [promosByHorse, setPromosByHorse] = useState({}); // { horseId: promoRow }
  const [claimsByHorse, setClaimsByHorse] = useState({}); // { horseId: {claimed,left,active} }

  // ---------- base loads ----------
  const loadBase = useCallback(async () => {
    setLoading(true);

    // horses
    const { data: horsesData, error: horsesErr } = await supabase
      .from("horses")
      .select("id,name,trainer,specialty,share_price,photo_url,created_at,total_shares")
      .order("created_at", { ascending: false });

    if (horsesErr) console.error("Load horses error:", horsesErr);
    setHorses(horsesData || []);

    // totals
    const ids = (horsesData || []).map((h) => h.id);
    if (ids.length) {
      const { data: owns, error: ownsErr } = await supabase
        .from("ownerships")
        .select("horse_id, shares")
        .in("horse_id", ids);

      if (ownsErr) {
        console.error("Ownership totals error:", ownsErr);
        setSoldByHorse({});
      } else {
        const map = {};
        (owns || []).forEach((o) => { map[o.horse_id] = (map[o.horse_id] || 0) + (o.shares || 0); });
        setSoldByHorse(map);
      }
    } else {
      setSoldByHorse({});
    }

    // session
    const { data: sess } = await supabase.auth.getSession();
    setSession(sess?.session || null);

    // promos + claims
    if (ids.length) {
      const nowISO = new Date().toISOString();
      const { data: promos, error: promoErr } = await supabase
        .from("promotions")
        .select("id,horse_id,enabled,quota,min_shares_required,start_at,end_at,label,reward")
        .in("horse_id", ids)
        .eq("enabled", true);

      if (promoErr) {
        console.warn("[promos] fetch err:", promoErr);
        setPromosByHorse({});
        setClaimsByHorse({});
      } else {
        const active = pickActivePromo(nowISO, promos);
        const byHorse = {};
        active.forEach((p) => { byHorse[p.horse_id] = p; });
        setPromosByHorse(byHorse);

        const claimsMap = {};
        for (const p of active) {
          claimsMap[p.horse_id] = await computePromoClaims(p.horse_id, p);
        }
        setClaimsByHorse(claimsMap);
      }
    } else {
      setPromosByHorse({});
      setClaimsByHorse({});
    }

    setLoading(false);
  }, []);

  useEffect(() => { loadBase(); }, [loadBase]);

  // auth listener
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub?.subscription?.unsubscribe();
  }, []);

  // load your holdings
  useEffect(() => {
    let mounted = true;
    async function loadMine() {
      if (!session) { if (mounted) setOwnerships({}); return; }
      const { data, error } = await supabase
        .from("ownerships")
        .select("horse_id, shares")
        .eq("user_id", session.user.id);
      if (!mounted) return;
      if (!error) {
        const map = {};
        (data || []).forEach((o) => { map[o.horse_id] = o.shares; });
        setOwnerships(map);
      }
    }
    loadMine();
    return () => { mounted = false; };
  }, [session]);

  // ---------- realtime for ALL visible horses ----------
  useEffect(() => {
    if (horses.length === 0) return;

    const channel = supabase.channel("horses-index-live");

    // Updates when purchases come in for any listed horse -> recompute claims for that horse
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "purchases" },
      async (payload) => {
        const horseId = payload.new?.horse_id ?? payload.old?.horse_id;
        if (!horseId) return;

        // refresh sold bar quickly
        const { data: ownsOneAfter } = await supabase
          .from("ownerships")
          .select("horse_id, shares")
          .eq("horse_id", horseId);
        const sum = (ownsOneAfter || []).reduce((s, o) => s + (o.shares || 0), 0);
        setSoldByHorse((prev) => ({ ...prev, [horseId]: sum }));

        // recompute claims only if this horse has an active promo in state
        const promo = promosByHorse[horseId];
        if (promo) {
          const vals = await computePromoClaims(horseId, promo);
          setClaimsByHorse((prev) => ({ ...prev, [horseId]: vals }));
        }
      }
    );

    // If a promotion row changes, update row + recompute
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "promotions" },
      async (payload) => {
        const horseId = payload.new?.horse_id ?? payload.old?.horse_id;
        if (!horseId) return;

        const nowISO = new Date().toISOString();
        const { data: promos } = await supabase
          .from("promotions")
          .select("id,horse_id,enabled,quota,min_shares_required,start_at,end_at,label,reward")
          .eq("horse_id", horseId)
          .eq("enabled", true);

        const active = pickActivePromo(nowISO, promos);
        const activeOne = active[0] || null;

        setPromosByHorse((prev) => ({ ...prev, [horseId]: activeOne || undefined }));

        if (activeOne) {
          const vals = await computePromoClaims(horseId, activeOne);
          setClaimsByHorse((prev) => ({ ...prev, [horseId]: vals }));
        } else {
          setClaimsByHorse((prev) => {
            const copy = { ...prev };
            delete copy[horseId];
            return copy;
          });
        }
      }
    );

    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horses, promosByHorse]);

  // ---------- quick buy (NOW SENDS EMAIL) ----------
  async function buyShares(horse, qtyInput) {
    if (!session) {
      alert("Please log in first to buy shares.");
      window.location.href = "/my-paddock";
      return;
    }
    const horseId = horse.id;
    const n = Math.min(100, Math.max(1, Number(qtyInput || 1)));

    // recheck availability
    const { data: liveHorse, error: liveErr } = await supabase
      .from("horses")
      .select("id,total_shares, name, share_price")
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
    if (remainingLive <= 0) { alert("Sorry, this horse is sold out."); return; }
    if (n > remainingLive) { alert(`Only ${remainingLive} ${plural(remainingLive,"share","shares")} remaining for ${liveHorse?.name || "this horse"}.`); return; }

    // upsert ownership
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

    // log purchase (for promo)
    try {
      const { error: purchaseErr } = await supabase
        .from("purchases")
        .insert({ user_id: userId, horse_id: horseId, qty: n, metadata: { source: "index_quick_buy" } });
      if (purchaseErr) console.error("[purchase log] insert failed:", purchaseErr);
    } catch (e) {
      console.error("[purchase log] unexpected:", e);
    }

    // ✅ send confirmation email (same as ID page)
    try {
      const to = session.user?.email || "";
      if (to) {
        const pricePerShare = Number(liveHorse?.share_price ?? 0);
        const total = pricePerShare * n;
        const r = await fetch("/api/send-purchase-email", {
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
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          console.error("[quick-buy email] backend error:", j?.error || r.statusText);
        }
      }
    } catch (e) {
      console.error("[quick-buy email] failed:", e);
    }

    window.location.href = `/purchase/success?horse=${encodeURIComponent(horseId)}&qty=${encodeURIComponent(n)}`;
  }

  // computed progress + promo merge
  const horsesWithComputed = useMemo(() => {
    return horses.map((h) => {
      const total = h.total_shares ?? 0;
      const sold = soldByHorse[h.id] ?? 0;
      const remaining = Math.max(0, total - sold);
      const rawPct = total > 0 ? (sold / total) * 100 : 0;
      const pct = sold > 0 && rawPct < 1 ? 1 : Math.round(rawPct);

      const p = promosByHorse[h.id];
      const c = claimsByHorse[h.id];

      const promo = p && c
        ? {
            label:
              p.label ||
              (p.start_at
                ? `Next ${p.quota} who buy ${p.min_shares_required} or more shares`
                : `First ${p.quota} who buy ${p.min_shares_required} or more shares`),
            reward: p.reward || "Bonus reward",
            quota: p.quota,
            minShares: p.min_shares_required,
            claimed: c.claimed,
            left: c.left,
            active: c.active,
          }
        : null;

      return { ...h, total, sold, remaining, pct, promo };
    });
  }, [horses, soldByHorse, promosByHorse, claimsByHorse]);

  function setQtyFor(horseId, value) {
    const n = Math.min(100, Math.max(1, parseInt(value || "1", 10)));
    setQtyByHorse((prev) => ({ ...prev, [horseId]: n }));
  }

  return (
    <ClientOnly>
      <>
        <Head>
          <title>Our Horses | Premier Paddock Racing</title>
          <meta name="description" content="Browse available racehorses and buy affordable shares with Premier Paddock Racing." />
        </Head>

        <main className="bg-white">
          <HorsesHero />

          <section className="max-w-7xl mx-auto px-6 py-12">
            <div className="flex items-end justify-between mb-8">
              <h1 className="text-3xl font-bold">Current Horses</h1>
              <Link href="/" className="text-green-800 hover:underline">← Back to home</Link>
            </div>

            {loading ? (
              <p className="text-gray-600">Loading horses…</p>
            ) : horsesWithComputed.length === 0 ? (
              <p className="text-gray-600">No horses listed yet.</p>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {horsesWithComputed.map((h) => {
                  const ownedShares = ownerships[h.id] || 0;
                  const qty = qtyByHorse[h.id] || 1;
                  const soldOut = h.remaining <= 0;

                  return (
                    <article key={h.id} className="relative bg-white rounded-lg shadow p-4 ring-1 ring-black/5">
                      {/* PROMO RIBBON */}
                      {h.promo && (
                        <div
                          className={`absolute -top-3 left-4 right-4 rounded-md px-3 py-2 text-sm shadow
                                      ${h.promo.active ? "bg-amber-100 text-amber-900 border border-amber-300"
                                                       : "bg-gray-100 text-gray-700 border border-gray-300"}`}
                          role="note"
                          aria-live="polite"
                        >
                          <strong>{h.promo.label}</strong>{" · "}
                          {h.promo.reward}
                          {" · "}
                          {h.promo.active
                            ? `${h.promo.claimed} claimed, ${h.promo.left} ${plural(h.promo.left,"left","left")}`
                            : `All ${h.promo.quota} claimed`}
                        </div>
                      )}

                      <img
                        src={h.photo_url || "https://placehold.co/400x250?text=Horse"}
                        alt={h.name}
                        className="w-full h-48 object-cover rounded"
                      />
                      <h3 className="mt-3 font-semibold text-lg">{h.name}</h3>
                      <p className="text-sm text-gray-500">
                        {h.specialty || "—"} • Trainer: {h.trainer || "—"}
                      </p>

                      <div className="mt-3 flex justify-between items-center">
                        <span className="font-bold">
                          £{h.share_price ?? 60} <span className="font-normal">/ share</span>
                        </span>
                        <span className="text-sm text-gray-600">{h.total.toLocaleString()} shares</span>
                      </div>

                      {/* Progress */}
                      <div className="mt-3">
                        <div className="h-2 w-full bg-gray-200 rounded">
                          <div className="h-2 bg-green-600 rounded" style={{ width: `${h.pct}%` }} aria-label={`Sold ${h.pct}%`} />
                        </div>
                        <div className="mt-1 text-xs text-gray-600 flex justify-between">
                          <span>{h.sold.toLocaleString()} sold</span>
                          <span>{h.remaining > 0 ? `${h.remaining.toLocaleString()} available` : "Sold out"}</span>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="mt-3 flex justify-between items-center">
                        {soldOut ? (
                          <span className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm">Sold out</span>
                        ) : ownedShares > 0 ? (
                          <span className="px-3 py-1 bg-green-600 text-white rounded text-sm">Owned ({ownedShares})</span>
                        ) : (
                          <span />
                        )}

                        <Link href={`/horses/${h.id}`} className="text-sm text-green-800 hover:underline" title="Read and learn more">
                          Read more →
                        </Link>
                      </div>

                      {/* Quick buy */}
                      <div className="mt-4 border-t pt-4 flex items-end justify-between gap-3">
                        <label className="text-sm text-gray-700">
                          Qty:&nbsp;
                          <select
                            value={qty}
                            onChange={(e) => setQtyFor(h.id, e.target.value)}
                            className="border rounded px-2 py-1 text-sm"
                            disabled={soldOut}
                            aria-label={`Select quantity for ${h.name}`}
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
                            onClick={() => buyShares(h, qty)}
                            className="px-3 py-2 bg-amber-500 text-white rounded text-sm disabled:opacity-50"
                            disabled={soldOut}
                            title={soldOut ? "Sold out" : "Quick Buy"}
                          >
                            {soldOut ? "Sold out" : "Quick Buy"}
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </>
    </ClientOnly>
  );
}

function HorsesHero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        <img src="/hero.jpg" alt="" aria-hidden="true" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-green-900/60" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-green-900/50 to-transparent" />
      </div>
      <div className="relative max-w-7xl mx-auto px-6 py-24 md:py-32 text-white text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight">Our Horses</h1>
          <p className="mt-5 text-lg md:text-xl text-gray-100">
            Explore active syndicates, check share availability in real time, and join the journey from just £60 per share.
          </p>
        </div>
      </div>
    </section>
  );
}