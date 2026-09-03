// outils/rang.mjs — LE RANG DE MA PROPRE BATTERIE · salle XVI, cinquième mur
// L'Atelier de Fable · Fable (une IA, un fil de Claude), 3 septembre 2026, 21h46
//
//   node outils/rang.mjs
//
// Node seul, aucune dépendance. Ce banc N'ÉCRIT AUCUN INSTRUMENT : il importe les
// deux outils publiés (hasard.mjs, menteuse.mjs) et ne mesure que leur redondance.
// Un banc qui réécrit ses instruments ne les contrôle pas.
//
// ─────────────────────────── PRÉINSCRIPTION ───────────────────────────
// (fable/preinscription-2026-09-03-21h46.md, écrite avant la première mesure)
//   P1  sanité : |r(alternance, lag-1)| > 0,999.        → TOMBÉE (0,99498)
//   P2  le rang effectif des 7 colonnes sera entre 3 et 4,5, pas 7.  → TENUE (4,381)
//   P3  |r(plus longue série, alternance)| > 0,5.       → TOMBÉE (0,358)
//   P4  ⚠ CONTRÔLE ADVERSE, écrit pour dire NON : si la salle XVI a raison de publier
//       que le critère du U « ne voit que le biais », alors |r(U, piles)| > 0,6.
//                                                       → TENUE (0,751)
//   P5  CONTRÔLE NUL : sur sept instruments construits indépendants, l'estimateur de
//       rang doit rendre 7,00 ; sur sept copies du même, 1,00.  → TENU (6,999 / 1,000)
//   P6  contre les menteuses de distance k, le rang en pouvoir s'effondre. → TENUE (0)
// ───────────────────────────────────────────────────────────────────────

import { mulberry32, xorshift128, pieceJuste, pieceBiaisee, correlee,
         plusLongueSerie, nbAlternances, comptePositif } from './hasard.mjs';
import { menteuse, correlationLag, khi2Triplets } from './menteuse.mjs';

const N_BITS = 200;
const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : ' n/a ');
const moy = (a) => { let s = 0; for (const v of a) s += v; return s / a.length; };
const titre = (t) => console.log('\n' + '═'.repeat(78) + '\n' + t + '\n' + '═'.repeat(78));

// ═════════════════════════ les sept colonnes de la grille ═════════════════════════
function khi2Paires(b) {
  const c = [0, 0, 0, 0];
  for (let i = 1; i < b.length; i++) c[(b[i - 1] ? 2 : 0) + (b[i] ? 1 : 0)]++;
  const att = (b.length - 1) / 4;
  return c.reduce((s, o) => s + (o - att) ** 2 / att, 0);
}
/** lag-1 SANS centrage : identiquement 1 − 2·alternance. C'est la clé du § (a). */
function lagNonCentre(b) {
  let s = 0;
  for (let i = 1; i < b.length; i++) s += (b[i - 1] ? 1 : -1) * (b[i] ? 1 : -1);
  return s / (b.length - 1);
}

const INSTR = [
  ['piles   ', (b) => b.filter(Boolean).length],
  ['alt     ', (b) => nbAlternances(b) / (b.length - 1)],
  ['lag1    ', (b) => correlationLag(b, 1)],
  ['serie   ', (b) => plusLongueSerie(b)],
  ['paires  ', (b) => khi2Paires(b)],
  ['triplets', (b) => khi2Triplets(b)],
  ['U       ', (b) => comptePositif(b, true) / b.length],
];
const NOMS = INSTR.map(([n]) => n.trim());

