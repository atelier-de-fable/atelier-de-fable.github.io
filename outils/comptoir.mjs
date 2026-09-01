/* outils/comptoir.mjs — l'Atelier de Fable, salle X
 *
 * Cette salle affirme deux choses au visiteur, et n'en a jamais mesuré aucune :
 *
 *   (A) « À mesure que le côté grandit [...] toutes les courbes se croisent
 *        au même endroit. »
 *   (B) « Le comptoir ne s'arrête jamais. Laissez-le tourner : l'estimation
 *        se stabilise chiffre après chiffre. »
 *
 * Le tableau de chiffres publié sur la page vient d'un AUTRE programme
 * (outils/seuil.mjs). Personne n'avait vérifié que le comptoir affiché à
 * l'écran et l'outil qui prouve les chiffres tombent d'accord.
 *
 * Cet outil n'implémente pas la percolation. Il EXTRAIT le moteur de
 * le-seuil.html tel qu'il est servi, l'exécute hors navigateur, et le
 * confronte à un second programme écrit à la main qui ne partage avec lui
 * ni structure de données ni ordre de visite.
 *
 *   node outils/comptoir.mjs            (rapide, ~1 min)
 *   node outils/comptoir.mjs --long     (~20 min, les chiffres publiés)
 *
 * Aucune dépendance. Graine fixe : deux exécutions donnent le même résultat.
 * Écrit par Fable, 1er septembre 2026. Contredisez-moi.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ICI = dirname(fileURLToPath(import.meta.url));
const PAGE = join(ICI, "..", "le-seuil.html");
const PC = 0.59274605079;              /* Jacobsen 2015 */
const LONG = process.argv.includes("--long");

/* ---------------------------------------------------------------------------
 * INSTRUMENT (a) — le moteur de la page, extrait, jamais recopié
 * ------------------------------------------------------------------------- */
const html = readFileSync(PAGE, "utf8");
const script = html.slice(html.indexOf("<script>") + 8, html.indexOf("</script>"));
function bloc(d, f) {
  const a = script.indexOf(d), b = script.indexOf(f, a);
  if (a < 0 || b < 0) throw new Error("la page a changé : bloc introuvable — " + d);
  return script.slice(a, b);
}
const blocUF   = bloc("function UF(n)", "/* ================= VITRINE 1");
const blocCalc = bloc("var TAILLES=[",  "function dessine2()");

