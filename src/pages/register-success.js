import Head from "next/head";
import Link from "next/link";

export default function RegisterSuccess() {
  return (
    <>
<Head>
  <title>Thank you | Premier Paddock Racing</title>
  <meta
    name="description"
    content="Thanks for registering your interest with Premier Paddock Racing."
  />

  {/* ✅ Google tag (gtag.js) */}
  <script
    async
    src="https://www.googletagmanager.com/gtag/js?id=AW-17716972401"
  ></script>
  <script
    dangerouslySetInnerHTML={{
      __html: `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'AW-17716972401');
      `,
    }}
  />
</Head>

      <main className="min-h-[70vh] bg-gray-50 flex items-center justify-center px-6">
        <div className="max-w-md w-full bg-white rounded-2xl border shadow-sm p-8 text-center">
          <h1 className="text-3xl font-extrabold text-green-900">
            Thank you!
          </h1>
          <p className="mt-3 text-gray-700">
            You’ve successfully registered your interest in{" "}
            <strong>Premier Paddock Racing</strong>.
          </p>
          <p className="mt-1 text-gray-600">
            We’ll be in touch soon with launch updates and how you can get involved.
          </p>

          <div className="mt-6">
            <Link
              href="/"
              className="inline-block bg-green-900 text-white px-6 py-3 rounded-lg hover:bg-green-800 transition"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
