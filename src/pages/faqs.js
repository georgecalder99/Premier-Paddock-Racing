import Head from "next/head";
import Link from "next/link";
import { useState } from "react";

/* =========================================================
   MASTER FAQ DATA (grouped into sections with anchors)
   Edit answers to match your formal T&Cs where needed.
========================================================= */

const SECTIONS = [
  {
    id: "getting-started",
    title: "Getting started",
    items: [
      {
        q: "What does a share include?",
        a: "Proportional ownership for the term, trainer updates, access to owners' badge ballots on race days, stable visit ballots, and a modern owner portal (My Paddock) to track it all.",
      },
      {
        q: "How do I buy shares?",
        a: "Create or sign in to your account, pick a horse, choose your quantity, and complete a secure checkout. Your ownership appears instantly in My Paddock.",
      },
      {
        q: "Do I need to be based in the UK?",
        a: "You can purchase from abroad; race-day badges and yard visits are UK-based. Travel and attendance are at your own arrangement.",
      },
      {
        q: "Is there a minimum age?",
        a: "You must be 18 or over to hold shares and enter ballots.",
      },
    ],
  },

  {
    id: "ownership-and-shares",
    title: "Ownership & shares",
    items: [
      {
        q: "How many shares are there in a horse?",
        a: "Each horse displays a fixed total (e.g., 3,200). Live progress bars show how many are sold and how many remain.",
      },
      {
        q: "Is there a limit to how many shares I can buy?",
        a: "We may cap the maximum per person to keep things fair. If a cap applies, it will be displayed on the horse page or enforced at checkout.",
      },
      {
        q: "Can I sell or transfer my shares?",
        a: "A member-to-member transfer feature is planned. Until then, shares are not transferable by default.",
      },
      {
        q: "How long does my ownership last?",
        a: "Each syndicate runs for a defined term (e.g., a season or specific campaign). The term is shown on the horse page and/or your purchase confirmation.",
      },
      {
        q: "What happens if the horse is sold during the term?",
        a: "If the horse is sold, we will communicate the outcome, any proceeds due to the syndicate (net of costs/fees), and how they will be distributed proportionally. Full details are set out in the syndicate terms.",
      },
      {
        q: "What happens if the horse is retired or rehomed?",
        a: "If retired, we prioritise responsible aftercare and rehoming. We will update owners promptly and explain any financial implications in line with the syndicate terms.",
      },
      {
        q: "What if the trainer changes?",
        a: "If a yard change is in the horse's best interest, we will explain the rationale, the new plan, and any impact on owners. We aim to minimise disruption and keep communications clear.",
      },
    ],
  },

  {
    id: "ballots-and-visits",
    title: "Ballots, badges & visits",
    items: [
      {
        q: "How do owners' badge ballots work?",
        a: "When a horse is declared, entries open in My Paddock. After the deadline, winners are drawn fairly based on the racecourse allocation. Winners are notified in-app and by email.",
      },
      {
        q: "How do stable visit ballots work?",
        a: "We host regular stable visits with limited places. Entries open in My Paddock; after the cutoff, places are drawn fairly and confirmed to winners.",
      },
      {
        q: "Can I bring guests to a race day or yard visit?",
        a: "Guest places depend on allocation and may be offered at our discretion. We will state guest availability each time we open entries.",
      },
      {
        q: "What is the conduct policy on visits and race days?",
        a: "We expect respectful conduct toward staff, other owners, and the horse. We reserve the right to refuse attendance to anyone who breaches the code of conduct.",
      },
    ],
  },

  {
    id: "racing-and-welfare",
    title: "Racing plans & horse welfare",
    items: [
      {
        q: "How are race targets decided?",
        a: "The trainer leads on training and race placement, and we keep owners informed. Where appropriate, we invite owners to vote on certain decisions.",
      },
      {
        q: "What does 'Your horse. Your say.' mean in practice?",
        a: "Owners can be invited to vote on selected decisions (e.g., between two suitable race targets or experience options). Votes are run fairly in My Paddock and recorded transparently.",
      },
      {
        q: "What happens if the horse is injured or needs time off?",
        a: "We will communicate promptly with clear guidance from the vet/trainer, outline the plan, and provide updates as the situation evolves.",
      },
      {
        q: "What if a race is abandoned or plans change suddenly?",
        a: "We will notify you quickly and outline the revised plan. Entries and declarations can change at short notice; we aim to keep you fully informed.",
      },
      {
        q: "What aftercare is provided if the horse retires?",
        a: "We prioritise responsible aftercare and suitable rehoming in line with industry best practice. We will communicate the process and outcome to owners.",
      },
    ],
  },

  {
    id: "money-and-fees",
    title: "Money, prize funds & fees",
    items: [
      {
        q: "Are there ongoing fees?",
        a: "Some horses are all-in for the term; others may have monthly training contributions. Each horse page clearly shows the pricing model before you buy.",
      },
      {
        q: "How is prize money handled?",
        a: "Prize money (net of applicable deductions/fees) is distributed proportionally. We will display distributions and statements in My Paddock (member wallet coming soon).",
      },
      {
        q: "Do you charge VAT or other taxes?",
        a: "Pricing and any applicable taxes will be shown on the horse page or at checkout. If VAT applies, we will make that clear.",
      },
      {
        q: "Can I get a refund or cancel my purchase?",
        a: "Purchases are generally final. If you've made a genuine mistake, please contact us as soon as possible and we'll do our best to help.",
      },
    ],
  },

  {
    id: "communication-and-portal",
    title: "Communication & My Paddock",
    items: [
      {
        q: "How often do trainer updates happen?",
        a: "We aim for weekly updates, plus whenever there are entries, declarations, or meaningful developments. Updates appear in My Paddock and key items may be emailed.",
      },
      {
        q: "What is shown in My Paddock?",
        a: "Your owned shares, live ballot entries/results, trainer updates, and (coming soon) prize money statements and wallet.",
      },
      {
        q: "Will I get notifications?",
        a: "Yes. We send important updates via email and highlight them in My Paddock. You can control your notification preferences in your account (where available).",
      },
    ],
  },

  {
    id: "legal-and-policies",
    title: "Legal, media & privacy",
    items: [
      {
        q: "Who owns the horse?",
        a: "The syndicate owns the horse per the defined term and share structure. Your share grants you proportional beneficial interest as outlined in the syndicate terms.",
      },
      {
        q: "Can I use photos and videos of the horse?",
        a: "Media provided in updates is for personal use and sharing on social (non-commercial). Commercial use requires our prior written consent.",
      },
      {
        q: "How is my data kept secure?",
        a: "We use reputable infrastructure and follow best practices to protect your personal data. See our Privacy Policy for full details.",
      },
      {
        q: "Complaints procedure",
        a: "Contact us via the website with details and any supporting information. We aim to acknowledge within 2 working days and to resolve promptly and fairly.",
      },
    ],
  },

  {
    id: "contact-support",
    title: "Contact & support",
    items: [
      {
        q: "I made a mistake or need help with my account.",
        a: "Reach out via our Contact page and we’ll help as quickly as possible.",
      },
      {
        q: "How quickly do you reply?",
        a: "We aim to respond within 1–2 working days (faster around declarations and race days).",
      },
      {
        q: "Where can I read the full terms?",
        a: "Our Terms & Conditions and Privacy Policy are linked in the site footer. Those documents govern in the event of any conflict.",
      },
    ],
  },
];