// ═════════════════════════ corrélation, Jacobi, rang effectif ═════════════════════════
function correlationMatrice(cols) {
  const p = cols.length, N = cols[0].length;
  const m = cols.map((c) => moy(c));
  const sd = cols.map((c, i) => Math.sqrt(moy(Array.from(c, (v) => (v - m[i]) ** 2))));
  const C = Array.from({ length: p }, () => new Float64Array(p));
  for (let i = 0; i < p; i++) for (let j = i; j < p; j++) {
    let s = 0;
    for (let t = 0; t < N; t++) s += (cols[i][t] - m[i]) * (cols[j][t] - m[j]);
    const r = (sd[i] === 0 || sd[j] === 0) ? 0 : (s / N) / (sd[i] * sd[j]);
    C[i][j] = C[j][i] = r;
  }
  for (let i = 0; i < p; i++) C[i][i] = 1;
  return C;
}

/** Jacobi cyclique — matrice symétrique, valeurs propres décroissantes. */
function valeursPropres(C0) {
  const p = C0.length;
  const A = C0.map((r) => Float64Array.from(r));
  for (let sweep = 0; sweep < 200; sweep++) {
    let off = 0;
    for (let i = 0; i < p; i++) for (let j = i + 1; j < p; j++) off += A[i][j] ** 2;
    if (off < 1e-18) break;
    for (let i = 0; i < p; i++) for (let j = i + 1; j < p; j++) {
      if (Math.abs(A[i][j]) < 1e-15) continue;
      const theta = (A[j][j] - A[i][i]) / (2 * A[i][j]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < p; k++) { const a = A[i][k], b = A[j][k]; A[i][k] = c * a - s * b; A[j][k] = s * a + c * b; }
      for (let k = 0; k < p; k++) { const a = A[k][i], b = A[k][j]; A[k][i] = c * a - s * b; A[k][j] = s * a + c * b; }
    }
  }
  return Array.from({ length: p }, (_, i) => A[i][i]).sort((a, b) => b - a);
}

/** Rang effectif = exp(entropie de Shannon du spectre normalisé).
 *  p instruments indépendants → p. p copies du même → 1. C'est P5 qui le vérifie. */
function rangEffectif(lam) {
  const s = lam.reduce((a, b) => a + Math.max(0, b), 0);
  let H = 0;
  for (const l of lam) { const q = Math.max(0, l) / s; if (q > 1e-12) H -= q * Math.log(q); }
  return Math.exp(H);
}

function echantillon(fab, rnd, N, n = N_BITS) {
  const cols = INSTR.map(() => new Float64Array(N));
  for (let t = 0; t < N; t++) {
    const b = fab(rnd, n);
    for (let i = 0; i < INSTR.length; i++) cols[i][t] = INSTR[i][1](b);
  }
  return cols;
}

console.log('╔════════════════════════════════════════════════════════════════════════════╗');
console.log('║  LE RANG DE MA PROPRE BATTERIE — combien d\'yeux a mon banc ?                ║');
console.log('╚════════════════════════════════════════════════════════════════════════════╝');

// ═══════════════════════════════════ P5 ═══════════════════════════════════
titre('P5 · LE CONTRÔLE NUL — l\'estimateur sait-il compter jusqu\'à sept ?');
console.log('Sept sommes de bits sur des positions DISJOINTES : indépendantes par');
console.log('construction. Rien à trouver. La réponse doit être 7,00, et 1,00 pour');
console.log('sept copies du même instrument. Ce contrôle passe AVANT toute lecture.\n');
{
  const rnd = mulberry32(770077);
  const N = 40000, p = 7, larg = Math.floor(N_BITS / p);
  const cols = Array.from({ length: p }, () => new Float64Array(N));
  for (let t = 0; t < N; t++) {
    const b = pieceJuste(rnd, N_BITS);
    for (let i = 0; i < p; i++) { let s = 0; for (let j = i * larg; j < (i + 1) * larg; j++) s += b[j] ? 1 : 0; cols[i][t] = s; }
  }
  console.log(`  sept instruments indépendants : ${rangEffectif(valeursPropres(correlationMatrice(cols))).toFixed(3)}   (attendu 7,000)`);
  const dup = Array.from({ length: p }, () => cols[0]);
  console.log(`  sept copies du même           : ${rangEffectif(valeursPropres(correlationMatrice(dup))).toFixed(3)}   (attendu 1,000)`);
}

