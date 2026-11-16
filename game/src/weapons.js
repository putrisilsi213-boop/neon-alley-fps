// The arsenal: four hitscan weapons plus a smoke grenade. Each weapon owns
// its numbers (damage, headshot multiplier, magazine, fire rate, reload,
// spread, price) and its view model; main.js owns the ray and combat.js the
// damage. Spread grows with movement speed, so stopping to aim pays.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const WEAPONS = {
  pistol: {
    id: 'pistol', name: 'Krait P9', kind: 'pistol', price: 0,
    damage: 20, headMult: 2.0, mag: 12, reserve: 48,
    fireGap: 0.19, auto: false, reloadTime: 1.4,
    spreadStill: 0.0035, spreadMove: 0.02, range: 45,
  },
  smg: {
    id: 'smg', name: 'Hornet-9 SMG', kind: 'smg', price: 1500,
    damage: 15, headMult: 2.0, mag: 30, reserve: 90,
    fireGap: 0.075, auto: true, reloadTime: 1.8,
    spreadStill: 0.005, spreadMove: 0.03, range: 38,
  },
  rifle: {
    id: 'rifle', name: 'Vandal VK-7', kind: 'rifle', price: 2700,
    damage: 26, headMult: 2.5, mag: 25, reserve: 75,
    fireGap: 0.11, auto: true, reloadTime: 2.0,
    spreadStill: 0.0028, spreadMove: 0.026, range: 60,
  },
  sniper: {
    id: 'sniper', name: 'Longshot-50', kind: 'sniper', price: 4750,
    damage: 85, headMult: 2.0, mag: 5, reserve: 15,
    fireGap: 1.15, auto: false, reloadTime: 2.6,
    spreadStill: 0.0008, spreadMove: 0.05, range: 80,
  },
};

export const SMOKE_PRICE = 300;
export const WEAPON_ORDER = ['pistol', 'smg', 'rifle', 'sniper'];

export function createWeapons(camera) {
  const bodyMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.45, metalness: 0.4 });
  const darkMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#12141c'), roughness: 0.65, metalness: 0.25 });

  // One view model per weapon, built from boxes; only the current one is shown.
  const models = {};
  function buildModel(def) {
    const g = new THREE.Group();
    const len = def.kind === 'sniper' ? 0.62 : def.kind === 'rifle' ? 0.5 : def.kind === 'smg' ? 0.4 : 0.28;
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.1, len), bodyMat);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, len * 0.55), darkMat);
    barrel.position.set(0, 0.03, -len * 0.7);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.09), darkMat);
    grip.position.set(0, -0.11, 0.08);
    g.add(receiver, barrel, grip);
    if (def.kind === 'sniper') {
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 10), darkMat);
      scope.rotation.x = Math.PI / 2;
      scope.position.set(0, 0.09, -0.05);
      g.add(scope);
    }
    if (def.kind === 'smg' || def.kind === 'rifle') {
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.07), darkMat);
      mag.position.set(0, -0.14, -0.05);
      g.add(mag);
    }
    g.scale.setScalar(0.85);
    g.position.set(0.25, -0.23, -0.48);
    g.visible = false;
    camera.add(g);
    return g;
  }
  for (const id of WEAPON_ORDER) models[id] = buildModel(WEAPONS[id]);

  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.26),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.yellow), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.set(0.25, -0.21, -0.98);
  flash.visible = false;
  camera.add(flash);
  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.yellow), 0, 6);
  flashLight.position.set(0.24, -0.16, -0.6);
  camera.add(flashLight);

  const ammo = {};
  for (const id of WEAPON_ORDER) {
    ammo[id] = { mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve };
  }
  const state = {
    current: 'pistol',
    owned: new Set(['pistol']),
    smokes: 0,
    cooldown: 0,
    reloadLeft: 0,
    flash: 0,
    kick: 0,
    semiLatch: false,
  };
  models.pistol.visible = true;

  function def() { return WEAPONS[state.current]; }
  function currentAmmo() { return ammo[state.current]; }

  function step(dt) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flash = Math.max(0, state.flash - dt);
    state.kick += (0 - state.kick) * Math.min(1, dt * 14);
    const model = models[state.current];
    model.position.z = -0.48 + state.kick;
    model.rotation.x = state.kick * 2.4;
    flash.visible = state.flash > 0;
    flash.rotation.z = state.flash * 28;
    flashLight.intensity = state.flash > 0 ? 16 : 0;
    if (state.reloadLeft > 0) {
      state.reloadLeft = Math.max(0, state.reloadLeft - dt);
      model.rotation.x = -0.55 * Math.min(1, (def().reloadTime - state.reloadLeft) * 2);
      if (state.reloadLeft === 0) {
        const a = currentAmmo();
        const need = def().mag - a.mag;
        const take = Math.min(need, a.reserve);
        a.mag += take;
        a.reserve -= take;
      }
    }
  }

  return {
    state,
    def,
    ammo,
    currentAmmo,
    models,
    step,
    ready() {
      const a = currentAmmo();
      return a.mag > 0 && state.cooldown === 0 && state.reloadLeft === 0;
    },
    // Returns true when a round actually left the barrel. Semi-auto weapons
    // need the trigger released between shots (semiLatch).
    takeRound(firing) {
      const d = def();
      if (!d.auto) {
        if (!firing || state.semiLatch) return false;
        state.semiLatch = true;
      }
      const a = currentAmmo();
      if (a.mag <= 0) return false;
      a.mag -= 1;
      return true;
    },
    releaseTrigger() { state.semiLatch = false; },
    pullTrigger() {
      state.cooldown = def().fireGap;
      state.flash = 0.06;
      state.kick = def().kind === 'sniper' ? 0.11 : 0.055;
    },
    reload() {
      const d = def();
      const a = currentAmmo();
      if (state.reloadLeft > 0 || a.mag === d.mag || a.reserve === 0) return false;
      state.reloadLeft = d.reloadTime;
      return true;
    },
    spread(speed, moveRef = 5.4) {
      const d = def();
      return d.spreadStill + Math.min(1, speed / moveRef) * d.spreadMove;
    },
    select(id) {
      if (!state.owned.has(id) || state.current === id) return false;
      models[state.current].visible = false;
      state.current = id;
      models[id].visible = true;
      state.cooldown = 0.25;
      state.reloadLeft = 0;
      state.flash = 0;
      return true;
    },
    buy(id, money) {
      const d = WEAPONS[id];
      if (!d || state.owned.has(id) || money < d.price) return null;
      state.owned.add(id);
      ammo[id] = { mag: d.mag, reserve: d.reserve };
      this.select(id);
      return d.price;
    },
    buySmoke(money) {
      if (money < SMOKE_PRICE) return null;
      state.smokes += 1;
      return SMOKE_PRICE;
    },
    refillMags() {
      for (const id of WEAPON_ORDER) {
        if (!state.owned.has(id)) continue;
        ammo[id].mag = WEAPONS[id].mag;
        ammo[id].reserve = WEAPONS[id].reserve;
      }
      state.reloadLeft = 0;
      state.cooldown = 0;
    },
  };
}
