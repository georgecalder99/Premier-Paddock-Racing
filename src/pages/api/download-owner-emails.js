// src/pages/api/download-owner-emails.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // must be service role key (server-side only)
);

export default async function handler(req, res) {
  try {
    const { horse_id } = req.query;

    if (!horse_id) {
      return res.status(400).json({ error: "Missing horse_id parameter" });
    }

    // ✅ Query correct columns from your view
    const { data, error } = await supabase
      .from("owner_emails_by_horse")
      .select("horse_name, owner_email")
      .eq("horse_id", horse_id);

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ error: "No owners found for this horse" });
    }

    // ✅ Build CSV
    const csvRows = [
      ["Horse Name", "Email"],
      ...data.map((r) => [r.horse_name || "", r.owner_email || ""]),
    ];
    const csv = csvRows.map((r) => r.join(",")).join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="owner_emails_${horse_id}.csv"`
    );
    res.status(200).send(csv);
  } catch (err) {
    console.error("❌ Error in /api/download-owner-emails:", err);
    res.status(500).json({ error: err.message });
  }
}