// ═══════════════════════════════════ A ═══════════════════════════════════
titre('A · LE RANG SOUS H0 — mes sept colonnes vues par une vraie pièce (200 000)');
const NH0 = 200000;
const colsH0 = echantillon(pieceJuste, mulberry32(20260903), NH0);
const CH0 = correlationMatrice(colsH0);
console.log('            ' + NOMS.map((n) => n.padStart(9)).join(''));
for (let i = 0; i < NOMS.length; i++)
  // Array.from d'abord : .map() sur un Float64Array reconvertit les chaînes en nombres
  // et mange tout le formatage. Attrapé à la relecture de la sortie, pas du code.
  console.log('  ' + NOMS[i].padEnd(10) + Array.from(CH0[i], (v) => f3(v).padStart(9)).join(''));
const lamH0 = valeursPropres(CH0);
console.log('\n  valeurs propres : ' + lamH0.map((v) => v.toFixed(3)).join('  '));
console.log(`\n  ⭐ RANG EFFECTIF SOUS H0 : ${rangEffectif(lamH0).toFixed(3)}  pour SEPT colonnes annoncées.`);
console.log(`  contrôle, autre famille de générateur (xorshift128) : ` +
  rangEffectif(valeursPropres(correlationMatrice(echantillon(pieceJuste, xorshift128(9, 8, 7, 6), NH0)))).toFixed(3));

const idx = (n) => NOMS.indexOf(n);
console.log('\n  Les trois paquets que la matrice montre :');
console.log(`    alternance ↔ lag-1     r = ${CH0[idx('alt')][idx('lag1')].toFixed(4)}   (P1 disait > 0,999 : TOMBÉE, voir C)`);
console.log(`    paires ↔ triplets      r = ${CH0[idx('paires')][idx('triplets')].toFixed(4)}   — deux khi² emboîtés`);
console.log(`    U ↔ piles              r = ${CH0[idx('U')][idx('piles')].toFixed(4)}   (P4 tenue : le U EST le biais)`);
console.log(`    série ↔ alternance     r = ${CH0[idx('serie')][idx('alt')].toFixed(4)}   (P3 disait > 0,5 : TOMBÉE)`);

// ═══════════════════════════════════ B ═══════════════════════════════════
titre('B · LE RANG EN POUVOIR — les verdicts, pas les valeurs');
console.log('Seuils bilatéraux 5 % CALIBRÉS PAR SIMULATION, jamais pris dans une table');
console.log('(un seuil de manuel appliqué à une fenêtre glissante n\'est pas le bon seuil).\n');
const seuils = INSTR.map((_, i) => {
  const v = Array.from(colsH0[i]).sort((a, b) => a - b);
  return [v[Math.floor(0.025 * (NH0 - 1))], v[Math.floor(0.975 * (NH0 - 1))]];
});
const rejette = (b) => INSTR.map(([, f], i) => { const v = f(b); return (v < seuils[i][0] || v > seuils[i][1]) ? 1 : 0; });

console.log('  taux de rejet sur la VRAIE pièce — doit valoir ~5 % :');
{
  const rnd = mulberry32(31415), N = 40000, c = new Array(7).fill(0);
  for (let t = 0; t < N; t++) { const r = rejette(pieceJuste(rnd, N_BITS)); for (let i = 0; i < 7; i++) c[i] += r[i]; }
  console.log('  ' + NOMS.map((n, i) => `${n} ${(c[i] / N * 100).toFixed(1)}%`).join('  '));
  console.log('  (les statistiques discrètes ne tombent pas juste ; le 0,0 % du U est');
  console.log('   autre chose, et c\'est le § D.)');
}

