// Bots: 5v5, one class for both crews. A bot routes along a lane, holds a
// spot, engages what it can see, and reacts to what it hears. Defenders
// converge on a planted bomb and defuse it; attackers push the sites. Skill
// (reaction time and hit chance) rises every round, so later rounds get
// harder. Bots never allocate in the hot loop: one probe box, reused vectors.
import * as THREE from 'three';
import { ALLY_NAMES, ENEMY_NAMES, TEAMS } from './agent.js';
import { groundHeightAt } from './world.js';

const BOT_HEALTH = 100;
const BOT_SPEED = 3.4;
const ENGAGE_RANGE = 46;
const HEAR_RADIUS = 26;
const DEFUSE_SECONDS = 5;
const RADIUS = 0.4;

export function createBots(scene, world, combat, state, random) {
  const bots = [];
  const probe = new THREE.Box3();
  const tmp = new THREE.Vector3();
  const tmpEye = new THREE.Vector3();
  const tmpTarget = new THREE.Vector3();
  let idCounter = 0;

  const allyMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#12303a'), roughness: 0.7 });
  const enemyMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#3a1224'), roughness: 0.7 });
  const allyTrim = new THREE.MeshStandardMaterial({ color: new THREE.Color('#0a2a33'), emissive: new THREE.Color('#22e6ff'), emissiveIntensity: 1.6 });
  const enemyTrim = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2a0a18'), emissive: new THREE.Color('#ff2d95'), emissiveIntensity: 1.6 });
  const headMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#c9a582'), roughness: 0.7 });
  const gunMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#12141c'), roughness: 0.6, metalness: 0.3 });

  function buildMesh(team) {
    const g = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.78, 0.32), team === 'atk' ? allyMat : enemyMat);
    torso.position.y = 1.02;
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.1, 0.34), team === 'atk' ? allyTrim : enemyTrim);
    trim.position.y = 1.32;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), headMat);
    head.position.y = 1.56;
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.26), gunMat);
    legs.position.y = 0.31;
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.62), gunMat);
    gun.position.set(0.2, 1.12, -0.28);
    g.add(torso, trim, head, legs, gun);
    g.traverse((m) => { if (m.isMesh) { m.castShadow = true; } });
    scene.add(g);
    return { group: g, torso, head };
  }

  function makeBot(team, name, spawn, lane, holdSpot) {
    const mesh = buildMesh(team);
    const bot = {
      id: idCounter,
      name,
      team,
      pos: spawn.clone(),
      yaw: team === 'atk' ? Math.PI : 0,
      health: BOT_HEALTH,
      alive: true,
      skill: 0.5,
      weapon: 'rifle',
      route: lane ? lane.map(([x, z]) => new THREE.Vector3(x, groundHeightAt(x, z), z)) : [],
      routeIndex: 0,
      holdSpot,
      mode: lane ? 'route' : 'hold',
      target: null,
      targetIsPlayer: false,
      reactionAt: 0,
      nextShotAt: 0,
      burstLeft: 0,
      decideAt: 0,
      heardAt: -99,
      heardPos: new THREE.Vector3(),
      lastSeen: new THREE.Vector3(),
      lastSeenAt: -99,
      defuseProgress: 0,
      fall: 0,
      strafeDir: 1,
      strafeAt: 0,
      mesh,
      eyeY: 1.5,
    };
    mesh.torso.userData.bot = bot;
    mesh.torso.userData.part = 'torso';
    mesh.head.userData.bot = bot;
    mesh.head.userData.part = 'head';
    idCounter += 1;
    bots.push(bot);
    return bot;
  }

  function eyeOf(bot) {
    return tmpEye.set(bot.pos.x, bot.pos.y + bot.eyeY, bot.pos.z);
  }

  function pushOut(bot) {
    probe.min.set(bot.pos.x - RADIUS, bot.pos.y + 0.05, bot.pos.z - RADIUS);
    probe.max.set(bot.pos.x + RADIUS, bot.pos.y + 1.7, bot.pos.z + RADIUS);
    for (const c of world.colliders) {
      if (!probe.intersectsBox(c)) continue;
      const dxl = bot.pos.x - (c.min.x - RADIUS);
      const dxr = (c.max.x + RADIUS) - bot.pos.x;
      const dzl = bot.pos.z - (c.min.z - RADIUS);
      const dzr = (c.max.z + RADIUS) - bot.pos.z;
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) bot.pos.x = c.min.x - RADIUS;
      else if (m === dxr) bot.pos.x = c.max.x + RADIUS;
      else if (m === dzl) bot.pos.z = c.min.z - RADIUS;
      else bot.pos.z = c.max.z + RADIUS;
      break;
    }
    bot.pos.x = Math.max(-19.4, Math.min(19.4, bot.pos.x));
    bot.pos.z = Math.max(-13.4, Math.min(13.4, bot.pos.z));
  }

  function moveToward(bot, dest, dt, speed) {
    tmp.subVectors(dest, bot.pos);
    tmp.y = 0;
    const dist = tmp.length();
    if (dist < 0.05) return true;
    tmp.normalize();
    bot.pos.x += tmp.x * speed * dt;
    bot.pos.z += tmp.z * speed * dt;
    const targetYaw = Math.atan2(-tmp.x, -tmp.z);
    let dy = targetYaw - bot.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    bot.yaw += dy * Math.min(1, dt * 8);
    const ground = groundHeightAt(bot.pos.x, bot.pos.z);
    const wantY = dest.y > 0.5 ? dest.y : ground;
    bot.pos.y += (wantY - bot.pos.y) * Math.min(1, dt * 10);
    pushOut(bot);
    return dist < 0.4;
  }

  function visibleEnemy(bot, ctx) {
    // Returns the nearest visible opposing unit, or null.
    let best = null;
    let bestDist = Infinity;
    const eye = eyeOf(bot).clone();
    const check = (pos, isPlayer, ref) => {
      tmpTarget.copy(pos);
      const dist = eye.distanceTo(tmpTarget);
      if (dist > ENGAGE_RANGE || dist >= bestDist) return;
      // Must be roughly in front, unless it just shot at us.
      const dx = tmpTarget.x - bot.pos.x;
      const dz = tmpTarget.z - bot.pos.z;
      const fx = -Math.sin(bot.yaw);
      const fz = -Math.cos(bot.yaw);
      const dot = (dx * fx + dz * fz) / (Math.hypot(dx, dz) || 1);
      if (dot < 0.15 && state.time - bot.heardAt > 1.5) return;
      tmpTarget.y = pos.y + 1.35;
      if (!combat.hasLineOfSight(eye, tmpTarget)) return;
      best = { ref, isPlayer, dist, pos: pos.clone() };
      bestDist = dist;
    };
    if (bot.team === 'def' && ctx.playerAlive) check(ctx.playerPos, true, null);
    for (const other of bots) {
      if (!other.alive || other.team === bot.team) continue;
      check(other.pos, false, other);
    }
    return best;
  }

  function botDamage() {
    return 22;
  }

  function fireAt(bot, ctx, targetPos, isPlayer) {
    // One burst shot with a hit chance from skill, range and target motion.
    const eye = eyeOf(bot).clone();
    const dist = eye.distanceTo(targetPos);
    const muzzle = new THREE.Vector3(bot.pos.x + Math.sin(bot.yaw) * -0.2, bot.pos.y + 1.2, bot.pos.z + Math.cos(bot.yaw) * -0.2);
    let chance = bot.skill * 0.62 * Math.max(0.25, 1 - dist / 70);
    if (isPlayer && ctx.playerMoving) chance *= 0.75;
    if (isPlayer && ctx.playerCrouching) chance *= 0.8;
    const hit = random() < chance;
    const aim = targetPos.clone();
    aim.y += 1.2 + (random() * 2 - 1) * 0.35;
    if (!hit) {
      aim.x += (random() * 2 - 1) * 1.2;
      aim.y += (random() * 2 - 1) * 0.9;
      aim.z += (random() * 2 - 1) * 1.2;
    }
    combat.fire(muzzle, aim.clone().sub(muzzle).normalize(), 60, world.shootables.concat(ctx.hitMeshes));
    if (ctx.onBotShot) ctx.onBotShot(bot, aim);
    if (hit) {
      const head = random() < 0.12;
      const dmg = botDamage() * (head ? 2 : 1);
      if (isPlayer) ctx.onPlayerDamage(dmg, bot.name);
      else ctx.onBotDamage(bot.target, dmg, bot.name, head);
    }
  }

  function decide(bot, ctx) {
    const now = state.time;
    if (!bot.alive) return;
    // Bomb planted: defenders converge and defuse.
    if (state.bomb.planted && bot.team === 'def') {
      const bp = state.bomb.pos;
      const d = bot.pos.distanceTo(bp);
      if (d < 2.2) {
        bot.mode = 'defuse';
        return;
      }
      bot.mode = 'toBomb';
      bot.route = [new THREE.Vector3(bp.x, bp.y, bp.z)];
      bot.routeIndex = 0;
      return;
    }
    const seen = visibleEnemy(bot, ctx);
    if (seen) {
      bot.target = seen.ref;
      bot.targetIsPlayer = seen.isPlayer;
      bot.lastSeen.copy(seen.pos);
      bot.lastSeenAt = now;
      if (bot.mode !== 'engage') {
        bot.mode = 'engage';
        bot.reactionAt = now + 0.35 + (1 - bot.skill) * 0.55 + seen.dist * 0.004;
        bot.burstLeft = 0;
      }
      return;
    }
    if (bot.mode === 'engage') {
      // Lost sight: hold the last seen spot briefly, then resume the route.
      if (now - bot.lastSeenAt > 2.5) {
        bot.mode = bot.route.length > 0 && bot.routeIndex < bot.route.length ? 'route' : 'hold';
        bot.target = null;
      }
      return;
    }
    if (bot.mode === 'defuse' || bot.mode === 'toBomb') return;
    if (now - bot.heardAt < 2 && bot.mode !== 'investigate') {
      bot.mode = 'investigate';
      bot.route = [bot.heardPos.clone()];
      bot.routeIndex = 0;
      return;
    }
    if (bot.mode === 'investigate' && bot.routeIndex >= bot.route.length) {
      bot.mode = 'hold';
    }
  }

  function stepBot(bot, dt, ctx) {
    const now = state.time;
    if (!bot.alive) {
      if (bot.fall < 1) {
        bot.fall = Math.min(1, bot.fall + dt / 0.4);
        bot.mesh.group.rotation.x = -bot.fall * 1.45;
      }
      return;
    }
    if (now >= bot.decideAt) {
      bot.decideAt = now + 0.12;
      decide(bot, ctx);
    }
    const m = bot.mesh.group;
    if (bot.mode === 'route' || bot.mode === 'toBomb' || bot.mode === 'investigate') {
      const dest = bot.route[bot.routeIndex];
      if (dest) {
        const arrived = moveToward(bot, dest, dt, BOT_SPEED);
        if (arrived) bot.routeIndex += 1;
        if (bot.routeIndex >= bot.route.length) {
          bot.mode = bot.mode === 'toBomb' ? 'toBomb' : 'hold';
          if (bot.mode === 'hold' && bot.holdSpot) {
            bot.yaw = bot.holdSpot[2];
          }
        }
      } else {
        bot.mode = 'hold';
      }
    } else if (bot.mode === 'hold') {
      // Scan: slow yaw sweep across the lane.
      bot.yaw += Math.sin(now * 0.5 + bot.id) * dt * 0.25;
    } else if (bot.mode === 'engage' && bot.target !== null) {
      const tp = bot.targetIsPlayer ? ctx.playerPos : bot.target.pos;
      const dx = tp.x - bot.pos.x;
      const dz = tp.z - bot.pos.z;
      bot.yaw = Math.atan2(-dx, -dz);
      // Strafe sideways while shooting, changing direction every couple seconds.
      if (now >= bot.strafeAt) {
        bot.strafeAt = now + 1.2 + random() * 1.4;
        bot.strafeDir = random() < 0.5 ? -1 : 1;
      }
      const sx = Math.cos(bot.yaw) * bot.strafeDir;
      const sz = -Math.sin(bot.yaw) * bot.strafeDir;
      bot.pos.x += sx * 1.1 * dt;
      bot.pos.z += sz * 1.1 * dt;
      pushOut(bot);
      if (now >= bot.reactionAt && now >= bot.nextShotAt) {
        if (bot.burstLeft <= 0) bot.burstLeft = 3 + Math.floor(random() * 3);
        bot.burstLeft -= 1;
        const aimPos = tp.clone();
        fireAt(bot, ctx, aimPos, bot.targetIsPlayer);
        bot.nextShotAt = now + (bot.burstLeft > 0 ? 0.11 : 0.7 + random() * 0.5);
      }
    } else if (bot.mode === 'defuse') {
      const bp = state.bomb.pos;
      const dx = bp.x - bot.pos.x;
      const dz = bp.z - bot.pos.z;
      bot.yaw = Math.atan2(-dx, -dz);
      state.bomb.defuse += dt;
      state.bomb.defuser = bot.name;
      if (Math.floor(state.bomb.defuse * 2) !== Math.floor((state.bomb.defuse - dt) * 2) && ctx.onDefuseTick) ctx.onDefuseTick();
      if (state.bomb.defuse >= DEFUSE_SECONDS && ctx.onDefused) ctx.onDefused(bot.name);
    }
    m.position.copy(bot.pos);
    m.rotation.y = bot.yaw;
    m.rotation.x = 0;
  }

  function spawnRound(round) {
    const enemySkill = Math.min(0.8, 0.42 + round * 0.035);
    const lanes = [world.lanes.midA, world.lanes.westA, world.lanes.midB, world.lanes.eastB];
    for (let i = 0; i < 4; i += 1) {
      const bot = bots[i];
      bot.pos.copy(world.spawnAtk[i + 1]);
      bot.pos.y = 0;
      bot.health = BOT_HEALTH;
      bot.alive = true;
      bot.fall = 0;
      bot.skill = 0.5;
      bot.weapon = i === 3 ? 'smg' : 'rifle';
      bot.route = lanes[i].map(([x, z]) => new THREE.Vector3(x, groundHeightAt(x, z), z));
      bot.routeIndex = 0;
      bot.mode = 'route';
      bot.target = null;
      bot.defuseProgress = 0;
      bot.mesh.group.rotation.set(0, bot.yaw, 0);
      bot.mesh.group.visible = true;
    }
    for (let i = 0; i < 5; i += 1) {
      const bot = bots[4 + i];
      bot.pos.copy(world.spawnDef[i]);
      bot.pos.y = 0;
      bot.health = BOT_HEALTH;
      bot.alive = true;
      bot.fall = 0;
      bot.skill = enemySkill;
      bot.weapon = i === 2 ? 'sniper' : i === 4 ? 'smg' : 'rifle';
      const hold = world.holds[i];
      bot.holdSpot = hold;
      bot.route = [new THREE.Vector3(hold[0], 0, hold[1])];
      bot.routeIndex = 0;
      bot.mode = 'route';
      bot.target = null;
      bot.defuseProgress = 0;
      bot.mesh.group.rotation.set(0, bot.yaw, 0);
      bot.mesh.group.visible = true;
    }
  }

  // First build: 4 allies, 5 enemies.
  const allyLanes = [world.lanes.midA, world.lanes.westA, world.lanes.midB, world.lanes.eastB];
  for (let i = 0; i < 4; i += 1) makeBot('atk', ALLY_NAMES[i], world.spawnAtk[i + 1], allyLanes[i], null);
  for (let i = 0; i < 5; i += 1) makeBot('def', ENEMY_NAMES[i], world.spawnDef[i], null, world.holds[i]);

  return {
    bots,
    spawnRound,
    step(dt, ctx) {
      for (const bot of bots) stepBot(bot, dt, ctx);
    },
    hitMeshes() {
      const out = [];
      for (const bot of bots) {
        if (!bot.alive) continue;
        out.push(bot.mesh.torso, bot.mesh.head);
      }
      return out;
    },
    aliveCount(team) {
      let n = 0;
      for (const bot of bots) if (bot.alive && bot.team === team) n += 1;
      return n;
    },
    hearShot(pos) {
      for (const bot of bots) {
        if (!bot.alive) continue;
        if (bot.pos.distanceTo(pos) < HEAR_RADIUS) {
          bot.heardAt = state.time;
          bot.heardPos.copy(pos);
        }
      }
    },
    damage(bot, amount) {
      if (!bot.alive) return false;
      bot.health -= amount;
      if (bot.health > 0) return false;
      bot.alive = false;
      bot.fall = 0;
      bot.mode = 'dead';
      return true;
    },
    reset() {
      for (const bot of bots) {
        bot.alive = true;
        bot.health = BOT_HEALTH;
        bot.fall = 0;
        bot.mesh.group.rotation.set(0, 0, 0);
        bot.mesh.group.visible = true;
      }
    },
    teams: TEAMS,
  };
}
