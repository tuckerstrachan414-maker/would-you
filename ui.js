"use strict";
// BIG IF Monopoly — UI layer. Renders board + HUD from engine state,
// drives bots with timers, saves to localStorage after every action.
(function () {
const Game = window.MonopolyGame, AI = window.MonopolyAI;
const { SPACES, GROUPS } = window.MONOPOLY_DATA;
const SAVE_KEY = "monopoly-v1";

const PLAYER_COLORS = ["#d95f5f", "#5aa7e8", "#8fc95a", "#a97fe8", "#e0a44f", "#5fd0b0"];
const BOT_NAMES = ["The Duke", "Vivienne", "Mr. Ashford", "Contessa", "Sterling"];

// Scribble icon registry, same convention as ../icons.js — no emoji in chrome.
const M_ICON = {
  dice:  '<path d="M5 4.5 C5 3.6 5.8 3 6.6 3.1 L17.5 3 C18.4 3 19 3.7 18.9 4.6 L19 17.4 C19 18.3 18.3 19 17.4 18.9 L6.5 19 C5.6 19 5 18.3 5.1 17.4 Z"/><path d="M8.5 7 L8.6 7.4 M15.3 6.8 L15.4 7.2 M11.9 10.9 L12 11.3 M8.6 14.8 L8.7 15.2 M15.4 14.6 L15.5 15"/>',
  house: '<path d="M4.5 11.5 L12 4.2 L19.6 11.3"/><path d="M6.5 10.5 L6.4 19.6 L17.6 19.5 L17.5 10.4"/><path d="M10.5 19.5 L10.4 14 L13.6 13.9 L13.7 19.4"/>',
  train: '<path d="M6 4.5 C6 3.8 6.6 3.2 7.3 3.2 L16.6 3.1 C17.4 3.1 18 3.7 18 4.5 L18.1 14.4 C18.1 15.2 17.4 15.9 16.6 15.9 L7.4 16 C6.6 16 6 15.3 6 14.5 Z"/><path d="M6.2 8.5 L17.9 8.3"/><path d="M9 12 L9.1 12.4 M15 11.8 L15.1 12.2"/><path d="M8 16.2 L5.5 20.5 M16 16 L18.5 20.3 M7 18.4 L17 18.2"/>',
  bulb:  '<path d="M12 3.3 C15.5 3.2 18.2 5.8 18.1 9.1 C18 11.4 16.6 12.8 15.6 14.4 C15.1 15.2 14.9 16 14.8 16.9 L9.3 17 C9.2 16.1 8.9 15.2 8.4 14.4 C7.4 12.9 6 11.5 6 9.2 C6 5.9 8.6 3.4 12 3.3 Z"/><path d="M9.7 19.2 L14.4 19.1 M10.5 21 L13.6 20.9"/>',
  drop:  '<path d="M12 3.5 C14 6.5 17.4 9.5 17.3 13 C17.2 16.5 14.9 18.9 11.9 18.8 C9 18.7 6.8 16.4 6.9 13.1 C7 9.6 10 6.7 12 3.5 Z"/><path d="M9.7 13.2 C9.8 15 10.9 16.2 12.3 16.3"/>',
  quest: '<path d="M8.6 8.4 C8.6 5.9 10.2 4.5 12.2 4.6 C14.4 4.7 15.7 6.1 15.6 8 C15.4 9.8 12.4 10.4 12.2 13.1"/><path d="M12.1 17.2 L12.15 17.6"/>',
  chest: '<path d="M4.5 9.5 C4.4 7.8 5.8 6.4 7.5 6.4 L16.6 6.3 C18.3 6.3 19.6 7.6 19.6 9.3 L19.5 18 L4.6 18.1 Z"/><path d="M4.6 11.8 L19.5 11.6"/><path d="M10.7 10.2 L13.3 10.1 L13.4 13.3 L10.8 13.4 Z"/>',
  car:   '<path d="M4.5 13.5 L5.8 8.9 C6.1 7.9 6.9 7.3 7.9 7.3 L15.8 7.2 C16.8 7.2 17.7 7.8 18 8.8 L19.4 13.3 L19.5 17.3 L4.6 17.4 Z"/><path d="M4.6 13.4 L19.4 13.2"/><path d="M7.7 15.3 L7.8 15.7 M16.2 15.1 L16.3 15.5"/><path d="M8 10.4 L15.9 10.3"/>',
  jail:  '<path d="M5 4.5 L5.1 19.6 M8.4 4.4 L8.5 19.5 M11.9 4.3 L12 19.5 M15.4 4.3 L15.5 19.4 M18.9 4.2 L19 19.3"/><path d="M4 4.6 L19.9 4.3 M4.1 19.7 L20 19.4"/>',
  arrow: '<path d="M4 12.2 L19.5 11.9"/><path d="M13.8 5.8 L19.8 11.9 L14 18.1"/>',
  cash:  '<path d="M3.6 7.5 L20.3 7.3 L20.4 16.7 L3.7 16.9 Z"/><path d="M12 9.5 C13.4 9.4 14.5 10.5 14.5 12 C14.5 13.5 13.4 14.7 12 14.6 C10.6 14.5 9.6 13.4 9.6 12 C9.6 10.7 10.6 9.6 12 9.5 Z"/><path d="M6 12 L6.4 12 M17.7 11.8 L18.1 11.8"/>',
  gem:   '<path d="M7.5 4.5 L16.6 4.4 L20.2 9.3 L12 20 L3.8 9.5 Z"/><path d="M3.9 9.4 L20.1 9.2 M8.5 9.4 L12 19.8 L15.6 9.3"/><path d="M7.6 4.6 L8.6 9.4 M16.5 4.5 L15.5 9.3"/>',
  hammer:'<path d="M13.5 3.6 C15.9 3.5 17.9 4.9 18.8 7 L16.4 9.4 L11.3 4.9 C11.9 4.1 12.7 3.7 13.5 3.6 Z"/><path d="M13.9 7.2 L4.5 17.5 C3.9 18.2 4 19.2 4.7 19.8 C5.4 20.4 6.4 20.3 7 19.6 L15.5 8.6"/>',
  flag:  '<path d="M6 3.5 L6.2 20.6"/><path d="M6.2 4.5 C9.5 3 12.5 6.3 16 4.6 L17.8 4 L17.7 11.9 C14.3 13.6 11.3 10.3 6.4 12.4"/>',
};
function micon(name, cls) {
  return '<svg class="ic' + (cls ? " " + cls : "") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (M_ICON[name] || "") + "</svg>";
}

// Tile icons (Claude Design): luxury item climbs with the colour group's value.
// coin < cash < ring < watch < pearls < trophy < diamond < crown
const GROUP_ICON = {
  brown: "🪙", lblue: "💵", pink: "💍", orange: "⌚",
  red: "📿", yellow: "🏆", green: "💎", dblue: "👑",
};
// rails / utilities / taxes by space index
const SPACE_ICON = { 5: "🚂", 15: "🚂", 25: "🚂", 35: "🚂", 12: "💡", 28: "🚰", 4: "💸", 38: "🎩" };

let G = null;            // current game state (engine object)
let botTimer = null;
let flashCard = null;    // last drawn card, shown in board center until next action
let toastTimer = null;
let lastTurnToasted = -1;

const $ = (s) => document.querySelector(s);
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 1800);
}

