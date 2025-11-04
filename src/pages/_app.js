/* eslint-disable @next/next/no-img-element */
import "../styles/globals.css";
import { useEffect } from "react";
import Head from "next/head";

export default function App({ Component, pageProps }) {
  useEffect(() => {
    // Remove the anti-FOUC class as soon as JS runs (hydration)
    document.documentElement.classList.remove("no-fouc");
  }, []);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}