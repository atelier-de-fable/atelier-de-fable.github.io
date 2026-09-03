// ═══════════════════════════════════════════════════════════════════════════════
// LA MENTEUSE QUI PASSE — banc de la salle XVI, second mur
// Atelier de Fable · jeudi 3 septembre 2026, éveil de 19h46
//
// Question : la grille de la salle XVI est-elle cassable ? Réponse : oui, et par
// construction. Ce fichier fabrique la menteuse, la passe à tous les instruments
// publiés deux heures plus tôt, et produit TOUS les chiffres du second mur.
//
//   node outils/menteuse.mjs
//
// Il n'a aucune ligne d'instrument à lui : il IMPORTE outils/hasard.mjs. C'est
// délibéré — un banc qui réécrit ses propres instruments ne les contrôle pas.
// Préinscription : fable/preinscription-2026-09-03-19h46.md (hors dépôt).
// ═══════════════════════════════════════════════════════════════════════════════

import {
  mulberry32, xorshift128, pieceJuste, correlee,
  plusLongueSerie, nbAlternances, comptePositif, critereU,
  loiPlusLongueSerie, MA_SUITE,
} from './hasard.mjs';

// Garde ajoutée le 3/09 à 22h10 : ce fichier exportait ses fonctions mais imprimait
// son rapport entier dès qu'on l'importait. Un module qui exécute son rapport à
// l'import n'est pas un module, c'est un script. Découvert en l'important depuis
// outils/rang.mjs. Le rapport est inchangé quand on le lance directement.
const RAPPORT = !!process.argv[1]?.endsWith('menteuse.mjs');

const f1 = (x) => x.toFixed(1);
const f3 = (x) => x.toFixed(3);
const moy = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const median = (a) => { const t = [...a].sort((x, y) => x - y); return t[Math.floor(t.length / 2)]; };
const quantile = (a, p) => { const t = [...a].sort((x, y) => x - y); return t[Math.floor(p * (t.length - 1))]; };
const titre = (t) => console.log('\n' + '═'.repeat(78) + '\n' + t + '\n' + '═'.repeat(78));

// ════════════════════════════════ LA MENTEUSE ════════════════════════════════
// Le bit n ne dépend QUE du bit n−k :
//     P(x[n] = 1) = 1/2 − e  si x[n−k] = 1 ,  1/2 + e  sinon.
// C'est k marches ENTRELACÉES, chacune une pièce anti-groupée d'ordre 1.
// Conséquence : k bits consécutifs sont mutuellement indépendants, donc tous les
// blocs de longueur ≤ k ont exactement la loi de la pièce juste. Elle ne peut
// fuir qu'à la distance k — et, on le verra, à ses multiples.
export function menteuse(rnd, n, e = 0.10, k = 3) {
  const out = [];
  for (let i = 0; i < n; i++) {
    if (i < k) { out.push(rnd() < 0.5); continue; }
    out.push(rnd() < (out[i - k] ? 0.5 - e : 0.5 + e));
  }
  return out;
}

// ══════════════════════════════ LES INSTRUMENTS ══════════════════════════════
export function correlationLag(b, j) {
  const s = b.map((x) => (x ? 1 : -1));
  const m = b.length - j;
  let sxy = 0, sx = 0, sy = 0;
  for (let i = j; i < b.length; i++) { sxy += s[i] * s[i - j]; sx += s[i]; sy += s[i - j]; }
  const mx = sx / m, my = sy / m;
  return (sxy / m - mx * my) / Math.sqrt((1 - mx * mx) * (1 - my * my));
}
export const zLag = (b, j) => correlationLag(b, j) * Math.sqrt(b.length - j);
export const maxZ = (b, L) => Math.max(...Array.from({ length: L }, (_, i) => Math.abs(zLag(b, i + 1))));

// khi-deux de Pearson sur les 8 triplets. ATTENTION : les triplets se CHEVAUCHENT,
// donc cette statistique n'est PAS un χ²(7). Son seuil est calibré plus bas.
export function khi2Triplets(b) {
  const t = new Array(8).fill(0);
  for (let i = 2; i < b.length; i++) t[(b[i - 2] ? 4 : 0) + (b[i - 1] ? 2 : 0) + (b[i] ? 1 : 0)]++;
  const N = b.length - 2, att = N / 8;
  return t.reduce((s, o) => s + (o - att) ** 2 / att, 0);
}
const alt = (b) => nbAlternances(b) / (b.length - 1);
const sym = (b) => b.filter(Boolean).length / b.length;

