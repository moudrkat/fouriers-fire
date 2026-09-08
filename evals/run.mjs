// Scores the probe that ships (space/probe.js) on held-out cases (evals/cases.json), with controls.
// node evals/run.mjs  -> prints the table and writes evals/<date>-minilm.md
import { pipeline } from '@huggingface/transformers';
import { readFileSync, writeFileSync } from 'node:fs';
import { MODEL_ID, makeProbe, makeControls, words, BIG, SMALL } from '../space/probe.js';

const cases = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url)));
const t0 = Date.now();
const fe = await pipeline('feature-extraction', MODEL_ID, { dtype: 'q8' });
const cache = new Map();
const embed = async (t) => { if (!cache.has(t)) cache.set(t, Array.from((await fe(t, { pooling: 'mean', normalize: true })).data)); return cache.get(t); };
const probe = await makeProbe(embed);
const load = (Date.now() - t0) / 1000;

const rows = [];
let modelOK = 0, hotOK = 0, hotN = 0, okBig = 0, okSmall = 0;
for (const c of cases) {
  const w = words(c.text);
  const { full, shares } = await probe.shares(w);
  const sign = full >= 0 ? 1 : -1, mOK = sign === c.label;
  const hottest = w[shares.indexOf(Math.max(...shares))];
  modelOK += mOK; if (mOK) { if (c.label > 0) okBig++; else okSmall++; }
  if (c.hot) { hotN++; hotOK += c.hot.includes(hottest); }
  rows.push({ text: c.text, label: c.label, full, mOK, hottest, hot: c.hot, shares: w.map((x, i) => `${x} ${shares[i] >= 0 ? '+' : ''}${shares[i].toFixed(2)}`).join('  ') });
}
const ctl = await makeControls(embed, cases);
const n = cases.length, big = cases.filter(c => c.label > 0).length;
const date = new Date().toISOString().slice(0, 10);
let md = `# all-MiniLM-L6-v2 on the fire direction — ${date}\n\n`;
md += `Node, wasm, q8. ${n} held-out cases (${big} big, ${n - big} small), none of them among the ${BIG.length + SMALL.length} anchor sentences that define the direction. Model load + direction: ${load.toFixed(1)} s. Scored on the SIGN of the projection; chance is ${n / 2}.\n\n`;
md += `| | correct / ${n} |\n|---|---|\n| the direction on its own | **${modelOK}** (big ${okBig}/${big}, small ${okSmall}/${n - big}) |\n| chance | ${n / 2} |\n| control: 20 random directions, same centre | mean ${ctl.randomMean.toFixed(1)}, best ${ctl.randomMax} |\n| control: anchors with labels shuffled, 20 times | mean ${ctl.shuffledMean.toFixed(1)}, best ${ctl.shuffledMax} |\n| anchors, leave-one-out, of ${ctl.anchors} | ${ctl.loo} |\n| hottest word is a human-expected word | ${hotOK} / ${hotN} |\n\n`;
md += `The controls are what "30 of 40" is measured against: a random direction through the same centre, and the same anchors with their labels shuffled, both sit at chance. Leave-one-out on the anchors says how separable the two anchor groups are under the direction they define.\n\n## Every case\n\n\`\`\`\n`;
for (const r of rows) md += `${r.text.padEnd(38)} ${r.label > 0 ? 'big  ' : 'small'} ${(r.full >= 0 ? '+' : '') + r.full.toFixed(2)} ${r.mOK ? 'ok ' : 'XX '} hottest ${r.hottest}${r.hot ? (r.hot.includes(r.hottest) ? ' ok' : ' (expected ' + r.hot.join('|') + ')') : ''}\n`;
md += `\`\`\`\n\n## Per-word shares\n\n\`\`\`\n`;
for (const r of rows) md += `${r.text}\n    ${r.shares}\n`;
md += `\`\`\`\n`;
writeFileSync(new URL(`./${date}-minilm.md`, import.meta.url), md);
console.log(md.split('## Every case')[0]);
