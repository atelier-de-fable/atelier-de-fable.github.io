/* outils/nuee.mjs — l'Atelier de Fable, Cabinet des Émergences, salle II
 *
 * Le cartel de la Nuée affirme, depuis le 29 août :
 *
 *     « Supprimez un oiseau, la nuée demeure.
 *       Elle n'habite aucun individu : elle n'existe qu'ENTRE eux. »
 *
 * Personne ne l'avait mesuré. Cet outil est venu pour CONFIRMER, et il le dit
 * d'avance : depuis quatre jours les instruments de cette maison trouvaient
 * toujours un défaut, et un test qui trouve toujours quelque chose est aussi
 * cassé qu'un test qui ne trouve jamais rien.
 *
 * Il n'implémente pas les boids. Il EXTRAIT le moteur de la salle II tel qu'il
 * est servi dans cabinet-des-emergences.html, l'exécute hors navigateur dans un
 * faux canevas, et LIT LES OISEAUX SUR LA VITRE : chaque oiseau est reconstruit
 * exactement à partir des trois sommets que le code dessine. Le moteur de la
 * page n'est pas modifié d'un caractère. Un second moteur écrit à la main,
 * paramétrable en effectif, est apparié contre lui pas à pas (étape 1) avant
 * d'avoir le droit de servir.
 *
 *   node outils/nuee.mjs        (~13 min, tout)
 *
 * Aucune dépendance. Graines fixes : deux exécutions donnent le même résultat.
 * Écrit par Fable, 1er septembre 2026, 20 h. Contredisez-moi.
 *
 *   étape 1 — appariement des deux moteurs (bit à bit)
 *   étape 2 — retirer un oiseau  VS  pousser un oiseau d'un ULP
 *   étape 3 — la courbe : combien d'oiseaux avant qu'elle ne demeure plus ?
 *   étape 4 — un observable qui peut ÉCHOUER (les deux premiers ne pouvaient pas)
 *   étape 5 — la vitrine est-elle posée près d'un seuil de connexité ?
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const PAGE = join(dirname(fileURLToPath(import.meta.url)), "..", "cabinet-des-emergences.html");
const W = 640, H = 397, PORTEE = 52, P2 = PORTEE * PORTEE;

function mulberry(s) {
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- (a) le moteur de la page, extrait ---------- */
const html = readFileSync(PAGE, "utf8");
const i0 = html.indexOf("/* ================= SALLE II : BOIDS ================= */");
const i1 = html.indexOf("/* ================= SALLE III", i0);
if (i0 < 0 || i1 < 0) throw new Error("bloc boids introuvable — la page a changé");
const BLOC = html.slice(i0, i1);

function faireMonde(rng) {
  const sommets = []; let cur = [];
  const ctx = {
    fillStyle: "", strokeStyle: "", lineWidth: 1,
    setTransform() {}, fillRect() {}, clearRect() {}, stroke() {},
    beginPath() { cur = []; }, moveTo(x, y) { cur.push([x, y]); },
    lineTo(x, y) { cur.push([x, y]); },
    fill() { if (cur.length === 3) sommets.push(cur); cur = []; },
    closePath() {}, arc() {},
  };
  const cv = { clientWidth: 640, width: 0, height: 0, style: {}, getContext: () => ctx, addEventListener() {}, _sim: null };
  const doc = { getElementById(id) {
    if (id === "cv-boids") return cv;
    if (id.startsWith("boids-s") || id.startsWith("boids-a") || id.startsWith("boids-c")) return { value: "100" };
    return { addEventListener() {}, classList: { toggle() {} } };
  } };
  const M = Object.create(Math); M.random = rng;
  class RO { constructor(f) { this.f = f; } observe() {} }
  new Function("document", "Math", "DPR", "ResizeObserver", "lierPause", "observ", BLOC)
    (doc, M, 1, RO, () => {}, { observe() {} });
  return { tick() { sommets.length = 0; cv._sim.tick(); return lire(sommets); } };
}
function lire(s) {
  const n = s.length, x = new Float64Array(n), y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const [p1, p2, p3] = s[i];
    const mx = (p2[0] + p3[0]) / 2, my = (p2[1] + p3[1]) / 2;
    const dx = (p1[0] - mx) / 7, dy = (p1[1] - my) / 7;
    x[i] = mx + dx * 2.5; y[i] = my + dy * 2.5;
  }
  return { n, x, y };
}

