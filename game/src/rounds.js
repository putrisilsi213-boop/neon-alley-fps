// Rounds and economy: buy phase, 100-second combat rounds, first to 7 (max
// 13). A round ends on elimination, on the clock, or on the bomb: plant it at
// a site (hold E), it blows after 25 seconds unless a defender defuses it in
// 5 seconds flat. Money: kill +300, round win +3250, round loss +1900.
import { feed, resetBomb } from './state.js';
import { SMOKE_PRICE, WEAPONS, WEAPON_ORDER } from './weapons.js';

export const KILL_BONUS = 300;
export const WIN_BONUS = 3250;
export const LOSS_BONUS = 1900;
export const PLANT_SECONDS = 3;
export const BOMB_SECONDS = 25;
export const ROUND_SECONDS = 100;
export const BUY_SECONDS = 12;

export function createRounds(state, world, player, weapons, bots, hud, audio) {
  function startBuyPhase() {
    state.phase = 'buy';
    state.buyTimer = BUY_SECONDS;
    state.timer = ROUND_SECONDS;
    resetBomb(state);
    state.roundWinner = null;
    state.roundReason = '';
    state.playerDead = false;
    player.reset(world.spawnAtk[0].x, world.spawnAtk[0].z, 0);
    weapons.refillMags();
    bots.spawnRound(state.round);
    hud.showBuy(true);
    hud.setBanner('');
    feed(state, `Round ${state.round} — buy phase. B for the buy menu.`, 'info');
  }

  function startCombat() {
    state.phase = 'combat';
    state.timer = ROUND_SECONDS;
    hud.showBuy(false);
    hud.setBanner('');
    feed(state, `Round ${state.round} — go. Plant at Site A or B.`, 'info');
  }

  function endRound(winner, reason) {
    if (state.phase === 'roundEnd' || state.phase === 'matchEnd') return;
    state.phase = 'roundEnd';
    state.roundWinner = winner;
    state.roundReason = reason;
    state.timer = 4;
    if (winner === 'atk') {
      state.score.atk += 1;
      state.money += WIN_BONUS;
      audio.roundWin();
    } else {
      state.score.def += 1;
      state.money += LOSS_BONUS;
      audio.roundLose();
    }
    hud.showBuy(false);
    hud.showRoundEnd(winner, reason, state.score);
    feed(state, `${winner === 'atk' ? 'Lanterns' : 'Nightwatch'} take round ${state.round} — ${reason}`, winner === 'atk' ? 'good' : 'bad');
  }

  function endMatch(winner) {
    state.phase = 'matchEnd';
    state.matchWinner = winner;
    hud.showMatchEnd(winner, state.score, state.kills);
  }

  function nextRound() {
    if (state.score.atk >= state.winRounds || state.score.def >= state.winRounds) {
      endMatch(state.score.atk > state.score.def ? 'atk' : 'def');
      return;
    }
    if (state.round >= state.maxRounds) {
      endMatch(state.score.atk > state.score.def ? 'atk' : state.score.def > state.score.atk ? 'def' : 'draw');
      return;
    }
    state.round += 1;
    startBuyPhase();
  }

  function checkEndConditions() {
    if (state.phase !== 'combat') return;
    const atkAlive = bots.aliveCount('atk') + (player.state.dead ? 0 : 1);
    const defAlive = bots.aliveCount('def');
    if (defAlive === 0) { endRound('atk', 'Nightwatch eliminated'); return; }
    if (atkAlive === 0) { endRound('def', 'Lanterns eliminated'); return; }
    if (state.timer <= 0 && !state.bomb.planted) { endRound('def', 'Time expired — no plant'); }
  }

  function plantSiteNearPlayer() {
    const p = player.state.position;
    for (const key of ['A', 'B']) {
      const site = world.sites[key];
      const dx = p.x - site.pos.x;
      const dz = p.z - site.pos.z;
      if (Math.hypot(dx, dz) < site.radius) return key;
    }
    return null;
  }

  function step(dt, keys, planting) {
    if (state.phase === 'buy') {
      state.buyTimer -= dt;
      if (state.buyTimer <= 0) startCombat();
      return;
    }
    if (state.phase === 'roundEnd') {
      state.timer -= dt;
      if (state.timer <= 0) nextRound();
      return;
    }
    if (state.phase !== 'combat') return;
    state.timer -= dt;
    // Bomb countdown and explosion.
    if (state.bomb.planted) {
      state.bomb.timer -= dt;
      if (Math.floor(state.bomb.timer) !== Math.floor(state.bomb.timer + dt) && state.bomb.timer > 0 && state.bomb.timer < 6) {
        audio.plantBeep();
      }
      if (state.bomb.timer <= 0) {
        audio.explosion();
        endRound('atk', 'Spike detonated at Site ' + state.bomb.site);
        return;
      }
    }
    // Planting: hold E inside a site for 3 seconds.
    const site = plantSiteNearPlayer();
    if (planting && site && !state.bomb.planted && !player.state.dead) {
      state.bomb.planting += dt;
      state.bomb.plantSite = site;
      if (state.bomb.planting >= PLANT_SECONDS) {
        state.bomb.planted = true;
        state.bomb.site = site;
        state.bomb.pos = world.sites[site].pos.clone();
        state.bomb.timer = BOMB_SECONDS;
        state.bomb.planting = 0;
        state.bomb.defuse = 0;
        audio.plantBeep();
        feed(state, 'Spike planted at Site ' + site + ' — 25 seconds.', 'good');
        bots.hearShot(state.bomb.pos);
      }
    } else {
      state.bomb.planting = 0;
      state.bomb.plantSite = null;
    }
    checkEndConditions();
  }

  function buyWeapon(id) {
    if (state.phase !== 'buy') return false;
    const price = weapons.buy(id, state.money);
    if (price === null) { audio.denied(); return false; }
    state.money -= price;
    audio.buy();
    feed(state, `Bought ${WEAPONS[id].name} for $${price}.`, 'good');
    return true;
  }

  function buySmoke() {
    if (state.phase !== 'buy') return false;
    const price = weapons.buySmoke(state.money);
    if (price === null) { audio.denied(); return false; }
    state.money -= price;
    audio.buy();
    feed(state, `Bought a smoke grenade for $${SMOKE_PRICE}.`, 'good');
    return true;
  }

  function onKill(killerIsPlayer) {
    if (!killerIsPlayer) return;
    state.kills += 1;
    state.money += KILL_BONUS;
  }

  return {
    startBuyPhase,
    startCombat,
    endRound,
    nextRound,
    step,
    buyWeapon,
    buySmoke,
    onKill,
    checkEndConditions,
    plantSiteNearPlayer,
    weaponList() {
      return WEAPON_ORDER.map((id) => ({ ...WEAPONS[id], owned: weapons.state.owned.has(id) }));
    },
  };
}