// --- persistence ---------------------------------------------------------
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); } catch (e) {} }
function loadSaved() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const g = JSON.parse(raw);
    return (g && g.v === 1 && g.phase !== "over") ? g : null;
  } catch (e) { return null; }
}
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }

// --- actions -------------------------------------------------------------
function act(action) {
  const logLen = G.log.length;
  const r = Game.dispatch(G, action);
  if (!r.ok) { toast(r.error); return; }
  const drew = G.log.slice(logLen).some(l => l.startsWith("Chance:") || l.startsWith("Community Chest:"));
  flashCard = drew ? G.lastCard : null;
  save();
  pump();
}

// Render, then keep the bots moving until it's a human's turn (or game over).
function pump() {
  clearTimeout(botTimer); botTimer = null;
  render();
  if (!G || G.phase === "over") return;
  const p = Game.cur(G);
  if (p.human) {
    if (G.phase === "roll" && !G.pending && G.turns !== lastTurnToasted && G.players.some(q => q.human && q.id !== p.id)) {
      lastTurnToasted = G.turns;
      toast("Pass the phone to " + p.name + "!");
    }
    return;
  }
  botTimer = setTimeout(() => {
    botTimer = null;
    const a = AI.choose(G);
    if (!a) { render(); return; }
    act(a);
  }, G.phase === "roll" ? 950 : 550);
}

