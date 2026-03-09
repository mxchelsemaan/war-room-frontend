/**
 * Run all SQL migration files in supabase/migrations/ in order.
 * Uses the Supabase direct postgres connection (port 5432).
 *
 * Usage:
 *   node scripts/migrate.mjs
 *
 * Requires: SUPABASE_URL and SUPABASE_KEY in .env
 */

import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Load .env manually (no dotenv dep needed in Node 20+)
const envPath = path.resolve(process.cwd(), ".env");
const envVars = {};
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m) envVars[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const supabaseUrl = envVars.SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_KEY in .env");
  process.exit(1);
}

// Derive postgres connection from Supabase URL
// https://<project>.supabase.co  →  db.<project>.supabase.co:5432
const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const host = `db.${projectRef}.supabase.co`;

const client = new pg.Client({
  host,
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: supabaseKey,
  ssl: { rejectUnauthorized: false },
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../supabase/migrations");

const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

try {
  await client.connect();
  console.log(`Connected to ${host}`);

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    console.log(`Running ${file}…`);
    await client.query(sql);
    console.log(`  ✓ ${file}`);
  }

  console.log("All migrations complete.");
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
