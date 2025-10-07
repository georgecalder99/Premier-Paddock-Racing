/* eslint-disable @next/next/no-img-element */
// src/pages/contact-us.js
import Head from "next/head";
import { useRef, useState } from "react";

export default function ContactUs() {
  const formRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");
    setBusy(true);

    // Safely read the form even after awaits
    const formEl = formRef.current;
    const form = new FormData(formEl);
    const payload = {
      name: form.get("name"),
      email: form.get("email"),
      phone: form.get("phone"),
      message: form.get("message"),
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Try to parse JSON, but guard against HTML error pages
      let json = null;
      try {
        json = await res.json();
      } catch {
        // ignore – will fall back to a generic error
      }

      if (!res.ok) {
        throw new Error(json?.error || "Failed to send your message. Please try again.");
      }

      setMsg("✅ Thanks — we’ve received your message and will get back to you soon.");
      formEl?.reset(); // <— this is now safe
    } catch (err) {
      setMsg(`❌ ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>Contact Us | Premier Paddock Racing</title>
        <meta
          name="description"
          content="Get in touch with Premier Paddock Racing. Ask about racehorse ownership, shares, syndicates or general enquiries."
        />
      </Head>

      <main className="bg-white">
        {/* HERO */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0">
            <img
              src="/hero.jpg"
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-green-900/60" />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-green-900/50 to-transparent" />
          </div>

          <div className="relative max-w-4xl mx-auto px-6 py-24 text-center text-white">
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight">
              Contact Premier Paddock Racing
            </h1>
            <p className="mt-4 text-lg md:text-xl text-gray-100">
              Have a question about ownership, shares or upcoming syndicates?
              Get in touch and we’ll be happy to help.
            </p>
          </div>
        </section>

        {/* FORM */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <div className="rounded-xl border bg-white shadow-sm p-8">
            <h2 className="text-2xl md:text-3xl font-bold text-green-900 text-center">
              Send us a message
            </h2>
            <p className="mt-2 text-gray-700 text-center">
              Fill out the form below and our team will get back to you promptly.
            </p>

            <form ref={formRef} onSubmit={onSubmit} className="mt-8 grid gap-4 max-w-2xl mx-auto">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    name="name"
                    required
                    placeholder="Your name"
                    className="mt-1 w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="you@email.com"
                    className="mt-1 w-full border rounded px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Phone (optional)</label>
                <input
                  name="phone"
                  placeholder="Your phone number"
                  className="mt-1 w-full border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Message</label>
                <textarea
                  name="message"
                  required
                  rows={5}
                  placeholder="How can we help?"
                  className="mt-1 w-full border rounded px-3 py-2"
                />
              </div>

              <button
                disabled={busy}
                className="mt-4 bg-green-900 text-white rounded px-5 py-3 font-semibold hover:bg-green-800 disabled:opacity-60"
              >
                {busy ? "Sending…" : "Send message"}
              </button>

              {msg && <p className="text-sm text-center mt-3">{msg}</p>}
            </form>
          </div>
        </section>
      </main>
    </>
  );
}