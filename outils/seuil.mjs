// Le Seuil — l'outil de la salle X. Mesure le seuil de percolation par sites
// d'un réseau carré (4 voisins) ou triangulaire (6 voisins), et la largeur de
// la zone où un monde seul ne vous apprend rien.
//
// Usage, depuis la racine du dépôt :
//   node outils/seuil.mjs              (mesure rapide, ~1 min)
//   node outils/seuil.mjs --long       (mesure complète, plusieurs minutes)
//   node outils/seuil.mjs --tri        (réseau triangulaire : la réponse est 1/2)
//
// Aucune dépendance. Le tirage est déterministe (graine fixe) : relancez-le,
// changez la graine, et contredisez-moi.        — Fable, 31 août 2026

const ARGS = new Set(process.argv.slice(2));
const TRI = ARGS.has('--tri');
const LONG = ARGS.has('--long');

// Valeurs de la littérature, pour comparaison seulement — jamais utilisées dans la mesure.
const REFERENCE = TRI ? 0.5 : 0.59274605;

/* ---------------- union-find ---------------- */
const neuf = n => { const p = new Int32Array(n); for (let i = 0; i < n; i++) p[i] = i; return p; };
function racine(p, x) { while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; } return x; }
function unir(p, a, b) { a = racine(p, a); b = racine(p, b); if (a !== b) p[a] = b; }

/* Générateur pseudo-aléatoire déterministe (mulberry32), pour que la mesure soit
   reproductible à l'identique par quiconque relance ce fichier. */
function graine(s) {
  return function () {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* Un monde : L×L cases ouvertes avec la probabilité p. Traverse-t-il de haut en bas ?
   On balaie en ordre (haut→bas, gauche→droite) et on ne relie qu'aux voisins déjà
   traités — cela suffit à construire toutes les composantes.
   tri ajoute la diagonale haut-droite : c'est le réseau triangulaire. */
function traverse(L, p, hasard, tri) {
  const n = L * L, uf = neuf(n + 2), HAUT = n, BAS = n + 1;
  const o = new Uint8Array(n);
  for (let i = 0; i < n; i++) o[i] = hasard() < p ? 1 : 0;
  for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
    const i = y * L + x; if (!o[i]) continue;
    if (y === 0) unir(uf, i, HAUT);
    if (y === L - 1) unir(uf, i, BAS);
    if (x > 0 && o[i - 1]) unir(uf, i, i - 1);
    if (y > 0 && o[i - L]) unir(uf, i, i - L);
    if (tri && y > 0 && x < L - 1 && o[i - L + 1]) unir(uf, i, i - L + 1);
  }
  return racine(uf, HAUT) === racine(uf, BAS);
}

const proba = (L, p, N, hasard) => {
  let k = 0; for (let s = 0; s < N; s++) if (traverse(L, p, hasard, TRI)) k++;
  return k / N;
};

/* p tel que la proportion de mondes qui traversent vaut `cible`, par bissection. */
function seuil(L, cible, N, hasard) {
  let lo = 0.25, hi = 0.85;
  for (let it = 0; it < 15; it++) {
    const m = (lo + hi) / 2;
    if (proba(L, m, N, hasard) < cible) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

const hasard = graine(20260831);
const virg = (v, d) => v.toFixed(d).replace('.', ',');
const signe = v => (v >= 0 ? '+' : '') + virg(v, 4);

console.log(`Réseau ${TRI ? 'TRIANGULAIRE (6 voisins)' : 'CARRÉ (4 voisins)'} — percolation par sites`);
console.log(`Référence de la littérature : ${TRI ? '1/2 exactement (démontré)' : '0,592 746 05… (aucune formule connue)'}\n`);

console.log('— Le p où un monde sur deux traverse —');
console.log('  côté   tirages   seuil mesuré   écart à la référence');
for (const L of (LONG ? [16, 32, 64, 128, 256] : [16, 32, 64])) {
  const N = LONG ? (L <= 32 ? 20000 : L <= 64 ? 8000 : L <= 128 ? 3000 : 900)
                 : (L <= 32 ? 3000 : 1200);
  const e = seuil(L, 0.5, N, hasard);
  console.log(`  ${String(L).padStart(4)}   ${String(N).padStart(7)}   ${virg(e, 4).padStart(12)}   ${signe(e - REFERENCE).padStart(10)}`);
}

console.log('\n— La zone où un monde ne vous apprend rien (5 % → 95 %) —');
console.log('  côté        de        à     largeur');
const largeurs = [];
for (const L of (LONG ? [8, 16, 32, 64, 128] : [8, 16, 32, 64])) {
  const N = LONG ? (L <= 16 ? 12000 : L <= 32 ? 8000 : L <= 64 ? 3000 : 1000)
                 : (L <= 16 ? 2500 : 1200);
  const a = seuil(L, 0.05, N, hasard), b = seuil(L, 0.95, N, hasard);
  largeurs.push([L, b - a]);
  console.log(`  ${String(L).padStart(4)}   ${virg(a, 4)}   ${virg(b, 4)}   ${virg(b - a, 4).padStart(9)}`);
}

/* La théorie prédit largeur ∝ côté^(−1/ν) avec ν = 4/3, soit une pente de −0,75
   en échelle logarithmique. On mesure la pente, on ne la suppose pas. */
let sx = 0, sy = 0, sxx = 0, sxy = 0;
for (const [L, w] of largeurs) { const X = Math.log(L), Y = Math.log(w); sx += X; sy += Y; sxx += X * X; sxy += X * Y; }
const m = largeurs.length;
const pente = (m * sxy - sx * sy) / (m * sxx - sx * sx);
console.log(`\n  pente log-log mesurée : ${virg(pente, 3)}   (la théorie dit −3/4 = −0,750)`);
console.log('  Les plus petites grilles tirent la pente vers le haut : jetez-les et elle se redresse.');
if (!LONG) console.log('\n  (mesure rapide — les chiffres publiés sur le mur de la salle X viennent de --long)');
