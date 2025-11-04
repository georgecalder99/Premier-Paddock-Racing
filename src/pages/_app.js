// src/pages/_app.js
import '../styles/globals.css';
import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { supabase } from '../lib/supabaseClient';
import Script from 'next/script';

export default function App({ Component, pageProps }) {
  const [session, setSession] = useState(null);
  const [hydrated, setHydrated] = useState(false); // ← NEW

  useEffect(() => {
    let mounted = true;

    // Supabase session init + listener
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (mounted) setSession(s);
    });

    // reveal app once hydrated
    setHydrated(true); // ← NEW

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  return (
    <>
      {/* Tailwind CDN (fine with Next/Script) */}
      <Script src="https://cdn.tailwindcss.com" strategy="beforeInteractive" />

      {/* Full-page white cover to suppress the flash until hydration */}
      {!hydrated && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: '#ffffff',
            zIndex: 2147483647, // sits above everything
          }}
        />
      )}

      <Navbar session={session} />
      <Component {...pageProps} session={session} />
      <Footer />
    </>
  );
}