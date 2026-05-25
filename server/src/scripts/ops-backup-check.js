import "dotenv/config";

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const { Client } = pg;
const REQUIRED_TABLES = [
  "accounts",
  "account_branch_roles",
  "products",
  "product_variants",
  "branch_variant_config",
  "branch_variant_inventory",
  "sales_receipts",
  "sales_receipt_items",
  "cash_movements",
  "shifts",
  "daily_reports",
  "audit_logs",
  "auth_refresh_tokens",
  "password_reset_tokens"
];

function getConnectionString() {
  return process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
}

function resolveOutputPath() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const reportsDir = path.resolve(__dirname, "../../ops/recovery-checks");
  const now = new Date().toISOString().replace(/[:.]/g, "-");
  return {
    reportsDir,
    reportFilePath: path.join(reportsDir, `backup-check-${now}.json`)
  };
}

async function assertTablesExist(client) {
  const result = await client.query(
    `
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename = any($1::text[])
    `,
    [REQUIRED_TABLES]
  );

  const present = new Set(result.rows.map((row) => row.tablename));
  const missing = REQUIRED_TABLES.filter((name) => !present.has(name));
  return {
    present_count: present.size,
    missing
  };
}

async function collectRowCounts(client) {
  const rowCounts = {};

  for (const tableName of REQUIRED_TABLES) {
    const result = await client.query(`select count(*)::int as total from public.${tableName}`);
    rowCounts[tableName] = result.rows[0].total;
  }

  return rowCounts;
}

async function runRecoverySmokeCheck(client) {
  await client.query("begin");

  try {
    await client.query("create temporary table tmp_recovery_check (id integer primary key, value text)");
    await client.query("insert into tmp_recovery_check (id, value) values (1, 'ok')");
    const result = await client.query("select count(*)::int as total from tmp_recovery_check");

    if (result.rows[0].total !== 1) {
      throw new Error("Recovery smoke check validation failed.");
    }

    await client.query("rollback");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function main() {
  const connectionString = getConnectionString();

  if (!connectionString) {
    console.error("Missing DATABASE_URL (or SUPABASE_DB_URL).");
    process.exit(1);
  }

  const useSsl = /supabase\.(co|in)/i.test(connectionString);
  const client = new Client({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined
  });

  const report = {
    generated_at: new Date().toISOString(),
    checks: {
      database_connection: false,
      required_tables: null,
      row_counts: null,
      recovery_smoke: false
    },
    status: "FAILED"
  };

  try {
    await client.connect();
    report.checks.database_connection = true;

    const requiredTables = await assertTablesExist(client);
    report.checks.required_tables = requiredTables;

    if (requiredTables.missing.length > 0) {
      throw new Error(`Missing required tables: ${requiredTables.missing.join(", ")}`);
    }

    report.checks.row_counts = await collectRowCounts(client);
    await runRecoverySmokeCheck(client);
    report.checks.recovery_smoke = true;
    report.status = "OK";
  } catch (error) {
    report.error = {
      message: error.message
    };
  } finally {
    await client.end();
  }

  const { reportsDir, reportFilePath } = resolveOutputPath();
  await fs.mkdir(reportsDir, { recursive: true });
  await fs.writeFile(reportFilePath, JSON.stringify(report, null, 2), "utf8");

  console.log(`Ops backup/recovery check report written to ${reportFilePath}`);

  if (report.status !== "OK") {
    process.exit(1);
  }
}

await main();
