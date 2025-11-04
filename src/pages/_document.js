// src/pages/_document.js
import { Html, Head, Main, NextScript } from "next/document";
import Script from "next/script";

export default function Document() {
  return (
    <Html>
      <Head>
        {/* If you truly need a script before hydration, uncomment and point to it */}
        {/* <Script src="/path/to/your-script.js" strategy="beforeInteractive" /> */}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}