function mulberry(s) {
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Le code de la page appelle Math.random(). On lui donne un Math dont c'est
   la seule propriété modifiée, pour que la mesure soit rejouable. Rien
   d'autre n'est touché : le code exécuté est celui du fichier. */
function moteurPage(tri, rng) {
  const src = "var Math = Object.create(vraiMath); Math.random = rng;\n"
    + blocUF + "\n" + blocCalc + "\ntri = TRI;\n"
    + "return { tirage: tirage, estime: estime, pDe: pDe, TAILLES: TAILLES,"
    + " NB: NB, P0: P0, P1: P1, poser: function (b) { bins = b; } };";
  return new Function("vraiMath", "rng", "TRI", src)(Math, rng, tri);
}

/* ---------------------------------------------------------------------------
 * INSTRUMENT (b) — écrit à la main, parcours en largeur, sans union-find
 * ------------------------------------------------------------------------- */
function traverseBFS(L, p, tri, rnd) {
  const ouvert = new Uint8Array(L * L);
  for (let i = 0; i < L * L; i++) ouvert[i] = rnd() < p ? 1 : 0;
  const vu = new Uint8Array(L * L), file = new Int32Array(L * L);
  let tete = 0, queue = 0;
  for (let x = 0; x < L; x++) if (ouvert[x]) { vu[x] = 1; file[queue++] = x; }
  while (tete < queue) {
    const c = file[tete++], cy = (c / L) | 0, cx = c - cy * L;
    if (cy === L - 1) return true;
    const v = [];
    if (cx > 0) v.push(c - 1);
    if (cx < L - 1) v.push(c + 1);
    if (cy > 0) v.push(c - L);
    if (cy < L - 1) v.push(c + L);
    if (tri) {
      if (cy > 0 && cx < L - 1) v.push(c - L + 1);
      if (cy < L - 1 && cx > 0) v.push(c + L - 1);
    }
    for (let k = 0; k < v.length; k++) {
      const w = v[k];
      if (!vu[w] && ouvert[w]) { vu[w] = 1; file[queue++] = w; }
    }
  }
  return false;
}

/* ---------------------------------------------------------------------------
 * CONTRÔLE APPARIÉ — à graine égale les deux instruments voient LE MÊME monde,
 * donc ils peuvent être comparés monde par monde, et pas seulement en moyenne.
 * ------------------------------------------------------------------------- */
function controleApparie() {
  let desaccords = 0, total = 0;
  const N = LONG ? 20000 : 2000;
  for (const L of [16, 32, 64, 128]) {
    for (const p of [0.55, 0.59, 0.593, 0.60, 0.63]) {
      const n = L === 128 ? Math.round(N / 7) : (L === 64 ? Math.round(N / 2.5) : N);
      for (let i = 0; i < n; i++) {
        const g = 100000 + i * 7 + L * 31 + Math.round(p * 1000);
        if (moteurPage(0, mulberry(g)).tirage(L, p) !== traverseBFS(L, p, 0, mulberry(g)))
          desaccords++;
        total++;
      }
    }
  }
  return { total, desaccords };
}

/* --------------------------------------------------------------------------- */
function mesure(L, p, tri, N, graine) {
  const m = moteurPage(tri, mulberry(graine));
  let k = 0;
  for (let i = 0; i < N; i++) if (m.tirage(L, p)) k++;
  return k / N;
}
function courbe(L, tri, points, N) {
  return points.map((p, j) => ({ p, q: mesure(L, p, tri, N, 20260901 + L * 1009 + j * 7919) }));
}
function croise(c, cible) {
  for (let i = 1; i < c.length; i++) {
    const a = c[i - 1], b = c[i];
    if (a.q < cible && b.q >= cible && b.q !== a.q)
      return a.p + (cible - a.q) * (b.p - a.p) / (b.q - a.q);
  }
  return null;
}
/* Le changement de signe se fait ICI du positif vers le négatif : sous le seuil,
   la petite grille traverse PLUS souvent que la grande. Ma première version ne
   cherchait que la montée, et rendait « aucun croisement » sur les six paires —
   un test qui ne pouvait pas réussir ne dit rien du monde. Les deux sens, donc. */
function croisementPaire(cA, cB) {
  let prev = null;
  for (const o of cA) {
    const j = cB.find(u => Math.abs(u.p - o.p) < 1e-9);
    if (!j) continue;
    const d = o.q - j.q;
    if (prev && d !== prev.d && ((prev.d < 0 && d >= 0) || (prev.d > 0 && d <= 0)))
      return prev.p + (0 - prev.d) * (o.p - prev.p) / (d - prev.d);
    prev = { p: o.p, d };
  }
  return null;
}

/* ---------------------------------------------------------------------------
 * CE QUE LE COMPTOIR AFFICHE — sa propre fonction estime(), nourrie de
 * comptages dont le bruit a été retiré. Ce qui reste n'est donc pas du bruit :
 * c'est ce que le comptoir dirait après un temps infini.
 * ------------------------------------------------------------------------- */
function estimationDuComptoir(L, courbePage) {
  const m = moteurPage(0, mulberry(1));
  const bins = m.TAILLES.map(() => ({ n: new Int32Array(m.NB), k: new Int32Array(m.NB) }));
  const t = m.TAILLES.indexOf(L);
  for (let j = 0; j < m.NB; j++) {
    const p = m.pDe(j);
    const trouve = courbePage.find(o => Math.abs(o.p - p) < 1e-9);
    const q = trouve ? trouve.q : (p < 0.55 ? 0 : 1);
    bins[t].n[j] = 100000;
    bins[t].k[j] = Math.round(q * 100000);
  }
  m.poser(bins);
  return m.estime(t);
}

/* --------------------------------------------------------------------------- */
const N = LONG
  ? { 16: 200000, 32: 100000, 64: 50000, 128: 50000 }
  : { 16: 20000, 32: 10000, 64: 4000, 128: 2000 };

const PAS_PAGE = [0.55, 0.56, 0.57, 0.58, 0.59, 0.60, 0.61, 0.62, 0.63];
const fin = (a, b) => {
  const r = [];
  for (let p = a; p <= b + 1e-9; p += 0.002) r.push(Math.round(p * 1000) / 1000);
  return r;
};

console.log("comptoir.mjs — le comptoir de la salle X, interrogé sur ses deux promesses");
console.log(LONG ? "mode long\n" : "mode rapide (--long pour les chiffres publiés)\n");

const c = controleApparie();
console.log("contrôle apparié (même monde, deux algorithmes) : "
  + c.total + " mondes, " + c.desaccords + " désaccord(s)");
if (c.desaccords) { console.log("→ les instruments divergent : ne rien conclure."); process.exit(1); }

const courbes = {}, courbesPage = {};
for (const L of [16, 32, 64, 128]) {
  const pts = L >= 64 ? fin(0.586, 0.606) : fin(0.560, 0.630);
  courbesPage[L] = courbe(L, 0, PAS_PAGE, Math.round(N[L] / (L >= 64 ? 2 : 1)));
  courbes[L] = courbe(L, 0, pts, N[L]);
}

console.log("\n(B) « l'estimation se stabilise chiffre après chiffre »");
console.log("     ce que le COMPTOIR affiche, contre le seuil réel de sa propre taille\n");
console.log("   L    comptoir     seuil de la taille    écart dû à la grille de 0,01");
for (const L of [16, 32, 64, 128]) {
  const e = estimationDuComptoir(L, courbesPage[L]);
  const f = croise(courbes[L], 0.5);
  console.log("  " + String(L).padStart(3) + "   " + e.toFixed(6) + "        "
    + f.toFixed(6) + "              "
    + (e - f >= 0 ? "+" : "") + (e - f).toFixed(6));
}

console.log("\n(A) « toutes les courbes se croisent au même endroit »\n");
for (const [A, B] of [[16, 32], [32, 64], [64, 128], [16, 64], [16, 128], [32, 128]]) {
  const x = croisementPaire(courbes[A], courbes[B]);
  console.log("  L=" + String(A).padStart(3) + " × L=" + String(B).padStart(3) + "  →  "
    + (x === null ? "aucun croisement dans la fenêtre"
      : x.toFixed(6) + "   (écart à p_c : " + (x - PC >= 0 ? "+" : "") + (x - PC).toFixed(6) + ")"));
}

console.log("\ncontrôle dont la réponse est démontrée : triangulaire, seuil = 1/2\n");
for (const L of [32, 64, 128]) {
  const s = croise(courbe(L, 1, fin(0.488, 0.512), Math.round(N[L] / 2)), 0.5);
  console.log("  L=" + String(L).padStart(3) + "   " + (s === null ? "hors fenêtre"
    : s.toFixed(6) + "   écart à 1/2 : " + (s - 0.5 >= 0 ? "+" : "") + (s - 0.5).toFixed(6)));
}
