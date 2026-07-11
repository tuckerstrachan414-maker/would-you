// BIG IF Monopoly — bot brains. One function: choose(G) returns the next
// action for the current (non-human) player. The driver (UI or test) calls
// it in a loop, dispatching each action, until the turn passes.
// Heuristics, not genius — meant to be fun to beat on a plane.
(function (root) {
"use strict";

const Game = (typeof module !== "undefined" && module.exports)
  ? require("./game.js")
  : root.MonopolyGame;
const { SPACES } = Game;

const CASH_FLOOR = 150;   // keep this much back when buying land
const BUILD_BUFFER = 200; // keep this much back when building
const UNMORTGAGE_AT = 700;

function choose(G) {
  const p = Game.cur(G);
  const acts = Game.legalActions(G);
  const find = (t) => acts.find(a => a.type === t);

  if (G.pending && G.pending.type === "debt") {
    const pay = find("payDebt");
    if (pay) return pay;
    // Raise money: mortgage cheapest first, then sell buildings.
    const mort = acts.filter(a => a.type === "mortgage")
      .sort((a, b) => SPACES[a.space].price - SPACES[b.space].price)[0];
    if (mort) return mort;
    const sell = acts.filter(a => a.type === "sellHouse")
      .sort((a, b) => SPACES[a.space].houseCost - SPACES[b.space].houseCost)[0];
    if (sell) return sell;
    return find("bankrupt");
  }

  if (G.pending && G.pending.type === "buy") {
    const buy = find("buy");
    if (!buy) return find("decline");
    const s = SPACES[G.pending.space];
    const completes = s.kind === "prop" &&
      Game.groupSpaces(s.group).every(g => g.i === s.i || G.props[g.i].owner === p.id);
    const blocks = s.kind === "prop" &&
      Game.groupSpaces(s.group).some(g => g.i !== s.i && G.props[g.i].owner !== -1 && G.props[g.i].owner !== p.id);
    // Complete a group at any cost; otherwise keep a cash floor
    // (smaller floor when the buy denies someone else a monopoly).
    if (completes) return buy;
    if (p.cash - s.price >= (blocks ? 50 : CASH_FLOOR)) return buy;
    return find("decline");
  }

  if (G.phase === "roll" && p.inJail) {
    // Early game the board is cheap: get out and go shopping.
    // Once buildings exist, sit in jail and let others pay rent.
    const housesOnBoard = Object.values(G.props).reduce((n, st) => n + st.houses, 0);
    if (housesOnBoard === 0) {
      if (find("useJailCard")) return find("useJailCard");
      if (find("payJail") && p.cash >= 200) return find("payJail");
    }
    return find("roll");
  }

  if (G.phase === "roll") return find("roll");

  if (G.phase === "manage") {
    // Build toward 3 houses (the rent knee) on the cheapest buildable spot.
    const builds = acts.filter(a => a.type === "build" &&
        p.cash - SPACES[a.space].houseCost >= BUILD_BUFFER)
      .sort((a, b) =>
        (G.props[a.space].houses - G.props[b.space].houses) ||
        (SPACES[a.space].houseCost - SPACES[b.space].houseCost));
    const under3 = builds.find(a => G.props[a.space].houses < 3);
    if (under3) return under3;
    if (builds.length && p.cash - SPACES[builds[0].space].houseCost >= BUILD_BUFFER * 2) return builds[0];
    if (p.cash >= UNMORTGAGE_AT) {
      const um = acts.filter(a => a.type === "unmortgage")
        .sort((a, b) => SPACES[a.space].price - SPACES[b.space].price)[0];
      if (um) return um;
    }
    return find("roll") || find("endTurn");
  }
  return null;
}

const API = { choose };
if (typeof module !== "undefined" && module.exports) module.exports = API;
else root.MonopolyAI = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
