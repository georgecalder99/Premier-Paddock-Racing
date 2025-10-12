import { useState } from "react";
import Link from "next/link";
import Image from "next/image"; // ✅ Add this import
import { useRouter } from "next/router";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const links = [
    { href: "/", label: "Home" },
    { href: "/horses", label: "Horses" },
    { href: "/how-it-works", label: "How it works" },
    { href: "/about-us", label: "About us" },
    { href: "/faqs", label: "FAQs" },
    { href: "/contact-us", label: "Contact us" },
  ];

  const isActive = (path) => router.pathname === path;

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Left: Brand */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              {/* ✅ Logo image */}
              <Image
                src="/logo.jpg" // ← Put your logo file in /public/logo.png
                alt="Premier Paddock Racing logo"
                width={40}
                height={40}
                className="rounded-md object-contain"
              />
              <span className="text-xl font-extrabold text-green-900 tracking-tight">
                Premier Paddock Racing
              </span>
            </Link>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`text-sm ${
                  isActive(l.href)
                    ? "text-green-900 font-semibold"
                    : "text-gray-700 hover:text-green-900"
                }`}
              >
                {l.label}
              </Link>
            ))}

            {/* Boxed My Paddock (top-right) */}
            <Link
              href="/my-paddock"
              className="px-4 py-2 border-2 border-yellow-400 text-yellow-500 font-semibold rounded-lg hover:bg-yellow-400 hover:text-green-900 transition"
            >
              My Paddock
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-gray-700 hover:bg-gray-100"
            aria-label="Toggle menu"
            onClick={() => setOpen((v) => !v)}
          >
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              {open ? (
                <path
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile drawer */}
        {open && (
          <div className="md:hidden border-t pb-4">
            <div className="flex flex-col gap-1 pt-2">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`px-3 py-2 rounded ${
                    isActive(l.href)
                      ? "text-green-900 font-semibold bg-green-50"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </Link>
              ))}

              {/* Boxed My Paddock (mobile) */}
              <Link
                href="/my-paddock"
                className="mt-2 mx-3 px-4 py-2 border-2 border-yellow-400 text-yellow-500 font-semibold rounded-lg text-center hover:bg-yellow-400 hover:text-green-900 transition"
                onClick={() => setOpen(false)}
              >
                My Paddock
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}