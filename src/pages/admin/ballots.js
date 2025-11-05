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
    let sub;
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);
      setReady(true);
      const { data: s } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess));
      sub = s;
    })();
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  if (!ready) {
    return <main className="max-w-5xl mx-auto px-6 py-12">Loading…</main>;
  }

  if (!session) {
    return (
      <main className="max-w-md mx-auto px-6 py-12">
        <Head>
          <title>Admin | Premier Paddock Racing</title>
        </Head>
        <h1 className="text-2xl font-bold mb-4">Admin sign in</h1>
        <Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa }} providers={[]} />
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
          Your account <strong>{session.user.email}</strong> is not allowed here.
        </p>
        <p className="mt-2 text-sm text-gray-600">
          Add your email to <code>NEXT_PUBLIC_ADMIN_EMAILS</code> in <code>.env.local</code>.
        </p>
        <div className="mt-6">
          <Link href="/" className="text-green-800 underline">← Back to home</Link>
        </div>
      </main>
    );
  }

  // ✅ SINGLE, valid return – no duplicates
  return (
    <main className="max-w-7xl mx-auto px-6 py-10">
      <Head>
        <title>Admin | Premier Paddock Racing</title>
        <meta name="robots" content="noindex" />
      </Head>

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-green-900">Admin</h1>
          <p className="text-sm text-gray-600">
            Signed in as <strong>{session.user.email}</strong>
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/my-paddock" className="px-4 py-2 rounded-lg border text-green-900 hover:bg-gray-50">
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

        {/* Voting */}
        <CreateVoteCard />
        <ManageVotesCard />

        {/* Wallet */}
        <RaceWinningsCreditCard />
        <PayoutRequestsAdminCard />

        {/* Renewals */}
        <ManageRenewalsCard />

        {/* Updates */}
        <AdminUpdatesCard />

        {/* All horses list (full width) */}
        <div className="lg:col-span-2">
          <AllHorsesCard
            onEdit={(id) => setEditingHorseId(id)}
            onCreateNew={() => setEditingHorseId(null)}
            refreshKey={horsesRefreshKey}
            onRefreshed={() => {}}
          />
        </div>

        {/* Full-width Horse Editor */}
        <div className="lg:col-span-2">
          <HorseEditorCard
            horseId={editingHorseId}
            setHorseId={setEditingHorseId}
            onSaved={() => setHorsesRefreshKey((k) => k + 1)}
          />
        </div>

        {/* Full-width Active promotions below */}
        <div className="lg:col-span-2">
          <ActivePromotionsList />
        </div>
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
   Weighted entries + accurate unsuccessful count
   + horse name display
   + Edit / Delete inline
   + Download winners CSV
=========================== */
function RecentBallotsCard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState({});
  const [filter, setFilter] = useState("open");
  const [running, setRunning] = useState({});
  const [message, setMessage] = useState("");

  // Weighted entry totals per ballot (across ALL users)
  const [entryTotals, setEntryTotals] = useState({}); // ballot_id -> total_weight

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

    // 1) Fetch ballots
    let query = supabase
      .from("ballots")
      .select("id,horse_id,type,title,cutoff_at,status,event_date,max_winners,description")
      .order("created_at", { ascending: false })
      .limit(30);

    if (filter !== "all") query = query.eq("status", filter);

    const { data: ballots, error: bErr } = await query;
    if (bErr) {
      console.error("[RecentBallots] ballots error:", bErr);
      setItems([]);
      setHorseNames({});
      setEntryTotals({});
      setLoading(false);
      return;
    }

    const list = ballots || [];
    setItems(list);

    // 2) Horse names
    const horseIds = Array.from(new Set(list.map(b => b.horse_id).filter(Boolean)));
    if (horseIds.length) {
      const { data: hs, error: hErr } = await supabase
        .from("horses")
        .select("id,name")
        .in("id", horseIds);
      if (!hErr && hs) {
        setHorseNames(Object.fromEntries(hs.map(h => [h.id, h.name])));
      } else {
        setHorseNames({});
      }
    } else {
      setHorseNames({});
    }

    // 3) Weighted totals per ballot (fallback to client sum if RPC missing)
    const ids = list.map(b => b.id);
    if (ids.length) {
      let totalsMap = {};
      let rpcFailed = false;
      try {
        const { data: totals, error: rpcErr } = await supabase.rpc("ballot_totals", {
          p_ballot_ids: ids
        });
        if (rpcErr) {
          rpcFailed = true;
        } else {
          totalsMap = Object.fromEntries(
            (totals || []).map(r => [r.ballot_id, Number(r.total_weight || 0)])
          );
        }
      } catch {
        rpcFailed = true;
      }

      if (rpcFailed) {
        const { data: entries, error: eErr } = await supabase
          .from("ballot_entries")
          .select("ballot_id, weight")
          .in("ballot_id", ids);
        if (!eErr && entries) {
          const m = {};
          for (const row of entries) {
            const w = Number.isFinite(Number(row.weight)) ? Number(row.weight) : 1;
            m[row.ballot_id] = (m[row.ballot_id] || 0) + w;
          }
          totalsMap = m;
        }
      }

      setEntryTotals(totalsMap);
    } else {
      setEntryTotals({});
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
    } catch (e) {
      console.error("[RecentBallots] updateStatus", e);
      alert(e?.message || "Could not update status.");
    } finally {
      setUpdating((p) => ({ ...p, [id]: false }));
    }
  }

  // Winners + unsuccessful entries (weighted)
  async function loadResults(ballotId) {
    const { data: results, error: rErr } = await supabase
      .from("ballot_results")
      .select("user_id,result")
      .eq("ballot_id", ballotId);

    if (rErr) {
      console.error("[RecentBallots] loadResults results err:", rErr);
      setResultsByBallot((p) => ({ ...p, [ballotId]: { winners: [], unsuccessfulEntries: 0 } }));
      return;
    }

    const winners = (results || []).filter(r => r.result === "winner").map(r => r.user_id);

    // Sum winners' weights to compute unsuccessful = total - winnersWeight
    let winnersWeightSum = 0;
    if (winners.length) {
      const { data: winEntries, error: weErr } = await supabase
        .from("ballot_entries")
        .select("user_id, weight")
        .eq("ballot_id", ballotId)
        .in("user_id", winners);

      if (!weErr && winEntries) {
        winnersWeightSum = winEntries.reduce(
          (s, r) => s + (Number.isFinite(Number(r.weight)) ? Number(r.weight) : 1),
          0
        );
      }
    }

    const totalWeighted = Number(entryTotals[ballotId] || 0);
    const unsuccessfulEntries = Math.max(0, totalWeighted - winnersWeightSum);

    setResultsByBallot((p) => ({
      ...p,
      [ballotId]: { winners, unsuccessfulEntries }
    }));
  }

  async function runDraw(ballotId) {
    setRunning((p) => ({ ...p, [ballotId]: true }));
    setMessage("");
    try {
      const { error } = await supabase.rpc("run_ballot_draw", { p_ballot_id: ballotId });
      if (error) throw error;

      // refresh list & totals and winners panel if open
      await load();
      await loadResults(ballotId);

      setMessage("Draw complete.");
    } catch (e) {
      console.error("Run draw failed:", e);
      alert(e?.message || "Draw failed. Please check console and database function/policies.");
    } finally {
      setRunning((p) => ({ ...p, [ballotId]: false }));
    }
  }

  // ---- CSV download of winners' emails ----
  function buildCSV(rows) {
    const esc = (s) => {
      const v = (s ?? "").toString();
      return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    };
    const header = ["user_id","email","full_name"];
    const lines = [header.join(",")];
    rows.forEach(r => {
      lines.push([esc(r.user_id), esc(r.email), esc(r.full_name)].join(","));
    });
    return lines.join("\n");
  }

  async function downloadWinnersCSV(ballot) {
    try {
      const ballotId = ballot.id;
      // get winners with email via RPC
      const { data, error } = await supabase.rpc("admin_ballot_winner_emails", {
        p_ballot_id: ballotId
      });
      if (error) throw error;

      const rows = data || [];
      const csv = buildCSV(rows);

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const fnameSafe = (ballot.title || "winners").replace(/[^\w\d-_]+/g, "_").slice(0,80);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fnameSafe}_winners.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("[downloadWinnersCSV]", e);
      alert(e?.message || "Could not download winners CSV.");
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
            const entriesWeighted = Number(entryTotals[b.id] || 0);
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
                          • Entries (weighted): <strong>{entriesWeighted}</strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {b.status === "closed" && !running[b.id] && !isDrawn && (
                          <button
                            onClick={() => updateStatus(b.id, "open")}
                            disabled={updating[b.id]}
                            className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
                          >
                            Open
                          </button>
                        )}

                        {b.status === "open" && !running[b.id] && !isDrawn && (
                          <button
                            onClick={() => updateStatus(b.id, "closed")}
                            disabled={updating[b.id]}
                            className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
                          >
                            Close
                          </button>
                        )}

                        <button
                          onClick={() => runDraw(b.id)}
                          disabled={running[b.id] || isDrawn}
                          className="px-3 py-1 border rounded text-sm hover:bg-gray-50 disabled:opacity-50"
                          title={isDrawn ? "Already drawn" : "Run draw"}
                        >
                          {running[b.id] ? "Running…" : "Run draw"}
                        </button>

                        {isDrawn && (
                          <>
                            <button
                              onClick={async () => {
                                const next = expanded ? null : b.id;
                                setOpenRow(next);
                                if (next) await loadResults(b.id);
                              }}
                              className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
                            >
                              {expanded ? "Hide winners" : "View winners"}
                            </button>

                            {/* NEW: Download winners CSV */}
                            <button
                              onClick={() => downloadWinnersCSV(b)}
                              className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
                              title="Download winners' emails as CSV"
                            >
                              Download winners (CSV)
                            </button>
                          </>
                        )}

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
                            {entriesWeighted > 0 ? ` (Unsuccessful entries: ${results.unsuccessfulEntries})` : ""}
                          </p>
                        ) : (
                          <>
                            <p className="text-sm text-gray-800 font-medium">Winners ({results.winners.length})</p>
                            <ul className="mt-1 text-sm text-gray-800 list-disc list-inside">
                              {results.winners.map((uid) => (
                                <li key={uid}><span className="font-mono text-xs">{uid}</span></li>
                              ))}
                            </ul>
                            <p className="text-xs text-gray-600 mt-2">
                              Unsuccessful entries (weighted): {results.unsuccessfulEntries}
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </>
                ) : (
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
   Create OR Edit Horse (rich) — people-based promo only
   - No legacy promo fields/logic
   - People-based promo is edited inline and saved together
=========================== */
function HorseEditorCard({ horseId, setHorseId, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [loadingExisting, setLoadingExisting] = useState(false);

  // Rich blocks state
  const [aboutBlocks, setAboutBlocks] = useState([]);

  // ----- Horse fields (NO legacy promo fields) -----
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
    featured_position: "",
  });

  // ----- People-based promo fields (live in promotions table) -----
  const [peoplePromo, setPeoplePromo] = useState({
    promo_id: null,
    enabled: false,
    quota: "",
    min_shares_required: "2",
    label: "",
    reward: "",
    start_at: "",
    end_at: "",
  });

  // Load horse + latest people promo
  useEffect(() => {
    async function loadExisting() {
      if (!horseId) {
        // new horse defaults
        setForm({
          name: "",
          trainer: "",
          specialty: "",
          share_price: 60,
          total_shares: 3200,
          photo_url: "",
          photos_csv: "",
          description: "",
          trainer_bio: "",
          trainer_photo_url: "",
          horse_value: "",
          training_vet: "",
          insurance_race: "",
          management_fee: "",
          contingency: "",
          breakdown_total: "",
          sire: "",
          dam: "",
          damsire: "",
          foaled: "",
          sex: "",
          color: "",
          breeder: "",
          form_text: "",
          featured_position: "",
        });
        setAboutBlocks([]);
        setPeoplePromo({
          promo_id: null,
          enabled: false,
          quota: "",
          min_shares_required: "2",
          label: "",
          reward: "",
          start_at: "",
          end_at: "",
        });
        setMsg("");
        setLoadingExisting(false);
        return;
      }
      setLoadingExisting(true);

      const { data: h, error } = await supabase
        .from("horses")
        .select("*, featured_position, about_blocks")
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

      setAboutBlocks(Array.isArray(h.about_blocks) ? h.about_blocks : []);

      // load latest people-based promo for this horse
      const { data: promos } = await supabase
        .from("promotions")
        .select("*")
        .eq("horse_id", horseId)
        .order("created_at", { ascending: false })
        .limit(1);

      const p = Array.isArray(promos) ? promos[0] : null;
      if (p) {
        setPeoplePromo({
          promo_id: p.id,
          enabled: !!p.enabled,
          quota: p.quota == null ? "" : String(p.quota),
          min_shares_required: p.min_shares_required == null ? "2" : String(p.min_shares_required),
          label: p.label || "",
          reward: p.reward || "",
          start_at: p.start_at ? isoLocal(p.start_at) : "",
          end_at: p.end_at ? isoLocal(p.end_at) : "",
        });
      } else {
        setPeoplePromo((pp) => ({ ...pp, promo_id: null, enabled: false }));
      }

      setLoadingExisting(false);
      setMsg("");
    }
    loadExisting();
  }, [horseId]);

  function onChangeHorse(e) {
    const { name, value, type } = e.target;
    setForm((p) => ({ ...p, [name]: type === "number" ? Number(value) : value }));
  }

  function onChangePeople(e) {
    const { name, value, type, checked } = e.target;
    setPeoplePromo((pp) => ({ ...pp, [name]: type === "checkbox" ? checked : value }));
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMsg("");

    try {
      if (!form.name.trim()) throw new Error("Please add a horse name.");

      // Build horse payload
      const horsePayload = {
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
        about_blocks: Array.isArray(aboutBlocks) ? aboutBlocks : [],
      };

      // ensure featured slot uniqueness
      if ([1, 2, 3].includes(horsePayload.featured_position)) {
        const slot = horsePayload.featured_position;
        const q = supabase.from("horses").update({ featured_position: null }).eq("featured_position", slot);
        if (horseId) q.neq("id", horseId);
        await q;
      }

      // 1) Upsert horse
      let id = horseId;
      if (id) {
        const { error } = await supabase.from("horses").update(horsePayload).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("horses").insert(horsePayload).select("id").single();
        if (error) throw error;
        id = data?.id;
        setHorseId(id || null);
      }

      // 2) Upsert people-based promo (only validate when enabled)
      if (peoplePromo.enabled) {
        const quota = peoplePromo.quota === "" ? null : Number(peoplePromo.quota);
        const minReq = peoplePromo.min_shares_required === "" ? null : Number(peoplePromo.min_shares_required);
        if (!quota || quota <= 0) throw new Error("Please enter a positive quota for the people-based promo.");
        if (!minReq || minReq <= 0) throw new Error("Please enter a positive minimum shares required.");

        const nowISO = new Date().toISOString();
        const payload = {
          horse_id: id,
          enabled: true,
          quota,
          min_shares_required: minReq,
          label: peoplePromo.label?.trim() || null,
          reward: peoplePromo.reward?.trim() || null,
          // Default the start to "now" if none provided so past purchases don't count
          start_at: peoplePromo.start_at
            ? new Date(peoplePromo.start_at).toISOString()
            : nowISO,
          end_at: peoplePromo.end_at ? new Date(peoplePromo.end_at).toISOString() : null,
        };

        if (peoplePromo.promo_id) {
          const { error } = await supabase.from("promotions").update(payload).eq("id", peoplePromo.promo_id);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.from("promotions").insert(payload).select("id").single();
          if (error) throw error;
          setPeoplePromo((pp) => ({ ...pp, promo_id: data?.id || null }));
        }

        // Turn OFF any other people-based promos for this horse (keep only the current one enabled)
        await supabase
          .from("promotions")
          .update({ enabled: false })
          .eq("horse_id", id)
          .neq("id", peoplePromo.promo_id || undefined);
      } else {
        // If disabled in the form, make sure promos are disabled
        if (peoplePromo.promo_id) {
          await supabase.from("promotions").update({ enabled: false }).eq("id", peoplePromo.promo_id);
        } else {
          await supabase.from("promotions").update({ enabled: false }).eq("horse_id", id);
        }
      }

      setMsg("✅ Saved.");
      onSaved?.();
    } catch (err) {
      console.error(err);
      setMsg("Failed to save. " + (err?.message || ""));
    } finally {
      setSaving(false);
    }
  }

  const previewPeople = (() => {
    const people = peoplePromo.quota ? Number(peoplePromo.quota) : null;
    const min = peoplePromo.min_shares_required ? Number(peoplePromo.min_shares_required) : null;
    if (!people || !min) return "—";
    const base = peoplePromo.label?.trim() || `First ${people} people who buy ≥${min} shares`;
    return `${base}${peoplePromo.reward ? ` — ${peoplePromo.reward}` : ""}`;
  })();

  return (
    <section className="bg-white rounded-xl border shadow-sm p-6">
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
              <input name="name" value={form.name} onChange={onChangeHorse} className="mt-1 w-full border rounded px-3 py-2" required />
            </label>
            <label className="block text-sm">
              Trainer
              <input name="trainer" value={form.trainer} onChange={onChangeHorse} className="mt-1 w-full border rounded px-3 py-2" />
            </label>
            <label className="block text-sm">
              Specialty
              <input name="specialty" value={form.specialty} onChange={onChangeHorse} className="mt-1 w-full border rounded px-3 py-2" placeholder="e.g. Flat / Jumps" />
            </label>
            <label className="block text-sm">
              Trainer Photo URL
              <input name="trainer_photo_url" value={form.trainer_photo_url} onChange={onChangeHorse} className="mt-1 w-full border rounded px-3 py-2" placeholder="https://…" />
            </label>
          </div>

          <div className="grid md:grid-cols-4 gap-4">
            <label className="block text-sm">
              Share price (£)
              <input type="number" min="0" name="share_price" value={form.share_price} onChange={onChangeHorse} className="mt-1 w-full border rounded px-3 py-2" />
            </label>
            <label className="block text-sm">
              Total shares
              <input type="number" min="0" name="total_shares" value={form.total_shares} onChange={onChangeHorse} className="mt-1 w-full border rounded px-3 py-2" />
            </label>
            <label className="block text-sm">
              Main Photo URL
              <input name="photo_url" value={form.photo_url} onChange={onChangeHorse} className="mt-1 w-full border rounded px-3 py-2" placeholder="https://…" />
            </label>
            <label className="block text-sm">
              Extra Photos (CSV)
              <input name="photos_csv" value={form.photos_csv} onChange={onChangeHorse} className="mt-1 w-full border rounded px-3 py-2" placeholder="https://a.jpg, https://b.jpg, https://c.jpg" />
            </label>
          </div>

          {/* Content */}
          <div className="grid md:grid-cols-2 gap-4">
            <label className="block text-sm">
              About the horse (legacy fallback)
              <textarea name="description" value={form.description} onChange={onChangeHorse} rows={5} className="mt-1 w-full border rounded px-3 py-2" placeholder="Big description…" />
            </label>
            <label className="block text-sm">
              Trainer bio
              <textarea name="trainer_bio" value={form.trainer_bio} onChange={onChangeHorse} rows={5} className="mt-1 w-full border rounded px-3 py-2" placeholder="Trainer background…" />
            </label>
          </div>

          {/* Rich About blocks editor */}
          <AboutBlocksEditor value={aboutBlocks} onChange={setAboutBlocks} />

          {/* Costs */}
          <div className="bg-gray-50 rounded-lg border p-4">
            <h3 className="font-semibold text-green-900">Share breakdown & costs</h3>
            <div className="grid md:grid-cols-3 gap-3 mt-3">
              <NumField label="Horse value" name="horse_value" value={form.horse_value} onChange={onChangeHorse} />
              <NumField label="Training & vet bills" name="training_vet" value={form.training_vet} onChange={onChangeHorse} />
              <NumField label="Insurance & race fees" name="insurance_race" value={form.insurance_race} onChange={onChangeHorse} />
              <NumField label="Management fee" name="management_fee" value={form.management_fee} onChange={onChangeHorse} />
              <NumField label="Contingency" name="contingency" value={form.contingency} onChange={onChangeHorse} />
              <NumField label="Total (optional)" name="breakdown_total" value={form.breakdown_total} onChange={onChangeHorse} />
            </div>
          </div>

          {/* Breeding + Form */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid md:grid-cols-2 gap-3">
              <TextField label="Sire" name="sire" value={form.sire} onChange={onChangeHorse} />
              <TextField label="Dam" name="dam" value={form.dam} onChange={onChangeHorse} />
              <TextField label="Damsire" name="damsire" value={form.damsire} onChange={onChangeHorse} />
              <TextField label="Foaled" name="foaled" value={form.foaled} onChange={onChangeHorse} />
              <TextField label="Sex" name="sex" value={form.sex} onChange={onChangeHorse} />
              <TextField label="Colour" name="color" value={form.color} onChange={onChangeHorse} />
              <TextField label="Breeder" name="breeder" value={form.breeder} onChange={onChangeHorse} />
            </div>
            <label className="block text-sm">
              Recent form
              <textarea name="form_text" value={form.form_text} onChange={onChangeHorse} rows={6} className="mt-1 w-full border rounded px-3 py-2" />
            </label>
          </div>

          {/* Promotion — people-based (distinct buyers, in promotions table) */}
          <div className={`rounded-lg border p-4 ${peoplePromo.enabled ? "bg-amber-50" : "bg-gray-50"}`}>
            <h3 className="font-semibold text-amber-900">Promotion — people-based (distinct buyers)</h3>
            <p className="text-xs text-amber-900/80 mt-1">Example: “First 100 people who buy ≥2 shares get a free share.”</p>
            <div className="mt-2 grid md:grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="enabled" checked={!!peoplePromo.enabled} onChange={onChangePeople} />
                Enable people-based promo
              </label>
              <label className="block text-sm">
                Quota (people)
                <input type="number" min="1" name="quota" value={peoplePromo.quota} onChange={onChangePeople} className="mt-1 w-full border rounded px-3 py-2" disabled={!peoplePromo.enabled} />
              </label>
              <label className="block text-sm">
                Min shares required
                <input type="number" min="1" name="min_shares_required" value={peoplePromo.min_shares_required} onChange={onChangePeople} className="mt-1 w-full border rounded px-3 py-2" disabled={!peoplePromo.enabled} />
              </label>
              <label className="block text-sm">
                Label (optional)
                <input name="label" value={peoplePromo.label} onChange={onChangePeople} className="mt-1 w-full border rounded px-3 py-2" disabled={!peoplePromo.enabled} />
              </label>
              <label className="block text-sm md:col-span-2">
                Reward (shown to users)
                <input name="reward" value={peoplePromo.reward} onChange={onChangePeople} className="mt-1 w-full border rounded px-3 py-2" disabled={!peoplePromo.enabled} />
              </label>
              <label className="block text-sm">
                Starts at (optional)
                <input type="datetime-local" name="start_at" value={peoplePromo.start_at} onChange={onChangePeople} className="mt-1 w-full border rounded px-3 py-2" disabled={!peoplePromo.enabled} />
              </label>
              <label className="block text-sm">
                Ends at (optional)
                <input type="datetime-local" name="end_at" value={peoplePromo.end_at} onChange={onChangePeople} className="mt-1 w-full border rounded px-3 py-2" disabled={!peoplePromo.enabled} />
              </label>
              <div className="md:col-span-2">
                <div className="rounded-md bg-white border p-3 text-sm text-gray-800">
                  <strong>Preview:</strong> {previewPeople}
                </div>
              </div>
            </div>
          </div>

          {/* Featured slot */}
          <div className="grid sm:grid-cols-3 gap-4">
            <label className="block text-sm">
              Featured slot (home)
              <select name="featured_position" value={form.featured_position} onChange={onChangeHorse} className="mt-1 w-full border rounded px-3 py-2">
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

/* ===========================
   PeoplePromoEditorInline (per-horse)
   - No legacy promo toggling
=========================== */
function PeoplePromoEditorInline({ horseId }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [promoId, setPromoId] = useState(null);
  const [stats, setStats] = useState(null); // {claimed,left,qualifiers_count}

  const [form, setForm] = useState({
    enabled: false,
    quota: "",
    min_shares_required: "2",
    label: "",
    reward: "",
    start_at: "",
    end_at: "",
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!horseId) {
        setPromoId(null);
        setForm({
          enabled: false,
          quota: "",
          min_shares_required: "2",
          label: "",
          reward: "",
          start_at: "",
          end_at: "",
        });
        setStats(null);
        return;
      }
      setLoading(true);
      setMsg("");

      // Load latest promo for this horse
      const { data, error } = await supabase
        .from("promotions")
        .select("*")
        .eq("horse_id", horseId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!mounted) return;

      if (error) {
        console.error("[PeoplePromoEditorInline] load error:", error);
        setMsg("Could not load promotion.");
        setLoading(false);
        return;
      }

      const p = Array.isArray(data) ? data[0] : null;
      if (p) {
        setPromoId(p.id);
        setForm({
          enabled: !!p.enabled,
          quota: p.quota == null ? "" : String(p.quota),
          min_shares_required:
            p.min_shares_required == null ? "2" : String(p.min_shares_required),
          label: p.label || "",
          reward: p.reward || "",
          start_at: p.start_at ? isoLocal(p.start_at) : "",
          end_at: p.end_at ? isoLocal(p.end_at) : "",
        });

        // live stats (optional view)
        try {
          const { data: s } = await supabase
            .from("promotion_people_stats")
            .select("promotion_id, qualifiers_count")
            .eq("promotion_id", p.id)
            .maybeSingle();

          if (mounted) {
            const claimed = Number(s?.qualifiers_count || 0);
            const quota = Number(p.quota || 0);
            setStats({
              claimed,
              left: Math.max(0, quota - claimed),
              qualifiers_count: claimed,
            });
          }
        } catch {
          if (mounted) setStats(null);
        }
      } else {
        setPromoId(null);
        setForm((f) => ({ ...f, enabled: false }));
        setStats(null);
      }

      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [horseId]);

  function onChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }

  async function save(e) {
    e.preventDefault();
    if (!horseId) return;

    setSaving(true);
    setMsg("");

    try {
      // Basic validation (only if enabled)
      if (form.enabled) {
        if (!form.quota || Number(form.quota) <= 0) {
          setMsg("Please enter a positive quota (number of people).");
          setSaving(false);
          return;
        }
        if (!form.min_shares_required || Number(form.min_shares_required) <= 0) {
          setMsg("Please enter a positive minimum shares required.");
          setSaving(false);
          return;
        }
      }

      // Build payload
      const nowISO = new Date().toISOString();
      const payload = {
        horse_id: horseId,
        enabled: !!form.enabled,
        quota: form.quota === "" ? null : Number(form.quota),
        min_shares_required: form.min_shares_required === "" ? null : Number(form.min_shares_required),
        label: form.label?.trim() || null,
        reward: form.reward?.trim() || null,
        start_at: form.enabled
          ? (form.start_at ? new Date(form.start_at).toISOString() : nowISO)
          : (form.start_at ? new Date(form.start_at).toISOString() : null),
        end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
      };

      // Upsert
      let currentId = promoId;
      if (currentId) {
        const { error } = await supabase.from("promotions").update(payload).eq("id", currentId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("promotions")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        currentId = data?.id ?? null;
        setPromoId(currentId);
      }

      // Keep only this promo enabled for this horse when enabling
      if (payload.enabled && currentId) {
        await supabase
          .from("promotions")
          .update({ enabled: false })
          .eq("horse_id", horseId)
          .neq("id", currentId);
      }

      setMsg("✅ Promotion saved.");
    } catch (err) {
      console.error(err);
      setMsg("Failed to save promotion. " + (err?.message || ""));
    } finally {
      setSaving(false);
    }
  }

  const preview = (() => {
    const people = form.quota ? Number(form.quota) : null;
    const min = form.min_shares_required ? Number(form.min_shares_required) : null;
    if (!people || !min) return "—";
    const base = form.label?.trim() || `First ${people} people who buy ≥${min} shares`;
    return `${base}${form.reward ? ` — ${form.reward}` : ""}`;
  })();

  return (
    <div className="bg-amber-50 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-amber-900">
          Promotion (people-based — distinct buyers)
        </h3>
        {loading && <span className="text-xs text-amber-900/70">Loading…</span>}
      </div>

      <p className="text-sm text-amber-900/80 mt-1">
        Example: <em>“First 100 people who buy ≥2 shares get a free share.”</em>
      </p>

      <form onSubmit={save} className="mt-3 grid md:grid-cols-2 gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="enabled" checked={!!form.enabled} onChange={onChange} />
          Enable promotion
        </label>

        <label className="block text-sm">
          Quota (number of people)
          <input
            type="number" min="1" name="quota" value={form.quota}
            onChange={onChange} className="mt-1 w-full border rounded px-3 py-2"
            placeholder="e.g. 100" disabled={!form.enabled}
          />
        </label>

        <label className="block text-sm">
          Min shares required (per purchase)
          <input
            type="number" min="1" name="min_shares_required" value={form.min_shares_required}
            onChange={onChange} className="mt-1 w-full border rounded px-3 py-2"
            placeholder="e.g. 2" disabled={!form.enabled}
          />
        </label>

        <label className="block text-sm">
          Label (optional)
          <input
            name="label" value={form.label} onChange={onChange}
            className="mt-1 w-full border rounded px-3 py-2"
            placeholder='e.g. "First 100 buyers"' disabled={!form.enabled}
          />
        </label>

        <label className="block text-sm md:col-span-2">
          Reward (shown to users)
          <input
            name="reward" value={form.reward} onChange={onChange}
            className="mt-1 w-full border rounded px-3 py-2"
            placeholder='e.g. "1 free share" or "Free yard visit ballot"' disabled={!form.enabled}
          />
        </label>

        <label className="block text-sm">
          Starts at (optional)
          <input
            type="datetime-local" name="start_at" value={form.start_at} onChange={onChange}
            className="mt-1 w-full border rounded px-3 py-2" disabled={!form.enabled}
          />
        </label>

        <label className="block text-sm">
          Ends at (optional)
          <input
            type="datetime-local" name="end_at" value={form.end_at} onChange={onChange}
            className="mt-1 w-full border rounded px-3 py-2" disabled={!form.enabled}
          />
        </label>

        {/* Preview & live stats */}
        <div className="md:col-span-2 space-y-2">
          <div className="rounded-md bg-white border p-3 text-sm text-gray-800">
            <strong>Preview:</strong> {preview}
          </div>
          {promoId ? (
            <div className="rounded-md bg-white border p-3 text-sm text-gray-800 flex items-center justify-between">
              <div>
                <strong>Live status:</strong>{" "}
                {stats ? (
                  <>
                    {stats.claimed} claimed, {stats.left} {stats.left === 1 ? "left" : "left"}
                  </>
                ) : (
                  "—"
                )}
              </div>
              <a
                href={`/api/promotions/export?promotion_id=${encodeURIComponent(promoId)}`}
                className="px-3 py-1.5 rounded bg-amber-600 text-white text-sm hover:bg-amber-700"
              >
                Download CSV
              </a>
            </div>
          ) : null}
        </div>

        <div className="md:col-span-2 flex items-center gap-3">
          <button
            type="submit" disabled={saving}
            className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : promoId ? "Save promotion" : "Create promotion"}
          </button>
          {msg && <span className="text-sm">{msg}</span>}
        </div>
      </form>
    </div>
  );
}

/* ===========================
   AboutBlocksEditor
=========================== */
function AboutBlocksEditor({ value = [], onChange }) {
  const blocks = Array.isArray(value) ? value : [];

  function add(type) {
    const blank =
      type === "text"
        ? { type: "text", body: "" }
        : type === "image"
        ? { type: "image", url: "", caption: "" }
        : { type: "video", url: "", caption: "" };
    onChange([...(blocks || []), blank]);
  }

  function update(i, patch) {
    onChange(blocks.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }

  function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const copy = blocks.slice();
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  }

  function remove(i) {
    onChange(blocks.filter((_, idx) => idx !== i));
  }

  const isVideoFile = (u = "") => /\.(mp4|webm|ogg)(\?|#|$)/i.test(u);

  return (
    <div className="bg-gray-50 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-green-900">About — content blocks</h3>
        <div className="flex gap-2">
          <button type="button" className="px-2 py-1 border rounded text-sm" onClick={() => add("text")}>+ Text</button>
          <button type="button" className="px-2 py-1 border rounded text-sm" onClick={() => add("image")}>+ Image</button>
          <button type="button" className="px-2 py-1 border rounded text-sm" onClick={() => add("video")}>+ Video</button>
        </div>
      </div>

      {blocks.length === 0 ? (
        <p className="text-sm text-gray-600 mt-2">No blocks yet. Add text, image or video in any order.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {blocks.map((blk, i) => (
            <li key={i} className="rounded border bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-gray-500">
                  Block #{i + 1} — {blk.type}
                </span>
                <div className="flex gap-2">
                  <button type="button" className="px-2 py-1 border rounded text-xs" onClick={() => move(i, -1)}>↑</button>
                  <button type="button" className="px-2 py-1 border rounded text-xs" onClick={() => move(i, +1)}>↓</button>
                  <button type="button" className="px-2 py-1 border rounded text-xs text-red-700" onClick={() => remove(i)}>Delete</button>
                </div>
              </div>

              {blk.type === "text" && (
                <label className="block text-sm mt-2">
                  Body
                  <textarea
                    value={blk.body || ""}
                    onChange={(e) => update(i, { body: e.target.value })}
                    rows={5}
                    className="mt-1 w-full border rounded px-3 py-2"
                    placeholder="Write the paragraph…"
                  />
                </label>
              )}

              {blk.type === "image" && (
                <div className="grid sm:grid-cols-2 gap-3 mt-2">
                  <label className="block text-sm">
                    Image URL
                    <input
                      value={blk.url || ""}
                      onChange={(e) => update(i, { url: e.target.value })}
                      className="mt-1 w-full border rounded px-3 py-2"
                      placeholder="https://…"
                    />
                  </label>
                  <label className="block text-sm">
                    Caption (optional)
                    <input
                      value={blk.caption || ""}
                      onChange={(e) => update(i, { caption: e.target.value })}
                      className="mt-1 w-full border rounded px-3 py-2"
                      placeholder="e.g. First canter"
                    />
                  </label>
                  {blk.url ? (
                    <div className="sm:col-span-2">
                      <img
                        src={blk.url}
                        alt={blk.caption || ""}
                        className="mt-2 max-h-48 rounded border object-contain"
                      />
                    </div>
                  ) : null}
                </div>
              )}

              {blk.type === "video" && (
                <div className="grid sm:grid-cols-2 gap-3 mt-2">
                  <label className="block text-sm sm:col-span-2">
                    Video URL (YouTube/Vimeo/MP4)
                    <input
                      value={blk.url || ""}
                      onChange={(e) => update(i, { url: e.target.value })}
                      className="mt-1 w-full border rounded px-3 py-2"
                      placeholder="https://youtube.com/watch?v=…  or  https://files/clip.mp4"
                    />
                  </label>
                  <label className="block text-sm sm:col-span-2">
                    Caption (optional)
                    <input
                      value={blk.caption || ""}
                      onChange={(e) => update(i, { caption: e.target.value })}
                      className="mt-1 w-full border rounded px-3 py-2"
                    />
                  </label>

                  {blk.url ? (
                    <div className="sm:col-span-2">
                      {isVideoFile(blk.url) ? (
                        <video className="w-full rounded border" src={blk.url} controls playsInline />
                      ) : (
                        <div className="aspect-video">
                          <iframe
                            className="w-full h-full rounded border"
                            src={blk.url}
                            title="Video preview"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
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

// Convert a DB ISO string to local datetime-local value (yyyy-mm-ddThh:mm)
function isoLocal(iso) {
  try {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  } catch {
    return "";
  }
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
   - Live results (weighted)
=========================== */
function ManageVotesCard() {
  const [filter, setFilter] = useState("open"); // open|closed|all
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [horsesById, setHorsesById] = useState({});
  const [optionsByVote, setOptionsByVote] = useState({});
  const [countsByOption, setCountsByOption] = useState({}); // { option_id: totalWeight }
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

    // 4) WEIGHTED counts per option (from vote_responses)
    if (optionIds.length) {
      const { data: responses, error: rErr } = await supabase
        .from("vote_responses")
        .select("option_id, weight")
        .in("option_id", optionIds);

      if (rErr) {
        console.error("[ManageVotes] responses error:", rErr);
        setCountsByOption({});
        setLoading(false);
        return;
      }

      // Sum weights (default weight -> 1 for legacy rows)
      const counts = {};
      (responses || []).forEach((r) => {
        const w = Number.isFinite(Number(r.weight)) ? Number(r.weight) : 1;
        counts[r.option_id] = (counts[r.option_id] || 0) + w;
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
                          const weighted = countsByOption[o.id] || 0;
                          const pct = total > 0 ? Math.round((weighted / total) * 100) : 0;
                          return (
                            <li key={o.id} className="rounded border bg-white p-3">
                              <div className="text-sm font-medium text-gray-800">{o.label}</div>
                              <div className="text-xs text-gray-600 mt-1">
                                {weighted} vote{weighted === 1 ? "" : "s"} {total > 0 ? `• ${pct}%` : ""}
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
                        (Weighted by allocated votes; admins can see live results even while open)
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
   RENEWALS (ADMIN) — horse name + shares count + price per share + edit/delete + process (persisted)
   UPDATED to:
   - renew_period_start (was renew_start)
   - renew_period_end   (was renew_end)
   - term_end_date      (new)
=========================== */
function ManageRenewalsCard() {
  const [horses, setHorses] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [processingId, setProcessingId] = useState(null);

  // create form
  const [form, setForm] = useState({
    horse_id: "",
    term_label: "",
    renew_period_start: "",
    renew_period_end: "",
    term_end_date: "",
    notes: "",
    price_per_share: "", // persisted
  });

  // edit form
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    horse_id: "",
    term_label: "",
    renew_period_start: "",
    renew_period_end: "",
    term_end_date: "",
    notes: "",
    status: "open",
    price_per_share: "",
  });

  // --- datetime helpers (local <-> ISO) ---
  function toLocalInputValue(dateLike) {
    if (!dateLike) return "";
    const d = new Date(dateLike);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  }
  function localInputToISO(localStr) {
    if (!localStr) return null;
    return new Date(localStr).toISOString();
  }

  // money helpers
  const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
  const fmtPrice = (v) => (v === null || v === undefined || v === "" ? "—" : gbp.format(Number(v)));
  function parseMoney(v) {
    if (v === "" || v === null || v === undefined) return null;
    const normalized = String(v).replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  useEffect(() => {
    (async () => {
      const { data: hs } = await supabase.from("horses").select("id,name").order("name");
      setHorses(hs || []);
      await load();
    })();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("renew_cycles")
        .select(`
          id,
          horse_id,
          term_label,
          renew_period_start,
          renew_period_end,
          term_end_date,
          status,
          notes,
          processed_at,
          price_per_share
        `)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;

      const list = data || [];
      if (list.length === 0) {
        setRows([]);
        return;
      }

      // horse_id -> name
      const horseIds = Array.from(new Set(list.map((r) => r.horse_id))).filter(Boolean);
      let horseMap = {};
      if (horseIds.length) {
        const { data: hs } = await supabase.from("horses").select("id,name").in("id", horseIds);
        horseMap = Object.fromEntries((hs || []).map((h) => [h.id, h.name]));
      }

      // sum renewed shares per cycle
      const ids = list.map((r) => r.id);
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
        list.map((r) => ({
          ...r,
          horse_name: horseMap[r.horse_id] || "(Unknown horse)",
          renew_count: sharesByCycle[r.id] || 0,
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
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function createCycle(e) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      if (!form.horse_id) throw new Error("Select a horse");
      if (!form.renew_period_start || !form.renew_period_end)
        throw new Error("Set renew period start/end");

      const startISO = localInputToISO(form.renew_period_start);
      const endISO = localInputToISO(form.renew_period_end);
      if (new Date(endISO) <= new Date(startISO)) throw new Error("Renew period end must be after start");

      const termEndISO = form.term_end_date ? localInputToISO(form.term_end_date) : null;

      const price = parseMoney(form.price_per_share);
      if (price === null || price < 0) throw new Error("Enter a valid price per share (≥ 0).");

      const payload = {
        horse_id: form.horse_id,
        term_label: form.term_label?.trim() || null,
        renew_period_start: startISO,
        renew_period_end: endISO,
        term_end_date: termEndISO,
        notes: form.notes?.trim() || null,
        status: "open",
        price_per_share: price,
      };

      const { error: createErr } = await supabase.from("renew_cycles").insert(payload);
      if (createErr) throw createErr;

      setMsg("✅ Renewal window created & opened.");
      setForm({
        horse_id: "",
        term_label: "",
        renew_period_start: "",
        renew_period_end: "",
        term_end_date: "",
        notes: "",
        price_per_share: "",
      });
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
      renew_period_start: toLocalInputValue(row.renew_period_start),
      renew_period_end: toLocalInputValue(row.renew_period_end),
      term_end_date: toLocalInputValue(row.term_end_date),
      notes: row.notes || "",
      status: row.status || "open",
      price_per_share: row.price_per_share ?? "",
    });
  }

  async function saveEdit(id) {
    try {
      if (!editForm.horse_id) throw new Error("Select a horse");
      if (!editForm.renew_period_start || !editForm.renew_period_end)
        throw new Error("Set renew period start/end");

      const startISO = localInputToISO(editForm.renew_period_start);
      const endISO = localInputToISO(editForm.renew_period_end);
      if (new Date(endISO) <= new Date(startISO)) throw new Error("Renew period end must be after start");

      const termEndISO = editForm.term_end_date ? localInputToISO(editForm.term_end_date) : null;

      const price = parseMoney(editForm.price_per_share);
      if (price === null || price < 0) throw new Error("Enter a valid price per share (≥ 0).");

      const payload = {
        horse_id: editForm.horse_id,
        term_label: editForm.term_label?.trim() || null,
        renew_period_start: startISO,
        renew_period_end: endISO,
        term_end_date: termEndISO,
        notes: editForm.notes?.trim() || null,
        status: editForm.status,
        price_per_share: price,
      };

      const { error: updateErr } = await supabase.from("renew_cycles").update(payload).eq("id", id);
      if (updateErr) throw updateErr;

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
    const row = rows.find((r) => r.id === id);
    if (row?.processed_at) return;
    if (
      !confirm(
        "This will update ownerships for this renewal window:\n• Set each owner’s shares to the renewed amount\n• Delete owners who didn’t renew\n\nProceed?"
      )
    )
      return;

    setProcessingId(id);
    try {
      const { data, error } = await supabase.rpc("process_renew_cycle", { p_cycle_id: id });
      if (error) throw error;

      const { error: markErr } = await supabase
        .from("renew_cycles")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", id);
      if (markErr) throw markErr;

      const summary = (data || []).map((r) => `${r.action}: ${r.affected}`).join("\n");
      alert(`✅ Processing complete.\n\n${summary}`);

      await load();
    } catch (e) {
      alert(e.message || "Failed to process renewals.");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <section className="bg-white rounded-xl border shadow-sm p-6">
      <h2 className="text-xl font-semibold text-green-900">Renewals</h2>
      <p className="text-sm text-gray-600 mt-1">Create, edit, close or delete renewal windows.</p>

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
              {horses.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
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

        <div className="grid sm:grid-cols-4 gap-3">
          <label className="text-sm">
            Renew period start
            <input
              type="datetime-local"
              name="renew_period_start"
              value={form.renew_period_start}
              onChange={onChange}
              className="mt-1 w-full border rounded px-3 py-2"
              required
            />
          </label>
          <label className="text-sm">
            Renew period end
            <input
              type="datetime-local"
              name="renew_period_end"
              value={form.renew_period_end}
              onChange={onChange}
              className="mt-1 w-full border rounded px-3 py-2"
              required
            />
          </label>
          <label className="text-sm">
            Term end date
            <input
              type="datetime-local"
              name="term_end_date"
              value={form.term_end_date}
              onChange={onChange}
              className="mt-1 w-full border rounded px-3 py-2"
              placeholder="optional"
            />
          </label>
          <label className="text-sm">
            Price per share
            <input
              type="number"
              step="0.01"
              min="0"
              name="price_per_share"
              value={form.price_per_share}
              onChange={onChange}
              className="mt-1 w-full border rounded px-3 py-2"
              placeholder="e.g. 49.00"
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
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-green-900 text-white rounded disabled:opacity-50"
          >
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
            {rows.map((r) => {
              const editing = editingId === r.id;
              const processed = Boolean(r.processed_at);

              return (
                <li key={r.id} className="py-3">
                  {!editing ? (
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">
                          {r.horse_name} — {r.term_label || "(No label)"} • {r.status.toUpperCase()}
                          {processed && (
                            <span className="ml-2 inline-block text-xs px-2 py-0.5 rounded bg-gray-100 border">
                              Processed
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {r.renew_count} share{r.renew_count === 1 ? "" : "s"} renewed • Price:{" "}
                          {fmtPrice(r.price_per_share)}
                        </div>
                        <div className="text-xs text-gray-600">
                          Renew period:{" "}
                          {r.renew_period_start
                            ? new Date(r.renew_period_start).toLocaleString()
                            : "—"}{" "}
                          →{" "}
                          {r.renew_period_end
                            ? new Date(r.renew_period_end).toLocaleString()
                            : "—"}
                        </div>
                        <div className="text-xs text-gray-600">
                          Term ends:{" "}
                          {r.term_end_date ? new Date(r.term_end_date).toLocaleString() : "—"}
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
                              processed
                                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                                : processingId === r.id
                                ? "opacity-70 cursor-wait"
                                : "hover:bg-gray-50"
                            }`}
                            title={
                              processed
                                ? "Already processed"
                                : "Apply renew decisions to ownerships"
                            }
                          >
                            {processed
                              ? "Processed"
                              : processingId === r.id
                              ? "Processing…"
                              : "Process Non-Renewals"}
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
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, horse_id: e.target.value }))
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
                        <label className="text-sm">
                          Term label
                          <input
                            value={editForm.term_label}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, term_label: e.target.value }))
                            }
                            className="mt-1 w-full border rounded px-3 py-2"
                          />
                        </label>
                      </div>

                      <div className="grid sm:grid-cols-5 gap-3 mt-2">
                        <label className="text-sm">
                          Renew period start
                          <input
                            type="datetime-local"
                            value={editForm.renew_period_start}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, renew_period_start: e.target.value }))
                            }
                            className="mt-1 w-full border rounded px-3 py-2"
                          />
                        </label>
                        <label className="text-sm">
                          Renew period end
                          <input
                            type="datetime-local"
                            value={editForm.renew_period_end}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, renew_period_end: e.target.value }))
                            }
                            className="mt-1 w-full border rounded px-3 py-2"
                          />
                        </label>
                        <label className="text-sm">
                          Term end date
                          <input
                            type="datetime-local"
                            value={editForm.term_end_date}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, term_end_date: e.target.value }))
                            }
                            className="mt-1 w-full border rounded px-3 py-2"
                          />
                        </label>
                        <label className="text-sm">
                          Status
                          <select
                            value={editForm.status}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, status: e.target.value }))
                            }
                            className="mt-1 w-full border rounded px-3 py-2"
                          >
                            <option value="open">Open</option>
                            <option value="closed">Closed</option>
                          </select>
                        </label>
                        <label className="text-sm">
                          Price per share
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editForm.price_per_share}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, price_per_share: e.target.value }))
                            }
                            className="mt-1 w-full border rounded px-3 py-2"
                            placeholder="e.g. 49.00"
                          />
                        </label>
                      </div>

                      <label className="text-sm mt-2 block">
                        Notes
                        <textarea
                          rows={2}
                          value={editForm.notes}
                          onChange={(e) =>
                            setEditForm((p) => ({ ...p, notes: e.target.value }))
                          }
                          className="mt-1 w-full border rounded px-3 py-2"
                        />
                      </label>

                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => saveEdit(r.id)}
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

/* ===========================
   Active + Past promotions (list + disable/delete + auto-finish)
   - Active: supabase.rpc("active_promotions_list")
   - Past:   supabase.rpc("past_promotions_list")
   - Normalizes ID fields so buttons always work (uses row._id)
=========================== */
function ActivePromotionsList() {
  // imports needed at top of your page:
  // import { useEffect, useState } from "react";
  // import Link from "next/link";
  // import { supabase } from "../../lib/supabaseClient";

  const [activeRows, setActiveRows] = useState([]);
  const [pastRows, setPastRows] = useState([]);
  const [loadingA, setLoadingA] = useState(true);
  const [loadingP, setLoadingP] = useState(true);
  const [msg, setMsg] = useState("");
  const [autoDisabledIds, setAutoDisabledIds] = useState(() => new Set());

  // ---- helpers ----
  const d = (x) => {
    try { return x ? new Date(x).toLocaleString() : "—"; } catch { return "—"; }
  };

  // normalize a row coming from Active RPC
  function normalizeActiveRow(r) {
    return {
      ...r,
      _id: r.promotion_id ?? r.id, // prefer promotion_id for active rows
    };
  }

  // normalize a row coming from Past RPC or view
  function normalizePastRow(r) {
    const _id = r.id ?? r.promotion_id;
    const horse_name = r.horse_name ?? r.horses?.name ?? "Horse";
    return {
      ...r,
      _id,
      horse_name,
    };
  }

  async function loadActive() {
    setLoadingA(true);
    setMsg("");

    const { data, error } = await supabase.rpc("active_promotions_list");
    if (error) {
      console.error("[Promos] load active error:", error);
      setActiveRows([]);
      setMsg(error.message || "Failed to load active promotions.");
      setLoadingA(false);
      return;
    }

    const rows = Array.isArray(data) ? data.map(normalizeActiveRow) : [];
    setActiveRows(rows);
    setLoadingA(false);

    // AUTO-DISABLE if finished (left <= 0)
    const toFinish = rows.filter(
      (r) => typeof r.left === "number" && r.left <= 0 && !autoDisabledIds.has(r._id)
    );

    for (const r of toFinish) {
      try {
        const { error: upErr } = await supabase
          .from("promotions")
          .update({ enabled: false })
          .eq("id", r._id);
        if (!upErr) {
          setAutoDisabledIds((prev) => {
            const next = new Set(prev);
            next.add(r._id);
            return next;
          });
        }
      } catch (e) {
        console.warn("[Promos] auto-disable failed for", r._id, e);
      }
    }

    if (toFinish.length) {
      await Promise.all([loadActive(), loadPast()]);
    }
  }

  async function loadPast() {
    setLoadingP(true);

    const { data, error } = await supabase.rpc("past_promotions_list");
    if (error) {
      console.error("[Promos] load past error:", error);
      setPastRows([]);
      setLoadingP(false);
      return;
    }

    const rows = Array.isArray(data) ? data.map(normalizePastRow) : [];
    setPastRows(rows);
    setLoadingP(false);
  }

  useEffect(() => {
    loadActive();
    loadPast();

    // purchases affect claimed/left counters
    const ch1 = supabase
      .channel("promo-purchases")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "purchases" },
        () => loadActive()
      )
      .subscribe();

    // any promotion change (enable/disable/edit/delete)
    const ch2 = supabase
      .channel("promo-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "promotions" },
        () => {
          loadActive();
          loadPast();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- actions ---
  async function disablePromotion(promotionId) {
    const row = activeRows.find((r) => r._id === promotionId);
    if (!window.confirm("Disable this promotion? It will stop counting and move to Past promotions.")) return;

    const { error } = await supabase.from("promotions").update({ enabled: false }).eq("id", promotionId);
    if (error) {
      alert(error.message || "Failed to disable promotion.");
      return;
    }

    // optimistic move: Active -> Past
    if (row) {
      setActiveRows((prev) => prev.filter((r) => r._id !== promotionId));
      setPastRows((prev) => [
        normalizePastRow({
          id: promotionId,
          horse_id: row.horse_id,
          horse_name: row.horse_name || "Horse",
          enabled: false,
          quota: row.quota,
          min_shares_required: row.min_shares_required,
          label: row.label,
          reward: row.reward,
          start_at: row.start_at || null,
          end_at: row.end_at || null,
          created_at: row.created_at || null,
          disabled_at: new Date().toISOString(),
        }),
        ...prev,
      ]);
    }

    await Promise.all([loadActive(), loadPast()]);
  }

  async function deletePromotion(promotionId) {
    if (!window.confirm("PERMANENTLY delete this promotion? This cannot be undone.\n\nTip: If you only want to stop it, click Disable instead.")) return;
    const { error } = await supabase.from("promotions").delete().eq("id", promotionId);
    if (error) {
      alert(error.message || "Failed to delete promotion.");
      return;
    }
    setActiveRows((prev) => prev.filter((r) => r._id !== promotionId));
    setPastRows((prev) => prev.filter((p) => p._id !== promotionId));
    await Promise.all([loadActive(), loadPast()]);
  }

  return (
    <section className="bg-white rounded-xl border shadow-sm p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-green-900">Promotions</h2>
        <div className="flex gap-2">
          <button
            onClick={() => { loadActive(); loadPast(); }}
            className="text-sm border rounded px-3 py-1 hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {msg && <p className="mt-2 text-sm text-red-700">{msg}</p>}

      {/* ACTIVE */}
      <div className="mt-5">
        <h3 className="text-base font-semibold text-green-900">Active promotions</h3>

        {loadingA ? (
          <p className="mt-3 text-gray-600">Loading…</p>
        ) : activeRows.length === 0 ? (
          <p className="mt-3 text-gray-600">No active promotions.</p>
        ) : (
          <ul className="mt-4 divide-y">
            {activeRows.map((r) => (
              <li key={r._id} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">
                    {r.horse_name ?? "Horse"}{" "}
                    <span className="text-xs text-gray-500">
                    · Min {r.min_shares_required} or more shares · Quota {r.quota}
                    </span>
                  </div>
                  <div className="text-sm text-gray-700">
                    {r.label || `First ${r.quota} people`} — {r.reward || "Bonus reward"}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {r.claimed} claimed · {r.left} left
                  </div>
                  {(r.start_at || r.end_at) && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      {r.start_at ? `Starts: ${d(r.start_at)}` : ""}
                      {r.start_at && r.end_at ? " · " : ""}
                      {r.end_at ? `Ends: ${d(r.end_at)}` : ""}
                    </div>
                  )}
                  <div className="text-xs text-gray-400 mt-0.5">ID: {r._id}</div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/horses/${r.horse_id}`}
                    className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
                  >
                    View horse →
                  </Link>
                  <a
                    href={`/api/promotions/export?promotion_id=${encodeURIComponent(r._id)}`}
                    className="px-3 py-1.5 rounded bg-amber-600 text-white text-sm hover:bg-amber-700"
                    title="Download qualifying emails (CSV)"
                  >
                    CSV
                  </a>
                  <button
                    onClick={() => disablePromotion(r._id)}
                    className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50"
                    title="Disable (move to Past)"
                  >
                    Disable
                  </button>
                  <button
                    onClick={() => deletePromotion(r._id)}
                    className="px-3 py-1.5 rounded text-sm text-white bg-red-600 hover:bg-red-700"
                    title="Delete permanently"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* PAST */}
      <div className="mt-8">
        <h3 className="text-base font-semibold text-green-900">Past promotions</h3>

        {loadingP ? (
          <p className="mt-3 text-gray-600">Loading…</p>
        ) : pastRows.length === 0 ? (
          <p className="mt-3 text-gray-600">None yet.</p>
        ) : (
          <ul className="mt-4 divide-y">
            {pastRows.map((p) => (
              <li key={p._id} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">
                    {p.horse_name}{" "}
                    <span className="text-xs text-gray-500">
                  · Min {p.min_shares_required ?? "—"} or more shares · Quota {p.quota ?? "—"}
                    </span>
                  </div>
                  <div className="text-sm text-gray-700">
                    {p.label || (p.quota ? `First ${p.quota} people` : "People-based promo")} — {p.reward || "—"}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Started: {d(p.start_at)} ·{" "}
                    {p.end_at ? `Ended: ${d(p.end_at)}` : `Disabled: ${d(p.disabled_at || p.updated_at || p.created_at)}`}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">ID: {p._id}</div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/horses/${p.horse_id}`}
                    className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
                  >
                    View horse →
                  </Link>
                  <a
                    href={`/api/promotions/export?promotion_id=${encodeURIComponent(p._id)}`}
                    className="px-3 py-1.5 rounded bg-amber-600 text-white text-sm hover:bg-amber-700"
                    title="Download the qualifying emails for this finished promo"
                  >
                    CSV
                  </a>
                  <button
                    onClick={() => deletePromotion(p._id)}
                    className="px-3 py-1.5 rounded text-sm text-white bg-red-600 hover:bg-red-700"
                    title="Delete permanently"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
