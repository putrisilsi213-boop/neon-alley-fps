// Neon Alley boot and the one loop: a fixed 60 Hz simulation feeding a render
// at the display's rate. ?shot=start|play|buy|end with &seed=N sets up a
// deterministic frame for a capture, renders it twice, then freezes it and
// sets window.__shotReady.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { mulberry32 } from './rng.js';
import { createState, feed } from './state.js';
import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createWeapons, WEAPON_ORDER, WEAPONS } from './weapons.js';
import { createCombat } from './combat.js';
import { createBots } from './bots.js';
import { createRounds } from './rounds.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';

const FIXED_STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;
const random = mulberry32(seed);

const state = createState();
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.night);
scene.fog = new THREE.Fog(new THREE.Color(PALETTE.night), 22, 55);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 160);
scene.add(camera);

const world = createWorld(scene, random);
const combat = createCombat(scene, world);
const player = createPlayer(world.colliders);
const weapons = createWeapons(camera);
const bots = createBots(scene, world, combat, state, random);
const hud = createHud(world);
const audio = createAudio();
const input = createInput(renderer.domElement, onLockChange);
const rounds = createRounds(state, world, player, weapons, bots, hud, audio);

const body = player.state;
const direction = new THREE.Vector3();
const markerHoldMs = shot ? 4000 : 90;
let elapsed = 0;
let frozen = false;
let started = false;
let accumulator = 0;
let lastTime = performance.now();
let minimapAt = 0;
let spotAt = 0;

function shootables() {
  return world.shootables.concat(bots.hitMeshes());
}

function syncCamera() {
  camera.position.set(body.position.x, body.position.y + body.eye, body.position.z);
  camera.rotation.set(body.pitch, body.yaw, 0, 'YXZ');
}

function aimAt(point) {
  const dx = point.x - body.position.x;
  const dy = point.y - (body.position.y + body.eye);
  const dz = point.z - body.position.z;
  const length = Math.hypot(dx, dy, dz) || 1;
  body.yaw = Math.atan2(-dx, -dz);
  body.pitch = Math.asin(Math.max(-1, Math.min(1, dy / length)));
  syncCamera();
}

function shoot(spread) {
  const def = weapons.def();
  if (!weapons.takeRound(input.state.firing)) {
    audio.dryClick();
    return;
  }
  state.shots += 1;
  camera.getWorldDirection(direction);
  direction.x += (random() * 2 - 1) * spread;
  direction.y += (random() * 2 - 1) * spread;
  direction.z += (random() * 2 - 1) * spread;
  direction.normalize();
  scene.updateMatrixWorld(true);
  const hit = combat.fire(camera.position, direction, def.range, shootables());
  if (hit && hit.object.userData.bot) {
    const bot = hit.object.userData.bot;
    const head = hit.object.userData.part === 'head';
    const dmg = def.damage * (head ? def.headMult : 1);
    state.hits += 1;
    const killed = bots.damage(bot, dmg);
    state.spotted.set(bot.id, state.time);
    if (killed) {
      rounds.onKill(true);
      feed(state, `You ▸ ${bot.name}${head ? ' (headshot)' : ''}`, 'good');
      audio.kill();
      hud.hitMarker(true, markerHoldMs);
    } else {
      audio.hit();
      hud.hitMarker(false, markerHoldMs);
    }
  }
  weapons.pullTrigger();
  audio.shot(def.kind);
  bots.hearShot(body.position);
  player.recoil(def.kind === 'sniper' ? 0.02 : 0.009 + random() * 0.004, (random() * 2 - 1) * 0.004);
  hud.setAmmo(weapons.currentAmmo().mag, weapons.currentAmmo().reserve, def.name);
}

function throwSmoke() {
  if (weapons.state.smokes <= 0 || state.phase !== 'combat') return;
  weapons.state.smokes -= 1;
  camera.getWorldDirection(direction);
  combat.throwSmoke(camera.position, direction.clone(), state);
  feed(state, 'Smoke out.', 'info');
  hud.setSmokes(weapons.state.smokes);
}

function resetMatch() {
  state.score.atk = 0;
  state.score.def = 0;
  state.round = 1;
  state.money = 800;
  state.kills = 0;
  state.deaths = 0;
  state.shots = 0;
  state.hits = 0;
  state.killfeed.length = 0;
  state.spotted.clear();
  state.matchWinner = null;
  weapons.state.owned = new Set(['pistol']);
  weapons.state.smokes = 0;
  weapons.select('pistol');
  combat.reset();
  bots.reset();
}

hud.onPlay(() => {
  if (shot) return;
  audio.unlock();
  if (state.phase === 'menu' || state.phase === 'matchEnd') {
    if (state.phase === 'matchEnd') resetMatch();
    hud.hideOverlay();
    rounds.startBuyPhase();
    started = true;
    input.requestLock();
  } else if (state.phase === 'roundEnd') {
    hud.hideOverlay();
  } else {
    input.requestLock();
  }
});

