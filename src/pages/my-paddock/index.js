// /src/pages/my-paddock.js
import Head from "next/head";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";

// Confetti must be client-only to avoid SSR window errors
const Confetti = dynamic(() => import("react-confetti"), { ssr: false });

/**
 * My Paddock
 * - Tabs: Owned | Wallet | Ballots | Voting | Updates
 * - Ballots sub-tabs: Open | My Results (reveal + confetti on win)
 * - Voting sub-tabs: Open | Results
 * - Updates feed shows admin-posted updates for horses the user owns
 */

// ----- small hook for confetti sizing -----
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

/* ===== Admin helper (to hide/show vote results while open) ===== */
const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function useIsAdmin(session) {
  const email = session?.user?.email?.toLowerCase()?.trim();
  return Boolean(email && ADMIN_EMAILS.includes(email));
}

export default function MyPaddock() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState("");

  // UI
  const [activeTab, setActiveTab] = useState("owned"); // owned | wallet | ballots | voting | updates

  // Data
  const [loadingOwned, setLoadingOwned] = useState(false);
  const [owned, setOwned] = useState([]); // [{ shares, horse: {...} }]
  const [ownedHorseIds, setOwnedHorseIds] = useState([]); // [uuid]

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
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
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

  // --- Derived stats ---
  const stats = useMemo(() => {
    const totalHorses = owned.length;
    const totalShares = owned.reduce((sum, o) => sum + (o.shares || 0), 0);
    return { totalHorses, totalShares };
  }, [owned]);

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
          <p className="text-gray-700 mb-6">Please sign in to access your owner dashboard.</p>
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
              Welcome back, <strong>{session.user.email}</strong>
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/horses" className="px-4 py-2 rounded-lg border text-green-900 hover:bg-gray-50">
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

        {/* Summary Cards */}
        <section className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard label="Horses owned" value={stats.totalHorses} />
          <StatCard label="Total shares" value={stats.totalShares} />
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
          </div>
        </section>

        {/* Tab Panels */}
        <section className="mt-6">
          {activeTab === "owned" && <OwnedTab loading={loadingOwned} owned={owned} />}
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
        </section>
      </main>
    </>
  );
}

