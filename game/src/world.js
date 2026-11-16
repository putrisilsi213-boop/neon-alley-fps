// Neon Alley: a night market, 40 x 28 m, three lanes. Mid is the main street
// down the middle; west is a narrow back alley between stall rows; east is an
// elevated rooftop walkway with step ramps at both ends. Site A is the fruit
// stalls in the north-west, Site B the small stage in the north-east. Every
// solid box is a collider for the player and a surface a bullet stops on.
// Signs and lamps glow but do not collide.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const WALK_TOP = 3.2;
const WALK = { x0: 7, x1: 17, z0: -6, z1: 2 };

export function groundHeightAt(x, z) {
  if (x >= WALK.x0 && x <= WALK.x1 && z >= WALK.z0 && z <= WALK.z1) return WALK_TOP;
  if (x >= 10.5 && x <= 15.5 && z >= -11 && z <= -7) return 1.0; // stage
  return 0;
}

export function createWorld(scene, random) {
  const group = new THREE.Group();
  scene.add(group);

  const mat = {};
  for (const name of Object.keys(PALETTE)) {
    mat[name] = new THREE.MeshStandardMaterial({
      color: new THREE.Color(PALETTE[name]),
      roughness: name === 'asphalt' ? 0.35 : 0.9,
      metalness: name === 'asphalt' ? 0.55 : 0.05,
    });
  }
  const glow = (color, intensity) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color), toneMapped: false });
  const neonMat = {
    magenta: new THREE.MeshStandardMaterial({ color: 0x1a0512, emissive: new THREE.Color(PALETTE.magenta), emissiveIntensity: 2.4, roughness: 0.4 }),
    cyan: new THREE.MeshStandardMaterial({ color: 0x03181d, emissive: new THREE.Color(PALETTE.cyan), emissiveIntensity: 2.4, roughness: 0.4 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0x1d1503, emissive: new THREE.Color(PALETTE.yellow), emissiveIntensity: 2.2, roughness: 0.4 }),
    green: new THREE.MeshStandardMaterial({ color: 0x03170b, emissive: new THREE.Color(PALETTE.green), emissiveIntensity: 1.8, roughness: 0.4 }),
    orange: new THREE.MeshStandardMaterial({ color: 0x1d0d02, emissive: new THREE.Color(PALETTE.orange), emissiveIntensity: 2.0, roughness: 0.4 }),
  };

  const colliders = [];
  const shootables = [];

  function box(w, h, d, x, y, z, material, collide = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (collide) {
      colliders.push(new THREE.Box3().setFromObject(mesh));
      shootables.push(mesh);
    }
    return mesh;
  }

  function sign(w, h, x, y, z, ry, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    group.add(mesh);
    return mesh;
  }

  // Ground and perimeter walls (40 x 28, walls 5.5 high).
  box(40.4, 0.4, 28.4, 0, -0.2, 0, mat.asphalt);
  box(0.5, 5.5, 28.4, -20.2, 2.75, 0, mat.wall);
  box(0.5, 5.5, 28.4, 20.2, 2.75, 0, mat.wall);
  box(40.4, 5.5, 0.5, 0, 2.75, -14.2, mat.wall);
  box(40.4, 5.5, 0.5, 0, 2.75, 14.2, mat.wall);

  // Puddles: dark, almost-mirror strips that catch the neon.
  const puddleMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#0a1030'), roughness: 0.12, metalness: 0.75 });
  for (const [x, z, w, d] of [[-1.5, 2, 5, 2.2], [6, -3, 3.4, 1.8], [-9, -4, 4, 2], [11, 6, 4.4, 2]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), puddleMat);
    p.rotation.x = -Math.PI / 2;
    p.position.set(x, 0.02, z);
    group.add(p);
  }

  // Stall rows: west row (back alley wall) and east row, each a counter + awning.
  function stall(x, z, ry, accent) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.05, 1.1), mat.stallWood);
    counter.position.y = 0.52;
    const awning = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.1, 1.5), mat.stallCanvas);
    awning.position.y = 2.15;
    const pole1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 0.08), mat.concrete);
    pole1.position.set(-1.1, 1.1, 0.6);
    const pole2 = pole1.clone();
    pole2.position.x = 1.1;
    const strip = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, 0.06), neonMat[accent]);
    strip.position.set(0, 1.9, 0.58);
    g.add(counter, awning, pole1, pole2, strip);
    g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    group.add(g);
    const c = new THREE.Box3().setFromObject(counter);
    colliders.push(c);
    shootables.push(counter);
    return g;
  }
  // West stall row (back alley runs between x=-10.5 and x=-6.5).
  stall(-12.5, 8, 0, 'magenta');
  stall(-12.5, 3, 0, 'cyan');
  stall(-12.5, -2, 0, 'yellow');
  stall(-12.5, -6.5, 0, 'magenta');
  // East stall row.
  stall(12.5, 8, Math.PI, 'cyan');
  stall(12.5, 3, Math.PI, 'yellow');
  stall(-17.5, 10.5, Math.PI / 2, 'orange');
  stall(17.5, 10.5, -Math.PI / 2, 'green');

  // Site A: fruit stalls — low counters with bright produce crates.
  const fruitColors = [PALETTE.orange, PALETTE.green, PALETTE.yellow, PALETTE.red];
  for (let i = 0; i < 4; i += 1) {
    const fx = -16 + (i % 2) * 3.4;
    const fz = -11 + Math.floor(i / 2) * 3.2;
    box(2.6, 0.95, 1.4, fx, 0.48, fz, mat.stallWood);
    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.35, 1.0),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(fruitColors[i]), roughness: 0.55 }),
    );
    crate.position.set(fx, 1.12, fz);
    crate.castShadow = true;
    group.add(crate);
    shootables.push(crate);
  }
  box(1.1, 1.1, 1.1, -10.2, 0.55, -11.5, mat.concrete);
  box(1.1, 1.1, 1.1, -16.5, 0.55, -6.2, mat.concrete);

  // Site B: small stage — a 5 x 4 platform, 1 m high, with steps and a backdrop.
  box(5, 1.0, 4, 13, 0.5, -9, mat.concrete);
  box(1.6, 0.33, 1.2, 13, 0.17, -6.4, mat.concrete);
  box(1.6, 0.66, 1.2, 13, 0.33, -7.2, mat.concrete);
  box(5, 2.2, 0.3, 13, 2.1, -11.2, mat.wall);
  sign(4.2, 0.9, 13, 3.4, -11.0, 0, neonMat.magenta);
  sign(1.4, 0.9, 10.2, 2.6, -9, Math.PI / 2, neonMat.cyan);
  sign(1.4, 0.9, 15.8, 2.6, -9, -Math.PI / 2, neonMat.cyan);

  // Rooftop walkway (east): platform + parapet + step ramps at both ends.
  box(10, 0.35, 8, 12, WALK_TOP - 0.17, -2, mat.concrete);
  box(10, 0.9, 0.25, 12, WALK_TOP + 0.45, -6.1, mat.wall);
  box(0.25, 0.9, 8, 17.1, WALK_TOP + 0.45, -2, mat.wall);
  box(10, 0.25, 0.25, 12, WALK_TOP + 0.1, 2.1, mat.wall);
  for (let i = 0; i < 4; i += 1) {
    const h = 0.8 * (i + 1);
    box(2.2, h, 0.9, 12, h / 2, 2.6 + i * 0.9, mat.concrete);
    box(2.2, h, 0.9, 12, h / 2, -6.6 - i * 0.9, mat.concrete);
  }

  // Mid cover: crates, a noodle cart, a low wall — sightline breakers on main street.
  box(1.3, 1.3, 1.3, -2.2, 0.65, 3.5, mat.stallWood);
  box(1.3, 1.3, 1.3, 2.4, 0.65, -0.5, mat.stallWood);
  box(2.6, 1.0, 1.2, 0, 0.5, -5.5, mat.stallWood);
  box(1.1, 1.1, 1.1, -5.2, 0.55, -7.5, mat.concrete);
  box(1.1, 1.1, 1.1, 5.4, 0.55, 6.5, mat.concrete);
  box(3.4, 1.15, 0.5, -8, 0.57, 0.5, mat.wall);
  box(0.5, 1.15, 3.4, 8.5, 0.57, -8.5, mat.wall);

  // Neon signage on the perimeter walls.
  sign(5, 1.1, -10, 3.6, -13.9, 0, neonMat.magenta);
  sign(3.6, 1.0, 4, 3.8, -13.9, 0, neonMat.cyan);
  sign(4.4, 1.0, 14, 3.6, -13.9, 0, neonMat.yellow);
  sign(3.2, 0.9, -19.9, 3.4, 0, Math.PI / 2, neonMat.cyan);
  sign(3.2, 0.9, 19.9, 3.4, 0, -Math.PI / 2, neonMat.magenta);
  sign(6, 1.2, 0, 4.0, 13.9, Math.PI, neonMat.yellow);

  // Hanging lamps: poles with warm glowing bulbs over mid and the alleys.
  const lampPositions = [[-1.5, 6], [1.5, -2], [-8, 1], [12, -2], [-13, -8], [13, -5], [0, 10]];
  for (const [lx, lz] of lampPositions) {
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.4, 0.12), mat.concrete);
    pole.position.set(lx, 1.7, lz);
    pole.castShadow = true;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), neonMat.yellow);
    bulb.position.set(lx, 3.5, lz);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.22, 12, 1, true), mat.stallCanvas);
    shade.position.set(lx, 3.68, lz);
    group.add(pole, bulb, shade);
  }

  // Lighting: moonlight key, dim blue hemisphere, neon point lights.
  const sky = new THREE.HemisphereLight(new THREE.Color('#2a3560'), new THREE.Color('#05070f'), 1.05);
  scene.add(sky);
  const moon = new THREE.DirectionalLight(new THREE.Color('#9fb4ff'), 0.85);
  moon.position.set(10, 18, 8);
  moon.target.position.set(0, 0, -2);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -24;
  moon.shadow.camera.right = 24;
  moon.shadow.camera.top = 24;
  moon.shadow.camera.bottom = -24;
  moon.shadow.camera.far = 60;
  moon.shadow.bias = -0.0006;
  scene.add(moon, moon.target);
  const neonLights = [
    [new THREE.Color(PALETTE.magenta), -10, 3.4, -12.5, 14],
    [new THREE.Color(PALETTE.cyan), 4, 3.6, -12.5, 12],
    [new THREE.Color(PALETTE.yellow), 13, 3.2, -9, 12],
    [new THREE.Color(PALETTE.magenta), 0, 3.6, 12.5, 12],
    [new THREE.Color(PALETTE.cyan), -8, 3.2, 1, 10],
    [new THREE.Color(PALETTE.yellow), 12, 3.4, -2, 10],
  ];
  for (const [color, x, y, z, intensity] of neonLights) {
    const light = new THREE.PointLight(color, intensity, 16, 1.6);
    light.position.set(x, y, z);
    scene.add(light);
  }

  // Bomb sites, spawns and bot lanes.
  const sites = {
    A: { pos: new THREE.Vector3(-13.5, 0, -9), radius: 3.6 },
    B: { pos: new THREE.Vector3(13, 0, -9), radius: 3.6 },
  };
  const spawnAtk = [
    new THREE.Vector3(-4, 0, 11.5),
    new THREE.Vector3(-1.5, 0, 12),
    new THREE.Vector3(1, 0, 11.5),
    new THREE.Vector3(3.5, 0, 12),
    new THREE.Vector3(0, 0, 9.5),
  ];
  const spawnDef = [
    new THREE.Vector3(-13, 0, -11.5),
    new THREE.Vector3(-9, 0, -11),
    new THREE.Vector3(0, 0, -12),
    new THREE.Vector3(9, 0, -11),
    new THREE.Vector3(13, 0, -11.5),
  ];
  const lanes = {
    // Each lane is a list of waypoints from the attacker spawn to a site.
    midA: [[0, 8], [0, 3], [-1, -2], [-4, -6], [-9, -8], [-13, -9]],
    midB: [[0, 8], [0, 3], [1, -2], [4, -6], [9, -8], [13, -9]],
    westA: [[-4, 11], [-8, 8], [-8, 3], [-8, -3], [-9, -7], [-12, -9]],
    eastB: [[4, 11], [8, 8], [8, 4], [9, -1], [10, -5], [13, -8]],
    roofB: [[4, 11], [8, 7], [12, 4.4], [12, 1], [12, -3], [12, -6], [13, -8]],
    roofA: [[4, 11], [8, 7], [12, 4.4], [12, 1], [12, -3], [8, -6], [2, -8], [-6, -9], [-12, -9]],
  };
  // Hold spots defenders sit on: [x, z, yaw facing].
  const holds = [
    [-11, -7.5, 2.6], [-15.5, -7, 2.2], [-6, -10.5, 3.1],
    [11, -6.5, -2.6], [15.5, -7, -2.2], [6, -10.5, -3.1],
    [0, -10, Math.PI], [-3, -4, 2.8], [3, -4, -2.8], [12, 0, -2.4],
  ];

  return { colliders, shootables, group, sites, spawnAtk, spawnDef, lanes, holds, walkTop: WALK_TOP };
}