// --- setup screen ---------------------------------------------------------
let setupRows = null;
function defaultRows() {
  return [
    { name: "You", human: true },
    { name: BOT_NAMES[0], human: false },
    { name: BOT_NAMES[1], human: false },
    { name: BOT_NAMES[2], human: false },
  ];
}
function renderSetup() {
  if (!setupRows) setupRows = defaultRows();
  $("#menu-btn").hidden = true;
  const rows = setupRows.map((r, i) =>
    '<div class="setup-row wobble-sm">' +
      '<span class="color-dot" style="background:' + PLAYER_COLORS[i] + '"></span>' +
      '<input data-i="' + i + '" value="' + esc(r.name) + '" maxlength="12">' +
      '<button class="btn btn-sm tog" data-i="' + i + '">' + (r.human ? "Human" : "Bot") + "</button>" +
      (setupRows.length > 2 ? '<button class="btn btn-sm rm" data-i="' + i + '">remove</button>' : "") +
    "</div>").join("");
  $("#screen").innerHTML =
    '<h2 class="screen-title">' + micon("dice") + " Who's playing?</h2>" + rows +
    '<div class="setup-actions">' +
      (setupRows.length < 6 ? '<button class="btn" id="addrow">+ Add player</button>' : "") +
      '<button class="btn btn-big" id="start">Start game</button>' +
    "</div>" +
    '<p class="setup-note">Hot-seat Monopoly: humans share this phone, bots play themselves. ' +
    "Progress autosaves after every move, so it survives take-off, landing and low battery.</p>";
  $("#screen").querySelectorAll("input").forEach(inp =>
    inp.addEventListener("input", () => { setupRows[+inp.dataset.i].name = inp.value; }));
  $("#screen").querySelectorAll(".tog").forEach(b =>
    b.addEventListener("click", () => {
      const r = setupRows[+b.dataset.i];
      r.human = !r.human;
      if (!r.human && (r.name === "You" || /^Player/.test(r.name))) r.name = BOT_NAMES[+b.dataset.i % BOT_NAMES.length];
      renderSetup();
    }));
  $("#screen").querySelectorAll(".rm").forEach(b =>
    b.addEventListener("click", () => { setupRows.splice(+b.dataset.i, 1); renderSetup(); }));
  const add = $("#addrow");
  if (add) add.addEventListener("click", () => {
    setupRows.push({ name: "Player " + (setupRows.length + 1), human: true });
    renderSetup();
  });
  $("#start").addEventListener("click", () => {
    const defs = setupRows.map((r, i) => ({
      name: r.name.trim() || "Player " + (i + 1),
      human: r.human,
      color: PLAYER_COLORS[i],
    }));
    if (!defs.some(d => d.human) && !confirm("All bots? You'll just be watching. Start anyway?")) return;
    G = Game.newGame(defs);
    flashCard = null; lastTurnToasted = -1;
    save();
    pump();
  });
}

function renderResume(saved) {
  $("#menu-btn").hidden = true;
  const names = saved.players.filter(p => !p.bankrupt).map(p => esc(p.name)).join(", ");
  $("#screen").innerHTML =
    '<div class="resume-box wobble">' +
      "<h2 class=\"screen-title\">Game in progress</h2>" +
      "<p>" + names + " — turn " + saved.turns + ". Pick up where you left off?</p>" +
      '<div class="setup-actions">' +
        '<button class="btn btn-big btn-go" id="resume">Continue</button>' +
        '<button class="btn" id="fresh">New game</button>' +
      "</div></div>";
  $("#resume").addEventListener("click", () => { G = saved; pump(); });
  $("#fresh").addEventListener("click", () => { clearSave(); renderSetup(); });
}

