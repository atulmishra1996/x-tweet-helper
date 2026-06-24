#!/usr/bin/env node
/**
 * Patch open-antigravity for Antigravity IDE on macOS (state db path + optional apiKey).
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const root = join(process.cwd(), "node_modules/open-antigravity/src/bridge");

const statedbPath = join(root, "statedb.ts");
const converterPath = join(process.cwd(), "node_modules/open-antigravity/src/converter.ts");

if (!existsSync(statedbPath)) {
  console.warn("[patch-open-antigravity] open-antigravity not installed, skipping");
  process.exit(0);
}

const statedb = readFileSync(statedbPath, "utf8");
if (!statedb.includes("Antigravity IDE")) {
  writeFileSync(
    statedbPath,
    statedb.replace(
      `const STATE_DB_PATH = path.join(
  homedir(),
  'Library/Application Support/Antigravity/User/globalStorage/state.vscdb'
);`,
      `const STATE_DB_PATHS = [
  path.join(homedir(), 'Library/Application Support/Antigravity IDE/User/globalStorage/state.vscdb'),
  path.join(homedir(), 'Library/Application Support/Antigravity/User/globalStorage/state.vscdb'),
];`,
    ).replace(
      `function queryDb(sql: string): string {
  try {
    return execSync(\`sqlite3 "\${STATE_DB_PATH}" "\${sql}"\`, {
      encoding: 'utf-8',
      timeout: 5000
    }).trim();
  } catch {
    return '';
  }
}`,
      `function queryDb(sql: string): string {
  for (const dbPath of STATE_DB_PATHS) {
    try {
      const result = execSync(\`sqlite3 "\${dbPath}" "\${sql}"\`, {
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();
      if (result) return result;
    } catch {}
  }
  return '';
}`,
    ),
  );
  console.log("[patch-open-antigravity] updated statedb paths for Antigravity IDE");
}

const converter = readFileSync(converterPath, "utf8");
if (converter.includes("if (!srv || !apiKey) return null;")) {
  writeFileSync(
    converterPath,
    converter.replace(
      "if (!srv || !apiKey) return null;",
      "if (!srv) return null; // apiKey optional for local IDE session (csrf auth)",
    ),
  );
  console.log("[patch-open-antigravity] relaxed apiKey requirement in converter");
}