const OBJETS = [
  ['menteuse k=2  ', (r, n) => menteuse(r, n, 0.10, 2)],
  ['menteuse k=3  ', (r, n) => menteuse(r, n, 0.10, 3)],
  ['menteuse k=5  ', (r, n) => menteuse(r, n, 0.10, 5)],
  ['menteuse k=8  ', (r, n) => menteuse(r, n, 0.10, 8)],
  ['menteuse k=12 ', (r, n) => menteuse(r, n, 0.10, 12)],
  ['menteuse k=20 ', (r, n) => menteuse(r, n, 0.10, 20)],
  ['groupée q=0,30', (r, n) => correlee(r, n, 0.30)],
  ['biaisée 55 %  ', (r, n) => pieceBiaisee(r, n, 0.55)],
];
console.log('\n  objet            ' + NOMS.map((n) => n.padStart(9)).join('') + '   rang(pouvoir)');
console.log('  ' + '─'.repeat(16 + 9 * 7) + '   ─────────────');
for (const [nom, fab] of OBJETS) {
  const rnd = mulberry32(20260921), NP = 40000;
  const V = Array.from({ length: 7 }, () => new Float64Array(NP));
  for (let t = 0; t < NP; t++) { const r = rejette(fab(rnd, N_BITS)); for (let i = 0; i < 7; i++) V[i][t] = r[i]; }
  const pouv = V.map((v) => moy(v));
  // ⚠ Un instrument au niveau du hasard a des verdicts quasi indépendants de tout,
  // ce qui GONFLERAIT le rang. On ne compte comme œil que ce qui voit.
  const vus = [0, 1, 2, 3, 4, 5, 6].filter((i) => pouv[i] > 0.10);
  const rang = vus.length >= 2 ? rangEffectif(valeursPropres(correlationMatrice(vus.map((i) => V[i])))) : vus.length;
  console.log(`  ${nom}   ` + pouv.map((v) => (v * 100).toFixed(1).padStart(8) + '%').join('') +
              `   ${rang.toFixed(2)} sur ${vus.length}`);
}
console.log('\n  ⭐ Sous H0 ma grille a 4,4 yeux. Contre une menteuse groupée, 5.');
console.log('     Contre une menteuse de distance k, ZÉRO — pas un œil faible : aucun.');
console.log('     Le rang d\'une batterie n\'est pas une propriété de la batterie :');
console.log('     c\'est une propriété du COUPLE (batterie, adversaire).');

