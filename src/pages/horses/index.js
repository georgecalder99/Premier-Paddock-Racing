/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

export default function HorsesPage() {
  // ⬇️ ADD
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  if (!hydrated) return null; // or a tiny skeleton/blank div

  const [horses, setHorses] = useState([]);
  const [session, setSession] = useState(null);
  const [ownerships, setOwnerships] = useState({});   // { horseId: sharesOwnedByCurrentUser }
  const [soldByHorse, setSoldByHorse] = useState({}); // { horseId: totalSoldAcrossAllUsers }
  const [qtyByHorse, setQtyByHorse] = useState({});   // { horseId: selectedQty }
  const [loading, setLoading] = useState(true);
  // ...rest of your file unchanged


  // ---------- Load horses + auth ----------
  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);

      // 1) Horses
      const { data: horsesData, error: horsesErr } = await supabase
        .from("horses")
        .select("id,name,trainer,specialty,share_price,photo_url,created_at,total_shares")
        .order("created_at", { ascending: false });

      if (horsesErr) console.error("Load horses error:", horsesErr);
      if (isMounted) setHorses(horsesData || []);

      // 2) Auth session + listener
      const { data: sessData } = await supabase.auth.getSession();
      if (isMounted) setSession(sessData?.session || null);
      const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
        if (isMounted) setSession(s);
      });

      // 3) Ownership totals (for accurate progress bars)
      const ids = (horsesData || []).map((h) => h.id);
      if (ids.length > 0) {
        const { data: owns, error: ownsErr } = await supabase
          .from("ownerships")
          .select("horse_id, shares")
          .in("horse_id", ids);

        if (ownsErr) {
          console.error("Load ownership totals error:", ownsErr);
          if (isMounted) setSoldByHorse({});
        } else {
          const map = {};
          (owns || []).forEach((o) => {
            map[o.horse_id] = (map[o.horse_id] || 0) + (o.shares || 0);
          });
          if (isMounted) setSoldByHorse(map);
        }
      } else {
        if (isMounted) setSoldByHorse({});
      }

      if (isMounted) setLoading(false);
      return () => listener?.subscription?.unsubscribe?.();
    }

    load();
    return () => { isMounted = false; };
  }, []);

  // ---------- Load current user's ownerships ----------
  useEffect(() => {
    let isMounted = true;

    async function loadOwnerships() {
      if (!session) {
        if (isMounted) setOwnerships({});
        return;
      }
      const { data, error } = await supabase
        .from("ownerships")
        .select("horse_id, shares")
        .eq("user_id", session.user.id);

      if (error) {
        console.error("Load my ownerships error:", error);
        return;
      }
      const map = {};
      (data || []).forEach((o) => { map[o.horse_id] = o.shares; });
      if (isMounted) setOwnerships(map);
    }

    loadOwnerships();
    return () => { isMounted = false; };
  }, [session]);

  // ---------- Helpers ----------
  const horsesWithComputed = useMemo(() => {
    return horses.map((h) => {
      const total = h.total_shares ?? 0;
      const sold = soldByHorse[h.id] ?? 0;
      const remaining = Math.max(0, total - sold);
      const rawPct = total > 0 ? (sold / total) * 100 : 0;
      const pct = sold > 0 && rawPct < 1 ? 1 : Math.round(rawPct); // min 1% if some sold
      return { ...h, total, sold, remaining, pct };
    });
  }, [horses, soldByHorse]);

  function setQty(horseId, value) {
    const n = Math.min(100, Math.max(1, parseInt(value || "1", 10)));
    setQtyByHorse((prev) => ({ ...prev, [horseId]: n }));
  }

  // ---------- Buy shares (per-card quick buy) ----------
  async function buyShares(horse, qtyInput) {
    if (!session) {
      alert("Please log in first to buy shares.");
      return;
    }
    const horseId = horse.id;
    const n = Math.min(100, Math.max(1, Number(qtyInput || 1)));

    // Recheck availability live
    const { data: liveHorse, error: liveErr } = await supabase
      .from("horses")
      .select("id,total_shares")
      .eq("id", horseId)
      .single();
    if (liveErr || !liveHorse) {
      console.error("Availability check (horses) error:", liveErr);
      alert(liveErr?.message || "Could not verify availability. Try again.");
      return;
    }

    const { data: ownsOne, error: ownsOneErr } = await supabase
      .from("ownerships")
      .select("horse_id, shares")
      .eq("horse_id", horseId);
    if (ownsOneErr) {
      console.error("Availability check (ownerships) error:", ownsOneErr);
      alert(ownsOneErr?.message || "Could not verify availability. Try again.");
      return;
    }

    const soldLive = (ownsOne || []).reduce((s, o) => s + (o.shares || 0), 0);
    const remainingLive = Math.max(0, (liveHorse.total_shares ?? 0) - soldLive);
    if (remainingLive <= 0) {
      alert("Sorry, this horse is sold out.");
      return;
    }
    if (n > remainingLive) {
      alert(`Only ${remainingLive} share(s) remaining for ${horse.name}.`);
      return;
    }

    const userId = session.user.id;

    // Upsert ownership
    const { data: existing, error: checkError } = await supabase
      .from("ownerships")
      .select("id, shares")
      .eq("user_id", userId)
      .eq("horse_id", horseId)
      .maybeSingle();
    if (checkError && checkError.code !== "PGRST116") {
      console.error("Ownership check error:", checkError);
      alert(checkError.message || "Something went wrong. Try again.");
      return;
    }

    if (existing) {
      const { error } = await supabase
        .from("ownerships")
        .update({ shares: (existing.shares || 0) + n })
        .eq("id", existing.id);
      if (error) {
        console.error("Update ownership error:", error);
        alert(error.message || "Could not update your shares.");
        return;
      }
      setOwnerships((prev) => ({ ...prev, [horseId]: (existing.shares || 0) + n }));
    } else {
      const { error } = await supabase.from("ownerships").insert({
        user_id: userId,
        horse_id: horseId,
        shares: n,
      });
      if (error) {
        console.error("Insert ownership error:", error);
        alert(error.message || "Could not add your shares.");
        return;
      }
      setOwnerships((prev) => ({ ...prev, [horseId]: n }));
    }

    // Refresh sold map for this horse so progress moves immediately
    const { data: ownsOneAfter, error: afterErr } = await supabase
      .from("ownerships")
      .select("horse_id, shares")
      .eq("horse_id", horseId);
    if (!afterErr) {
      const sum = (ownsOneAfter || []).reduce((s, o) => s + (o.shares || 0), 0);
      setSoldByHorse((prev) => ({ ...prev, [horseId]: sum }));
    } else {
      console.error("Refresh sold map error:", afterErr);
    }

    // NOTE: removed syncSubscriberToUserSafe(); not needed with DB-side view


    // --- send confirmation email (non-blocking) ---
try {
  const to = session.user?.email || "";
  if (to) {
    const pricePerShare = Number(horse.share_price ?? 0);
    const total = pricePerShare * n;

    // fire-and-forget, but await once to surface errors in console
    const resp = await fetch("/api/send-purchase-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        horseName: horse.name || "Horse",
        qty: n,
        pricePerShare,
        total,
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error("[purchase email] API error:", resp.status, txt);
    } else {
      const j = await resp.json().catch(() => ({}));
      console.log("[purchase email] sent:", j);
    }
  } else {
    console.warn("[purchase email] No user email on session, skipping.");
  }
} catch (e) {
  console.error("[purchase email] fetch failed:", e);
}

    // ✅ Redirect to confirmation
    window.location.href = `/purchase/success?horse=${encodeURIComponent(horse.id)}&qty=${encodeURIComponent(n)}`;
  }

  return (
    <>
      <Head>
        <title>Our Horses | Premier Paddock Racing</title>
        <meta
          name="description"
          content="Browse available racehorses and buy affordable shares with Premier Paddock Racing."
        />
      </Head>

      <main className="bg-white">
        <HorsesHero />

        <section className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex items-end justify-between mb-8">
            <h1 className="text-3xl font-bold">Current Horses</h1>
            <Link href="/" className="text-green-800 hover:underline">
              ← Back to home
            </Link>
          </div>

          {loading ? (
            <p className="text-gray-600">Loading horses…</p>
          ) : horsesWithComputed.length === 0 ? (
            <p className="text-gray-600">No horses listed yet. Sign up on our homepage to be the first to know when we launch!.</p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {horsesWithComputed.map((h) => {
                const ownedShares = ownerships[h.id] || 0;
                const qty = qtyByHorse[h.id] || 1;
                const soldOut = h.remaining <= 0;

                return (
                  <div key={h.id} className="bg-white rounded-lg shadow p-4">
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
                      <span className="text-sm text-gray-600">
                        {h.total.toLocaleString()} shares
                      </span>
                    </div>

                    {/* Progress */}
                    <div className="mt-3">
                      <div className="h-2 w-full bg-gray-200 rounded">
                        <div
                          className="h-2 bg-green-600 rounded"
                          style={{ width: `${h.pct}%` }}
                          aria-label={`Sold ${h.pct}%`}
                        />
                      </div>
                      <div className="mt-1 text-xs text-gray-600 flex justify-between">
                        <span>{h.sold.toLocaleString()} sold</span>
                        <span>
                          {h.remaining > 0
                            ? `${h.remaining.toLocaleString()} available`
                            : "Sold out"}
                        </span>
                      </div>
                    </div>

                    {/* Footer: Owned/Sold out + Read more */}
                    <div className="mt-3 flex justify-between items-center">
                      {soldOut ? (
                        <span className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm">
                          Sold out
                        </span>
                      ) : ownedShares > 0 ? (
                        <span className="px-3 py-1 bg-green-600 text-white rounded text-sm">
                          Owned ({ownedShares})
                        </span>
                      ) : (
                        <span />
                      )}

                      <Link
                        href={`/horses/${h.id}`}
                        className="text-sm text-green-800 hover:underline"
                        title="Read and learn more"
                      >
                        Read more →
                      </Link>
                    </div>

                    {/* Per-card QUICK BUY */}
                    <div className="mt-4 border-t pt-4 flex items-end justify-between gap-3">
                      <label className="text-sm text-gray-700">
                        Qty:&nbsp;
                        <select
                          value={qty}
                          onChange={(e) => setQty(h.id, e.target.value)}
                          className="border rounded px-2 py-1 text-sm"
                          disabled={soldOut}
                          aria-label={`Select quantity for ${h.name}`}
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
                          Sign in to purchase shares
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
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}

/* ===========================
   HERO (matches homepage style)
=========================== */
function HorsesHero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        <img
          src="/hero.jpg"
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-green-900/60" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-green-900/50 to-transparent" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 py-24 md:py-32 text-white text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight">
            Our Horses
          </h1>
          <p className="mt-5 text-lg md:text-xl text-gray-100">
            Explore active syndicates, check share availability in real time,
            and join the journey from just £60 per share.
          </p>
        </div>
      </div>
    </section>
  );
}