/* eslint-disable @next/next/no-img-element */
import Head from "next/head";
import Link from "next/link";
import { useState } from "react";

export default function HowItWorks() {
  return (
    <>
      <Head>
        <title>How It Works | Premier Paddock Racing</title>
        <meta
          name="description"
          content="How Premier Paddock Racing ownership works — choose a horse, buy shares, get weekly trainer updates and vote on key decisions. Clear pricing and fair ballots."
        />
      </Head>

      <main className="bg-white">
        <Hero />
        <Steps />            {/* Expanded 4-step flow */}
        <CostsExplainer />   {/* Clear pricing retained */}
        <Benefits />         {/* Updated trainer updates */}
        <FAQ />              {/* Keep helpful answers */}
      </main>
    </>
  );
}

/* ===========================
   HERO (clean, no buttons)
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
            How ownership works
          </h1>
          <p className="mt-5 text-lg md:text-xl text-gray-100">
            We make syndicate ownership simple, transparent and genuinely fun.
            Here is the journey from picking your horse to race day and beyond.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ===========================
   4 STEPS (expanded)
=========================== */
function Steps() {
  const steps = [
    {
      n: 1,
      title: "Horse selection",
      icon: "🏇",
      desc:
        "We partner with trusted trainers and only list horses we believe in. Each profile shows pedigree, trainer notes, share price and live availability so you can decide with confidence.",
      bullets: [
        "Trainer and yard details",
        "Pedigree and intended campaign",
        "Transparent share structure",
      ],
    },
    {
      n: 2,
      title: "Syndicate launch",
      icon: "🚀",
      desc:
        "When a syndicate opens, shares are capped and the price per share is fixed. You can see how many shares are sold and how many remain in real time.",
      bullets: [
        "Fixed price per share",
        "Capped total shares",
        "Live progress bar",
      ],
    },
    {
      n: 3,
      title: "Owner experience",
      icon: "📲",
      desc:
        "After you buy, your ownership appears in My Paddock. You will receive weekly updates and extra posts whenever entries or declarations happen.",
      bullets: [
        "Weekly trainer updates",
        "Extra posts for entries/decls",
        "Photos and short videos",
      ],
    },
    {
      n: 4,
      title: "Race day & beyond",
      icon: "🎟️",
      desc:
        "Before each run we ballot owners’ badges fairly according to the racecourse allocation. We also host stable visits and keep you updated on results and next steps.",
      bullets: [
        "Fair badge ballots for race days",
        "Stable visit ballots",
        "Results, analysis and plans",
      ],
    },
  ];

  return (
    <section className="max-w-7xl mx-auto px-6 py-16">
      <h2 className="text-2xl md:text-3xl font-bold text-green-900 text-center">
        Four clear steps
      </h2>
      <div className="mt-8 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {steps.map((s) => (
          <article key={s.n} className="bg-white rounded-xl p-6 shadow border">
            <div className="flex items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-900 text-white flex items-center justify-center font-bold">
                {s.n}
              </div>
              <div className="text-2xl" aria-hidden="true">{s.icon}</div>
            </div>
            <h3 className="mt-4 font-semibold text-lg text-center">{s.title}</h3>
            <p className="text-sm text-gray-600 mt-2 text-center">{s.desc}</p>
            {s.bullets?.length > 0 && (
              <ul className="mt-3 text-sm text-gray-700 space-y-1">
                {s.bullets.map((b, i) => (
                  <li key={i} className="flex items-center justify-center gap-2">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

/* ===========================
   COSTS EXPLAINER (as-is)
=========================== */
function CostsExplainer() {
  return (
    <section className="bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 gap-10 items-start">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-green-900">Clear pricing</h2>
            <p className="mt-3 text-gray-700">
              Shares are typically around <strong>£60 per share</strong>. Each horse shows the total number
              of shares available and live progress toward selling out. You will see the price before you buy — no surprises.
            </p>

            <div className="mt-6 space-y-3">
              <Item label="Price per share" value="Shown on each horse" />
              <Item label="Total shares" value="E.g. 3,200 shares" />
              <Item label="What you get" value="Owner updates, ballots, community and race-day experience" />
            </div>

            <div className="mt-6">
              <Link href="/horses" className="px-5 py-3 bg-green-900 text-white rounded-lg">
                View horses & pricing
              </Link>
            </div>
          </div>

          {/* Example card */}
          <div className="bg-white rounded-xl shadow p-6 border">
            <p className="text-sm font-semibold text-gray-700">Example purchase</p>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 rounded border bg-gray-50">
                <p className="text-gray-600">Shares bought</p>
                <p className="text-green-900 font-semibold">5</p>
              </div>
              <div className="p-3 rounded border bg-gray-50">
                <p className="text-gray-600">Price per share</p>
                <p className="text-green-900 font-semibold">£60</p>
              </div>
              <div className="p-3 rounded border bg-gray-50">
                <p className="text-gray-600">Total</p>
                <p className="text-green-900 font-semibold">£300</p>
              </div>
              <div className="p-3 rounded border bg-gray-50">
                <p className="text-gray-600">Where it appears</p>
                <p className="text-green-900 font-semibold">My Paddock → Owned</p>
              </div>
            </div>

            <div className="mt-6">
              <Progress label="Shares sold" value={62} />
              <p className="mt-2 text-xs text-gray-600">
                Progress updates in real time as shares sell.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
function Item({ label, value }) {
  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex w-2 h-2 rounded-full bg-emerald-500" />
      <p className="text-sm text-gray-700">
        <strong>{label}:</strong> {value}
      </p>
    </div>
  );
}
function Progress({ label, value }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-700">{label}</span>
        <span className="text-gray-600">{value}%</span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded mt-1">
        <div
          className="h-2 bg-green-600 rounded"
          style={{ width: `${value}%` }}
          aria-label={`${label} ${value}%`}
        />
      </div>
    </div>
  );
}

/* ===========================
   BENEFITS (4 cards + centered voting banner)
=========================== */
function Benefits() {
  const perks = [
    {
      title: "Owners' badge ballots",
      desc:
        "For each race day, we run a fair ballot for owners' badges according to the racecourse allocation.",
      icon: "🎫",
    },
    {
      title: "Stable visit ballots",
      desc:
        "We host regular stable visits. Spaces are limited, so places are drawn via a fair ballot among owners.",
      icon: "🏠",
    },
    {
      title: "Trainer updates",
      desc:
        "A weekly round-up as standard, with extra posts when entries are made or declarations happen — plus photos and short videos.",
      icon: "📝",
    },
    {
      title: "Owner portal",
      desc:
        "My Paddock shows your horses, shares owned, updates, ballots and votes — all in one place.",
      icon: "📲",
    },
  ];

  return (
    <section className="max-w-7xl mx-auto px-6 py-16 text-center">
      <h2 className="text-2xl md:text-3xl font-bold text-green-900">
        What you get
      </h2>

      {/* 4 standard cards */}
      <div className="mt-8 grid md:grid-cols-2 lg:grid-cols-4 gap-6 text-left md:text-center">
        {perks.map((p, i) => (
          <div key={i} className="bg-white rounded-xl p-6 shadow border">
            <div className="text-2xl text-center" aria-hidden="true">{p.icon}</div>
            <h3 className="mt-3 font-semibold text-center">{p.title}</h3>
            <p className="text-sm text-gray-600 mt-1 text-center">{p.desc}</p>
          </div>
        ))}
      </div>

      {/* Centered, wide "Your horse. Your say." banner */}
      <div className="mt-10 flex justify-center">
        <div className="relative overflow-hidden rounded-xl border bg-white shadow max-w-3xl w-full text-center px-6 py-8">
          <h3 className="text-xl md:text-2xl font-bold text-green-900">
            Your horse. Your say.
          </h3>
          <p className="mt-3 text-sm md:text-base text-gray-700 max-w-2xl mx-auto">
            Owners can vote on key decisions around the horse — from race targets and experiences
            to yard events. Every poll is transparent and auditable, so your voice genuinely
            shapes the journey.
          </p>
          <div className="mt-4">
            <span className="inline-flex items-center justify-center rounded-full bg-green-50 text-green-900 text-xs font-medium px-3 py-1 border">
              Voting enabled for owners
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ===========================
   FAQ (accordion, fully centered)
=========================== */
function FAQ() {
  const qs = [
    {
      q: "Is this the same as full ownership?",
      a:
        "This is syndicate ownership. You buy shares in a horse and enjoy the owner experience proportionally. We handle the admin and communication so you can simply enjoy being an owner.",
    },
    {
      q: "How do ballots work for badges and visits?",
      a:
        "When a horse is declared or a visit is scheduled, entries open in My Paddock. After the deadline, winners are drawn at random and notified by email and in the portal.",
    },
    {
      q: "Are there ongoing costs?",
      a:
        "Each horse profile lists the price per share. If any ongoing costs apply, they will be clearly shown before you buy — no hidden fees.",
    },
    {
      q: "How do I get paid prize money?",
      a:
        "Prize money, net of any deductions, will be credited to your member wallet (coming soon). You’ll be able to withdraw it directly to your bank account.",
    },
  ];

  return (
    <section className="bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-green-900">
          Frequently asked questions
        </h2>
        <p className="mt-2 text-gray-700 max-w-2xl mx-auto">
          Everything you need to know about Premier Paddock ownership — clear, simple, and fair.
        </p>

        {/* FAQ container */}
        <div className="mt-8 flex justify-center">
          <div className="w-full max-w-2xl divide-y rounded-xl border bg-white shadow text-left">
            {qs.map((item, idx) => (
              <Accordion key={idx} question={item.q} answer={item.a} />
            ))}
          </div>
        </div>

        <p className="mt-8 text-sm text-gray-700">
          Can’t find the answer?{" "}
          <Link href="/contact-us" className="text-green-800 underline">
            Contact us
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

/* ===========================
   Accordion sub-component
=========================== */
function Accordion({ question, answer }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-5 transition-all duration-200 hover:bg-gray-50">
      <button
        className="w-full flex items-center justify-between text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="font-medium text-gray-900">{question}</span>
        <svg
          className={`h-5 w-5 text-gray-500 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.146l3.71-2.915a.75.75 0 01.92 1.18l-4.25 3.34a.75.75 0 01-.92 0l-4.25-3.34a.75.75 0 01-.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <p className="mt-3 text-sm text-gray-600 leading-relaxed text-center">
          {answer}
        </p>
      )}
    </div>
  );
}