// --- board rendering -------------------------------------------------------
function posOf(i) { // 1-indexed [row, col] on the 11x11 grid, GO bottom-right
  if (i <= 10) return [11, 11 - i];
  if (i <= 20) return [21 - i, 1];
  if (i <= 30) return [1, i - 19];
  return [i - 29, 11];
}
const SPECIAL_ICON = { go: "arrow", jail: "jail", parking: "car", gotojail: "jail", chance: "quest", chest: "chest", rail: "train" };

function cellHTML(i) {
  const s = SPACES[i];
  const [r, c] = posOf(i);
  const st = G.props[i];
  const corner = s.kind === "go" || s.kind === "jail" || s.kind === "parking" || s.kind === "gotojail";
  let inner = "";
  if (s.kind === "prop") {
    inner += '<div class="band" style="background:' + GROUPS[s.group].color + '"></div>' +
             '<span class="gico">' + GROUP_ICON[s.group] + "</span>" +
             '<span class="price">' + s.price + "</span>";
  } else if (s.kind === "rail" || s.kind === "util") {
    inner += '<span class="gico">' + SPACE_ICON[i] + "</span>" +
             '<span class="price">' + s.price + "</span>";
  } else if (s.kind === "tax") {
    inner += '<span class="gico">' + SPACE_ICON[i] + "</span>" +
             '<span class="price">' + s.amount + "</span>";
  } else if (s.kind === "chance" || s.kind === "chest") {
    inner += '<span class="cglyph">' + (s.kind === "chance" ? "?" : "◈") + "</span>";
  } else {
    inner += '<div class="spico">' + micon(SPECIAL_ICON[s.kind]) + "</div>";
  }
  if (st && st.houses > 0) {
    inner += '<div class="pips">' + (st.houses === 5 ? '<i class="hotel"></i>' : "<i></i>".repeat(st.houses)) + "</div>";
  }
  const toks = G.players.filter(p => !p.bankrupt && p.pos === i);
  if (toks.length) {
    inner += '<div class="toks">' + toks.map(p => '<b style="background:' + p.color + '"></b>').join("") + "</div>";
  }
  if (st && st.owner !== -1) {
    inner += '<div class="ownerbar" style="background:' + G.players[st.owner].color + '"></div>';
  }
  const cls = "cell" + (corner ? " corner" : "") + (st && st.mortgaged ? " mortgaged" : "") +
    (st && st.owner !== -1 ? " owned" : "") +
    (s.kind === "chance" || s.kind === "chest" ? " " + s.kind : "") +
    (Game.cur(G).pos === i ? " here" : "");
  return '<div class="' + cls + '" data-i="' + i + '" style="grid-row:' + r + ";grid-column:" + c + '" title="' + esc(s.name) + '">' + inner + "</div>";
}

function pileHTML(kind) {
  const face = kind === "chance"
    ? '<span class="glyph">?</span><span class="label">Chance</span>'
    : '<span class="glyph">◈</span><span class="label">Community<br>Chest</span>';
  const picking = flashCard && flashCard.deck === kind ? " data-picking" : "";
  return '<div class="pile ' + kind + '"' + picking + ">" +
    '<div class="pile-card back2"></div>' +
    '<div class="pile-card back1"></div>' +
    '<div class="pile-card top">' + face + "</div>" +
    '<div class="pile-card flyer">' + face + "</div></div>";
}

function centerHTML() {
  const p = Game.cur(G);
  const whose = p.name.toLowerCase() === "you" ? "Your turn" : p.name + "'s turn";
  let h = '<div class="brandline"><span class="brand">After Hours</span><span class="brandsub">Private Club</span></div>' +
    '<div class="whose">' + esc(whose) + "</div>";
  if (G.dice) h += '<div class="dice"><span class="die">' + G.dice[0] + '</span><span class="die">' + G.dice[1] + "</span></div>";
  if (flashCard) {
    h += '<div class="cardflash reveal"><span class="cardkind">' +
      (flashCard.deck === "chance" ? "? Chance" : "◈ Community Chest") +
      "</span>" + esc(flashCard.text) + "</div>";
  }
  return '<div id="center">' + pileHTML("chance") + pileHTML("chest") + h + "</div>";
}

