// Tucker's moderation tool: lists pending hypo takes, approve (y) / reject (n)
// / skip (s). Needs `firebase login` done once on this machine (uses the CLI's
// saved credentials). Run via approve.bat or `node approve.js`.
"use strict";
const os = require("os");
const path = require("path");
const readline = require("readline");
const PROJECT = "big-if-tucker";
const BASE = "https://firestore.googleapis.com/v1/projects/" + PROJECT + "/databases/(default)/documents";
// firebase-tools' public OAuth client (embedded in the CLI, not a secret)
const CLIENT_ID = "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
const CLIENT_SECRET = "j9iVZfS8kkCEFUPaAeJV0sAi";

async function accessToken() {
  const cfg = require(path.join(os.homedir(), ".config", "configstore", "firebase-tools.json"));
  const rt = cfg.tokens && cfg.tokens.refresh_token;
  if (!rt) throw new Error("No firebase login found — run: npx firebase-tools login");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: rt, client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("Token refresh failed: " + JSON.stringify(j));
  return j.access_token;
}
function ask(rl, q) { return new Promise(res => rl.question(q, res)); }

(async () => {
  const tok = await accessToken();
  const H = { Authorization: "Bearer " + tok, "Content-Type": "application/json" };
  const body = { structuredQuery: {
    from: [{ collectionId: "takes" }],
    where: { fieldFilter: { field: { fieldPath: "approved" }, op: "EQUAL", value: { booleanValue: false } } },
    limit: 200,
  } };
  const r = await fetch(BASE + ":runQuery", { method: "POST", headers: H, body: JSON.stringify(body) });
  const rows = (await r.json()).filter(x => x.document);
  if (!rows.length) { console.log("No pending takes. All clear!"); return; }
  console.log(rows.length + " pending take(s).\n");
  const QB = {};
  try { global.window = undefined; const qsrc = require("fs").readFileSync(path.join(__dirname, "questions.js"), "utf8");
    for (const m of qsrc.matchAll(/id: "([^"]+)",[^\n]*text: "([^"]*)"/g)) QB[m[1]] = m[2];
  } catch (e) {}
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  for (const row of rows) {
    const f = row.document.fields;
    const qid = f.qid.stringValue, text = f.text.stringValue, name = (f.name || {}).stringValue || "";
    console.log("Q: " + (QB[qid] || qid));
    console.log('take: "' + text + '"' + (name ? "  — " + name : ""));
    const a = (await ask(rl, "approve? (y = approve / n = delete / s = skip) ")).trim().toLowerCase();
    if (a === "y") {
      const u = "https://firestore.googleapis.com/v1/" + row.document.name + "?updateMask.fieldPaths=approved";
      const res = await fetch(u, { method: "PATCH", headers: H, body: JSON.stringify({ fields: { approved: { booleanValue: true } } }) });
      console.log(res.ok ? "approved ✓\n" : "FAILED: " + res.status + "\n");
    } else if (a === "n") {
      const res = await fetch("https://firestore.googleapis.com/v1/" + row.document.name, { method: "DELETE", headers: H });
      console.log(res.ok ? "deleted ✗\n" : "FAILED: " + res.status + "\n");
    } else console.log("skipped\n");
  }
  rl.close();
  console.log("Done.");
})().catch(e => { console.error(e.message); process.exitCode = 1; });
