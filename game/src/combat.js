// Combat: one hitscan ray per shot, tracers from a reused pool, smoke that
// blocks sight. Damage goes through here for the player and for bots, so a
// kill is always one code path: raycast, headshot check, health, killfeed.
import * as THREE from 'three';

const TRACER_POOL = 24;
const SMOKE_RADIUS = 2.4;
const SMOKE_SECONDS = 12;

export function createCombat(scene, world) {
  const raycaster = new THREE.Raycaster();
  raycaster.far = 90;
  const direction = new THREE.Vector3();
  const origin = new THREE.Vector3();
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffd319, transparent: true, opacity: 0.9 });
  const tracers = [];
  let tracerIndex = 0;
  for (let i = 0; i < TRACER_POOL; i += 1) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const line = new THREE.Line(geo, tracerMat.clone());
    line.visible = false;
    line.userData.life = 0;
    scene.add(line);
    tracers.push(line);
  }
  const smokeGroup = new THREE.Group();
  scene.add(smokeGroup);
  const smokeMat = new THREE.MeshBasicMaterial({ color: 0x9aa3c0, transparent: true, opacity: 0.55, depthWrite: false });
  const smokes = [];

  function spawnTracer(from, to) {
    const line = tracers[tracerIndex];
    tracerIndex = (tracerIndex + 1) % TRACER_POOL;
    const pos = line.geometry.attributes.position;
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;
    line.visible = true;
    line.material.opacity = 0.9;
    line.userData.life = 0.09;
  }

  function stepTracers(dt) {
    for (const line of tracers) {
      if (!line.visible) continue;
      line.userData.life -= dt;
      if (line.userData.life <= 0) line.visible = false;
      else line.material.opacity = Math.max(0, line.userData.life / 0.09) * 0.9;
    }
  }

  // True when the segment from a to b passes through a live smoke cloud.
  function smokeBlocks(a, b) {
    for (const s of smokes) {
      const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
      const apx = s.pos.x - a.x, apy = s.pos.y - a.y, apz = s.pos.z - a.z;
      const lenSq = abx * abx + aby * aby + abz * abz || 1;
      let t = (apx * abx + apy * aby + apz * abz) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const dx = a.x + abx * t - s.pos.x;
      const dy = a.y + aby * t - s.pos.y;
      const dz = a.z + abz * t - s.pos.z;
      if (dx * dx + dy * dy + dz * dz < SMOKE_RADIUS * SMOKE_RADIUS) return true;
    }
    return false;
  }

  // Line of sight between two points, blocked by world geometry or smoke.
  function hasLineOfSight(a, b, extraShootables) {
    if (smokeBlocks(a, b)) return false;
    direction.subVectors(b, a);
    const dist = direction.length();
    if (dist < 0.01) return true;
    direction.normalize();
    origin.copy(a);
    raycaster.set(origin, direction);
    raycaster.far = dist;
    const hits = raycaster.intersectObjects(world.shootables, false);
    if (hits.length > 0) return false;
    if (extraShootables) {
      const hits2 = raycaster.intersectObjects(extraShootables, false);
      if (hits2.length > 0) return false;
    }
    return true;
  }

  // Fire one hitscan shot. from/to define the ray; targets are the bot hit
  // meshes. Returns {hit, bot, part, point} or null. onDamage is called by
  // the caller with the resolved damage.
  function fire(from, dir, range, shootables) {
    raycaster.set(from, dir);
    raycaster.far = range;
    const hits = raycaster.intersectObjects(shootables, false);
    if (hits.length === 0) {
      spawnTracer(from, new THREE.Vector3().copy(from).addScaledVector(dir, range));
      return null;
    }
    const hit = hits[0];
    spawnTracer(from, hit.point);
    return { hit, point: hit.point, object: hit.object };
  }

  function throwSmoke(from, dir, state, onLand) {
    // Smoke lands where the throw ray first hits the world, or 14 m out.
    raycaster.set(from, dir);
    raycaster.far = 16;
    const hits = raycaster.intersectObjects(world.shootables, false);
    const point = hits.length > 0 ? hits[0].point.clone() : new THREE.Vector3().copy(from).addScaledVector(dir, 14);
    point.y = Math.max(0.4, point.y);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(SMOKE_RADIUS, 16, 12), smokeMat.clone());
    mesh.position.copy(point);
    mesh.scale.y = 0.7;
    smokeGroup.add(mesh);
    const entry = { pos: point.clone(), mesh, until: state.time + SMOKE_SECONDS };
    smokes.push(entry);
    state.smoke.push(entry);
    if (onLand) onLand(point);
    return entry;
  }

  function step(dt, state) {
    stepTracers(dt);
    for (let i = smokes.length - 1; i >= 0; i -= 1) {
      const s = smokes[i];
      if (state.time >= s.until) {
        smokeGroup.remove(s.mesh);
        s.mesh.material.dispose();
        smokes.splice(i, 1);
        const idx = state.smoke.indexOf(s);
        if (idx >= 0) state.smoke.splice(idx, 1);
      } else {
        const remaining = s.until - state.time;
        s.mesh.material.opacity = remaining < 3 ? 0.55 * (remaining / 3) : 0.55;
      }
    }
  }

  function reset() {
    for (const s of smokes) {
      smokeGroup.remove(s.mesh);
      s.mesh.material.dispose();
    }
    smokes.length = 0;
    for (const line of tracers) line.visible = false;
  }

  return { fire, hasLineOfSight, smokeBlocks, throwSmoke, step, reset, smokes };
}
