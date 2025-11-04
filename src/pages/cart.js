/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";
import cartApi from "../lib/cartClient";
import { supabase } from "../lib/supabaseClient";

/* ---------- helpers ---------- */
const fmtGBP = (n) =>
  `£${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/* =========================================================================
   Wrapper: handles auth only (no cart hooks here to keep hooks ordering safe)
=========================================================================== */
export default function CartPage() {
  const [session, setSession] = useState(null);
  const [checkedAuth, setCheckedAuth] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data?.session ?? null);
      setCheckedAuth(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      setCheckedAuth(true);
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  // Avoid flicker while checking auth
  if (!checkedAuth) {
    return (
      <main className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-2xl md:text-3xl font-extrabold text-green-900">Your Basket</h1>
        <p className="mt-6 text-gray-600">Loading…</p>
      </main>
    );
  }

  // Not signed in → show the empty basket UI (no error)
  if (!session) {
    return (
      <>
        <Head>
          <title>Basket | Premier Paddock Racing</title>
        </Head>
        <main className="max-w-5xl mx-auto px-6 py-10">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl md:text-3xl font-extrabold text-green-900">Your Basket</h1>
            <Link href="/horses" className="text-green-800 hover:underline">
              ← Continue shopping
            </Link>
          </div>

          <div className="mt-8 rounded-md border p-6 text-center">
            <p className="text-gray-700">Your basket is empty.</p>
            <p className="mt-3">
              <Link href="/horses" className="text-green-800 underline">
                Browse horses →
              </Link>
            </p>
          </div>
        </main>
      </>
    );
  }

  // Signed in → render cart
  return <CartInner />;
}

/* =========================================================================
   Inner cart: all cart logic lives here (hooks are unconditional & ordered)
=========================================================================== */
function CartInner() {
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState(null);
  const [items, setItems] = useState([]);
  const [horses, setHorses] = useState({});
  const [subtotalCents, setSubtotalCents] = useState(0);
  const [errMsg, setErrMsg] = useState("");

  // wallet state
  const [walletCents, setWalletCents] = useState(0);
  const [walletLoading, setWalletLoading] = useState(true);

  // user-chosen wallet amount (cents) + input string
  const [walletApplyCents, setWalletApplyCents] = useState(0);
  const [walletApplyInput, setWalletApplyInput] = useState("0.00");
  const userEditedWallet = useRef(false);

  const [checkingOut, setCheckingOut] = useState(false);

  // owned shares for renewal caps
  const [ownedByHorse, setOwnedByHorse] = useState({});

  // Best-effort “shares left” for a horse (for share purchases)
  function getHorseAvailable(horse) {
    if (!horse) return 100;
    const candidates = [
      horse.shares_remaining,
      horse.sharesAvailable,
      horse.shares_available,
      horse.available_shares,
      horse.remaining_shares,
      horse.total_shares != null && horse.sold_shares != null
        ? Number(horse.total_shares) - Number(horse.sold_shares)
        : undefined,
    ]
      .map(Number)
      .filter((v) => Number.isFinite(v) && v > 0);

    const best = candidates.length ? Math.floor(Math.max(...candidates)) : undefined;
    return best != null ? Math.max(1, best) : 100; // default 100, never below 1
  }

  // Load owned shares for the horses currently in the cart (for renewal caps)
  const loadOwnedSharesForCartItems = useCallback(async (itemsList) => {
    try {
      const itemHorseIds = [
        ...new Set(
          (itemsList || [])
            .map((it) => it.display_horse_id || it.horse_id)
            .filter(Boolean)
        ),
      ];
      if (!itemHorseIds.length) {
        setOwnedByHorse({});
        return;
      }

      const { data: sess } = await supabase.auth.getSession();
      const userId = sess?.session?.user?.id;
      if (!userId) {
        setOwnedByHorse({});
        return;
      }

      const { data: rows, error } = await supabase
        .from("ownerships")
        .select("horse_id, shares")
        .eq("user_id", userId)
        .in("horse_id", itemHorseIds);

      if (error) {
        console.error("[cart] ownerships load error:", error);
        setOwnedByHorse({});
        return;
      }

      const map = Object.fromEntries((rows || []).map((r) => [r.horse_id, Number(r.shares || 0)]));
      setOwnedByHorse(map);
    } catch (e) {
      console.error("[cart] ownerships load failed:", e);
      setOwnedByHorse({});
    }
  }, []);

  // Load cart
  const loadCart = useCallback(async () => {
    try {
      setErrMsg("");
      setLoading(true);
      const { cart, items, horses, subtotalCents } = await cartApi.getCartWithItems();
      setCart(cart);
      setItems(items);
      setHorses(horses);
      setSubtotalCents(subtotalCents);
      await loadOwnedSharesForCartItems(items);
    } catch (e) {
      console.error("[cart] load error:", e);
      setErrMsg(e?.message || "Failed to load your basket.");
      setCart(null);
      setItems([]);
      setHorses({});
      setSubtotalCents(0);
      setOwnedByHorse({});
    } finally {
      setLoading(false);
    }
  }, [loadOwnedSharesForCartItems]);

  // Load wallet
  const loadWallet = useCallback(async () => {
    try {
      setWalletLoading(true);
      const balanceCents = await cartApi.getWalletBalance();
      setWalletCents(balanceCents);
    } catch (e) {
      console.error("[wallet] load error:", e);
      setWalletCents(0);
    } finally {
      setWalletLoading(false);
    }
  }, []);

  // Initial loads
  useEffect(() => {
    loadCart();
    loadWallet();
  }, [loadCart, loadWallet]);

  // Live updates
  useEffect(() => {
    const channel = supabase
      .channel("cart-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cart_items" },
        () => loadCart()
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [loadCart]);

  // Qty change with caps
  async function onQtyChange(itemId, newQty) {
    try {
      const theItem = items.find((x) => x.id === itemId);
      if (!theItem) return;

      const horseId = theItem.display_horse_id || theItem.horse_id || null;
      const horse = horseId ? horses[horseId] : null;

      let maxAllowed = 100;
      if (theItem.item_type === "renewal" && horseId) {
        maxAllowed = Math.max(1, Number(ownedByHorse[horseId] || 0));
      } else if (theItem.item_type === "share") {
        maxAllowed = getHorseAvailable(horse);
      }

      const n = Math.min(Math.max(1, Number(newQty || 1)), maxAllowed);

      if (n !== Number(newQty)) {
        alert(
          `The maximum you can ${
            theItem.item_type === "renewal" ? "renew" : "buy"
          } for ${horse?.name || "this horse"} is ${maxAllowed}.`
        );
      }

      await cartApi.updateCartItemQty(itemId, n);
      await loadCart();
    } catch (e) {
      console.error("[cart] qty change failed:", e);
      alert(e?.message || "Could not update quantity.");
    }
  }

  async function onRemove(itemId) {
    if (!window.confirm("Remove this item from your basket?")) return;
    try {
      await cartApi.removeCartItem(itemId);
      await loadCart();
    } catch (e) {
      console.error("[cart] remove failed:", e);
      alert(e?.message || "Could not remove item.");
    }
  }

  /* ---------- Wallet logic ---------- */
  const maxWalletUsableCents = Math.min(walletCents, subtotalCents);
  const totalCents = Math.max(0, subtotalCents - walletApplyCents);

  function parseGBPToCents(input) {
    const cleaned = String(input).replace(/,/g, ".").replace(/[^\d.]/g, "");
    if (cleaned === "" || cleaned === "." || cleaned === "..") return 0;
    const val = Number(cleaned);
    if (!Number.isFinite(val) || val < 0) return 0;
    return Math.round(val * 100);
  }

  useEffect(() => {
    // default to max usable until user edits
    if (!userEditedWallet.current) {
      setWalletApplyCents(maxWalletUsableCents);
      setWalletApplyInput((maxWalletUsableCents / 100).toFixed(2));
    } else {
      // clamp user input if subtotal/wallet changed
      setWalletApplyCents((prev) => {
        const clamped = Math.min(prev, maxWalletUsableCents);
        if (clamped !== prev) {
          setWalletApplyInput((clamped / 100).toFixed(2));
        }
        return clamped;
      });
    }
  }, [maxWalletUsableCents]);

  function onWalletInputChange(e) {
    userEditedWallet.current = true;
    const val = e.target.value;
    if (/^[\d.,]*$/.test(val)) setWalletApplyInput(val);
  }

  function commitWalletInput() {
    const cents = parseGBPToCents(walletApplyInput);
    const clamped = Math.min(Math.max(0, cents), maxWalletUsableCents);
    setWalletApplyCents(clamped);
    setWalletApplyInput((clamped / 100).toFixed(2));
  }

  function onWalletInputKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitWalletInput();
      e.currentTarget.blur();
      e.currentTarget.focus();
    }
  }

  /* ---------- Checkout ---------- */
  async function handleCheckout() {
    try {
      setCheckingOut(true);

      // must be signed in (we are, but double-check)
      const { data: sess } = await supabase.auth.getSession();
      const user = sess?.session?.user;
      if (!user?.id) {
        alert("Please sign in to checkout.");
        window.location.href = "/my-paddock";
        return;
      }
      const userEmail = user.email || "";
      const userName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        "";

      // snapshot current cart items
      const snapshotItems = items.map((it) => ({
        horse_id: it.display_horse_id || it.horse_id,
        qty: Number(it.qty || 0),
        unit_price_cents: Number(it.unit_price_cents || 0),
        item_type: it.item_type,
      }));
      const uniqueHorseIds = [...new Set(snapshotItems.map((i) => i.horse_id).filter(Boolean))];

      const hasShares = snapshotItems.some((i) => i.item_type === "share");
      const hasRenewals = snapshotItems.some((i) => i.item_type === "renewal");

      // complete checkout (writes renewal responses etc.)
      const result = await cartApi.completeCheckout({
        walletAppliedCents: Number(walletApplyCents || 0),
      });

      // for renewal emails use returned lines (has renew_cycle_id)
      const receiptItems = Array.isArray(result?.items) ? result.items : [];

      // share email
      const shareLines = snapshotItems.filter((i) => i.item_type === "share");
      if (userEmail && shareLines.length) {
        try {
          await fetch("/api/send-purchase-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: userEmail,
              name: userName,
              buyerEmail: userEmail,
              horses: shareLines.map((it) => ({
                horseName: horses[it.horse_id]?.name || "Horse",
                qty: it.qty,
                pricePerShare: (it.unit_price_cents / 100).toFixed(2),
                total: ((it.unit_price_cents * it.qty) / 100).toFixed(2),
                label: "Share",
              })),
            }),
          }).catch(() => {});
        } catch {
          // ignore email errors
        }
      }

      // renewal emails
      const renewalReceiptLines = receiptItems.filter((it) => it.item_type === "renewal");
      if (userEmail && renewalReceiptLines.length) {
        for (const it of renewalReceiptLines) {
          const cycleId = it.renew_cycle_id;
          const sharesRenewed = Number(it.qty || 0);
          const pricePerShare = Number(it.unit_price_cents || 0) / 100;
          const lineTotal = pricePerShare * sharesRenewed;
          const horseName = it.horse_name || horses[it.horse_id]?.name || "Horse";

          try {
            await fetch("/api/send-renewal-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                to: userEmail,
                name: userName,
                horseName,
                renewCycleId: cycleId,
                sharesRenewed,
                pricePerShare,
                lineTotal,
                amount: lineTotal,
              }),
            }).catch(() => {});
          } catch {
            // ignore per-email failure
          }
        }
      }

      // store receipt & redirect
      const receipt = {
        when: new Date().toISOString(),
        items: snapshotItems,
        subtotalCents: Number(result?.subtotalCents || 0),
        walletUsedCents: Number(result?.walletUsedCents || 0),
        totalDueCents: Number(result?.totalDueCents || 0),
      };
      try {
        sessionStorage.setItem("lastCheckout", JSON.stringify(receipt));
      } catch {}

      const subtotalGBP = (receipt.subtotalCents / 100).toFixed(2);
      const walletGBP = (receipt.walletUsedCents / 100).toFixed(2);
      const paidGBP = (receipt.totalDueCents / 100).toFixed(2);

      if (hasShares && !hasRenewals) {
        if (uniqueHorseIds.length === 1) {
          const onlyHorseId = uniqueHorseIds[0];
          const qtyForHorse = snapshotItems
            .filter((i) => i.horse_id === onlyHorseId)
            .reduce((s, i) => s + i.qty, 0);

          window.location.href =
            `/purchase/success?horse=${encodeURIComponent(onlyHorseId)}&qty=${encodeURIComponent(
              qtyForHorse
            )}&subtotal=${subtotalGBP}&wallet=${walletGBP}&paid=${paidGBP}`;
          return;
        }
        const qsShares = new URLSearchParams({
          mode: "basket",
          items: String(snapshotItems.length),
          subtotal: subtotalGBP,
          wallet: walletGBP,
          paid: paidGBP,
        }).toString();
        window.location.href = `/purchase/success?${qsShares}`;
        return;
      }

      if (!hasShares && hasRenewals) {
        const qsRen = new URLSearchParams({
          subtotal: subtotalGBP,
          wallet: walletGBP,
          paid: paidGBP,
        }).toString();
        window.location.href = `/purchase/success-renewal?${qsRen}`;
        return;
      }

      const qsMix = new URLSearchParams({
        subtotal: subtotalGBP,
        wallet: walletGBP,
        paid: paidGBP,
      }).toString();
      window.location.href = `/purchase/success-mixed?${qsMix}`;
    } catch (e) {
      console.error("[checkout] failed:", e);
      alert(e?.message || "Checkout failed.");
    } finally {
      setCheckingOut(false);
    }
  }

  /* ---------- UI ---------- */
  return (
    <>
      <Head>
        <title>Basket | Premier Paddock Racing</title>
      </Head>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-extrabold text-green-900">Your Basket</h1>
          <Link href="/horses" className="text-green-800 hover:underline">
            ← Continue shopping
          </Link>
        </div>

        {loading ? (
          <p className="mt-6 text-gray-600">Loading your basket…</p>
        ) : errMsg ? (
          <div className="mt-6 rounded-md border p-4 bg-red-50 text-red-800">{errMsg}</div>
        ) : !items.length ? (
          <div className="mt-8 rounded-md border p-6 text-center">
            <p className="text-gray-700">Your basket is empty.</p>
            <p className="mt-3">
              <Link href="/horses" className="text-green-800 underline">
                Browse horses →
              </Link>
            </p>
          </div>
        ) : (
          <div className="mt-8 grid md:grid-cols-3 gap-6">
            {/* Items */}
            <section className="md:col-span-2 space-y-3">
              {items.map((it) => {
                const horseId = it.display_horse_id || it.horse_id || null;
                const h = horseId ? horses[horseId] || {} : {};
                const lineTotal = ((it.unit_price_cents || 0) * (it.qty || 0)) / 100;

                // Per-line cap
                const maxQty =
                  it.item_type === "renewal"
                    ? Math.max(1, Number(ownedByHorse[horseId] || 0))
                    : getHorseAvailable(h);

                // Make sure the <select> value never exceeds current cap
                const safeValue = Math.min(Number(it.qty || 1), maxQty);

                return (
                  <div key={it.id} className="rounded-lg border p-4 flex items-center gap-4">
                    <img
                      src={h.photo_url || "https://placehold.co/120x80?text=Horse"}
                      alt={h.name || "Horse"}
                      className="w-28 h-20 object-cover rounded border"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">
                        {h.name || "Horse"}{" "}
                        <span className="ml-2 text-xs rounded px-2 py-1 border bg-gray-50">
                          {it.item_type === "renewal" ? "Renewal" : "Share"}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        Share Price: {fmtGBP((it.unit_price_cents || 0) / 100)}
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <label className="text-sm">
                          Qty:&nbsp;
                          <select
                            className="border rounded px-2 py-1 text-sm"
                            value={safeValue}
                            onChange={(e) => onQtyChange(it.id, e.target.value)}
                          >
                            {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </label>

                        <button
                          onClick={() => onRemove(it.id)}
                          className="text-sm text-red-700 hover:underline"
                        >
                          Remove
                        </button>
                      </div>

                      {/* Helper text for caps */}
                      <div className="mt-1 text-xs text-gray-500">
                        {it.item_type === "renewal" && horseId
                          ? `Max ${Number(ownedByHorse[horseId] || 0)} (you own)`
                          : `Max ${getHorseAvailable(h)} available`}
                      </div>
                    </div>
                    <div className="text-right font-semibold">{fmtGBP(lineTotal)}</div>
                  </div>
                );
              })}
            </section>

            {/* Summary + Wallet */}
            <aside className="md:col-span-1">
              <div className="rounded-lg border p-4 bg-white shadow-sm space-y-3">
                <div className="flex justify-between text-sm text-gray-700">
                  <span>Subtotal</span>
                  <span>{fmtGBP(subtotalCents / 100)}</span>
                </div>

                {/* Wallet balance + choose how much to apply */}
                <div className="mt-2 rounded border p-3 bg-gray-50">
                  <div className="flex items-baseline justify-between">
                    <div className="text-sm text-gray-700">Wallet balance</div>
                    <div className="text-sm font-medium">
                      {walletLoading ? "—" : fmtGBP(walletCents / 100)}
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="block text-sm text-gray-700 mb-1">
                      Amount to apply (up to {fmtGBP(maxWalletUsableCents / 100)})
                    </label>

                    <div className="flex gap-2">
                      <span className="inline-flex items-center px-2 rounded border bg-white text-gray-600">
                        £
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        pattern="[\d.,]*"
                        value={walletApplyInput}
                        onChange={onWalletInputChange}
                        onBlur={commitWalletInput}
                        onKeyDown={onWalletInputKeyDown}
                        className="flex-1 border rounded px-3 py-2"
                        aria-label="Wallet amount to apply"
                        placeholder="0.00"
                      />
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          userEditedWallet.current = true;
                          setWalletApplyCents(0);
                          setWalletApplyInput("0.00");
                        }}
                        className="px-2 py-1 border rounded hover:bg-white"
                      >
                        None
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          userEditedWallet.current = true;
                          const half = Math.floor(maxWalletUsableCents / 2);
                          setWalletApplyCents(half);
                          setWalletApplyInput((half / 100).toFixed(2));
                        }}
                        className="px-2 py-1 border rounded hover:bg-white"
                      >
                        Half
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          userEditedWallet.current = true;
                          setWalletApplyCents(maxWalletUsableCents);
                          setWalletApplyInput((maxWalletUsableCents / 100).toFixed(2));
                        }}
                        className="px-2 py-1 border rounded hover:bg-white"
                      >
                        Max
                      </button>
                    </div>

                    <div className="mt-2 flex justify-between text-sm">
                      <span>Wallet credit applied</span>
                      <span className="text-emerald-700">
                        −{fmtGBP(walletApplyCents / 100)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between text-base font-semibold">
                  <span>Total</span>
                  <span>{fmtGBP(totalCents / 100)}</span>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={checkingOut}
                  className="mt-3 w-full px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-50"
                >
                  {checkingOut ? "Processing…" : "Proceed to checkout"}
                </button>
              </div>
            </aside>
          </div>
        )}
      </main>
    </>
  );
}