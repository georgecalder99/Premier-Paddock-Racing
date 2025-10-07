// src/pages/_app.js
import '@/styles/globals.css';
import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { supabase } from '@/lib/supabaseClient';

export default function App({ Component, pageProps }) {
  const [session, setSession] = useState(null);

  useEffect(() => {
    // 1) Get current session on load
    supabase.auth.getSession().then(({ data }) => {
      setSession(data?.session ?? null);
    });

    // 2) Subscribe to auth changes (login/logout)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);
    });

    // 3) Cleanup
    return () => {
      try { sub?.subscription?.unsubscribe?.(); } catch {}
    };
  }, []);

  return (
    <>
      <Navbar />
      <Component {...pageProps} session={session} />
      <Footer />
    </>
  );
}