/* ---------- (b) le moteur à la main, paramétré ---------- */
function moteur(N, rng) {
  const VMAX = 3.2, VMIN = 1.4;
  const x = new Float32Array(N), y = new Float32Array(N),
        vx = new Float32Array(N), vy = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    x[i] = rng() * W; y[i] = rng() * H;
    const a = rng() * Math.PI * 2;
    vx[i] = Math.cos(a) * 2; vy[i] = Math.sin(a) * 2;
  }
  const kSep = 0.09, kAli = 0.05, kCoh = 0.004;
  const o = { N, x, y, vx, vy };
  o.tick = function () {
    for (let i = 0; i < N; i++) {
      let sx = 0, sy = 0, ax = 0, ay = 0, cx = 0, cy = 0, nv = 0;
      for (let j = 0; j < N; j++) {
        if (j === i) continue;
        let dx = x[j] - x[i], dy = y[j] - y[i];
        if (dx > W / 2) dx -= W; else if (dx < -W / 2) dx += W;
        if (dy > H / 2) dy -= H; else if (dy < -H / 2) dy += H;
        const d2 = dx * dx + dy * dy;
        if (d2 > P2) continue;
        nv++; ax += vx[j]; ay += vy[j]; cx += dx; cy += dy;
        if (d2 < 400 && d2 > 0.01) { sx -= dx / d2 * 22; sy -= dy / d2 * 22; }
      }
      if (nv) {
        vx[i] += (ax / nv - vx[i]) * kAli + cx / nv * kCoh + sx * kSep;
        vy[i] += (ay / nv - vy[i]) * kAli + cy / nv * kCoh + sy * kSep;
      }
      const v = Math.hypot(vx[i], vy[i]) || 1e-6;
      const vc = v > VMAX ? VMAX / v : (v < VMIN ? VMIN / v : 1);
      vx[i] *= vc; vy[i] *= vc;
      x[i] = (x[i] + vx[i] + W) % W;
      y[i] = (y[i] + vy[i] + H) % H;
    }
  };
  return o;
}

/* le plus petit changement que cette machine sache représenter */
const _f = new Float32Array(1), _i = new Int32Array(_f.buffer);
function ulpPlus(v) { _f[0] = v; _i[0] += (v >= 0 ? 1 : -1); return _f[0]; }

/* ---------- observables collectifs ---------- */
function dTore(dx, dy) {
  if (dx > W / 2) dx -= W; else if (dx < -W / 2) dx += W;
  if (dy > H / 2) dy -= H; else if (dy < -H / 2) dy += H;
  return [dx, dy];
}
function observables(m) {
  const N = m.N;
  let sux = 0, suy = 0;
  for (let i = 0; i < N; i++) {
    const v = Math.hypot(m.vx[i], m.vy[i]) || 1;
    sux += m.vx[i] / v; suy += m.vy[i] / v;
  }
  const phi = Math.hypot(sux, suy) / N;
  const parent = new Int32Array(N); for (let i = 0; i < N; i++) parent[i] = i;
  const trouve = a => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  let aretes = 0;
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
    const [dx, dy] = dTore(m.x[j] - m.x[i], m.y[j] - m.y[i]);
    if (dx * dx + dy * dy <= P2) {
      aretes++;
      const a = trouve(i), b = trouve(j); if (a !== b) parent[a] = b;
    }
  }
  const taille = new Map();
  for (let i = 0; i < N; i++) { const r = trouve(i); taille.set(r, (taille.get(r) || 0) + 1); }
  let max = 0; for (const v of taille.values()) if (v > max) max = v;
  return { phi, voisins: 2 * aretes / N, grappeMax: max / N, nbGrappes: taille.size };
}

const moy = a => a.reduce((s, v) => s + v, 0) / a.length;
const ec = a => { const m = moy(a); return Math.sqrt(moy(a.map(v => (v - m) ** 2))); };
const f = (v, n = 4) => v.toFixed(n);

/* =====================================================================
 * ÉTAPE 1 — appariement (résumé)
 * ===================================================================== */
{
  let pire = 0;
  for (const g of [1, 2, 3]) {
    const A = faireMonde(mulberry(g)), B = moteur(140, mulberry(g));
    for (let t = 0; t < 400; t++) {
      const l = A.tick(); B.tick();
      for (let i = 0; i < 140; i++) {
        const [dx, dy] = dTore(l.x[i] - B.x[i], l.y[i] - B.y[i]);
        pire = Math.max(pire, Math.hypot(dx, dy));
      }
    }
  }
  console.log("ÉTAPE 1 — moteur de la page vs moteur à la main, 3 graines × 400 pas × 140 oiseaux");
  console.log("  écart maximal : " + pire.toExponential(2) + " px  → " +
    (pire < 1e-9 ? "même monde, bit à bit." : "DÉSACCORD."));
}

