import Head from "next/head";
import Link from "next/link";

export default function PrivacyPolicy() {
  return (
    <>
      <Head>
        <title>Privacy Policy | Premier Paddock Racing</title>
        <meta
          name="description"
          content="How Premier Paddock Racing collects, uses, and protects your personal data, and what rights you have under UK GDPR."
        />
        <meta name="robots" content="noindex" />
      </Head>

      <main className="max-w-4xl mx-auto px-6 py-16 text-gray-800">
        <h1 className="text-3xl md:text-4xl font-extrabold text-green-900">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Last updated: {new Date().getFullYear()}
        </p>

        <p className="mt-6">
          This Privacy Policy explains how <strong>Premier Paddock Racing</strong> (“we”, “us”, “our”) collects and processes your personal information when you use our website, purchase or lease shares, access <em>My Paddock</em>, enter ballots, or contact us.
          We act as a <strong>controller</strong> for the personal data described below.
        </p>

        <div className="mt-6 rounded-lg border bg-green-50 p-4 text-sm text-green-900">
          <p className="font-semibold">At a glance</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>We only collect what we need to run your membership and our services.</li>
            <li>Legal bases: contract, legitimate interests, consent, legal obligation.</li>
            <li>You can access, correct, delete, or object to certain processing.</li>
            <li>We use reputable providers (e.g., Supabase, Stripe, email delivery, hosting).</li>
            <li>Data may be transferred outside the UK/EEA with appropriate safeguards (e.g., SCCs).</li>
          </ul>
        </div>

        <nav className="mt-10">
          <h2 className="text-xl font-bold text-green-900">Contents</h2>
          <ol className="list-decimal list-inside mt-3 space-y-1">
            <li><a href="#who-we-are" className="text-green-800 underline">Who we are & how to contact us</a></li>
            <li><a href="#what-we-collect" className="text-green-800 underline">What we collect</a></li>
            <li><a href="#how-we-use" className="text-green-800 underline">How and why we use your data (legal bases)</a></li>
            <li><a href="#sharing" className="text-green-800 underline">Sharing your data (service providers & partners)</a></li>
            <li><a href="#international" className="text-green-800 underline">International transfers</a></li>
            <li><a href="#retention" className="text-green-800 underline">How long we keep data</a></li>
            <li><a href="#security" className="text-green-800 underline">Security</a></li>
            <li><a href="#rights" className="text-green-800 underline">Your privacy rights</a></li>
            <li><a href="#cookies" className="text-green-800 underline">Cookies & analytics</a></li>
            <li><a href="#children" className="text-green-800 underline">Children</a></li>
            <li><a href="#changes" className="text-green-800 underline">Changes to this policy</a></li>
            <li><a href="#contact" className="text-green-800 underline">Contact & complaints</a></li>
          </ol>
        </nav>

        <section id="who-we-are" className="mt-12">
          <h2 className="text-2xl font-bold text-green-900">1) Who we are & how to contact us</h2>
          <p className="mt-2">
            Controller: <strong>[Legal Entity Name] trading as Premier Paddock Racing</strong>  
            <br />
            Registered in: [England & Wales] — Company No: [Company Number]  
            <br />
            Registered office: [Full Address]
          </p>
          <p className="mt-2">
            Email:{" "}
            <a href="mailto:support@premierpaddockracing.co.uk" className="text-green-800 underline">
              support@premierpaddockracing.co.uk
            </a>
          </p>
        </section>

        <section id="what-we-collect" className="mt-12">
          <h2 className="text-2xl font-bold text-green-900">2) What we collect</h2>

          <h3 className="mt-6 font-semibold">2.1 Data you provide</h3>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Identity & contact: name, email, phone, postal address.</li>
            <li>Account data: login email, authentication tokens (via Supabase), preferences.</li>
            <li>Transaction data: purchases/leases, number of shares, price paid, invoices, last 4 digits of card (Stripe).</li>
            <li>Communications: messages via forms, support enquiries, ballot entries, vote participation.</li>
            <li>Marketing choices: email preferences and consent status.</li>
          </ul>

          <h3 className="mt-6 font-semibold">2.2 Data we collect automatically</h3>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Usage & device info: IP address, browser type, pages viewed, timestamps, referrers, approximate location.</li>
            <li>Security logs: sign-in events, failed logins, session state (to keep your account secure).</li>
            <li>Cookies & similar tech: see <Link href="/cookie-policy" className="text-green-800 underline">Cookie Policy</Link>.</li>
          </ul>

          <h3 className="mt-6 font-semibold">2.3 Data from third parties</h3>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Payment processors (e.g., Stripe): payment status (success/fail), limited card meta.</li>
            <li>Email delivery/CRM (e.g., Resend, Amazon SES, Microsoft 365): delivery, open/click signals where permitted.</li>
            <li>Anti-fraud/abuse and security tools.</li>
          </ul>

          <p className="mt-4 text-sm text-gray-600">
            We do <strong>not</strong> collect special category data by default and we do <strong>not</strong> sell personal data.
          </p>
        </section>

        <section id="how-we-use" className="mt-12">
          <h2 className="text-2xl font-bold text-green-900">3) How and why we use your data (legal bases)</h2>
          <p className="mt-2">
            We process personal data only where we have a valid legal basis:
          </p>
          <ul className="list-disc list-inside mt-3 space-y-2">
            <li>
              <strong>Contract</strong> — to create and manage your account; fulfil purchases/leases; operate <em>My Paddock</em>; run ballots and votes; send essential service emails; provide support.
            </li>
            <li>
              <strong>Legitimate interests</strong> — to keep services secure; prevent fraud and abuse; improve the site and features; understand usage; announce stable visits and community updates; light direct marketing to existing members (you can opt out).
            </li>
            <li>
              <strong>Consent</strong> — for non-essential cookies/analytics/marketing emails; you can withdraw at any time.
            </li>
            <li>
              <strong>Legal obligation</strong> — tax and accounting records; responding to lawful requests from authorities; compliance with racing regulations where applicable.
            </li>
          </ul>

          <h3 className="mt-6 font-semibold">Service communications</h3>
          <p className="mt-2">
            You’ll receive essential service emails (e.g., account, receipts, ballot outcomes, critical updates). You can opt out of marketing but not these essential communications.
          </p>
        </section>

        <section id="sharing" className="mt-12">
          <h2 className="text-2xl font-bold text-green-900">4) Sharing your data (service providers & partners)</h2>
          <p className="mt-2">
            We share data with providers who help us run our services. They act under contract, use data only on our instructions, and apply security measures. Typical categories:
          </p>
          <ul className="list-disc list-inside mt-3 space-y-1">
            <li><strong>Hosting & infrastructure</strong> (e.g., Vercel) — website and edge runtime.</li>
            <li><strong>Database & authentication</strong> (e.g., Supabase) — user auth, data storage.</li>
            <li><strong>Payments</strong> (e.g., Stripe) — secure payment processing.</li>
            <li><strong>Email delivery & CRM</strong> (e.g., Resend, Amazon SES/Microsoft 365) — transactional emails and support.</li>
            <li><strong>Analytics/monitoring</strong> (privacy-respecting where possible) — product performance and errors.</li>
            <li><strong>Professional services</strong> — legal, accounting, compliance advisers.</li>
          </ul>
          <p className="mt-3">
            We may disclose data where required by law, to enforce our terms, or to protect rights, property, and safety. If we undergo a reorganisation, merger, or sale, personal data may transfer under appropriate safeguards.
          </p>
        </section>

        <section id="international" className="mt-12">
          <h2 className="text-2xl font-bold text-green-900">5) International transfers</h2>
          <p className="mt-2">
            Some providers store/process data outside the UK/EEA (e.g., USA). Where we do, we use lawful transfer mechanisms such as the UK Addendum to the EU Standard Contractual Clauses, EU SCCs, and/or other adequacy measures to protect your data.
          </p>
        </section>

        <section id="retention" className="mt-12">
          <h2 className="text-2xl font-bold text-green-900">6) How long we keep data</h2>
          <p className="mt-2">
            We retain personal data only as long as necessary for the purposes above:
          </p>
          <ul className="list-disc list-inside mt-3 space-y-1">
            <li>Account & membership records: for your active relationship, then a reasonable period for queries/defence of claims.</li>
            <li>Transaction records: typically 6–7 years (tax/accounting).</li>
            <li>Marketing preferences: until you opt out or your account is deleted.</li>
          </ul>
          <p className="mt-2">
            When no longer needed, we delete or anonymise data. Where deletion isn’t feasible (e.g., backups), we securely isolate the data until deletion is possible.
          </p>
        </section>

        <section id="security" className="mt-12">
          <h2 className="text-2xl font-bold text-green-900">7) Security</h2>
          <p className="mt-2">
            We implement technical and organisational measures (encryption in transit, access controls, least-privilege, monitoring). No system is 100% secure, but we work to protect your data and promptly assess and act on incidents.
          </p>
        </section>

        <section id="rights" className="mt-12">
          <h2 className="text-2xl font-bold text-green-900">8) Your privacy rights</h2>
          <p className="mt-2">
            Under UK GDPR/EEA law, you may have the right to: access, rectification, erasure, restriction, objection (including to direct marketing), and data portability. Where we rely on consent, you can withdraw it at any time.
          </p>
          <p className="mt-2">
            To exercise rights, email{" "}
            <a href="mailto:support@premierpaddockracing.co.uk" className="text-green-800 underline">
              support@premierpaddockracing.co.uk
            </a>
            . We may need to verify your identity. We respond within applicable timeframes.
          </p>
        </section>

        <section id="cookies" className="mt-12">
          <h2 className="text-2xl font-bold text-green-900">9) Cookies & analytics</h2>
          <p className="mt-2">
            We use essential cookies to make the site work and (with your consent) may use analytics or marketing cookies. For details (including how to change your preferences), see our{" "}
            <Link href="/cookie-policy" className="text-green-800 underline">
              Cookie Policy
            </Link>.
          </p>
        </section>

        <section id="children" className="mt-12">
          <h2 className="text-2xl font-bold text-green-900">10) Children</h2>
          <p className="mt-2">
            Our services are for users aged 18+. We do not knowingly collect personal data from children.
          </p>
        </section>

        <section id="changes" className="mt-12">
          <h2 className="text-2xl font-bold text-green-900">11) Changes to this policy</h2>
          <p className="mt-2">
            We may update this policy to reflect changes in law or our services. We’ll post the new version here and, where required, notify you.
          </p>
        </section>

        <section id="contact" className="mt-12">
          <h2 className="text-2xl font-bold text-green-900">12) Contact & complaints</h2>
          <p className="mt-2">
            Questions or requests:{" "}
            <a href="mailto:support@premierpaddockracing.co.uk" className="text-green-800 underline">
              support@premierpaddockracing.co.uk
            </a>
          </p>
          <p className="mt-2">
            You may also complain to the UK Information Commissioner’s Office (ICO):{" "}
            <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noreferrer" className="text-green-800 underline">
              ico.org.uk/make-a-complaint
            </a>
            .
          </p>
        </section>
      </main>
    </>
  );
}