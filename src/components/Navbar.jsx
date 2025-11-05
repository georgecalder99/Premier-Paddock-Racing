/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { getOrCreateCart } from "../lib/cartClient";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const [session, setSession] = useState(null);
  const [cartId, setCartId] = useState(null);
  const [basketCount, setBasketCount] = useState(0);

  const links = [
    { href: "/", label: "Home" },
    { href: "/horses", label: "Horses" },
    { href: "/how-it-works", label: "How it works" },
    { href: "/about-us", label: "About us" },
    { href: "/faqs", label: "FAQs" },
    { href: "/contact-us", label: "Contact us" },
  ];

  const isActive = (path) => router.pathname === path;

  // --- auth session
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data?.session ?? null);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  // --- cart badge refresh helper (counts unique horses/renewals, not total qty)
async function refreshBasketCount(forCartId) {
  if (!forCartId) {
    setBasketCount(0);
    return;
  }

  // We only need identifiers to dedupe by kind
  const { data: items, error } = await supabase
    .from("cart_items")
    .select("item_type, horse_id, renew_cycle_id")
    .eq("cart_id", forCartId);

  if (error) {
    console.warn("[navbar] cart_items fetch error:", error);
    setBasketCount(0);
    return;
  }

  // Key = share per horse OR renewal per cycle
  const keys = new Set(
    (items || []).map((r) =>
      r.item_type === "renewal"
        ? `ren:${r.renew_cycle_id}`
        : `shr:${r.horse_id}`
    )
  );

  setBasketCount(keys.size);
}

  // --- ensure a cart exists (guest or authed) + get initial count
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cart = await getOrCreateCart(); // should work for guests too
        if (cancelled) return;
        const id = cart?.id || null;
        setCartId(id);
        await refreshBasketCount(id);
      } catch {
        if (!cancelled) {
          setCartId(null);
          setBasketCount(0);
        }
      }
    })();
    // refetch if auth state changes (e.g., guest -> logged in), but not gated on it
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  // --- realtime + event bus + route change refresh
  useEffect(() => {
    if (!cartId) return;

    const channel = supabase
      .channel(`cart-${cartId}-items`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cart_items", filter: `cart_id=eq.${cartId}` },
        () => refreshBasketCount(cartId)
      )
      .subscribe();

    const busHandler = () => refreshBasketCount(cartId);
    window.addEventListener("cart:changed", busHandler);

    const routeHandler = () => refreshBasketCount(cartId);
    router.events?.on?.("routeChangeComplete", routeHandler);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("cart:changed", busHandler);
      router.events?.off?.("routeChangeComplete", routeHandler);
    };
  }, [cartId]); // eslint-disable-line react-hooks/exhaustive-deps

  // SVG basket icon (stable size even without CSS)
  const BasketIcon = useMemo(
    () => (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 6h15l-1.5 9h-12z" />
        <path d="M6 6l-2 0" />
        <circle cx="9" cy="19.5" r="1.5" />
        <circle cx="17" cy="19.5" r="1.5" />
      </svg>
    ),
    []
  );

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Left: Brand */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo.jpg"
                alt="Premier Paddock Racing logo"
                width={160}
                height={40}
                priority
                className="block h-10 w-auto object-contain"
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

            {/* My Paddock */}
            <Link
              href="/my-paddock"
              className="px-4 py-2 border-2 border-yellow-400 text-yellow-500 font-semibold rounded-lg hover:bg-yellow-400 hover:text-green-900 transition"
            >
              My Paddock
            </Link>

            {/* Basket button */}
            <Link
              href="/cart"
              className="relative inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-green-900 hover:bg-gray-50"
              aria-label={`Basket${basketCount > 0 ? `, ${basketCount} item${basketCount === 1 ? "" : "s"}` : ""}`}
              title="Basket"
            >
              {BasketIcon}
              <span>Basket</span>
              <span
                className={
                  "absolute -top-1 -right-1 min-w-[1.25rem] h-5 rounded-full text-[11px] leading-5 text-center px-1 transition " +
                  (basketCount > 0
                    ? "bg-amber-600 text-white opacity-100 scale-100"
                    : "bg-transparent text-transparent opacity-0 scale-75")
                }
              >
                {basketCount || 0}
              </span>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-gray-700 hover:bg-gray-100"
            aria-label="Toggle menu"
            onClick={() => setOpen((v) => !v)}
          >
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
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

              {/* My Paddock (mobile) */}
              <Link
                href="/my-paddock"
                className="mt-2 mx-3 px-4 py-2 border-2 border-yellow-400 text-yellow-500 font-semibold rounded-lg text-center hover:bg-yellow-400 hover:text-green-900 transition"
                onClick={() => setOpen(false)}
              >
                My Paddock
              </Link>

              {/* Basket (mobile) */}
              <Link
                href="/cart"
                className="mt-2 mx-3 px-4 py-2 border text-green-900 font-semibold rounded-lg text-center hover:bg-gray-50 transition relative"
                onClick={() => setOpen(false)}
                aria-label={`Basket${basketCount > 0 ? `, ${basketCount} item${basketCount === 1 ? "" : "s"}` : ""}`}
                title="Basket"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <span className="inline-block">{BasketIcon}</span>
                  Basket
                </span>
                {basketCount > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-[1.25rem] h-5 rounded-full bg-amber-600 text-white text-[11px] leading-5 text-center px-1">
                    {basketCount}
                  </span>
                )}
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}