/* ===========================
   Small UI helpers
=========================== */
function TabButton({ id, activeTab, setActiveTab, children }) {
  const isActive = activeTab === id;
  return (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-4 py-2 rounded-lg border transition ${
        isActive ? "bg-green-900 text-white border-green-900" : "bg-white text-green-900 border-gray-200 hover:bg-gray-50"
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
   Owned Tab
=========================== */
function OwnedTab({ loading, owned }) {
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

            <div className="mt-4 flex gap-2">
              <Link
                className="flex-1 px-3 py-2 text-sm rounded border hover:bg-gray-50 text-center"
                href={`/horses/${o.horse.id}`}
              >
                View updates
              </Link>
              <button className="flex-1 px-3 py-2 text-sm rounded border hover:bg-gray-50">
                Manage ballot
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

/* ===========================
   Wallet Tab (placeholder)
=========================== */
function WalletTab() {
  return (
    <div id="panel-wallet" className="rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-bold text-green-900 mb-2">Wallet</h2>
      <p className="text-gray-700">
        Your wallet will show your balance, payout history, and withdrawals. (We’ll wire this up when we add Stripe + a ledger.)
      </p>
      <div className="mt-4 grid sm:grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <div className="text-xs text-gray-500 uppercase">Balance</div>
          <div className="text-xl font-bold mt-1">£0.00</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-gray-500 uppercase">Pending Payouts</div>
          <div className="text-xl font-bold mt-1">£0.00</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-gray-500 uppercase">Withdrawable</div>
          <div className="text-xl font-bold mt-1">£0.00</div>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button className="px-4 py-2 rounded border hover:bg-gray-50">Add funds</button>
        <button className="px-4 py-2 rounded border hover:bg-gray-50">Withdraw</button>
      </div>
    </div>
  );
}

/* ===========================
   BALLOTS SECTION
   Sub-tabs: open | results
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

      {sub === "open" && <OpenBallots userId={userId} ownedHorseIds={ownedHorseIds} />}
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
        active ? "bg-green-900 text-white border-green-900" : "bg-white text-green-900 border-gray-200 hover:bg-gray-50"
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

  useEffect(() => {
    async function load() {
      setLoading(true);

      if (!ownedHorseIds || ownedHorseIds.length === 0) {
        setOpenBallots([]);
        setMyEntries(new Set());
        setEntryCounts({});
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

        return (
          <article key={b.id} className="bg-white rounded-xl border p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-green-900">{b.title}</h3>
            <p className="text-sm text-gray-600 mt-1">
              {typeLabel}
              {b.event_date ? ` • ${new Date(b.event_date).toLocaleDateString()}` : ""}
              {isClosedByTime ? " • Closed" : ""}
            </p>
            {b.description && <p className="text-sm text-gray-700 mt-2">{b.description}</p>}
            <div className="mt-3 text-xs text-gray-600">
              <div>Closes: <strong>{new Date(b.cutoff_at).toLocaleString()}</strong></div>
              {b.max_winners > 0 && <div>Winners: <strong>{b.max_winners}</strong></div>}
              <div>Entries so far: <strong>{cnt}</strong></div>
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
      // 1) my results (winner/unsuccessful)
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

      // 2) fetch ballots for those ids; then resolve horses separately
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
                  <div className="font-medium">
                    {b.title}{" "}
                    <span className="text-xs text-gray-500">
                      ({typeLabel}) {b.event_date ? `• ${new Date(b.event_date).toLocaleDateString()}` : ""}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600">
                    {horse?.name ? `Horse: ${horse.name} • ` : ""}
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
          Cast your vote on key decisions. Results remain hidden while a vote is open (admins only).
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
  const [votes, setVotes] = useState([]); // [{vote, options:[], myResponseId, myOptionId}]
  const [saving, setSaving] = useState({}); // vote_id -> bool
  const [chosen, setChosen] = useState({}); // vote_id -> option_id

  useEffect(() => {
    async function load() {
      setLoading(true);

      if (!ownedHorseIds || ownedHorseIds.length === 0) {
        setVotes([]);
        setLoading(false);
        return;
      }

      // Open votes that are either club-wide or for horses the owner has.
      // Include votes with no cutoff OR cutoff in the future.
      const nowIso = new Date().toISOString();
      const { data: openVotes } = await supabase
        .from("votes")
        .select("id, horse_id, title, description, status, cutoff_at, created_at")
        .eq("status", "open")
        .or(`horse_id.in.(${ownedHorseIds.join(",")}),horse_id.is.null`)
        .or(`cutoff_at.is.null,cutoff_at.gte.${nowIso}`)
        .order("created_at", { ascending: false })
        .limit(20);

      const voteIds = (openVotes || []).map(v => v.id);
      if (voteIds.length === 0) {
        setVotes([]);
        setLoading(false);
        return;
      }

      // Options
      const { data: allOptions } = await supabase
        .from("vote_options")
        .select("id, vote_id, label")
        .in("vote_id", voteIds);

      const optionsByVote = {};
      (allOptions || []).forEach(o => {
        optionsByVote[o.vote_id] = optionsByVote[o.vote_id] || [];
        optionsByVote[o.vote_id].push(o);
      });

      // My responses (if any)
      const { data: my } = await supabase
        .from("vote_responses")
        .select("id, vote_id, option_id")
        .eq("user_id", userId)
        .in("vote_id", voteIds);

      const myByVote = {};
      (my || []).forEach(r => (myByVote[r.vote_id] = r));

      setVotes(
        (openVotes || []).map(v => ({
          vote: v,
          options: optionsByVote[v.id] || [],
          myResponseId: myByVote[v.id]?.id || null,
          myOptionId: myByVote[v.id]?.option_id || null,
        }))
      );

      // If user already voted, prefill chosen (but UI will be locked anyway)
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
    if (!optionId) {
      alert("Please select an option.");
      return;
    }
    setSaving(p => ({ ...p, [voteId]: true }));
    try {
      // If a response already exists, DO NOT allow updates (one-shot rule)
      const { data: existing } = await supabase
        .from("vote_responses")
        .select("id")
        .eq("vote_id", voteId)
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        alert("Your vote is already recorded and cannot be changed.");
        return;
      }

      const { error } = await supabase.from("vote_responses").insert({
        vote_id: voteId,
        user_id: userId,
        option_id: optionId,
      });
      if (error) throw error;

      // reflect locally (lock the UI)
      setVotes(items =>
        items.map(it =>
          it.vote.id === voteId
            ? { ...it, myOptionId: optionId, myResponseId: "tmp" }
            : it
        )
      );
    } catch (e) {
      console.error("submitVote error:", e);
      alert("Could not submit your vote. Please try again.");
    } finally {
      setSaving(p => ({ ...p, [voteId]: false }));
    }
  }

  if (loading) return <p>Loading votes…</p>;
  if (votes.length === 0)
    return (
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-green-900">No open votes right now</h3>
        <p className="text-sm text-gray-600 mt-1">
          When a new vote opens, it will appear here.
        </p>
      </div>
    );

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {votes.map(({ vote: v, options, myOptionId }) => {
        const closes = v.cutoff_at ? new Date(v.cutoff_at).toLocaleString() : null;
        const hasVoted = Boolean(myOptionId);

        return (
          <article key={v.id} className="bg-white rounded-xl border p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-green-900">{v.title}</h3>
            {v.description && (
              <p className="text-sm text-gray-700 mt-1">{v.description}</p>
            )}
            <div className="text-xs text-gray-600 mt-2">
              {v.horse_id ? <>Horse-specific</> : <>Club-wide</>}
              {closes ? <> • Closes: <strong>{closes}</strong></> : null}
            </div>

            <fieldset className="mt-3 space-y-2" disabled={hasVoted}>
              {options.length === 0 ? (
                <p className="text-sm text-gray-600">No options configured.</p>
              ) : (
                options.map(opt => (
                  <label key={opt.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={`vote-${v.id}`}
                      value={opt.id}
                      checked={(chosen[v.id] || "") === opt.id}
                      onChange={() => setChosen(p => ({ ...p, [v.id]: opt.id }))}
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
                    {options.find(o => o.id === myOptionId)?.label || "your choice"}
                  </strong>
                </span>
              )}

              {v.horse_id && (
                <Link
                  href={`/horses/${v.horse_id}`}
                  className="px-4 py-2 border rounded text-green-900 hover:bg-green-50"
                >
                  View horse
                </Link>
              )}
            </div>

            {/* While open, do NOT show results to owners */}
            <p className="mt-3 text-xs text-gray-500">
              Results are revealed when the vote closes.
            </p>
          </article>
        );
      })}
    </div>
  );
}

