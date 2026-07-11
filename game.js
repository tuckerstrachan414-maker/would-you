// BIG IF Monopoly — pure game engine. No DOM, no timers, no globals mutated
// outside G. UI and AI both drive it through dispatch(G, action).
// Dual-loadable: browser global MonopolyGame / node module.exports.
//
// State G is a plain JSON object — serialize with JSON.stringify, resume with
// JSON.parse. The RNG state lives inside G so a resumed game replays the same
// shuffles and dice.
(function (root) {
"use strict";

const DATA = (typeof module !== "undefined" && module.exports)
  ? require("./board-data.js")
  : root.MONOPOLY_DATA;
const { SPACES, CHANCE, CHEST } = DATA;

const GO_SALARY = 200, JAIL_POS = 10, JAIL_FINE = 50;
const HOUSE_STOCK = 32, HOTEL_STOCK = 12, START_CASH = 1500;

// Test hook: push [d1,d2] pairs here and the engine consumes them before RNG.
const testDice = [];

// --- RNG (mulberry32, state kept in G) ---------------------------------
function rand(G) {
  G.rng = (G.rng + 0x6D2B79F5) | 0;
  let t = G.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle(G, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand(G) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// --- setup ---------------------------------------------------------------
// defs: [{name, human, color}], seed optional
function newGame(defs, seed) {
  const G = {
    v: 1,
    rng: (seed === undefined ? (Date.now() & 0x7fffffff) : seed) | 0,
    players: defs.map((d, i) => ({
      id: i, name: d.name, color: d.color, human: !!d.human,
      cash: START_CASH, pos: 0, inJail: false, jailTurns: 0,
      jailCards: [], bankrupt: false,
    })),
    props: {},           // spaceIdx -> {owner, houses (0-5, 5=hotel), mortgaged}
    chance: [], chest: [],
    turn: 0,
    phase: "roll",       // roll | manage | over
    pending: null,       // {type:"buy"|"debt", ...}
    dice: null, doubles: 0, mustRollAgain: false,
    houseStock: HOUSE_STOCK, hotelStock: HOTEL_STOCK,
    lastCard: null,      // {deck, text} for UI display
    log: [], winner: null, turns: 0,
  };
  for (const s of SPACES) {
    if (s.kind === "prop" || s.kind === "rail" || s.kind === "util") {
      G.props[s.i] = { owner: -1, houses: 0, mortgaged: false };
    }
  }
  G.chance = shuffle(G, CHANCE.map((_, i) => i));
  G.chest  = shuffle(G, CHEST.map((_, i) => i));
  log(G, "New game: " + defs.map(d => d.name).join(", ") + ". Everyone starts with $" + START_CASH + ".");
  return G;
}

function log(G, msg) {
  G.log.push(msg);
  if (G.log.length > 200) G.log.splice(0, G.log.length - 200);
}

// --- queries -------------------------------------------------------------
function cur(G) { return G.players[G.turn]; }
function alive(G) { return G.players.filter(p => !p.bankrupt); }
function ownsGroup(G, pid, group) {
  return SPACES.filter(s => s.group === group && s.kind === "prop")
    .every(s => G.props[s.i].owner === pid);
}
function groupSpaces(group) {
  return SPACES.filter(s => s.group === group && s.kind === "prop");
}
function railCount(G, pid) {
  return SPACES.filter(s => s.kind === "rail" && G.props[s.i].owner === pid).length;
}
function utilCount(G, pid) {
  return SPACES.filter(s => s.kind === "util" && G.props[s.i].owner === pid).length;
}

// Rent owed for landing on `space` with `diceTotal` (multiplier for card effects).
function rentFor(G, spaceIdx, diceTotal, railMult, utilTimesTen) {
  const s = SPACES[spaceIdx], st = G.props[spaceIdx];
  if (!st || st.owner === -1 || st.mortgaged) return 0;
  if (s.kind === "rail") return 25 * Math.pow(2, railCount(G, st.owner) - 1) * (railMult || 1);
  if (s.kind === "util") {
    const mult = utilTimesTen ? 10 : (utilCount(G, st.owner) === 2 ? 10 : 4);
    return mult * diceTotal;
  }
  if (st.houses > 0) return s.rents[st.houses];
  return s.rents[0] * (ownsGroup(G, st.owner, s.group) ? 2 : 1);
}

// Everything a player could raise by mortgaging + selling buildings.
function raisable(G, pid) {
  let total = G.players[pid].cash;
  for (const [i, st] of Object.entries(G.props)) {
    if (st.owner !== pid) continue;
    const s = SPACES[i];
    if (st.houses > 0) total += st.houses * Math.floor(s.houseCost / 2);
    if (!st.mortgaged) total += Math.floor(s.price / 2);
  }
  return total;
}

function netWorth(G, pid) {
  let total = G.players[pid].cash;
  for (const [i, st] of Object.entries(G.props)) {
    if (st.owner !== pid) continue;
    const s = SPACES[i];
    total += st.mortgaged ? Math.floor(s.price / 2) : s.price;
    total += st.houses * s.houseCost;
  }
  return total;
}

// --- money movement ------------------------------------------------------
function credit(G, pid, n, why) {
  G.players[pid].cash += n;
  log(G, G.players[pid].name + " gets $" + n + " (" + why + ").");
}

// Charge `pid` `amount`; creditor -1 = bank. If short: turn owner gets a
// pending debt to resolve; other players are auto-liquidated (or bankrupted).
function charge(G, pid, amount, creditor, why) {
  const p = G.players[pid];
  if (p.cash >= amount) {
    p.cash -= amount;
    if (creditor >= 0) G.players[creditor].cash += amount;
    log(G, p.name + " pays $" + amount + (creditor >= 0 ? " to " + G.players[creditor].name : "") + " (" + why + ").");
    return true;
  }
  if (pid === G.turn) {
    G.pending = { type: "debt", amount, creditor, why };
    log(G, p.name + " owes $" + amount + " (" + why + ") but only has $" + p.cash + " — must raise money or go bankrupt.");
    return false;
  }
  // Non-turn player (birthday/chairman cards): auto-liquidate.
  autoRaise(G, pid, amount);
  if (p.cash >= amount) {
    p.cash -= amount;
    if (creditor >= 0) G.players[creditor].cash += amount;
    log(G, p.name + " pays $" + amount + " (" + why + ") after selling off assets.");
    return true;
  }
  bankruptPlayer(G, pid, creditor);
  return false;
}

// Sell houses / mortgage cheapest-first until cash >= amount (used for
// non-turn players and by the AI when it owes money).
function autoRaise(G, pid, amount) {
  const p = G.players[pid];
  const mine = Object.keys(G.props).map(Number).filter(i => G.props[i].owner === pid);
  // 1) sell buildings, cheapest groups first, respecting even-sell
  let sold = true;
  while (p.cash < amount && sold) {
    sold = false;
    const built = mine.filter(i => G.props[i].houses > 0)
      .sort((a, b) => SPACES[a].houseCost - SPACES[b].houseCost);
    for (const i of built) {
      if (trySellHouse(G, pid, i)) { sold = true; break; }
    }
  }
  // 2) mortgage, cheapest first
  const unmort = () => mine.filter(i => !G.props[i].mortgaged && G.props[i].houses === 0)
    .sort((a, b) => SPACES[a].price - SPACES[b].price);
  for (const i of unmort()) {
    if (p.cash >= amount) break;
    tryMortgage(G, pid, i);
  }
}

function bankruptPlayer(G, pid, creditor) {
  const p = G.players[pid];
  p.bankrupt = true;
  const toBank = creditor === -1 || creditor === undefined || G.players[creditor] === undefined;
  log(G, p.name + " is BANKRUPT" + (toBank ? "." : " — everything goes to " + G.players[creditor].name + "."));
  // Buildings go back to the bank at half value (cash joins the estate first).
  for (const [i, st] of Object.entries(G.props)) {
    if (st.owner !== pid) continue;
    const s = SPACES[i];
    if (st.houses > 0) {
      p.cash += st.houses === 5
        ? (G.hotelStock++, 5 * Math.floor(s.houseCost / 2))
        : (G.houseStock += st.houses, st.houses * Math.floor(s.houseCost / 2));
      st.houses = 0;
    }
    if (toBank) { st.owner = -1; st.mortgaged = false; }
    else st.owner = creditor;
  }
  if (!toBank) {
    G.players[creditor].cash += p.cash;
    for (const deck of p.jailCards) G.players[creditor].jailCards.push(deck);
  } else {
    for (const deck of p.jailCards) G[deck].push(deck === "chance" ? CHANCE.findIndex(c => c.act.kind === "jailfree") : CHEST.findIndex(c => c.act.kind === "jailfree"));
  }
  p.cash = 0; p.jailCards = [];
  if (G.pending && G.pending.type === "debt" && pid === G.turn) G.pending = null;
  const left = alive(G);
  if (left.length === 1) {
    G.phase = "over"; G.winner = left[0].id; G.pending = null;
    log(G, left[0].name + " WINS with $" + left[0].cash + " and " +
      Object.values(G.props).filter(st => st.owner === left[0].id).length + " properties!");
  } else if (pid === G.turn && G.phase !== "over") {
    advanceTurn(G);
  }
}

// --- dice & movement -----------------------------------------------------
function rollDice(G) {
  if (testDice.length) return testDice.shift();
  return [1 + Math.floor(rand(G) * 6), 1 + Math.floor(rand(G) * 6)];
}

function moveTo(G, pid, dest, collectGo) {
  const p = G.players[pid];
  if (collectGo && dest <= p.pos) credit(G, pid, GO_SALARY, "passed GO");
  p.pos = dest;
}

function advanceTurn(G) {
  G.pending = null; G.dice = null; G.doubles = 0; G.mustRollAgain = false;
  if (G.phase === "over") return;
  do { G.turn = (G.turn + 1) % G.players.length; } while (cur(G).bankrupt);
  G.phase = "roll"; G.turns++;
}

function sendToJail(G, pid) {
  const p = G.players[pid];
  p.pos = JAIL_POS; p.inJail = true; p.jailTurns = 0;
  G.doubles = 0; G.mustRollAgain = false;
  log(G, p.name + " goes to Jail.");
  if (!G.pending) G.phase = "manage"; // turn ends; manage lets them tidy up then end
}

// Resolve the space the current player just arrived on.
// opts: {railMult, utilTimesTen} for chance-card arrivals.
function resolveLanding(G, opts) {
  opts = opts || {};
  const p = cur(G), s = SPACES[p.pos];
  const diceTotal = G.dice ? G.dice[0] + G.dice[1] : 7;
  switch (s.kind) {
    case "prop": case "rail": case "util": {
      const st = G.props[p.pos];
      if (st.owner === -1) {
        G.pending = { type: "buy", space: p.pos };
        log(G, p.name + " landed on " + s.name + " — unowned, $" + s.price + ".");
      } else if (st.owner !== p.id && !st.mortgaged) {
        const rent = rentFor(G, p.pos, diceTotal, opts.railMult, opts.utilTimesTen);
        log(G, p.name + " landed on " + s.name + " (owned by " + G.players[st.owner].name + ").");
        charge(G, p.id, rent, st.owner, "rent for " + s.name);
      } else {
        log(G, p.name + " landed on " + s.name + (st.owner === p.id ? " (their own)." : " (mortgaged — no rent)."));
      }
      break;
    }
    case "tax":
      log(G, p.name + " landed on " + s.name + ".");
      charge(G, p.id, s.amount, -1, s.name);
      break;
    case "chance": drawCard(G, "chance"); break;
    case "chest":  drawCard(G, "chest"); break;
    case "gotojail": sendToJail(G, p.id); return;
    case "go":
      log(G, p.name + " is on GO."); // salary already paid on the way past
      break;
    default:
      log(G, p.name + " landed on " + s.name + ".");
  }
  if (!G.pending && G.phase !== "over" && !cur(G).inJail) G.phase = "manage";
}

// --- cards ---------------------------------------------------------------
function drawCard(G, deck) {
  const cards = deck === "chance" ? CHANCE : CHEST;
  const idx = G[deck].shift();
  const card = cards[idx];
  const p = cur(G);
  G.lastCard = { deck, text: card.text };
  log(G, (deck === "chance" ? "Chance" : "Community Chest") + ": " + card.text);
  if (card.act.kind === "jailfree") {
    p.jailCards.push(deck); // card stays out of the deck while held
  } else {
    G[deck].push(idx);
    applyCard(G, card.act);
  }
}

function applyCard(G, act) {
  const p = cur(G);
  switch (act.kind) {
    case "goto":
      moveTo(G, p.id, act.space, true);
      resolveLanding(G);
      return; // resolveLanding sets phase
    case "nearest": {
      const stops = act.what === "rail" ? [5, 15, 25, 35] : [12, 28];
      const dest = stops.find(x => x > p.pos) ?? stops[0];
      moveTo(G, p.id, dest, true);
      resolveLanding(G, act.what === "rail" ? { railMult: 2 } : { utilTimesTen: true });
      return;
    }
    case "back3":
      p.pos = (p.pos + 37) % 40;
      resolveLanding(G);
      return;
    case "jail": sendToJail(G, p.id); return;
    case "collect": credit(G, p.id, act.n, "card"); break;
    case "pay": charge(G, p.id, act.n, -1, "card"); break;
    case "collectEach":
      for (const o of alive(G)) if (o.id !== p.id) charge(G, o.id, act.n, p.id, "card: pay " + p.name);
      break;
    case "payEach": {
      const others = alive(G).filter(o => o.id !== p.id);
      if (charge(G, p.id, act.n * others.length, -2, "card")) {
        for (const o of others) o.cash += act.n; // -2 creditor = split marker
      } else if (G.pending && G.pending.type === "debt") {
        G.pending.splitAmong = others.map(o => o.id);
      }
      break;
    }
    case "repairs": {
      let houses = 0, hotels = 0;
      for (const [i, st] of Object.entries(G.props)) {
        if (st.owner !== p.id) continue;
        if (st.houses === 5) hotels++; else houses += st.houses;
      }
      const bill = houses * act.house + hotels * act.hotel;
      if (bill > 0) charge(G, p.id, bill, -1, "repairs: " + houses + " houses, " + hotels + " hotels");
      else log(G, p.name + " owns no buildings — repairs cost nothing.");
      break;
    }
  }
}

// --- building / mortgage internals (shared by dispatch + autoRaise) ------
function canBuild(G, pid, i) {
  const s = SPACES[i], st = G.props[i];
  if (!s || s.kind !== "prop" || st.owner !== pid) return false;
  if (!ownsGroup(G, pid, s.group)) return false;
  const grp = groupSpaces(s.group);
  if (grp.some(g => G.props[g.i].mortgaged)) return false;
  if (st.houses >= 5) return false;
  if (st.houses === 4 ? G.hotelStock < 1 : G.houseStock < 1) return false;
  const minH = Math.min(...grp.map(g => G.props[g.i].houses));
  return st.houses <= minH && G.players[pid].cash >= s.houseCost;
}

function canSellHouse(G, pid, i) {
  const s = SPACES[i], st = G.props[i];
  if (!s || s.kind !== "prop" || st.owner !== pid || st.houses === 0) return false;
  const grp = groupSpaces(s.group);
  const maxH = Math.max(...grp.map(g => G.props[g.i].houses));
  if (st.houses < maxH) return false;
  // Breaking a hotel back to 4 houses needs 4 houses in stock.
  if (st.houses === 5 && G.houseStock < 4) return false;
  return true;
}

function trySellHouse(G, pid, i) {
  const s = SPACES[i], st = G.props[i];
  if (!canSellHouse(G, pid, i)) {
    // Special case: hotel but no houses in stock — tear down completely.
    if (st.owner === pid && st.houses === 5 && G.houseStock < 4) {
      st.houses = 0; G.hotelStock++;
      G.players[pid].cash += 5 * Math.floor(s.houseCost / 2);
      log(G, G.players[pid].name + " tears down the hotel on " + s.name + " (no houses left in the bank) for $" + 5 * Math.floor(s.houseCost / 2) + ".");
      return true;
    }
    return false;
  }
  if (st.houses === 5) { G.hotelStock++; G.houseStock -= 4; st.houses = 4; }
  else { G.houseStock++; st.houses--; }
  G.players[pid].cash += Math.floor(s.houseCost / 2);
  log(G, G.players[pid].name + " sells a building on " + s.name + " for $" + Math.floor(s.houseCost / 2) + ".");
  return true;
}

function tryMortgage(G, pid, i) {
  const s = SPACES[i], st = G.props[i];
  if (!st || st.owner !== pid || st.mortgaged || st.houses > 0) return false;
  if (s.kind === "prop" && groupSpaces(s.group).some(g => G.props[g.i].houses > 0)) return false;
  st.mortgaged = true;
  G.players[pid].cash += Math.floor(s.price / 2);
  log(G, G.players[pid].name + " mortgages " + s.name + " for $" + Math.floor(s.price / 2) + ".");
  return true;
}

// --- dispatch ------------------------------------------------------------
// Actions: {type:"roll"} {type:"payJail"} {type:"useJailCard"}
//   {type:"buy"} {type:"decline"} {type:"payDebt"} {type:"bankrupt"}
//   {type:"build", space} {type:"sellHouse", space}
//   {type:"mortgage", space} {type:"unmortgage", space} {type:"endTurn"}
function dispatch(G, action) {
  if (G.phase === "over") return err("Game is over.");
  const p = cur(G);
  const t = action.type;

  // Management actions are legal any time it's your turn (raising money
  // for a purchase or a debt is allowed by the rules) — but no spending
  // money on buildings or mortgage lifting while you owe a debt.
  const inDebt = G.pending && G.pending.type === "debt";
  if (inDebt && (t === "build" || t === "unmortgage")) return err("Pay your debt first.");
  if (t === "build") {
    if (!canBuild(G, p.id, action.space)) return err("Can't build there.");
    const s = SPACES[action.space], st = G.props[action.space];
    p.cash -= s.houseCost;
    if (st.houses === 4) { G.hotelStock--; G.houseStock += 4; st.houses = 5; log(G, p.name + " builds a HOTEL on " + s.name + "."); }
    else { G.houseStock--; st.houses++; log(G, p.name + " builds house #" + st.houses + " on " + s.name + "."); }
    return ok();
  }
  if (t === "sellHouse") {
    return trySellHouse(G, p.id, action.space) ? ok() : err("Can't sell there.");
  }
  if (t === "mortgage") {
    return tryMortgage(G, p.id, action.space) ? ok() : err("Can't mortgage that.");
  }
  if (t === "unmortgage") {
    const s = SPACES[action.space], st = G.props[action.space];
    if (!st || st.owner !== p.id || !st.mortgaged) return err("Not mortgaged.");
    const cost = Math.floor(s.price / 2) + Math.ceil(s.price / 20); // principal + 10%
    if (p.cash < cost) return err("Need $" + cost + ".");
    p.cash -= cost; st.mortgaged = false;
    log(G, p.name + " lifts the mortgage on " + s.name + " for $" + cost + ".");
    return ok();
  }

  // Pending decisions take priority over phase actions.
  if (G.pending && G.pending.type === "buy") {
    if (t === "buy") {
      const s = SPACES[G.pending.space];
      if (p.cash < s.price) return err("Not enough cash — mortgage something first or decline.");
      p.cash -= s.price;
      G.props[G.pending.space].owner = p.id;
      log(G, p.name + " buys " + s.name + " for $" + s.price + ".");
      G.pending = null; G.phase = p.inJail ? G.phase : "manage";
      return ok();
    }
    if (t === "decline") {
      log(G, p.name + " declines to buy " + SPACES[G.pending.space].name + ".");
      G.pending = null; G.phase = p.inJail ? G.phase : "manage";
      return ok();
    }
    return err("Decide on the purchase first.");
  }
  if (G.pending && G.pending.type === "debt") {
    if (t === "payDebt") {
      const d = G.pending;
      if (p.cash < d.amount) return err("Still short — sell or mortgage more.");
      p.cash -= d.amount;
      if (d.creditor >= 0) G.players[d.creditor].cash += d.amount;
      if (d.splitAmong) for (const oid of d.splitAmong) G.players[oid].cash += d.amount / d.splitAmong.length;
      log(G, p.name + " pays off the $" + d.amount + " debt (" + d.why + ").");
      G.pending = null;
      if (G.phase !== "over" && !p.inJail) G.phase = "manage";
      return ok();
    }
    if (t === "bankrupt") {
      if (raisable(G, p.id) >= G.pending.amount) return err("You can still cover this — sell or mortgage.");
      bankruptPlayer(G, p.id, G.pending.creditor >= 0 ? G.pending.creditor : -1);
      return ok();
    }
    return err("Settle the debt first.");
  }

  if (G.phase === "roll") {
    if (p.inJail) {
      if (t === "payJail") {
        if (p.cash < JAIL_FINE) return err("Not enough cash.");
        p.cash -= JAIL_FINE; p.inJail = false; p.jailTurns = 0;
        log(G, p.name + " pays the $" + JAIL_FINE + " fine and is out of Jail.");
        return ok();
      }
      if (t === "useJailCard") {
        if (!p.jailCards.length) return err("No Get Out of Jail Free card.");
        const deck = p.jailCards.shift();
        const cards = deck === "chance" ? CHANCE : CHEST;
        G[deck].push(cards.findIndex(c => c.act.kind === "jailfree"));
        p.inJail = false; p.jailTurns = 0;
        log(G, p.name + " uses a Get Out of Jail Free card.");
        return ok();
      }
      if (t === "roll") {
        const d = rollDice(G); G.dice = d;
        if (d[0] === d[1]) {
          p.inJail = false; p.jailTurns = 0;
          log(G, p.name + " rolls " + d[0] + "+" + d[1] + " — doubles! Out of Jail.");
          moveTo(G, p.id, (p.pos + d[0] + d[1]) % 40, false);
          resolveLanding(G); // no re-roll after jail doubles
          return ok();
        }
        p.jailTurns++;
        if (p.jailTurns >= 3) {
          log(G, p.name + " rolls " + d[0] + "+" + d[1] + " — third failed try, must pay the $" + JAIL_FINE + " fine.");
          p.inJail = false; p.jailTurns = 0;
          if (p.cash < JAIL_FINE) autoRaise(G, p.id, JAIL_FINE);
          if (!charge(G, p.id, JAIL_FINE, -1, "jail fine")) return ok(); // can't cover it — debt/bankruptcy, move forfeited
          moveTo(G, p.id, (p.pos + d[0] + d[1]) % 40, false);
          resolveLanding(G);
          return ok();
        }
        log(G, p.name + " rolls " + d[0] + "+" + d[1] + " — no doubles, stays in Jail (try " + p.jailTurns + "/3).");
        G.phase = "manage";
        return ok();
      }
      return err("You're in Jail: pay, use a card, or roll.");
    }
    if (t !== "roll") return err("Roll the dice first.");
    const d = rollDice(G); G.dice = d; G.mustRollAgain = false;
    if (d[0] === d[1]) {
      G.doubles++;
      if (G.doubles >= 3) {
        log(G, p.name + " rolls " + d[0] + "+" + d[1] + " — THIRD doubles in a row! Straight to Jail.");
        sendToJail(G, p.id);
        return ok();
      }
      G.mustRollAgain = true;
    }
    const from = p.pos;
    moveTo(G, p.id, (p.pos + d[0] + d[1]) % 40, false);
    if (p.pos < from) credit(G, p.id, GO_SALARY, "passed GO");
    log(G, p.name + " rolls " + d[0] + "+" + d[1] + (d[0] === d[1] ? " (doubles!)" : "") + " and moves to " + SPACES[p.pos].name + ".");
    resolveLanding(G);
    return ok();
  }

  if (G.phase === "manage") {
    if (t === "roll") {
      if (!G.mustRollAgain) return err("No doubles — end your turn.");
      G.mustRollAgain = false; G.phase = "roll";
      return dispatch(G, { type: "roll" });
    }
    if (t === "endTurn") {
      if (G.mustRollAgain) return err("You rolled doubles — you must roll again.");
      advanceTurn(G);
      return ok();
    }
    return err("Unknown action for this phase: " + t);
  }
  return err("Unknown action: " + t);

  function ok() { return { ok: true }; }
  function err(e) { return { ok: false, error: e }; }
}

// --- convenience for UI & AI ----------------------------------------------
function legalActions(G) {
  if (G.phase === "over") return [];
  const p = cur(G), acts = [];
  if (G.pending && G.pending.type === "buy") {
    if (p.cash >= SPACES[G.pending.space].price) acts.push({ type: "buy" });
    acts.push({ type: "decline" });
  } else if (G.pending && G.pending.type === "debt") {
    if (p.cash >= G.pending.amount) acts.push({ type: "payDebt" });
    if (raisable(G, p.id) < G.pending.amount) acts.push({ type: "bankrupt" });
  } else if (G.phase === "roll") {
    if (p.inJail) {
      acts.push({ type: "roll" });
      if (p.cash >= JAIL_FINE) acts.push({ type: "payJail" });
      if (p.jailCards.length) acts.push({ type: "useJailCard" });
    } else acts.push({ type: "roll" });
  } else if (G.phase === "manage") {
    acts.push(G.mustRollAgain ? { type: "roll" } : { type: "endTurn" });
  }
  // management options
  for (const i of Object.keys(G.props).map(Number)) {
    const st = G.props[i];
    if (st.owner !== p.id) continue;
    if (canBuild(G, p.id, i)) acts.push({ type: "build", space: i });
    if (canSellHouse(G, p.id, i) || (st.houses === 5 && G.houseStock < 4)) acts.push({ type: "sellHouse", space: i });
    if (!st.mortgaged && st.houses === 0 &&
        (SPACES[i].kind !== "prop" || !groupSpaces(SPACES[i].group).some(g => G.props[g.i].houses > 0)))
      acts.push({ type: "mortgage", space: i });
    if (st.mortgaged && p.cash >= Math.floor(SPACES[i].price / 2) + Math.ceil(SPACES[i].price / 20))
      acts.push({ type: "unmortgage", space: i });
  }
  return acts;
}

const API = {
  newGame, dispatch, legalActions, rentFor, raisable, netWorth,
  ownsGroup, groupSpaces, railCount, utilCount, canBuild, canSellHouse,
  cur, alive, testDice, SPACES, DATA,
  JAIL_POS, JAIL_FINE, GO_SALARY,
};
if (typeof module !== "undefined" && module.exports) module.exports = API;
else root.MonopolyGame = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
