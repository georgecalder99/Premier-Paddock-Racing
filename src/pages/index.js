// src/pages/index.js
import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

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
        <Hero isAdmin={isAdmin} loggedIn={loggedIn} />
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
   HERO (sleek, green overlay)
=========================== */
function Hero({ isAdmin, loggedIn }) {
  return (
    <section className="relative overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src="/hero.jpg"
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-green-900/60" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-green-900/50 to-transparent" />
      </div>

      {/* Admin button */}
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
      <div className="relative mx-auto max-w-7xl px-6 py-24 text-center text-white md:py-32">
        <div className="mx-auto max-w-3xl">
          <span className="inline-block rounded-full border border-white/25 bg-white/10 px-4 py-1 text-sm md:text-base uppercase tracking-widest backdrop-blur-sm">
            Your horse, your say
          </span>

          <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight drop-shadow md:text-6xl">
            Own a share in a racehorse.
          </h1>

          <p className="mt-5 text-lg text-gray-100 md:text-xl">
            Syndicate ownership where you help decide the journey — with live
            transparency on costs and shares.
          </p>

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

            {/* Sign up / My Paddock */}
            {!loggedIn ? (
              <Link
                href="/my-paddock"
                className="rounded-lg border border-white/70 bg-amber-500/90 px-6 py-3 text-white backdrop-blur-sm transition hover:bg-amber-500"
              >
                Sign up
              </Link>
            ) : (
              <Link
                href="/my-paddock"
                className="rounded-lg border border-white/70 bg-white/10 px-6 py-3 text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                My Paddock
              </Link>
            )}
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
    <section className="bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-8 items-center">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-green-900">
            Welcome to the Club
          </h2>
          <p className="mt-3 text-gray-700">
            Premier Paddock Racing makes racehorse ownership sociable,
            accessible and transparent. Join a community of owners who enjoy the
            journey as much as the result—trainer updates, race-day badge
            ballots, and behind-the-scenes stable visits.
          </p>
          <ul className="mt-5 space-y-2 text-gray-700">
            <li>• You can vote on key decisions for your horse</li>
            <li>• Clear pricing and share structure</li>
            <li>• Regular media updates from the yard</li>
            <li>• Fair ballots for badges and visits</li>
            <li>• A modern owner portal: My Paddock</li>
          </ul>
          <div className="mt-6 flex gap-3">
            <Link
              href="/horses"
              className="px-5 py-3 bg-green-900 text-white rounded-lg"
            >
              Browse Horses
            </Link>
            <Link
              href="/about-us"
              className="px-5 py-3 border rounded-lg text-green-900 hover:bg-white"
            >
              About Us
            </Link>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl shadow bg-white">
          <img
            src="/welcome.jpg"
            alt="Owners at the races"
            className="w-full h-80 object-cover"
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
   FEATURED HORSES
=========================== */
function FeaturedHorses() {
  const [horses, setHorses] = useState([]);
  const [soldByHorse, setSoldByHorse] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);

      const { data: featured, error } = await supabase
        .from("horses")
        .select(
          "id,name,trainer,specialty,share_price,photo_url,total_shares,featured_position,created_at"
        )
        .in("featured_position", [1, 2, 3])
        .order("featured_position", { ascending: true });

      let data = featured || [];

      if (!error && data.length === 0) {
        const res = await supabase
          .from("horses")
          .select(
            "id,name,trainer,specialty,share_price,photo_url,total_shares,created_at"
          )
          .order("created_at", { ascending: false })
          .limit(3);
        data = res.data || [];
      }

      if (!mounted) return;
      setHorses(data);

      const ids = data.map((h) => h.id);
      if (ids.length > 0) {
        const { data: owns } = await supabase
          .from("ownerships")
          .select("horse_id, shares")
          .in("horse_id", ids);

        if (!mounted) return;
        if (owns) {
          const map = {};
          for (const o of owns) {
            map[o.horse_id] =
              (map[o.horse_id] || 0) + (o.shares || 0);
          }
          setSoldByHorse(map);
        } else {
          setSoldByHorse({});
        }
      } else {
        setSoldByHorse({});
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
        <h2 className="text-2xl md:text-3xl font-bold text-green-900">
          Featured Horses
        </h2>
        <Link href="/horses" className="text-green-800 hover:underline">
          See all horses →
        </Link>
      </div>

      {loading ? (
        <p className="mt-6 text-gray-600">Loading horses…</p>
      ) : horses.length === 0 ? (
        <p className="mt-6 text-gray-600">No horses to show yet.</p>
      ) : (
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {horses.map((h) => {
            const total = h.total_shares ?? 0;
            const sold = soldByHorse[h.id] ?? 0;
            const remaining = Math.max(0, total - sold);
            const rawPct = total > 0 ? (sold / total) * 100 : 0;
            const pct = sold > 0 && rawPct < 1 ? 1 : Math.round(rawPct);

            return (
              <article
                key={h.id}
                className="bg-white rounded-xl shadow hover:shadow-md transition p-4"
              >
                <img
                  src={
                    h.photo_url || "https://placehold.co/640x400?text=Horse"
                  }
                  alt={h.name}
                  className="w-full h-44 object-cover rounded-lg"
                />
                <h3 className="mt-3 font-semibold text-lg">{h.name}</h3>
                <p className="text-sm text-gray-500">
                  {h.specialty || "—"} • Trainer: {h.trainer || "—"}
                </p>

                <div className="mt-3 flex items-center justify-between">
                  <span className="font-semibold">
                    £{h.share_price ?? "—"}{" "}
                    <span className="font-normal">/ share</span>
                  </span>
                  <span className="text-sm text-gray-600">
                    {total.toLocaleString()} shares
                  </span>
                </div>

                {/* Progress */}
                <div className="mt-3">
                  <div className="h-2 w-full bg-gray-200 rounded">
                    <div
                      className="h-2 bg-green-600 rounded"
                      style={{ width: `${pct}%` }}
                      aria-label={`Sold ${pct}%`}
                    />
                  </div>
                  <div className="mt-1 text-xs text-gray-600 flex justify-between">
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
                    className="px-3 py-1 text-sm bg-green-900 text-white rounded"
                  >
                    Read more
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <p className="mt-4 text-xs text-gray-500">
        We have got new horses coming very soon!
      </p>
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