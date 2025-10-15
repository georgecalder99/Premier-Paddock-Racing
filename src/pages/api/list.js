// src/pages/api/list.js
// Lists files that Next sees under /pages/api
import fs from "fs";
import path from "path";

export default function handler(req, res) {
  try {
    const apiDir = path.join(process.cwd(), "src", "pages", "api");
    const files = fs.readdirSync(apiDir, { withFileTypes: true }).map(d => ({
      name: d.name,
      isFile: d.isFile(),
      isDir: d.isDirectory(),
    }));
    res.status(200).json({ cwd: process.cwd(), apiDir, files });
  } catch (e) {
    res.status(500).json({ error: e?.message || "Failed to read api dir" });
  }
}