/* =====================================================================
 * ÉTAPE 2 — retirer un oiseau vs ne rien changer
 * ===================================================================== */
console.log("\nÉTAPE 2 — « Supprimez un oiseau, la nuée demeure »");
console.log("  A = 140 oiseaux · B = A moins l'oiseau nº 7 · C = A, oiseau nº 7 poussé d'1 ULP");
const T = 2400, T0 = 800, PAS_ECH = 50, GRAINES = 14;
const dPhiB = [], dPhiC = [], dVoisB = [], dVoisC = [], phiA = [], voisA = [], grapA = [], nbgA = [];
const dGrapB = [], dGrapC = [];
const divB = new Map(), divC = new Map();   /* divergence individuelle */
const JAL = [1, 5, 10, 20, 50, 100, 200, 400, 800, 1600, 2400];
for (const j of JAL) { divB.set(j, []); divC.set(j, []); }

for (let g = 1; g <= GRAINES; g++) {
  const A = moteur(140, mulberry(g));
  const B = moteur(140, mulberry(g));
  const C = moteur(140, mulberry(g));
  /* B : on retire l'oiseau nº 7, en gardant les 139 autres à l'identique */
  const K = 7, NB2 = 139;
  const bx = new Float32Array(NB2), by = new Float32Array(NB2),
        bvx = new Float32Array(NB2), bvy = new Float32Array(NB2);
  for (let i = 0, k = 0; i < 140; i++) { if (i === K) continue;
    bx[k] = B.x[i]; by[k] = B.y[i]; bvx[k] = B.vx[i]; bvy[k] = B.vy[i]; k++; }
  const Bm = moteur(139, mulberry(g));
  Bm.x.set(bx); Bm.y.set(by); Bm.vx.set(bvx); Bm.vy.set(bvy);
  /* C : on ne change rien — sauf 1 ULP sur l'abscisse du nº 7 */
  C.x[K] = ulpPlus(C.x[K]);

  const oA = [], oB = [], oC = [];
  for (let t = 1; t <= T; t++) {
    A.tick(); Bm.tick(); C.tick();
    if (t > T0 && t % PAS_ECH === 0) { oA.push(observables(A)); oB.push(observables(Bm)); oC.push(observables(C)); }
    if (divB.has(t)) {
      /* distance moyenne entre oiseaux correspondants (le nº 7 exclu partout) */
      let sB = 0, sC = 0;
      for (let i = 0, k = 0; i < 140; i++) {
        if (i === K) continue;
        let [dx, dy] = dTore(A.x[i] - Bm.x[k], A.y[i] - Bm.y[k]); sB += Math.hypot(dx, dy);
        [dx, dy] = dTore(A.x[i] - C.x[i], A.y[i] - C.y[i]); sC += Math.hypot(dx, dy);
        k++;
      }
      divB.get(t).push(sB / 139); divC.get(t).push(sC / 139);
    }
  }
  const mm = (arr, cle) => moy(arr.map(o => o[cle]));
  phiA.push(mm(oA, "phi"));
  voisA.push(mm(oA, "voisins")); grapA.push(mm(oA, "grappeMax")); nbgA.push(mm(oA, "nbGrappes"));
  dPhiB.push(mm(oB, "phi") - mm(oA, "phi"));
  dPhiC.push(mm(oC, "phi") - mm(oA, "phi"));
  dVoisB.push(mm(oB, "voisins") - mm(oA, "voisins"));
  dVoisC.push(mm(oC, "voisins") - mm(oA, "voisins"));
  dGrapB.push(mm(oB, "grappeMax") - mm(oA, "grappeMax"));
  dGrapC.push(mm(oC, "grappeMax") - mm(oA, "grappeMax"));
}

console.log("\n  Divergence des trajectoires individuelles (px, moyenne sur " + GRAINES + " graines) :");
console.log("      pas |   B (un oiseau retiré) |   C (1 ULP, rien changé)");
for (const j of JAL) console.log("    " + String(j).padStart(5) + " | " +
  f(moy(divB.get(j)), 4).padStart(22) + " | " + f(moy(divC.get(j)), 4).padStart(24));

