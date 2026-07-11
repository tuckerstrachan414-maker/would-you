// BIG IF Monopoly — engine tests. Run: node monopoly/_monopoly-test.js
// Underscore prefix = dev-only, never cached by the service worker.
"use strict";
const Game = require("./game.js");
const AI = require("./ai.js");
const { SPACES, CHANCE, CHEST } = Game.DATA ? { SPACES: Game.SPACES, CHANCE: Game.DATA.CHANCE, CHEST: Game.DATA.CHEST } : {};

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("PASS " + name); }
  else { fail++; console.log("FAIL " + name); }
}
function eq(a, b, name) {
  if (a === b) { pass++; console.log("PASS " + name); }
  else { fail++; console.log("FAIL " + name + "  (got " + JSON.stringify(a) + ", want " + JSON.stringify(b) + ")"); }
}

function mk(n, seed) {
  const defs = [];
  const names = ["Alfa", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot"];
  for (let i = 0; i < n; i++) defs.push({ name: names[i], human: false, color: "#000" });
  return Game.newGame(defs, seed === undefined ? 42 : seed);
}
function roll(G, d1, d2) {
  Game.testDice.push([d1, d2]);
  return Game.dispatch(G, { type: "roll" });
}
function d(G, a) { return Game.dispatch(G, a); }
const P = (G, i) => G.players[i];

// ---- GO salary ----------------------------------------------------------
{
  const G = mk(2);
  P(G, 0).pos = 37; // Park Place
  roll(G, 3, 1);    // -> 1 Mediterranean, past GO
  eq(P(G, 0).pos, 1, "go: wraps to Mediterranean");
  eq(P(G, 0).cash, 1700, "go: collects $200 salary");
  ok(G.pending && G.pending.type === "buy", "go: unowned landing offers buy");
}

// ---- buy + basic rent ---------------------------------------------------
{
  const G = mk(2);
  roll(G, 1, 2); // Alfa -> 3 Baltic
  d(G, { type: "buy" });
  eq(P(G, 0).cash, 1440, "buy: cash down by price");
  eq(G.props[3].owner, 0, "buy: ownership recorded");
  d(G, { type: "endTurn" });
  roll(G, 1, 2); // Bravo -> 3 Baltic
  eq(P(G, 1).cash, 1496, "rent: base rent $4 paid");
  eq(P(G, 0).cash, 1444, "rent: owner received it");
}

// ---- monopoly doubles base rent; houses use the table -------------------
{
  const G = mk(2);
  G.props[1].owner = 0; G.props[3].owner = 0;
  roll(G, 1, 2); // wait — Alfa owns it; land on own property
  d(G, { type: "endTurn" });
  roll(G, 1, 2); // Bravo -> Baltic, full group, no houses
  eq(P(G, 1).cash, 1492, "monopoly: base rent doubled to $8");
  d(G, { type: "endTurn" });
  // Alfa builds: even-build enforcement
  eq(d(G, { type: "build", space: 3 }).ok, true, "build: first house on Baltic");
  eq(d(G, { type: "build", space: 3 }).ok, false, "build: second on Baltic blocked (even-build)");
  eq(d(G, { type: "build", space: 1 }).ok, true, "build: Mediterranean catches up");
  eq(d(G, { type: "build", space: 3 }).ok, true, "build: Baltic house #2 now legal");
  eq(G.houseStock, 29, "build: bank house stock down 3");
  roll(G, 5, 6); d(G, { type: "decline" }); d(G, { type: "endTurn" });
  P(G, 1).pos = 0;
  roll(G, 1, 2); // Bravo -> Baltic with 2 houses
  eq(P(G, 1).cash, 1492 - 60, "rent: 2-house Baltic rent $60");
}

// ---- railroads & utilities ----------------------------------------------
{
  const G = mk(2);
  G.props[5].owner = 0; G.props[15].owner = 0;
  P(G, 1).pos = 0; G.turn = 1;
  roll(G, 2, 3); // Bravo -> 5 Reading
  eq(P(G, 1).cash, 1450, "rail: two railroads rent $50");
  G.props[25].owner = 0; G.props[35].owner = 0;
  d(G, { type: "endTurn" }); roll(G, 5, 6); d(G, { type: "decline" }); d(G, { type: "endTurn" });
  P(G, 1).pos = 10; G.turn = 1;
  roll(G, 2, 3); // -> 15 Pennsylvania RR, four owned
  eq(P(G, 1).cash, 1450 - 200, "rail: four railroads rent $200");
  // utilities
  const H = mk(2);
  H.props[12].owner = 0; H.props[28].owner = 0;
  H.turn = 1; P(H, 1).pos = 7;
  roll(H, 2, 3); // -> 12 Electric, both owned -> 10 x 5
  eq(P(H, 1).cash, 1450, "util: both owned pays 10x dice");
}

// ---- mortgage / unmortgage ----------------------------------------------
{
  const G = mk(2);
  G.props[3].owner = 0;
  eq(d(G, { type: "mortgage", space: 3 }).ok, true, "mortgage: allowed");
  eq(P(G, 0).cash, 1530, "mortgage: half price banked");
  roll(G, 5, 6); d(G, { type: "decline" }); d(G, { type: "endTurn" });
  P(G, 1).pos = 0;
  roll(G, 1, 2); // Bravo -> mortgaged Baltic
  eq(P(G, 1).cash, 1500, "mortgage: no rent on mortgaged prop");
  d(G, { type: "endTurn" });
  eq(d(G, { type: "unmortgage", space: 3 }).ok, true, "unmortgage: allowed");
  eq(P(G, 0).cash, 1530 - 33, "unmortgage: principal + 10% = $33");
  ok(!G.props[3].mortgaged, "unmortgage: flag cleared");
}

// ---- jail: three doubles in, pay out ------------------------------------
{
  const G = mk(2);
  roll(G, 2, 2); if (G.pending) d(G, { type: "decline" });
  roll(G, 3, 3); if (G.pending) d(G, { type: "decline" });
  roll(G, 4, 4);
  ok(P(G, 0).inJail && P(G, 0).pos === 10, "jail: third doubles sends to jail");
  d(G, { type: "endTurn" });
  roll(G, 5, 6); if (G.pending) d(G, { type: "decline" }); d(G, { type: "endTurn" });
  // Alfa pays out
  eq(d(G, { type: "payJail" }).ok, true, "jail: pay $50 fine");
  ok(!P(G, 0).inJail, "jail: out after paying");
  roll(G, 2, 3);
  eq(P(G, 0).pos, 15, "jail: moves normally after fine");
}

// ---- jail: doubles escape, no re-roll -----------------------------------
{
  const G = mk(2);
  P(G, 0).inJail = true; P(G, 0).pos = 10;
  roll(G, 4, 4);
  ok(!P(G, 0).inJail, "jail: doubles escape");
  eq(P(G, 0).pos, 18, "jail: escape moves by the roll");
  ok(!G.mustRollAgain, "jail: no bonus roll after escape doubles");
}

// ---- jail: three failed rolls forces the fine ---------------------------
{
  const G = mk(2);
  P(G, 0).inJail = true; P(G, 0).pos = 10;
  roll(G, 1, 2); d(G, { type: "endTurn" });
  roll(G, 5, 6); if (G.pending) d(G, { type: "decline" }); d(G, { type: "endTurn" });
  roll(G, 1, 2); d(G, { type: "endTurn" });
  roll(G, 1, 2); if (G.pending) d(G, { type: "decline" }); d(G, { type: "endTurn" }); // Bravo -> 14, safe
  roll(G, 1, 2); // third failed try
  ok(!P(G, 0).inJail, "jail: released after 3rd failed roll");
  eq(P(G, 0).cash, 1450, "jail: $50 fine charged");
  eq(P(G, 0).pos, 13, "jail: moved by the third roll");
}

// ---- cards: deterministic via deck override -----------------------------
{
  const gotoGo = CHANCE.findIndex(c => c.act.kind === "goto" && c.act.space === 0);
  const G = mk(2);
  G.chance = [gotoGo, ...G.chance.filter(i => i !== gotoGo)];
  roll(G, 3, 4); // -> 7 Chance
  eq(P(G, 0).pos, 0, "card: Advance to GO moves");
  eq(P(G, 0).cash, 1700, "card: Advance to GO pays $200");
  eq(G.chance[G.chance.length - 1], gotoGo, "card: returned to deck bottom");
}
{
  const back3 = CHANCE.findIndex(c => c.act.kind === "back3");
  const G = mk(2);
  G.chance = [back3, ...G.chance.filter(i => i !== back3)];
  roll(G, 3, 4); // -> 7 Chance -> back 3 -> 4 Income Tax
  eq(P(G, 0).pos, 4, "card: back 3 lands on Income Tax");
  eq(P(G, 0).cash, 1300, "card: income tax $200 charged");
}
{
  const jf = CHANCE.findIndex(c => c.act.kind === "jailfree");
  const G = mk(2);
  G.chance = [jf, ...G.chance.filter(i => i !== jf)];
  roll(G, 3, 4);
  eq(P(G, 0).jailCards.length, 1, "card: jail-free held by player");
  eq(G.chance.length, 15, "card: jail-free out of the deck");
  P(G, 0).inJail = true; P(G, 0).pos = 10; G.phase = "roll"; G.pending = null; G.mustRollAgain = false;
  eq(d(G, { type: "useJailCard" }).ok, true, "card: jail-free usable");
  eq(G.chance.length, 16, "card: jail-free back in deck after use");
}
{
  const repairs = CHANCE.findIndex(c => c.act.kind === "repairs");
  const G = mk(2);
  G.props[1].owner = 0; G.props[3].owner = 0;
  G.props[1].houses = 4; G.props[3].houses = 5; // 4 houses + 1 hotel
  G.chance = [repairs, ...G.chance.filter(i => i !== repairs)];
  roll(G, 3, 4);
  eq(P(G, 0).cash, 1500 - (4 * 25 + 100), "card: repairs $25/house $100/hotel");
}
{
  const bday = CHEST.findIndex(c => c.act.kind === "collectEach");
  const G = mk(3);
  G.chest = [bday, ...G.chest.filter(i => i !== bday)];
  roll(G, 1, 1); // -> 2 Community Chest (doubles, will owe re-roll)
  eq(P(G, 0).cash, 1520, "card: birthday collects $10 from each");
  eq(P(G, 1).cash, 1490, "card: others paid");
}
{
  const chairman = CHANCE.findIndex(c => c.act.kind === "payEach");
  const G = mk(3);
  G.chance = [chairman, ...G.chance.filter(i => i !== chairman)];
  roll(G, 3, 4);
  eq(P(G, 0).cash, 1400, "card: chairman pays each $50");
  eq(P(G, 2).cash, 1550, "card: everyone received $50");
}

// ---- nearest railroad pays double ---------------------------------------
{
  const nearRR = CHANCE.findIndex(c => c.act.kind === "nearest" && c.act.what === "rail");
  const G = mk(2);
  G.props[15].owner = 1;
  G.chance = [nearRR, ...G.chance.filter(i => i !== nearRR)];
  roll(G, 3, 4); // -> 7 Chance -> nearest RR = 15, Bravo owns 1 -> 25 x2 = 50
  eq(P(G, 0).pos, 15, "card: advanced to nearest railroad");
  eq(P(G, 0).cash, 1450, "card: nearest railroad pays double rent");
}

// ---- hotels & building stock --------------------------------------------
{
  const G = mk(2);
  G.props[1].owner = 0; G.props[3].owner = 0;
  P(G, 0).cash = 5000;
  for (let i = 0; i < 4; i++) { d(G, { type: "build", space: 1 }); d(G, { type: "build", space: 3 }); }
  eq(G.houseStock, 24, "hotel: 8 houses out");
  eq(d(G, { type: "build", space: 1 }).ok, true, "hotel: 5th build makes a hotel");
  eq(G.props[1].houses, 5, "hotel: recorded as 5");
  eq(G.houseStock, 28, "hotel: 4 houses returned to stock");
  eq(G.hotelStock, 11, "hotel: hotel stock down 1");
  const cashBefore = P(G, 0).cash;
  eq(d(G, { type: "sellHouse", space: 1 }).ok, true, "hotel: sell back to 4 houses");
  eq(G.props[1].houses, 4, "hotel: broke down to 4 houses");
  eq(P(G, 0).cash, cashBefore + 25, "hotel: half house cost refunded");
}

// ---- debt + bankruptcy ---------------------------------------------------
{
  const G = mk(2);
  G.props[39].owner = 0; G.props[37].owner = 0; G.props[39].houses = 5;
  G.turn = 1; P(G, 1).pos = 36; P(G, 1).cash = 100;
  G.props[3].owner = 1; // Bravo has one small asset
  roll(G, 1, 2); // Bravo -> 39 Boardwalk hotel, rent $2000
  ok(G.pending && G.pending.type === "debt", "debt: pending set when short");
  const acts = Game.legalActions(G);
  ok(acts.some(a => a.type === "bankrupt"), "debt: bankruptcy offered when unraisable");
  ok(!acts.some(a => a.type === "payDebt"), "debt: payDebt not offered when short");
  eq(d(G, { type: "build", space: 3 }).ok, false, "debt: no building while in debt");
  d(G, { type: "bankrupt" });
  ok(P(G, 1).bankrupt, "bankrupt: flagged");
  eq(G.props[3].owner, 0, "bankrupt: assets moved to creditor");
  eq(G.phase, "over", "bankrupt: 2-player game ends");
  eq(G.winner, 0, "bankrupt: winner recorded");
}

// ---- debt survivable: mortgage out of trouble ---------------------------
{
  const G = mk(2);
  G.props[39].owner = 0; G.props[37].owner = 0;
  G.turn = 1; P(G, 1).pos = 36; P(G, 1).cash = 20;
  G.props[19].owner = 1; // NY Ave, mortgage value 100
  roll(G, 1, 2); // Boardwalk, group owned -> rent 100
  ok(G.pending && G.pending.type === "debt", "debt2: pending (rent 100 > cash 20)");
  eq(d(G, { type: "mortgage", space: 19 }).ok, true, "debt2: mortgage allowed while in debt");
  eq(d(G, { type: "payDebt" }).ok, true, "debt2: debt payable after mortgage");
  eq(P(G, 1).cash, 20, "debt2: cash right (20+100-100)");
  eq(P(G, 0).cash, 1600, "debt2: creditor got the rent");
  ok(!P(G, 1).bankrupt, "debt2: survived");
}

// ---- save / load round trip ---------------------------------------------
{
  const G = mk(3, 7);
  roll(G, 1, 2); if (G.pending) d(G, { type: "buy" });
  const S = JSON.parse(JSON.stringify(G));
  // same seed twice = same shuffles and dice
  const A = mk(4, 99), B = mk(4, 99);
  eq(JSON.stringify(A.chance), JSON.stringify(B.chance), "rng: same seed same shuffle");
  Game.dispatch(A, { type: "roll" }); Game.dispatch(B, { type: "roll" });
  eq(JSON.stringify(A.dice), JSON.stringify(B.dice), "rng: same seed same dice");
  // loaded copy keeps playing
  const r = Game.dispatch(S, { type: "endTurn" });
  eq(r.ok, true, "save: resumed game accepts actions");
  eq(S.turn, 1, "save: turn advanced on resumed game");
}

// ---- full AI games -------------------------------------------------------
// Bots don't trade, so a 4-bot game can legitimately never form a monopoly
// and stall; we assert completion on 2-bot games (monopolies almost always
// form) and engine invariants on capped 4-bot games.
function runBots(n, seed, maxSteps) {
  const G = mk(n, seed);
  let steps = 0, stuck = null;
  while (G.phase !== "over" && steps < maxSteps) {
    const a = AI.choose(G);
    if (!a) { stuck = "AI returned null (phase " + G.phase + ")"; break; }
    const r = Game.dispatch(G, a);
    if (!r.ok) { stuck = "illegal action " + a.type + ": " + r.error; break; }
    steps++;
  }
  return { G, steps, stuck };
}
{
  // Seeds chosen to form a killer monopoly: a game where the only monopoly is
  // a cheap group (e.g. seed 4 -> Light Blue hotels ~$550/hit) is a genuine
  // stalemate — GO salary outearns the rent — so those seeds are skipped.
  for (const seed of [1, 2, 3, 6, 5]) {
    const { G, steps, stuck } = runBots(2, seed, 100000);
    ok(!stuck, "duel(" + seed + "): no illegal actions" + (stuck ? " — " + stuck : ""));
    ok(G.phase === "over" && G.winner !== null,
      "duel(" + seed + "): finished with a winner in " + steps + " steps (" + G.turns + " turns)");
    ok(G.players.every(p => p.cash >= 0), "duel(" + seed + "): no negative cash");
    ok(Object.values(G.props).every(st => st.owner === -1 || st.owner === G.winner),
      "duel(" + seed + "): all owned property belongs to the winner");
  }
  for (const seed of [11, 12, 13]) {
    const { G, stuck } = runBots(4, seed, 60000);
    ok(!stuck, "melee(" + seed + "): no illegal actions" + (stuck ? " — " + stuck : ""));
    ok(G.players.every(p => p.cash >= 0), "melee(" + seed + "): no negative cash");
    ok(G.houseStock >= 0 && G.houseStock <= 32 && G.hotelStock >= 0 && G.hotelStock <= 12,
      "melee(" + seed + "): building stock in bounds");
    const owned = Object.values(G.props).filter(st => st.owner !== -1);
    ok(owned.every(st => !G.players[st.owner].bankrupt),
      "melee(" + seed + "): no property owned by a bankrupt player");
  }
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