/* ===========================
   Components
=========================== */

function AnchorNav() {
  return (
    <nav aria-label="FAQ sections">
      <ul className="flex flex-wrap justify-center gap-2">
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className="inline-block rounded-full border px-3 py-1.5 text-sm text-green-900 hover:bg-gray-100"
            >
              {s.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Section({ id, title, items }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-green-900">
          {title}
        </h2>

        {/* Centered accordions container */}
        <div className="mt-6 flex justify-center">
          <div className="w-full max-w-2xl divide-y rounded-xl border bg-white shadow text-left">
            {items.map((it, idx) => (
              <Accordion key={`${id}-${idx}`} question={it.q} answer={it.a} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

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

/* ===========================
   PAGE
=========================== */

export default function FAQs() {
  return (
    <>
      <Head>
        <title>FAQs | Premier Paddock Racing</title>
        <meta
          name="description"
          content="Premier Paddock Racing FAQs — grouped answers about shares, ballots, trainer updates, money, welfare, and more."
        />
      </Head>

      <main className="bg-white">
        {/* Header */}
        <section className="bg-gray-50">
          <div className="max-w-4xl mx-auto px-6 py-16 text-center">
            <h1 className="text-3xl md:text-4xl font-extrabold text-green-900">
              Frequently asked questions
            </h1>
            <p className="mt-3 text-gray-700 max-w-2xl mx-auto">
              Clear answers about shares, ballots, trainer updates, racing plans,
              prize money and more. For full details, please see our Terms & Conditions.
            </p>

            <div className="mt-6">
              <AnchorNav />
            </div>
          </div>
        </section>

        {/* Sections */}
        {SECTIONS.map((s) => (
          <Section key={s.id} id={s.id} title={s.title} items={s.items} />
        ))}

        {/* Footer note */}
        <section>
          <div className="max-w-4xl mx-auto px-6 pb-16 text-center">
            <p className="text-sm text-gray-600">
              Still unsure?{" "}
              <Link href="/contact-us" className="text-green-800 underline">
                Contact us
              </Link>{" "}
              and we'll help.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}