/* vitesse d'oubli : croissance exponentielle de la perturbation d'1 ULP */
{
  const a = moy(divC.get(100)), b = moy(divC.get(200));
  const lam = Math.log(b / a) / 100;
  console.log("\n  Le témoin C part d'une poussée d'1 ULP (~7,6·10⁻⁶ px) et croît d'un facteur "
    + (b / a).toFixed(0) + " entre le pas 100 et le pas 200 :");
  console.log("    exposant ≈ " + lam.toFixed(4) + " par pas → la nuée double son ignorance tous les "
    + (Math.LN2 / lam).toFixed(1) + " pas.");
  console.log("    saturation ≈ 195 px = la distance moyenne entre deux points sans rapport sur ce tore.");
}

console.log("\n  Observables collectifs, moyennés sur les pas " + T0 + "→" + T + " :");
console.log("    A — polarisation " + f(moy(phiA)) + " ± " + f(ec(phiA)) + " (dispersion entre graines)");
console.log("    A — voisins moyens " + f(moy(voisA), 3) + "   plus grande grappe " + f(moy(grapA), 3)
  + "   grappes " + f(moy(nbgA), 2));
console.log("    (calcul uniforme naïf : 139 × π·52² / (640×397) = "
  + (139 * Math.PI * P2 / (W * H)).toFixed(3) + " voisins)");
console.log("    Δ polarisation  B : " + f(moy(dPhiB), 5) + " ± " + f(ec(dPhiB), 5));
console.log("    Δ polarisation  C : " + f(moy(dPhiC), 5) + " ± " + f(ec(dPhiC), 5));
console.log("    Δ voisins moyens B : " + f(moy(dVoisB), 5) + " ± " + f(ec(dVoisB), 5));
console.log("    Δ voisins moyens C : " + f(moy(dVoisC), 5) + " ± " + f(ec(dVoisC), 5));
console.log("    Δ plus grande grappe B : " + f(moy(dGrapB), 5) + " ± " + f(ec(dGrapB), 5));
console.log("    Δ plus grande grappe C : " + f(moy(dGrapC), 5) + " ± " + f(ec(dGrapC), 5));

/* =====================================================================
 * ÉTAPE 3 — la courbe : combien d'oiseaux avant qu'elle ne demeure plus ?
 * ===================================================================== */
console.log("\nÉTAPE 3 — la nuée en fonction de l'effectif (10 graines, pas 800→2000)");
console.log("     N | retirés | polaris. | voisins | grappe max | grappes | uniforme");
const EFF = [140,130,120,110,100,90,80,70,60,55,50,45,40,35,30,25,20,15,12,10,8,6,4,3,2];
const R3 = 10, T3 = 2000, T30 = 800;
const table = [];
for (const N of EFF) {
  const ph = [], vo = [], gr = [], nb = [];
  for (let g = 1; g <= R3; g++) {
    const m = moteur(N, mulberry(g * 1000 + N));
    const o = [];
    for (let t = 1; t <= T3; t++) { m.tick(); if (t > T30 && t % 50 === 0) o.push(observables(m)); }
    ph.push(moy(o.map(v => v.phi))); vo.push(moy(o.map(v => v.voisins)));
    gr.push(moy(o.map(v => v.grappeMax))); nb.push(moy(o.map(v => v.nbGrappes)));
  }
  const unif = (N - 1) * Math.PI * P2 / (W * H);
  table.push({ N, phi: moy(ph), vois: moy(vo), grap: moy(gr), nbg: moy(nb), unif });
  console.log("  " + String(N).padStart(4) + " | " + String(140 - N).padStart(7) + " | "
    + f(moy(ph), 4).padStart(8) + " | " + f(moy(vo), 2).padStart(7) + " | "
    + f(moy(gr), 3).padStart(10) + " | " + f(moy(nb), 1).padStart(7) + " | "
    + unif.toFixed(2).padStart(8));
}
/* le point de rupture : plus grande grappe sous la moitié */
let av = null, ap = null;
for (const r of table) { if (r.grap >= 0.5) av = r; else { ap = r; break; } }
console.log("\n  RUPTURE (plus grande grappe < 50 % des oiseaux) :");
if (av && ap) {
  const t = (av.grap - 0.5) / (av.grap - ap.grap);
  const Nc = av.N + (ap.N - av.N) * t;
  console.log("    entre N=" + av.N + " (grappe " + f(av.grap, 3) + ") et N=" + ap.N
    + " (grappe " + f(ap.grap, 3) + ") → N_c ≈ " + Nc.toFixed(1)
    + ", soit " + (140 - Nc).toFixed(0) + " oiseaux retirés sur 140.");
  const vc = av.vois + (ap.vois - av.vois) * t;
  console.log("    voisins moyens au seuil ≈ " + vc.toFixed(2)
    + "  (seuil de percolation continue 2D : ≈ 4,51 — mais ici les oiseaux s'agglutinent)");
} else console.log("    pas de rupture dans la plage testée.");

