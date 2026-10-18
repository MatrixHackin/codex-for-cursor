export async function readStdinText() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks.map((c) => (typeof c === "string" ? Buffer.from(c) : c))).toString(
    "utf8",
  );
}

export async function readStdinJson() {
  const text = (await readStdinText()).trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