// Le jeu : 4 suites, le visiteur prend le maximum du score, et TIRE AU SORT parmi
// les ex aequo. Exiger un maximum strict fait perdre le visiteur sur une égalité :
// c'est ce que faisait mon premier banc, et il accusait le geste publié de 8 points.
function gagne(v, rnd) {
  const m = Math.max(...v);
  const ex = v.map((x, i) => (x === m ? i : -1)).filter((i) => i >= 0);
  return ex[Math.floor(rnd() * ex.length)] === 0;
}

// ═══════════════════════════════════ 1 ═══════════════════════════════════
if (RAPPORT) {
titre('1 · ELLE PASSE — la grille publiée de la salle XVI, avec la menteuse dedans');
  const n = 1000, BLOCS = 10, PAR_BLOC = 10000;
  const objets = [
    ['pièce juste',            (r, m) => pieceJuste(r, m)],
    ['MENTEUSE k=3  e=0,10',   (r, m) => menteuse(r, m, 0.10, 3)],
    ['MENTEUSE k=8  e=0,10',   (r, m) => menteuse(r, m, 0.10, 8)],
    ['anti-groupée 9/10',      (r, m) => correlee(r, m, 0.9)],
  ];
  console.log('objet                  |  rapport U (mulberry32) |  rapport U (xorshift128)');
  console.log('-'.repeat(78));
  for (const [nom, fab] of objets) {
    const out = [];
    for (const mk of [() => mulberry32(20260903), () => xorshift128(11, 22, 33, 44)]) {
      const rnd = mk(), vals = [];
      for (let b = 0; b < BLOCS; b++) {
        const fr = [];
        for (let i = 0; i < PAR_BLOC; i++) fr.push(comptePositif(fab(rnd, n), true) / n);
        vals.push(critereU(fr).rapport);
      }
      const m = moy(vals);
      out.push(`${f3(m)} ± ${f3(Math.sqrt(moy(vals.map((v) => (v - m) ** 2)) / (BLOCS - 1)))}`);
    }
    console.log(nom.padEnd(22) + ' | ' + out[0].padStart(22) + '  | ' + out[1].padStart(22));
  }
  console.log('\n→ le rapport du U ne sépare RIEN : les barres se recouvrent toutes.');
}

if (RAPPORT) {
titre('2 · LES AUTRES INSTRUMENTS DE LA GRILLE, À 200 BITS (100 000 suites)');
  const loi = loiPlusLongueSerie(200);
  const cols = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
  console.log('objet          | alternance | symétrie | série moy. |' + cols.map((L) => String(L).padStart(5)).join(''));
  console.log('-'.repeat(78));
  for (const [nom, fab] of [['vraie pièce', (r) => pieceJuste(r, 200)],
                            ['menteuse k=3', (r) => menteuse(r, 200, 0.10, 3)],
                            ['menteuse k=8', (r) => menteuse(r, 200, 0.10, 8)]]) {
    const rnd = mulberry32(1234);
    const S = [], A = [], Y = [];
    for (let i = 0; i < 100000; i++) { const b = fab(rnd); S.push(plusLongueSerie(b)); A.push(alt(b)); Y.push(sym(b)); }
    console.log(nom.padEnd(14) + ' | ' + f3(moy(A)).padStart(10) + ' | ' + f3(moy(Y)).padStart(8) +
      ' | ' + f3(moy(S)).padStart(10) + ' |' +
      cols.map((L) => (100 * S.filter((x) => x === L).length / S.length).toFixed(1).padStart(5)).join(''));
  }
  console.log('loi exacte     |      0.500 |    0.500 |      7.977 |' +
    cols.map((L) => (100 * loi[L]).toFixed(1).padStart(5)).join(''));
  console.log('\n→ k=8 rend même la MOYENNE de la plus longue série (7,89 contre 7,98).');
}

if (RAPPORT) {
titre('3 · LE TEST DES TRIPLETS — et pourquoi son seuil de manuel est faux');
  const rnd = mulberry32(555);
  const K = [];
  for (let i = 0; i < 200000; i++) K.push(khi2Triplets(pieceJuste(rnd, 200)));
  const seuil = quantile(K, 0.95);
  console.log(`Sous la VRAIE pièce (200 000 suites de 200 bits) :`);
  console.log(`  moyenne ${f3(moy(K))} — χ²(7) attendrait 7,000, et la moyenne est juste.`);
  console.log(`  quantile 95 % MESURÉ : ${f3(seuil)}, contre le seuil de table χ²(7) = 14,07.`);
  console.log(`  Au seuil de table, le test rejette ${f1(100 * K.filter((x) => x > 14.07).length / K.length)} %`);
  console.log(`  de vraies pièces là où il annonce 5 %. Les triplets se chevauchent : même`);
  console.log(`  moyenne, variance plus grande. Un seuil de manuel appliqué à une statistique`);
  console.log(`  de fenêtre glissante n'est pas le bon seuil.\n`);
  console.log(`Avec le seuil CALIBRÉ (${f3(seuil)}), taux de rejet :`);
  for (const [nom, fab] of [['pièce juste', (r, m) => pieceJuste(r, m)],
                            ['menteuse k=3', (r, m) => menteuse(r, m, 0.10, 3)],
                            ['menteuse k=8', (r, m) => menteuse(r, m, 0.10, 8)],
                            ['anti-groupée 9/10', (r, m) => correlee(r, m, 0.9)]]) {
    const r2 = mulberry32(556);
    let d = 0; const R = 50000;
    for (let i = 0; i < R; i++) if (khi2Triplets(fab(r2, 200)) > seuil) d++;
    console.log('  ' + nom.padEnd(20) + f1(100 * d / R).padStart(6) + ' %');
  }
  console.log('\n→ les menteuses rejettent MOINS souvent que la vraie pièce : aveuglement complet.');
}

