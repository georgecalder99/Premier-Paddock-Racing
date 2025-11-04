/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";
import { getOrCreateCart, addShareToCart } from "../../lib/cartClient";

const fmtGBP = (n) => `£${Number(n || 0).toLocaleString()}`;
const plural = (n, one, many) => (n === 1 ? one : many);

// ---------- promo helpers ----------
async function fetchPromoStats(horseId) {
  try {
    const r = await fetch(`/api/promotions/stats?horse_id=${encodeURIComponent(horseId)}`);
    if (!r.ok) return { promotion: null, claimed: 0, left: 0, active: false };
    return await r.json();
  } catch {
    return { promotion: null, claimed: 0, left: 0, active: false };
  }
}

function normalizePromoLabel({ quota, min, startAt, raw }) {
  const base = startAt
    ? `Next ${quota} who buy ${min} or more shares`
    : `First ${quota} who buy ${min} or more shares`;
  if (!raw || typeof raw !== "string") return base;

  let s = raw;
  s = s.replace(/≥\s*(\d+)/gi, (_m, n) => `${n} or more`);
  s = s.replace(/\b(\d+)\+\s*shares?\b/gi, (_m, n) => `${n} or more shares`);
  s = s.replace(/\bbuy\s+(\d+)(?!\s*or\s+more)\b/gi, (_m, n) => `buy ${n} or more`);
  s = s.replace(/\b(buy\s+\d+\s+or\s+more)(?!\s+shares)\b/gi, (_m, grp) => `${grp} shares`);
  s = s.replace(/\bshares\s+shares\b/gi, "shares");
  s = s.replace(/\bor more(?:\s+shares)?\s+or more\b/gi, "or more");
  return s;
}