function onLockChange(locked) {
  if (shot) return;
  if (locked) {
    started = true;
    hud.hideOverlay();
  } else if (state.phase === 'combat' && !body.dead) {
    hud.showOverlay('paused');
  }
}

function onPlayerDamage(dmg, fromName) {
  if (body.dead || state.phase !== 'combat') return;
  body.health -= dmg;
  hud.flashDamage();
  hud.setHealth(body.health);
  if (body.health <= 0) {
    body.health = 0;
    body.dead = true;
    state.playerDead = true;
    state.deaths += 1;
    feed(state, `${fromName} ▸ You`, 'bad');
    hud.showEliminated();
    if (document.pointerLockElement) document.exitPointerLock();
  }
}

function onBotDamage(victim, dmg, killerName, head) {
  if (!victim || !victim.alive) return;
  const killed = bots.damage(victim, dmg);
  if (killed) {
    feed(state, `${killerName} ▸ ${victim.name}${head ? ' (headshot)' : ''}`, 'info');
  }
}

function onDefused(name) {
  feed(state, `${name} defused the spike.`, 'bad');
  rounds.endRound('def', `Spike defused by ${name}`);
}

const botCtx = {
  get playerAlive() { return !body.dead && state.phase === 'combat'; },
  get playerPos() { return body.position; },
  get playerMoving() { return player.groundSpeed() > 1; },
  get playerCrouching() { return body.crouching; },
  hitMeshes: [],
  onPlayerDamage,
  onBotDamage,
  onDefused,
  onDefuseTick() { audio.defuseTick(); },
  onBotShot(bot) {
    state.spotted.set(bot.id, state.time);
    audio.distantShot();
  },
};

function handlePressed(pressed) {
  if (pressed.has('KeyB') && state.phase === 'buy') {
    hud.showBuy(true);
    hud.updateBuyList(rounds.weaponList(), state.money);
  }
  if (pressed.has('KeyG')) throwSmoke();
  if (pressed.has('KeyR')) {
    if (weapons.reload()) audio.reload();
  }
  for (let i = 0; i < WEAPON_ORDER.length; i += 1) {
    if (!pressed.has('Digit' + (i + 1))) continue;
    const id = WEAPON_ORDER[i];
    if (state.phase === 'buy') {
      if (weapons.state.owned.has(id)) {
        if (weapons.select(id)) audio.buy();
      } else {
        rounds.buyWeapon(id);
      }
    } else if (state.phase === 'combat') {
      weapons.select(id);
    }
  }
  if (pressed.has('Digit5') && state.phase === 'buy') rounds.buySmoke();
}

function step(dt) {
  elapsed += dt;
  state.time += dt;
  const keys = input.state.keys;
  const planting = keys.has('KeyE');
  rounds.step(dt, keys, planting);
  if (state.phase === 'combat' || state.phase === 'buy') {
    player.step(dt, keys);
    weapons.step(dt);
    botCtx.hitMeshes = bots.hitMeshes();
    bots.step(dt, botCtx);
    combat.step(dt, state);
  }
  // Throttled spot scan: enemies the player can see appear on the minimap.
  if (state.time - spotAt > 0.3) {
    spotAt = state.time;
    const eye = new THREE.Vector3(body.position.x, body.position.y + body.eye, body.position.z);
    for (const bot of bots.bots) {
      if (!bot.alive || bot.team !== 'def') continue;
      const tp = new THREE.Vector3(bot.pos.x, bot.pos.y + 1.35, bot.pos.z);
      if (eye.distanceTo(tp) < 42 && combat.hasLineOfSight(eye, tp)) {
        state.spotted.set(bot.id, state.time);
      }
    }
  }
}

