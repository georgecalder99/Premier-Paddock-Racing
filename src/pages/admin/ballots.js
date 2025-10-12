/* eslint-disable @next/next/no-img-element */
// src/pages/admin/ballots.js
import { useEffect, useMemo, useState, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";

/**
 * ADMIN
 * - Protected by allow-list (env: NEXT_PUBLIC_ADMIN_EMAILS)
 * - Create ballots
 * - Manage ballots (Open / Close / Run draw via RPC)
 * - Post & manage horse updates (create/edit/delete last 20)
 * - List all horses (search) + edit/delete
 * - Create/Edit horses (rich fields) + set featured slots 1/2/3 (unique)
 */

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "you@example.com")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export default function AdminPage() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  const [editingHorseId, setEditingHorseId] = useState(null);
  const [horsesRefreshKey, setHorsesRefreshKey] = useState(0);

  const isAdmin = useMemo(() => {
    const email = session?.user?.email?.toLowerCase();
    return !!email && ADMIN_EMAILS.includes(email);
  }, [session]);

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);
      setReady(true);
    }
    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setSession(s)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready)
    return (
      <main className="max-w-5xl mx-auto px-6 py-12">Loading…</main>
    );

  if (!session) {
    return (
      <main className="max-w-md mx-auto px-6 py-12">
        <Head>
          <title>Admin | Premier Paddock Racing</title>
        </Head>
        <h1 className="text-2xl font-bold mb-4">Admin sign in</h1>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={[]}
        />
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-12">
        <Head>
          <title>No access • Admin</title>
        </Head>
        <h1 className="text-2xl font-bold text-red-700">Access denied</h1>
        <p className="mt-2 text-gray-700">
          Your account <strong>{session.user.email}</strong> is not allowed
          here.
        </p>
        <p className="mt-2 text-sm text-gray-600">
          Add your email to{" "}
          <code>NEXT_PUBLIC_ADMIN_EMAILS</code> in{" "}
          <code>.env.local</code>.
        </p>
        <div className="mt-6">
          <Link href="/" className="text-green-800 underline">
            ← Back to home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-10">
      <Head>
        <title>Admin | Premier Paddock Racing</title>
        <meta name="robots" content="noindex" />
      </Head>

      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-green-900">Admin</h1>
          <p className="text-sm text-gray-600">
            Signed in as <strong>{session.user.email}</strong>
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/my-paddock"
            className="px-4 py-2 rounded-lg border text-green-900 hover:bg-gray-50"
          >
            My Paddock
          </Link>
          <button
            onClick={() => supabase.auth.signOut()}
            className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
          >
            Sign out
          </button>
        </div>
      </header>

     {/* Cards grid */}
<div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
  <CreateBallotCard />
  <RecentBallotsCard />

  {/* NEW voting admin cards */}
  <CreateVoteCard />
  <ManageVotesCard />

  {/* Wallet admin tools */}
<RaceWinningsCreditCard />
<PayoutRequestsAdminCard />

  {/* ✅ Add this */}
  <ManageRenewalsCard />

  <AdminUpdatesCard />

  {/* All horses list + rich editor */}
  <AllHorsesCard
    onEdit={(id) => setEditingHorseId(id)}
    onCreateNew={() => setEditingHorseId(null)}
    refreshKey={horsesRefreshKey}
    onRefreshed={() => {}}
  />
  <HorseEditorCard
    horseId={editingHorseId}
    setHorseId={setEditingHorseId}
    onSaved={() => setHorsesRefreshKey((k) => k + 1)}
  />
</div>
    </main>
  );
}

