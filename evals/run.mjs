// Scores the probe that ships (space/probe.js) on held-out cases (evals/cases.json).
// node evals/run.mjs  -> prints the table and writes evals/<date>-minilm.md
import { pipeline } from '@huggingface/transformers';
import { readFileSync, writeFileSync } from 'node:fs';
import { MODEL_ID, makeProbe, rules, words, BIG, SMALL } from '../space/probe.js';

const cases = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url)));
const t0 = Date.now();
const fe = await pipeline('feature-extraction', MODEL_ID, { dtype: 'q8' });
const embed = async (t) => Array.from((await fe(t, { pooling: 'mean', normalize: true })).data);
const probe = await makeProbe(embed);
const load = (Date.now() - t0) / 1000;

const rows = [];
let modelOK = 0, rulesOK = 0, rulesHit = 0, shipOK = 0, hotOK = 0, hotN = 0, absMargin = 0, wrongMargins = [];
for (const c of cases) {
  const w = words(c.text);
  const { full, shares } = await probe.shares(w);
  const sign = full >= 0 ? 1 : -1;
  const r = rules(c.text);
  const hottest = w[shares.indexOf(Math.max(...shares))];
  const mOK = sign === c.label, rOK = r === c.label;
  const shipped = r !== 0 && r !== sign ? r : sign;           // shipped: model first, dictionary overrides out loud
  modelOK += mOK; rulesOK += rOK; rulesHit += r !== 0; shipOK += shipped === c.label; absMargin += Math.abs(full);
  if (!mOK) wrongMargins.push(Math.abs(full));
  if (c.hot) { hotN++; hotOK += c.hot.includes(hottest); }
  rows.push({ text: c.text, label: c.label, full, mOK, r, rOK, hottest, hot: c.hot, shares: w.map((x, i) => `${x} ${shares[i] >= 0 ? '+' : ''}${shares[i].toFixed(2)}`).join('  ') });
}
const n = cases.length, big = cases.filter(c => c.label > 0).length;
const fmt = (k) => `${k}/${n}`;
const date = new Date().toISOString().slice(0, 10);
let md = `# all-MiniLM-L6-v2 on the fire direction — ${date}\n\n`;
md += `Node, wasm, q8. ${n} held-out cases (${big} big, ${n - big} small), none of them among the ${BIG.length + SMALL.length} sentences that define the direction. Model load + direction: ${load.toFixed(1)} s. Scored on the SIGN of the projection; chance is ${n / 2}.\n\n`;
md += `| | correct / ${n} |\n|---|---|\n| the direction on its own | **${modelOK}** |\n| chance | ${n / 2} |\n| dictionary on its own | ${rulesOK} (matched ${rulesHit}) |\n| shipped: model first, dictionary overrides | ${shipOK} |\n| hottest word is a human-expected word | ${hotOK} / ${hotN} |\n\n`;
md += `Mean |projection| ${(absMargin / n).toFixed(2)}. Wrong cases had |projection| ${wrongMargins.map(x => x.toFixed(2)).join(', ') || 'none'}.\n\n## Every case\n\n\`\`\`\n`;
for (const r of rows) md += `${r.text.padEnd(38)} ${r.label > 0 ? 'big  ' : 'small'} ${(r.full >= 0 ? '+' : '') + r.full.toFixed(2)} ${r.mOK ? 'ok ' : 'XX '} rules ${r.r > 0 ? '+' : r.r < 0 ? '-' : '.'}  hottest ${r.hottest}${r.hot ? (r.hot.includes(r.hottest) ? ' ok' : ' (expected ' + r.hot.join('|') + ')') : ''}\n`;
md += `\`\`\`\n\n## Per-word shares\n\n\`\`\`\n`;
for (const r of rows) md += `${r.text}\n    ${r.shares}\n`;
md += `\`\`\`\n`;
writeFileSync(new URL(`./${date}-minilm.md`, import.meta.url), md);
console.log(md.split('## Per-word')[0]);
