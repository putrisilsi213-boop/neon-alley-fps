// Bot personas: two crews in the night market. Names and one-line callouts
// only; the AI itself lives in bots.js. Attackers are the player's crew,
// "Lanterns"; defenders hold the market as "Nightwatch".
export const TEAMS = {
  atk: { name: 'Lanterns', color: '#22e6ff' },
  def: { name: 'Nightwatch', color: '#ff2d95' },
};

export const ALLY_NAMES = ['Vex', 'Mira', 'Juno', 'Kaito'];
export const ENEMY_NAMES = ['Rook', 'Sable', 'Nyx', 'Dagger', 'Onyx'];

export const CALLOUTS = {
  plant: ['Spike down, hold the site!', 'Device planted — cover me.', 'Spike is live.'],
  defuse: ['Defusing the spike!', 'On the device, cover me!'],
  kill: ['Target down.', 'Got one.', 'One less.'],
  round: ['Round ours. Spend it well.', 'They take this one. Next round.'],
};

export function callout(list, random) {
  return list[Math.floor(random() * list.length)];
}