function syncHud() {
  const ammo = weapons.currentAmmo();
  hud.setAmmo(ammo.mag, ammo.reserve, weapons.def().name);
  hud.setHealth(body.health);
  hud.setMoney(state.money);
  hud.setTimer(state.phase === 'buy' ? state.buyTimer : state.timer, state.phase);
  hud.setScore(state.score.atk, state.score.def, state.round);
  hud.setSmokes(weapons.state.smokes);
  hud.syncKillfeed(state);
  if (state.bomb.planted) {
    hud.setBombStatus(`SPIKE PLANTED — SITE ${state.bomb.site} · ${Math.ceil(state.bomb.timer)}s${state.bomb.defuser ? ' · ' + state.bomb.defuser + ' DEFUSING' : ''}`, true);
  } else if (state.bomb.planting > 0) {
    hud.setBombStatus(`PLANTING… ${Math.round((state.bomb.planting / 3) * 100)}%`, false);
  } else if (state.phase === 'combat') {
    const site = rounds.plantSiteNearPlayer();
    hud.setBombStatus(site ? `HOLD E TO PLANT AT SITE ${site}` : 'PLANT AT SITE A OR B', false);
  } else {
    hud.setBombStatus('', false);
  }
  if (state.phase === 'buy') hud.updateBuyList(rounds.weaponList(), state.money);
  if (state.time - minimapAt > 0.1) {
    minimapAt = state.time;
    hud.drawMinimap(state, body.position, body.yaw, bots.bots);
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (!frozen) {
    const look = input.takeLook();
    player.look(look.x, look.y);
    if (started && state.phase === 'combat' && !body.dead) {
      if (input.state.firing && weapons.ready()) shoot(shot ? 0 : weapons.spread(player.groundSpeed()));
      if (!input.state.firing) weapons.releaseTrigger();
    }
    const pressed = input.takePressed();
    if (started) handlePressed(pressed);
    else input.clearPressed();
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) {
      step(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;
    syncCamera();
    syncHud();
  }
  renderer.render(scene, camera);
}

function settle(steps) {
  for (let index = 0; index < steps; index += 1) step(FIXED_STEP);
}

function runShot(name) {
  hud.hideOverlay();
  combat.reset();
  if (name === 'start') {
    body.position.set(0, 0, 11);
    body.yaw = 0;
    body.pitch = 0;
    settle(20);
    hud.showOverlay('start');
  } else if (name === 'buy') {
    state.phase = 'buy';
    state.buyTimer = 12;
    state.money = 3400;
    body.position.set(0, 0, 11);
    body.yaw = 0;
    // Stage the crew mid-lane, away from the camera, so the menu is readable.
    const stageSpots = [[-1.5, 5], [1.5, 3], [-3, 0], [2.5, 7]];
    for (let i = 0; i < 4; i += 1) {
      const ally = bots.bots[i];
      ally.pos.set(stageSpots[i][0], 0, stageSpots[i][1]);
      ally.mode = 'hold';
      ally.route = [];
    }
    for (let i = 0; i < 5; i += 1) {
      const def = bots.bots[4 + i];
      const hold = world.holds[i];
      def.pos.set(hold[0], 0, hold[1]);
      def.mode = 'hold';
      def.route = [];
    }
    settle(20);
    hud.showBuy(true);
    hud.updateBuyList(rounds.weaponList(), state.money);
  } else if (name === 'play') {
    state.phase = 'combat';
    state.round = 3;
    state.score.atk = 2;
    state.score.def = 1;
    state.money = 3200;
    state.timer = 96;
    weapons.buy('rifle', 99999);
    weapons.state.owned.add('rifle');
    weapons.select('rifle');
    weapons.refillMags();
    bots.spawnRound(3);
    // Stage a firefight: two defenders hold mid, one ally pushes with us.
    const def0 = bots.bots[4];
    const def1 = bots.bots[5];
    def0.pos.set(3.5, 0, -4.5);
    def0.mode = 'hold';
    def0.route = [];
    def1.pos.set(-4, 0, -7);
    def1.mode = 'hold';
    def1.route = [];
    const ally = bots.bots[0];
    ally.pos.set(-1.5, 0, 6);
    ally.mode = 'hold';
    ally.route = [];
    body.position.set(0.5, 0, 5);
    settle(30);
    // Four real rifle hits kill Rook (4 x 26 > 100), so the kill feed entry is
    // a genuine kill, not staged text. Then one hit on Nyx for the hitmarker.
    input.state.firing = true;
    for (let i = 0; i < 4; i += 1) {
      aimAt(new THREE.Vector3(def0.pos.x, 1.3, def0.pos.z));
      shoot(0);
      settle(8);
    }
    input.state.firing = false;
    settle(6);
    aimAt(new THREE.Vector3(def1.pos.x, 1.3, def1.pos.z));
    input.state.firing = true;
    shoot(0);
    input.state.firing = false;
    settle(1);
  } else if (name === 'end') {
    state.phase = 'roundEnd';
    state.round = 7;
    state.score.atk = 4;
    state.score.def = 3;
    state.money = 5100;
    state.timer = 4;
    body.position.set(-6, 0, -2);
    settle(20);
    aimAt(new THREE.Vector3(-13.5, 1.2, -9));
    hud.showRoundEnd('atk', 'Nightwatch eliminated', state.score);
  }
  syncCamera();
  syncHud();
  paintTwiceThenReady();
}

function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    syncCamera();
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
    }
  }
  requestAnimationFrame(paint);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

syncCamera();
syncHud();
if (shot) runShot(shot);
else {
  hud.showOverlay('start');
  requestAnimationFrame(frame);
}
