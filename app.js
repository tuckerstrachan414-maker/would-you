"use strict";

// ================= config =================
const APP_URL = location.origin.startsWith("http")
  ? location.origin + location.pathname.replace(/[^/]*$/, "")
  : "https://tuckerstrachan414-maker.github.io/would-you/"; // used when opened from file://

// Firestore stats backend. null = stats disabled (pure local mode).
// Filled in from BACKEND-SETUP.md once the Firebase project exists.
const STATS_BACKEND = { projectId: "big-if-tucker", apiKey: "AIzaSyAcgQy9eJCUFaK6EXySmBLW5MdkWYt7mV4" }; // public web config — safe to ship

const CATS = ["silly", "gross", "food", "money", "powers", "deep", "spicy"];
const CAT_EMOJI = { silly: "🤪", gross: "🤢", food: "🍕", money: "💰", powers: "⚡", deep: "🌌", spicy: "🌶️" };

// ================= storage =================
const STORE_KEY = "bigif-v1";
const DEFAULTS = {
  seen: {},        // id -> last seen timestamp
  history: [],     // { id, ts, choice }  choice: "a"|"b"|"press"|"walk"|null
  favs: [],        // ids
  queue: [],       // pending votes not yet flushed to backend: { id, field }
  cats: [],        // enabled categories; empty = all
  streak: { last: "", count: 0 },
};
let S = loadStore();

function loadStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    return Object.assign(structuredClone(DEFAULTS), raw);
  } catch (e) { return structuredClone(DEFAULTS); }
}
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(S)); }

const QBYID = {};
for (const q of QUESTIONS) QBYID[q.id] = q;

// ================= streak =================
function bumpStreak() {
  const today = new Date().toISOString().slice(0, 10);
  if (S.streak.last === today) return;
  const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  S.streak.count = (S.streak.last === y) ? S.streak.count + 1 : 1;
  S.streak.last = today;
  save();
}

// ================= utils =================
function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, 2200);
}
function fmtWhen(ts) {
  const d = new Date(ts), now = new Date();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(d, now)) return "today " + time;
  if (sameDay(d, new Date(Date.now() - 864e5))) return "yesterday " + time;
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) + ", " + time;
}
function activeCats() { return S.cats.length ? S.cats : CATS; }
function pool() {
  return QUESTIONS.filter(q => activeCats().includes(q.cat));
}

// ================= picker (never-repeat) =================
function pickNext() {
  const p = pool();
  const unseen = p.filter(q => !(q.id in S.seen));
  if (unseen.length) return unseen[Math.floor(Math.random() * unseen.length)];
  return null; // exhausted — caller shows the "seen it all" card
}
function pickRecycled() {
  const p = pool().slice().sort((a, b) => (S.seen[a.id] || 0) - (S.seen[b.id] || 0));
  return p[0] || null;
}

