import pg from "pg";

const { Pool } = pg;

let poolInstance;

function shouldUseSsl(connectionString) {
  try {
    const { hostname, searchParams } = new URL(connectionString);
    return (
      searchParams.get("sslmode") === "require" ||
      /(^|\.)supabase\.(co|com|in)$/i.test(hostname)
    );
  } catch {
    return /supabase\.(co|com|in)/i.test(connectionString);
  }
}

export function getDbPool() {
  if (poolInstance) {
    return poolInstance;
  }

  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL (or SUPABASE_DB_URL) is not configured.");
  }

  poolInstance = new Pool({
    connectionString,
    ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined
  });

  return poolInstance;
}
