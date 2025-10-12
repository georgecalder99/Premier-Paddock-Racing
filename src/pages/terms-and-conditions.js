import Head from "next/head";
import Link from "next/link";

export default function TermsAndConditions() {
  return (
    <>
      <Head>
        <title>Terms & Conditions | Premier Paddock Racing</title>
        <meta
          name="description"
          content="Premier Paddock Racing Terms & Conditions for racing syndicates and leases: membership, financials, prize money, ballots, welfare, and legal terms."
        />
        <meta name="robots" content="noindex" />
      </Head>

      <main className="max-w-5xl mx-auto px-6 py-16 text-gray-800">
        <h1 className="text-3xl md:text-4xl font-extrabold text-green-900">
          Terms & Conditions
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Last updated: {new Date().getFullYear()}
        </p>

        <p className="mt-6">
          These Terms & Conditions (“Terms”) set out how Premier Paddock Racing
          (“Premier Paddock Racing”, “we”, “us”, “our”) operates its racing
          syndicates and leases, and the terms of membership for people who
          purchase or lease shares (“you”, “your”, “member”). By purchasing or
          leasing a share, renewing a share, or using our services (including
          the My Paddock portal), you agree to be bound by these Terms.
        </p>

        <div className="mt-8 rounded-lg border bg-green-50 p-4 text-sm text-green-900">
          <p className="font-semibold">Key summary (not a substitute for the full Terms):</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Membership is a leisure experience, not an investment.</li>
            <li>Some syndicates are <em>ownership</em> (share in sale proceeds); some are <em>lease</em> (no sale proceeds). Both receive prize money.</li>
            <li>Trainer and welfare decisions rest with us and the trainer; plans can change at short notice.</li>
            <li>Ballots for badges/visits are fair and capacity-limited; attendance is not guaranteed.</li>
            <li>Fees are fixed for the term and cover expected costs; no top-ups during the term.</li>
            <li>We follow the BHA Rules of Racing where applicable.</li>
          </ul>
        </div>

        {/* 1. THE SYNDICATE */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-green-900">1) The Syndicate</h2>

          <h3 className="mt-6 font-semibold">1.1 Who we are</h3>
          <p className="mt-2">
            Premier Paddock Racing is the syndicator and manager of each
            syndicate or lease presented on this website. The legal owner or
            lessee of the horse is shown on the horse page and/or in your order
            confirmation. Your share grants you the right to participate in the
            racing experience for the defined term, as described in these Terms.
          </p>

          <h3 className="mt-6 font-semibold">1.2 Definitions</h3>
          <ul className="mt-2 list-disc list-inside space-y-1">
            <li><strong>Share:</strong> a unit of membership in a horse’s syndicate or lease.</li>
            <li><strong>Ownership Syndicate:</strong> members share prize money and (if the horse is sold) net sale proceeds, proportionate to shares.</li>
            <li><strong>Lease Syndicate:</strong> members share prize money but have no entitlement to sale proceeds or breeding rights.</li>
            <li><strong>Term:</strong> the fixed period the syndicate/lease runs (e.g., a season or campaign).</li>
            <li><strong>My Paddock:</strong> our member portal where you see shares, updates, ballots, and statements.</li>
          </ul>

          <h3 className="mt-6 font-semibold">1.3 Eligibility & account</h3>
          <ul className="mt-2 list-disc list-inside space-y-1">
            <li>You must be 18+ and a consumer (not purchasing for a business purpose).</li>
            <li>We may conduct reasonable verification checks. We may decline or cancel a membership where legal, regulatory, or welfare reasons apply (e.g., fraud risk, BHA Forfeit List, abusive conduct).</li>
            <li>You’re responsible for securing your account and keeping your contact details up to date.</li>
          </ul>

          <h3 className="mt-6 font-semibold">1.4 What membership includes</h3>
          <p className="mt-2">
            For the Term, you’ll receive trainer/yard updates, access to ballots
            for owners’ badges on race days and stable visits (subject to
            availability), and full use of My Paddock for your horse(s). Prize
            money participation applies to both ownership and lease syndicates.
          </p>

          <h3 className="mt-6 font-semibold">1.5 Term, renewal & non-renewal</h3>
          <ul className="mt-2 list-disc list-inside space-y-1">
            <li>Each horse runs on a defined Term (shown on the horse page and your receipt).</li>
            <li>We’ll notify you reasonably in advance if a syndicate will renew. Renewal typically covers the new Term’s fees only (no share re-purchase).</li>
            <li>If you don’t renew before the deadline, your benefits end at Term end (see Section 4 for wind-down).</li>
          </ul>

          <h3 className="mt-6 font-semibold">1.6 Conduct, ballots & events</h3>
          <ul className="mt-2 list-disc list-inside space-y-1">
            <li><strong>Conduct:</strong> Respect staff, other owners, and the horse. We may refuse/withdraw attendance or membership for breach or abusive behaviour.</li>
            <li><strong>Ballots:</strong> Entries open in My Paddock when a horse is declared or a visit is scheduled. Winners are selected fairly based on the course allocation. Guest places may be offered at our discretion.</li>
            <li><strong>Events:</strong> Attendance is optional and not guaranteed. Events can be cancelled or altered. We are not responsible for your travel or incidental costs.</li>
          </ul>

          <h3 className="mt-6 font-semibold">1.7 “Your horse. Your say.” votes</h3>
          <p className="mt-2">
            We may invite member votes on selected decisions (e.g., choosing
            between suitable race targets). Voting is advisory; final decisions
            rest with the trainer and us for welfare/performance reasons.
          </p>

          <h3 className="mt-6 font-semibold">1.8 Not an investment or CIS</h3>
          <p className="mt-2">
            Membership is a leisure experience. It is not an investment product
            or collective investment scheme. No profit is guaranteed; returns, if
            any, are limited to prize money and (ownership syndicates only) any
            net sale proceeds as set out in these Terms.
          </p>
        </section>

        {/* 2. THE HORSE */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-green-900">2) The Horse</h2>

          <h3 className="mt-6 font-semibold">2.1 Ownership & leasing structure</h3>
          <p className="mt-2">
            Legal title to the horse is held by us or a nominated entity. In a
            lease syndicate, we hold the relevant lease from the legal owner.
            Your share gives you the right to participate in the racing
            experience; it is not a share in our company.
          </p>

          <h3 className="mt-6 font-semibold">2.2 Trainer authority & welfare</h3>
          <ul className="mt-2 list-disc list-inside space-y-1">
            <li>We appoint the trainer and may change trainer/stable in the horse’s best interests.</li>
            <li>All training, veterinary, race placement, equipment, and welfare decisions are made by the trainer and us.</li>
            <li>We may withdraw the horse, rest, retire, or rehome at any time for welfare reasons.</li>
          </ul>

          <h3 className="mt-6 font-semibold">2.3 Veterinary treatment & disclosure</h3>
          <ul className="mt-2 list-disc list-inside space-y-1">
            <li>We may authorise reasonable treatment/surgery (e.g., gelding, wind procedure) if recommended by the trainer/vet.</li>
            <li>We’ll keep members appropriately informed, but medical detail may be summarised to protect sensitive information.</li>
          </ul>

          <h3 className="mt-6 font-semibold">2.4 Entries, declarations & changes</h3>
          <p className="mt-2">
            Targets are indicative and can change at short notice. Abandonments,
            ground changes, or fitness concerns may alter plans. We’ll update
            members promptly.
          </p>

          <h3 className="mt-6 font-semibold">2.5 Insurance</h3>
          <p className="mt-2">
            Unless stated otherwise, horses are <em>not</em> insured for mortality or loss of use. Where we do arrange insurance, we may share the premium cost within the Term fee. Individual member policy purchases are not offered by us.
          </p>

          <h3 className="mt-6 font-semibold">2.6 Retirement & aftercare</h3>
          <p className="mt-2">
            If retired or rehomed, we will prioritise responsible aftercare. We
            may sell or gift the horse to a suitable home or charity, at our
            discretion, in accordance with welfare best practice.
          </p>

          <h3 className="mt-6 font-semibold">2.7 Breeding rights</h3>
          <p className="mt-2">
            Breeding rights (if any) remain with us or the legal owner and are
            not included in member benefits unless explicitly stated in writing.
          </p>
        </section>

        {/* 3. SYNDICATE FINANCIALS */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-green-900">3) Syndicate Financials</h2>

          <h3 className="mt-6 font-semibold">3.1 Pricing & fees</h3>
          <ul className="mt-2 list-disc list-inside space-y-1">
            <li>
              The price displayed at checkout will show (i) the share purchase
              price (first Term only, for ownership syndicates) and/or (ii) the
              fixed Term fee (training, entries, routine vet, transport,
              insurance if applicable, and management).
            </li>
            <li>
              Fees are fixed for the Term; we won’t request top-ups for that Term.
              Surpluses/deficits are managed by us and not refunded/charged to
              members.
            </li>
          </ul>

          <h3 className="mt-6 font-semibold">3.2 Prize money</h3>
          <ul className="mt-2 list-disc list-inside space-y-1">
            <li>
              Net prize money (after authority/industry deductions) is
              distributed proportionally to members’ shareholdings.
            </li>
            <li>
              We will display distributions in My Paddock, to receieve a payout a form will need to be filed. Only Amounts over £5 are able to be withdrawn.  
            </li>
          </ul>

          <h3 className="mt-6 font-semibold">3.3 Sale proceeds (ownership syndicates only)</h3>
          <p className="mt-2">
            If the horse is sold during or at the end of the Term, net sale
            proceeds (after costs/fees/taxes) are distributed proportionally to
            members of ownership syndicates. Lease syndicates have no entitlement
            to sale proceeds.
          </p>

          <h3 className="mt-6 font-semibold">3.4 Taxes, VAT & charges</h3>
          <ul className="mt-2 list-disc list-inside space-y-1">
            <li>Prices are shown inclusive/exclusive of VAT as stated at checkout.</li>
            <li>You are responsible for any personal tax arising from payments to you.</li>
            <li>All payouts are made in GBP to UK bank accounts.</li>
          </ul>

          <h3 className="mt-6 font-semibold">3.5 Payment, late payment & BHA Forfeit List</h3>
          <ul className="mt-2 list-disc list-inside space-y-1">
            <li>Payment is due at checkout (and on renewal by the date stated).</li>
            <li>
              If you do not pay within three (3) months of our request, we may
              make a non-payment report in line with the BHA Syndicate Code of
              Conduct, which could result in you being placed on the Forfeit List.
            </li>
            <li>We may suspend your membership benefits until payment issues are resolved.</li>
          </ul>

          <h3 className="mt-6 font-semibold">3.6 Cooling-off & refunds</h3>
          <ul className="mt-2 list-disc list-inside space-y-1">
            <li>
              If you buy online, you have 14 days from our order confirmation to
              change your mind and cancel (Consumer Contracts Regulations).
            </li>
            <li>
              If services have begun at your request within the 14 days, a
              reasonable deduction may apply for services provided. Physical
              welcome packs (if any) already produced may be deducted.
            </li>
            <li>After the 14-day window, purchases are generally final.</li>
          </ul>
        </section>

        {/* 4. SELLING SHARES / ENDING THE SYNDICATE */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-green-900">
            4) Selling Shares / Ending the Syndicate
          </h2>

          <h3 className="mt-6 font-semibold">4.1 Transfers & resales</h3>
          <ul className="mt-2 list-disc list-inside space-y-1">
            <li>
              Shares are not freely transferable. We may (but are not obliged to)
              provide a member-to-member transfer/resale facility in My Paddock.
            </li>
            <li>
              If enabled, transfers may be subject to checks, fees, and caps to
              keep access fair.
            </li>
          </ul>

          <h3 className="mt-6 font-semibold">4.2 Renewal shortfall</h3>
          <p className="mt-2">
            If insufficient members renew for a new Term, we may wind down the
            syndicate. We’ll notify you and outline next steps (sale, lease
            expiry, or retirement/rehoming).
          </p>

          <h3 className="mt-6 font-semibold">4.3 Sale of the horse</h3>
          <ul className="mt-2 list-disc list-inside space-y-1">
            <li>
              We may sell the horse privately or via a public auction or claiming/selling race where appropriate.
            </li>
            <li>
              We have discretion on timing, method, reserve, and acceptance of
              offers, with the horse’s and syndicate’s best interests in mind.
            </li>
            <li>
              On sale completion, net proceeds are distributed to ownership
              syndicate members proportionally; lease syndicates receive no sale
              proceeds.
            </li>
          </ul>

          <h3 className="mt-6 font-semibold">4.4 Retirement/rehoming</h3>
          <p className="mt-2">
            If retired, we’ll attempt to place the horse with a suitable new
            home or charity (sale or gift). Welfare is the priority. The
            syndicate ends when the horse is sold or rehomed.
          </p>

          <h3 className="mt-6 font-semibold">4.5 Termination for breach</h3>
          <ul className="mt-2 list-disc list-inside space-y-1">
            <li>
              We may terminate or suspend membership for breach (e.g., abuse,
              fraud, non-payment, serious conduct issues). No refund is due for
              the remaining Term in such cases.
            </li>
            <li>
              On termination or at wind-up, your rights cease except any amount
              validly due (e.g., prize money earned before termination, or
              ownership sale proceeds if applicable) which we’ll settle within a
              reasonable time.
            </li>
          </ul>

          <h3 className="mt-6 font-semibold">4.6 Breeding rights</h3>
          <p className="mt-2">
            Unless we explicitly state otherwise in writing, all breeding rights
            remain with us or the legal owner and are excluded from member
            benefits.
          </p>
        </section>

        {/* 5. OTHER IMPORTANT LEGAL TERMS */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-green-900">
            5) Other Important Legal Terms
          </h2>

          <h3 className="mt-6 font-semibold">5.1 Rules of Racing & conduct</h3>
          <p className="mt-2">
            Members agree to conduct themselves in line with the BHA Rules of
            Racing (including Chapters (J) Integrity and (L) Investigations) and
            any reasonable racecourse or stable rules communicated by us.
          </p>

          <h3 className="mt-6 font-semibold">5.2 Website & portal use</h3>
          <p className="mt-2">
            Use of our website and My Paddock portal is subject to our Website
            Terms and Privacy Policy. We may suspend access for maintenance,
            misuse, or security reasons.
          </p>

          <h3 className="mt-6 font-semibold">5.3 Intellectual property</h3>
          <p className="mt-2">
            We own all IP in our brand, logos, colours, content, photos, and
            videos unless otherwise stated. Personal, non-commercial sharing is
            allowed; commercial use needs our prior written consent.
          </p>

          <h3 className="mt-6 font-semibold">5.4 Data protection</h3>
          <p className="mt-2">
            We process personal data in accordance with our{" "}
            <Link href="/privacy-policy" className="text-green-800 underline">
              Privacy Policy
            </Link>
            . We may share necessary details with trainers, racecourses,
            governing bodies (e.g., Weatherbys/BHA), and service providers to
            deliver the service.
          </p>

          <h3 className="mt-6 font-semibold">5.5 Liability</h3>
          <ul className="mt-2 list-disc list-inside space-y-1">
            <li>
              We are responsible for loss or damage you suffer that is a
              foreseeable result of our breach of these Terms or our negligence.
            </li>
            <li>
              We’re not liable for: (i) events outside our reasonable control
              (force majeure); (ii) losses you could have avoided with reasonable
              care; (iii) business losses; or (iv) indirect or consequential
              losses.
            </li>
            <li>
              Nothing in these Terms limits liability for death or personal
              injury caused by negligence, fraud, or other liabilities that
              cannot be limited by law.
            </li>
          </ul>

          <h3 className="mt-6 font-semibold">5.6 Force majeure</h3>
          <p className="mt-2">
            We’re not responsible for delays or failures caused by events beyond
            our reasonable control (e.g., severe weather, disease outbreaks,
            regulatory action, system outages, transport strikes).
          </p>

          <h3 className="mt-6 font-semibold">5.7 Changes to these Terms</h3>
          <p className="mt-2">
            We may update these Terms to reflect operational, legal, or
            regulatory changes. Material changes will be notified via My Paddock
            and/or email and will apply from the start of the next Term unless a
            change is needed sooner by law.
          </p>

          <h3 className="mt-6 font-semibold">5.8 Complaints</h3>
          <p className="mt-2">
            If you have a complaint, please email{" "}
            <a
              href="mailto:support@premierpaddockracing.co.uk"
              className="text-green-800 underline"
            >
              support@premierpaddockracing.co.uk
            </a>
            . We aim to acknowledge within 2 working days and respond promptly
            and fairly. If you remain dissatisfied, you may request escalation
            within Premier Paddock Racing’s management. This does not affect
            your statutory rights.
          </p>

          <h3 className="mt-6 font-semibold">5.9 Governing law & jurisdiction</h3>
          <p className="mt-2">
            These Terms are governed by the laws of England and Wales. You may
            bring proceedings in the courts of England and Wales, or (if you live
            in Scotland or Northern Ireland) in the courts of your home nation.
          </p>

          <h3 className="mt-6 font-semibold">5.10 Miscellaneous</h3>
          <ul className="mt-2 list-disc list-inside space-y-1">
            <li>
              <strong>Severability:</strong> If any provision is found unlawful,
              the rest remain in force.
            </li>
            <li>
              <strong>No waiver:</strong> A delay in enforcing these Terms is not
              a waiver of rights.
            </li>
            <li>
              <strong>Assignment:</strong> We may assign our rights/obligations;
              you may not assign without our consent.
            </li>
            <li>
              <strong>Entire agreement:</strong> These Terms, the horse page, and
              your order confirmation form the entire agreement between us for
              your share.
            </li>
            <li>
              <strong>Notices:</strong> We’ll contact you via email/My Paddock.
              Please keep your email current.
            </li>
          </ul>

          <div className="mt-10 rounded-lg border bg-gray-50 p-4 text-sm">
            <p>
              Questions? Contact{" "}
              <a
                href="mailto:support@premierpaddockracing.co.uk"
                className="text-green-800 underline"
              >
                support@premierpaddockracing.co.uk
              </a>
              .
            </p>
          </div>
        </section>
      </main>
    </>
  );
}