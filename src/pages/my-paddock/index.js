// src/pages/my-paddock/index.js

/* eslint-disable @next/next/no-img-element */
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import Head from "next/head";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";
import cartApi from "../../lib/cartClient";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";

// Confetti must be client-only
const Confetti = dynamic(() => import("react-confetti"), { ssr: false });

/* =============================
   small util
============================= */
function useWindowSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (typeof window === "undefined") return;
    function onResize() {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return size;
}

/* =============================
   admin helper
============================= */
const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function useIsAdmin(session) {
  const email = session?.user?.email?.toLowerCase()?.trim();
  return Boolean(email && ADMIN_EMAILS.includes(email));
}

/* =============================
   Profile card
============================= */

function ProfileDetailsCard({ session, onSaved }) {
  const [fullName, setFullName] = useState(
    session?.user?.user_metadata?.full_name ||
      session?.user?.user_metadata?.name ||
      ""
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // If the session changes (e.g. user logs in/out), keep the field in sync
  useEffect(() => {
    setFullName(
      session?.user?.user_metadata?.full_name ||
        session?.user?.user_metadata?.name ||
        ""
    );
  }, [session]);

  async function saveName(e) {
    e.preventDefault();
    const clean = (fullName || "").trim();

    if (!clean) {
      setMsg("❌ Please enter your full name");
      return;
    }

    try {
      setSaving(true);
      setMsg("");
      const { error } = await supabase.auth.updateUser({
        data: { full_name: clean },
      });
      if (error) throw error;

      setMsg("✅ Saved");
      onSaved?.(clean); // let parent update greeting/hide card if needed
    } catch (err) {
      setMsg("❌ " + (err?.message || "Could not save"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-white rounded-xl border p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-green-900">Your details</h3>
      <form onSubmit={saveName} className="mt-3 flex gap-3 items-end">
        <label className="flex-1 text-sm">
          Full name
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. John Smith"
            className="mt-1 w-full border rounded px-3 py-2
                       bg-white text-gray-900 placeholder-gray-400 border-gray-300
                       dark:bg-neutral-800 dark:text-gray-100 dark:placeholder-gray-400 dark:border-white/10"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-green-900 text-white rounded disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
      {msg ? <p className="text-sm mt-2">{msg}</p> : null}
    </section>
  );
}


/* ============================================================================
   PAGE
============================================================================ */
export default function MyPaddock() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState("");

  // UI
  const [activeTab, setActiveTab] = useState("owned"); // owned | wallet | ballots | voting | updates | renew

  // Data
  const [loadingOwned, setLoadingOwned] = useState(false);
  const [owned, setOwned] = useState([]); // [{ shares, horse: {...} }]
  const [ownedHorseIds, setOwnedHorseIds] = useState([]); // [uuid]

  // NEW: hide details card once a name exists or once saved
  const [hideDetails, setHideDetails] = useState(false);

  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/my-paddock` : undefined;

  // --- Auth bootstrap ---
  useEffect(() => {
    async function init() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        setSession(data.session ?? null);
      } catch (e) {
        setErr(e.message || "Auth init failed");
      } finally {
        setReady(true);
      }
    }
    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) =>
      setSession(s)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  // --- Load owned horses for this user (2-step to avoid join issues) ---
  useEffect(() => {
    async function loadOwned() {
      if (!session) return;
      setLoadingOwned(true);
      try {
        // 1) Ownerships for this user
        const { data: owns, error: ownsErr } = await supabase
          .from("ownerships")
          .select("horse_id, shares")
          .eq("user_id", session.user.id);

        if (ownsErr) throw ownsErr;

        if (!owns || owns.length === 0) {
          setOwned([]);
          setOwnedHorseIds([]);
          setLoadingOwned(false);
          return;
        }

        const ids = owns.map((o) => o.horse_id);
        setOwnedHorseIds(ids);

        // 2) Fetch horses for those ids
        const { data: horses, error: horsesErr } = await supabase
          .from("horses")
          .select("id, name, trainer, specialty, share_price, photo_url")
          .in("id", ids);

        if (horsesErr) throw horsesErr;

        const byId = Object.fromEntries((horses || []).map((h) => [h.id, h]));
        const merged = owns
          .map((o) => ({ shares: o.shares, horse: byId[o.horse_id] }))
          .filter((m) => m.horse);

        setOwned(merged);
      } catch (e) {
        console.error("My Paddock load error:", e);
        setErr("We couldn’t load your horses. Please try again.");
        setOwned([]);
        setOwnedHorseIds([]);
      } finally {
        setLoadingOwned(false);
      }
    }
    loadOwned();
  }, [session]);

  // Display name & hasName helpers
  const hasName =
    Boolean(session?.user?.user_metadata?.full_name?.trim()) ||
    Boolean(session?.user?.user_metadata?.name?.trim());

  const displayName =
    session?.user?.user_metadata?.full_name ||
    session?.user?.user_metadata?.name ||
    (session?.user?.email?.split("@")[0] || "Owner");

  const isAdmin = useIsAdmin(session);

  if (!ready) {
    return (
      <main className="max-w-5xl mx-auto px-6 py-12">
        <p className="animate-pulse text-gray-600">Loading…</p>
      </main>
    );
  }

  if (!session) {
    return (
      <>
        <Head>
          <title>My Paddock | Premier Paddock Racing</title>
          <meta
            name="description"
            content="Log in to your Premier Paddock Racing account to view owned horses, ballots and wallet."
          />
        </Head>

        <main className="max-w-md mx-auto px-6 py-12">
          <h1 className="text-3xl font-bold mb-2 text-green-900">My Paddock</h1>
          <p className="text-gray-700 mb-6">
            Please sign in to access your owner dashboard.
          </p>
          {err && <p className="text-red-600 mb-3">Error: {err}</p>}
          <Auth
  supabaseClient={supabase}
  appearance={{
    theme: ThemeSupa,
    variables: {
      default: {
        colors: {
          brand: '#14532d',
          inputText: '#111827',
          inputBackground: '#ffffff',
          inputBorder: '#d1d5db',
          messageText: '#111827',
        },
      },
    },
  }}
  providers={[]}
  redirectTo={redirectTo}
/>
        </main>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>My Paddock | Premier Paddock Racing</title>
        <meta
          name="description"
          content="Your Premier Paddock Racing dashboard: owned horses, ballots, voting and updates."
        />
      </Head>

<main className="max-w-7xl mx-auto px-6 py-10 dark:bg-neutral-950 dark:text-gray-100">
        {/* Header / Actions */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-green-900">My Paddock</h1>
            <p className="text-gray-600">
              Welcome back, <strong>{displayName}</strong>
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/horses"
              className="px-4 py-2 rounded-lg border text-green-900 hover:bg-gray-50"
            >
              Browse Horses
            </Link>
            <button
              onClick={() => supabase.auth.signOut()}
              className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Profile card — only show if no name yet and not hidden */}
        {!hideDetails && !hasName && (
          <div className="mt-8">
            <ProfileDetailsCard
              session={session}
              onSaved={(newName) => {
                // Hide the card
                setHideDetails(true);
                // Update local session so header uses the new name immediately
                setSession((prev) =>
                  prev
                    ? {
                        ...prev,
                        user: {
                          ...prev.user,
                          user_metadata: {
                            ...prev.user.user_metadata,
                            full_name: newName,
                          },
                        },
                      }
                    : prev
                );
              }}
            />
          </div>
        )}

        {/* Summary Cards */}
        <section className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard label="Horses owned" value={owned.length} />
          <StatCard
            label="Total shares"
            value={owned.reduce((sum, o) => sum + (o.shares || 0), 0)}
          />
        </section>

        {/* Sticky Sub-Nav */}
        <section className="mt-8 sticky top-0 z-20 bg-white/90 dark:bg-neutral-950/90 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-neutral-950/60 border-b border-gray-200 dark:border-white/10">
          <div className="max-w-7xl mx-auto flex gap-2 px-1 py-2 overflow-x-auto">
            <TabButton id="owned" activeTab={activeTab} setActiveTab={setActiveTab}>
              Owned Horses
            </TabButton>
            <TabButton id="wallet" activeTab={activeTab} setActiveTab={setActiveTab}>
              Wallet
            </TabButton>
            <TabButton id="ballots" activeTab={activeTab} setActiveTab={setActiveTab}>
              Ballots
            </TabButton>
            <TabButton id="voting" activeTab={activeTab} setActiveTab={setActiveTab}>
              Voting
            </TabButton>
            <TabButton id="updates" activeTab={activeTab} setActiveTab={setActiveTab}>
              Updates
            </TabButton>
            <TabButton id="renew" activeTab={activeTab} setActiveTab={setActiveTab}>
              Renew
            </TabButton>
          </div>
        </section>

        {/* Tab Panels (keep your existing sections below) */}
        <section className="mt-6">
          {activeTab === "owned" && (
            <OwnedTab loading={loadingOwned} owned={owned} goTab={setActiveTab} />
          )}
          {activeTab === "wallet" && <WalletTab />}
          {activeTab === "ballots" && (
            <BallotsSection userId={session.user.id} ownedHorseIds={ownedHorseIds} />
          )}
          {activeTab === "voting" && (
            <VotingSection
              userId={session.user.id}
              ownedHorseIds={ownedHorseIds}
              isAdmin={isAdmin}
            />
          )}
          {activeTab === "updates" && <UpdatesTab ownedHorseIds={ownedHorseIds} />}
          {activeTab === "renew" && (
  <RenewTab
    userId={session.user.id}
    owned={owned}
    userEmailProp={session.user.email}
    displayNameProp={
      session.user?.user_metadata?.full_name ||
      session.user?.user_metadata?.name ||
      (session.user?.email?.split("@")[0] || "Owner")
    }
  />
)}
        </section>
      </main>
    </>
  );
}

/* ======= keep your existing helper components below (TabButton, StatCard, OwnedTab, WalletTab, BallotsSection, VotingSection, UpdatesTab, RenewTab, etc.) ======= */

/* ===========================
   Small UI helpers (unchanged)
=========================== */
function TabButton({ id, activeTab, setActiveTab, children }) {
  const isActive = activeTab === id;
  return (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-4 py-2 rounded-lg border transition
        ${isActive
          ? "bg-green-900 text-white border-green-900"
          : "bg-white text-green-900 border-gray-200 hover:bg-gray-50 dark:bg-neutral-900 dark:text-green-300 dark:border-white/10 dark:hover:bg-neutral-800"}`}
      aria-pressed={isActive}
      aria-controls={`panel-${id}`}
    >
      {children}
    </button>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm dark:bg-neutral-900 dark:border-white/10">
      <div className="text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-1 text-2xl font-extrabold text-green-900 dark:text-green-300">{value}</div>
    </div>
  );
}

/* ===========================
   Owned Tab (unchanged)
=========================== */
function OwnedTab({ loading, owned, goTab }) {
  return (
    <div id="panel-owned">
      <h2 className="text-2xl font-bold text-green-900 mb-4">Owned horses</h2>

      {loading && <p className="text-gray-600">Loading your horses…</p>}

      {!loading && owned.length === 0 && (
       <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-neutral-900 dark:border-white/10">
          <p className="text-gray-700">
            You don’t own any horses yet.{" "}
            <Link href="/horses" className="text-green-700 underline">
              Browse available horses
            </Link>
            .
          </p>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {owned.map((o) => (
         <article key={o.horse.id} className="bg-white rounded-lg shadow p-4 dark:bg-neutral-900 dark:border-white/10">
            <img
              src={o.horse.photo_url || "https://placehold.co/640x400?text=Horse"}
              alt={o.horse.name}
              className="w-full h-44 object-cover rounded"
            />
            <h3 className="mt-3 font-semibold text-lg">{o.horse.name}</h3>
            <p className="text-sm text-gray-500">
              {o.horse.specialty || "—"} • Trainer: {o.horse.trainer || "—"}
            </p>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm">
                <span className="font-medium">Shares owned:</span> {o.shares}
              </span>
              <span className="text-sm">
                <span className="font-medium">Share price:</span>{" "}
                {o.horse.share_price ? `£${o.horse.share_price}` : "—"}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="flex-1 px-3 py-2 text-sm rounded border hover:bg-gray-50"
                onClick={() => {
                  goTab("updates");
                  setTimeout(() => {
                    document
                      .getElementById("panel-updates")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }, 0);
                }}
              >
                View Updates
              </button>

              <button
                className="flex-1 px-3 py-2 text-sm rounded border hover:bg-gray-50"
                onClick={() => {
                  goTab("ballots");
                  setTimeout(() => {
                    document
                      .getElementById("panel-ballots")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }, 0);
                }}
              >
                View Ballots
              </button>

              <button
                className="flex-1 px-3 py-2 text-sm rounded border hover:bg-gray-50"
                onClick={() => {
                  goTab("voting");
                  setTimeout(() => {
                    document
                      .getElementById("panel-voting")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }, 0);
                }}
              >
                View Voting
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

/* ===========================
   BALLOTS SECTION (weighted entries by shares)
=========================== */
function BallotsSection({ userId, ownedHorseIds }) {
  const [sub, setSub] = useState("open"); // open | results
  return (
    <div id="panel-ballots">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h2 className="text-2xl font-bold text-green-900">Ballots</h2>
        <div className="flex flex-wrap gap-2">
          <SubTab id="open" sub={sub} setSub={setSub}>Open ballots</SubTab>
          <SubTab id="results" sub={sub} setSub={setSub}>My results</SubTab>
        </div>
      </div>

      {sub === "open" && (
        <OpenBallots userId={userId} ownedHorseIds={ownedHorseIds} />
      )}
      {sub === "results" && <MyResults userId={userId} />}
    </div>
  );
}

function SubTab({ id, sub, setSub, children }) {
  const active = sub === id;
  return (
    <button
      onClick={() => setSub(id)}
      className={`px-3 py-2 rounded-lg border text-sm transition ${
        active
          ? "bg-green-900 text-white border-green-900"
          : "bg-white text-green-900 border-gray-200 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

/* ----- Open ballots (weighted by owned shares) ----- */
function OpenBallots({ userId, ownedHorseIds }) {
  const [loading, setLoading] = useState(true);
  const [openBallots, setOpenBallots] = useState([]);
  const [enteredBallots, setEnteredBallots] = useState(new Set()); // ballots I’ve entered
  const [entryTotals, setEntryTotals] = useState({});              // ballot_id -> SUM(weight) across ALL users (RPC)
  const [myUsedByBallot, setMyUsedByBallot] = useState({});        // ballot_id -> my used entries (weight)
  const [joining, setJoining] = useState({});                      // ballot_id -> bool
  const [horseNames, setHorseNames] = useState({});                // horse_id -> name
  const [mySharesByHorse, setMySharesByHorse] = useState({});      // horse_id -> my shares (>=1)

  useEffect(() => {
    async function load() {
      setLoading(true);

      if (!ownedHorseIds || ownedHorseIds.length === 0) {
        setOpenBallots([]);
        setEnteredBallots(new Set());
        setEntryTotals({});
        setMyUsedByBallot({});
        setHorseNames({});
        setMySharesByHorse({});
        setLoading(false);
        return;
      }

      // 1) Open ballots for owned horses
      const { data: ballots, error: ballotsErr } = await supabase
        .from("ballots")
        .select("id,horse_id,type,title,description,event_date,cutoff_at,max_winners,status")
        .eq("status", "open")
        .in("horse_id", ownedHorseIds)
        .order("cutoff_at", { ascending: true });

      if (ballotsErr) {
        console.error("[OpenBallots] ballots error:", ballotsErr);
        setOpenBallots([]);
        setLoading(false);
        return;
      }

      const list = ballots || [];
      setOpenBallots(list);

      const horseIds = Array.from(new Set(list.map(b => b.horse_id))).filter(Boolean);
      const ballotIds = list.map(b => b.id);

      // 2) Horse names
      if (horseIds.length) {
        const { data: horses } = await supabase
          .from("horses")
          .select("id,name")
          .in("id", horseIds);
        setHorseNames(Object.fromEntries((horses || []).map(h => [h.id, h.name])));
      } else {
        setHorseNames({});
      }

      // 3) My shares per horse (used as "available entries")
      let myShares = {};
      if (horseIds.length) {
        const { data: owns } = await supabase
          .from("ownerships")
          .select("horse_id, shares")
          .eq("user_id", userId)
          .in("horse_id", horseIds);
        myShares = Object.fromEntries(
          (owns || []).map(o => [o.horse_id, Math.max(1, Number(o.shares || 0))])
        );
      }
      setMySharesByHorse(myShares);

      // 4) My used entries per ballot (weight stored on my ballot_entries row)
      if (ballotIds.length) {
        const { data: entriesMine } = await supabase
          .from("ballot_entries")
          .select("ballot_id, weight")
          .eq("user_id", userId)
          .in("ballot_id", ballotIds);

        const usedMap = {};
        const entered = new Set();
        (entriesMine || []).forEach(r => {
          const used = Number.isFinite(Number(r.weight)) ? Number(r.weight) : 1;
          usedMap[r.ballot_id] = Math.max(0, used);
          entered.add(r.ballot_id);
        });
        setMyUsedByBallot(usedMap);
        setEnteredBallots(entered);
      } else {
        setMyUsedByBallot({});
        setEnteredBallots(new Set());
      }

      // 5) Total weighted entries across ALL users (RPC -> bypass RLS)
      if (ballotIds.length) {
        const { data: totals, error: rpcErr } = await supabase.rpc("ballot_totals", {
          p_ballot_ids: ballotIds
        });
        if (rpcErr) {
          console.warn("[OpenBallots] ballot_totals RPC error:", rpcErr);
          setEntryTotals({});
        } else {
          const map = Object.fromEntries(
            (totals || []).map(r => [r.ballot_id, Number(r.total_weight || 0)])
          );
          setEntryTotals(map);
        }
      } else {
        setEntryTotals({});
      }

      setLoading(false);
    }
    load();
  }, [userId, ownedHorseIds]);

  async function enter(ballotId) {
    setJoining(p => ({ ...p, [ballotId]: true }));
    try {
      // Prevent duplicate entry per user
      const { data: exists } = await supabase
        .from("ballot_entries")
        .select("id")
        .eq("ballot_id", ballotId)
        .eq("user_id", userId)
        .maybeSingle();
      if (exists) {
        alert("You're already entered.");
        return;
      }

      // Determine weight from my shares for this ballot's horse
      const b = openBallots.find(x => x.id === ballotId);
      const horseId = b?.horse_id || null;
      const available = horseId ? Math.max(1, Number(mySharesByHorse[horseId] || 1)) : 1;
      const weight = available; // one click uses all available entries

      // Insert the entry with weight; if weight column missing, fallback insert without it
      const { error: insertErr } = await supabase.from("ballot_entries").insert({
        ballot_id: ballotId,
        user_id: userId,
        weight
      });
      if (insertErr) {
        if (insertErr.code === "42703") {
          // weight column missing; fallback unweighted
          const { error: e2 } = await supabase.from("ballot_entries").insert({
            ballot_id: ballotId,
            user_id: userId
          });
          if (e2) throw e2;
        } else {
          throw insertErr;
        }
      }

      // Optimistic UI updates
      setEnteredBallots(prev => new Set([...prev, ballotId]));
      setMyUsedByBallot(prev => ({ ...prev, [ballotId]: weight }));
      setEntryTotals(prev => ({ ...prev, [ballotId]: (prev[ballotId] || 0) + weight }));
    } catch (e) {
      console.error("[OpenBallots] enter error:", e);
      alert("Could not enter ballot. Please try again.");
    } finally {
      setJoining(p => ({ ...p, [ballotId]: false }));
    }
  }

  if (loading) return <p>Loading ballots…</p>;
  if (openBallots.length === 0)
    return (
      <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-neutral-900 dark:border-white/10">
        <h3 className="font-semibold text-green-900">No open ballots for your horses</h3>
        <p className="text-sm text-gray-600 mt-1">We’ll notify you when new ballots open.</p>
      </div>
    );

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {openBallots.map((b) => {
        const entered = enteredBallots.has(b.id);
        const isClosedByTime = b.cutoff_at && new Date(b.cutoff_at).getTime() <= Date.now();
        const horseName = b.horse_id ? (horseNames[b.horse_id] || "—") : "—";

        const available = Math.max(1, Number(mySharesByHorse[b.horse_id] || 1)); // Available entries = shares
        const used = Math.min(available, Number(myUsedByBallot[b.id] || 0));     // Used entries = my weight recorded
        const totalWeighted = Number(entryTotals[b.id] || 0);                     // Total (all users, weighted)

        const typeLabel = b.type === "badge" ? "Owners’ badges" : "Stable visit";

        return (
          <article
            key={b.id}
            className="bg-white rounded-xl border p-6 shadow-sm dark:bg-neutral-900 dark:border-white/10"
          >
            {horseName && horseName !== "—" && (
              <h4 className="text-sm text-green-700 font-semibold mb-1">Horse: {horseName}</h4>
            )}

            <h3 className="text-lg font-semibold text-green-900">{b.title}</h3>

            <p className="text-sm text-gray-600 mt-1">
              {typeLabel}
              {b.event_date ? ` • Event: ${new Date(b.event_date).toLocaleDateString()}` : ""}
              {isClosedByTime ? " • Closed" : ""}
            </p>

            {b.description && <p className="text-sm text-gray-700 mt-2">{b.description}</p>}

            <div className="mt-3 text-sm font-semibold text-green-900">Ballot information</div>
            <div className="mt-1 text-xs text-gray-600">
              <div>Closes: <strong>{new Date(b.cutoff_at).toLocaleString()}</strong></div>
              {b.max_winners > 0 && <div>Winners: <strong>{b.max_winners}</strong></div>}
              <div>
                Available entries: <strong>{available}</strong>
                {"  •  "}
                Used entries: <strong>{used}</strong>
                {"  •  "}
                Total entries: <strong>{totalWeighted}</strong>
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => enter(b.id)}
                disabled={entered || isClosedByTime || joining[b.id]}
                className="px-4 py-2 bg-green-900 text-white rounded disabled:opacity-50"
                title={entered ? "Already entered" : isClosedByTime ? "Closed" : "Enter ballot"}
              >
                {entered ? "Entered" : isClosedByTime ? "Closed" : (joining[b.id] ? "Entering…" : "Enter ballot")}
              </button>
              {b.horse_id && (
                <Link
                  href={`/horses/${b.horse_id}`}
                  className="px-4 py-2 border rounded text-green-900 hover:bg-green-50"
                >
                  View horse
                </Link>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}


/* ----- My Results (unchanged display; draw logic should read weights server-side) ----- */
function MyResults({ userId }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]); // [{ ballot, result, horse }]
  const [revealed, setRevealed] = useState({}); // ballot_id -> bool
  const { width, height } = useWindowSize();

  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data: results, error: resErr } = await supabase
        .from("ballot_results")
        .select("ballot_id, result")
        .eq("user_id", userId);

      if (resErr) {
        console.error("[MyResults] results err:", resErr);
        setRows([]);
        setLoading(false);
        return;
      }

      const ids = Array.from(new Set((results || []).map((r) => r.ballot_id)));
      if (!ids.length) {
        setRows([]);
        setLoading(false);
        return;
      }

      const { data: ballots, error: ballotsErr } = await supabase
        .from("ballots")
        .select("id, title, type, event_date, cutoff_at, horse_id")
        .in("id", ids);

      if (ballotsErr) {
        console.error("[MyResults] ballots err:", ballotsErr);
        setRows([]);
        setLoading(false);
        return;
      }

      const horseIds = Array.from(new Set((ballots || []).map((b) => b.horse_id))).filter(Boolean);

      let horseMap = {};
      if (horseIds.length) {
        const { data: horses, error: hErr } = await supabase
          .from("horses")
          .select("id, name, photo_url")
          .in("id", horseIds);
        if (!hErr && horses) {
          horseMap = Object.fromEntries(horses.map((h) => [h.id, h]));
        }
      }

      const ballotById = Object.fromEntries((ballots || []).map((b) => [b.id, b]));

      const merged = (results || [])
        .map((r) => {
          const b = ballotById[r.ballot_id];
          if (!b) return null;
          return {
            ballot: b,
            result: r.result,
            horse: b.horse_id ? horseMap[b.horse_id] || null : null,
          };
        })
        .filter(Boolean)
        .sort((a, b) => new Date(b.ballot.cutoff_at).getTime() - new Date(a.ballot.cutoff_at).getTime());

      setRows(merged);
      setLoading(false);
    }

    load();
  }, [userId]);

  function toggleReveal(bid) {
    setRevealed((prev) => ({ ...prev, [bid]: !prev[bid] }));
  }

  if (loading) return <p>Loading results…</p>;

  if (!rows.length) {
    return (
      <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-neutral-900 dark:border-white/10">
        <h3 className="font-semibold text-green-900">No results yet</h3>
        <p className="text-sm text-gray-600 mt-1">
          When your ballots are drawn, results will appear here.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {rows.map(({ ballot: b, result, horse }) => {
        const isRevealed = revealed[b.id];
        const isWinner = result === "winner";
        const typeLabel = b.type === "badge" ? "Owners’ badges" : "Stable visit";

        return (
          <li key={b.id} className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3">
                {horse?.photo_url ? (
                  <img
                    src={horse.photo_url}
                    alt={horse.name || "Horse"}
                    className="w-14 h-14 rounded object-cover"
                  />
                ) : null}
                <div>
                  {horse?.name ? (
                    <h4 className="text-sm text-green-700 font-semibold mb-1">
                      Horse: {horse.name}
                    </h4>
                  ) : null}

                  <div className="font-medium">
                    {b.title}{" "}
                    <span className="text-xs text-gray-500">
                      ({typeLabel}) {b.event_date ? `• ${new Date(b.event_date).toLocaleDateString()}` : ""}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600">
                    Drawn • {new Date(b.cutoff_at).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {b.horse_id ? (
                  <Link
                    href={`/horses/${b.horse_id}`}
                    className="px-3 py-1 border rounded text-sm text-green-900 hover:bg-green-50"
                  >
                    View horse
                  </Link>
                ) : null}
                <button
                  onClick={() => toggleReveal(b.id)}
                  className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
                >
                  {isRevealed ? "Hide result" : "Reveal result"}
                </button>
              </div>
            </div>

            {isRevealed ? (
              <div className="mt-3 relative">
                {isWinner ? (
                  <>
                    <Confetti width={width} height={height} recycle={false} numberOfPieces={250} />
                    <WinCard />
                  </>
                ) : (
                  <LoseCard />
                )}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
/* ===========================
   VOTING SECTION
   Sub-tabs: open | results
=========================== */
function VotingSection({ userId, ownedHorseIds, isAdmin }) {
  const [sub, setSub] = useState("open"); // open | results
  return (
    <div id="panel-voting">
      <div className="mb-3">
        <h2 className="text-3xl font-extrabold text-green-900">Your horse, Your say</h2>
        <p className="text-sm text-gray-600">
          Cast your vote on key decisions. Results avaliable once vote is closed.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <SubTab id="open" sub={sub} setSub={setSub}>Open votes</SubTab>
        <SubTab id="results" sub={sub} setSub={setSub}>Results</SubTab>
      </div>

      {sub === "open" && (
        <OpenVotes userId={userId} ownedHorseIds={ownedHorseIds} />
      )}
      {sub === "results" && (
        <VoteResults userId={userId} ownedHorseIds={ownedHorseIds} isAdmin={isAdmin} />
      )}
    </div>
  );
}

/* ----- Open Votes (weighted; confirms submission) ----- */
function OpenVotes({ userId, ownedHorseIds }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [horseNames, setHorseNames] = useState({});
  const [rows, setRows] = useState([]); // [{vote, options, allocations, cap, used, submitted}]
  const [err, setErr] = useState("");

  // load open votes + options + my current weights + caps
  useEffect(() => {
    async function load() {
      setLoading(true);
      setErr("");

      if (!ownedHorseIds || ownedHorseIds.length === 0) {
        setRows([]);
        setHorseNames({});
        setLoading(false);
        return;
      }

      const nowIso = new Date().toISOString();

      const { data: openVotes } = await supabase
        .from("votes")
        .select("id, horse_id, title, description, status, cutoff_at, created_at")
        .eq("status", "open")
        .or(`horse_id.in.(${ownedHorseIds.join(",")}),horse_id.is.null`)
        .or(`cutoff_at.is.null,cutoff_at.gte.${nowIso}`)
        .order("created_at", { ascending: false })
        .limit(20);

      const votesList = openVotes || [];
      if (!votesList.length) {
        setRows([]);
        setHorseNames({});
        setLoading(false);
        return;
      }

      // horse names
      const horseIds = Array.from(new Set(votesList.map(v => v.horse_id).filter(Boolean)));
      if (horseIds.length) {
        const { data: horses } = await supabase.from("horses").select("id,name").in("id", horseIds);
        setHorseNames(Object.fromEntries((horses || []).map(h => [h.id, h.name])));
      } else {
        setHorseNames({});
      }

      // options
      const voteIds = votesList.map(v => v.id);
      const { data: allOptions } = await supabase
        .from("vote_options")
        .select("id, vote_id, label")
        .in("vote_id", voteIds);

      const optionsByVote = {};
      (allOptions || []).forEach(o => {
        (optionsByVote[o.vote_id] = optionsByVote[o.vote_id] || []).push(o);
      });

      // my allocations (weights)
      const { data: my } = await supabase
        .from("vote_responses")
        .select("vote_id, option_id, weight")
        .eq("user_id", userId)
        .in("vote_id", voteIds);

      const myByVote = {};
      (my || []).forEach(r => {
        (myByVote[r.vote_id] = myByVote[r.vote_id] || []).push(r);
      });

      // ownership for caps
      let ownsByHorse = {};
      if (horseIds.length) {
        const { data: owns } = await supabase
          .from("ownerships")
          .select("horse_id, shares")
          .eq("user_id", userId)
          .in("horse_id", horseIds);
        ownsByHorse = (owns || []).reduce((m, r) => {
          m[r.horse_id] = (m[r.horse_id] || 0) + Number(r.shares || 0);
          return m;
        }, {});
      }

      const next = votesList.map(v => {
        const opts = optionsByVote[v.id] || [];
        const alloc = (myByVote[v.id] || []).reduce((m, r) => {
          m[r.option_id] = Number(r.weight || 0);
          return m;
        }, {});
        const cap = v.horse_id ? (ownsByHorse[v.horse_id] || 0) : 0;
        const used = Object.values(alloc).reduce((s, n) => s + n, 0);

        return {
          vote: v,
          options: opts,
          allocations: alloc,
          cap,
          used,
          submitted: used > 0, // if they’ve previously saved anything, show as submitted
        };
      });

      setRows(next);
      setLoading(false);
    }
    load();
  }, [userId, ownedHorseIds]);

  // mark UI dirty when allocations change and keep cap respected
  const adjust = useCallback((voteId, optionId, delta) => {
    setRows(prev => prev.map(row => {
      if (row.vote.id !== voteId) return row;
      const cur = row.allocations[optionId] || 0;
      let newVal = Math.max(0, cur + delta);
      const newUsed = row.used - cur + newVal;
      if (newUsed > row.cap) newVal = cur + Math.max(0, row.cap - row.used);
      return {
        ...row,
        allocations: { ...row.allocations, [optionId]: newVal },
        used: row.used - cur + newVal,
        submitted: false, // something changed -> not yet saved
      };
    }));
  }, []);

  async function refreshOne(voteId) {
    // Pull canonical weights from DB and set submitted=true for that vote
    const { data: fresh } = await supabase
      .from("vote_responses")
      .select("option_id, weight")
      .eq("user_id", userId)
      .eq("vote_id", voteId);

    setRows(prev => prev.map(r => {
      if (r.vote.id !== voteId) return r;
      const alloc = (fresh || []).reduce((m, it) => {
        m[it.option_id] = Number(it.weight || 0);
        return m;
      }, {});
      const used = Object.values(alloc).reduce((s, n) => s + n, 0);
      return { ...r, allocations: alloc, used, submitted: used > 0 };
    }));
  }

  async function submitVote(voteId) {
    const row = rows.find(r => r.vote.id === voteId);
    if (!row) return;
    if (!row.cap) return alert("You’re not eligible to vote on this poll.");

    setSaving(p => ({ ...p, [voteId]: true }));
    setErr("");

    try {
      const entries = Object.entries(row.allocations);

      // Upsert all > 0
      const { data: existing } = await supabase
        .from("vote_responses")
        .select("id, option_id")
        .eq("user_id", userId)
        .eq("vote_id", voteId);

      const existingByOption = Object.fromEntries((existing || []).map(r => [r.option_id, r.id]));

      for (const [option_id, weight] of entries) {
        const w = Number(weight || 0);
        const id = existingByOption[option_id];

        if (w > 0 && id) {
          const { error } = await supabase.from("vote_responses").update({ weight: w }).eq("id", id);
          if (error) throw error;
        } else if (w > 0 && !id) {
          const { error } = await supabase.from("vote_responses").insert({
            vote_id: voteId,
            option_id,
            user_id: userId,
            weight: w,
          });
          if (error) throw error;
        } else if (w === 0 && id) {
          await supabase.from("vote_responses").delete().eq("id", id);
        }
      }

      await refreshOne(voteId); // pull canonical + set submitted=true
    } catch (e) {
      console.error("submitVote weighted error:", e);
      setErr(e.message || "Could not submit your votes.");
    } finally {
      setSaving(p => ({ ...p, [voteId]: false }));
    }
  }

  if (loading) return <p>Loading votes…</p>;
  if (rows.length === 0)
    return (
      <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-neutral-900 dark:border-white/10">
        <h3 className="font-semibold text-green-900">No open votes right now</h3>
        <p className="text-sm text-gray-600 mt-1">When a new vote opens, it will appear here.</p>
      </div>
    );

  return (
    <>
      {err && <p className="mb-3 text-sm text-red-700">{err}</p>}

      <div className="grid md:grid-cols-2 gap-6">
        {rows.map(({ vote: v, options, allocations, cap, used, submitted }) => {
          const closes = v.cutoff_at ? new Date(v.cutoff_at).toLocaleString() : null;
          const horseName = v.horse_id ? horseNames[v.horse_id] || "Unnamed horse" : null;
          const remaining = Math.max(0, cap - used);

          return (
            <article key={v.id} className="bg-white rounded-xl border p-6 shadow-sm">
              {horseName && (
                <h4 className="text-sm text-green-700 font-semibold mb-1">Horse: {horseName}</h4>
              )}
              <h3 className="text-lg font-semibold text-green-900">{v.title}</h3>
              {v.description && <p className="text-sm text-gray-700 mt-1">{v.description}</p>}
              {closes && (
                <p className="text-xs text-gray-600 mt-2">
                  Closes: <strong>{closes}</strong>
                </p>
              )}

              <div className="mt-3 space-y-2">
                {options.length === 0 ? (
                  <p className="text-sm text-gray-600">No options configured.</p>
                ) : (
                  options.map((opt) => {
                    const w = allocations[opt.id] || 0;
                    return (
                      <div key={opt.id} className="flex items-center justify-between gap-3">
                        <span className="text-sm">{opt.label}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="px-2 py-1 border rounded disabled:opacity-50"
                            onClick={() => adjust(v.id, opt.id, -1)}
                            disabled={w === 0}
                            aria-label="decrease vote amount"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-sm font-medium">{w}</span>
                          <button
                            type="button"
                            className="px-2 py-1 border rounded disabled:opacity-50"
                            onClick={() => adjust(v.id, opt.id, +1)}
                            disabled={remaining === 0}
                            aria-label="increase vote amount"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
                <span>Votes remaining: <strong>{remaining}</strong></span>
                <span className="opacity-80">Allocated: {used}</span>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={() => submitVote(v.id)}
                  disabled={saving[v.id] || cap === 0}
                  className="px-4 py-2 bg-green-900 text-white rounded disabled:opacity-50"
                >
                  {saving[v.id] ? "Saving…" : submitted ? "Update votes" : "Submit votes"}
                </button>

                {submitted && (
                  <span className="inline-flex items-center text-sm px-3 py-1 rounded bg-green-50 border border-green-200 text-green-800">
                    ✅ Votes submitted
                  </span>
                )}
              </div>

              <p className="mt-3 text-xs text-gray-500">
                Results are revealed when the vote closes.
              </p>
            </article>
          );
        })}
      </div>
    </>
  );
}
/* ----- Vote Results (closed; weighted tally) ----- */
function VoteResults({ userId, ownedHorseIds, isAdmin }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [horseNames, setHorseNames] = useState({});
  const [err, setErr] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErr("");

      if (!ownedHorseIds || ownedHorseIds.length === 0) {
        setItems([]);
        setHorseNames({});
        setLoading(false);
        return;
      }

      const { data: votes, error: votesErr } = await supabase
        .from("votes")
        .select("id, horse_id, title, description, status, cutoff_at, created_at")
        .eq("status", "closed")
        .or(`horse_id.in.(${ownedHorseIds.join(",")}),horse_id.is.null`)
        .order("created_at", { ascending: false })
        .limit(20);

      if (votesErr) {
        console.error(votesErr);
        setErr("Failed to load results.");
        setItems([]);
        setLoading(false);
        return;
      }

      const list = votes || [];
      if (!list.length) {
        setItems([]);
        setLoading(false);
        return;
      }

      const voteIds = list.map(v => v.id);
      const horseIds = Array.from(new Set(list.map(v => v.horse_id).filter(Boolean)));
      if (horseIds.length) {
        const { data: horses } = await supabase.from("horses").select("id,name").in("id", horseIds);
        setHorseNames(Object.fromEntries((horses || []).map(h => [h.id, h.name])));
      }

      const { data: options } = await supabase
        .from("vote_options")
        .select("id, vote_id, label")
        .in("vote_id", voteIds);

      // pull weights; aggregate client-side (or use a view if you added one)
      const { data: responses } = await supabase
        .from("vote_responses")
        .select("vote_id, option_id, weight")
        .in("vote_id", voteIds);

      const optsByVote = {};
      (options || []).forEach(o => {
        (optsByVote[o.vote_id] = optsByVote[o.vote_id] || []).push(o);
      });

      const countsByVote = {};
      (responses || []).forEach(r => {
        const bucket = (countsByVote[r.vote_id] = countsByVote[r.vote_id] || {});
        bucket[r.option_id] = (bucket[r.option_id] || 0) + Number(r.weight || 0);
      });

      const rows = list.map(v => {
        const counts = countsByVote[v.id] || {};
        const opts = optsByVote[v.id] || [];
        let max = 0;
        let winners = [];

        for (const o of opts) {
          const c = counts[o.id] || 0;
          if (c > max) {
            max = c;
            winners = [o.label];
          } else if (c === max && c > 0) {
            winners.push(o.label);
          }
        }

        return {
          vote: v,
          winnerLabels: winners,
          closedAt: v.cutoff_at ? new Date(v.cutoff_at).toLocaleString() : null,
          totals: counts,
          options: opts,
        };
      });

      setItems(rows);
      setLoading(false);
    }
    load();
  }, [userId, ownedHorseIds, isAdmin]);

  if (loading) return <p>Loading results…</p>;
  if (err) return <p className="text-sm text-red-700">{err}</p>;
  if (items.length === 0)
    return (
      <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-neutral-900 dark:border-white/10">
        <h3 className="font-semibold text-green-900">No results yet</h3>
        <p className="text-sm text-gray-600 mt-1">
          Results will appear here once votes close.
        </p>
      </div>
    );

  return (
    <div className="space-y-6">
      {items.map(({ vote: v, winnerLabels, closedAt, totals, options }) => {
        const horseName = v.horse_id ? horseNames[v.horse_id] || "Unnamed horse" : null;
        return (
          <article key={v.id} className="bg-white rounded-xl border p-6 shadow-sm">
            {horseName && (
              <h4 className="text-sm text-green-700 font-semibold mb-1">Horse: {horseName}</h4>
            )}

            <h3 className="text-lg font-semibold text-green-900">{v.title}</h3>
            {v.description && <p className="text-sm text-gray-700 mt-1">{v.description}</p>}
            {closedAt && <p className="text-xs text-gray-600 mt-1">Closed: {closedAt}</p>}

            {/* Weighted totals */}
            <div className="mt-3 space-y-1">
              {options.map(o => (
                <div key={o.id} className="flex items-center justify-between text-sm">
                  <span>{o.label}</span>
                  <span className="font-semibold">{totals[o.id] || 0}</span>
                </div>
              ))}
            </div>

            <div className="mt-4">
              {winnerLabels.length === 0 ? (
                <p className="text-sm text-gray-600">No votes were cast.</p>
              ) : winnerLabels.length === 1 ? (
                <p className="text-sm">
                  Winning option:&nbsp;
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-50 border border-green-200 text-green-800 font-semibold">
                    {winnerLabels[0]}
                  </span>
                </p>
              ) : (
                <p className="text-sm">
                  Tie between:&nbsp;
                  {winnerLabels.map((w) => (
                    <span
                      key={w}
                      className="inline-flex items-center px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 font-semibold mr-2"
                    >
                      {w}
                    </span>
                  ))}
                </p>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

/* ===========================
   Updates Tab (owner-only feed)
   — styled like ballots/votes
=========================== */
function UpdatesTab({ ownedHorseIds }) {
  const [loading, setLoading] = useState(true);
  const [updates, setUpdates] = useState([]);

  useEffect(() => {
    async function load() {
      if (!ownedHorseIds || ownedHorseIds.length === 0) {
        setUpdates([]);
        setLoading(false);
        return;
      }

      // Fetch updates for horses the user owns
      const { data: ups, error } = await supabase
        .from("horse_updates")
        .select("id, horse_id, title, body, image_url, published_at, created_at")
        .in("horse_id", ownedHorseIds)
        .lte("published_at", new Date().toISOString())
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[UpdatesTab] load error:", error);
        setUpdates([]);
        setLoading(false);
        return;
      }

      // Pull horse name/photo
      const horseIds = Array.from(new Set((ups || []).map((u) => u.horse_id))).filter(Boolean);
      let horseMap = {};
      if (horseIds.length) {
        const { data: horses, error: hErr } = await supabase
          .from("horses")
          .select("id, name, photo_url")
          .in("id", horseIds);
        if (!hErr && horses) {
          horseMap = Object.fromEntries(
            horses.map((h) => [h.id, { name: h.name, photo_url: h.photo_url }])
          );
        }
      }

      setUpdates(
        (ups || []).map((u) => ({
          ...u,
          horse: horseMap[u.horse_id] || { name: "(Unknown horse)", photo_url: null },
        }))
      );
      setLoading(false);
    }
    load();
  }, [ownedHorseIds]);

  if (loading) return <p>Loading updates…</p>;
  if (updates.length === 0)
    return (
      <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-neutral-900 dark:border-white/10">
        <h3 className="font-semibold text-green-900">No updates yet</h3>
        <p className="text-sm text-gray-600 mt-1">
          Updates for the horses you own will appear here.
        </p>
      </div>
    );

  return (
    <ul className="space-y-4">
      {updates.map((u) => {
        const when = new Date(u.published_at || u.created_at).toLocaleString();
        return (
          <li
            key={u.id}
            className="bg-white rounded-xl border p-6 shadow-sm dark:bg-neutral-900 dark:border-white/10"
          >
            {/* Top bar: Horse name (left) + time (right) */}
            <div className="flex items-baseline justify-between">
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-50 border border-green-200 text-green-800 text-xs font-semibold">
                {u.horse?.name || "(Unknown horse)"}
              </span>
              <span className="text-xs text-gray-500">{when}</span>
            </div>

            {/* Title */}
            <h3 className="mt-2 text-lg font-semibold text-green-900">{u.title}</h3>

            {/* 👇 changed to square */}
          {u.image_url && (
  <div className="mt-3 w-full max-w-xs mx-auto aspect-square overflow-hidden rounded-md">
    <img
      src={u.image_url}
      alt=""
      className="w-full h-full object-cover"
    />
  </div>
)}

            {/* Body (optional) */}
            {u.body && (
              <p className="text-sm text-gray-700 mt-3 whitespace-pre-wrap">
                {u.body}
              </p>
            )}

            {/* Actions */}
            {u.horse_id && (
              <div className="mt-4">
                <Link
                  href={`/horses/${u.horse_id}`}
                  className="px-4 py-2 border rounded text-green-900 hover:bg-green-50 text-sm"
                >
                  View horse
                </Link>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ===========================
   Renew Tab (top-up, proper open/closed rules, realtime)
=========================== */
export function RenewTab({ userId, owned = [] }) {
  const router = useRouter(); // 👈 NEW
  const [loading, setLoading] = useState(true);
  const [entriesOpen, setEntriesOpen] = useState([]);
  const [entriesClosed, setEntriesClosed] = useState([]);
  const [inCartByCycle, setInCartByCycle] = useState({});
  const [qtyByCycle, setQtyByCycle] = useState({});
  const [addingId, setAddingId] = useState(null);

  // money + date formatters
  const gbp = useMemo(
    () => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }),
    []
  );
  const fmtMoney = (n) =>
    n == null || Number.isNaN(Number(n)) ? "—" : gbp.format(Number(n));
  const fmtDate = (v) => {
    if (!v) return "—";
    return new Date(v).toLocaleDateString("en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // horse_id -> shares owned
  const ownedByHorse = useMemo(() => {
    const safe = Array.isArray(owned) ? owned : [];
    return Object.fromEntries(
      safe
        .filter((o) => o?.horse?.id)
        .map((o) => [o.horse.id, Number(o.shares || 0)])
    );
  }, [owned]);

  // single loader we can reuse (initial + realtime)
  const loadRenewals = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);

      const safeOwned = Array.isArray(owned) ? owned : [];
      const horseIds = safeOwned.map((o) => o?.horse?.id).filter(Boolean);

      if (!horseIds.length) {
        setEntriesOpen([]);
        setEntriesClosed([]);
        setInCartByCycle({});
        setQtyByCycle({});
        if (!silent) setLoading(false);
        return;
      }

      // 1) fetch cycles
      const { data: rc, error: rcErr } = await supabase
        .from("renew_cycles")
        .select(
          "id,horse_id,term_label,renew_period_start,renew_period_end,term_end_date,status,price_per_share"
        )
        .in("horse_id", horseIds)
        .order("renew_period_end", { ascending: true });
      if (rcErr) console.error("[RenewTab] renew_cycles error:", rcErr);
      const cyclesRaw = rc || [];

      // 2) horses
      const uniqHorseIds = Array.from(new Set(cyclesRaw.map((r) => r.horse_id)));
      const { data: hs, error: hErr } = await supabase
        .from("horses")
        .select("id,name,photo_url")
        .in("id", uniqHorseIds);
      if (hErr) console.error("[RenewTab] horses error:", hErr);
      const horseMap = Object.fromEntries((hs || []).map((h) => [h.id, h]));

      // 3) renew_responses (actual renewals)
      const cycleIds = cyclesRaw.map((r) => r.id);
      let renewedByCycle = {};
      if (cycleIds.length) {
        const { data: myResp, error: rrErr } = await supabase
          .from("renew_responses")
          .select("renew_cycle_id, shares")
          .eq("user_id", userId)
          .in("renew_cycle_id", cycleIds);
        if (rrErr) console.error("[RenewTab] renew_responses error:", rrErr);

        const agg = {};
        (myResp || []).forEach((r) => {
          agg[r.renew_cycle_id] =
            (agg[r.renew_cycle_id] || 0) + Number(r.shares || 0);
        });
        renewedByCycle = agg;
      }

      // 4) enrich
      const now = Date.now();
      const enriched = cyclesRaw.map((c) => {
        const startMs = c.renew_period_start
          ? new Date(c.renew_period_start).getTime()
          : 0;
        const endMs = c.renew_period_end
          ? new Date(c.renew_period_end).getTime()
          : 0;
        const openNow =
          c.status === "open" && startMs && endMs && now >= startMs && now <= endMs;

        const ownedShares = ownedByHorse[c.horse_id] ?? 0;
        const renewedShares = Number(renewedByCycle[c.id] || 0);

        return {
          cycle: c,
          horse: horseMap[c.horse_id] || { name: "(Horse)" },
          ownedShares,
          renewedShares,
          openNow,
          price: c.price_per_share ?? null,
          title: c.term_label || "",
        };
      });

      // 5) cart items for renewals
      let inCartMap = {};
      try {
        const cart = await cartApi.getOrCreateCart();
        const { data: cartRenewals } = await supabase
          .from("cart_items")
          .select("renew_cycle_id, qty")
          .eq("cart_id", cart.id)
          .eq("item_type", "renewal");
        (cartRenewals || []).forEach((row) => {
          if (row.renew_cycle_id)
            inCartMap[row.renew_cycle_id] = Number(row.qty || 0);
        });
        setInCartByCycle(inCartMap);
      } catch {
        // ignore
      }

      // 6) split
      const openList = [];
      const closedList = [];

      enriched.forEach((e) => {
        const cid = e.cycle.id;
        const inCart = Number(inCartMap[cid] || 0);
        const remaining = Math.max(
          0,
          Number(e.ownedShares) - Number(e.renewedShares) - inCart
        );

        const showInClosed =
          (e.cycle.status !== "open" && !e.openNow) || e.renewedShares > 0;

        if (showInClosed) {
          closedList.push({
            ...e,
            inCart,
            remaining: Math.max(
              0,
              Number(e.ownedShares) - Number(e.renewedShares)
            ),
          });
        } else {
          openList.push({
            ...e,
            inCart,
            remaining,
          });
        }
      });

      const initialQty = {};
      openList.forEach((e) => {
        initialQty[e.cycle.id] = e.remaining > 0 ? e.remaining : 0;
      });
      setQtyByCycle(initialQty);

      setEntriesOpen(openList);
      setEntriesClosed(closedList);
      if (!silent) setLoading(false);
    },
    [owned, ownedByHorse, userId]
  );

  // initial load
  useEffect(() => {
    loadRenewals();
  }, [loadRenewals]);

  // realtime
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("renew-responses-" + userId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "renew_responses",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadRenewals(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadRenewals]);

  // add to basket
  async function addRenewalToBasket(entry) {
    const cid = entry.cycle.id;
    const inCart = Number(inCartByCycle[cid] || 0);
    const remaining = Math.max(
      0,
      Number(entry.ownedShares || 0) - Number(entry.renewedShares || 0) - inCart
    );
    const want = Math.min(Math.max(1, Number(qtyByCycle[cid] || 0)), remaining);

    if (!entry.openNow) return alert("This renewal window isn’t currently open.");
    if (entry.price == null) return alert("No renewal price is set yet.");
    if (remaining <= 0) return;

    try {
      setAddingId(cid);
      const cart = await cartApi.getOrCreateCart();
      await cartApi.addRenewalToCart({
        cartId: cart.id,
        renewCycleId: cid,
        qty: want,
        pricePerShareGBP: entry.price,
      });

      // optimistic update
      const newInCart = inCart + want;
      setInCartByCycle((prev) => ({ ...prev, [cid]: newInCart }));
      const newRemaining =
        Math.max(
          0,
          Number(entry.ownedShares || 0) -
            Number(entry.renewedShares || 0) -
            newInCart
        );
      setQtyByCycle((prev) => ({
        ...prev,
        [cid]: newRemaining > 0 ? newRemaining : 0,
      }));

      // 👇 NEW: send them straight to the basket
      router.push("/cart");
    } catch (e) {
      console.error("[RenewTab] add to basket failed:", e);
      alert(e?.message || "Could not add renewal to basket.");
    } finally {
      setAddingId(null);
    }
  }

  // RENDER
  if (loading) return <p>Loading renewals…</p>;

  if (!entriesOpen.length && !entriesClosed.length) {
    return (
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-green-900">You have no horses to renew yet.</h3>
        <p className="text-sm text-gray-600 mt-1">
          When a renewal window opens, it’ll appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* OPEN / ACTIONABLE */}
      {entriesOpen.length > 0 && (
        <section className="space-y-4">
          {entriesOpen.map((e) => {
            const cid = e.cycle.id;
            const showQty = e.remaining > 0;
            const showButton = e.remaining > 0;

            return (
              <article key={cid} className="rounded-xl border bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    {e.horse?.photo_url && (
                      <img
                        src={e.horse.photo_url}
                        alt={e.horse?.name || "Horse"}
                        className="w-14 h-14 rounded object-cover"
                      />
                    )}

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-green-900">
                          {e.horse?.name || "Horse"}
                        </h3>
                        {e.title && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-50 border border-gray-200 text-gray-700">
                            {e.title}
                          </span>
                        )}
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs border bg-emerald-50 border-emerald-200 text-emerald-800">
                          Renewed {e.renewedShares}/{e.ownedShares}
                        </span>
                      </div>

                      <p className="text-sm text-gray-800 mt-2">
                        <span className="font-semibold">Renewal deadline — </span>
                        {fmtDate(e.cycle.renew_period_end)}
                      </p>
                      {e.cycle.term_end_date && (
                        <p className="text-sm text-gray-700 mt-1">
                          <span className="font-semibold">Term ends — </span>
                          {fmtDate(e.cycle.term_end_date)}
                        </p>
                      )}

                      <div className="text-sm text-gray-700 mt-3 space-y-0.5">
                        <p>
                          Price per share: <strong>{fmtMoney(e.price)}</strong>
                        </p>
                        {e.inCart > 0 ? (
                          <p>
                            In basket: <strong>{e.inCart}</strong>{" "}
                            (remaining this period: <strong>{e.remaining}</strong>)
                          </p>
                        ) : (
                          <p>
                            If renewing all now:{" "}
                            <strong>
                              {fmtMoney(
                                Number(e.ownedShares) * Number(e.price || 0)
                              )}
                            </strong>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right w-56">
                    <div className="flex items-center gap-2 justify-end">
                      {showQty && (
                        <div className="flex items-center gap-2">
                          <label className="text-sm">Qty:</label>
                          <select
                            value={Math.min(qtyByCycle[cid] || 1, e.remaining) || 1}
                            className="border rounded px-2 py-1 text-sm"
                            onChange={(ev) =>
                              setQtyByCycle((prev) => ({
                                ...prev,
                                [cid]: Math.max(
                                  1,
                                  Math.min(e.remaining, Number(ev.target.value))
                                ),
                              }))
                            }
                          >
                            {Array.from({ length: e.remaining }, (_, i) => i + 1).map(
                              (n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              )
                            )}
                          </select>
                        </div>
                      )}

                      {showButton ? (
                        <button
                          onClick={() => addRenewalToBasket(e)}
                          disabled={addingId === cid}
                          className="px-4 py-2 bg-green-900 text-white rounded disabled:opacity-50 text-sm"
                        >
                          {addingId === cid ? "Adding…" : "Add to basket"}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-500 text-right">
                          All your shares for this period are already in the basket
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* CLOSED / COMPLETED */}
      {entriesClosed.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-700">
            Closed or completed renewals
          </h4>
          <div className="divide-y rounded-lg border bg-white">
            {entriesClosed.map((e) => {
              const userRenewed = Number(e.renewedShares || 0) > 0;
              const termDateToShow =
                e.cycle.term_end_date || e.cycle.renew_period_end || null;

              return (
                <div
                  key={e.cycle.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    {e.horse?.photo_url && (
                      <img
                        src={e.horse.photo_url}
                        alt={e.horse?.name || "Horse"}
                        className="w-8 h-8 rounded object-cover"
                      />
                    )}
                    <div className="text-sm">
                      <div className="font-medium text-green-900">
                        {e.horse?.name || "Horse"}
                      </div>
                      <div className="text-gray-600">
                        {e.title || "Renewal"} · You renewed{" "}
                        <strong>{Number(e.renewedShares || 0)}</strong> share
                        {Number(e.renewedShares || 0) === 1 ? "" : "s"}
                      </div>

                      {userRenewed && termDateToShow && (
                        <div className="text-xs text-gray-500">
                          Term ends — {fmtDate(termDateToShow)}
                        </div>
                      )}
                    </div>
                  </div>

                  <span
                    className={
                      "text-xs rounded border px-2 py-0.5 " +
                      (userRenewed
                        ? "text-emerald-800 bg-emerald-50 border-emerald-200"
                        : "text-gray-700 bg-gray-50 border-gray-200")
                    }
                  >
                    {userRenewed ? "Renewal purchased" : "Closed"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

/* --- Simple celebratory / consolation graphics --- */
function WinCard() {
  return (
    <div className="rounded-xl border-2 border-emerald-400 bg-emerald-50 p-5 text-center">
      <div className="text-4xl">🎉🏆</div>
      <h4 className="mt-2 text-xl font-bold text-emerald-700">Congratulations!</h4>
      <p className="text-sm text-emerald-800 mt-1">
        You won this ballot. We’ll be in touch with details shortly.
      </p>
    </div>
  );
}

function LoseCard() {
  return (
    <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-5 text-center">
      <div className="text-4xl">🎈</div>
      <h4 className="mt-2 text-xl font-bold text-amber-700">Not this time</h4>
      <p className="text-sm text-amber-800 mt-1">
        Better luck next draw — thank you for entering!
      </p>
    </div>
  );
}

// ---- WalletTab (Recent activity incl. wallet debits used at checkout) ----
function WalletTab({ userId: userIdProp }) {
  const [loading, setLoading] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);
  const [userId, setUserId] = useState(userIdProp || null);

  const [balance, setBalance] = useState(0);
  const [activity, setActivity] = useState([]);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const [form, setForm] = useState({
    amount: "",
    account_name: "",
    sort_code: "",
    account_number: "",
  });

  useEffect(() => {
    (async () => {
      if (!userIdProp) {
        const { data } = await supabase.auth.getUser();
        if (data?.user?.id) setUserId(data.user.id);
      }
    })();
  }, [userIdProp]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErr("");
      setNotConfigured(false);

      if (!userId) {
        setBalance(0);
        setActivity([]);
        setLoading(false);
        return;
      }

      try {
        // Wallet transactions (credits & debits)
        const { data: tx } = await supabase
          .from("wallet_transactions")
          .select("id, amount, type, status, memo, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        const txRows = tx || [];

        // Compute balance from POSTED rows only
        const postedCredits = txRows
          .filter((t) => t.status === "posted" && t.type === "credit")
          .reduce((s, t) => s + Number(t.amount || 0), 0);
        const postedDebits = txRows
          .filter((t) => t.status === "posted" && t.type === "debit")
          .reduce((s, t) => s + Number(t.amount || 0), 0);
        setBalance(Math.max(0, postedCredits - postedDebits));

        // Withdrawals table (requests + payouts)
        const { data: wr } = await supabase
          .from("wallet_withdrawals")
          .select("id, amount, status, created_at, processed_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50);

        const wrRows = wr || [];

        // ---------- Deduping logic ----------
        // In production, some setups also write a *debit* row in wallet_transactions
        // at (nearly) the same time/amount as the withdrawal request. We only want to
        // show the human-friendly "Withdrawal request made" (from wallet_withdrawals),
        // not an extra "Wallet used toward a purchase" line.
        function toMs(s) {
          try {
            return new Date(s).getTime();
          } catch {
            return 0;
          }
        }
        function toPence(n) {
          // store as integer pence to compare amounts safely
          return Math.round(Number(n || 0) * 100);
        }

        // Build lookup of withdrawals by (amount, time window)
        const withdrawalIndex = new Map(); // key: amount_in_pence -> [timestamps_ms]
        for (const w of wrRows) {
          const key = toPence(w.amount);
          const arr = withdrawalIndex.get(key) || [];
          arr.push(toMs(w.created_at));
          withdrawalIndex.set(key, arr);
        }

        // Helper: is a given debit likely the system debit that mirrors a withdrawal?
        function looksLikeWithdrawalDebit(tx) {
          if (!tx || tx.type !== "debit") return false;

          // Strong hint in memo
          const memo = String(tx.memo || "").toLowerCase();
          if (memo.includes("withdrawal")) return true;

          // Fuzzy match: same amount & very close time (+/- 90s) as a withdrawal record
          const key = toPence(tx.amount);
          const times = withdrawalIndex.get(key) || [];
          if (!times.length) return false;

          const t = toMs(tx.created_at);
          const WINDOW = 90 * 1000; // 90 seconds
          return times.some((wt) => Math.abs(wt - t) <= WINDOW);
        }
        // ---------- End deduping helpers ----------

        // Credits
        const creditEvents = txRows
          .filter((t) => t.type === "credit")
          .map((t) => ({
            kind: "credit",
            amount: Number(t.amount || 0),
            memo: t.memo || "Winnings",
            at: t.created_at,
            status: t.status || "posted",
          }));

        // Debits (skip ones that match a withdrawal request)
        const debitEvents = txRows
          .filter((t) => t.type === "debit" && !looksLikeWithdrawalDebit(t))
          .map((t) => ({
            kind: "debit",
            amount: Number(t.amount || 0),
            memo:
              t.memo && t.memo.trim()
                ? t.memo
                : "Wallet used toward a purchase",
            at: t.created_at,
            status: t.status || "posted",
          }));

        // Withdrawals feed items (always include these; this is what the user should see)
        const withdrawalEvents = wrRows.map((r) => ({
          kind: "withdrawal",
          amount: Number(r.amount || 0),
          status: r.status,
          requested_at: r.created_at,
          paid_at: r.processed_at || null,
        }));

        // Merge & sort (desc by time)
        const merged = [...creditEvents, ...debitEvents, ...withdrawalEvents].sort(
          (a, b) => {
            const ta = a.kind === "withdrawal" ? a.requested_at : a.at;
            const tb = b.kind === "withdrawal" ? b.requested_at : b.at;
            return new Date(tb) - new Date(ta);
          }
        );

        setActivity(merged.slice(0, 20));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [userId]);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function handleWithdrawSubmit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");

    if (!confirming) {
      setConfirming(true);
      return;
    }

    if (notConfigured) return setErr("Wallet isn’t set up yet. Please try again later.");
    if (!userId) return setErr("Please sign in to request a withdrawal.");

    const amt = Number(form.amount || 0);
    if (Number.isNaN(amt) || amt <= 0) return setErr("Enter a valid amount.");
    if (amt < 5) return setErr("Minimum withdrawal is £5.");
    if (amt > balance) return setErr("You cannot withdraw more than your balance.");
    if (!form.account_name.trim()) return setErr("Enter the account holder name.");

    const sort = form.sort_code.replace(/[-\s]/g, "");
    const acct = form.account_number.replace(/\s/g, "");
    if (!/^\d{6}$/.test(sort)) return setErr("Sort code must be 6 digits.");
    if (!/^\d{6,10}$/.test(acct)) return setErr("Account number must be 6–10 digits.");

    setSaving(true);
    try {
      const { error } = await supabase.rpc("request_withdrawal", {
        p_amount: amt,
        p_account_name: form.account_name.trim(),
        p_sort_code: sort,
        p_account_number: acct,
      });
      if (error) throw error;

      setMsg("✅ Withdrawal requested.");
      setConfirming(false);
      setForm({ amount: "", account_name: "", sort_code: "", account_number: "" });
    } catch (e) {
      setErr(e.message || "Could not submit request.");
    } finally {
      setSaving(false);
    }
  }

  function fmtGBP(n) {
    return Number(n || 0).toFixed(2);
  }
  function fmtDate(d) {
    return new Date(d).toLocaleString();
  }

  return (
    <div
      id="panel-wallet"
      className="rounded-xl border bg-white p-6 shadow-sm dark:bg-neutral-900 dark:border-white/10"
    >
      <h2 className="text-2xl font-bold text-green-900 mb-2">Wallet</h2>

      {loading ? (
        <p className="text-gray-600">Loading…</p>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rounded-lg border p-4">
              <div className="text-xs text-gray-500 uppercase">Balance</div>
              <div className="text-xl font-bold mt-1">£{fmtGBP(balance)}</div>
            </div>
          </div>

          {/* Withdrawals */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-green-900">Request withdrawal</h3>
            <p className="text-xs text-gray-600">
              Minimum withdrawal is £5. You can withdraw up to your available balance.
            </p>

            <form onSubmit={handleWithdrawSubmit} className="mt-3 grid gap-3 max-w-lg">
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-sm">
                  Amount (£)
                  <input
                    name="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={onChange}
                    className="mt-1 w-full border rounded px-3 py-2 bg-white text-gray-900 placeholder-gray-400 border-gray-300 dark:bg-neutral-800 dark:text-gray-100 dark:placeholder-gray-400 dark:border-white/10"
                  />
                </label>
                <label className="text-sm">
                  Account name
                  <input
                    name="account_name"
                    value={form.account_name}
                    onChange={onChange}
                    className="mt-1 w-full border rounded px-3 py-2 bg-white text-gray-900 placeholder-gray-400 border-gray-300 dark:bg-neutral-800 dark:text-gray-100 dark:placeholder-gray-400 dark:border-white/10"
                  />
                </label>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-sm">
                  Sort code (6 digits)
                  <input
                    name="sort_code"
                    inputMode="numeric"
                    value={form.sort_code}
                    onChange={onChange}
                    className="mt-1 w-full border rounded px-3 py-2 bg-white text-gray-900 placeholder-gray-400 border-gray-300 dark:bg-neutral-800 dark:text-gray-100 dark:placeholder-gray-400 dark:border-white/10"
                    placeholder="e.g. 112233"
                  />
                </label>
                <label className="text-sm">
                  Account number
                  <input
                    name="account_number"
                    inputMode="numeric"
                    value={form.account_number}
                    onChange={onChange}
                    className="mt-1 w-full border rounded px-3 py-2 bg-white text-gray-900 placeholder-gray-400 border-gray-300 dark:bg-neutral-800 dark:text-gray-100 dark:placeholder-gray-400 dark:border-white/10"
                    placeholder="e.g. 12345678"
                  />
                </label>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  type="submit"
                  disabled={saving || !userId}
                  className={`px-4 py-2 text-white rounded ${
                    confirming ? "bg-red-700 hover:bg-red-800" : "bg-green-900 hover:bg-green-950"
                  } disabled:opacity-50`}
                >
                  {saving ? "Processing…" : confirming ? "Confirm withdrawal" : "Request withdrawal"}
                </button>
                <span className="text-xs text-gray-600">
                  Please double-check all details are correct as any mistakes cannot be rectified.
                </span>
              </div>

              {err && <span className="text-sm text-red-700">{err}</span>}
              {msg && <span className="text-sm text-green-700">{msg}</span>}
            </form>
          </div>

          {/* Recent Activity */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-green-900">Recent activity</h3>
            {activity.length === 0 ? (
              <p className="text-sm text-gray-600 mt-1">No activity yet.</p>
            ) : (
              <ul className="mt-2 divide-y">
                {activity.map((ev, i) => {
                  if (ev.kind === "credit") {
                    return (
                      <li key={i} className="py-2">
                        <div className="font-medium text-emerald-700">
                          +£{fmtGBP(ev.amount)}
                        </div>
                        {ev.memo && (
                          <div className="text-xs text-gray-700 mt-0.5">{ev.memo}</div>
                        )}
                        <div className="text-xs text-gray-600 mt-0.5">
                          Winnings paid at — {fmtDate(ev.at)}
                        </div>
                      </li>
                    );
                  }
                  if (ev.kind === "debit") {
                    return (
                      <li key={i} className="py-2">
                        <div className="font-medium text-rose-700">
                          −£{fmtGBP(ev.amount)}
                        </div>
                        <div className="text-xs text-gray-700 mt-0.5">
                          {ev.memo || "Wallet used toward a purchase"}
                        </div>
                        <div className="text-xs text-gray-600 mt-0.5">
                          Debited at — {fmtDate(ev.at)}
                        </div>
                      </li>
                    );
                  }
                  // withdrawal
                  return (
                    <li key={i} className="py-2">
                      <div className="font-medium text-rose-700">
                        −£{fmtGBP(ev.amount)}
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">
                        Withdrawal request made — {fmtDate(ev.requested_at)}
                      </div>
                      {ev.paid_at && (
                        <div className="text-xs text-gray-600">
                          Paid at — {fmtDate(ev.paid_at)}
                        </div>
                      )}
                      <div className="text-xs mt-1">
                        {ev.status === "requested" && (
                          <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700">
                            Requested
                          </span>
                        )}
                        {ev.status === "paid" && (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700">
                            Paid
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}