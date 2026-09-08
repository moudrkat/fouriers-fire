// Records the LinkedIn cut: 1080x1350, the compositor page in headless Chrome, served locally.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'http.server', '8791'], { cwd: 'space', stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
try {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--window-size=1080,1400', '--hide-scrollbars'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('pageerror', String(e).slice(0, 200)));
  await page.goto('http://localhost:8791/record.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, { timeout: 240000 });
  await new Promise(r => setTimeout(r, 2500));
  const rec = await page.screencast({ path: 'renders/linkedin.webm' });
  await page.evaluate(() => window.__run());
  await page.waitForFunction(() => window.__done === true, { timeout: 120000 });
  await rec.stop();
  await browser.close();
} finally { srv.kill(); }
