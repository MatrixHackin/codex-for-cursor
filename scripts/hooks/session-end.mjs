#!/usr/bin/env node
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deleteContext } from "../lib/jobs.mjs";
import { resolveDataDir, resolvePluginRoot } from "../lib/paths.mjs";
import { readStdinJson } from "../lib/stdin.mjs";

resolvePluginRoot({
  pluginRoot: process.env.CURSOR_PLUGIN_ROOT || dirname(dirname(fileURLToPath(import.meta.url))),
});
const dataDir = resolveDataDir();
const input = await readStdinJson();
const cursorSessionId = input.session_id || input.sessionId;
if (cursorSessionId) deleteContext(dataDir, cursorSessionId);
process.stdout.write("{}\n");
