// A fire with physics in it.
//
//   du/dt + (u·∇)u = −∇p + β T ŷ + ε (N × ω)      momentum, with hot air lighter than cold (Boussinesq 1903)
//   ∇·u = 0                                        the air is incompressible
//   dT/dt + (u·∇)T = −k T                           heat is carried by the air and radiated away
//
// Solved the way Jos Stam did it in 1999: semi-Lagrangian advection, a Jacobi
// pressure solve, one step per frame, unconditionally stable. Velocities are in
// cells per frame. y grows downward in the array, so "up" is −v.
// Embers on the bottom rows are the boundary condition; everything above them is
// the equations.
function makeFluid(W, H) {
  const N = W * H;
  const u = new Float32Array(N), v = new Float32Array(N), u2 = new Float32Array(N), v2 = new Float32Array(N);
  const T = new Float32Array(N), T2 = new Float32Array(N), p = new Float32Array(N), div = new Float32Array(N), curl = new Float32Array(N);
  const ember = new Float32Array(W);
  const K = { beta: 0.06, k: 0.045, p: 0.55, eps: 0.35, iters: 16 };
  let mean = 0, maxT = 1;

  function sample(f, x, y) {
    x = x < 0 ? 0 : x > W - 1.001 ? W - 1.001 : x;
    y = y < 0 ? 0 : y > H - 1.001 ? H - 1.001 : y;
    const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * W + x0;
    return (f[i] * (1 - fx) + f[i + 1] * fx) * (1 - fy) + (f[i + W] * (1 - fx) + f[i + W + 1] * fx) * fy;
  }
  function bnd(f, kind) {            // kind: 'u' side walls kill u, 'v' floor kills v, top is open, 'p' Neumann
    for (let y = 0; y < H; y++) { f[y * W] = kind === 'u' ? 0 : f[y * W + 1]; f[y * W + W - 1] = kind === 'u' ? 0 : f[y * W + W - 2]; }
    for (let x = 0; x < W; x++) { f[x] = f[W + x]; f[(H - 1) * W + x] = kind === 'v' ? 0 : f[(H - 2) * W + x]; }
  }

  function step() {
    // boundary condition: embers on the bottom rows, in the middle half, each one hot or cold, slowly changing
    // If someone has given the fire words, `heat` holds one target per column and the
    // embers flicker around it; otherwise they are random in the middle half.
    const x0 = W * 0.22 | 0, x1 = W * 0.78 | 0;
    if (api.heat) { for (let x = 0; x < W; x++) if (Math.random() < 0.15) ember[x] = Math.random() < 0.15 + 0.85 * api.heat[x] ? api.heat[x] * (0.75 + 0.25 * Math.random()) : 0; }
    else for (let x = 0; x < W; x++) if (Math.random() < 0.04) ember[x] = (x >= x0 && x < x1 && Math.random() < K.p) ? 0.7 + 0.3 * Math.random() : 0;
    for (let y = H - 3; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (ember[x] > T[i]) T[i] = ember[x]; }

    // buoyancy: hot air is light. This single line is what the 1990s trick does not have.
    for (let i = 0; i < N; i++) v[i] -= K.beta * T[i];

    // vorticity confinement: put back the small swirls the coarse grid smears away
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; curl[i] = 0.5 * ((v[i + 1] - v[i - 1]) - (u[i + W] - u[i - W])); }
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      const i = y * W + x;
      let dx = Math.abs(curl[i + 1]) - Math.abs(curl[i - 1]), dy = Math.abs(curl[i + W]) - Math.abs(curl[i - W]);
      const l = Math.sqrt(dx * dx + dy * dy) + 1e-5; dx /= l; dy /= l;
      u[i] += K.eps * dy * curl[i]; v[i] -= K.eps * dx * curl[i];
    }

    // advect velocity by itself
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; u2[i] = sample(u, x - u[i], y - v[i]); v2[i] = sample(v, x - u[i], y - v[i]); }
    bnd(u2, 'u'); bnd(v2, 'v');

    // make it incompressible: solve ∇²p = ∇·u, subtract ∇p
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; div[i] = 0.5 * (u2[i + 1] - u2[i - 1] + v2[i + W] - v2[i - W]); p[i] = 0; }
    for (let it = 0; it < K.iters; it++) {
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; p[i] = (p[i - 1] + p[i + 1] + p[i - W] + p[i + W] - div[i]) * 0.25; }
      bnd(p, 'p');
    }
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; u[i] = u2[i] - 0.5 * (p[i + 1] - p[i - 1]); v[i] = v2[i] - 0.5 * (p[i + W] - p[i - W]); }
    bnd(u, 'u'); bnd(v, 'v');

    // carry the heat with the air, and let it cool
    let sum = 0, mx = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; const t = sample(T, x - u[i], y - v[i]) * (1 - K.k);
      T2[i] = t; sum += t; if (t > mx) mx = t;
    }
    T.set(T2); mean = sum / N; maxT = mx;
  }
  const api = {
    K, T, W, H, step, heat: null,
    mean: () => mean,
    rows: () => { const r = new Float32Array(H); for (let y = 0; y < H; y++) { let s = 0; for (let x = 0; x < W; x++) s += T[y * W + x]; r[y] = s / W; } return r; },
  };
  return api;
}
if (typeof module !== 'undefined') module.exports = { makeFluid };
