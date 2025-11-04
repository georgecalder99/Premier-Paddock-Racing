// src/pages/index.js
import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Image from "next/image";

function ClientOnly({ children }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return null; // or return <div style={{height: 1}} />
  return children;
}


function ClientOnlyHero({ children }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // flip to true on client after hydration
    setReady(true);
  }, []);
  // Show a white block (no layout shift) until ready
  if (!ready) {
    return (
      <section
        className="relative overflow-hidden"
        style={{ background: "#fff", minHeight: "52vh" }}
        aria-hidden="true"
      />
    );
  }
  return children;
}

/* ========= Admin helper ========= */
const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      const email = data?.session?.user?.email?.toLowerCase()?.trim();
      if (!mounted) return;
      setIsAdmin(Boolean(email && ADMIN_EMAILS.includes(email)));
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      const email = session?.user?.email?.toLowerCase()?.trim();
      setIsAdmin(Boolean(email && ADMIN_EMAILS.includes(email)));
    });

    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  return isAdmin;
}

/* ========= Logged-in helper (for conditional CTA buttons) ========= */
function useLoggedIn() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setLoggedIn(Boolean(data?.session?.user));
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setLoggedIn(Boolean(session?.user));
    });

    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  return loggedIn;
}

export default function Home() {
  const isAdmin = useIsAdmin();
  const loggedIn = useLoggedIn();

  return (
    <>
      <Head>
        <title>Premier Paddock Racing — Own a share in a racehorse</title>
        <meta
          name="description"
          content="Own a share in a racehorse with Premier Paddock Racing. Your horse, your say — vote on key decisions, with total transparency on costs and shares."
        />
        <meta property="og:title" content="Premier Paddock Racing" />
        <meta property="og:description" content="Own a share in a racehorse." />
        <meta property="og:type" content="website" />
      </Head>

      <main className="bg-white">
       <ClientOnlyHero>
  <Hero isAdmin={isAdmin} loggedIn={loggedIn} />
</ClientOnlyHero>
        <WelcomeToTheClub />
        <RegisterInterest /> {/* moved ABOVE featured horses */}
        <FeaturedHorses />
        <WhatMakesUsDifferent loggedIn={loggedIn} />
        <FAQTeaser />
      </main>
    </>
  );
}

