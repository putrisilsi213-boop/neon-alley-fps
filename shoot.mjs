// Screenshot Neon Alley with the system Chrome via Playwright (no downloaded
// browser). Serves game/ on localhost, opens each ?shot= frame, waits for
// window.__shotReady, and saves a 1280x720 JPEG per shot.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('/home/hatch/workspace/makefun/node_modules/playwright-core');

const shots = [
  ['start', '1-start.jpg'],
  ['play', '2-play.jpg'],
  ['buy', '3-buy.jpg'],
  ['end', '4-end.jpg'],
];

const server = spawn(process.execPath, ['serve.ts'], { cwd: process.cwd(), stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 300)); });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
mkdirSync('screenshots', { recursive: true });
for (const [shot, file] of shots) {
  await page.goto(`http://localhost:8080/?shot=${shot}&seed=1`, { waitUntil: 'load' });
  try {
    await page.waitForFunction(() => window.__shotReady, null, { timeout: 20000 });
  } catch {
    console.log(`[${shot}] __shotReady timeout`);
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: `screenshots/${file}`, type: 'jpeg', quality: 82 });
  console.log(`[${shot}] saved ${file}`);
}
await browser.close();
server.kill();
console.log('done');
