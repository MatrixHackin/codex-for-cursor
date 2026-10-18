#!/usr/bin/env node
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDataDir, resolvePluginRoot } from "../lib/paths.mjs";
import { saveContext } from "../lib/jobs.mjs";
import { readStdinJson } from "../lib/stdin.mjs";

const pluginRoot = resolvePluginRoot({
  pluginRoot: process.env.CURSOR_PLUGIN_ROOT || dirname(dirname(fileURLToPath(import.meta.url))),
});
const dataDir = resolveDataDir();

const input = await readStdinJson();
const cursorSessionId =
  input.session_id || input.sessionId || process.env.CURSOR_SESSION_ID || `unknown-${Date.now()}`;

saveContext(dataDir, {
  cursorSessionId,
  pluginRoot,
  dataDir,
  workspaceRoots: process.env.CURSOR_PROJECT_DIR ? [process.env.CURSOR_PROJECT_DIR] : [],
  createdAt: new Date().toISOString(),
});

const additional_context = [
  "MyCodex is active for this conversation.",
  "",
  `pluginRoot: ${pluginRoot}`,
  `cursorSessionId: ${cursorSessionId}`,
  `dataDir: ${dataDir}`,
  "",
  "When the user invokes /mycodex:* , run the companion with the Shell tool.",
  'On the first attempt set required_permissions: ["all"] so Codex can read ~/.codex.',
  "Do not rely on environment variables being forwarded into Agent Shell.",
  "Do not implement the user's task yourself. A receipt is not a completed result.",
  "",
  "Invoke exactly once:",
  `node "${join(pluginRoot, "scripts", "codex-run.mjs")}" <setup|exec|review|status|result|cancel> --plugin-root "${pluginRoot}" --cursor-session "${cursorSessionId}" -- <user argv>`,
  "",
  "Pass --model / --effort only when the user wrote them.",
  "Never call `codex exec resume --last`. Resume uses the session id stored by MyCodex.",
].join("\n");

process.stdout.write(`${JSON.stringify({ additional_context })}\n`);