function actionsHTML() {
  const p = Game.cur(G);
  if (G.phase === "over") {
    const w = G.players[G.winner];
    return '<div class="say winner-title">' + micon("flag") + " " + esc(w.name) + " wins!</div>" +
      '<button class="btn btn-big" data-act="newgame">Play again</button>';
  }
  if (!p.human) return '<div class="say">' + esc(p.name) + " is thinking&hellip;</div>";
  const acts = Game.legalActions(G);
  const has = t => acts.some(a => a.type === t);
  let h = "";
  if (G.pending && G.pending.type === "buy") {
    const s = SPACES[G.pending.space];
    h += '<div class="say">Buy <strong>' + esc(s.name) + "</strong> for $" + s.price + "?</div>" +
      '<button class="btn btn-big btn-go" data-act="buy"' + (has("buy") ? "" : " disabled") + ">Buy</button>" +
      '<button class="btn" data-act="decline">Pass</button>' +
      '<button class="btn" data-act="assets">' + micon("hammer") + " Assets</button>";
  } else if (G.pending && G.pending.type === "debt") {
    h += '<div class="say">You owe <strong>$' + G.pending.amount + "</strong> (" + esc(G.pending.why) + "). Cash: $" + p.cash + "</div>" +
      '<button class="btn btn-big btn-go" data-act="payDebt"' + (has("payDebt") ? "" : " disabled") + ">Pay up</button>" +
      '<button class="btn" data-act="assets">' + micon("hammer") + " Sell / mortgage</button>" +
      (has("bankrupt") ? '<button class="btn btn-warn" data-act="bankrupt">Go bankrupt</button>' : "");
  } else if (G.phase === "roll" && p.inJail) {
    h += '<div class="say">' + micon("jail") + " In Jail (attempt " + (p.jailTurns + 1) + "/3)</div>" +
      '<button class="btn btn-big" data-act="roll">🎲&nbsp; Roll for doubles</button>' +
      '<button class="btn" data-act="payJail"' + (has("payJail") ? "" : " disabled") + ">Pay $50</button>" +
      (has("useJailCard") ? '<button class="btn" data-act="useJailCard">Use card</button>' : "");
  } else if (G.phase === "roll") {
    h += '<button class="btn btn-big" data-act="roll">🎲&nbsp; Roll dice</button>';
  } else if (G.phase === "manage") {
    h += (G.mustRollAgain
        ? '<button class="btn btn-big" data-act="roll">🎲&nbsp; Doubles! Roll again</button>'
        : '<button class="btn btn-big" data-act="endTurn">End turn</button>') +
      '<button class="btn" data-act="assets">' + micon("hammer") + " Assets</button>";
  }
  return h;
}

function render() {
  if (!G) return;
  $("#menu-btn").hidden = false;
  let cells = "";
  for (let i = 0; i < 40; i++) cells += cellHTML(i);
  const p = Game.cur(G);
  const strips = G.players.map(q =>
    '<span class="pstrip' + (q.bankrupt ? " dead" : "") + (q.id === p.id && !q.bankrupt ? " active" : "") + '">' +
      '<span class="color-dot" style="background:' + q.color + '"></span>' +
      esc(q.name) + " $" + q.cash +
      (q.inJail ? " " + micon("jail") : "") + "</span>").join("");
  $("#screen").innerHTML =
    '<div id="board">' + cells + centerHTML() + "</div>" +
    '<div id="hud">' +
      '<div id="turnbar">' +
        '<span class="color-dot glow" style="background:' + p.color + ";color:" + p.color + '"></span>' +
        '<span class="who">' + esc(p.name) + (p.human ? "" : " (bot)") + "</span>" +
        '<span class="cash">$' + p.cash + "</span></div>" +
      '<div id="actions">' + actionsHTML() + "</div>" +
      '<div id="players">' + strips + "</div>" +
      '<div id="logbox"><div class="log-title">Game log</div>' +
        '<div id="log">' + G.log.slice(-14).map(l => "<p>" + esc(l) + "</p>").join("") + "</div></div>" +
    "</div>";
  const logEl = $("#log");
  logEl.scrollTop = logEl.scrollHeight;
  $("#screen").querySelectorAll(".cell").forEach(el =>
    el.addEventListener("click", () => showDeed(+el.dataset.i)));
  // tapping a stack replays the pickup flourish (drawing happens by landing)
  $("#screen").querySelectorAll(".pile").forEach(el =>
    el.addEventListener("click", () => {
      if (el.hasAttribute("data-picking")) return;
      el.setAttribute("data-picking", "");
      setTimeout(() => el.removeAttribute("data-picking"), 1000);
    }));
  $("#actions").querySelectorAll("[data-act]").forEach(b =>
    b.addEventListener("click", () => {
      const t = b.dataset.act;
      if (t === "assets") return openAssets();
      if (t === "newgame") { clearSave(); G = null; setupRows = null; renderSetup(); return; }
      act({ type: t });
    }));
}

