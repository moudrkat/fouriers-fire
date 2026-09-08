// The LinkedIn cut, frame by frame: 30 fps, one physics step per frame, the real
// fire seeked to the exact time, every frame saved. Nothing depends on the clock.
import puppeteer from 'puppeteer-core';
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
const FPS = 30, DIR = 'renders/frames';
rmSync(DIR, { recursive: true, force: true }); mkdirSync(DIR, { recursive: true });
const srv = spawn('python3', ['-m', 'http.server', '8791'], { cwd: 'space', stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
try {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--window-size=1080,1400', '--hide-scrollbars'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1350 });
  page.on('pageerror', e => console.log('pageerror', String(e).slice(0, 200)));
  await page.goto('http://localhost:8791/record.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, { timeout: 240000 });
  await page.waitForFunction(() => document.getElementById('video').readyState >= 2, { timeout: 60000 });
  let n = 0;
  const S = (obj) => page.evaluate(o => Object.assign(window.__S, o), obj);
  async function run(frames) {
    for (let i = 0; i < frames; i++) {
      await S({ blink: Math.floor(n / 15) % 2 === 0 });
      const data = await page.evaluate(t => window.__tick(t), n / FPS);
      writeFileSync(`${DIR}/${String(n).padStart(5, '0')}.jpg`, Buffer.from(data.split(',')[1], 'base64'));
      n++;
    }
  }
  async function type(text) {
    await S({ prompt: '', status: '', values: '' });
    for (const c of text) { await page.evaluate(ch => { window.__S.prompt += ch; }, c); await run(1); }
    await run(5);
  }
  async function read() {
    await S({ thinking: true, status: 'reading it, in your browser…' });
    await run(14);
    const full = await page.evaluate(() => window.__read());
    console.log('read', full.toFixed(2));
  }
  // warm the fire up before the first frame
  for (let i = 0; i < 90; i++) await page.evaluate(() => window.__S && window.__tick ? null : null), await page.evaluate(() => { });
  await page.evaluate(() => { for (let i = 0; i < 120; i++) window.__K() && null; });
  await S({ title: 'a campfire, 7 September 2026', prompt: 'the logs have caught and it is starting to roar' });
  await page.evaluate(() => window.__read());
  await page.evaluate(() => { for (let i = 0; i < 150; i++) window.__tick(0); });
  await run(50);
  await type('let it die down, just glowing embers'); await read(); await run(95);
  await type('flames taller than me'); await read(); await run(110);
  await S({ end: true }); await run(60);
  await browser.close();
  console.log('frames', n, 'seconds', (n / FPS).toFixed(1));
} finally { srv.kill(); }
execSync(`ffmpeg -v error -y -framerate ${FPS} -i ${DIR}/%05d.jpg -c:v libx264 -crf 19 -preset medium -pix_fmt yuv420p -movflags +faststart renders/linkedin.mp4`, { stdio: 'inherit' });
rmSync(DIR, { recursive: true, force: true });