if (RAPPORT) {
titre('4 · OÙ ELLE FUIT — et ma préinscription disait « seule fuite », ce qui est faux');
  const b = menteuse(mulberry32(4242), 100000, 0.10, 3);
  console.log('menteuse k=3, 100 000 bits. Loi trouvée APRÈS coup : corrélation (−2e)^m à la distance 3m.');
  console.log('  lag |        z | corrélation | (−0,2)^m attendu');
  console.log('-'.repeat(78));
  for (const j of [1, 2, 3, 4, 5, 6, 9, 12]) {
    console.log(String(j).padStart(5) + ' | ' + f3(zLag(b, j)).padStart(8) + ' | ' +
      correlationLag(b, j).toFixed(4).padStart(11) + ' | ' +
      (j % 3 === 0 ? Math.pow(-0.2, j / 3) : 0).toFixed(4).padStart(16));
  }
  console.log('\n→ elle fuit à 3, 6, 9, 12… en géométrique. Ce qui reste vrai, et suffit :');
  console.log('  RIEN ne fuit AVANT la distance k. Tous les blocs de longueur ≤ k sont parfaits.');
}

if (RAPPORT) {
titre('5 · LE JEU DE LA SALLE XVI EST-IL ENCORE GAGNABLE ? (20 000 parties, 200 bits)');
  console.log('1 menteuse + 3 vraies pièces. Le visiteur choisit une suite. Hasard pur : 25,0 %.');
  console.log('Les ex aequo sont départagés AU SORT — les compter perdants accuserait à tort.\n');
  console.log('  k | plus longue série | balayage 1…12 | balayage 1…50 | balayage 1…99');
  console.log('-'.repeat(78));
  const P = 20000;
  for (const k of [3, 5, 8, 12, 20, 50]) {
    const rnd = mulberry32(2718);
    let a = 0, b = 0, c = 0, d = 0;
    for (let i = 0; i < P; i++) {
      const S = [menteuse(rnd, 200, 0.10, k), pieceJuste(rnd, 200), pieceJuste(rnd, 200), pieceJuste(rnd, 200)];
      if (gagne(S.map((s) => -plusLongueSerie(s)), rnd)) a++;
      if (gagne(S.map((s) => maxZ(s, 12)), rnd)) b++;
      if (gagne(S.map((s) => maxZ(s, 50)), rnd)) c++;
      if (gagne(S.map((s) => maxZ(s, 99)), rnd)) d++;
    }
    console.log(String(k).padStart(3) + ' | ' + f1(100 * a / P).padStart(16) + ' % | ' +
      f1(100 * b / P).padStart(12) + ' % | ' + f1(100 * c / P).padStart(12) + ' % | ' +
      f1(100 * d / P).padStart(12) + ' %');
  }
  // les deux contrôles qui rendent ce tableau lisible
  const P2 = 20000;
  for (const [nom, fab] of [['QUATRE vraies pièces (aucune menteuse)', (r) => pieceJuste(r, 200)],
                            ['ma main du 17h46', () => MA_SUITE]]) {
    const rnd = mulberry32(4321);
    let a = 0;
    for (let i = 0; i < P2; i++) {
      const S = [fab(rnd), pieceJuste(rnd, 200), pieceJuste(rnd, 200), pieceJuste(rnd, 200)];
      if (gagne(S.map((s) => -plusLongueSerie(s)), rnd)) a++;
    }
    console.log('\nContrôle · ' + nom.padEnd(38) + ' : ' + f1(100 * a / P2) + ' %');
  }
  console.log('  (le premier doit valoir 25,0 % ou mon départage est biaisé ; le second 100 %,');
  console.log('   car le jeu publié attrape toujours ma main.)');
}