// --- modals ----------------------------------------------------------------
function openModal(html) {
  $("#modal").innerHTML = html;
  $("#modal-wrap").hidden = false;
}
function closeModal() { $("#modal-wrap").hidden = true; }
document.addEventListener("click", (e) => {
  if (e.target.id === "modal-wrap") closeModal();
});

function deedHead(s) {
  const color = s.group ? GROUPS[s.group].color : "#3a5040";
  return '<div class="deed-band" style="background:' + color + '"><span class="kicker">Title Deed</span></div>' +
    '<h2 class="deed-title">' + esc(s.name) + "</h2>" +
    '<div class="deed-sub">Price · $' + s.price + "</div>";
}

function showDeed(i) {
  const s = SPACES[i], st = G.props[i];
  let body = "";
  if (s.kind === "prop") {
    body += deedHead(s) +
      '<table class="rent-table">' +
      "<tr><td>Rent</td><td>$" + s.rents[0] + "</td></tr>" +
      "<tr><td>With colour set</td><td>$" + s.rents[0] * 2 + "</td></tr>" +
      '<tr class="grp"><td colspan="2">With houses</td></tr>' +
      [1, 2, 3, 4].map(n => "<tr><td>" + n + " house" + (n > 1 ? "s" : "") + "</td><td>$" + s.rents[n] + "</td></tr>").join("") +
      "<tr><td>Hotel</td><td>$" + s.rents[5] + "</td></tr>" +
      "</table>" +
      '<div class="deed-foot">Mortgage value $' + Math.floor(s.price / 2) + " · Houses cost $" + s.houseCost + " each</div>";
  } else if (s.kind === "rail") {
    body += deedHead(s) +
      '<table class="rent-table">' +
      [1, 2, 3, 4].map(n => "<tr><td>Rent with " + n + " railroad" + (n > 1 ? "s" : "") + "</td><td>$" + 25 * Math.pow(2, n - 1) + "</td></tr>").join("") +
      "</table>" +
      '<div class="deed-foot">Mortgage value $100</div>';
  } else if (s.kind === "util") {
    body += deedHead(s) +
      '<table class="rent-table">' +
      "<tr><td>Rent (one utility)</td><td>4 &times; dice</td></tr>" +
      "<tr><td>Rent (both utilities)</td><td>10 &times; dice</td></tr>" +
      "</table>" +
      '<div class="deed-foot">Mortgage value $75</div>';
  } else if (s.kind === "tax") {
    body += "<p>Pay $" + s.amount + " to the bank. Ouch.</p>";
  } else if (s.kind === "go") {
    body += "<p>Collect $200 salary every time you pass.</p>";
  } else if (s.kind === "jail") {
    body += "<p>Just visiting&hellip; unless you're not.</p>";
  } else if (s.kind === "parking") {
    body += "<p>Free parking. A moment of peace. Nothing happens.</p>";
  } else if (s.kind === "gotojail") {
    body += "<p>Go directly to Jail. Do not pass GO, do not collect $200.</p>";
  } else {
    body += "<p>Draw a card, obey the card.</p>";
  }
  let status = "";
  if (st) {
    status = st.owner === -1 ? "<p>Unowned.</p>" :
      "<p>Owned by <strong>" + esc(G.players[st.owner].name) + "</strong>" +
      (st.mortgaged ? " (mortgaged)" : "") +
      (st.houses ? " — " + (st.houses === 5 ? "HOTEL" : st.houses + " house" + (st.houses > 1 ? "s" : "")) : "") + ".</p>";
  }
  const deedStyle = s.kind === "prop" || s.kind === "rail" || s.kind === "util";
  openModal((deedStyle ? "" : "<h2>" + esc(s.name) + "</h2>") + body + status +
    '<div class="modal-actions"><button class="btn" onclick="document.getElementById(\'modal-wrap\').hidden=true">Close</button></div>');
}

