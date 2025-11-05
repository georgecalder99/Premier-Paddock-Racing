/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";
import cartApi from "../lib/cartClient";
import { supabase } from "../lib/supabaseClient";

/* ---------- money helper ---------- */
const fmtGBP = (n) =>
  `£${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/* ---------- PROMO HELPERS ---------- */
function pickActivePromos(nowISO, rows) {
  return (rows || []).filter((p) => {
    if (!p.enabled) return false;
    const startsOk = !p.start_at || p.start_at <= nowISO;
    const endsOk = !p.end_at || p.end_at >= nowISO;
    const hasNums = (p.quota || 0) > 0 && (p.min_shares_required || 0) > 0;
    return startsOk && endsOk && hasNums;
  });
}

/** Has THIS user already qualified for THIS promo before now?
 * This checks only the current user's purchases (RLS safe).
 */
async function didUserAlreadyQualifyForPromoForUser({ userId, horseId, promo, untilISO }) {
  if (!userId || !horseId || !promo) return false;

  let q = supabase
    .from("purchases")
    .select("id")
    .eq("user_id", userId)
    .eq("horse_id", horseId)
    .gte("qty", promo.min_shares_required)
    .limit(1);

  if (promo.start_at) q = q.gte("created_at", promo.start_at);
  if (promo.end_at) q = q.lte("created_at", promo.end_at);
  if (untilISO) q = q.lt("created_at", untilISO);

  const { data, error } = await q;
  if (error) {
    console.warn("[promo user check] error:", error);
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

function normalizePromoLabel({ quota, min, startAt, raw }) {
  const base = startAt
    ? `Next ${quota} who buy ${min} or more shares`
    : `First ${quota} who buy ${min} or more shares`;

  if (!raw || typeof raw !== "string") return base;
  let s = raw;
  s = s.replace(/≥\s*(\d+)/gi, (_m, n) => `${n} or more`);
  s = s.replace(/\b(\d+)\+\s*shares?\b/gi, (_m, n) => `${n} or more shares`);
  s = s.replace(/\bbuy\s+(\d+)(?!\s*or\s+more)\b/gi, (_m, n) => `buy ${n} or more`);
  s = s.replace(/\b(buy\s+\d+\s+or\s+more)(?!\s+shares)\b/gi, (_m, grp) => `${grp} shares`);
  s = s.replace(/\bshares\s+shares\b/gi, "shares").replace(/\bor more\s+or more\b/gi, "or more");
  return s;
}

/** Compute {claimed,left,active} for a given promo (unique users in window) */
async function computePromoClaims(horseId, promo) {
  let q = supabase
    .from("purchases")
    .select("user_id, qty, created_at")
    .eq("horse_id", horseId)
    .gte("qty", promo.min_shares_required);

  if (promo.start_at) q = q.gte("created_at", promo.start_at);
  if (promo.end_at) q = q.lte("created_at", promo.end_at);

  const { data: rows, error } = await q.order("created_at", { ascending: true });
  if (error) {
    console.warn("[promo claims] fetch error:", error);
    return { claimed: 0, left: promo.quota, active: true };
  }

  const seen = new Set();
  const ordered = [];
  for (const r of rows || []) {
    if (!seen.has(r.user_id)) {
      seen.add(r.user_id);
      ordered.push(r.user_id);
      if (ordered.length >= (promo.quota || 0)) break;
    }
  }
  const claimed = ordered.length;
  const left = Math.max(0, (promo.quota || 0) - claimed);
  return { claimed, left, active: left > 0 };
}

/** Has THIS user ever qualified for THIS promo already? */
async function didUserQualifyForPromo({ userId, horseId, promo, untilISO = null }) {
  if (!userId || !horseId || !promo) return { qualified: false };

  let q = supabase
    .from("purchases")
    .select("user_id, created_at")
    .eq("horse_id", horseId)
    .gte("qty", promo.min_shares_required)
    .order("created_at", { ascending: true });

  if (promo.start_at) q = q.gte("created_at", promo.start_at);
  if (promo.end_at) q = q.lte("created_at", promo.end_at);
  if (untilISO) q = q.lt("created_at", untilISO);

  const { data: rows, error } = await q;
  if (error) return { qualified: false };

  const seen = new Set();
  const ordered = [];
  for (const r of rows || []) {
    if (!seen.has(r.user_id)) {
      seen.add(r.user_id);
      ordered.push(r.user_id);
      if (ordered.length >= (promo.quota || 0)) break;
    }
  }
  const rank = ordered.indexOf(userId);
  const qualified = rank !== -1 && rank < (promo.quota || 0);
  return { qualified, rank: qualified ? rank + 1 : null, quota: promo.quota || 0 };
}

/* ---------- Lightweight Modal ---------- */
function Modal({ open, onClose, children, labelledBy }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      aria-modal="true"
      role="dialog"
      aria-labelledby={labelledBy}
    >
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* sheet */}
      <div className="relative z-[61] w-[min(640px,92vw)] rounded-xl border bg-white p-5 shadow-2xl">
        {children}
      </div>
    </div>
  );
}

/* ---------- Promo Issues Modal ---------- */
function PromoIssuesModal({ open, issues = [], onCancel, onProceed, loading }) {
  return (
    <Modal open={open} onClose={onCancel} labelledBy="promo-modal-title">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-amber-100 text-amber-700 grid place-items-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
          </svg>
        </div>
        <div className="min-w-0">
          <h3 id="promo-modal-title" className="text-lg font-semibold text-gray-900">
            Promotion check before checkout
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Some promotions in your basket may no longer apply:
          </p>

          <ul className="mt-3 space-y-2">
            {issues.map((i, idx) => (
              <li key={idx} className="rounded-lg border bg-amber-50 px-3 py-2">
                <div className="text-sm text-amber-900">
                  <span className="font-medium">{i.horseName}</span>
                  {i.reason === "full" ? (
                    <>: <strong>{i.label}</strong> is now full — you won’t qualify ({i.reward}).</>
                  ) : (
                    <>: add <strong>{i.needed}</strong> more share{i.needed === 1 ? "" : "s"} to qualify for <strong>{i.label}</strong> ({i.reward}).</>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded border text-gray-700 hover:bg-gray-50"
            >
              Go back
            </button>
            <button
              type="button"
              onClick={onProceed}
              disabled={loading}
              className="px-4 py-2 rounded bg-green-900 text-white hover:bg-green-950 disabled:opacity-50"
            >
              {loading ? "Continuing…" : "Continue anyway"}
            </button>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            You can adjust quantities to re-qualify, or continue without the promotion.
          </p>
        </div>
      </div>
    </Modal>
  );
}

/* =========================================================================
   Wrapper: auth gate only
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

  if (!checkedAuth) {
    return (
      <main className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-2xl md:text-3xl font-extrabold text-green-900">Your Basket</h1>
        <p className="mt-6 text-gray-600">Loading…</p>
      </main>
    );
  }

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
              ← Continue browsing
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

  return <CartInner />;
}

/* =========================================================================
   Inner cart: all cart logic + UI
=========================================================================== */
function CartInner() {
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState(null);
  const [items, setItems] = useState([]);
  const [horses, setHorses] = useState({});
  const [subtotalCents, setSubtotalCents] = useState(0);
  const [errMsg, setErrMsg] = useState("");

  // wallet
  const [walletCents, setWalletCents] = useState(0);
  const [walletLoading, setWalletLoading] = useState(true);
  const [walletApplyCents, setWalletApplyCents] = useState(0);
  const [walletApplyInput, setWalletApplyInput] = useState("0.00");
  const userEditedWallet = useRef(false);

  const [checkingOut, setCheckingOut] = useState(false);
  const isCheckingOutRef = useRef(false); // freeze realtime + UI during checkout

  // owned shares caps
  const [ownedByHorse, setOwnedByHorse] = useState({});

  // promos
  const [promoByHorse, setPromoByHorse] = useState({});
  const promosCacheRef = useRef({});

  // promo modal state
  const [promoModalOpen, setPromoModalOpen] = useState(false);
  const [promoIssuesList, setPromoIssuesList] = useState([]);
  const [proceedingFromModal, setProceedingFromModal] = useState(false);

  // first-load guards + stale request guard
  const reqSeqRef = useRef(0);

  // ------- helpers -------
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
    return best != null ? Math.max(1, best) : 100;
  }

  // instant local recompute of promo status using cached promos + current items
  const recomputePromosLocally = useCallback(
    (itemsList = items) => {
      const perHorse = {};
      const cache = promosCacheRef.current || {};

      // count planned shares per horse
      const plannedByHorse = {};
      for (const it of itemsList || []) {
        const hid = it.display_horse_id || it.horse_id;
        if (!hid || it.item_type !== "share") continue;
        plannedByHorse[hid] = (plannedByHorse[hid] || 0) + Number(it.qty || 0);
      }

      Object.values(cache).forEach((p) => {
        if (p.__suppressForUser) return;

        const qtyPlanned = plannedByHorse[p.horse_id] || 0;
        const claims = p.__claims || { claimed: 0, left: p.quota, active: true };

        let status = "none";
        let needed = 0;

        if (!claims.active || claims.left <= 0) {
          status = "sold_out";
        } else if (qtyPlanned >= (p.min_shares_required || 0)) {
          status = "qualifies";
        } else {
          status = "needs_more";
          needed = Math.max(0, (p.min_shares_required || 0) - qtyPlanned);
        }

        perHorse[p.horse_id] = {
          promo: p,
          claims,
          status,
          needed,
          label: normalizePromoLabel({
            quota: p.quota,
            min: p.min_shares_required,
            startAt: p.start_at,
            raw: p.label,
          }),
          reward: p.reward || "Bonus reward",
          suppress: !!p.__suppressForUser,
        };
      });

      setPromoByHorse(perHorse);
    },
    [items]
  );

  function plannedQtyForHorse(horseId) {
    return (items || [])
      .filter((it) => (it.display_horse_id || it.horse_id) === horseId && it.item_type === "share")
      .reduce((s, it) => s + Number(it.qty || 0), 0);
  }

  // load owned caps
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

  // load promos for horses in cart (fills cache + instant recompute)
  const loadPromosForCartItems = useCallback(async () => {
    try {
      const horseIds = [
        ...new Set((items || []).map((it) => it.display_horse_id || it.horse_id).filter(Boolean)),
      ];
      if (!horseIds.length) {
        promosCacheRef.current = {};
        setPromoByHorse({});
        return;
      }

      const { data: sess } = await supabase.auth.getSession();
      const userId = sess?.session?.user?.id || null;

      const nowISO = new Date().toISOString();
      const { data: promos, error } = await supabase
        .from("promotions")
        .select("id,horse_id,enabled,quota,min_shares_required,start_at,end_at,label,reward")
        .in("horse_id", horseIds)
        .eq("enabled", true);

      if (error) {
        console.warn("[cart promos] fetch err:", error);
        promosCacheRef.current = {};
        setPromoByHorse({});
        return;
      }

      const active = pickActivePromos(nowISO, promos || []);

      const cache = {};
      for (const p of active) {
        const claims = await computePromoClaims(p.horse_id, p);

        // hide promo if THIS user already qualified before now
        const suppressForUser =
          userId
            ? await didUserAlreadyQualifyForPromoForUser({
                userId,
                horseId: p.horse_id,
                promo: p,
                untilISO: nowISO,
              })
            : false;

        cache[p.horse_id] = { ...p, __claims: claims, __suppressForUser: suppressForUser };
      }
      promosCacheRef.current = cache;

      // instantly rebuild
      recomputePromosLocally(items);
    } catch (e) {
      console.error("[cart promos] load failed:", e);
      promosCacheRef.current = {};
      setPromoByHorse({});
    }
  }, [items, recomputePromosLocally]);

  // final promo verification before checkout (now used to populate modal)
  const verifyPromosAtCheckout = useCallback(async () => {
    try {
      const horseIds = [
        ...new Set(
          (items || [])
            .filter((it) => it.item_type === "share")
            .map((it) => it.display_horse_id || it.horse_id)
            .filter(Boolean)
        ),
      ];
      if (!horseIds.length) return [];

      const nowISO = new Date().toISOString();
      const { data: promos, error } = await supabase
        .from("promotions")
        .select("id,horse_id,enabled,quota,min_shares_required,start_at,end_at,label,reward")
        .in("horse_id", horseIds)
        .eq("enabled", true);

      if (error) {
        console.warn("[checkout promo verify] fetch err:", error);
        return [];
      }

      const active = pickActivePromos(nowISO, promos || []);
      const issues = [];

      const { data: sess } = await supabase.auth.getSession();
      const userId = sess?.session?.user?.id || null;

      for (const p of active) {
        // skip bothering if this user already qualified historically
        if (userId) {
          const { qualified } = await didUserQualifyForPromo({
            userId,
            horseId: p.horse_id,
            promo: p,
            untilISO: nowISO,
          });
          if (qualified) continue;
        }

        const hid = p.horse_id;
        const qtyPlanned = plannedQtyForHorse(hid);
        const claims = await computePromoClaims(hid, p);
        const qualifiesNow = qtyPlanned >= (p.min_shares_required || 0);

        if (!claims.active || claims.left <= 0) {
          issues.push({
            horseId: hid,
            horseName: horses[hid]?.name || "Horse",
            label: normalizePromoLabel({
              quota: p.quota,
              min: p.min_shares_required,
              startAt: p.start_at,
              raw: p.label,
            }),
            reward: p.reward || "Bonus reward",
            reason: "full",
          });
        } else if (!qualifiesNow) {
          const needed = Math.max(0, (p.min_shares_required || 0) - qtyPlanned);
          issues.push({
            horseId: hid,
            horseName: horses[hid]?.name || "Horse",
            label: normalizePromoLabel({
              quota: p.quota,
              min: p.min_shares_required,
              startAt: p.start_at,
              raw: p.label,
            }),
            reward: p.reward || "Bonus reward",
            reason: "needs_more",
            needed,
          });
        }
      }
      return issues;
    } catch (e) {
      console.error("[checkout promo verify] failed:", e);
      return [];
    }
  }, [items, horses]);

  // DROP-IN REPLACEMENT (no flicker initial load)
  const firstLoadRef = useRef(true);
  const loadCart = useCallback(
    async ({ soft = false } = {}) => {
      const reqId = ++reqSeqRef.current;
      try {
        setErrMsg("");
        if (!soft && firstLoadRef.current) setLoading(true);

        const { cart, items, horses, subtotalCents } = await cartApi.getCartWithItems();
        if (reqId !== reqSeqRef.current) return;

        setCart(cart);
        setItems(items);
        setHorses(horses);
        setSubtotalCents(subtotalCents);

        Promise.all([
          loadOwnedSharesForCartItems(items),
          loadPromosForCartItems()
        ]).catch(() => {});

        recomputePromosLocally(items);
      } catch (e) {
        console.error("[cart] load error:", e);
        setErrMsg(e?.message || "Failed to load your basket.");
        if (firstLoadRef.current) {
          setCart(null);
          setItems([]);
          setHorses({});
          setSubtotalCents(0);
          setOwnedByHorse({});
          setPromoByHorse({});
        }
      } finally {
        if (firstLoadRef.current) {
          setLoading(false);
          firstLoadRef.current = false;
        }
      }
    },
    [loadOwnedSharesForCartItems, loadPromosForCartItems, recomputePromosLocally]
  );

  // ---------- wallet (no flicker after first load) ----------
  const walletFirstLoad = useRef(true);
  const loadWallet = useCallback(async ({ soft = false } = {}) => {
    try {
      if (!soft && walletFirstLoad.current) setWalletLoading(true);
      const balanceCents = await cartApi.getWalletBalance();
      setWalletCents((prev) => (Number.isFinite(balanceCents) ? balanceCents : prev));
    } catch (e) {
      console.error("[wallet] load error:", e);
      if (walletFirstLoad.current) setWalletCents(0);
    } finally {
      if (walletFirstLoad.current) {
        setWalletLoading(false);
        walletFirstLoad.current = false;
      }
    }
  }, []);

  // ---------- initial loads ----------
  useEffect(() => {
    loadCart();
    loadWallet();
  }, [loadCart, loadWallet]);

  // Refresh promos when items change (instant local + soft refresh)
  useEffect(() => {
    recomputePromosLocally(items);
    const t = setTimeout(() => loadPromosForCartItems(), 300);
    return () => clearTimeout(t);
  }, [items, recomputePromosLocally, loadPromosForCartItems]);

  // Live updates without flicker (guard while checking out)
  useEffect(() => {
    const ch = supabase
      .channel("cart-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cart_items" },
        () => { if (!isCheckingOutRef.current) loadCart({ soft: true }); }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "purchases" },
        () => { if (!isCheckingOutRef.current) loadPromosForCartItems(); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "promotions" },
        () => { if (!isCheckingOutRef.current) loadPromosForCartItems(); }
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [loadCart, loadPromosForCartItems]);

  // ---------- optimistic qty change ----------
  async function onQtyChange(itemId, newQty) {
    const prevItems = items;
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

    const nextItems = prevItems.map((x) => (x.id === itemId ? { ...x, qty: n } : x));
    setItems(nextItems);
    recomputePromosLocally(nextItems);

    try {
      await cartApi.updateCartItemQty(itemId, n);
      loadCart({ soft: true });
    } catch (e) {
      console.error("[cart] qty change failed:", e);
      alert(e?.message || "Could not update quantity.");
      setItems(prevItems);
      recomputePromosLocally(prevItems);
    }
  }

  // remove line
  async function onRemove(itemId) {
    if (!window.confirm("Remove this item from your basket?")) return;
    try {
      await cartApi.removeCartItem(itemId);
      await loadCart({ soft: true });
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
    if (!userEditedWallet.current) {
      setWalletApplyCents(maxWalletUsableCents);
      setWalletApplyInput((maxWalletUsableCents / 100).toFixed(2));
    } else {
      setWalletApplyCents((prev) => {
        const clamped = Math.min(prev, maxWalletUsableCents);
        if (clamped !== prev) setWalletApplyInput((clamped / 100).toFixed(2));
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

  // Step 2: do the real checkout (called directly or from modal)
  async function continueCheckoutApproved() {
    try {
      isCheckingOutRef.current = true;
      setCheckingOut(true);

      const { data: sess } = await supabase.auth.getSession();
      const user = sess?.session?.user;
      if (!user?.id) {
        alert("Please sign in to checkout.");
        window.location.href = "/my-paddock";
        return;
      }

      const userEmail = user.email || "";
      const userName = user.user_metadata?.full_name || user.user_metadata?.name || "";

      const snapshotItems = items.map((it) => ({
        horse_id: it.display_horse_id || it.horse_id,
        qty: Number(it.qty || 0),
        unit_price_cents: Number(it.unit_price_cents || 0),
        item_type: it.item_type,
      }));
      const uniqueHorseIds = [...new Set(snapshotItems.map((i) => i.horse_id).filter(Boolean))];

      const hasShares = snapshotItems.some((i) => i.item_type === "share");
      const hasRenewals = snapshotItems.some((i) => i.item_type === "renewal");

      // record a cutoff so success pages can exclude THIS order from “prior” checks
      const promoCutoff = new Date().toISOString();
      try { sessionStorage.setItem("promoCutoff", promoCutoff); } catch {}

      const result = await cartApi.completeCheckout({
        walletAppliedCents: Number(walletApplyCents || 0),
      });

      const receiptItems = Array.isArray(result?.items) ? result.items : [];

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
        } catch {}
      }

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
          } catch {}
        }
      }

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

      // Navigate WITHOUT leaving a "back" entry to the now-empty basket
    

      if (hasShares && !hasRenewals) {
        if (uniqueHorseIds.length === 1) {
          const onlyHorseId = uniqueHorseIds[0];
          const qtyForHorse = snapshotItems
            .filter((i) => i.horse_id === onlyHorseId)
            .reduce((s, i) => s + i.qty, 0);

          window.location.replace(
            `/purchase/success?horse=${encodeURIComponent(onlyHorseId)}&qty=${encodeURIComponent(
              qtyForHorse
            )}&subtotal=${subtotalGBP}&wallet=${walletGBP}&paid=${paidGBP}`
          );
          return;
        }
        const qsShares = new URLSearchParams({
          mode: "basket",
          items: String(snapshotItems.length),
          subtotal: subtotalGBP,
          wallet: walletGBP,
          paid: paidGBP,
        }).toString();
        window.location.replace(`/purchase/success?${qsShares}`);
        return;
      }

      if (!hasShares && hasRenewals) {
        const qsRen = new URLSearchParams({
          subtotal: subtotalGBP,
          wallet: walletGBP,
          paid: paidGBP,
        }).toString();
        window.location.replace(`/purchase/success-renewal?${qsRen}`);
        return;
      }

      const qsMix = new URLSearchParams({
        subtotal: subtotalGBP,
        wallet: walletGBP,
        paid: paidGBP,
      }).toString();
      window.location.replace(`/purchase/success-mixed?${qsMix}`);
    } catch (e) {
      console.error("[checkout] failed:", e);
      alert(e?.message || "Checkout failed.");
    } finally {
      setCheckingOut(false);
      isCheckingOutRef.current = false;
    }
  }

  // Step 1: verify promos; if issues, open modal; otherwise continue directly
  async function handleCheckout() {
    try {
      const issues = await verifyPromosAtCheckout();
      if (issues.length) {
        setPromoIssuesList(issues);
        setPromoModalOpen(true);
        return;
      }
      // all good — go straight to checkout
      await continueCheckoutApproved();
    } catch (e) {
      console.error("[checkout verify] failed:", e);
      await continueCheckoutApproved(); // fail-open so the user isn’t stuck
    }
  }

  // ---------- UI ----------

  return (
    <>
      <Head>
        <title>Basket | Premier Paddock Racing</title>
      </Head>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-extrabold text-green-900">Your Basket</h1>
          <Link href="/horses" className="text-green-800 hover:underline">
            ← Continue browsing
          </Link>
        </div>

        {checkingOut ? (
          <div className="mt-8 rounded-md border p-6 text-center">
            <p className="text-gray-700">Processing your order…</p>
            <p className="text-sm text-gray-500 mt-2">Please don’t refresh or close this tab.</p>
          </div>
        ) : loading ? (
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

                const maxQty =
                  it.item_type === "renewal"
                    ? Math.max(1, Number(ownedByHorse[horseId] || 0))
                    : getHorseAvailable(h);

                const safeValue = Math.min(Number(it.qty || 1), maxQty);

                const promoInfo = promoByHorse[horseId];
                const showPromo = it.item_type === "share" && horseId && promoInfo && !promoInfo.suppress;

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

                      <div className="mt-1 text-xs text-gray-500">
                        {it.item_type === "renewal" && horseId
                          ? `Max ${Number(ownedByHorse[horseId] || 0)} (you own)`
                          : `Max ${getHorseAvailable(h)} available`}
                      </div>

                      {/* Promo messaging (per horse, for share items only) */}
                      {showPromo ? <PromoNotice info={promoInfo} /> : null}
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
                        onChange={(e) => {
                          userEditedWallet.current = true;
                          const val = e.target.value;
                          if (/^[\d.,]*$/.test(val)) setWalletApplyInput(val);
                        }}
                        onBlur={() => {
                          const cents = parseInt(
                            (String(walletApplyInput).replace(/,/g, ".").replace(/[^\d.]/g, "") || "0")
                              .split(".")
                              .reduce((a, b) => (a * 100 + Number((b + "00").slice(0, 2))), 0),
                            10
                          );
                          const clamped = Math.min(Math.max(0, isNaN(cents) ? 0 : cents), maxWalletUsableCents);
                          setWalletApplyCents(clamped);
                          setWalletApplyInput((clamped / 100).toFixed(2));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const val = String(walletApplyInput).replace(/,/g, ".").replace(/[^\d.]/g, "");
                            const cents = Math.round((Number(val || 0)) * 100);
                            const clamped = Math.min(Math.max(0, isNaN(cents) ? 0 : cents), maxWalletUsableCents);
                            setWalletApplyCents(clamped);
                            setWalletApplyInput((clamped / 100).toFixed(2));
                            e.currentTarget.blur();
                            e.currentTarget.focus();
                          }
                        }}
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

                {/* Promotion summary (omits suppressed) */}
                {Object.keys(promoByHorse).length > 0 && (
                  <div className="rounded border p-3 bg-gray-50 space-y-1">
                    <div className="text-sm font-medium text-gray-800">Promotion status</div>
                    {Object.entries(promoByHorse).map(([hid, inf]) => {
                      if (inf?.suppress) return null; // hide if user already qualified
                      const nm = horses[hid]?.name || "Horse";
                      if (inf.status === "qualifies") {
                        return (
                          <div key={hid} className="text-xs text-emerald-800">
                            ✅ <strong>{nm}</strong>: qualifies — {inf.reward} ({Math.max(0, inf.claims.left)} left)
                          </div>
                        );
                      }
                      if (inf.status === "needs_more") {
                        return (
                          <div key={hid} className="text-xs text-amber-800">
                            ⚠️ <strong>{nm}</strong>: add {inf.needed} more to qualify ({Math.max(0, inf.claims.left)} left)
                          </div>
                        );
                      }
                      return (
                        <div key={hid} className="text-xs text-gray-700">
                          ℹ️ <strong>{nm}</strong>: promo full
                        </div>
                      );
                    })}
                  </div>
                )}

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

      {/* ---- Promo issues modal ---- */}
      <PromoIssuesModal
        open={promoModalOpen}
        issues={promoIssuesList}
        loading={proceedingFromModal}
        onCancel={() => setPromoModalOpen(false)}
        onProceed={async () => {
          try {
            setProceedingFromModal(true);
            setPromoModalOpen(false);
            await continueCheckoutApproved();
          } finally {
            setProceedingFromModal(false);
          }
        }}
      />
    </>
  );
}

/* ---------- Small UI component for per-line promo notice ---------- */
function PromoNotice({ info }) {
  const { status, needed, label, reward, claims } = info || {};
  if (!info) return null;

  if (status === "qualifies") {
    return (
      <div className="mt-2 text-xs rounded-md border border-emerald-300 bg-emerald-50 text-emerald-900 px-2 py-1">
        ✅ You currently qualify for this promotion: <strong>{label}</strong> — {reward}.{" "}
        <span className="text-emerald-800">
          {Math.max(0, claims.left)} left. Qualification is confirmed on successful checkout. Please note you can only qualify once.
        </span>
      </div>
    );
  }

  if (status === "needs_more") {
    return (
      <div className="mt-2 text-xs rounded-md border border-amber-300 bg-amber-50 text-amber-900 px-2 py-1">
        ⚠️ You are <strong>{needed}</strong> share{needed === 1 ? "" : "s"} away from: <strong>{label}</strong> — {reward}.{" "}
        <span className="text-amber-800">
          {Math.max(0, claims.left)} left. First come, first served at checkout. Please note you can only qualify once.
        </span>
      </div>
    );
  }

  return (
    <div className="mt-2 text-xs rounded-md border border-gray-300 bg-gray-50 text-gray-700 px-2 py-1">
     ℹ️ This promotion has reached its limit — you won&apos;t qualify ({label}).
    </div>
  );
}