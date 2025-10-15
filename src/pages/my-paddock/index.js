// src/pages/my-paddock/index.js

import Head from "next/head";
import Link from "next/link";
import dynamic from "next/dynamic";
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";

// Confetti must be client-only to avoid SSR window errors (used elsewhere on page)
const Confetti = dynamic(() => import("react-confetti"), { ssr: false });

/* ============= Small util (kept because other sections use it) ============= */
function useWindowSize() {
  const isClient = typeof window !== "undefined";
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!isClient) return;
    function onResize() {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isClient]);
  return size;
}

/* ============= Admin helper (unchanged) ============= */
const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function useIsAdmin(session) {
  const email = session?.user?.email?.toLowerCase()?.trim();
  return Boolean(email && ADMIN_EMAILS.includes(email));
}

/* ============= Profile details card (single, hides on save) ============= */
function ProfileDetailsCard({ session, onSaved }) {
  const [fullName, setFullName] = React.useState(
    session?.user?.user_metadata?.full_name ||
      session?.user?.user_metadata?.name ||
      ""
  );
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState("");

  async function saveName(e) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      const clean = (fullName || "").trim();
      if (!clean) {
        setMsg("❌ Please enter your full name");
        setSaving(false);
        return;
      }
      const { error } = await supabase.auth.updateUser({
        data: { full_name: clean },
      });
      if (error) throw error;

      setMsg("✅ Saved");
      // Let parent hide the card and update greeting immediately
      onSaved?.(clean);
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
            placeholder="e.g. George Calder"
            className="mt-1 w-full border rounded px-3 py-2"
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
            appearance={{ theme: ThemeSupa }}
            providers={[]} // email only
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

      <main className="max-w-7xl mx-auto px-6 py-10">
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
        <section className="mt-8 sticky top-0 z-20 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b">
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
      className={`px-4 py-2 rounded-lg border transition ${
        isActive
          ? "bg-green-900 text-white border-green-900"
          : "bg-white text-green-900 border-gray-200 hover:bg-gray-50"
      }`}
      aria-pressed={isActive}
      aria-controls={`panel-${id}`}
    >
      {children}
    </button>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="text-sm uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-extrabold text-green-900">{value}</div>
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
        <div className="rounded-xl border bg-white p-6 shadow-sm">
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
          <article key={o.horse.id} className="bg-white rounded-lg shadow p-4">
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
   BALLOTS SECTION header (kept)
=========================== */
function BallotsSection({ userId, ownedHorseIds }) {
  const [sub, setSub] = useState("open"); // open | results
  return (
    <div id="panel-ballots">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h2 className="text-2xl font-bold text-green-900">Ballots</h2>
        <div className="flex flex-wrap gap-2">
          <SubTab id="open" sub={sub} setSub={setSub}>
            Open ballots
          </SubTab>
          <SubTab id="results" sub={sub} setSub={setSub}>
            My results
          </SubTab>
        </div>
      </div>

      {/* These rely on your existing implementations elsewhere in this file */}
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

/* ----- Open ballots (for owned horses) ----- */
function OpenBallots({ userId, ownedHorseIds }) {
  const [loading, setLoading] = useState(true);
  const [openBallots, setOpenBallots] = useState([]);
  const [myEntries, setMyEntries] = useState(new Set());
  const [entryCounts, setEntryCounts] = useState({});
  const [joining, setJoining] = useState({}); // ballot_id -> bool
  const [horseNames, setHorseNames] = useState({}); // horse_id -> name

  useEffect(() => {
    async function load() {
      setLoading(true);

      if (!ownedHorseIds || ownedHorseIds.length === 0) {
        setOpenBallots([]);
        setMyEntries(new Set());
        setEntryCounts({});
        setHorseNames({});
        setLoading(false);
        return;
      }

      const { data: ballots } = await supabase
        .from("ballots")
        .select("id,horse_id,type,title,description,event_date,cutoff_at,max_winners,status")
        .eq("status", "open")
        .in("horse_id", ownedHorseIds)
        .order("cutoff_at", { ascending: true });

      setOpenBallots(ballots || []);

      // horse names for these ballots
      const ids = Array.from(new Set((ballots || []).map(b => b.horse_id))).filter(Boolean);
      if (ids.length) {
        const { data: horses } = await supabase
          .from("horses")
          .select("id,name")
          .in("id", ids);
        setHorseNames(Object.fromEntries((horses || []).map(h => [h.id, h.name])));
      } else {
        setHorseNames({});
      }

      // which ballots I've entered
      const { data: entries } = await supabase
        .from("ballot_entries")
        .select("ballot_id")
        .eq("user_id", userId);
      setMyEntries(new Set((entries || []).map((e) => e.ballot_id)));

      // counts per ballot
      const counts = {};
      if (ballots && ballots.length) {
        for (const b of ballots) {
          const { count } = await supabase
            .from("ballot_entries")
            .select("*", { count: "exact", head: true })
            .eq("ballot_id", b.id);
          counts[b.id] = count || 0;
        }
      }
      setEntryCounts(counts);

      setLoading(false);
    }
    load();
  }, [userId, ownedHorseIds]);

  async function enter(ballotId) {
    setJoining((p) => ({ ...p, [ballotId]: true }));
    try {
      const { error } = await supabase.from("ballot_entries").insert({
        ballot_id: ballotId,
        user_id: userId,
      });
      if (error) {
        alert(error.code === "23505" ? "You're already entered." : "Could not enter ballot.");
        return;
      }
      setMyEntries((prev) => new Set([...prev, ballotId]));
      setEntryCounts((prev) => ({ ...prev, [ballotId]: (prev[ballotId] || 0) + 1 }));
    } finally {
      setJoining((p) => ({ ...p, [ballotId]: false }));
    }
  }

  if (loading) return <p>Loading ballots…</p>;
  if (openBallots.length === 0)
    return (
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-green-900">No open ballots for your horses</h3>
        <p className="text-sm text-gray-600 mt-1">We’ll notify you when new ballots open.</p>
      </div>
    );

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {openBallots.map((b) => {
        const entered = myEntries.has(b.id);
        const cnt = entryCounts[b.id] ?? 0;
        const typeLabel = b.type === "badge" ? "Owners’ badges" : "Stable visit";
        const isClosedByTime = b.cutoff_at && new Date(b.cutoff_at).getTime() <= Date.now();
        const horseName = b.horse_id ? (horseNames[b.horse_id] || "—") : "—";

        return (
          <article key={b.id} className="bg-white rounded-xl border p-6 shadow-sm">
            {/* 🐴 Horse name at top (same style as Voting) */}
            {horseName && horseName !== "—" && (
              <h4 className="text-sm text-green-700 font-semibold mb-1">Horse: {horseName}</h4>
            )}

            <h3 className="text-lg font-semibold text-green-900">{b.title}</h3>

            {/* Subheading (keep everything else, but don’t repeat the horse name) */}
            <p className="text-sm text-gray-600 mt-1">
              {typeLabel}
              {b.event_date ? ` • Event: ${new Date(b.event_date).toLocaleDateString()}` : ""}
              {isClosedByTime ? " • Closed" : ""}
            </p>

            {b.description && <p className="text-sm text-gray-700 mt-2">{b.description}</p>}

            <div className="mt-3 text-sm font-semibold text-green-900">Ballot information</div>
            <div className="mt-1 text-xs text-gray-600">
              <div>
                Closes: <strong>{new Date(b.cutoff_at).toLocaleString()}</strong>
              </div>
              {b.max_winners > 0 && (
                <div>
                  Winners: <strong>{b.max_winners}</strong>
                </div>
              )}
              <div>
                Entries so far: <strong>{cnt}</strong>
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => enter(b.id)}
                disabled={entered || isClosedByTime || joining[b.id]}
                className="px-4 py-2 bg-green-900 text-white rounded disabled:opacity-50"
                title={entered ? "Already entered" : isClosedByTime ? "Closed" : "Enter ballot"}
              >
                {entered ? "Entered" : isClosedByTime ? "Closed" : joining[b.id] ? "Entering…" : "Enter ballot"}
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

/* ----- My Results (with Reveal + confetti + extra details) ----- */
function MyResults({ userId }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]); // [{ ballot, result, horse }]
  const [revealed, setRevealed] = useState({}); // ballot_id -> bool
  const { width, height } = useWindowSize();

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: results } = await supabase
        .from("ballot_results")
        .select("ballot_id, result")
        .eq("user_id", userId);

      const ids = Array.from(new Set((results || []).map((r) => r.ballot_id)));
      if (ids.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const { data: ballots, error: ballotsErr } = await supabase
        .from("ballots")
        .select("id, title, type, event_date, cutoff_at, horse_id")
        .in("id", ids);

      if (ballotsErr) {
        console.error(ballotsErr);
        setRows([]);
        setLoading(false);
        return;
      }

      // map horse_id -> horse details
      const horseIds = Array.from(new Set((ballots || []).map(b => b.horse_id))).filter(Boolean);
      let horseMap = {};
      if (horseIds.length) {
        const { data: horses } = await supabase
          .from("horses")
          .select("id, name, photo_url")
          .in("id", horseIds);
        horseMap = Object.fromEntries((horses || []).map(h => [h.id, h]));
      }

      const byId = Object.fromEntries((ballots || []).map((b) => [b.id, b]));
      const merged = (results || [])
        .map((r) => {
          const b = byId[r.ballot_id];
          return b ? { ballot: b, result: r.result, horse: horseMap[b.horse_id] || null } : null;
        })
        .filter(Boolean);

      setRows(merged.sort((a, b) => new Date(b.ballot.cutoff_at) - new Date(a.ballot.cutoff_at)));
      setLoading(false);
    }
    load();
  }, [userId]);

  function toggleReveal(bid) {
    setRevealed((p) => ({ ...p, [bid]: !p[bid] }));
  }

  if (loading) return <p>Loading results…</p>;
  if (rows.length === 0)
    return (
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-green-900">No results yet</h3>
        <p className="text-sm text-gray-600 mt-1">When your ballots are drawn, results will appear here.</p>
      </div>
    );

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
                {horse?.photo_url && (
                  <img
                    src={horse.photo_url}
                    alt={horse?.name || "Horse"}
                    className="w-16 h-16 object-cover rounded"
                  />
                )}
                <div>
                  {/* 🐴 Horse name at top (same style as Voting) */}
                  {horse?.name && (
                    <h4 className="text-sm text-green-700 font-semibold mb-1">Horse: {horse.name}</h4>
                  )}

                  <div className="font-medium">
                    {b.title}{" "}
                    <span className="text-xs text-gray-500">
                      ({typeLabel}) {b.event_date ? `• ${new Date(b.event_date).toLocaleDateString()}` : ""}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600">
                    {/* remove duplicate horse label here; keep drawn + date */}
                    Drawn • {new Date(b.cutoff_at).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {b.horse_id && (
                  <Link
                    href={`/horses/${b.horse_id}`}
                    className="px-3 py-1 border rounded text-sm text-green-900 hover:bg-green-50"
                  >
                    View horse
                  </Link>
                )}
                <button
                  onClick={() => toggleReveal(b.id)}
                  className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
                >
                  {isRevealed ? "Hide result" : "Reveal result"}
                </button>
              </div>
            </div>

            {isRevealed && (
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
            )}
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

/* ----- Open Votes (single-choice polls; one-shot, no updates) ----- */
function OpenVotes({ userId, ownedHorseIds }) {
  const [loading, setLoading] = useState(true);
  const [votes, setVotes] = useState([]);
  const [saving, setSaving] = useState({});
  const [chosen, setChosen] = useState({});
  const [horseNames, setHorseNames] = useState({}); // 🐴 new

  useEffect(() => {
    async function load() {
      setLoading(true);

      if (!ownedHorseIds || ownedHorseIds.length === 0) {
        setVotes([]);
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

      const voteIds = (openVotes || []).map((v) => v.id);
      if (!voteIds.length) {
        setVotes([]);
        setHorseNames({});
        setLoading(false);
        return;
      }

      // 🐴 fetch horse names
      const horseIds = Array.from(new Set((openVotes || []).map((v) => v.horse_id).filter(Boolean)));
      if (horseIds.length) {
        const { data: horses } = await supabase.from("horses").select("id,name").in("id", horseIds);
        setHorseNames(Object.fromEntries((horses || []).map((h) => [h.id, h.name])));
      } else {
        setHorseNames({});
      }

      // Options
      const { data: allOptions } = await supabase
        .from("vote_options")
        .select("id, vote_id, label")
        .in("vote_id", voteIds);

      const optionsByVote = {};
      (allOptions || []).forEach((o) => {
        optionsByVote[o.vote_id] = optionsByVote[o.vote_id] || [];
        optionsByVote[o.vote_id].push(o);
      });

      // My responses
      const { data: my } = await supabase
        .from("vote_responses")
        .select("id, vote_id, option_id")
        .eq("user_id", userId)
        .in("vote_id", voteIds);

      const myByVote = {};
      (my || []).forEach((r) => (myByVote[r.vote_id] = r));

      setVotes(
        (openVotes || []).map((v) => ({
          vote: v,
          options: optionsByVote[v.id] || [],
          myResponseId: myByVote[v.id]?.id || null,
          myOptionId: myByVote[v.id]?.option_id || null,
        }))
      );

      setChosen(
        (openVotes || []).reduce((acc, v) => {
          if (myByVote[v.id]?.option_id) acc[v.id] = myByVote[v.id].option_id;
          return acc;
        }, {})
      );

      setLoading(false);
    }
    load();
  }, [userId, ownedHorseIds]);

  async function submitVote(voteId) {
    const optionId = chosen[voteId];
    if (!optionId) return alert("Please select an option.");
    setSaving((p) => ({ ...p, [voteId]: true }));
    try {
      const { data: existing } = await supabase
        .from("vote_responses")
        .select("id")
        .eq("vote_id", voteId)
        .eq("user_id", userId)
        .maybeSingle();
      if (existing) return alert("Your vote is already recorded.");

      const { error } = await supabase.from("vote_responses").insert({
        vote_id: voteId,
        user_id: userId,
        option_id: optionId,
      });
      if (error) throw error;

      setVotes((items) =>
        items.map((it) =>
          it.vote.id === voteId ? { ...it, myOptionId: optionId, myResponseId: "tmp" } : it
        )
      );
    } catch (e) {
      console.error("submitVote error:", e);
      alert("Could not submit your vote. Please try again.");
    } finally {
      setSaving((p) => ({ ...p, [voteId]: false }));
    }
  }

  if (loading) return <p>Loading votes…</p>;
  if (votes.length === 0)
    return (
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-green-900">No open votes right now</h3>
        <p className="text-sm text-gray-600 mt-1">When a new vote opens, it will appear here.</p>
      </div>
    );

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {votes.map(({ vote: v, options, myOptionId }) => {
        const closes = v.cutoff_at ? new Date(v.cutoff_at).toLocaleString() : null;
        const hasVoted = Boolean(myOptionId);
        const horseName = v.horse_id ? horseNames[v.horse_id] || "Unnamed horse" : null; // 🐴

        return (
          <article key={v.id} className="bg-white rounded-xl border p-6 shadow-sm">
            {/* 🐴 Horse name prominently at top */}
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

            <fieldset className="mt-3 space-y-2" disabled={hasVoted}>
              {options.length === 0 ? (
                <p className="text-sm text-gray-600">No options configured.</p>
              ) : (
                options.map((opt) => (
                  <label key={opt.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={`vote-${v.id}`}
                      value={opt.id}
                      checked={(chosen[v.id] || "") === opt.id}
                      onChange={() => setChosen((p) => ({ ...p, [v.id]: opt.id }))}
                      disabled={hasVoted}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))
              )}
            </fieldset>

            <div className="mt-4 flex flex-wrap gap-2 items-center">
              {!hasVoted ? (
                <button
                  onClick={() => submitVote(v.id)}
                  disabled={!chosen[v.id] || saving[v.id]}
                  className="px-4 py-2 bg-green-900 text-white rounded disabled:opacity-50"
                >
                  {saving[v.id] ? "Submitting…" : "Submit vote"}
                </button>
              ) : (
                <span className="inline-flex items-center text-sm px-3 py-1 rounded bg-green-50 border border-green-200 text-green-800">
                  ✅ You voted for&nbsp;
                  <strong className="ml-1">
                    {options.find((o) => o.id === myOptionId)?.label || "your choice"}
                  </strong>
                </span>
              )}
            </div>

            <p className="mt-3 text-xs text-gray-500">Results are revealed when the vote closes.</p>
          </article>
        );
      })}
    </div>
  );
}

/* ----- Vote Results (closed votes only; show winner + horse name) ----- */
function VoteResults({ userId, ownedHorseIds, isAdmin }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [horseNames, setHorseNames] = useState({}); // 🐴

  useEffect(() => {
    async function load() {
      setLoading(true);

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
        setItems([]);
        setLoading(false);
        return;
      }

      const voteIds = (votes || []).map((v) => v.id);
      const horseIds = Array.from(new Set((votes || []).map((v) => v.horse_id).filter(Boolean)));
      if (horseIds.length) {
        const { data: horses } = await supabase.from("horses").select("id,name").in("id", horseIds);
        setHorseNames(Object.fromEntries((horses || []).map((h) => [h.id, h.name])));
      }

      const { data: options } = await supabase
        .from("vote_options")
        .select("id, vote_id, label")
        .in("vote_id", voteIds);

      const { data: responses } = await supabase
        .from("vote_responses")
        .select("vote_id, option_id")
        .in("vote_id", voteIds);

      const optsByVote = {};
      (options || []).forEach((o) => {
        (optsByVote[o.vote_id] = optsByVote[o.vote_id] || []).push(o);
      });

      const countsByVote = {};
      (responses || []).forEach((r) => {
        const bucket = (countsByVote[r.vote_id] = countsByVote[r.vote_id] || {});
        bucket[r.option_id] = (bucket[r.option_id] || 0) + 1;
      });

      const rows = (votes || []).map((v) => {
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
        };
      });

      setItems(rows);
      setLoading(false);
    }
    load();
  }, [userId, ownedHorseIds, isAdmin]);

  if (loading) return <p>Loading results…</p>;
  if (items.length === 0)
    return (
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-green-900">No results yet</h3>
        <p className="text-sm text-gray-600 mt-1">
          Results will appear here once votes close.
        </p>
      </div>
    );

  return (
    <div className="space-y-6">
      {items.map(({ vote: v, winnerLabels, closedAt }) => {
        const horseName = v.horse_id ? horseNames[v.horse_id] || "Unnamed horse" : null; // 🐴
        return (
          <article key={v.id} className="bg-white rounded-xl border p-6 shadow-sm">
            {horseName && (
              <h4 className="text-sm text-green-700 font-semibold mb-1">Horse: {horseName}</h4>
            )}

            <h3 className="text-lg font-semibold text-green-900">{v.title}</h3>
            {v.description && <p className="text-sm text-gray-700 mt-1">{v.description}</p>}
            {closedAt && <p className="text-xs text-gray-600 mt-1">Closed: {closedAt}</p>}

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
      const horseIds = Array.from(new Set((ups || []).map(u => u.horse_id))).filter(Boolean);
      let horseMap = {};
      if (horseIds.length) {
        const { data: horses, error: hErr } = await supabase
          .from("horses")
          .select("id, name, photo_url")
          .in("id", horseIds);
        if (!hErr && horses) {
          horseMap = Object.fromEntries(
            horses.map(h => [h.id, { name: h.name, photo_url: h.photo_url }])
          );
        }
      }

      setUpdates(
        (ups || []).map(u => ({
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
      <div className="rounded-xl border bg-white p-6 shadow-sm">
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
          <li key={u.id} className="bg-white rounded-xl border p-6 shadow-sm">
            {/* Top bar: Horse name (left) + time (right) */}
            <div className="flex items-baseline justify-between">
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-50 border border-green-200 text-green-800 text-xs font-semibold">
                {u.horse?.name || "(Unknown horse)"}
              </span>
              <span className="text-xs text-gray-500">{when}</span>
            </div>

            {/* Title */}
            <h3 className="mt-2 text-lg font-semibold text-green-900">{u.title}</h3>

            {/* Image (optional) */}
            {u.image_url && (
              <img
                src={u.image_url}
                alt=""
                className="mt-3 w-full max-h-64 object-cover rounded"
              />
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
   Renew Tab
   - Shows renewal windows for horses the user owns
   - Displays “X days left”
   - Shows price per share and total for user's shares
   - Sends confirmation email to the account holder after renewal
=========================== */
function RenewTab({ userId, owned = [], userEmailProp = "" }) {
  const [loading, setLoading] = useState(true);
  const [cycles, setCycles] = useState([]);
  const [userEmail, setUserEmail] = useState(userEmailProp || "");

  // currency (GBP)
  const gbp = useMemo(
    () => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }),
    []
  );
  const fmtMoney = (n) => {
    if (n === null || n === undefined || n === "" || Number.isNaN(Number(n))) return "—";
    return gbp.format(Number(n));
  };

  // Resolve logged-in user's email once (prefer prop, fallback to Supabase)
  useEffect(() => {
    (async () => {
      try {
        if (userEmailProp) {
          setUserEmail(userEmailProp);
          return;
        }
        const { data } = await supabase.auth.getUser();
        const email = data?.user?.email || "";
        setUserEmail(email);
      } catch {
        setUserEmail("");
      }
    })();
  }, [userEmailProp]);

  // Map horse_id -> shares owned, safe defaults
  const ownedByHorse = useMemo(() => {
    const safe = Array.isArray(owned) ? owned : [];
    return Object.fromEntries(
      safe
        .filter(o => o && o.horse && o.horse.id)
        .map(o => [o.horse.id, o.shares || 0])
    );
  }, [owned]);

  useEffect(() => {
    (async () => {
      setLoading(true);

      const safeOwned = Array.isArray(owned) ? owned : [];
      const horseIds = safeOwned
        .filter(o => o && o.horse && o.horse.id)
        .map(o => o.horse.id);

      if (!horseIds.length) {
        setCycles([]);
        setLoading(false);
        return;
      }

      // Pull price_per_share from SQL
      const { data: rc, error: rcErr } = await supabase
        .from("renew_cycles")
        .select("id,horse_id,term_label,renew_start,renew_end,status,price_per_share,notes")
        .in("horse_id", horseIds)
        .order("renew_end", { ascending: true });

      if (rcErr) console.error("[RenewTab] renew_cycles error:", rcErr);

      const list = rc || [];

      // Get horse details
      const { data: hs, error: hErr } = await supabase
        .from("horses")
        .select("id,name,photo_url")
        .in("id", Array.from(new Set(list.map(r => r.horse_id))));

      if (hErr) console.error("[RenewTab] horses error:", hErr);

      const horseMap = Object.fromEntries((hs || []).map(h => [h.id, h]));

      // Which renewals has this user already done?
      const cycleIds = list.map(r => r.id);
      const { data: myResp, error: rrErr } = await supabase
        .from("renew_responses")
        .select("renew_cycle_id")
        .eq("user_id", userId)
        .in("renew_cycle_id", cycleIds);

      if (rrErr) console.error("[RenewTab] renew_responses error:", rrErr);

      const renewedSet = new Set((myResp || []).map(x => x.renew_cycle_id));

      const now = Date.now();
      const enriched = list.map(c => {
        const startMs = new Date(c.renew_start).getTime();
        const endMs = new Date(c.renew_end).getTime();
        const openNow = c.status === "open" && now >= startMs && now <= endMs;
        const daysLeft = Math.max(0, Math.ceil((endMs - now) / (1000 * 60 * 60 * 24)));
        const ownedShares = ownedByHorse[c.horse_id] || 0;

        const price = c.price_per_share ?? null;
        const total = price != null ? Number(ownedShares) * Number(price) : null;

        return {
          cycle: c,
          horse: horseMap[c.horse_id] || { name: "(Horse)" },
          ownedShares,
          alreadyRenewed: renewedSet.has(c.id),
          openNow,
          daysLeft,
          price,        // price per share
          total,        // total price
        };
      });

      setCycles(enriched);
      setLoading(false);
    })();
  }, [userId, owned, ownedByHorse]);

  async function renew(c) {
    if (!c.ownedShares || c.ownedShares <= 0) {
      alert("You have no shares to renew for this horse.");
      return;
    }
    if (!c.openNow) {
      alert("This renewal window isn’t currently open.");
      return;
    }

    // 1) Record the renewal
    const { error } = await supabase.from("renew_responses").insert({
      renew_cycle_id: c.cycle.id,
      user_id: userId,
      shares: c.ownedShares,
    });

    if (error) {
      alert(error.message || "Could not record your renewal.");
      return;
    }

    // 2) Send the email — route name must match your file: /api/send-renewal-email
try {
  if (!userEmail) {
    console.warn("[RenewTab] No user email; skipping email.");
  } else {
    const displayName =
      (supabase.auth?.getUser && (await supabase.auth.getUser())?.data?.user?.user_metadata?.full_name) ||
      (supabase.auth?.getUser && (await supabase.auth.getUser())?.data?.user?.user_metadata?.name) ||
      (userEmail.split("@")[0]) ||
      "Owner";

    const resp = await fetch("/api/send-renewal-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: userEmail,
        horseName: c.horse?.name || "Horse",
        renewalPeriod: c.cycle?.term_label || null,
        amount: c.total ?? null,
        // NEW: pass the name so the API can use it
        name: displayName,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("Renewal email API error:", resp.status, text);
    } else {
      const j = await resp.json().catch(() => ({}));
      console.log("Renewal email sent:", j);
    }
  }
} catch (e) {
  console.error("[RenewTab] Email fetch failed:", e);
}

    // 3) Mark as renewed in UI
    setCycles(items =>
      items.map(it =>
        it.cycle.id === c.cycle.id ? { ...it, alreadyRenewed: true } : it
      )
    );
  }

  if (loading) return <p>Loading renewals…</p>;
  if (!cycles.length)
    return (
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-green-900">You have no horses to renew yet.</h3>
        <p className="text-sm text-gray-600 mt-1">
          When a renewal window opens, it’ll appear here.
        </p>
      </div>
    );

  return (
    <div className="space-y-4">
      {cycles.map(c => (
        <article key={c.cycle.id} className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              {c.horse?.photo_url && (
                <img
                  src={c.horse.photo_url}
                  alt={c.horse?.name || "Horse"}
                  className="w-14 h-14 rounded object-cover"
                />
              )}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-green-900">
                    {c.horse?.name || "Horse"}
                  </h3>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${
                      c.openNow
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : "bg-gray-50 border-gray-200 text-gray-700"
                    }`}
                  >
                    {c.openNow
                      ? "Open"
                      : c.cycle.status === "closed"
                      ? "Closed"
                      : "Scheduled"}
                  </span>
                  {c.cycle.term_label && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-50 border border-gray-200 text-gray-700">
                      {c.cycle.term_label}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  {new Date(c.cycle.renew_start).toLocaleString()} → {new Date(c.cycle.renew_end).toLocaleString()}
                </p>
                <div className="text-sm text-gray-700 mt-2 space-y-0.5">
                  <p>
                    You own <strong>{c.ownedShares}</strong> share{c.ownedShares === 1 ? "" : "s"} in this horse.
                  </p>
                  <p>Price per share: <strong>{fmtMoney(c.price)}</strong></p>
                  <p>Total for your shares: <strong>{fmtMoney(c.total)}</strong></p>
                  {c.cycle?.notes && (
                    <p className="text-xs text-gray-600 mt-1">{c.cycle.notes}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right">
              {c.openNow && !c.alreadyRenewed ? (
                <div>
                  <div className="text-sm text-gray-600 mb-1">
                    {c.daysLeft > 0 ? (
                      <>
                        <strong>{c.daysLeft}</strong> days left to renew
                      </>
                    ) : (
                      "Closes today"
                    )}
                  </div>
                  <button
                    onClick={() => renew(c)}
                    disabled={c.ownedShares <= 0}
                    className="px-4 py-2 bg-green-900 text-white rounded disabled:opacity-50"
                    title={
                      c.price != null
                        ? `Will email confirmation for ${fmtMoney(c.total)} (${fmtMoney(c.price)} × ${c.ownedShares})`
                        : undefined
                    }
                  >
                    Renew {c.ownedShares} share{c.ownedShares === 1 ? "" : "s"}
                    {c.price != null && <> — {fmtMoney(c.total)}</>}
                  </button>
                </div>
              ) : c.alreadyRenewed ? (
                <span className="inline-flex items-center px-3 py-1 rounded bg-green-50 border border-green-200 text-green-800 text-sm">
                  ✅ Renewal recorded
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded bg-gray-50 border border-gray-200 text-gray-700 text-sm">
                  Not open
                </span>
              )}
            </div>
          </div>
        </article>
      ))}
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

// ---- WalletTab (Recent activity with explicit timestamps & statuses) ----
function WalletTab({ userId: userIdProp }) {
  const [loading, setLoading] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);
  const [userId, setUserId] = useState(userIdProp || null);

  const [balance, setBalance] = useState(0);
  const [activity, setActivity] = useState([]);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false); // 🆕 new state
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
        const { data: tx } = await supabase
          .from("wallet_transactions")
          .select("amount, type, status, memo, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50);

        const txRows = tx || [];

        const postedCredits = txRows
          .filter(t => t.status === "posted" && t.type === "credit")
          .reduce((s, t) => s + Number(t.amount || 0), 0);
        const postedDebits = txRows
          .filter(t => t.status === "posted" && t.type === "debit")
          .reduce((s, t) => s + Number(t.amount || 0), 0);
        setBalance(Math.max(0, postedCredits - postedDebits));

        const creditEvents = txRows
          .filter(t => t.type === "credit")
          .map(t => ({
            kind: "credit",
            amount: Number(t.amount || 0),
            memo: t.memo || "Winnings",
            at: t.created_at,
          }));

        const { data: wr } = await supabase
          .from("wallet_withdrawals")
          .select("id, amount, status, created_at, processed_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50);

        const withdrawalEvents = (wr || []).map(r => ({
          kind: "withdrawal",
          amount: Number(r.amount || 0),
          status: r.status,
          requested_at: r.created_at,
          paid_at: r.processed_at || null,
        }));

        const merged = [...creditEvents, ...withdrawalEvents].sort((a, b) => {
          const ta = a.kind === "withdrawal" ? a.requested_at : a.at;
          const tb = b.kind === "withdrawal" ? b.requested_at : b.at;
          return new Date(tb) - new Date(ta);
        });

        setActivity(merged.slice(0, 20));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [userId]);

  function onChange(e) {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
  }

  async function handleWithdrawSubmit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");

    if (!confirming) {
      // First click: ask for confirmation
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
    <div id="panel-wallet" className="rounded-xl border bg-white p-6 shadow-sm">
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
                    className="mt-1 w-full border rounded px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  Account name
                  <input
                    name="account_name"
                    value={form.account_name}
                    onChange={onChange}
                    className="mt-1 w-full border rounded px-3 py-2"
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
                    className="mt-1 w-full border rounded px-3 py-2"
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
                    className="mt-1 w-full border rounded px-3 py-2"
                    placeholder="e.g. 12345678"
                  />
                </label>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  type="submit"
                  disabled={saving || !userId}
                  className={`px-4 py-2 text-white rounded ${
                    confirming
                      ? "bg-red-700 hover:bg-red-800"
                      : "bg-green-900 hover:bg-green-950"
                  } disabled:opacity-50`}
                >
                  {saving
                    ? "Processing…"
                    : confirming
                    ? "Confirm withdrawal"
                    : "Request withdrawal"}
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
                        <div className="font-medium text-emerald-700">+£{fmtGBP(ev.amount)}</div>
                        {ev.memo && <div className="text-xs text-gray-700 mt-0.5">{ev.memo}</div>}
                        <div className="text-xs text-gray-600 mt-0.5">
                          Winnings paid at — {fmtDate(ev.at)}
                        </div>
                      </li>
                    );
                  } else {
                    return (
                      <li key={i} className="py-2">
                        <div className="font-medium text-rose-700">−£{fmtGBP(ev.amount)}</div>
                        <div className="text-xs text-gray-600 mt-0.5">
                          Withdrawal request made — {fmtDate(ev.requested_at)}
                        </div>
                        {ev.paid_at && (
                          <div className="text-xs text-gray-600">Paid at — {fmtDate(ev.paid_at)}</div>
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
                  }
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}