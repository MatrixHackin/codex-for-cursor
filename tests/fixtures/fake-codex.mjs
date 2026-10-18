#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const argv = process.argv.slice(2);
const recordDir = process.env.FAKE_CODEX_RECORD;
const sleepMs = Number(process.env.FAKE_CODEX_SLEEP || "0");

function flagValue(name) {
  const eq = argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const i = argv.indexOf(name);
  if (i !== -1) return argv[i + 1];
  return null;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

if (recordDir) {
  mkdirSync(recordDir, { recursive: true });
  writeFileSync(
    join(recordDir, `invoke-${Date.now()}-${process.pid}.json`),
    `${JSON.stringify({ argv, cwd: process.cwd(), pid: process.pid }, null, 2)}\n`,
  );
}

if (argv.includes("--version")) {
  process.stdout.write("codex-cli 0.0.0-mycodex-fake\n");
  process.exit(0);
}

if (argv.includes("--last")) {
  process.stderr.write("fake-codex: --last is forbidden in MyCodex tests\n");
  process.exit(3);
}

if (sleepMs > 0) {
  await new Promise((r) => setTimeout(r, sleepMs));
}

const stdin = await readStdin();
const resumeIdx = argv.indexOf("resume");
const resumeId = resumeIdx !== -1 ? argv[resumeIdx + 1] : null;
const threadId = resumeId && !String(resumeId).startsWith("-") ? resumeId : "sess-fake-001";
const lastPath = flagValue("--output-last-message") || flagValue("-o");

const isReview = argv[0] === "review" || argv.includes("review");
const text = isReview
  ? `FAKE_REVIEW argv=${JSON.stringify(argv)} stdin=${stdin.trim()}`
  : `FAKE_RESULT session=${threadId} prompt=${stdin.trim()}`;

if (lastPath) {
  mkdirSync(dirname(lastPath), { recursive: true });
  writeFileSync(lastPath, `${text}\n`, "utf8");
}

if (argv.includes("--json") || !isReview) {
  const events = [
    { type: "thread.started", thread_id: threadId },
    { type: "item.completed", item: { id: "item_1", type: "agent_message", text } },
    { type: "turn.completed" },
  ];
  process.stdout.write(`${events.map((e) => JSON.stringify(e)).join("\n")}\n`);
} else {
  process.stdout.write(`${text}\n`);
}
