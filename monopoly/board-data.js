// BIG IF Monopoly — board data. 40 spaces, US classic prices/rents,
// 16 Chance + 16 Community Chest cards. Pure data, no logic.
// Dual-loadable: browser global MONOPOLY_DATA / node module.exports.
(function (root) {
"use strict";

// Space kinds: go, prop, rail, util, tax, chance, chest, jail, parking, gotojail
// prop: group, price, rents [base,1h,2h,3h,4h,hotel], houseCost
// rail: price 200, rent handled by engine (25/50/100/200)
// util: price 150, rent 4x/10x dice
const GROUPS = {
  brown:  { name: "Brown",      color: "#8a5f41" },
  lblue:  { name: "Light Blue", color: "#5fa8bd" },
  pink:   { name: "Pink",       color: "#c25f8e" },
  orange: { name: "Orange",     color: "#c9752f" },
  red:    { name: "Red",        color: "#b03535" },
  yellow: { name: "Yellow",     color: "#c9a832" },
  green:  { name: "Green",      color: "#3f8f57" },
  dblue:  { name: "Dark Blue",  color: "#35569e" },
  rail:   { name: "Railroad",   color: "#a89c7c" },
  util:   { name: "Utility",    color: "#7f7f95" },
};

const SPACES = [
  { i: 0,  kind: "go",      name: "GO" },
  { i: 1,  kind: "prop",    name: "Mediterranean Ave",  group: "brown",  price: 60,  houseCost: 50,  rents: [2, 10, 30, 90, 160, 250] },
  { i: 2,  kind: "chest",   name: "Community Chest" },
  { i: 3,  kind: "prop",    name: "Baltic Ave",         group: "brown",  price: 60,  houseCost: 50,  rents: [4, 20, 60, 180, 320, 450] },
  { i: 4,  kind: "tax",     name: "Income Tax",         amount: 200 },
  { i: 5,  kind: "rail",    name: "Reading Railroad",   group: "rail",   price: 200 },
  { i: 6,  kind: "prop",    name: "Oriental Ave",       group: "lblue",  price: 100, houseCost: 50,  rents: [6, 30, 90, 270, 400, 550] },
  { i: 7,  kind: "chance",  name: "Chance" },
  { i: 8,  kind: "prop",    name: "Vermont Ave",        group: "lblue",  price: 100, houseCost: 50,  rents: [6, 30, 90, 270, 400, 550] },
  { i: 9,  kind: "prop",    name: "Connecticut Ave",    group: "lblue",  price: 120, houseCost: 50,  rents: [8, 40, 100, 300, 450, 600] },
  { i: 10, kind: "jail",    name: "Jail / Just Visiting" },
  { i: 11, kind: "prop",    name: "St. Charles Place",  group: "pink",   price: 140, houseCost: 100, rents: [10, 50, 150, 450, 625, 750] },
  { i: 12, kind: "util",    name: "Electric Company",   group: "util",   price: 150 },
  { i: 13, kind: "prop",    name: "States Ave",         group: "pink",   price: 140, houseCost: 100, rents: [10, 50, 150, 450, 625, 750] },
  { i: 14, kind: "prop",    name: "Virginia Ave",       group: "pink",   price: 160, houseCost: 100, rents: [12, 60, 180, 500, 700, 900] },
  { i: 15, kind: "rail",    name: "Pennsylvania Railroad", group: "rail", price: 200 },
  { i: 16, kind: "prop",    name: "St. James Place",    group: "orange", price: 180, houseCost: 100, rents: [14, 70, 200, 550, 750, 950] },
  { i: 17, kind: "chest",   name: "Community Chest" },
  { i: 18, kind: "prop",    name: "Tennessee Ave",      group: "orange", price: 180, houseCost: 100, rents: [14, 70, 200, 550, 750, 950] },
  { i: 19, kind: "prop",    name: "New York Ave",       group: "orange", price: 200, houseCost: 100, rents: [16, 80, 220, 600, 800, 1000] },
  { i: 20, kind: "parking", name: "Free Parking" },
  { i: 21, kind: "prop",    name: "Kentucky Ave",       group: "red",    price: 220, houseCost: 150, rents: [18, 90, 250, 700, 875, 1050] },
  { i: 22, kind: "chance",  name: "Chance" },
  { i: 23, kind: "prop",    name: "Indiana Ave",        group: "red",    price: 220, houseCost: 150, rents: [18, 90, 250, 700, 875, 1050] },
  { i: 24, kind: "prop",    name: "Illinois Ave",       group: "red",    price: 240, houseCost: 150, rents: [20, 100, 300, 750, 925, 1100] },
  { i: 25, kind: "rail",    name: "B. & O. Railroad",   group: "rail",   price: 200 },
  { i: 26, kind: "prop",    name: "Atlantic Ave",       group: "yellow", price: 260, houseCost: 150, rents: [22, 110, 330, 800, 975, 1150] },
  { i: 27, kind: "prop",    name: "Ventnor Ave",        group: "yellow", price: 260, houseCost: 150, rents: [22, 110, 330, 800, 975, 1150] },
  { i: 28, kind: "util",    name: "Water Works",        group: "util",   price: 150 },
  { i: 29, kind: "prop",    name: "Marvin Gardens",     group: "yellow", price: 280, houseCost: 150, rents: [24, 120, 360, 850, 1025, 1200] },
  { i: 30, kind: "gotojail", name: "Go To Jail" },
  { i: 31, kind: "prop",    name: "Pacific Ave",        group: "green",  price: 300, houseCost: 200, rents: [26, 130, 390, 900, 1100, 1275] },
  { i: 32, kind: "prop",    name: "North Carolina Ave", group: "green",  price: 300, houseCost: 200, rents: [26, 130, 390, 900, 1100, 1275] },
  { i: 33, kind: "chest",   name: "Community Chest" },
  { i: 34, kind: "prop",    name: "Pennsylvania Ave",   group: "green",  price: 320, houseCost: 200, rents: [28, 150, 450, 1000, 1200, 1400] },
  { i: 35, kind: "rail",    name: "Short Line",         group: "rail",   price: 200 },
  { i: 36, kind: "chance",  name: "Chance" },
  { i: 37, kind: "prop",    name: "Park Place",         group: "dblue",  price: 350, houseCost: 200, rents: [35, 175, 500, 1100, 1300, 1500] },
  { i: 38, kind: "tax",     name: "Luxury Tax",         amount: 100 },
  { i: 39, kind: "prop",    name: "Boardwalk",          group: "dblue",  price: 400, houseCost: 200, rents: [50, 200, 600, 1400, 1700, 2000] },
];

// Card act kinds the engine understands:
// goto {space}    — advance to space, collect $200 if passing GO
// nearest {what: "rail"|"util"} — advance to nearest; rail pays 2x rent, util 10x dice
// back3           — move back 3 spaces, resolve landing
// jail            — go directly to jail
// jailfree        — Get Out of Jail Free (held by player, out of deck)
// collect {n}     — bank pays player
// pay {n}         — player pays bank
// collectEach {n} — every other player pays this player
// payEach {n}     — player pays every other player
// repairs {house, hotel} — pay per building owned
const CHANCE = [
  { text: "Advance to GO. Collect $200.",                              act: { kind: "goto", space: 0 } },
  { text: "Advance to Illinois Ave. If you pass GO collect $200.",     act: { kind: "goto", space: 24 } },
  { text: "Advance to St. Charles Place. If you pass GO collect $200.", act: { kind: "goto", space: 11 } },
  { text: "Advance to the nearest Utility. If owned, pay 10x the dice.", act: { kind: "nearest", what: "util" } },
  { text: "Advance to the nearest Railroad. If owned, pay double rent.", act: { kind: "nearest", what: "rail" } },
  { text: "Advance to the nearest Railroad. If owned, pay double rent.", act: { kind: "nearest", what: "rail" } },
  { text: "Bank pays you a dividend of $50.",                          act: { kind: "collect", n: 50 } },
  { text: "Get Out of Jail Free. Keep this card until used.",          act: { kind: "jailfree" } },
  { text: "Go back 3 spaces.",                                         act: { kind: "back3" } },
  { text: "Go directly to Jail. Do not pass GO, do not collect $200.", act: { kind: "jail" } },
  { text: "Make general repairs: pay $25 per house, $100 per hotel.",  act: { kind: "repairs", house: 25, hotel: 100 } },
  { text: "Speeding fine. Pay $15.",                                   act: { kind: "pay", n: 15 } },
  { text: "Take a trip to Reading Railroad. If you pass GO collect $200.", act: { kind: "goto", space: 5 } },
  { text: "Take a walk on the Boardwalk. Advance to Boardwalk.",       act: { kind: "goto", space: 39 } },
  { text: "You have been elected chairman of the board. Pay each player $50.", act: { kind: "payEach", n: 50 } },
  { text: "Your building loan matures. Collect $150.",                 act: { kind: "collect", n: 150 } },
];

const CHEST = [
  { text: "Advance to GO. Collect $200.",                              act: { kind: "goto", space: 0 } },
  { text: "Bank error in your favor. Collect $200.",                   act: { kind: "collect", n: 200 } },
  { text: "Doctor's fee. Pay $50.",                                    act: { kind: "pay", n: 50 } },
  { text: "From sale of stock you get $50.",                           act: { kind: "collect", n: 50 } },
  { text: "Get Out of Jail Free. Keep this card until used.",          act: { kind: "jailfree" } },
  { text: "Go directly to Jail. Do not pass GO, do not collect $200.", act: { kind: "jail" } },
  { text: "Holiday fund matures. Collect $100.",                       act: { kind: "collect", n: 100 } },
  { text: "Income tax refund. Collect $20.",                           act: { kind: "collect", n: 20 } },
  { text: "It's your birthday! Collect $10 from every player.",        act: { kind: "collectEach", n: 10 } },
  { text: "Life insurance matures. Collect $100.",                     act: { kind: "collect", n: 100 } },
  { text: "Pay hospital fees of $100.",                                act: { kind: "pay", n: 100 } },
  { text: "Pay school fees of $50.",                                   act: { kind: "pay", n: 50 } },
  { text: "Receive a $25 consultancy fee.",                            act: { kind: "collect", n: 25 } },
  { text: "Street repairs: pay $40 per house, $115 per hotel.",        act: { kind: "repairs", house: 40, hotel: 115 } },
  { text: "You won second prize in a beauty contest. Collect $10.",    act: { kind: "collect", n: 10 } },
  { text: "You inherit $100.",                                         act: { kind: "collect", n: 100 } },
];

const DATA = { SPACES, GROUPS, CHANCE, CHEST };
if (typeof module !== "undefined" && module.exports) module.exports = DATA;
else root.MONOPOLY_DATA = DATA;
})(typeof globalThis !== "undefined" ? globalThis : this);