// ---------- ABOUT BLOCKS: normalization + renderer ----------
function parseJSONSafely(s) {
  try {
    return JSON.parse(s);
  } catch {
    try {
      const fixed = s
        .replace(/([{,]\s*)([A-Za-z0-9_]+)(\s*:)/g, '$1"$2"$3') // quote bare keys
        .replace(/'/g, '"');
      return JSON.parse(fixed);
    } catch {
      return null;
    }
  }
}

// Try to coerce horse.about_blocks into an array of blocks regardless of shape
function extractAboutBlocks(horse, debug) {
  const candidates = [horse?.about_blocks, horse?.aboutBlocks, horse?.about, horse?.blocks];

  for (const v of candidates) {
    if (v == null) continue;

    if (Array.isArray(v)) {
      if (debug) console.log("[about_blocks] using array directly:", v);
      return v;
    }

    if (typeof v === "string") {
      const trimmed = v.trim();
      if (!trimmed) continue;
      const parsed = parseJSONSafely(trimmed);
      if (Array.isArray(parsed)) {
        if (debug) console.log("[about_blocks] parsed JSON string into array:", parsed);
        return parsed;
      }
      if (parsed && typeof parsed === "object") {
        const arr =
          Array.isArray(parsed.blocks) ? parsed.blocks :
          Array.isArray(parsed.items) ? parsed.items :
          Array.isArray(parsed.value) ? parsed.value : null;
        if (arr) {
          if (debug) console.log("[about_blocks] parsed JSON object -> array via key:", arr);
          return arr;
        }
      }
      if (debug) console.log("[about_blocks] string present but not an array after parse:", v);
      continue;
    }

    if (typeof v === "object") {
      const arr =
        Array.isArray(v.blocks) ? v.blocks :
        Array.isArray(v.items) ? v.items :
        Array.isArray(v.value) ? v.value :
        Array.isArray(v.data) ? v.data : null;
      if (arr) {
        if (debug) console.log("[about_blocks] object with array in known key:", arr);
        return arr;
      }
      const possibleSingleBlockKeys = ["type", "blockType", "component", "text", "content", "paragraph", "body"];
      if (possibleSingleBlockKeys.some((k) => v[k] != null)) {
        if (debug) console.log("[about_blocks] single block object, wrapping as array:", v);
        return [v];
      }
      if (debug) console.log("[about_blocks] object present but not recognized shape:", v);
    }
  }

  return [];
}

function getBlockType(b) {
  return String(b.type || b.blockType || b.component || "").toLowerCase();
}

function getBlockText(b) {
  return (
    b.text ??
    b.content ??
    b.body ??
    b.paragraph ??
    b.html ?? // if html provided, render as plain text fallback; safer
    ""
  );
}

function getImageUrl(b) {
  return (b.src || b.url || b.image_url || b.imageUrl || b.image || "").trim();
}

function getVideoUrl(b) {
  return (b.url || b.src || b.video_url || b.videoUrl || b.embedUrl || b.embed || "").trim();
}

function AboutBlocks({ blocks, horseName, debug }) {
  const arr = Array.isArray(blocks) ? blocks : [];

  if (arr.length === 0) {
    if (debug) {
      return (
        <section className="bg-white rounded-xl border p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-green-900">About {horseName}</h2>
          <div className="mt-3 text-sm text-gray-600">
            <strong>Debug:</strong> No blocks to render (array is empty).
          </div>
        </section>
      );
    }
    return null;
  }

  return (
    <section className="bg-white rounded-xl border p-6 shadow-sm">
      <h2 className="text-2xl font-bold text-green-900">About {horseName}</h2>

      <div className="mt-4 space-y-5">
        {arr.map((raw, i) => {
          if (!raw) return null;
          const b = typeof raw === "string" ? { type: "paragraph", text: raw } : raw;
          const type = getBlockType(b);

          if (type === "heading" || type === "title") {
            return (
              <h3 key={i} className="text-xl font-semibold text-green-900">
                {getBlockText(b)}
              </h3>
            );
          }

          if (type === "image" || type === "img" || b.image || b.image_url || b.imageUrl) {
            const src = getImageUrl(b);
            if (!src) return null;
            return (
              <figure key={i}>
                <img src={src} alt={b.alt || "Image"} className="w-full rounded-lg border" />
                {b.caption ? (
                  <figcaption className="text-xs text-gray-500 mt-1">{b.caption}</figcaption>
                ) : null}
              </figure>
            );
          }

          if (type === "video" || type === "embed" || b.video_url || b.videoUrl || b.embedUrl || b.embed) {
            const url = getVideoUrl(b);
            if (!url) return null;

            const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
            const vimeo = url.match(/vimeo\.com\/(\d+)/);

            if (yt) {
              return (
                <div key={i} className="aspect-video w-full">
                  <iframe
                    className="w-full h-full rounded-lg border"
                    src={`https://www.youtube.com/embed/${yt[1]}`}
                    title={b.title || "Video"}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              );
            }
            if (vimeo) {
              return (
                <div key={i} className="aspect-video w-full">
                  <iframe
                    className="w-full h-full rounded-lg border"
                    src={`https://player.vimeo.com/video/${vimeo[1]}`}
                    title={b.title || "Video"}
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              );
            }
            return <video key={i} className="w-full rounded-lg border" controls src={url} />;
          }

          if (type === "quote" || b.cite) {
            return (
              <blockquote
                key={i}
                className="border-l-4 border-green-900/30 pl-3 italic text-gray-800"
              >
                {getBlockText(b)}
                {b.cite ? (
                  <div className="mt-1 text-xs not-italic text-gray-500">— {b.cite}</div>
                ) : null}
              </blockquote>
            );
          }

          // default paragraph
          return (
            <p key={i} className="text-gray-800 leading-relaxed whitespace-pre-wrap">
              {getBlockText(b)}
            </p>
          );
        })}
      </div>
    </section>
  );
}

// ---------- Costs + Breeding (unchanged) ----------
function CostsBreakdown({ h }) {
  const rows = [
    ["Horse value", h.horse_value],
    ["Training & vet bills", h.training_vet],
    ["Insurance & race fees", h.insurance_race],
    ["Management fee", h.management_fee],
    ["Contingency", h.contingency],
  ];
  const total = h.breakdown_total === "" || h.breakdown_total == null ? null : Number(h.breakdown_total);

  return (
    <section className="bg-white rounded-xl border p-6 shadow-sm">
      <h2 className="text-2xl font-bold text-green-900">Share breakdown & costs</h2>
      <div className="mt-4 divide-y">
        {rows.map(([label, value]) => (
          <div key={label} className="py-2">
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-gray-600">{label}</span>
              <span className="font-medium">{value === "" || value == null ? "—" : fmtGBP(value)}</span>
            </div>
          </div>
        ))}
        <div className="pt-3">
          <div className="flex justify-between gap-3 text-sm">
            <span className="text-gray-600">Total</span>
            <span className="font-medium">{total == null ? "—" : fmtGBP(total)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function BreedingAndForm({ h }) {
  return (
    <section className="bg-white rounded-xl border p-6 shadow-sm">
      <h2 className="text-2xl font-bold text-green-900">Breeding & Form</h2>

      <div className="mt-4 grid sm:grid-cols-2 gap-3">
        {[
          ["Sire", h.sire],
          ["Dam", h.dam],
          ["Damsire", h.damsire],
          ["Foaled", h.foaled],
          ["Sex", h.sex],
          ["Colour", h.color],
          ["Breeder", h.breeder],
        ].map(([label, val]) => (
          <div key={label} className="flex justify-between gap-3 text-sm">
            <span className="text-gray-600">{label}</span>
            <span className="font-medium">{val || "—"}</span>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <h3 className="text-lg font-semibold text-green-900">Recent form</h3>
        <p className="mt-2 text-gray-800 whitespace-pre-wrap">{h.form_text || "—"}</p>
      </div>
    </section>
  );
}

// ---------- PAGE ----------
export default function HorseDetailPage() {
  const router = useRouter();
  const { id: horseId } = router.query;
  const debug = String(router.query.debug || "") === "1";

  const [loading, setLoading] = useState(true);
  const [horse, setHorse] = useState(null);

  const [session, setSession] = useState(null);
  const [yourShares, setYourShares] = useState(0);
  const [soldTotal, setSoldTotal] = useState(0);
  const [qty, setQty] = useState(1);

  const [promoRow, setPromoRow] = useState(null);
  const [promoStats, setPromoStats] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub?.subscription?.unsubscribe();
  }, []);

  const refreshAll = useCallback(async () => {
    if (!horseId) return;
    setLoading(true);

    // Explicitly select about_blocks to avoid view/column quirks
    const { data: h, error: hErr } = await supabase
      .from("horses")
      .select(`
        id, name, trainer, specialty, share_price, total_shares,
        photo_url, photos, photos_csv,
        description, trainer_bio, trainer_photo_url,
        horse_value, training_vet, insurance_race, management_fee, contingency, breakdown_total,
        sire, dam, damsire, foaled, sex, color, breeder, form_text,
        featured_position,
        about_blocks
      `)
      .eq("id", horseId)
      .maybeSingle();

    if (hErr || !h) {
      console.error("[HorseDetail] horse load error:", hErr);
      setHorse(null);
      setLoading(false);
      return;
    }

    if (debug) {
      console.log("[HorseDetail] raw horse row:", h);
    }

    // photos
    let photos = Array.isArray(h.photos) ? h.photos : [];
    if ((!photos || photos.length === 0) && (h.photos_csv || "").trim()) {
      photos = h.photos_csv.split(",").map((s) => s.trim()).filter(Boolean);
    }

    // normalize about_blocks
    const blocks = extractAboutBlocks(h, debug);

    setHorse({ ...h, photos, about_blocks: blocks });

    // totals sold
    const { data: ownsAll } = await supabase
      .from("ownerships")
      .select("shares")
      .eq("horse_id", horseId);
    const totalSold = (ownsAll || []).reduce((s, o) => s + (o.shares || 0), 0);
    setSoldTotal(totalSold);

    // your holdings
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

    // promo
    const stats = await fetchPromoStats(horseId);
    setPromoRow(stats.promotion);
    setPromoStats(stats);

    setLoading(false);
  }, [horseId, session?.user?.id, debug]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

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

  const derived = useMemo(() => {
    if (!horse) return { total: 0, sold: 0, remaining: 0, pct: 0 };
    const total = horse.total_shares ?? 0;
    const sold = soldTotal ?? 0;
    const remaining = Math.max(0, total - sold);
    const rawPct = total > 0 ? (sold / total) * 100 : 0;
    const pct = sold > 0 && rawPct < 1 ? 1 : Math.round(rawPct);
    return { total, sold, remaining, pct };
  }, [horse, soldTotal]);

  // ---------- Add to basket (detail page) ----------
  async function addToBasket() {
    try {
      // Ensure login for RLS
      const { data: sess } = await supabase.auth.getSession();
      if (!sess?.session?.user?.id) {
        alert("Please log in first to use your basket.");
        window.location.href = "/my-paddock";
        return;
      }

      // Clamp qty (1..100)
      const n = Math.min(100, Math.max(1, Number(qty || 1)));

      // Optional: live remaining guard so we don’t add beyond remaining
      const { data: liveHorse, error: liveErr } = await supabase
        .from("horses")
        .select("id,total_shares,name")
        .eq("id", horseId)
        .single();
      if (liveErr || !liveHorse) {
        alert("Could not verify availability. Please try again.");
        return;
      }
      const { data: ownsAll } = await supabase
        .from("ownerships")
        .select("shares")
        .eq("horse_id", horseId);
      const soldLive = (ownsAll || []).reduce((s, o) => s + (o.shares || 0), 0);
      const remainingLive = Math.max(0, (liveHorse.total_shares ?? 0) - soldLive);
      if (remainingLive <= 0) {
        alert("Sorry, this horse is sold out.");
        return;
      }
      if (n > remainingLive) {
        alert(`Only ${remainingLive} share(s) remaining for ${liveHorse?.name || "this horse"}.`);
        return;
      }

      // Cart operations
      const cart = await getOrCreateCart();
      await addShareToCart(cart.id, horseId, n);
      window.location.href = "/cart";
    } catch (e) {
      console.error("[addToBasket] failed:", e);
      alert(e?.message || "Sorry, we couldn't add that to your basket. Please try again.");
    }
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

        {/* Optional tiny debug box */}
        {String(router.query.debug || "") === "1" && (
          <div className="mb-4 rounded border bg-yellow-50 text-yellow-900 p-3 text-xs">
            <div><strong>Debug:</strong> about_blocks length = {Array.isArray(horse.about_blocks) ? horse.about_blocks.length : 0}</div>
          </div>
        )}

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

            {/* ABOUT BLOCKS (no legacy fallback) */}
            <AboutBlocks blocks={horse.about_blocks} horseName={horse.name} debug={debug} />

            {/* Costs */}
            <CostsBreakdown h={horse} />

            {/* Breeding & Form */}
            <BreedingAndForm h={horse} />

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
                addToBasket={addToBasket}
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

// ---------- Purchase Card (Add to basket) ----------
function PurchaseCard({ horse, derived, session, yourShares, qty, setQty, addToBasket, promo }) {
  const soldOut = derived.remaining <= 0;
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
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
          <button
            onClick={() => (window.location.href = "/my-paddock")}
            className="px-3 py-2 bg-green-700 text-white rounded text-sm hover:bg-green-800"
          >
            Sign in to add
          </button>
        ) : (
          <button
            onClick={addToBasket}
            className="px-3 py-2 bg-amber-500 text-white rounded text-sm disabled:opacity-50"
            disabled={soldOut}
            title={soldOut ? "Sold out" : "Add to basket"}
          >
            {soldOut ? "Sold out" : "Add to basket"}
          </button>
        )}
      </div>
    </div>
  );
}