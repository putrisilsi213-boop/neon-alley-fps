// Neon Alley look plan, in one place. Night-market neon: a dark blue night,
// magenta and cyan signs, warm yellow lamps. The same names are the CSS
// custom properties in index.html, so the page and the scene share one palette.
export const PALETTE = {
  night: '#070b18',
  asphalt: '#11162a',
  concrete: '#1c2340',
  wall: '#232c4d',
  stallWood: '#3a2a1e',
  stallCanvas: '#27355e',
  ink: '#eef2ff',
  muted: '#8b93b8',
  magenta: '#ff2d95',
  cyan: '#22e6ff',
  yellow: '#ffd319',
  green: '#39ff88',
  red: '#ff3b4e',
  orange: '#ff7a1a',
};

export function hex(name) {
  return PALETTE[name];
}
