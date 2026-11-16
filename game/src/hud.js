// The DOM HUD: crosshair, hit marker, health, ammo, money, timer, score,
// kill feed, bomb status, buy menu and a live minimap. It never touches the
// simulation; main.js pushes numbers in. Every write is cached, so a steady
// value costs no DOM work.
export function createHud(world) {
  const $ = (id) => document.getElementById(id);
  const overlay = $('overlay');
  const title = $('overlay-title');
  const copy = $('overlay-copy');
  const play = $('play');
  const ammoMag = $('ammo-mag');
  const ammoReserve = $('ammo-reserve');
  const weaponName = $('weapon-name');
  const healthNum = $('health-num');
  const healthFill = $('health-fill');
  const moneyEl = $('money');
  const timerEl = $('timer');
  const scoreAtk = $('score-atk');
  const scoreDef = $('score-def');
  const roundNum = $('round-num');
  const killfeedEl = $('killfeed');
  const banner = $('banner');
  const bombEl = $('bomb-status');
  const hitmarker = $('hitmarker');
  const buyMenu = $('buy-menu');
  const buyList = $('buy-list');
  const buyMoney = $('buy-money');
  const damageFlash = $('damage-flash');
  const smokeCount = $('smoke-count');
  const minimap = $('minimap');
  const mctx = minimap ? minimap.getContext('2d') : null;

  const cache = {};
  let hitTimer = 0;
  let lastFeedLen = -1;

  function setText(el, key, value) {
    if (!el || cache[key] === value) return;
    cache[key] = value;
    el.textContent = value;
  }

  const COPY = {
    start: {
      title: 'NEON ALLEY',
      copy: 'Night market, 5v5. Plant the spike at Site A or B — or wipe Nightwatch out. First to 7 rounds takes the match. Click to play.',
      action: 'Click to play',
    },
    paused: {
      title: 'NEON ALLEY',
      copy: 'Paused. Click to resume.',
      action: 'Click to resume',
    },
  };

  return {
    setAmmo(mag, reserve, name) {
      setText(ammoMag, 'mag', String(mag));
      setText(ammoReserve, 'reserve', `/ ${reserve}`);
      setText(weaponName, 'wname', name || '');
      if (ammoMag) ammoMag.parentElement.classList.toggle('empty', mag === 0);
    },
    setHealth(hp) {
      const v = Math.max(0, Math.round(hp));
      setText(healthNum, 'hp', String(v));
      if (healthFill && cache.hpw !== v) {
        cache.hpw = v;
        healthFill.style.width = v + '%';
        healthFill.classList.toggle('low', v <= 30);
      }
    },
    setMoney(money) {
      setText(moneyEl, 'money', '$' + money);
      setText(buyMoney, 'buymoney', '$' + money);
    },
    setTimer(seconds, phase) {
      const s = Math.max(0, Math.ceil(seconds));
      const mm = Math.floor(s / 60);
      const ss = String(s % 60).padStart(2, '0');
      setText(timerEl, 'timer', `${mm}:${ss}`);
      if (timerEl) timerEl.classList.toggle('urgent', s <= 10 && phase === 'combat');
    },
    setScore(atk, def, round) {
      setText(scoreAtk, 'satk', String(atk));
      setText(scoreDef, 'sdef', String(def));
      setText(roundNum, 'round', 'ROUND ' + round);
    },
    setSmokes(n) {
      setText(smokeCount, 'smoke', n > 0 ? `Smoke x${n} [G]` : '');
    },
    setBombStatus(text, urgent) {
      setText(bombEl, 'bomb', text);
      if (bombEl) bombEl.classList.toggle('urgent', !!urgent);
    },
    setBanner(text) {
      setText(banner, 'banner', text);
    },
    hitMarker(killed, holdMs = 90) {
      if (!hitmarker) return;
      hitmarker.classList.add('on');
      hitmarker.classList.toggle('kill', !!killed);
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => hitmarker.classList.remove('on', 'kill'), holdMs);
    },
    flashDamage() {
      if (!damageFlash) return;
      damageFlash.classList.add('on');
      setTimeout(() => damageFlash.classList.remove('on'), 120);
    },
    syncKillfeed(state) {
      if (!killfeedEl) return;
      if (state.killfeed.length === lastFeedLen) return;
      lastFeedLen = state.killfeed.length;
      killfeedEl.innerHTML = '';
      const now = state.time;
      for (const entry of state.killfeed.slice(-5)) {
        if (now - entry.t > 6) continue;
        const div = document.createElement('div');
        div.className = 'feed-' + entry.kind;
        div.textContent = entry.text;
        killfeedEl.appendChild(div);
      }
    },
    showBuy(open) {
      if (buyMenu) buyMenu.hidden = !open;
    },
    updateBuyList(items, money) {
      if (!buyList) return;
      const key = items.map((w) => `${w.id}:${w.owned}`).join('|') + ':' + money;
      if (cache.buyKey === key) return;
      cache.buyKey = key;
      buyList.innerHTML = '';
      items.forEach((w, i) => {
        const div = document.createElement('div');
        div.className = 'buy-item' + (w.owned ? ' owned' : '');
        div.innerHTML = `<b>[${i + 1}] ${w.name}</b><span>${w.owned ? 'OWNED — press ' + (i + 1) + ' to equip' : '$' + w.price + ' — press ' + (i + 1) + ' to buy'}</span><span class="buy-stats">${w.damage} dmg · ${w.mag} mag · ${w.auto ? 'auto' : 'semi'}</span>`;
        buyList.appendChild(div);
      });
      const smoke = document.createElement('div');
      smoke.className = 'buy-item';
      smoke.innerHTML = `<b>[5] Smoke grenade</b><span>$300 — press 5 to buy</span><span class="buy-stats">Blocks sight for 12 s</span>`;
      buyList.appendChild(smoke);
    },
    showOverlay(mode, score) {
      const text = COPY[mode];
      if (!text) return;
      title.textContent = text.title;
      copy.textContent = text.copy;
      play.textContent = text.action;
      overlay.hidden = false;
      play.focus();
    },
    showRoundEnd(winner, reason, score) {
      title.textContent = winner === 'atk' ? 'ROUND WON' : 'ROUND LOST';
      copy.textContent = `${reason}. Lanterns ${score.atk} — ${score.def} Nightwatch. Next round starts soon.`;
      play.textContent = 'Next round';
      overlay.hidden = false;
    },
    showMatchEnd(winner, score, kills) {
      const line = winner === 'draw'
        ? `Draw — Lanterns ${score.atk} : ${score.def} Nightwatch.`
        : `${winner === 'atk' ? 'LANTERNS WIN THE MATCH' : 'NIGHTWATCH WINS THE MATCH'} — ${score.atk} : ${score.def}.`;
      title.textContent = winner === 'atk' ? 'VICTORY' : winner === 'draw' ? 'DRAW' : 'DEFEAT';
      copy.textContent = `${line} You scored ${kills} eliminations.`;
      play.textContent = 'Play again';
      overlay.hidden = false;
    },
    showEliminated() {
      title.textContent = 'ELIMINATED';
      copy.textContent = 'You are down. Your crew fights on — the round ends when one side is wiped out or the clock runs out.';
      play.textContent = 'Spectate';
      overlay.hidden = false;
    },
    hideOverlay() {
      overlay.hidden = true;
    },
    onPlay(handler) {
      play.addEventListener('click', handler);
    },
    drawMinimap(state, playerPos, playerYaw, bots) {
      if (!mctx) return;
      const W = 168;
      const H = 120;
      const sx = (x) => ((x + 20) / 40) * W;
      const sy = (z) => ((z + 14) / 28) * H;
      mctx.clearRect(0, 0, W, H);
      mctx.fillStyle = 'rgba(7,11,24,0.85)';
      mctx.fillRect(0, 0, W, H);
      // Sites.
      for (const key of ['A', 'B']) {
        const s = world.sites[key];
        mctx.strokeStyle = state.bomb.planted && state.bomb.site === key ? '#ff3b4e' : '#ffd319';
        mctx.lineWidth = 1.5;
        mctx.beginPath();
        mctx.arc(sx(s.pos.x), sy(s.pos.z), 7, 0, Math.PI * 2);
        mctx.stroke();
        mctx.fillStyle = '#ffd319';
        mctx.font = 'bold 10px monospace';
        mctx.fillText(key, sx(s.pos.x) - 3, sy(s.pos.z) + 3);
      }
      // Rooftop walkway.
      mctx.fillStyle = 'rgba(34,230,255,0.18)';
      mctx.fillRect(sx(7), sy(-6), sx(17) - sx(7), sy(2) - sy(-6));
      // Bomb.
      if (state.bomb.planted && state.bomb.pos) {
        mctx.fillStyle = '#ff3b4e';
        mctx.beginPath();
        mctx.arc(sx(state.bomb.pos.x), sy(state.bomb.pos.z), 4, 0, Math.PI * 2);
        mctx.fill();
      }
      // Bots: allies always, enemies only when spotted in the last 3 s.
      for (const bot of bots) {
        if (!bot.alive) continue;
        if (bot.team === 'atk') {
          mctx.fillStyle = '#22e6ff';
        } else {
          const seenAt = state.spotted.get(bot.id);
          if (seenAt === undefined || state.time - seenAt > 3) continue;
          mctx.fillStyle = '#ff2d95';
        }
        mctx.beginPath();
        mctx.arc(sx(bot.pos.x), sy(bot.pos.z), 3, 0, Math.PI * 2);
        mctx.fill();
      }
      // Player arrow.
      mctx.save();
      mctx.translate(sx(playerPos.x), sy(playerPos.z));
      mctx.rotate(Math.atan2(-Math.sin(playerYaw), -Math.cos(playerYaw)) + Math.PI / 2);
      mctx.fillStyle = '#eef2ff';
      mctx.beginPath();
      mctx.moveTo(0, -6);
      mctx.lineTo(4, 5);
      mctx.lineTo(-4, 5);
      mctx.closePath();
      mctx.fill();
      mctx.restore();
    },
  };
}