/* -/* ----- Vote Results (closed votes only; hide counts; show winner only) ----- */
function VoteResults({ userId, ownedHorseIds, isAdmin }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]); // [{ vote, winnerLabels: string[], closedAt?: string }]

  useEffect(() => {
    async function load() {
      setLoading(true);

      if (!ownedHorseIds || ownedHorseIds.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      // Show ONLY CLOSED votes here (no live results in My Paddock).
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
      if (voteIds.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      // Options for these votes
      const { data: options, error: optErr } = await supabase
        .from("vote_options")
        .select("id, vote_id, label")
        .in("vote_id", voteIds);

      if (optErr) {
        console.error(optErr);
        setItems([]);
        setLoading(false);
        return;
      }

      // All responses (we won't display counts—just need to find the winner)
      const { data: responses, error: respErr } = await supabase
        .from("vote_responses")
        .select("vote_id, option_id")
        .in("vote_id", voteIds);

      if (respErr) {
        console.error(respErr);
        setItems([]);
        setLoading(false);
        return;
      }

      // Group helpers
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

        // Compute winner(s) without exposing numbers
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
          winnerLabels: winners, // empty => no votes; >1 => tie
          closedAt: v.cutoff_at ? new Date(v.cutoff_at).toLocaleString() : null,
        };
      });

      setItems(rows);
      setLoading(false);
    }
    load();
    // isAdmin is unused here intentionally (no live results in My Paddock)
  }, [userId, ownedHorseIds, isAdmin]);

  if (loading) return <p>Loading results…</p>;
  if (items.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-green-900">No results yet</h3>
        <p className="text-sm text-gray-600 mt-1">
          Results will appear here once votes close.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {items.map(({ vote: v, winnerLabels, closedAt }) => (
        <article key={v.id} className="bg-white rounded-xl border p-6 shadow-sm">
          <div className="flex items-baseline justify-between">
            <h3 className="text-lg font-semibold text-green-900">{v.title}</h3>
            <span className="text-xs uppercase tracking-wide text-gray-500">
              {v.horse_id ? "Horse-specific" : "Club-wide"} • closed
            </span>
          </div>

          {v.description && (
            <p className="text-sm text-gray-700 mt-1">{v.description}</p>
          )}
          {closedAt && (
            <p className="text-xs text-gray-600 mt-1">Closed: {closedAt}</p>
          )}

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
      ))}
    </div>
  );
}

/* ===========================
   Updates Tab (owner-only feed)
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
      {updates.map((u) => (
        <li key={u.id} className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            {u.horse?.photo_url && (
              <img
                src={u.horse.photo_url}
                alt={u.horse?.name || "Horse"}
                className="w-16 h-16 object-cover rounded"
              />
            )}
            <div className="flex-1">
              <h4 className="font-semibold text-green-900">{u.title}</h4>
              {u.body && (
                <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{u.body}</p>
              )}
              <p className="text-xs text-gray-500 mt-2">
                {u.horse?.name ? `${u.horse.name} • ` : ""}
                {new Date(u.published_at || u.created_at).toLocaleString()}
              </p>
              {u.horse_id && (
                <div className="mt-2">
                  <Link
                    href={`/horses/${u.horse_id}`}
                    className="px-3 py-1 border rounded text-sm text-green-900 hover:bg-green-50"
                  >
                    View horse
                  </Link>
                </div>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
