import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(filename: string) {
  const path = resolve(projectRoot, filename);
  if (!existsSync(path)) return;

  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq <= 0) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

/** Load `.env` then `.env.local` from the project root (local wins). */
export function loadProjectEnv() {
  loadEnvFile(".env");
  loadEnvFile(".env.local");
}

function readDatabaseUrlFromArg(): string | null {
  const prefix = "--database-url=";
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

export function requireDatabaseUrl(): string {
  const fromArg = readDatabaseUrlFromArg();
  if (fromArg) {
    process.env.DATABASE_URL = fromArg;
    return fromArg;
  }

  loadProjectEnv();
  const url = process.env.DATABASE_URL?.trim();
  if (!url || url.includes("localhost:5432") || url.includes("...@")) {
    console.error(
      [
        "DATABASE_URL is missing or invalid.",
        "",
        "Set the full Railway URL in .env at the project root:",
        '  DATABASE_URL="postgresql://postgres:PASSWORD@thomas.proxy.rlwy.net:59699/railway"',
        "",
        "Or pass it for one run:",
        '  npm run reanalyze-thermals -- --database-url="postgresql://..."',
      ].join("\n"),
    );
    process.exit(1);
  }
  return url;
}

export function databaseHostLabel(url: string): string {
  try {
    return new URL(url.replace(/^postgresql:/, "http:")).host;
  } catch {
    return "(unknown host)";
  }
}
