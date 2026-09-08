// The model contract, in one place: the sentences that define the direction,
// the projection, and the per-word shares. index.html and eval.html both
// import this, so the eval scores what ships, not a copy that drifts.
export const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

// Sixteen and sixteen. The difference of their means is the direction.
// (Eight and eight scored 26/40 on the held-out set; these sixteen score 30/40. See evals/.)
export const BIG = ['the fire is roaring', 'a huge blazing bonfire', 'feed it more wood and make it roar', 'flames leaping high into the night', 'a raging inferno', 'crank it up, bigger flames', 'the whole pile is ablaze', 'tall wild flames and sparks', 'put more logs on it', 'it caught properly and is burning hard', 'big flames, lots of heat', 'the fire is getting bigger', 'stoke it up', 'a fierce fire, roaring away', 'burning strong and hot', 'build it up higher'];
export const SMALL = ['the fire is dying down', 'just glowing embers', 'let it burn low and quiet', 'a small gentle flame', 'almost out, only ash', 'calm it down, smaller', 'the last embers fading', 'a tiny flicker in the dark', 'only coals left', 'the fire has burnt down', 'it is going out', 'the fire is getting smaller', 'let it die', 'a low fire, hardly any flame', 'burning weak and cool', 'keep it small'];

const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
const mean = (rows) => rows[0].map((_, i) => rows.reduce((a, v) => a + v[i], 0) / rows.length);

// embed: async (text) -> Float32Array | number[]  (mean-pooled, normalised)
export async function makeProbe(embed) {
  const b = await Promise.all(BIG.map(embed)), s = await Promise.all(SMALL.map(embed));
  const mb = mean(b), ms = mean(s);
  const dir = mb.map((v, i) => v - ms[i]), centre = mb.map((v, i) => (v + ms[i]) / 2), dd = dot(dir, dir);
  // the two training means sit at +1 and -1
  const project = (e) => 2 * dot(Array.from(e, (v, i) => v - centre[i]), dir) / dd;
  const score = async (text) => project(await embed(text));
  // occlusion: remove one word, re-embed, see how far the score falls
  const shares = async (words) => {
    const full = await score(words.join(' '));
    if (words.length < 2) return { full, shares: [full] };
    const out = [];
    for (let i = 0; i < words.length; i++) out.push(full - await score(words.filter((_, j) => j !== i).join(' ')));
    return { full, shares: out };
  };
  return { score, shares, dir, centre, embed, project };
}

// A dictionary baseline, checked so the model has something honest to beat.
// DOWN first: "let it die down a bit" must not match "bit".
export const DOWN = /\b(die|dying|dies|died|out|embers?|coals?|ash|smaller|small|tiny|low|lower|calm|gentle|quiet|smoulder|smolder|fade|fading|faded|settle|dwindl|going out|nearly gone|burn down|burnt down|cold|glow(ing)?|flicker)\b/i;
export const UP = /\b(roar|roaring|blaze|blazing|ablaze|bigger|big|huge|more|feed|wood|logs?|crank|inferno|wild|hotter|bonfire|rage|raging|taller|higher|stronger|furnace|sparks?|beast|whoosh|took off|caught|hungry|jet)\b/i;
export function rules(text) { if (DOWN.test(text)) return -1; if (UP.test(text)) return 1; return 0; }

export const words = (text) => text.trim().split(/\s+/).filter(Boolean).slice(0, 24);

// Controls, so that 30/40 means something. All three use the same cached embeddings.
//  random:   the same centre, 20 random unit directions. Should sit at chance.
//  shuffled: the 32 anchors with their labels shuffled 20 times, direction rebuilt. Should sit at chance.
//  loo:      each anchor projected on the direction built from the other 31. How separable the anchors are.
export async function makeControls(embed, cases, seed = 1) {
  let x = seed; const rnd = () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; };
  const A = [...BIG.map(t => ({ t, y: 1 })), ...SMALL.map(t => ({ t, y: -1 }))];
  const E = new Map(); for (const a of A) E.set(a.t, await embed(a.t)); for (const c of cases) E.set(c.text, await embed(c.text));
  const dim = E.get(A[0].t).length;
  const dirOf = (rows) => { const b = rows.filter(r => r.y > 0).map(r => E.get(r.t)), s = rows.filter(r => r.y < 0).map(r => E.get(r.t)); const mb = mean(b), ms = mean(s); return { dir: mb.map((v, i) => v - ms[i]), centre: mb.map((v, i) => (v + ms[i]) / 2) }; };
  const acc = (dir, centre) => cases.reduce((n, c) => n + ((dot(Array.from(E.get(c.text), (v, i) => v - centre[i]), dir) >= 0 ? 1 : -1) === c.label ? 1 : 0), 0);
  const base = dirOf(A);
  const random = []; for (let k = 0; k < 20; k++) { const d = Array.from({ length: dim }, () => rnd() - .5); random.push(acc(d, base.centre)); }
  const shuffled = []; for (let k = 0; k < 20; k++) { const ys = A.map(a => a.y); for (let i = ys.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [ys[i], ys[j]] = [ys[j], ys[i]]; } const d = dirOf(A.map((a, i) => ({ t: a.t, y: ys[i] }))); shuffled.push(acc(d.dir, d.centre)); }
  let loo = 0; for (let i = 0; i < A.length; i++) { const d = dirOf(A.filter((_, j) => j !== i)); const s = dot(Array.from(E.get(A[i].t), (v, k) => v - d.centre[k]), d.dir); loo += (s >= 0 ? 1 : -1) === A[i].y ? 1 : 0; }
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  return { n: cases.length, direction: acc(base.dir, base.centre), randomMean: avg(random), randomMax: Math.max(...random), shuffledMean: avg(shuffled), shuffledMax: Math.max(...shuffled), loo, anchors: A.length };
}
