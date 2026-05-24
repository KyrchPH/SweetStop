import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Client } = pg;
const args = new Set(process.argv.slice(2));
const runSchemaOnly = args.has("--schema-only");
const runSeedOnly = args.has("--seed-only");

if (runSchemaOnly && runSeedOnly) {
  console.error("Use either --schema-only or --seed-only, not both.");
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error("Missing DATABASE_URL (or SUPABASE_DB_URL) in environment.");
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sqlDirectory = path.resolve(__dirname, "../../db/sql");

const sqlFiles = [];

if (!runSeedOnly) {
  sqlFiles.push("001_schema.sql");
}

if (!runSchemaOnly) {
  sqlFiles.push("002_seed.sql");
}

const useSsl = /supabase\.(co|in)/i.test(connectionString);
const client = new Client({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined
});

async function applySqlFile(fileName) {
  const filePath = path.join(sqlDirectory, fileName);
  const sql = await fs.readFile(filePath, "utf8");
  console.log(`Applying ${fileName}...`);
  await client.query(sql);
}

async function main() {
  try {
    await client.connect();

    for (const fileName of sqlFiles) {
      await applySqlFile(fileName);
    }

    console.log("Database setup completed.");
  } catch (error) {
    console.error("Database setup failed.");
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

await main();
