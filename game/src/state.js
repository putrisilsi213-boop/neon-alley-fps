// The one state store. Every module reads this object and nothing else holds
// round, money, bomb or score state, so the HUD, the rounds flow and the bots
// can never disagree about what round it is.
export function createState() {
  return {
    time: 0,
    // menu | buy | combat | roundEnd | matchEnd
    phase: 'menu',
    round: 1,
    maxRounds: 13,
    winRounds: 7,
    score: { atk: 0, def: 0 },
    money: 800,
    timer: 100,
    roundTime: 100,
    buyTimer: 12,
    bomb: {
      planted: false,
      site: null,
      pos: null,
      timer: 0,
      plantTimer: 25,
      planting: 0,
      plantSite: null,
      defuse: 0,
      defuser: null,
    },
    kills: 0,
    deaths: 0,
    shots: 0,
    hits: 0,
    killfeed: [],
    spotted: new Map(),
    roundWinner: null,
    roundReason: '',
    matchWinner: null,
    playerDead: false,
    smoke: [],
    events: [],
  };
}

export function resetBomb(state) {
  state.bomb.planted = false;
  state.bomb.site = null;
  state.bomb.pos = null;
  state.bomb.timer = 0;
  state.bomb.planting = 0;
  state.bomb.plantSite = null;
  state.bomb.defuse = 0;
  state.bomb.defuser = null;
}

export function feed(state, text, kind) {
  state.killfeed.push({ text, kind: kind || 'info', t: state.time });
  if (state.killfeed.length > 6) state.killfeed.shift();
}
