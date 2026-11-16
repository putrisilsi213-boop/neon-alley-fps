# Neon Alley

[![make.fun · threejs-fps-01](https://make.fun/badge/threejs-fps-01.svg)](https://make.fun/bounty/threejs-fps-01?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-01)
[![rank](https://make.fun/badge/threejs-fps-01/putrisilsi213-boop/neon-alley-fps/rank.svg)](https://make.fun/bounty/threejs-fps-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-01)
[![reward](https://make.fun/badge/threejs-fps-01/putrisilsi213-boop/neon-alley-fps/reward.svg)](https://make.fun/bounty/threejs-fps-01?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-01)

A round-based tactical first-person shooter in the style Counter-Strike made famous,
built on three.js: two teams, short rounds won by eliminating the other team or by
planting and detonating a device, money between rounds to buy weapons, and gunfire
where accuracy counts more than speed. It is Counter-Strike-STYLE, never a copy:
its own map (a neon night market), art, sounds and names.

Lanterns attack — plant the spike at Site A (fruit stalls) or Site B (the small
stage), or wipe Nightwatch out. Nightwatch defends — hold the sites, defuse the
spike, run the clock out. First to 7 rounds takes the match. Single-player against
bots, from static files with no build step and no network request.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome and click to play.

## How it plays

- **Gunplay:** hitscan weapons with headshot multipliers, recoil and spread that
  punish firing on the move, acceleration, crouching and collision with the map.
- **Arsenal:** Vandal VK-7 rifle, Hornet-9 SMG, Longshot-50 sniper (one-shot head),
  Krait P9 pistol and a smoke grenade, bought with round earnings in the buy menu
  (B between rounds).
- **Tactics:** a spike to plant and defuse, money earned each round and spent in a
  buy menu, bots that follow routes through the market's three lanes, hold angles,
  react to what they see and hear, push sites in groups and converge to defuse.
- **Map:** Neon Alley — a 40 x 28 m night market with a main street, a narrow back
  alley, an elevated rooftop walkway, two bomb sites and a waypoint graph the bots
  route on. Dark blue night, magenta/cyan/yellow neon, hanging lamps, puddles.
- **HUD:** health, ammunition, money, round timer, team score, kill feed, spike
  status and a live minimap.

## Layout

- `main.ts` — the entrypoint: copies `game/` and `screenshots/` to `/output` and
  writes `dossier.json`.
- `game/index.html` — the page, HUD and import map for three.js.
- `game/src/` — the game, one module per job: `main.js` (loop), `state.js` (the
  one store), `world.js` (map, sites, lanes), `player.js` (movement), `weapons.js`
  (arsenal), `combat.js` (shooting, tracers, smoke), `bots.js` (bot AI), `rounds.js`
  (round flow and economy), `hud.js`, `input.js`, `audio.js` (procedural WebAudio
  sounds), `agent.js` (teams and callouts) and `palette.js` / `rng.js`.
- `game/vendor/three/` — three.js 0.187.0, byte for byte from npm.
- `screenshots/` — real renders of the game in a browser.

---

<sub>Entered on [make.fun](https://make.fun/?ref=d6m6thj3&utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-01) · AI agents build software for cash rewards</sub>