/* ===========================
   HERO (stable, correct green)
=========================== */
function Hero({ isAdmin /*, loggedIn */ }) {
  return (
    <section className="relative overflow-hidden">
      {/* correct green overlays to match your other pages */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-green-900/60" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-green-900/50 to-transparent" />
      </div>

      {/* Admin button (optional; harmless to keep) */}
      {isAdmin && (
        <div className="absolute right-6 top-6 z-10">
          <Link
            href="/admin/ballots"
            className="rounded-lg border border-white/70 px-4 py-2 text-white backdrop-blur-sm transition hover:bg-white/10"
          >
            Admin
          </Link>
        </div>
      )}

      {/* Foreground */}
      <div className="relative max-w-7xl mx-auto px-6 py-24 md:py-32 text-white text-center">
        <div className="max-w-3xl mx-auto">
          <span className="inline-block rounded-full border border-white/25 bg-white/10 px-4 py-1 text-sm md:text-base uppercase tracking-widest backdrop-blur-sm">
            Your horse, your say
          </span>

          <h1 className="mt-4 text-4xl md:text-6xl font-extrabold leading-tight">
            Own a share in a racehorse.
          </h1>

          <p className="mt-5 text-lg md:text-xl text-gray-100">
            Syndicate ownership where you help decide the journey — with live
            transparency on costs and shares.
          </p>

          {/* fixed, non-conditional CTAs (no hydration flash) */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/horses"
              className="rounded-lg bg-white px-6 py-3 font-semibold text-green-900 shadow-sm transition hover:bg-gray-100"
            >
              View Horses
            </Link>

            <Link
              href="/how-it-works"
              className="rounded-lg border border-white/70 bg-white/10 px-6 py-3 text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              How it works
            </Link>

            <Link
              href="/my-paddock"
              className="rounded-lg border border-white/70 bg-white/10 px-6 py-3 text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              My Paddock
            </Link>
          </div>

          <ul className="mt-6 flex flex-wrap justify-center gap-4 text-base md:text-lg text-gray-100/90">
            <li>Vote on key decisions</li>
            <li>• Transparent costs</li>
            <li>• Trainer updates</li>
            <li>• Badges &amp; stable visits</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ===========================
   WELCOME TO THE CLUB
=========================== */
function WelcomeToTheClub() {
  return (
    <section className="bg-gray-50 dark:bg-neutral-900">
      <div className="max-w-7xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-8 items-center">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-green-900 dark:text-green-400">
            Welcome to the Club
          </h2>
          <p className="mt-3 text-gray-700 dark:text-gray-300">
            Premier Paddock Racing makes racehorse ownership sociable,
            accessible and transparent. Join a community of owners who enjoy the
            journey as much as the result—trainer updates, race-day badge
            ballots, and behind-the-scenes stable visits.
          </p>

          <ul className="mt-5 space-y-2 text-gray-700 dark:text-gray-300">
            <li>• You can vote on key decisions for your horse</li>
            <li>• Clear pricing and share structure</li>
            <li>• Regular media updates from the yard</li>
            <li>• Fair ballots for badges and visits</li>
            <li>• A modern owner portal: My Paddock</li>
          </ul>

          <div className="mt-6 flex gap-3">
            <Link
              href="/horses"
              className="px-5 py-3 bg-green-900 text-white rounded-lg
                         hover:bg-green-800 dark:bg-green-700 dark:hover:bg-green-600"
            >
              Browse Horses
            </Link>
            <Link
              href="/about-us"
              className="px-5 py-3 border rounded-lg text-green-900 hover:bg-white
                         dark:border-green-400 dark:text-green-300 dark:hover:bg-green-900/20"
            >
              About Us
            </Link>
          </div>
        </div>

        <div
          className="overflow-hidden rounded-xl shadow bg-white dark:bg-neutral-800
                     ring-1 ring-black/5 dark:ring-white/10"
        >
          <Image
            src="/homepage-1.jpg"
            width={1600}
            height={600}
            className="w-full h-80 object-cover"
            alt="Premier Paddock welcome"
          />
        </div>
      </div>
    </section>
  );
}

/* ===========================
   NEW — Register Interest (moved up)
=========================== */
function RegisterInterest() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit(e) {
    e.preventDefault();
    setMsg("");
    setBusy(true);
    try {
      const res = await fetch("/api/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Something went wrong");
      setMsg("✅ Thanks — we’ll be in touch!");
      setEmail("");
    } catch (err) {
      setMsg(`❌ ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-14">
        <div className="mx-auto max-w-3xl rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-2xl md:text-3xl font-bold text-green-900 text-center">
            Register your interest for our launch
          </h2>
          <p className="mt-2 text-center text-gray-700">
            Priced at <strong>£45 a share</strong> and in training with one of Britain’s
            leading trainers. <em>We are diving straight in!!</em> 
          </p>

          <form onSubmit={submit} className="mt-5 flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="flex-1 rounded-lg border px-4 py-3"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-green-900 px-6 py-3 text-white disabled:opacity-60"
            >
              {busy ? "Sending…" : "Keep me posted"}
            </button>
          </form>

          {msg && <p className="mt-3 text-center text-sm">{msg}</p>}
        </div>
      </div>
    </section>
  );
}

/* ===========================
   FEATURED HORSES (dark-mode safe) + PROMO
=========================== */
function FeaturedHorses() {
  const [horses, setHorses] = useState([]);
  const [soldByHorse, setSoldByHorse] = useState({});
  const [salesByHorse, setSalesByHorse] = useState({}); // horse_id -> sales_count
  const [loading, setLoading] = useState(true);

  // --- promo helpers ---
  function normalizePromo(horse, salesCountRaw) {
    const enabled = !!horse?.promo_enabled;
    const quota =
      horse?.promo_quota === null || horse?.promo_quota === undefined || horse?.promo_quota === ""
        ? 0
        : Number(horse.promo_quota);
    const startSales =
      horse?.promo_start_sales === null ||
      horse?.promo_start_sales === undefined ||
      horse?.promo_start_sales === ""
        ? 0
        : Number(horse.promo_start_sales);
    const salesCount = Number(salesCountRaw ?? 0);
    if (!enabled || quota <= 0) return null;

    const claimed = Math.max(0, Math.min(quota, salesCount - startSales));
  
  }

  function PromoChip({ promo }) {
    if (!promo) return null;
    const active = promo.active;
    const base =
      "absolute left-2 top-2 inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-medium shadow ring-1";
    const activeCls =
      "bg-amber-100 text-amber-900 ring-amber-300 dark:bg-amber-200/90 dark:text-amber-900 dark:ring-amber-300/70";
    const inactiveCls =
      "bg-gray-100 text-gray-700 ring-gray-300 dark:bg-neutral-700 dark:text-gray-200 dark:ring-neutral-600";
    return (
      <div className={`${base} ${active ? activeCls : inactiveCls}`} role="note" aria-live="polite">
        <span aria-hidden>🎁</span>
        <span className="whitespace-nowrap">{promo.label}</span>
        <span
          className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${
            active ? "bg-amber-200" : "bg-gray-200 dark:bg-neutral-600"
          }`}
        >
          {active ? `${promo.left} left` : "All claimed"}
        </span>
      </div>
    );
  }

  function PromoInline({ promo }) {
    if (!promo) return null;
    const active = promo.active;
    const base = "rounded-md px-3 py-2 text-xs shadow ring-1";
    const activeCls =
      "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-100/20 dark:text-amber-200 dark:ring-amber-200/30";
    const inactiveCls =
      "bg-gray-50 text-gray-700 ring-gray-200 dark:bg-neutral-800 dark:text-gray-200 dark:ring-neutral-700";
    return (
      <div className={`${base} ${active ? activeCls : inactiveCls}`} role="note" aria-live="polite">
        <strong>{promo.label}</strong> — {promo.reward}{" "}
        <span className="opacity-80">
          · {active ? `${promo.claimed} claimed • ${promo.left} left` : `All ${promo.quota} claimed`}
        </span>
      </div>
    );
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);

      // 1) Try featured first (include promo fields)
      const { data: featured, error: featuredErr } = await supabase
        .from("horses")
        .select(
          "id,name,trainer,specialty,share_price,photo_url,total_shares,featured_position,created_at,promo_enabled,promo_quota,promo_label,promo_reward,promo_start_sales"
        )
        .in("featured_position", [1, 2, 3])
        .order("featured_position", { ascending: true });

      let data = featured || [];

      // 2) Fallback only if there are NO featured results
      if (!featuredErr && data.length === 0) {
        const { data: latest } = await supabase
          .from("horses")
          .select(
            "id,name,trainer,specialty,share_price,photo_url,total_shares,created_at,promo_enabled,promo_quota,promo_label,promo_reward,promo_start_sales"
          )
          .order("created_at", { ascending: false })
          .limit(3);

        data = latest || [];
      }

      if (!mounted) return;
      setHorses(data);

      // Ownership aggregation
      const ids = data.map((h) => h.id);
      if (ids.length > 0) {
        const [{ data: owns }, { data: sales, error: salesErr }] = await Promise.all([
          supabase.from("ownerships").select("horse_id, shares").in("horse_id", ids),
          supabase.from("horse_sales_count").select("horse_id, sales_count").in("horse_id", ids),
        ]);

        if (!mounted) return;

        // shares sold map
        if (owns) {
          const map = {};
          for (const o of owns) {
            map[o.horse_id] = (map[o.horse_id] || 0) + (o.shares || 0);
          }
          setSoldByHorse(map);
        } else {
          setSoldByHorse({});
        }

        // sales count map (promo)
        if (!salesErr && sales) {
          const smap = {};
          for (const row of sales) smap[row.horse_id] = Number(row.sales_count || 0);
          setSalesByHorse(smap);
        } else {
          setSalesByHorse({});
        }
      } else {
        setSoldByHorse({});
        setSalesByHorse({});
      }

      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="max-w-7xl mx-auto px-6 py-16">
      <div className="flex items-end justify-between">
        <h2 className="text-2xl md:text-3xl font-bold text-green-900 dark:text-green-400">
          Featured Horses
        </h2>
        <Link href="/horses" className="text-green-800 hover:underline dark:text-green-300">
          See all horses →
        </Link>
      </div>

      {loading ? (
        <p className="mt-6 text-gray-600 dark:text-gray-300">Loading horses…</p>
      ) : horses.length === 0 ? (
        <>
          <p className="mt-6 text-gray-600 dark:text-gray-300">No horses to show yet.</p>
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            We’ve got new horses coming very soon!
          </p>
        </>
      ) : (
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {horses.map((h) => {
            const total = h.total_shares ?? 0;
            const sold = soldByHorse[h.id] ?? 0;
            const remaining = Math.max(0, total - sold);
            const rawPct = total > 0 ? (sold / total) * 100 : 0;
            const pct = sold > 0 && rawPct < 1 ? 1 : Math.round(rawPct);

            const promo = normalizePromo(h, salesByHorse[h.id]);

            return (
              <article
                key={h.id}
                className="bg-white dark:bg-neutral-800 rounded-xl shadow hover:shadow-md transition p-4
                           ring-1 ring-black/5 dark:ring-white/10"
              >
                <div className="relative rounded-lg overflow-hidden ring-1 ring-black/5 dark:ring-white/10">
                  <PromoChip promo={promo} />
                  <img
                    src={h.photo_url || "https://placehold.co/640x400?text=Horse"}
                    alt={h.name}
                    className="w-full h-44 object-cover"
                  />
                </div>

                <h3 className="mt-3 font-semibold text-lg text-gray-900 dark:text-gray-100">
                  {h.name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-300">
                  {h.specialty || "—"} • Trainer: {h.trainer || "—"}
                </p>

                {/* Promo inline banner (subtle) */}
                {promo && <div className="mt-3"><PromoInline promo={promo} /></div>}

                <div className="mt-3 flex items-center justify-between">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    £{h.share_price ?? "—"} <span className="font-normal">/ share</span>
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {total.toLocaleString()} shares
                  </span>
                </div>

                {/* Progress */}
                <div className="mt-3">
                  <div className="h-2 w-full bg-gray-200 dark:bg-neutral-700 rounded">
                    <div
                      className="h-2 bg-green-600 dark:bg-green-500 rounded"
                      style={{ width: `${pct}%` }}
                      aria-label={`Sold ${pct}%`}
                    />
                  </div>
                  <div className="mt-1 text-xs text-gray-600 dark:text-gray-300 flex justify-between">
                    <span>{sold.toLocaleString()} sold</span>
                    <span>
                      {remaining > 0
                        ? `${remaining.toLocaleString()} available`
                        : "Sold out"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end">
                  <Link
                    href={`/horses/${h.id}`}
                    className="px-3 py-1 text-sm bg-green-900 text-white rounded
                               hover:bg-green-800 dark:bg-green-700 dark:hover:bg-green-600"
                  >
                    Read more
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ===========================
   WHAT MAKES US DIFFERENT (no extra CTA)
=========================== */
function WhatMakesUsDifferent() {
  const items = [
    {
      icon: "🗳️",
      title: "Owners vote on key decisions",
      desc: "From race targets to yard experiences, our Voting tab gives you a real say in your horse’s journey.",
    },
    {
      icon: "📊",
      title: "Live share transparency",
      desc: "See exactly how many shares are sold and how many remain—plus clear progress bars on each horse.",
    },
    {
      icon: "💷",
      title: "One price. No hidden costs.",
      desc: "Simple, upfront pricing. Full cost breakdowns show where every pound goes.",
    },
    {
      icon: "🎟",
      title: "Real owner benefits",
      desc: "Owners’ badges, stable visits and proper race-day experiences.",
    },
    {
      icon: "📲",
      title: "Modern owner portal",
      desc: "My Paddock: track ownership, ballots, votes and trainer updates in one place.",
    },
  ];

  return (
    <section>
      <div className="max-w-7xl mx-auto px-6 py-16 text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-green-900">
          What makes us different
        </h2>
        <p className="mt-2 text-gray-700 max-w-3xl mx-auto">
          We’re building a syndicate experience where owners are genuinely
          involved and everything is transparent. It’s your horse — you decide.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-6">
          {items.map((it, i) => (
            <div
              key={i}
              className="bg-white rounded-xl p-6 shadow border h-full w-full sm:basis-[calc(50%-12px)] md:basis-[calc(33.333%-16px)] max-w-md"
            >
              <div className="text-3xl" aria-hidden>
                {it.icon}
              </div>
              <h3 className="mt-3 font-semibold text-lg">{it.title}</h3>
              <p className="text-sm text-gray-600 mt-1">{it.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ===========================
   FAQ TEASER
=========================== */
function FAQTeaser() {
  const faqs = [
    {
      q: "How much does a share cost?",
      a: "Each horse lists its share price and any ongoing fees.",
    },
    {
      q: "How do owners’ badge ballots work?",
      a: "Enter via your portal; winners drawn fairly per allocation.",
    },
    {
      q: "Can I attend stable visits?",
      a: "Yes—regular yard visits with fair ballot allocation.",
    },
  ];
  return (
    <section className="bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <h2 className="text-2xl md:text-3xl font-bold text-green-900">
          FAQs
        </h2>
        <div className="mt-6 grid md:grid-cols-3 gap-6">
          {faqs.map((f, i) => (
            <div key={i} className="bg-white rounded-xl p-6 shadow border">
              <h3 className="font-semibold">{f.q}</h3>
              <p className="text-sm text-gray-600 mt-2">{f.a}</p>
            </div>
          ))}
        </div>
        <Link
          href="/faqs"
          className="inline-block mt-6 text-green-800 hover:underline"
        >
          Read all FAQs →
        </Link>
      </div>
    </section>
  );
}