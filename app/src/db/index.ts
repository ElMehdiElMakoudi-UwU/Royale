import "server-only";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { openDb } from "./migrate";
import * as schema from "./schema";

export const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");

function open() {
  fs.mkdirSync(dataDir, { recursive: true });
  const sqlite = new Database(path.join(dataDir, "royale.db"));
  sqlite.pragma("journal_mode = WAL");
  return openDb(sqlite);
}

// Reuse one connection across hot reloads in dev.
const g = globalThis as unknown as { __royaleDb?: ReturnType<typeof open> };
export const db = g.__royaleDb ?? (g.__royaleDb = open());
export { schema };