/* ===========================
   Create ballot
=========================== */
function CreateBallotCard() {
  const [horses, setHorses] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [form, setForm] = useState({
    type: "badge",
    horse_id: "",
    title: "",
    description: "",
    event_date: "",
    cutoff_at: "",
    max_winners: 1,
    status: "open",
  });

  useEffect(() => {
    async function loadHorses() {
      const { data } = await supabase
        .from("horses")
        .select("id,name")
        .order("name", { ascending: true });
      setHorses(data || []);
    }
    loadHorses();
  }, []);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setMsg("");
    setSaving(true);
    try {
      if (!form.title.trim()) return setMsg("Please add a title.");
      if (!form.cutoff_at) return setMsg("Please set a cutoff date & time.");

      const payload = {
        type: form.type,
        horse_id: form.horse_id || null,
        title: form.title.trim(),
        description: form.description?.trim() || null,
        event_date: form.event_date || null,
        cutoff_at: new Date(form.cutoff_at).toISOString(),
        max_winners: Math.max(1, Number(form.max_winners || 0)),
        status: form.status,
      };

      const { error } = await supabase.from("ballots").insert(payload);
      if (error) throw error;

      setMsg("✅ Ballot created.");
      setForm((p) => ({ ...p, title: "", description: "", event_date: "", max_winners: 1 }));
    } catch (err) {
      console.error(err);
      setMsg("Failed to create ballot. " + (err?.message || ""));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-white rounded-xl border shadow-sm p-6">
      <h2 className="text-xl font-semibold text-green-900">Create a ballot</h2>
      <p className="text-sm text-gray-600 mt-1">Publish owners’ badge or stable visit ballots.</p>

      <form onSubmit={submit} className="mt-4 grid gap-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Type</label>
            <select name="type" value={form.type} onChange={onChange} className="mt-1 w-full border rounded px-3 py-2" required>
              <option value="badge">Owners’ badges</option>
              <option value="stable">Stable visit</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Horse (optional)</label>
            <select name="horse_id" value={form.horse_id} onChange={onChange} className="mt-1 w-full border rounded px-3 py-2">
              <option value="">— None —</option>
              {horses.map((h) => <option value={h.id} key={h.id}>{h.name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Title</label>
          <input name="title" value={form.title} onChange={onChange} className="mt-1 w-full border rounded px-3 py-2" placeholder="Owners’ Badges — Newbury Races" required />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea name="description" value={form.description} onChange={onChange} className="mt-1 w-full border rounded px-3 py-2" rows={3} />
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Event date</label>
            <input type="date" name="event_date" value={form.event_date} onChange={onChange} className="mt-1 w-full border rounded px-3 py-2" placeholder="YYYY-MM-DD" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Cutoff (local)</label>
            <input type="datetime-local" name="cutoff_at" value={form.cutoff_at} onChange={onChange} className="mt-1 w-full border rounded px-3 py-2" required />
            <p className="text-xs text-gray-500 mt-1">Converted to UTC automatically.</p>
          </div>
          <div>
            <label className="block text-sm text-gray-700">Winners</label>
            <input type="number" name="max_winners" value={form.max_winners} onChange={onChange} min={1} className="mt-1 w-full border rounded px-3 py-2" />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <select name="status" value={form.status} onChange={onChange} className="mt-1 w-full border rounded px-3 py-2">
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="drawn">Drawn</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="px-5 py-2 bg-green-900 text-white rounded disabled:opacity-50">
            {saving ? "Creating…" : "Create ballot"}
          </button>
          {msg && <span className="text-sm">{msg}</span>}
        </div>
      </form>
    </section>
  );
}
/* ===========================
   Recent ballots (list + status + RUN DRAW via RPC)
   + horse name display
   + Edit / Delete inline
=========================== */
function RecentBallotsCard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState({});
  const [filter, setFilter] = useState("open");
  const [running, setRunning] = useState({});
  const [message, setMessage] = useState("");
  const [entryCounts, setEntryCounts] = useState({});
  const [openRow, setOpenRow] = useState(null);
  const [resultsByBallot, setResultsByBallot] = useState({});
  const [horseNames, setHorseNames] = useState({});

  // for Edit
  const [horses, setHorses] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    type: "badge",
    horse_id: "",
    title: "",
    description: "",
    event_date: "",
    cutoff_at: "",
    max_winners: 1,
    status: "open",
  });

  // Load horses once (for edit dropdown)
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("horses").select("id,name").order("name");
      setHorses(data || []);
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");

    let query = supabase
      .from("ballots")
      .select("id,horse_id,type,title,cutoff_at,status,event_date,max_winners,description")
      .order("created_at", { ascending: false })
      .limit(30);

    if (filter !== "all") query = query.eq("status", filter);

    const { data: ballots } = await query;
    setItems(ballots || []);

    // horse name map
    const horseIds = Array.from(new Set((ballots || []).map(b => b.horse_id).filter(Boolean)));
    if (horseIds.length) {
      const { data: hs } = await supabase
        .from("horses")
        .select("id,name")
        .in("id", horseIds);
      setHorseNames(Object.fromEntries((hs || []).map(h => [h.id, h.name])));
    } else {
      setHorseNames({});
    }

    // entry counts per ballot
    const ids = (ballots || []).map((b) => b.id);
    if (ids.length > 0) {
      const pairs = await Promise.all(
        ids.map(async (id) => {
          const { count } = await supabase
            .from("ballot_entries")
            .select("*", { count: "exact", head: true })
            .eq("ballot_id", id);
          return [id, count || 0];
        })
      );
      setEntryCounts(Object.fromEntries(pairs));
    } else {
      setEntryCounts({});
    }

    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(id, status) {
    setUpdating((p) => ({ ...p, [id]: true }));
    setMessage("");
    try {
      const { error } = await supabase.from("ballots").update({ status }).eq("id", id);
      if (error) throw error;
      await load();
    } catch {
      alert("Could not update status.");
    } finally {
      setUpdating((p) => ({ ...p, [id]: false }));
    }
  }

  async function loadResults(ballotId) {
    const { data } = await supabase
      .from("ballot_results")
      .select("user_id,result")
      .eq("ballot_id", ballotId);

    const winners = (data || []).filter((r) => r.result === "winner").map((r) => r.user_id);
    const unsuccessfulCount = (data || []).filter((r) => r.result !== "winner").length;
    setResultsByBallot((p) => ({ ...p, [ballotId]: { winners, unsuccessfulCount } }));
  }

  async function runDraw(ballotId) {
    setRunning((p) => ({ ...p, [ballotId]: true }));
    setMessage("");
    try {
      const { error } = await supabase.rpc("run_ballot_draw", { p_ballot_id: ballotId });
      if (error) throw error;

      const { count: winnersCount } = await supabase
        .from("ballot_results")
        .select("*", { count: "exact", head: true })
        .eq("ballot_id", ballotId)
        .eq("result", "winner");

      setMessage(`Draw complete. Winners: ${winnersCount ?? 0}.`);
      await load();
      if (openRow === ballotId) await loadResults(ballotId);
    } catch (e) {
      console.error("Run draw failed:", e);
      alert("Draw failed. Check console and that the DB function/policies exist.");
    } finally {
      setRunning((p) => ({ ...p, [ballotId]: false }));
    }
  }

  // ---- Edit helpers ----
  function beginEdit(b) {
    setEditingId(b.id);
    setEditForm({
      type: b.type || "badge",
      horse_id: b.horse_id || "",
      title: b.title || "",
      description: b.description || "",
      event_date: b.event_date ? new Date(b.event_date).toISOString().slice(0, 10) : "",
      cutoff_at: b.cutoff_at ? new Date(b.cutoff_at).toISOString().slice(0, 16) : "",
      max_winners: b.max_winners ?? 1,
      status: b.status || "open",
    });
  }

  function onEditChange(e) {
    const { name, value } = e.target;
    setEditForm((p) => ({ ...p, [name]: value }));
  }

  async function saveEdit(id) {
    setEditSaving(true);
    try {
      if (!editForm.title.trim()) throw new Error("Please add a title.");
      if (!editForm.cutoff_at) throw new Error("Please set a cutoff date & time.");

      const payload = {
        type: editForm.type,
        horse_id: editForm.horse_id || null,
        title: editForm.title.trim(),
        description: editForm.description?.trim() || null,
        event_date: editForm.event_date ? new Date(editForm.event_date).toISOString() : null,
        cutoff_at: new Date(editForm.cutoff_at).toISOString(),
        max_winners: Math.max(1, Number(editForm.max_winners || 0)),
        status: editForm.status,
      };

      const { error } = await supabase.from("ballots").update(payload).eq("id", id);
      if (error) throw error;

      setEditingId(null);
      await load();
    } catch (e) {
      alert(e.message || "Failed to save ballot.");
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteBallot(id) {
    if (!confirm("Delete this ballot? This will also remove its entries and results.")) return;
    try {
      const { error } = await supabase.rpc("admin_delete_ballot", { p_ballot_id: id });
      if (error) throw error;
      await load();
    } catch (e) {
      console.error("[deleteBallot]", e);
      alert(e.message || "Failed to delete ballot.");
    }
  }

  return (
    <section className="bg-white rounded-xl border shadow-sm p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-green-900">Recent ballots</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Filter:</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="drawn">Drawn</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      {message && <p className="mt-2 text-sm text-green-700">{message}</p>}

      {loading ? (
        <p className="mt-4 text-gray-600">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-gray-600">No ballots yet.</p>
      ) : (
        <ul className="mt-4 divide-y">
          {items.map((b) => {
            const entries = entryCounts[b.id] ?? 0;
            const expanded = openRow === b.id;
            const results = resultsByBallot[b.id];
            const isDrawn = b.status === "drawn";
            const horseName = b.horse_id ? (horseNames[b.horse_id] || "—") : "—";
            const isEditing = editingId === b.id;

            return (
              <li key={b.id} className="py-3">
                {!isEditing ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">
                          {b.title}{" "}
                          <span className="text-xs text-gray-500">
                            ({b.type}) {b.event_date ? `• ${new Date(b.event_date).toLocaleDateString()}` : ""}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600">
                          Horse: <strong>{horseName}</strong> • Closes {new Date(b.cutoff_at).toLocaleString()} • Status:{" "}
                          <span className="uppercase tracking-wide font-semibold">{b.status}</span>{" "}
                          • Entries: <strong>{entries}</strong>
                        </div>
                      </div>

                      {/* Actions row */}
                      <div className="flex items-center gap-2">
                        {/* Show OPEN only when currently closed (and not drawing/drawn) */}
                        {b.status === "closed" && !running[b.id] && !isDrawn && (
                          <button
                            onClick={() => updateStatus(b.id, "open")}
                            disabled={updating[b.id]}
                            className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
                          >
                            Open
                          </button>
                        )}

                        {/* Show CLOSE only when currently open (and not drawing/drawn) */}
                        {b.status === "open" && !running[b.id] && !isDrawn && (
                          <button
                            onClick={() => updateStatus(b.id, "closed")}
                            disabled={updating[b.id]}
                            className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
                          >
                            Close
                          </button>
                        )}

                        {/* Run draw (only available when not drawn yet) */}
                        <button
                          onClick={() => runDraw(b.id)}
                          disabled={running[b.id] || isDrawn}
                          className="px-3 py-1 border rounded text-sm hover:bg-gray-50 disabled:opacity-50"
                          title={isDrawn ? "Already drawn" : "Run draw"}
                        >
                          {running[b.id] ? "Running…" : "Run draw"}
                        </button>

                        {/* Winners toggle appears only after draw is complete */}
                        {isDrawn && (
                          <button
                            onClick={async () => {
                              const next = expanded ? null : b.id;
                              setOpenRow(next);
                              if (next && !resultsByBallot[b.id]) await loadResults(b.id);
                            }}
                            className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
                          >
                            {expanded ? "Hide winners" : "View winners"}
                          </button>
                        )}

                        {/* Edit / Delete */}
                        <button
                          onClick={() => beginEdit(b)}
                          className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteBallot(b.id)}
                          className="px-3 py-1 border rounded text-sm text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="mt-3 ml-1 rounded-lg border bg-gray-50 p-3">
                        {!results ? (
                          <p className="text-sm text-gray-600">Loading results…</p>
                        ) : results.winners.length === 0 ? (
                          <p className="text-sm text-gray-600">
                            No winners recorded for this draw.
                            {entries > 0 ? ` (${results.unsuccessfulCount} unsuccessful entries)` : ""}
                          </p>
                        ) : (
                          <>
                            <p className="text-sm text-gray-800 font-medium">Winners ({results.winners.length})</p>
                            <ul className="mt-1 text-sm text-gray-800 list-disc list-inside">
                              {results.winners.map((uid) => (
                                <li key={uid}><span className="font-mono text-xs">{uid}</span></li>
                              ))}
                            </ul>
                            <p className="text-xs text-gray-600 mt-2">Unsuccessful entries: {results.unsuccessfulCount}</p>
                          </>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  // Inline edit card
                  <div className="rounded-lg border bg-gray-50 p-3">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <label className="text-sm">
                        Type
                        <select
                          name="type"
                          value={editForm.type}
                          onChange={onEditChange}
                          className="mt-1 w-full border rounded px-3 py-2"
                        >
                          <option value="badge">Owners’ badges</option>
                          <option value="stable">Stable visit</option>
                        </select>
                      </label>
                      <label className="text-sm">
                        Horse (optional)
                        <select
                          name="horse_id"
                          value={editForm.horse_id}
                          onChange={onEditChange}
                          className="mt-1 w-full border rounded px-3 py-2"
                        >
                          <option value="">— None —</option>
                          {horses.map((h) => (
                            <option key={h.id} value={h.id}>{h.name}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="text-sm block mt-2">
                      Title
                      <input
                        name="title"
                        value={editForm.title}
                        onChange={onEditChange}
                        className="mt-1 w-full border rounded px-3 py-2"
                      />
                    </label>

                    <label className="text-sm block mt-2">
                      Description
                      <textarea
                        name="description"
                        value={editForm.description}
                        onChange={onEditChange}
                        rows={3}
                        className="mt-1 w-full border rounded px-3 py-2"
                      />
                    </label>

                    <div className="grid sm:grid-cols-3 gap-3 mt-2">
                      <label className="text-sm">
                        Event date
                        <input
                          type="date"
                          name="event_date"
                          value={editForm.event_date}
                          onChange={onEditChange}
                          className="mt-1 w-full border rounded px-3 py-2"
                        />
                      </label>
                      <label className="text-sm">
                        Cutoff (local)
                        <input
                          type="datetime-local"
                          name="cutoff_at"
                          value={editForm.cutoff_at}
                          onChange={onEditChange}
                          className="mt-1 w-full border rounded px-3 py-2"
                        />
                      </label>
                      <label className="text-sm">
                        Winners
                        <input
                          type="number"
                          name="max_winners"
                          min={1}
                          value={editForm.max_winners}
                          onChange={onEditChange}
                          className="mt-1 w-full border rounded px-3 py-2"
                        />
                      </label>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3 mt-2">
                      <label className="text-sm">
                        Status
                        <select
                          name="status"
                          value={editForm.status}
                          onChange={onEditChange}
                          className="mt-1 w-full border rounded px-3 py-2"
                        >
                          <option value="open">Open</option>
                          <option value="closed">Closed</option>
                          <option value="drawn">Drawn</option>
                        </select>
                      </label>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => saveEdit(b.id)}
                        disabled={editSaving}
                        className="px-3 py-1 bg-green-900 text-white rounded text-sm disabled:opacity-50"
                      >
                        {editSaving ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1 border rounded text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ===========================
   Post + Manage Horse Updates (ADMIN)
=========================== */
function AdminUpdatesCard() {
  const [horses, setHorses] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [recent, setRecent] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    horse_id: "",
    title: "",
    body: "",
    image_url: "",
    published_at: "",
  });

  const [form, setForm] = useState({
    horse_id: "",
    title: "",
    body: "",
    image_url: "",
    published_at: "",
  });

  // Load horses + recent updates
  useEffect(() => {
    async function load() {
      const { data: h } = await supabase
        .from("horses")
        .select("id,name")
        .order("name");
      setHorses(h || []);
      await refreshRecent();
    }
    load();
  }, []);

  async function refreshRecent() {
    setLoadingRecent(true);
    const { data: ups, error } = await supabase
      .from("horse_updates")
      .select("id, horse_id, title, body, image_url, published_at, created_at")
      .order("published_at", { ascending: false, nullsFirst: false })
.order("id", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[AdminUpdatesCard] load recent error:", error);
      setRecent([]);
      setLoadingRecent(false);
      return;
    }

    const horseIds = Array.from(new Set((ups || []).map((u) => u.horse_id))).filter(Boolean);
    let horseMap = {};
    if (horseIds.length) {
      const { data: h } = await supabase
        .from("horses")
        .select("id,name")
        .in("id", horseIds);
      horseMap = Object.fromEntries((h || []).map((x) => [x.id, x.name]));
    }

    setRecent(
      (ups || []).map((u) => ({
        ...u,
        horse_name: horseMap[u.horse_id] ?? "(Unknown horse)",
      }))
    );
    setLoadingRecent(false);
  }

  function onChange(e) {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  }

  // ✅ Direct insert instead of RPC — with auto timestamp fallback
  async function submit(e) {
    e.preventDefault();
    setMsg("");
    setSaving(true);
    try {
      if (!form.horse_id) return setMsg("Please select a horse.");
      if (!form.title.trim()) return setMsg("Please add a title.");

      const payload = {
        horse_id: form.horse_id,
        title: form.title.trim(),
        body: form.body?.trim() || null,
        image_url: form.image_url?.trim() || null,
        // ⬇️ if no published_at provided, use now()
        published_at: form.published_at
          ? new Date(form.published_at).toISOString()
          : new Date().toISOString(),
      };

      const { error } = await supabase.from("horse_updates").insert(payload);
      if (error) throw error;

      setMsg("✅ Update published.");
      setForm({
        horse_id: "",
        title: "",
        body: "",
        image_url: "",
        published_at: "",
      });
      await refreshRecent();
    } catch (err) {
      console.error("[AdminUpdatesCard] publish error:", err);
      setMsg("Failed to publish update. " + (err?.message || ""));
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(u) {
    setEditingId(u.id);
    setEditForm({
      horse_id: u.horse_id || "",
      title: u.title || "",
      body: u.body || "",
      image_url: u.image_url || "",
      published_at: u.published_at
        ? new Date(u.published_at).toISOString().slice(0, 16)
        : "",
    });
  }

  async function saveEdit(id) {
    const payload = {
      horse_id: editForm.horse_id || null,
      title: editForm.title?.trim() || null,
      body: editForm.body?.trim() || null,
      image_url: editForm.image_url?.trim() || null,
      // ⬇️ fallback to now() if no date
      published_at: editForm.published_at
        ? new Date(editForm.published_at).toISOString()
        : new Date().toISOString(),
    };
    const { error } = await supabase
      .from("horse_updates")
      .update(payload)
      .eq("id", id);
    if (error) {
      alert("Could not save update. " + error.message);
      return;
    }
    setEditingId(null);
    await refreshRecent();
  }

  async function deleteUpdate(id) {
    if (!confirm("Delete this update?")) return;
    const { error } = await supabase
      .from("horse_updates")
      .delete()
      .eq("id", id);
    if (error) {
      alert("Could not delete update. " + error.message);
      return;
    }
    await refreshRecent();
  }

  return (
    <section className="bg-white rounded-xl border shadow-sm p-6 lg:col-span-2">
      <h2 className="text-xl font-semibold text-green-900">Post horse update</h2>
      <p className="text-sm text-gray-600 mt-1">
        Owners will see these in My Paddock → Updates (for horses they own).
      </p>

      {/* Create form */}
      <form onSubmit={submit} className="mt-4 grid gap-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block text-sm">
            Horse
            <select
              name="horse_id"
              value={form.horse_id}
              onChange={onChange}
              className="mt-1 w-full border rounded px-3 py-2"
              required
            >
              <option value="">— Select horse —</option>
              {horses.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Publish time (optional)
            <input
              type="datetime-local"
              name="published_at"
              value={form.published_at}
              onChange={onChange}
              className="mt-1 w-full border rounded px-3 py-2"
            />
          </label>
        </div>

        <label className="block text-sm">
          Title
          <input
            name="title"
            value={form.title}
            onChange={onChange}
            className="mt-1 w-full border rounded px-3 py-2"
            placeholder="Entered for Newbury, Sat 15th"
            required
          />
        </label>

        <label className="block text-sm">
          Body (optional)
          <textarea
            name="body"
            value={form.body}
            onChange={onChange}
            rows={4}
            className="mt-1 w-full border rounded px-3 py-2"
            placeholder="Trainer update, declarations, race recap, etc."
          />
        </label>

        <label className="block text-sm">
          Image URL (optional)
          <input
            name="image_url"
            value={form.image_url}
            onChange={onChange}
            className="mt-1 w-full border rounded px-3 py-2"
            placeholder="https://…"
          />
        </label>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-green-900 text-white rounded disabled:opacity-50"
          >
            {saving ? "Publishing…" : "Publish update"}
          </button>
          {msg && <span className="text-sm">{msg}</span>}
        </div>
      </form>

      {/* Recent updates (editable) */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-green-900">
          Recent updates (last 20)
        </h3>
        {loadingRecent ? (
          <p className="mt-2 text-gray-600">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="mt-2 text-gray-600">No updates yet.</p>
        ) : (
          <ul className="mt-3 grid md:grid-cols-2 gap-4">
            {recent.map((u) => {
              const isEditing = editingId === u.id;
              return (
                <li
                  key={u.id}
                  className="rounded-lg border bg-white p-4 shadow-sm"
                >
                  {!isEditing ? (
                    <>
                      <div className="text-xs text-gray-500">
                        {new Date(u.published_at || u.created_at).toLocaleString()}
                      </div>
                      <div className="font-semibold mt-1">{u.title}</div>
                      <div className="text-sm text-gray-600">
                        Horse: <strong>{u.horse_name}</strong>
                      </div>
                      {u.image_url && (
                        <img
                          src={u.image_url}
                          alt=""
                          className="mt-2 h-28 w-full object-cover rounded"
                        />
                      )}
                      {u.body && (
                        <p className="text-sm text-gray-700 mt-2 line-clamp-3">
                          {u.body}
                        </p>
                      )}
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => beginEdit(u)}
                          className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteUpdate(u.id)}
                          className="px-3 py-1 border rounded text-sm text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-xs text-gray-500">Editing…</div>
                      <div className="grid gap-2 mt-2">
                        <label className="block text-sm">
                          Horse
                          <select
                            value={editForm.horse_id}
                            onChange={(e) =>
                              setEditForm((p) => ({
                                ...p,
                                horse_id: e.target.value,
                              }))
                            }
                            className="mt-1 w-full border rounded px-3 py-2"
                          >
                            <option value="">— Select horse —</option>
                            {horses.map((h) => (
                              <option key={h.id} value={h.id}>
                                {h.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-sm">
                          Title
                          <input
                            value={editForm.title}
                            onChange={(e) =>
                              setEditForm((p) => ({
                                ...p,
                                title: e.target.value,
                              }))
                            }
                            className="mt-1 w-full border rounded px-3 py-2"
                          />
                        </label>
                        <label className="block text-sm">
                          Body
                          <textarea
                            value={editForm.body}
                            onChange={(e) =>
                              setEditForm((p) => ({
                                ...p,
                                body: e.target.value,
                              }))
                            }
                            rows={3}
                            className="mt-1 w-full border rounded px-3 py-2"
                          />
                        </label>
                        <label className="block text-sm">
                          Image URL
                          <input
                            value={editForm.image_url}
                            onChange={(e) =>
                              setEditForm((p) => ({
                                ...p,
                                image_url: e.target.value,
                              }))
                            }
                            className="mt-1 w-full border rounded px-3 py-2"
                          />
                        </label>
                        <label className="block text-sm">
                          Publish time
                          <input
                            type="datetime-local"
                            value={editForm.published_at}
                            onChange={(e) =>
                              setEditForm((p) => ({
                                ...p,
                                published_at: e.target.value,
                              }))
                            }
                            className="mt-1 w-full border rounded px-3 py-2"
                          />
                        </label>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => saveEdit(u.id)}
                          className="px-3 py-1 bg-green-900 text-white rounded text-sm"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1 border rounded text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
/* ===========================
   All Horses list (search + edit/delete + featured info)
=========================== */
function AllHorsesCard({ onEdit, onCreateNew, refreshKey }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("horses")
      .select("id,name,trainer,share_price,featured_position,created_at")
      .order("created_at", { ascending: false });
    const { data } = await query;
    setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) =>
        r.name?.toLowerCase().includes(term) ||
        r.trainer?.toLowerCase().includes(term)
    );
  }, [rows, q]);

  async function del(id) {
    if (!confirm("Delete this horse? This cannot be undone.")) return;
    const { error } = await supabase.from("horses").delete().eq("id", id);
    if (error) {
      alert(
        error.message ||
          "Could not delete horse (it may have related records)."
      );
      return;
    }
    await load();
  }

  // 📥 Download owner emails for a given horse
  function downloadEmails(horse) {
    const link = document.createElement("a");
    link.href = `/api/download-owner-emails?horse_id=${horse.id}`;
    link.download = `owner_emails_${horse.name}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <section className="bg-white rounded-xl border shadow-sm p-6 lg:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-green-900">All horses</h2>
        <div className="flex items-center gap-2">
          <input
            placeholder="Search by name/trainer…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm"
          />
          <button
            onClick={() => onCreateNew()}
            className="px-3 py-1.5 bg-green-900 text-white rounded text-sm"
          >
            + Create new
          </button>
        </div>
      </div>

      {loading ? (
        <p className="mt-3 text-gray-600">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-3 text-gray-600">No horses.</p>
      ) : (
        <ul className="mt-4 divide-y">
          {filtered.map((h) => (
            <li
              key={h.id}
              className="py-3 flex items-center justify-between gap-3"
            >
              <div>
                <div className="font-medium">
                  {h.name}{" "}
                  <span className="text-xs text-gray-500">
                    {h.trainer ? `• ${h.trainer}` : ""}{" "}
                    {h.share_price ? `• £${h.share_price}/share` : ""}
                  </span>
                </div>
                <div className="text-xs text-gray-600">
                  Featured: {h.featured_position ? `#${h.featured_position}` : "—"}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onEdit(h.id)}
                  className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => del(h.id)}
                  className="px-3 py-1 border rounded text-sm text-red-700 hover:bg-red-50"
                >
                  Delete
                </button>
                <button
                  onClick={() => downloadEmails(h)}
                  className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
                >
                  📥 Download emails
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ===========================
   Create OR Edit Horse (rich)
=========================== */
function HorseEditorCard({ horseId, setHorseId, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [loadingExisting, setLoadingExisting] = useState(false);

  const [form, setForm] = useState({
    // basics
    name: "",
    trainer: "",
    specialty: "",
    share_price: 60,
    total_shares: 3200,
    photo_url: "",
    photos_csv: "",
    // content
    description: "",
    trainer_bio: "",
    trainer_photo_url: "",
    // costs
    horse_value: "",
    training_vet: "",
    insurance_race: "",
    management_fee: "",
    contingency: "",
    breakdown_total: "",
    // breeding & form
    sire: "",
    dam: "",
    damsire: "",
    foaled: "",
    sex: "",
    color: "",
    breeder: "",
    form_text: "",
    // featured
    featured_position: "", // "", "1", "2", "3"
  });

  // load existing when horseId changes
  useEffect(() => {
    async function loadExisting() {
      if (!horseId) {
        setForm((f) => ({ ...f, name: "", trainer: "", specialty: "", share_price: 60, total_shares: 3200, photo_url: "", photos_csv: "", description: "", trainer_bio: "", trainer_photo_url: "", horse_value: "", training_vet: "", insurance_race: "", management_fee: "", contingency: "", breakdown_total: "", sire: "", dam: "", damsire: "", foaled: "", sex: "", color: "", breeder: "", form_text: "", featured_position: "" }));
        setMsg("");
        setLoadingExisting(false);
        return;
      }
      setLoadingExisting(true);
      const { data: h, error } = await supabase
        .from("horses")
        .select("*, featured_position")
        .eq("id", horseId)
        .maybeSingle();
      if (error || !h) {
        setMsg("Could not load horse.");
        setLoadingExisting(false);
        return;
      }
      setForm({
        name: h.name || "",
        trainer: h.trainer || "",
        specialty: h.specialty || "",
        share_price: h.share_price ?? 60,
        total_shares: h.total_shares ?? 3200,
        photo_url: h.photo_url || "",
        photos_csv: h.photos_csv || "",
        description: h.description || "",
        trainer_bio: h.trainer_bio || "",
        trainer_photo_url: h.trainer_photo_url || "",
        horse_value: h.horse_value ?? "",
        training_vet: h.training_vet ?? "",
        insurance_race: h.insurance_race ?? "",
        management_fee: h.management_fee ?? "",
        contingency: h.contingency ?? "",
        breakdown_total: h.breakdown_total ?? "",
        sire: h.sire || "",
        dam: h.dam || "",
        damsire: h.damsire || "",
        foaled: h.foaled || "",
        sex: h.sex || "",
        color: h.color || "",
        breeder: h.breeder || "",
        form_text: h.form_text || "",
        featured_position: h.featured_position ? String(h.featured_position) : "",
      });
      setLoadingExisting(false);
      setMsg("");
    }
    loadExisting();
  }, [horseId]);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMsg("");

    try {
      if (!form.name.trim()) {
        setMsg("Please add a horse name.");
        setSaving(false);
        return;
      }

      const payload = {
        name: form.name.trim(),
        trainer: form.trainer?.trim() || null,
        specialty: form.specialty?.trim() || null,
        share_price: Number(form.share_price || 0),
        total_shares: Number(form.total_shares || 0),
        photo_url: form.photo_url?.trim() || null,
        photos_csv: form.photos_csv?.trim() || null,
        description: form.description?.trim() || null,
        trainer_bio: form.trainer_bio?.trim() || null,
        trainer_photo_url: form.trainer_photo_url?.trim() || null,
        horse_value: form.horse_value === "" ? null : Number(form.horse_value),
        training_vet: form.training_vet === "" ? null : Number(form.training_vet),
        insurance_race: form.insurance_race === "" ? null : Number(form.insurance_race),
        management_fee: form.management_fee === "" ? null : Number(form.management_fee),
        contingency: form.contingency === "" ? null : Number(form.contingency),
        breakdown_total: form.breakdown_total === "" ? null : Number(form.breakdown_total),
        sire: form.sire?.trim() || null,
        dam: form.dam?.trim() || null,
        damsire: form.damsire?.trim() || null,
        foaled: form.foaled?.trim() || null,
        sex: form.sex?.trim() || null,
        color: form.color?.trim() || null,
        breeder: form.breeder?.trim() || null,
        form_text: form.form_text?.trim() || null,
        featured_position: form.featured_position ? Number(form.featured_position) : null,
      };

      // ensure featured slot uniqueness (clear previous holder)
      if (payload.featured_position === 1 || payload.featured_position === 2 || payload.featured_position === 3) {
        const slot = payload.featured_position;
        // Clear any other horse in this slot
        const q = supabase.from("horses").update({ featured_position: null }).eq("featured_position", slot);
        if (horseId) q.neq("id", horseId);
        await q;
      }

      if (horseId) {
        const { error } = await supabase.from("horses").update(payload).eq("id", horseId);
        if (error) throw error;
        setMsg("✅ Saved changes.");
      } else {
        const { data, error } = await supabase.from("horses").insert(payload).select("id").single();
        if (error) throw error;
        setMsg("✅ Horse created.");
        setHorseId(data?.id || null);
      }

      onSaved?.();
    } catch (err) {
      console.error(err);
      setMsg("Failed to save horse. " + (err?.message || ""));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-white rounded-xl border shadow-sm p-6 lg:col-span-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-green-900">
          {horseId ? "Edit horse" : "Create horse"}
        </h2>
        {horseId && (
          <button
            onClick={() => setHorseId(null)}
            className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50"
          >
            + New horse
          </button>
        )}
      </div>

      {loadingExisting ? (
        <p className="mt-3 text-gray-600">Loading horse…</p>
      ) : (
        <form onSubmit={save} className="mt-4 grid gap-5">
          {/* Basics */}
          <div className="grid md:grid-cols-2 gap-4">
            <label className="block text-sm">
              Name
              <input name="name" value={form.name} onChange={onChange} className="mt-1 w-full border rounded px-3 py-2" required />
            </label>
            <label className="block text-sm">
              Trainer
              <input name="trainer" value={form.trainer} onChange={onChange} className="mt-1 w-full border rounded px-3 py-2" />
            </label>
            <label className="block text-sm">
              Specialty
              <input name="specialty" value={form.specialty} onChange={onChange} className="mt-1 w-full border rounded px-3 py-2" placeholder="e.g. Flat / Jumps" />
            </label>
            <label className="block text-sm">
              Trainer Photo URL
              <input name="trainer_photo_url" value={form.trainer_photo_url} onChange={onChange} className="mt-1 w-full border rounded px-3 py-2" placeholder="https://…" />
            </label>
          </div>

          <div className="grid md:grid-cols-4 gap-4">
            <label className="block text-sm">
              Share price (£)
              <input type="number" min="0" name="share_price" value={form.share_price} onChange={onChange} className="mt-1 w-full border rounded px-3 py-2" />
            </label>
            <label className="block text-sm">
              Total shares
              <input type="number" min="0" name="total_shares" value={form.total_shares} onChange={onChange} className="mt-1 w-full border rounded px-3 py-2" />
            </label>
            <label className="block text-sm">
              Main Photo URL
              <input name="photo_url" value={form.photo_url} onChange={onChange} className="mt-1 w-full border rounded px-3 py-2" placeholder="https://…" />
            </label>
            <label className="block text-sm">
              Extra Photos (CSV)
              <input name="photos_csv" value={form.photos_csv} onChange={onChange} className="mt-1 w-full border rounded px-3 py-2" placeholder="https://a.jpg, https://b.jpg, https://c.jpg" />
            </label>
          </div>

          {/* Content */}
          <div className="grid md:grid-cols-2 gap-4">
            <label className="block text-sm">
              About the horse
              <textarea name="description" value={form.description} onChange={onChange} rows={5} className="mt-1 w-full border rounded px-3 py-2" placeholder="Big description…" />
            </label>
            <label className="block text-sm">
              Trainer bio
              <textarea name="trainer_bio" value={form.trainer_bio} onChange={onChange} rows={5} className="mt-1 w-full border rounded px-3 py-2" placeholder="Trainer background…" />
            </label>
          </div>

          {/* Costs */}
          <div className="bg-gray-50 rounded-lg border p-4">
            <h3 className="font-semibold text-green-900">Share breakdown & costs</h3>
            <div className="grid md:grid-cols-3 gap-3 mt-3">
              <NumField label="Horse value" name="horse_value" value={form.horse_value} onChange={onChange} />
              <NumField label="Training & vet bills" name="training_vet" value={form.training_vet} onChange={onChange} />
              <NumField label="Insurance & race fees" name="insurance_race" value={form.insurance_race} onChange={onChange} />
              <NumField label="Management fee" name="management_fee" value={form.management_fee} onChange={onChange} />
              <NumField label="Contingency" name="contingency" value={form.contingency} onChange={onChange} />
              <NumField label="Total (optional)" name="breakdown_total" value={form.breakdown_total} onChange={onChange} />
            </div>
          </div>

          {/* Breeding + Form */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid md:grid-cols-2 gap-3">
              <TextField label="Sire" name="sire" value={form.sire} onChange={onChange} />
              <TextField label="Dam" name="dam" value={form.dam} onChange={onChange} />
              <TextField label="Damsire" name="damsire" value={form.damsire} onChange={onChange} />
              <TextField label="Foaled" name="foaled" value={form.foaled} onChange={onChange} />
              <TextField label="Sex" name="sex" value={form.sex} onChange={onChange} />
              <TextField label="Colour" name="color" value={form.color} onChange={onChange} />
              <TextField label="Breeder" name="breeder" value={form.breeder} onChange={onChange} />
            </div>
            <label className="block text-sm">
              Recent form
              <textarea name="form_text" value={form.form_text} onChange={onChange} rows={6} className="mt-1 w-full border rounded px-3 py-2" />
            </label>
          </div>

          {/* Featured slot */}
          <div className="grid sm:grid-cols-3 gap-4">
            <label className="block text-sm">
              Featured slot (home)
              <select
                name="featured_position"
                value={form.featured_position}
                onChange={onChange}
                className="mt-1 w-full border rounded px-3 py-2"
              >
                <option value="">Don’t show</option>
                <option value="1">Position #1</option>
                <option value="2">Position #2</option>
                <option value="3">Position #3</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Setting a slot will clear any previous horse in that slot.</p>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="px-5 py-2 bg-green-900 text-white rounded disabled:opacity-50">
              {saving ? "Saving…" : (horseId ? "Save changes" : "Create horse")}
            </button>
            {msg && <span className="text-sm">{msg}</span>}
          </div>
        </form>
      )}
    </section>
  );
}

/* ===== Small field helpers ===== */
function NumField({ label, name, value, onChange }) {
  return (
    <label className="block text-sm">
      {label}
      <input type="number" step="0.01" name={name} value={value} onChange={onChange} className="mt-1 w-full border rounded px-3 py-2" />
    </label>
  );
}
function TextField({ label, name, value, onChange }) {
  return (
    <label className="block text-sm">
      {label}
      <input name={name} value={value} onChange={onChange} className="mt-1 w-full border rounded px-3 py-2" />
    </label>
  );
}

/* ===========================
   CREATE VOTE (admin) — safe
=========================== */
function CreateVoteCard() {
  const [horses, setHorses] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [form, setForm] = useState({
    horse_id: "",
    title: "",
    description: "",
    cutoff_at: "",
    status: "open", // open|closed
  });

  const [options, setOptions] = useState(["", ""]); // 2–10 options

  useEffect(() => {
    async function loadHorses() {
      const { data, error } = await supabase.from("horses").select("id,name").order("name");
      if (error) {
        console.error("[CreateVoteCard] load horses error:", error);
        setErr(error.message || String(error));
      }
      setHorses(data || []);
    }
    loadHorses();
  }, []);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  }

  function setOption(idx, value) {
    setOptions((arr) => {
      const next = [...arr];
      next[idx] = value;
      return next;
    });
  }

  function addOption() {
    setOptions((arr) => (arr.length >= 10 ? arr : [...arr, ""]));
  }

  function removeOption(idx) {
    setOptions((arr) => (arr.length <= 2 ? arr : arr.filter((_, i) => i !== idx)));
  }

  async function submit(e) {
    e.preventDefault();
    setMsg("");
    setErr("");
    setSaving(true);
    try {
      const labels = options.map((o) => o.trim()).filter(Boolean);
      if (!form.title.trim()) throw new Error("Please add a vote title.");
      if (labels.length < 2) throw new Error("Please provide at least two options.");
      if (labels.length > 10) throw new Error("Maximum of 10 options.");

      // Create vote
      const payload = {
        horse_id: form.horse_id || null,
        title: form.title.trim(),
        description: form.description?.trim() || null,
        status: form.status,
        cutoff_at: form.cutoff_at ? new Date(form.cutoff_at).toISOString() : null,
      };
      const { data: vote, error: vErr } = await supabase
        .from("votes")
        .insert(payload)
        .select("id")
        .single();
      if (vErr) throw vErr;

      // Create options
      const toInsert = labels.map((label) => ({ vote_id: vote.id, label }));
      const { error: oErr } = await supabase.from("vote_options").insert(toInsert);
      if (oErr) throw oErr;

      setMsg("✅ Vote created.");
      setForm({ horse_id: "", title: "", description: "", cutoff_at: "", status: "open" });
      setOptions(["", ""]);
    } catch (e) {
      console.error("[CreateVoteCard] submit error:", e);
      setErr(e.message || "Failed to create vote.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-white rounded-xl border shadow-sm p-6">
      <h2 className="text-xl font-semibold text-green-900">Create a vote</h2>
      <p className="text-sm text-gray-600 mt-1">
        Engage your owners. Set a question and up to 10 options. Linked to a horse (optional).
      </p>
      {err && <p className="mt-2 text-sm text-red-600">Error: {err}</p>}
      {msg && <p className="mt-2 text-sm text-green-700">{msg}</p>}

      <form onSubmit={submit} className="mt-4 grid gap-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block text-sm">
            Horse (optional)
            <select
              name="horse_id"
              value={form.horse_id}
              onChange={onChange}
              className="mt-1 w-full border rounded px-3 py-2"
            >
              <option value="">— None —</option>
              {horses.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Cutoff (local)
            <input
              type="datetime-local"
              name="cutoff_at"
              value={form.cutoff_at}
              onChange={onChange}
              className="mt-1 w-full border rounded px-3 py-2"
            />
          </label>
        </div>

        <label className="block text-sm">
          Title
          <input
            name="title"
            value={form.title}
            onChange={onChange}
            className="mt-1 w-full border rounded px-3 py-2"
            placeholder="Your horse, your say — Where should we target next?"
            required
          />
        </label>

        <label className="block text-sm">
          Description (optional)
          <textarea
            name="description"
            value={form.description}
            onChange={onChange}
            rows={3}
            className="mt-1 w-full border rounded px-3 py-2"
            placeholder="Add any context you want owners to read before voting."
          />
        </label>

        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">Options</label>
            <div className="flex items-center gap-2">
              <label className="text-sm">
                Status{" "}
                <select
                  name="status"
                  value={form.status}
                  onChange={onChange}
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>
              </label>
              <button
                type="button"
                onClick={addOption}
                className="px-3 py-1.5 bg-green-900 text-white rounded text-sm disabled:opacity-50"
                disabled={options.length >= 10}
              >
                + Add option
              </button>
            </div>
          </div>

          <div className="mt-2 grid gap-2">
            {options.map((opt, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  value={opt}
                  onChange={(e) => setOption(i, e.target.value)}
                  className="flex-1 border rounded px-3 py-2"
                  placeholder={`Option ${i + 1}`}
                  required
                />
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  className="px-3 py-2 border rounded text-sm hover:bg-gray-50 disabled:opacity-50"
                  disabled={options.length <= 2}
                  title={options.length <= 2 ? "Need at least two options" : "Remove"}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-green-900 text-white rounded disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create vote"}
          </button>
        </div>
      </form>
    </section>
  );
}

/* ===========================
   MANAGE VOTES (admin)
   - List open/closed/all
   - Open/close, delete
   - Live results (admins can see even while open)
=========================== */
function ManageVotesCard() {
  const [filter, setFilter] = useState("open"); // open|closed|all
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [horsesById, setHorsesById] = useState({});
  const [optionsByVote, setOptionsByVote] = useState({});
  const [countsByOption, setCountsByOption] = useState({});
  const [updating, setUpdating] = useState({});
  const [openRow, setOpenRow] = useState(null); // expanded vote id

  const load = useCallback(async () => {
    setLoading(true);

    // 1) votes
    let q = supabase
      .from("votes")
      .select("id,horse_id,title,description,status,cutoff_at,created_at")
      .order("created_at", { ascending: false })
      .limit(40);

    if (filter !== "all") q = q.eq("status", filter);

    const { data: votes, error: vErr } = await q;
    if (vErr) {
      console.error("[ManageVotes] votes error:", vErr);
      setRows([]);
      setOptionsByVote({});
      setCountsByOption({});
      setHorsesById({});
      setLoading(false);
      return;
    }
    const list = votes || [];
    setRows(list);

    // 2) horse names (map id -> name)
    const horseIds = Array.from(new Set(list.map((v) => v.horse_id))).filter(Boolean);
    if (horseIds.length) {
      const { data: hs, error: hErr } = await supabase
        .from("horses")
        .select("id,name")
        .in("id", horseIds);
      if (!hErr && hs) {
        setHorsesById(Object.fromEntries(hs.map((h) => [h.id, h.name])));
      } else {
        setHorsesById({});
      }
    } else {
      setHorsesById({});
    }

    // 3) options for these votes
    const voteIds = list.map((v) => v.id);
    let optionIds = [];
    if (voteIds.length) {
      const { data: opts, error: oErr } = await supabase
        .from("vote_options")
        .select("id,vote_id,label")
        .in("vote_id", voteIds)
        .order("id", { ascending: true });

      if (oErr) {
        console.error("[ManageVotes] options error:", oErr);
        setOptionsByVote({});
        setCountsByOption({});
        setLoading(false);
        return;
      }

      const byVote = {};
      (opts || []).forEach((o) => {
        (byVote[o.vote_id] ||= []).push(o);
        optionIds.push(o.id);
      });
      setOptionsByVote(byVote);
    } else {
      setOptionsByVote({});
    }

    // 4) counts per option (from vote_responses)
    if (optionIds.length) {
      const { data: responses, error: rErr } = await supabase
        .from("vote_responses")
        .select("option_id")
        .in("option_id", optionIds);

      if (rErr) {
        console.error("[ManageVotes] responses error:", rErr);
        setCountsByOption({});
        setLoading(false);
        return;
      }

      const counts = {};
      (responses || []).forEach((r) => {
        counts[r.option_id] = (counts[r.option_id] || 0) + 1;
      });
      setCountsByOption(counts);
    } else {
      setCountsByOption({});
    }

    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(voteId, status) {
    setUpdating((p) => ({ ...p, [voteId]: true }));
    try {
      const { error } = await supabase.from("votes").update({ status }).eq("id", voteId);
      if (error) throw error;
      await load();
    } catch (e) {
      console.error("[ManageVotes] updateStatus error:", e);
      alert("Could not update status.");
    } finally {
      setUpdating((p) => ({ ...p, [voteId]: false }));
    }
  }

  async function deleteVote(voteId) {
    if (!confirm("Delete this vote? This will also remove its options and votes.")) return;
    const { error } = await supabase.from("votes").delete().eq("id", voteId);
    if (error) {
      alert(error.message || "Could not delete vote.");
      return;
    }
    await load();
  }

  return (
    <section className="bg-white rounded-xl border shadow-sm p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-green-900">Manage votes</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Filter:</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 text-gray-600">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-gray-600">No votes yet.</p>
      ) : (
        <ul className="mt-4 divide-y">
          {rows.map((v) => {
            const expanded = openRow === v.id;
            const opts = optionsByVote[v.id] || [];
            const total = opts.reduce((sum, o) => sum + (countsByOption[o.id] || 0), 0);
            return (
              <li key={v.id} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{v.title}</div>
                    <div className="text-xs text-gray-600">
                      {v.horse_id ? `Horse: ${horsesById[v.horse_id] || "—"} • ` : ""}
                      Status: <span className="uppercase tracking-wide font-semibold">{v.status}</span>{" "}
                      • Cutoff: {v.cutoff_at ? new Date(v.cutoff_at).toLocaleString() : "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateStatus(v.id, "open")}
                      disabled={updating[v.id]}
                      className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
                    >
                      Open
                    </button>
                    <button
                      onClick={() => updateStatus(v.id, "closed")}
                      disabled={updating[v.id]}
                      className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => setOpenRow(expanded ? null : v.id)}
                      className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
                    >
                      {expanded ? "Hide results" : "View results"}
                    </button>
                    <button
                      onClick={() => deleteVote(v.id)}
                      className="px-3 py-1 border rounded text-sm text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="mt-3 rounded-lg border bg-gray-50 p-3">
                    {opts.length === 0 ? (
                      <p className="text-sm text-gray-600">No options found.</p>
                    ) : (
                      <ul className="grid sm:grid-cols-2 gap-2">
                        {opts.map((o) => {
                          const c = countsByOption[o.id] || 0;
                          const pct = total > 0 ? Math.round((c / total) * 100) : 0;
                          return (
                            <li key={o.id} className="rounded border bg-white p-3">
                              <div className="text-sm font-medium text-gray-800">{o.label}</div>
                              <div className="text-xs text-gray-600 mt-1">
                                {c} vote{c === 1 ? "" : "s"} {total > 0 ? `• ${pct}%` : ""}
                              </div>
                              <div className="mt-2 h-2 bg-gray-200 rounded">
                                <div
                                  className="h-2 bg-green-600 rounded"
                                  style={{ width: `${pct}%` }}
                                  aria-label={`${pct}%`}
                                />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <div className="text-xs text-gray-600 mt-3">
                      Total votes: <strong>{total}</strong>
                      <span className="ml-2 text-[11px] text-gray-500">
                        (Admins can see live results even while open)
                      </span>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
/* ===========================
   RENEWALS (ADMIN) — horse name + shares count + edit/delete + process (persisted)
=========================== */
function ManageRenewalsCard() {
  const [horses, setHorses] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // processing UI
  const [processingId, setProcessingId] = useState(null);

  // create form
  const [form, setForm] = useState({
    horse_id: "",
    term_label: "",
    renew_start: "",
    renew_end: "",
    notes: "",
  });

  // edit form
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    horse_id: "",
    term_label: "",
    renew_start: "",
    renew_end: "",
    notes: "",
    status: "open",
  });

  useEffect(() => {
    (async () => {
      const { data: hs } = await supabase
        .from("horses")
        .select("id,name")
        .order("name");
      setHorses(hs || []);
      await load();
    })();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("renew_cycles")
        .select("id,horse_id,term_label,renew_start,renew_end,status,notes,created_at,processed_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const list = data || [];
      if (list.length === 0) {
        setRows([]);
        return;
      }

      // horse_id -> name
      const horseIds = Array.from(new Set(list.map(r => r.horse_id))).filter(Boolean);
      let horseMap = {};
      if (horseIds.length) {
        const { data: hs } = await supabase
          .from("horses")
          .select("id,name")
          .in("id", horseIds);
        horseMap = Object.fromEntries((hs || []).map(h => [h.id, h.name]));
      }

      // sum renewed shares per cycle
      const ids = list.map(r => r.id);
      let sharesByCycle = {};
      if (ids.length) {
        const { data: resp, error: rErr } = await supabase
          .from("renew_responses")
          .select("renew_cycle_id, shares")
          .in("renew_cycle_id", ids);
        if (rErr) throw rErr;

        sharesByCycle = (resp || []).reduce((acc, r) => {
          const n = Number(r.shares ?? 0);
          acc[r.renew_cycle_id] = (acc[r.renew_cycle_id] || 0) + n;
          return acc;
        }, {});
      }

      setRows(
        list.map(r => ({
          ...r,
          horse_name: horseMap[r.horse_id] || "(Unknown horse)",
          renew_count: sharesByCycle[r.id] || 0, // total shares renewed
        }))
      );
    } catch (e) {
      console.error("[ManageRenewalsCard] load error:", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  function onChange(e) {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
  }

  async function createCycle(e) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      if (!form.horse_id) throw new Error("Select a horse");
      if (!form.renew_start || !form.renew_end) throw new Error("Set start/end dates");
      const payload = {
        horse_id: form.horse_id,
        term_label: form.term_label?.trim() || null,
        renew_start: new Date(form.renew_start).toISOString(),
        renew_end: new Date(form.renew_end).toISOString(),
        notes: form.notes?.trim() || null,
        status: "open",
      };
      const { error } = await supabase.from("renew_cycles").insert(payload);
      if (error) throw error;

      setMsg("✅ Renewal window created & opened.");
      setForm({ horse_id: "", term_label: "", renew_start: "", renew_end: "", notes: "" });
      await load();
    } catch (e) {
      alert(e.message || "Failed to create renewal");
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(row) {
    setEditingId(row.id);
    setEditForm({
      horse_id: row.horse_id || "",
      term_label: row.term_label || "",
      renew_start: row.renew_start ? new Date(row.renew_start).toISOString().slice(0, 16) : "",
      renew_end: row.renew_end ? new Date(row.renew_end).toISOString().slice(0, 16) : "",
      notes: row.notes || "",
      status: row.status || "open",
    });
  }

  async function saveEdit(id) {
    try {
      if (!editForm.horse_id) throw new Error("Select a horse");
      if (!editForm.renew_start || !editForm.renew_end) throw new Error("Set start/end dates");
      const payload = {
        horse_id: editForm.horse_id,
        term_label: editForm.term_label?.trim() || null,
        renew_start: new Date(editForm.renew_start).toISOString(),
        renew_end: new Date(editForm.renew_end).toISOString(),
        notes: editForm.notes?.trim() || null,
        status: editForm.status,
      };
      const { error } = await supabase.from("renew_cycles").update(payload).eq("id", id);
      if (error) throw error;
      setEditingId(null);
      await load();
    } catch (e) {
      alert(e.message || "Failed to save changes");
    }
  }

  async function closeCycle(id) {
    if (!confirm("Close this renewal window?")) return;
    const { error } = await supabase.from("renew_cycles").update({ status: "closed" }).eq("id", id);
    if (error) return alert(error.message || "Failed to close.");
    await load();
  }

  async function deleteCycle(id) {
    if (!confirm("Delete this renewal window? This cannot be undone.")) return;
    const { error } = await supabase.from("renew_cycles").delete().eq("id", id);
    if (error) return alert(error.message || "Failed to delete.");
    await load();
  }

  // Apply renew decisions to ownerships (RPC), then persist processed_at so it sticks after reload
  async function processCycle(id) {
    // Already processed? (DB-backed)
    const row = rows.find(r => r.id === id);
    if (row?.processed_at) return;

    if (
      !confirm(
        "This will update ownerships for this renewal window:\n" +
        "• Set each owner’s shares to the renewed amount\n" +
        "• Delete owners who didn’t renew\n\nProceed?"
      )
    ) return;

    setProcessingId(id);
    try {
      // 1) Run your SQL function that adjusts ownerships
      const { data, error } = await supabase.rpc("process_renew_cycle", { p_cycle_id: id });
      if (error) throw error;

      // 2) Mark as processed in DB so UI persists after refresh
      const { error: markErr } = await supabase
        .from("renew_cycles")
        .update({
          processed_at: new Date().toISOString(),
          // processed_by: (await supabase.auth.getUser())?.data?.user?.id || null, // if you added processed_by
        })
        .eq("id", id);
      if (markErr) throw markErr;

      // 3) Show summary
      const summary = (data || []).map(r => `${r.action}: ${r.affected}`).join("\n");
      alert(`✅ Processing complete.\n\n${summary}`);

      await load(); // will now show the button as "Processed" (disabled)
    } catch (e) {
      alert(e.message || "Failed to process renewals.");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <section className="bg-white rounded-xl border shadow-sm p-6">
      <h2 className="text-xl font-semibold text-green-900">Renewals</h2>
      <p className="text-sm text-gray-600 mt-1">
        Create, edit, close or delete renewal windows after a syndicate term ends.
      </p>

      {/* Create */}
      <form onSubmit={createCycle} className="mt-4 grid gap-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm">
            Horse
            <select
              name="horse_id"
              value={form.horse_id}
              onChange={onChange}
              className="mt-1 w-full border rounded px-3 py-2"
              required
            >
              <option value="">— Select horse —</option>
              {horses.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </label>
          <label className="text-sm">
            Term label (optional)
            <input
              name="term_label"
              value={form.term_label}
              onChange={onChange}
              className="mt-1 w-full border rounded px-3 py-2"
              placeholder="2025 Season"
            />
          </label>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm">
            Renew start
            <input
              type="datetime-local"
              name="renew_start"
              value={form.renew_start}
              onChange={onChange}
              className="mt-1 w-full border rounded px-3 py-2"
              required
            />
          </label>
          <label className="text-sm">
            Renew end
            <input
              type="datetime-local"
              name="renew_end"
              value={form.renew_end}
              onChange={onChange}
              className="mt-1 w-full border rounded px-3 py-2"
              required
            />
          </label>
        </div>

        <label className="text-sm">
          Notes (optional)
          <textarea
            name="notes"
            value={form.notes}
            onChange={onChange}
            rows={2}
            className="mt-1 w-full border rounded px-3 py-2"
          />
        </label>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="px-4 py-2 bg-green-900 text-white rounded disabled:opacity-50">
            {saving ? "Creating…" : "Create & open renewal"}
          </button>
          {msg && <span className="text-sm">{msg}</span>}
        </div>
      </form>

      {/* List / Edit */}
      <div className="mt-8">
        <h3 className="font-semibold text-green-900">Recent renewal windows</h3>
        {loading ? (
          <p className="mt-2 text-gray-600">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-2 text-gray-600">No renewal windows yet.</p>
        ) : (
          <ul className="mt-3 divide-y">
            {rows.map(r => {
              const editing = editingId === r.id;
              const processed = Boolean(r.processed_at);

              return (
                <li key={r.id} className="py-3">
                  {!editing ? (
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">
                          {r.horse_name} — {r.term_label || "(No label)"} • {r.status.toUpperCase()}
                          {processed && <span className="ml-2 inline-block text-xs px-2 py-0.5 rounded bg-gray-100 border">Processed</span>}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {r.renew_count} share{r.renew_count === 1 ? "" : "s"} renewed
                        </div>
                        <div className="text-xs text-gray-600">
                          {new Date(r.renew_start).toLocaleString()} → {new Date(r.renew_end).toLocaleString()}
                        </div>
                        {r.notes && <div className="text-xs text-gray-600 mt-1">{r.notes}</div>}
                      </div>

                      <div className="flex gap-2">
                        {r.status === "open" && (
                          <button
                            onClick={() => closeCycle(r.id)}
                            className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
                          >
                            Close
                          </button>
                        )}

                        {r.status === "closed" && (
                          <button
                            onClick={() => processCycle(r.id)}
                            disabled={processed || processingId === r.id}
                            className={`px-3 py-1 border rounded text-sm ${
                              processed ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                              : processingId === r.id ? "opacity-70 cursor-wait"
                              : "hover:bg-gray-50"
                            }`}
                            title={processed ? "Already processed" : "Apply renew decisions to ownerships"}
                          >
                            {processed ? "Processed" : (processingId === r.id ? "Processing…" : "Process Non-Renewals")}
                          </button>
                        )}

                        <button
                          onClick={() => beginEdit(r)}
                          className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteCycle(r.id)}
                          className="px-3 py-1 border rounded text-sm text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border bg-gray-50 p-3">
                      <div className="grid sm:grid-cols-2 gap-3">
                        <label className="text-sm">
                          Horse
                          <select
                            value={editForm.horse_id}
                            onChange={e => setEditForm(p => ({ ...p, horse_id: e.target.value }))}
                            className="mt-1 w-full border rounded px-3 py-2"
                          >
                            <option value="">— Select horse —</option>
                            {horses.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                          </select>
                        </label>
                        <label className="text-sm">
                          Term label
                          <input
                            value={editForm.term_label}
                            onChange={e => setEditForm(p => ({ ...p, term_label: e.target.value }))}
                            className="mt-1 w-full border rounded px-3 py-2"
                          />
                        </label>
                      </div>

                      <div className="grid sm:grid-cols-3 gap-3 mt-2">
                        <label className="text-sm">
                          Start
                          <input
                            type="datetime-local"
                            value={editForm.renew_start}
                            onChange={e => setEditForm(p => ({ ...p, renew_start: e.target.value }))}
                            className="mt-1 w-full border rounded px-3 py-2"
                          />
                        </label>
                        <label className="text-sm">
                          End
                          <input
                            type="datetime-local"
                            value={editForm.renew_end}
                            onChange={e => setEditForm(p => ({ ...p, renew_end: e.target.value }))}
                            className="mt-1 w-full border rounded px-3 py-2"
                          />
                        </label>
                        <label className="text-sm">
                          Status
                          <select
                            value={editForm.status}
                            onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}
                            className="mt-1 w-full border rounded px-3 py-2"
                          >
                            <option value="open">Open</option>
                            <option value="closed">Closed</option>
                          </select>
                        </label>
                      </div>

                      <label className="text-sm mt-2 block">
                        Notes
                        <textarea
                          rows={2}
                          value={editForm.notes}
                          onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                          className="mt-1 w-full border rounded px-3 py-2"
                        />
                      </label>

                      <div className="mt-3 flex gap-2">
                        <button onClick={() => saveEdit(r.id)} className="px-3 py-1 bg-green-900 text-white rounded text-sm">
                          Save
                        </button>
                        <button onClick={() => setEditingId(null)} className="px-3 py-1 border rounded text-sm">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ===========================
   Race Winnings — credit owners per share
=========================== */
function RaceWinningsCreditCard() {
  const [horses, setHorses] = useState([]);
  const [horseId, setHorseId] = useState("");
  const [perShare, setPerShare] = useState("2.00"); // default £2
  const [memo, setMemo] = useState("Race winnings");
  const [preview, setPreview] = useState([]); // [{user_id, shares, amount}]
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("horses").select("id,name").order("name");
      setHorses(data || []);
    })();
  }, []);

  async function buildPreview(id, rate) {
    setLoading(true);
    setPreview([]);
    setErr("");
    try {
      // Expect ownerships table: user_id, horse_id, shares
      const { data: owns, error } = await supabase
        .from("ownerships")
        .select("user_id, shares")
        .eq("horse_id", id);

      if (error) throw error;
      const r = Number(rate || 0);
      const rows = (owns || []).map(o => ({
        user_id: o.user_id,
        shares: Number(o.shares || 0),
        amount: Number((Number(o.shares || 0) * r).toFixed(2)),
      })).filter(x => x.shares > 0 && x.amount > 0);

      setPreview(rows);
    } catch (e) {
      console.error("[RaceWinningsCreditCard] preview error:", e);
      setErr(e.message || "Could not load owners.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (horseId && perShare) buildPreview(horseId, perShare);
  }, [horseId, perShare]);

  async function creditAll() {
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      if (!horseId) throw new Error("Pick a horse");
      const r = Number(perShare || 0);
      if (r <= 0) throw new Error("Enter a valid per-share amount");

      if (preview.length === 0) {
        setMsg("No owners to credit.");
        setSaving(false);
        return;
      }

      // Insert one credit transaction per owner
      const payload = preview.map(p => ({
        user_id: p.user_id,
        amount: p.amount,
        type: "credit",
        status: "posted",
        memo: `${memo} — per share £${r.toFixed(2)}`,
      }));

      const { error } = await supabase.from("wallet_transactions").insert(payload);
      if (error) throw error;

      setMsg(`✅ Credited ${preview.length} owners.`);
    } catch (e) {
      console.error("[RaceWinningsCreditCard] credit error:", e);
      setErr(e.message || "Failed to credit owners.");
    } finally {
      setSaving(false);
    }
  }

  const total = preview.reduce((s, x) => s + x.amount, 0);

  return (
    <section className="bg-white rounded-xl border shadow-sm p-6">
      <h2 className="text-xl font-semibold text-green-900">Race winnings — credit owners</h2>
      <p className="text-sm text-gray-600 mt-1">
        Credit all owners of a horse by a fixed amount <em>per share</em>. Example: Golden Gallop @ £2/share.
      </p>

      <div className="grid sm:grid-cols-3 gap-3 mt-3">
        <label className="text-sm">
          Horse
          <select
            value={horseId}
            onChange={e => setHorseId(e.target.value)}
            className="mt-1 w-full border rounded px-3 py-2"
          >
            <option value="">— Select horse —</option>
            {horses.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </label>
        <label className="text-sm">
          £ per share
          <input
            type="number"
            step="0.01"
            min="0"
            value={perShare}
            onChange={e => setPerShare(e.target.value)}
            className="mt-1 w-full border rounded px-3 py-2"
            placeholder="2.00"
          />
        </label>
        <label className="text-sm">
          Memo (optional)
          <input
            value={memo}
            onChange={e => setMemo(e.target.value)}
            className="mt-1 w-full border rounded px-3 py-2"
            placeholder="Race winnings"
          />
        </label>
      </div>

      {loading ? (
        <p className="mt-3 text-gray-600">Loading owners…</p>
      ) : preview.length === 0 ? (
        <p className="mt-3 text-gray-600">No preview yet.</p>
      ) : (
        <div className="mt-4">
          <div className="text-sm text-gray-700 mb-2">
            Preview: {preview.length} owners • Total credit £{total.toFixed(2)}
          </div>
          <ul className="max-h-48 overflow-auto rounded border divide-y">
            {preview.map(p => (
              <li key={p.user_id} className="px-3 py-2 text-sm flex justify-between">
                <span><span className="font-mono">{p.user_id}</span> • {p.shares} shares</span>
                <span>£{p.amount.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={creditAll}
          disabled={saving || !horseId || preview.length === 0}
          className="px-4 py-2 bg-green-900 text-white rounded disabled:opacity-50"
        >
          {saving ? "Crediting…" : "Credit owners"}
        </button>
        {err && <span className="text-sm text-red-700">{err}</span>}
        {msg && <span className="text-sm text-green-700">{msg}</span>}
      </div>
    </section>
  );
}

/* ===========================
   Payout Requests (admin)
=========================== */
function PayoutRequestsAdminCard() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [updating, setUpdating] = useState({});
  const [filter, setFilter] = useState("all"); // requested|paid|all

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // OPTIONAL one-time debug (uncomment if you need to verify admin context)
      // const { data: dbg } = await supabase.rpc("debug_admin_ctx");
      // console.log("[wallet admin debug]", dbg);

      let q = supabase
        .from("wallet_withdrawals")
        .select("id, user_id, amount, status, account_name, sort_code, account_number, reference, created_at, processed_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (filter !== "all") q = q.eq("status", filter);

      const { data, error } = await q;
      if (error) throw error;
      setRows(data || []);
    } catch (e) {
      console.error("[PayoutRequestsAdminCard] load error:", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  function fmtGBP(amount) {
    return Number(amount || 0).toFixed(2);
  }

  async function markPaid(id) {
    if (!confirm("Mark this payout as PAID?")) return;
    setUpdating(p => ({ ...p, [id]: true }));
    try {
      const { error } = await supabase
        .from("wallet_withdrawals")
        .update({ status: "paid", processed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;

      // Optionally email user here via your API route
      // await fetch("/api/notify-paid", { method:"POST", body: JSON.stringify({ id }) })

      await load();
    } catch (e) {
      alert(e.message || "Failed to update.");
    } finally {
      setUpdating(p => ({ ...p, [id]: false }));
    }
  }

  return (
    <section className="bg-white rounded-xl border shadow-sm p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-green-900">Payout requests</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Filter:</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="requested">Requested</option>
            <option value="paid">Paid</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p className="mt-3 text-gray-600">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-gray-600">No payout requests.</p>
      ) : (
        <ul className="mt-4 divide-y">
          {rows.map(r => (
            <li key={r.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm">
                  <div className="font-medium">
                    £{fmtGBP(r.amount)} • {new Date(r.created_at).toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-600">
                    User: <span className="font-mono">{r.user_id}</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    {r.account_name} • Sort: {r.sort_code} • Acc: {r.account_number}
                    {r.reference ? <> • Ref: {r.reference}</> : null}
                  </div>
                  <div className="text-xs mt-1">
                    Status:{" "}
                    {r.status === "requested" && (
                      <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700">
                        Requested
                      </span>
                    )}
                    {r.status === "paid" && (
                      <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700">
                        Paid
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {r.status === "requested" && (
                    <button
                      onClick={() => markPaid(r.id)}
                      disabled={updating[r.id]}
                      className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
                    >
                      {updating[r.id] ? "Updating…" : "Mark paid"}
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}