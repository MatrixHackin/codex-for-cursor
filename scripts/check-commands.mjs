#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const commandsDir = join(root, "commands");
const required = ["run.md", "setup.md", "review.md", "status.md", "result.md", "cancel.md"];
const files = readdirSync(commandsDir).filter((name) => name.endsWith(".md"));
const errors = [];

for (const name of required) {
  if (!files.includes(name)) errors.push(`missing commands/${name}`);
}

for (const name of files) {
  const text = readFileSync(join(commandsDir, name), "utf8");
  if (!text.startsWith("---")) errors.push(`${name}: missing YAML frontmatter`);
  if (!/^name:\s*[a-z0-9-]+/m.test(text)) errors.push(`${name}: missing name`);
  if (!/^description:\s*.+/m.test(text)) errors.push(`${name}: missing description`);
  if (!text.includes("$ARGUMENTS")) errors.push(`${name}: missing $ARGUMENTS`);
  if (/\beval\b/.test(text)) errors.push(`${name}: contains eval`);
  if (!text.includes("scripts/codex-run.mjs")) {
    errors.push(`${name}: must invoke scripts/codex-run.mjs`);
  }
  if (!text.includes("mycodex")) errors.push(`${name}: must mention mycodex`);
  if (text.includes("~/.cursor/commands/codex.md") || text.includes("/codex ")) {
    errors.push(`${name}: path A only — do not document a user-level /codex alias`);
  }
  if (/powershell/i.test(text)) errors.push(`${name}: v1 is POSIX-only; no PowerShell`);
}

if (errors.length) {
  process.stderr.write(`${errors.map((e) => `- ${e}`).join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(`ok ${files.length} command files\n`);