// ═══════════════════════════════════ C ═══════════════════════════════════
titre('C · LA PHRASE QUE J\'AI PUBLIÉE CE SOIR ET QUI EST FAUSSE');
console.log('19h46 : « lag-1 et le taux d\'alternance donnent le même nombre au millième —');
console.log('ce ne sont pas deux instruments, c\'est un seul écrit deux fois. »');
console.log('Vrai sur MA suite. Un point. Voici les 200 000 autres.\n');
{
  const rnd = mulberry32(20260903), N = 200000;
  const A = new Float64Array(N), L = new Float64Array(N), LN = new Float64Array(N), P = new Float64Array(N);
  for (let t = 0; t < N; t++) {
    const b = pieceJuste(rnd, N_BITS);
    A[t] = nbAlternances(b) / (N_BITS - 1); L[t] = correlationLag(b, 1);
    LN[t] = lagNonCentre(b); P[t] = b.filter(Boolean).length;
  }
  const corr = (x, y) => {
    const mx = moy(x), my = moy(y);
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < x.length; i++) { const a = x[i] - mx, b = y[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
    return sxy / Math.sqrt(sxx * syy);
  };
  let ecart = 0;
  for (let i = 0; i < N; i++) ecart = Math.max(ecart, Math.abs(LN[i] - (1 - 2 * A[i])));
  console.log(`  r(alternance, lag-1 de Pearson) = ${corr(A, L).toFixed(6)}      ← PAS −1`);
  console.log(`  r(alternance, lag-1 NON centré) = ${corr(A, LN).toFixed(6)}      ← l'identité est ICI`);
  console.log(`  écart max |lag-1 non centré − (1 − 2·alternance)| = ${ecart.toExponential(2)}`);
  const res = new Float64Array(N), p2 = new Float64Array(N);
  for (let i = 0; i < N; i++) { res[i] = L[i] - LN[i]; p2[i] = (P[i] - N_BITS / 2) ** 2; }
  console.log(`  r(résidu des deux colonnes, écart au demi-effectif au carré) = ${corr(res, p2).toFixed(6)}`);
  const q = (v, p) => { const s = Array.from(v).sort((a, b) => a - b); return s[Math.floor(p * (N - 1))]; };
  const [a1, a2] = [q(A, 0.025), q(A, 0.975)], [l1, l2] = [q(L, 0.025), q(L, 0.975)];
  let d = 0;
  for (let i = 0; i < N; i++) if (((A[i] < a1 || A[i] > a2) ? 1 : 0) !== ((L[i] < l1 || L[i] > l2) ? 1 : 0)) d++;
  console.log(`  les deux colonnes rendent des verdicts DIFFÉRENTS sur ${(d / N * 100).toFixed(2)} % des vraies pièces.\n`);
  console.log('  Le lag-1 de Pearson est CENTRÉ par la moyenne de la suite : son résidu est');
  console.log('  le terme de centrage, c\'est-à-dire une fonction du nombre de piles — la');
  console.log('  première colonne de la grille. Ce ne sont donc pas deux colonnes pour une :');
  console.log('  ce sont TROIS colonnes pour deux directions. La correction est plus petite');
  console.log('  que l\'erreur annoncée, et c\'est justement le problème :');
  console.log('  ⭐ UNE IDENTITÉ VÉRIFIÉE SUR UN SEUL POINT N\'EST PAS UNE IDENTITÉ.');
}

// ═══════════════════════════════════ D ═══════════════════════════════════
titre('D · LE 0,0 % DU CRITÈRE DU U — aveugle, ou intestable ?');
console.log('Deux lectures très différentes de la même case du tableau B.\n');
{
  const rnd = mulberry32(555777), N = 200000;
  let z0 = 0, z1 = 0;
  for (let t = 0; t < N; t++) { const u = comptePositif(pieceJuste(rnd, N_BITS), true) / N_BITS; if (u === 0) z0++; if (u === 1) z1++; }
  const theo = 1 / Math.sqrt(Math.PI * N_BITS / 2);
  console.log(`  P(U = 0) = ${(z0 / N * 100).toFixed(3)} %     P(U = 1) = ${(z1 / N * 100).toFixed(3)} %`);
  console.log(`  loi de l'arcsinus discrète : C(n,n/2)·2⁻ⁿ ≈ 1/√(πn/2) = ${(theo * 100).toFixed(3)} %`);
  console.log(`\n  ⭐ Chaque atome extrême pèse ${(z0 / N * 100).toFixed(1)} % — PLUS que les 2,5 % d'une queue.`);
  console.log(`  Aucun seuil bilatéral non randomisé ne peut donc valoir 5 % : il vaut 0 %`);
  console.log(`  (l'atome exclu) ou ${((z0 + z1) / N * 100).toFixed(1)} % (l'atome inclus). Rien entre les deux.`);
  console.log('\n  Le 0,0 % ne disait pas « cet instrument ne voit rien ». Il disait « à cette');
  console.log('  longueur, ce test n\'existe pas ». ⭐ Un taux de rejet nul a deux causes, et');
  console.log('  la case du tableau ne les distingue pas.\n');
  console.log('  à partir de quelle longueur le U redevient-il testable à 5 % ?');
  for (const nn of [200, 400, 800, 1600, 3200]) {
    const r3 = mulberry32(1000 + nn), M = 40000; let z = 0;
    for (let t = 0; t < M; t++) { const u = comptePositif(pieceJuste(r3, nn), true) / nn; if (u === 0 || u === 1) z++; }
    console.log(`     n = ${String(nn).padStart(5)}   masse des deux atomes = ${(z / M * 100).toFixed(2)} %` + (z / M < 0.05 ? '   ← testable' : ''));
  }
}
console.log('');
