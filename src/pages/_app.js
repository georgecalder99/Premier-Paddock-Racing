// src/pages/_app.js
import '../styles/globals.css';
import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { supabase } from '../lib/supabaseClient';
import Script from 'next/script'; // ← ADD

export default function App({ Component, pageProps }) {
  const [session, setSession] = useState(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  return (
    <>
      {/* Bring back Tailwind (CDN) without the _document sync-script lint error */}
      <Script src="https://cdn.tailwindcss.com" strategy="beforeInteractive" />

      <Navbar session={session} />
      <Component {...pageProps} session={session} />
      <Footer />
    </>
  );
}