/* eslint-disable @next/next/no-img-element */
import Head from "next/head";
import Link from "next/link";

export default function AboutUs() {
  return (
    <>
      <Head>
        <title>About Us | Premier Paddock Racing</title>
        <meta
          name="description"
          content="Learn about Premier Paddock Racing: our mission, values, and how we make racehorse ownership transparent and exciting."
        />
      </Head>

      <main className="bg-white">
        <Hero />
        <OurMission />
        <WhatWeDo />
        <HowWereDifferent />
        <HowItWorks />
        <Standards />
        <ClosingCTA />
      </main>
    </>
  );
}

/* ===========================
   HERO (no buttons; tagline woven into sentence)
=========================== */
function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-green-900/60" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-green-900/50 to-transparent" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 py-24 md:py-32 text-white text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight">
            About Premier Paddock Racing
          </h1>
          <p className="mt-5 text-lg md:text-xl text-gray-100">
            Our aim is to make racehorse ownership simple, transparent and genuinely
            exciting.
            We offer Frequent updates, fair ballots and a modern owner portal. 
            Your Horse. Your Say
          </p>
        </div>
      </div>
    </section>
  );
}

/* ===========================
   OUR MISSION (centered)
=========================== */
function OurMission() {
  return (
    <section className="max-w-7xl mx-auto px-6 py-16 text-center">
      <div className="bg-green-50 border border-green-100 rounded-2xl p-8 md:p-10">
        <h2 className="text-2xl md:text-3xl font-bold text-green-900">
          Our mission
        </h2>
        <p className="mt-3 text-gray-800 leading-relaxed max-w-3xl mx-auto">
          To open the gate of racehorse ownership to more people — keeping
          costs clear, communication personal and the owner experience front and
          centre.
        </p>
        <ul className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <Badge>Transparent pricing</Badge>
          <Badge>Frequent trainer updates</Badge>
          <Badge>Ballots & Voting</Badge>
          <Badge>Supportive community</Badge>
        </ul>
      </div>
    </section>
  );
}
function Badge({ children }) {
  return (
    <li className="inline-flex items-center justify-center gap-2 bg-white border rounded-lg px-3 py-2 shadow-sm text-center">
      <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full" />
      <span className="text-gray-800">{children}</span>
    </li>
  );
}

/* ===========================
   WHAT WE DO (3 cards, centered)
=========================== */
function WhatWeDo() {
  const items = [
    {
      title: "Handpicked Horses",
      desc:
        "Well-run, well-communicated syndicates with clear share structures and realistic targets.",
      icon: "🎯",
    },
    {
      title: "Modern owner portal",
      desc:
        "My Paddock keeps shares, ballots, votes and trainer updates in one simple place.",
      icon: "📲",
    },
    {
      title: "Real race-day experiences",
      desc:
        "From badges to stable visits, we focus on memorable days and inclusive owner events.",
      icon: "🎟",
    },
  ];

  return (
    <section className="bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-16 text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-green-900">
          What we do
        </h2>
        <div className="mt-8 grid md:grid-cols-3 gap-6">
          {items.map((v, i) => (
            <div key={i} className="bg-white rounded-xl border p-6 shadow-sm">
              <div className="text-3xl" aria-hidden="true">
                {v.icon}
              </div>
              <h3 className="mt-3 font-semibold">{v.title}</h3>
              <p className="text-sm text-gray-600 mt-1">{v.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ===========================
   WHAT MAKES US DIFFERENT (centered)
=========================== */
function HowWereDifferent() {
  const items = [
    {
      icon: "💷",
      title: "One clear price per share",
      desc: "No surprise add-ons. We show where every pound goes.",
    },
    {
      icon: "🔒",
      title: "Owner-first policies",
      desc: "Fair allocation for ballots and visits. We keep things level.",
    },
    {
      icon: "🧭",
      title: "Simple, modern tools",
      desc: "Track your journey clearly — less faff, more racing.",
    },
  ];
  return (
    <section>
      <div className="max-w-7xl mx-auto px-6 py-16 text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-green-900">
          What makes us different
        </h2>
        <p className="mt-2 text-gray-700 max-w-3xl mx-auto">
          We focus on clarity, fairness and giving owners a genuine voice in
          their horse’s journey.
        </p>
        <div className="mt-8 grid md:grid-cols-3 gap-6">
          {items.map((it, i) => (
            <div key={i} className="bg-white rounded-xl p-6 shadow border">
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
   HOW IT WORKS (4 steps, centered)
=========================== */
function HowItWorks() {
  const steps = [
    {
      title: "Horse selection",
      desc:
        "We partner with trusted trainers and only list syndicates we believe in.",
    },
    {
      title: "Syndicate launch",
      desc:
        "Shares go live with clear pricing and capped totals, plus live availability.",
    },
    {
      title: "Owner experience",
      desc:
        "Trainer updates, entries/decls and fair ballots for owners’ badges and yard visits.",
    },
    {
      title: "Race day & beyond",
      desc:
        "We handle the logistics so you can enjoy the moments that matter.",
    },
  ];
  return (
    <section className="bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-16 text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-green-900">
          How it works
        </h2>
        <div className="mt-8 grid md:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <div key={i} className="bg-white rounded-xl border p-6 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-green-900 text-white mx-auto flex items-center justify-center font-bold">
                {i + 1}
              </div>
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="text-sm text-gray-600 mt-1">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ===========================
   STANDARDS / ETHOS (centered)
=========================== */
function Standards() {
  const items = [
    { label: "Transparency first", desc: "Clear costs, open communication." },
    { label: "Welfare matters", desc: "Horse-first decisions at every stage." },
    { label: "Fairness built-in", desc: "Fair ballots and allocations." },
  ];
  return (
    <section>
      <div className="max-w-7xl mx-auto px-6 py-16 text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-green-900">
          Our standards
        </h2>
        <div className="mt-6 grid sm:grid-cols-3 gap-6">
          {items.map((x, i) => (
            <div key={i} className="rounded-xl border bg-white p-6 shadow-sm">
              <h3 className="font-semibold">{x.label}</h3>
              <p className="text-sm text-gray-600 mt-1">{x.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ===========================
   CTA (kept simple, not the hero)
=========================== */
function ClosingCTA() {
  return (
    <section className="max-w-7xl mx-auto px-6 py-16 text-center">
      <h2 className="text-2xl md:text-3xl font-bold text-green-900">
        Ready to join the journey?
      </h2>
      <p className="mt-3 text-gray-700">
        Pick your horse, choose your shares and become part of Premier Paddock
        Racing.
      </p>
      <div className="mt-6">
        <Link
          href="/horses"
          className="inline-block px-6 py-3 bg-green-900 text-white font-semibold rounded-lg shadow hover:bg-green-800"
        >
          View horses
        </Link>
      </div>
    </section>
  );
}