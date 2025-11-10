import dynamic from "next/dynamic";
import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

function RegisterInterestPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setMsg("");
    setBusy(true);
    try {
      const eaddr = String(email || "").trim().toLowerCase();
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(eaddr);
      if (!ok) throw new Error("Please enter a valid email");

      const { error } = await supabase
        .from("interest_signups")
        .insert({ email: eaddr, source: "page" });

      // Treat duplicate as success
      if (error && error.code !== "23505") {
        console.error("[interest] insert error:", error);
        throw error;
      }

      console.log("[interest] success, redirecting…");
      // Prefer Next’s client navigation
      router.replace("/register-success");
      return; // stop here after redirect
    } catch (err) {
      console.error("[interest] submit failed:", err);
      setMsg(`❌ ${err.message || "Something went wrong"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>Register your interest | Premier Paddock Racing</title>
        <meta
          name="description"
          content="Join the list to hear first about Premier Paddock Racing launches, offers and updates."
        />
      </Head>

      <main className="min-h-[70vh] bg-gray-50">
        <section className="max-w-3xl mx-auto px-6 py-14">
          <div className="mx-auto rounded-2xl border bg-white p-8 shadow-sm">
            <div className="text-center">
              <h1 className="text-3xl md:text-4xl font-extrabold text-green-900">
                Register your interest
              </h1>
              <p className="mt-3 text-gray-700">
                Priced at £45 a share and in training with one of Britain’s leading trainers. We are diving straight in!!
              </p>
            </div>

            <form onSubmit={submit} className="mt-6 flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="flex-1 rounded-lg border px-4 py-3"
                aria-label="Email address"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-green-900 px-6 py-3 text-white disabled:opacity-60"
              >
                {busy ? "Sending…" : "Keep me posted"}
              </button>
            </form>

            {msg && <p className="mt-3 text-center text-sm text-gray-700">{msg}</p>}

            <p className="mt-6 text-xs text-center text-gray-500">
              By subscribing you agree to our{" "}
              <Link className="underline" href="/privacy-policy">Privacy Policy</Link>.
            </p>

            <div className="mt-8 text-center">
              <Link href="/" className="text-sm text-green-900 underline">← Back to home</Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

export default dynamic(() => Promise.resolve(RegisterInterestPage), { ssr: false });