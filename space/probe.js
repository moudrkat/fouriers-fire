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