// ================= stats backend (Firestore REST) =================
function fsDocUrl(id) {
  const b = STATS_BACKEND;
  return "https://firestore.googleapis.com/v1/projects/" + b.projectId +
    "/databases/(default)/documents/votes/" + id + "?key=" + b.apiKey;
}
async function fetchCounts(id) {
  if (!STATS_BACKEND) return null;
  try {
    const r = await fetch(fsDocUrl(id));
    if (r.status === 404) return {}; // no votes yet
    if (!r.ok) return null;
    const doc = await r.json();
    const out = {};
    for (const [k, v] of Object.entries(doc.fields || {})) out[k] = parseInt(v.integerValue || "0", 10);
    return out;
  } catch (e) { return null; }
}
async function sendVote(id, field) {
  if (!STATS_BACKEND) return false;
  const b = STATS_BACKEND;
  const doc = "projects/" + b.projectId + "/databases/(default)/documents/votes/" + id;
  const body = { writes: [{ transform: { document: doc, fieldTransforms: [{ fieldPath: field, increment: { integerValue: "1" } }] } }] };
  try {
    const r = await fetch("https://firestore.googleapis.com/v1/projects/" + b.projectId +
      "/databases/(default)/documents:commit?key=" + b.apiKey,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return r.ok;
  } catch (e) { return false; }
}
// Votes cast while offline wait in S.queue and flush on next load / reconnect.
async function flushQueue() {
  if (!STATS_BACKEND || !S.queue.length) return;
  const q = S.queue.slice();
  for (const v of q) {
    const ok = await sendVote(v.id, v.field);
    if (!ok) break;
    S.queue.shift();
    save();
  }
}
function castVote(id, field) {
  sendVote(id, field).then(ok => {
    if (!ok) { S.queue.push({ id, field }); save(); }
  });
}

// ================= answering =================
function recordAnswer(q, choice) {
  const ts = Date.now();
  S.seen[q.id] = ts;
  S.history.push({ id: q.id, ts, choice });
  save();
  if (choice && q.type !== "hypo") castVote(q.id, choice);
}
function markSeen(q) {
  if (!(q.id in S.seen)) { S.seen[q.id] = Date.now(); save(); }
}
function toggleFav(id) {
  const i = S.favs.indexOf(id);
  if (i >= 0) S.favs.splice(i, 1); else S.favs.push(id);
  save();
}

// ================= share =================
function shareQuestion(q) {
  const link = APP_URL + "?q=" + q.id;
  let text = q.text;
  if (q.type === "wyr") text += " 🅰️ " + q.a + "  …or…  🅱️ " + q.b;
  if (q.type === "button") text += " " + q.catch + " Would YOU press the button?";
  const payload = { title: "BIG IF 🤔", text: text + "\n\nVote here 👉", url: link };
  if (navigator.share) {
    navigator.share(payload).catch(() => {});
  } else {
    navigator.clipboard.writeText(text + "\n" + link)
      .then(() => toast("Copied! Paste it to a friend 📋"))
      .catch(() => toast("Couldn't copy 😞"));
  }
}

// ================= play screen =================
let current = null;   // question showing right now
let deepLinkId = null; // set from ?q= at boot, shown first

function favBtnHtml(id) {
  return '<button class="fav-btn' + (S.favs.includes(id) ? " on" : "") + '" data-fav="' + id + '" aria-label="favourite">' +
    (S.favs.includes(id) ? "⭐" : "☆") + "</button>";
}

function renderPlay() {
  const scr = document.getElementById("screen");
  scr.innerHTML = "";
  if (deepLinkId && QBYID[deepLinkId]) {
    current = QBYID[deepLinkId];
    deepLinkId = null;
  } else if (!current) {
    current = pickNext();
  }
  if (!current) { renderExhausted(scr); return; }
  const q = current;
  const card = el("div", "card wobble cat-" + q.cat);
  card.innerHTML =
    '<div class="card-top"><span class="cat-tag">' + CAT_EMOJI[q.cat] + " " + q.cat + "</span>" + favBtnHtml(q.id) + "</div>" +
    '<p class="q-text">' + esc(q.text) + "</p>";
  if (q.type === "wyr") {
    card.appendChild(el("button", "opt opt-a", "🅰️ " + esc(q.a)));
    card.appendChild(el("div", "or-divider", "or"));
    card.appendChild(el("button", "opt opt-b", "🅱️ " + esc(q.b)));
  } else if (q.type === "button") {
    card.appendChild(el("p", "q-catch", esc(q.catch)));
    card.appendChild(el("button", "big-button", "PRESS<br>IT"));
    card.appendChild(el("button", "walk-away", "🚶 nah, walk away"));
  } else { // hypo
    card.appendChild(el("p", "hypo-hint", "no right answer — just ponder it (or make a friend suffer)"));
    card.appendChild(el("button", "next-btn", "next one →"));
  }
  const actions = el("div", "card-actions");
  const shareB = el("button", "share-btn", "📤 send to a friend");
  actions.appendChild(shareB);
  if (q.type !== "hypo") {
    const skipB = el("button", "skip-btn", "skip →");
    skipB.onclick = () => { markSeen(q); current = null; renderPlay(); };
    actions.appendChild(skipB);
  }
  scr.appendChild(card);
  scr.appendChild(actions);

  shareB.onclick = () => shareQuestion(q);
  card.querySelector("[data-fav]").onclick = (e) => { toggleFav(q.id); renderPlay(); };
  if (q.type === "wyr") {
    card.querySelector(".opt-a").onclick = () => answer(q, "a");
    card.querySelector(".opt-b").onclick = () => answer(q, "b");
  } else if (q.type === "button") {
    card.querySelector(".big-button").onclick = () => answer(q, "press");
    card.querySelector(".walk-away").onclick = () => answer(q, "walk");
  } else {
    card.querySelector(".next-btn").onclick = () => { recordAnswer(q, null); current = null; renderPlay(); };
  }
}

function renderExhausted(scr) {
  const card = el("div", "card wobble exhausted");
  card.innerHTML = '<p class="q-text">🎉 You have pondered ALL ' + pool().length +
    ' questions in this mix!</p><p class="hypo-hint">You can replay old ones (stats still count), or widen your categories in More.</p>';
  const b = el("button", "next-btn", "🔁 replay the oldies");
  b.onclick = () => { current = pickRecycled(); renderPlay(); };
  card.appendChild(b);
  scr.appendChild(card);
}

// ================= reveal (after answering) =================
function answer(q, choice) {
  recordAnswer(q, choice);
  renderReveal(q, choice);
}
function labelFor(q, field) {
  if (q.type === "wyr") return field === "a" ? q.a : q.b;
  return field === "press" ? "PRESSED IT 🔴" : "walked away 🚶";
}
function fieldsFor(q) { return q.type === "wyr" ? ["a", "b"] : ["press", "walk"]; }

async function renderReveal(q, choice) {
  const scr = document.getElementById("screen");
  scr.innerHTML = "";
  const card = el("div", "card wobble cat-" + q.cat);
  card.innerHTML =
    '<div class="card-top"><span class="cat-tag">' + CAT_EMOJI[q.cat] + " " + q.cat + "</span>" + favBtnHtml(q.id) + "</div>" +
    '<p class="q-text small">' + esc(q.text) + (q.catch ? " " + esc(q.catch) : "") + "</p>" +
    '<p class="you-picked">you picked: <b>' + esc(labelFor(q, choice)) + "</b></p>" +
    '<div class="stats-zone"><p class="stats-wait">counting the votes… ✏️</p></div>';
  scr.appendChild(card);
  const nextB = el("button", "next-btn big", "next one →");
  nextB.onclick = () => { current = null; renderPlay(); };
  const actions = el("div", "card-actions");
  const shareB = el("button", "share-btn", "📤 send to a friend");
  shareB.onclick = () => shareQuestion(q);
  actions.appendChild(shareB);
  scr.appendChild(nextB);
  scr.appendChild(actions);
  card.querySelector("[data-fav]").onclick = () => { toggleFav(q.id); card.querySelector(".card-top").outerHTML = '<div class="card-top"><span class="cat-tag">' + CAT_EMOJI[q.cat] + " " + q.cat + "</span>" + favBtnHtml(q.id) + "</div>"; renderReveal(q, choice); };

  const zone = card.querySelector(".stats-zone");
  const counts = await fetchCounts(q.id);
  renderStatsBar(zone, q, choice, counts);
}

function renderStatsBar(zone, q, choice, counts) {
  const [f1, f2] = fieldsFor(q);
  if (!counts) {
    zone.innerHTML = '<p class="stats-wait">📡 no signal — your vote is saved and will count later!</p>';
    return;
  }
  let c1 = counts[f1] || 0, c2 = counts[f2] || 0;
  // Firestore read can lag the just-sent increment; make sure YOUR vote shows.
  if ((choice === f1 && c1 === 0) || (c1 + c2 === 0 && choice === f1)) c1 = Math.max(c1, 1);
  if ((choice === f2 && c2 === 0) || (c1 + c2 === 0 && choice === f2)) c2 = Math.max(c2, 1);
  const total = c1 + c2;
  const p1 = Math.round(100 * c1 / total), p2 = 100 - p1;
  const yourPct = choice === f1 ? p1 : p2;
  const msg = yourPct < 35 ? "🔥 HOT TAKE — you're with just " + yourPct + "%!"
    : yourPct < 50 ? "😏 minority club: " + yourPct + "% agree with you"
    : yourPct === 50 ? "⚖️ dead even split!"
    : "🤝 you're with the " + yourPct + "% majority";
  zone.innerHTML =
    '<div class="bar"><div class="bar-a" style="width:0%"></div><div class="bar-b" style="width:0%"></div></div>' +
    '<div class="bar-labels"><span>' + p1 + "% " + esc(shortLabel(q, f1)) + "</span><span>" + p2 + "% " + esc(shortLabel(q, f2)) + "</span></div>" +
    '<p class="verdict">' + msg + "</p>" +
    '<p class="vote-count">' + total.toLocaleString() + " vote" + (total === 1 ? "" : "s") + " so far</p>";
  requestAnimationFrame(() => {
    zone.querySelector(".bar-a").style.width = p1 + "%";
    zone.querySelector(".bar-b").style.width = p2 + "%";
  });
}
function shortLabel(q, field) {
  if (q.type === "button") return field === "press" ? "pressed" : "walked";
  const t = field === "a" ? q.a : q.b;
  return t.length > 24 ? t.slice(0, 22) + "…" : t;
}

// ================= history / favourites =================
function questionRow(h) {
  const q = QBYID[h.id];
  if (!q) return null;
  const row = el("div", "hist-row wobble-sm cat-" + q.cat);
  const picked = h.choice ? '<span class="hist-pick">' + esc(labelFor(q, h.choice)) + "</span>" : "";
  row.innerHTML =
    '<div class="hist-main"><p class="hist-q">' + esc(q.text) + (q.type === "wyr" ? " " + esc(q.a) + " / " + esc(q.b) : q.catch ? " " + esc(q.catch) : "") + "</p>" +
    '<p class="hist-meta">' + CAT_EMOJI[q.cat] + " " + fmtWhen(h.ts) + " " + picked + "</p></div>" +
    favBtnHtml(q.id);
  row.querySelector("[data-fav]").onclick = (e) => { e.stopPropagation(); toggleFav(q.id); render(); };
  row.querySelector(".hist-main").onclick = () => { current = q; location.hash = "#play"; };
  return row;
}
function renderHistory() {
  const scr = document.getElementById("screen");
  scr.innerHTML = '<h2 class="screen-title">🕰️ your history</h2>';
  const items = S.history.slice().reverse();
  if (!items.length) { scr.appendChild(el("p", "empty-note", "Nothing yet — go ponder something!")); return; }
  for (const h of items) { const r = questionRow(h); if (r) scr.appendChild(r); }
}
function renderFavs() {
  const scr = document.getElementById("screen");
  scr.innerHTML = '<h2 class="screen-title">⭐ favourites</h2>';
  if (!S.favs.length) { scr.appendChild(el("p", "empty-note", "Star a question and it lands here.")); return; }
  for (const id of S.favs.slice().reverse()) {
    const h = S.history.slice().reverse().find(x => x.id === id) || { id, ts: S.seen[id] || Date.now(), choice: null };
    const r = questionRow(h); if (r) scr.appendChild(r);
  }
}

// ================= stats screen =================
function renderStats() {
  const scr = document.getElementById("screen");
  const answered = S.history.filter(h => h.choice);
  const pressed = answered.filter(h => h.choice === "press").length;
  const walked = answered.filter(h => h.choice === "walk").length;
  const seenCount = Object.keys(S.seen).length;
  scr.innerHTML = '<h2 class="screen-title">📊 your stats</h2>' +
    statTile(seenCount + " / " + QUESTIONS.length, "questions pondered") +
    statTile(answered.length, "answers locked in") +
    statTile("🔴 " + pressed + " vs 🚶 " + walked, "buttons pressed vs walked") +
    statTile("🔥 " + S.streak.count + " day" + (S.streak.count === 1 ? "" : "s"), "current streak") +
    statTile(S.favs.length, "favourites starred") +
    (STATS_BACKEND ? "" : '<p class="empty-note">🌍 global percentages switch on once the app is online with its stats backend.</p>');
}
function statTile(big, label) {
  return '<div class="stat-tile wobble-sm"><div class="stat-big">' + big + '</div><div class="stat-label">' + label + "</div></div>";
}

// ================= more / settings =================
function renderMore() {
  const scr = document.getElementById("screen");
  scr.innerHTML = '<h2 class="screen-title">⚙️ more</h2><p class="setting-label">categories in your mix:</p>';
  const chipbox = el("div", "chips");
  for (const c of CATS) {
    const on = activeCats().includes(c);
    const chip = el("button", "chip" + (on ? " on" : ""), CAT_EMOJI[c] + " " + c);
    chip.onclick = () => {
      let cats = S.cats.length ? S.cats.slice() : CATS.slice();
      cats = cats.includes(c) ? cats.filter(x => x !== c) : cats.concat(c);
      if (!cats.length) { toast("Need at least one category! 😅"); return; }
      S.cats = cats.length === CATS.length ? [] : cats;
      save(); current = null; renderMore();
    };
    chipbox.appendChild(chip);
  }
  scr.appendChild(chipbox);
  const reset = el("button", "danger-btn", "🗑️ forget everything I've seen");
  reset.onclick = () => {
    if (!confirm("Wipe history, favourites and seen-list? Global votes you cast stay counted.")) return;
    S = structuredClone(DEFAULTS); save(); current = null; toast("Fresh brain! 🧠");
    renderMore();
  };
  scr.appendChild(el("p", "setting-label", "danger zone:"));
  scr.appendChild(reset);
  scr.appendChild(el("p", "about-note", "BIG IF — hypotheticals to ruin friendships (lovingly). Made with scribbles."));
}

// ================= router / boot =================
const SCREENS = { play: renderPlay, history: renderHistory, favs: renderFavs, stats: renderStats, more: renderMore };
function render() {
  const tab = (location.hash || "#play").slice(1);
  const fn = SCREENS[tab] || renderPlay;
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === (SCREENS[tab] ? tab : "play")));
  fn();
  const st = document.getElementById("streak");
  st.hidden = S.streak.count < 2;
  document.getElementById("streak-n").textContent = S.streak.count;
}
window.addEventListener("hashchange", render);
document.querySelectorAll(".tab").forEach(b => b.onclick = () => { location.hash = "#" + b.dataset.tab; });

(function boot() {
  const qid = new URLSearchParams(location.search).get("q");
  if (qid && QBYID[qid]) { deepLinkId = qid; location.hash = "#play"; }
  bumpStreak();
  flushQueue();
  window.addEventListener("online", flushQueue);
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  render();
})();