function openAssets() {
  const p = Game.cur(G);
  const acts = Game.legalActions(G);
  const can = (t, i) => acts.some(a => a.type === t && a.space === i);
  const mine = Object.keys(G.props).map(Number).filter(i => G.props[i].owner === p.id).sort((a, b) => a - b);
  let rows = mine.map(i => {
    const s = SPACES[i], st = G.props[i];
    const stat = st.mortgaged ? "mortgaged" : st.houses === 5 ? "hotel" : st.houses ? st.houses + " houses" : "";
    let btns = "";
    if (can("build", i)) btns += '<button class="btn btn-sm mact" data-t="build" data-i="' + i + '">Build $' + s.houseCost + "</button>";
    if (can("sellHouse", i)) btns += '<button class="btn btn-sm mact" data-t="sellHouse" data-i="' + i + '">Sell $' + Math.floor(s.houseCost / 2) + "</button>";
    if (can("mortgage", i)) btns += '<button class="btn btn-sm mact" data-t="mortgage" data-i="' + i + '">Mort. +$' + Math.floor(s.price / 2) + "</button>";
    if (can("unmortgage", i)) btns += '<button class="btn btn-sm mact" data-t="unmortgage" data-i="' + i + '">Unmort. $' + (Math.floor(s.price / 2) + Math.ceil(s.price / 20)) + "</button>";
    return '<div class="mrow">' +
      '<span class="gdot" style="background:' + (s.group ? GROUPS[s.group].color : "#fff") + '"></span>' +
      '<span class="nm">' + esc(s.name) + (stat ? ' <span class="st">(' + stat + ")</span>" : "") + "</span>" + btns + "</div>";
  }).join("");
  if (!mine.length) rows = "<p>No property yet. Land on something and buy it!</p>";
  openModal("<h2>" + micon("hammer") + " " + esc(p.name) + " — $" + p.cash + "</h2>" + rows +
    '<div class="modal-actions"><button class="btn" id="mclose">Done</button></div>');
  $("#modal").querySelectorAll(".mact").forEach(b =>
    b.addEventListener("click", () => {
      const r = Game.dispatch(G, { type: b.dataset.t, space: +b.dataset.i });
      if (!r.ok) toast(r.error);
      save();
      openAssets(); // rebuild with fresh legality
      render();     // board behind the modal updates too
    }));
  $("#mclose").addEventListener("click", () => { closeModal(); render(); });
}

$("#menu-btn").addEventListener("click", () => {
  openModal("<h2>Menu</h2>" +
    "<p>Game autosaves after every action. Close the tab, lose the phone down the seat pocket, come back later — it'll be here.</p>" +
    '<div class="modal-actions">' +
      '<button class="btn" id="mmclose">Keep playing</button>' +
      '<button class="btn btn-warn" id="mmnew">Abandon &amp; start new</button>' +
    "</div>");
  $("#mmclose").addEventListener("click", closeModal);
  $("#mmnew").addEventListener("click", () => {
    closeModal(); clearSave(); clearTimeout(botTimer); botTimer = null;
    G = null; setupRows = null; renderSetup();
  });
});

// --- boot ------------------------------------------------------------------
const saved = loadSaved();
if (saved) renderResume(saved); else renderSetup();
})();