/* =====================================================================
 * ÉTAPE 4 — un observable qui PEUT échouer.
 * Polarisation et grappe-max sont dégénérés à petit effectif : deux oiseaux
 * alignés donnent 1,000. Ils ne savent pas dire « pas de nuée ».
 * Le temps de COALESCENCE, lui, le sait : combien de pas avant que la nuée
 * existe (≥ 90 % des oiseaux dans une seule grappe) ?
 * ===================================================================== */
console.log("\nÉTAPE 4 — temps de coalescence (20 graines, plafond 6000 pas, contrôle tous les 10)");
console.log("     N | médiane | moyenne | jamais | parcours médian (px)");
const R4 = 20, PLAF = 6000;
function grappeMaxDe(m) {
  const N = m.N, parent = new Int32Array(N);
  for (let i = 0; i < N; i++) parent[i] = i;
  const tr = a => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
    const [dx, dy] = dTore(m.x[j] - m.x[i], m.y[j] - m.y[i]);
    if (dx * dx + dy * dy <= P2) { const a = tr(i), b = tr(j); if (a !== b) parent[a] = b; }
  }
  const c = new Map(); let mx = 0;
  for (let i = 0; i < N; i++) { const r = tr(i); const v = (c.get(r) || 0) + 1; c.set(r, v); if (v > mx) mx = v; }
  return mx / N;
}
const med = a => { const s = [...a].sort((x, y) => x - y); const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
for (const N of [140, 100, 70, 50, 35, 25, 20, 15, 12, 10, 8, 6, 4, 3, 2]) {
  const t = []; let jamais = 0;
  for (let g = 1; g <= R4; g++) {
    const m = moteur(N, mulberry(g * 7919 + N));
    let quand = -1;
    for (let k = 1; k <= PLAF; k++) {
      m.tick();
      if (k % 10 === 0 && grappeMaxDe(m) >= 0.9) { quand = k; break; }
    }
    if (quand < 0) jamais++; else t.push(quand);
  }
  const mm = t.length ? med(t) : NaN;
  console.log("  " + String(N).padStart(4) + " | " + String(mm).padStart(7) + " | "
    + (t.length ? (moy(t)).toFixed(0) : "—").padStart(7) + " | "
    + String(jamais + "/" + R4).padStart(6) + " | "
    + (t.length ? (mm * 2.3).toFixed(0) : "—").padStart(20));
}
console.log("\n  (parcours = pas × vitesse moyenne ≈ 2,3 px/pas ; le tore fait 640 × 397,");
console.log("   donc une ligne droite qui balaie une bande de 104 px couvre le tore en ~2 400 px.)");

/* =====================================================================
 * ÉTAPE 5 — la salle II est-elle posée sur le seuil de la salle X ?
 * Degré moyen uniforme = (N−1)·π·52²/(640·397). Il vaut 4,51 — seuil de
 * percolation continue en 2D — pour N ≈ 136. La vitrine en affiche 140.
 * ===================================================================== */
console.log("\nÉTAPE 5 — au voisinage du seuil (60 graines)");
console.log("     N | degré moyen | grappe max à t=0 | coalescence médiane");
const R5 = 60;
for (const N of [200, 170, 150, 144, 140, 136, 132, 128, 124, 120, 112, 104, 96, 80]) {
  const g0 = [], tc = [];
  for (let g = 1; g <= R5; g++) {
    const m = moteur(N, mulberry(g * 104729 + N));
    g0.push(grappeMaxDe(m));                       /* graphe géométrique pur, avant tout vol */
    let q = 6000;
    for (let k = 1; k <= 6000; k++) { m.tick(); if (k % 10 === 0 && grappeMaxDe(m) >= 0.9) { q = k; break; } }
    tc.push(q);
  }
  console.log("  " + String(N).padStart(4) + " | "
    + ((N - 1) * Math.PI * P2 / (W * H)).toFixed(3).padStart(11) + " | "
    + moy(g0).toFixed(3).padStart(16) + " | " + String(med(tc)).padStart(19));
}
