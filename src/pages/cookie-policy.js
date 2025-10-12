import Head from "next/head";

export default function CookiePolicy() {
  return (
    <>
      <Head>
        <title>Cookie Policy | Premier Paddock Racing</title>
        <meta
          name="description"
          content="Cookie Policy for Premier Paddock Racing — explaining our use of cookies and analytics."
        />
      </Head>

      <main className="max-w-5xl mx-auto px-6 py-16 text-gray-800">
        <h1 className="text-3xl font-bold text-green-900 mb-6">
          Cookie Policy
        </h1>

        <p className="mb-4">
          Premier Paddock Racing uses cookies to improve site functionality,
          analyse traffic, and personalise user experience. This policy explains
          what cookies are, how we use them, and your control options.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-2">1. What Are Cookies?</h2>
        <p>
          Cookies are small text files stored on your device when you visit a
          website. They help websites recognise your device and remember
          preferences.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-2">2. How We Use Cookies</h2>
        <ul className="list-disc ml-6">
          <li>Essential cookies — required for core functionality</li>
          <li>Analytics cookies — help us understand usage and improve features</li>
          <li>Preference cookies — store your chosen settings</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-2">3. Managing Cookies</h2>
        <p>
          You can adjust or disable cookies through your browser settings. Note
          that disabling some cookies may affect site performance.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-2">4. Contact</h2>
        <p>
          For questions, email{" "}
          <a href="mailto:support@premierpaddockracing.co.uk" className="text-green-800 underline">
            support@premierpaddockracing.co.uk
          </a>
          .
        </p>
      </main>
    </>
  );
}