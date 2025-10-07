import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [importantOpen, setImportantOpen] = useState(false); // dropdown toggle
  const router = useRouter();

  const links = [
    { href: "/", label: "Home" },
    { href: "/horses", label: "Horses" },
    { href: "/how-it-works", label: "How it works" },
    { href: "/about-us", label: "About us" },
    { href: "/faqs", label: "FAQs" },
    { href: "/contact-us", label: "Contact us" },
  ];

  const importantLinks = [
    { href: "/important/terms", label: "Terms & Conditions" },
    { href: "/important/privacy", label: "Privacy Policy" },
    { href: "/important/cookies", label: "Cookie Policy" },
  ];

  const isActive = (path) => router.pathname === path;

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Left: Brand */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
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

            {/* Dropdown: Important Stuff */}
            <div className="relative">
              <button
                onClick={() => setImportantOpen((v) => !v)}
                className="text-sm text-gray-700 hover:text-green-900 font-medium flex items-center gap-1"
              >
                The Important Stuff
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {importantOpen && (
                <div className="absolute mt-2 w-48 bg-white shadow rounded border">
                  {importantLinks.map((il) => (
                    <Link
                      key={il.href}
                      href={il.href}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      {il.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

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
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
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

              {/* Mobile: Important Stuff submenu */}
              <div className="mt-2">
                <span className="px-3 py-2 font-medium text-gray-700">The Important Stuff</span>
                <div className="ml-4 flex flex-col">
                  {importantLinks.map((il) => (
                    <Link
                      key={il.href}
                      href={il.href}
                      className="px-3 py-1 text-sm text-gray-600 hover:text-green-900"
                      onClick={() => setOpen(false)}
                    >
                      {il.label}
                    </Link>
                  ))}
                </div>
              </div>

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