if (RAPPORT) {
titre('6 · LE COÛT DE NE PAS SAVOIR OÙ REGARDER (20 000 essais, 200 bits)');
  console.log('  k | paires disponibles | connaît k | balaye 1…99 et corrige');
  console.log('-'.repeat(78));
  for (const k of [3, 8, 20, 50, 80]) {
    const rnd = mulberry32(606);
    let a = 0, b = 0; const R = 20000;
    for (let i = 0; i < R; i++) {
      const s = menteuse(rnd, 200, 0.10, k);
      if (Math.abs(zLag(s, k)) > 1.96) a++;
      if (maxZ(s, 99) > 3.48) b++;
    }
    console.log(String(k).padStart(3) + ' | ' + String(200 - k).padStart(18) + ' | ' +
      f1(100 * a / R).padStart(8) + ' % | ' + f1(100 * b / R).padStart(21) + ' %');
  }
  const rnd = mulberry32(607);
  let fp = 0; const R = 20000;
  for (let i = 0; i < R; i++) if (maxZ(pieceJuste(rnd, 200), 99) > 3.48) fp++;
  console.log('\nContrôle du seuil corrigé sur la vraie pièce : ' + f1(100 * fp / R) + ' % (visé 5 %).');
  console.log('→ savoir OÙ regarder vaut deux fois et demie regarder partout.');
}

if (RAPPORT) {
titre('7 · LA THÈSE — pour tout k, une menteuse invisible à tous les blocs ≤ k');
  console.log('  k | série médiane (200 bits) | alternance | symétrie | 1er lag qui fuit');
  console.log('-'.repeat(78));
  for (const k of [2, 3, 4, 5, 6, 8, 12, 20]) {
    const rnd = mulberry32(31337);
    const S = [], A = [], Y = [];
    for (let i = 0; i < 20000; i++) { const b = menteuse(rnd, 200, 0.10, k); S.push(plusLongueSerie(b)); A.push(alt(b)); Y.push(sym(b)); }
    const gros = menteuse(mulberry32(99), 200000, 0.10, k);
    let premier = 0;
    for (let j = 1; j <= 25; j++) if (Math.abs(zLag(gros, j)) > 4) { premier = j; break; }
    console.log(String(k).padStart(3) + ' | ' + String(median(S)).padStart(24) + ' | ' +
      f3(moy(A)).padStart(10) + ' | ' + f3(moy(Y)).padStart(8) + ' | ' + String(premier).padStart(16));
  }
  console.log('\n(vraie pièce : médiane 8, alternance 0,500, symétrie 0,500)');
}

if (RAPPORT) {
titre('8 · CONTRÔLE · MA MAIN N\'EST PAS UNE MENTEUSE D\'ORDRE FINI');
  console.log('Je prédisais : « lag-3 ne dira rien de particulier sur ma suite du 17h46 ».');
  console.log('Prédiction tombée. Seuil corrigé pour 12 tests : |z| > 3,02.\n');
  let s = 0;
  const l = [];
  for (let j = 1; j <= 12; j++) {
    const z = zLag(MA_SUITE, j);
    if (Math.abs(z) > 3.02) s++;
    l.push(`lag-${j} ${f3(z)}${Math.abs(z) > 3.02 ? '*' : ' '}`);
  }
  console.log('  ' + l.slice(0, 6).join('   '));
  console.log('  ' + l.slice(6).join('   '));
  console.log(`\n→ ${s} distances sur 12 significatives après correction. Attendu sous H0 : 0,6.`);
  console.log('  Ma main n\'a pas UN défaut à une distance : elle en a partout à la fois.');
  console.log('  Contrôle : lag-1 (' + f3(zLag(MA_SUITE, 1)) + ') et le taux d\'alternance (' +
    f3(alt(MA_SUITE)) + ')');
  console.log('  donnent la même chose — (1−2×0,663)×√199 = ' + f3((1 - 2 * alt(MA_SUITE)) * Math.sqrt(199)) + '.');
  console.log('\n  ⚠ CORRIGÉ LE 3/09 À 22h30 par outils/rang.mjs. Ce banc écrivait ici : « ce ne');
  console.log('  sont pas deux instruments de la grille, c\'est un seul écrit deux fois ». C\'est');
  console.log('  FAUX, et l\'erreur est d\'avoir conclu à une identité depuis UN SEUL point.');
  console.log('  Sur 200 000 vraies pièces, r(alternance, lag-1) = −0,99498, pas −1 : le lag-1');
  console.log('  de Pearson est CENTRÉ par la moyenne, donc il dépend aussi du nombre de piles.');
  console.log('  C\'est le lag-1 NON centré qui vaut exactement 1−2·alternance (r = −1,000000).');
  console.log('  Les deux colonnes rendent des verdicts différents sur 0,61 % des vraies pièces.');
}
