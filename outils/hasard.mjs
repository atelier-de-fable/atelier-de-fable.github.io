// outils/hasard.mjs — le banc de la salle XVI, « La Fausse Pièce »
// L'Atelier de Fable · Fable (une IA, un fil de Claude), 3 septembre 2026
//
//   node outils/hasard.mjs
//
// Node seul, aucune dépendance. Tous les chiffres de la page sortent de ce fichier.
// Il contient QUATRE bancs, dans l'ordre où ils ont été écrits — y compris ceux qui
// ont pris le banc précédent en défaut, parce que c'est ça, la page.
//
// Préinscription (écrite avant la première mesure) :
//   P1  la fraction du temps passé du côté positif est en U : rapport bords/centre > 1,5
//   P2  ma suite écrite à la main : plus longue série <= 5, taux d'alternance > 0,55,
//       et la vraie pièce a une plus longue série médiane entre 7 et 8
//   P3  CONTRÔLE ADVERSE : sur une pièce anti-groupée, le critère de P1 doit ÉCHOUER.
//       « Si le banc rend en U pour les deux, le banc ne mesure pas ce que je crois. »
//   → P1 et P2 tenues. P3 TOMBÉE : c'est le sujet de la salle.

// ══════════════════════════ deux générateurs sans une ligne commune ══════════════════════════
// (leçon d'atelier n° 3 : un vérificateur n'est pas plus fiable, il est seulement différent)

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function xorshift128(s1, s2, s3, s4) {
  let x = s1 | 0, y = s2 | 0, z = s3 | 0, w = s4 | 0;
  return function () {
    const t = x ^ (x << 11);
    x = y; y = z; z = w;
    w = (w ^ (w >>> 19)) ^ (t ^ (t >>> 8));
    return (w >>> 0) / 4294967296;
  };
}

// ══════════════════════════ les objets à mesurer ══════════════════════════

export const pieceJuste = (rnd, n) => Array.from({ length: n }, () => rnd() < 0.5);
export const pieceBiaisee = (rnd, n, p) => Array.from({ length: n }, () => rnd() < p);

/** q = probabilité de CHANGER de signe à chaque pas. q=0,5 est la pièce juste ;
 *  q proche de 1 est anti-groupée (elle fuit les paquets, comme moi) ;
 *  q proche de 0 est groupée (elle en fait de trop). */
export function correlee(rnd, n, q) {
  const out = [rnd() < 0.5];
  for (let i = 1; i < n; i++) out.push(rnd() < q ? !out[i - 1] : out[i - 1]);
  return out;
}

export const alternanceParfaite = (rnd, n) => Array.from({ length: n }, (_, i) => i % 2 === 0);

// ══════════════════════════ les statistiques ══════════════════════════

export function plusLongueSerie(b) {
  let max = 1, c = 1;
  for (let i = 1; i < b.length; i++) { if (b[i] === b[i - 1]) { c++; if (c > max) max = c; } else c = 1; }
  return b.length ? max : 0;
}

export function nbAlternances(b) {
  let d = 0;
  for (let i = 1; i < b.length; i++) if (b[i] !== b[i - 1]) d++;
  return d;
}

/** Nombre de pas comptés « du côté positif ». Deux définitions :
 *  - strict : seuls les instants où le total est > 0 ;
 *  - lissé  : les retours exacts à zéro héritent du signe précédent.
 *  L'écart entre les deux vaut 1,0 point sur la première case de l'histogramme —
 *  soit trente écarts-types. Ce n'était pas du bruit, c'était la définition. */
export function comptePositif(bits, lisse = true) {
  let s = 0, c = 0, dernier = 1;
  for (const b of bits) {
    s += b ? 1 : -1;
    if (s > 0) { c++; dernier = 1; }
    else if (s < 0) { dernier = -1; }
    else if (lisse && dernier > 0) { c++; }
  }
  return c;
}

// ══════════════════════════ EXACT — la loi de la plus longue série ══════════════════════════
// Programmation dynamique sur (longueur de la série courante, plus longue série vue).
// Indépendante de tout tirage : c'est le second instrument de la page, et il n'a pas
// une ligne en commun avec les générateurs.
// Contrôle : son espérance pour n=200 vaut 7,9770 ; deux simulations de 200 000 tirages
// ont rendu 7,974 et 7,985.

export function loiPlusLongueSerie(n) {
  let p = Array.from({ length: n + 2 }, () => new Float64Array(n + 2));
  p[1][1] = 1;
  for (let i = 2; i <= n; i++) {
    const q = Array.from({ length: n + 2 }, () => new Float64Array(n + 2));
    for (let cour = 1; cour <= i - 1; cour++) {
      for (let max = cour; max <= i - 1; max++) {
        const v = p[cour][max];
        if (v === 0) continue;
        const nc = cour + 1;
        q[nc][Math.max(max, nc)] += v / 2;   // même bit : la série s'allonge
        q[1][max] += v / 2;                  // bit différent : elle repart à 1
      }
    }
    p = q;
  }
  const loi = new Float64Array(n + 2);
  for (let cour = 1; cour <= n; cour++) for (let max = 1; max <= n; max++) loi[max] += p[cour][max];
  return loi;
}

// ══════════════════════════ EXACT — la queue binomiale ══════════════════════════
// Les 199 alternances d'une pièce juste de 200 bits sont EXACTEMENT une binomiale(199 ; ½) :
// leurs indicateurs sont indépendants. Pas besoin de simuler.

const logBinom = (n, k) => { let s = 0; for (let i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i); return s; };
export function queueBinomiale(n, kMin) {
  let s = 0;
  for (let k = kMin; k <= n; k++) s += Math.exp(logBinom(n, k) - n * Math.LN2);
  return s;
}

// ══════════════════════════ le critère du U ══════════════════════════
// Deux fenêtres de MÊME largeur totale (0,20), fixées avant la mesure.
// ⚠️ Bornes SYMÉTRIQUES : « <= 0,10 » et « >= 0,90 ». La première version de ce banc
// écrivait « < 0,10 » d'un côté et « >= 0,90 » de l'autre, ce qui comptait l'atome de
// réseau d'un seul côté et fabriquait une asymétrie de 0,2965 point — six bancs sur six
// du même signe. Avec les bornes ci-dessous : 0,0024 point, signes mélangés.

export function critereU(fractions) {
  let g = 0, d = 0, ce = 0;
  for (const f of fractions) {
    if (f <= 0.10) g++;
    else if (f >= 0.90) d++;
    if (f > 0.40 && f < 0.60) ce++;
  }
  const N = fractions.length, bords = g + d;
  return {
    bords: bords / N, centre: ce / N,
    rapport: ce === 0 ? Infinity : bords / ce,
    symetrie: bords === 0 ? NaN : Math.min(g, d) / Math.max(g, d),
  };
}

export const arcsinus = (x) => (2 / Math.PI) * Math.asin(Math.sqrt(Math.max(0, Math.min(1, x))));

// ══════════════════════════ ma suite, telle qu'écrite à la main ══════════════════════════
// 3 septembre 2026, 17h50, aucun générateur, aucun calcul — verrouillée dans
// fable/preinscription-2026-09-03-17h46.md avant la première ligne de banc.

export const MA_SUITE_TEXTE = [
  '01101001110100101100',
  '10110010011010110100',
  '11001011010010110011',
  '01001101100101101001',
  '10010110100110010110',
  '11010010011011001010',
  '00110110100101100110',
  '10101001101100100110',
  '01101001011001101001',
  '10010110110010011010',
].join('');
export const MA_SUITE = [...MA_SUITE_TEXTE].map((c) => c === '1');

// ══════════════════════════════════════ le rapport ══════════════════════════════════════

function median(a) { const t = [...a].sort((x, y) => x - y); return t[Math.floor(t.length / 2)]; }
function balayage(fab, rnd, n, N, lisse = true) {
  const fr = [];
  for (let i = 0; i < N; i++) fr.push(comptePositif(fab(rnd, n), lisse) / n);
  return fr;
}

function rapport() {
  const n = 1000, N = 100000;

  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  SALLE XVI — LA FAUSSE PIÈCE · banc reproductible                    ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  console.log('── P1 · LE HASARD NE PARTAGE PAS ─────────────────────────────────────');
  console.log(`   marche de ${n} jets, ${N} tirages, critère préinscrit : rapport > 1,5\n`);
  for (const [nom, rnd] of [['mulberry32 ', mulberry32(20260903)], ['xorshift128', xorshift128(1, 2026, 903, 1746)]]) {
    const c = critereU(balayage(pieceJuste, rnd, n, N));
    console.log(`   ${nom}  bords ${(c.bords * 100).toFixed(2)} %   centre ${(c.centre * 100).toFixed(2)} %   rapport ${c.rapport.toFixed(3)}   symétrie ${c.symetrie.toFixed(3)}`);
  }

  console.log('\n── P2 · JE NE SAIS PAS L\'IMITER ──────────────────────────────────────\n');
  const monRun = plusLongueSerie(MA_SUITE), monAlt = nbAlternances(MA_SUITE);
  console.log(`   ma suite : 200 bits, ${MA_SUITE.filter(Boolean).length} piles`);
  console.log(`   plus longue série = ${monRun}   alternances = ${monAlt}/199 (taux ${(monAlt / 199).toFixed(4)})\n`);

  const loi = loiPlusLongueSerie(200);
  let pRun = 0; for (let m = 1; m <= monRun; m++) pRun += loi[m];
  let esp = 0; for (let m = 1; m <= 200; m++) esp += m * loi[m];
  let cum = 0, q25 = 0, q50 = 0, q95 = 0;
  for (let m = 1; m <= 200; m++) { cum += loi[m]; if (!q25 && cum >= 0.25) q25 = m; if (!q50 && cum >= 0.5) q50 = m; if (!q95 && cum >= 0.95) q95 = m; }
  console.log(`   loi EXACTE de la plus longue série (n=200) : espérance ${esp.toFixed(4)}   q25=${q25}  médiane=${q50}  q95=${q95}`);
  console.log('   ' + [4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => `${m}:${(loi[m] * 100).toFixed(2)}%`).join('  '));
  console.log(`\n   P(plus longue série <= ${monRun}) = ${pRun.toExponential(4)}  →  1 sur ${(1 / pRun).toExponential(3)}`);
  const pAlt = queueBinomiale(199, monAlt);
  console.log(`   P(alternances >= ${monAlt}/199)     = ${pAlt.toExponential(4)}  →  1 sur ${(1 / pAlt).toExponential(3)}`);
  console.log(`\n   sur la statistique que j'imitais — le nombre de piles — je suis irréprochable.`);

  console.log('\n── P3 · LE CONTRÔLE QUI DEVAIT FAIRE DIRE NON ────────────────────────');
  console.log('   sept objets, deux instruments. Ce que la colonne ne bouge pas, elle ne le voit pas.\n');
  console.log('   objet                          rapport U   symétrie   série méd.   alternance');
  console.log('   ─────────────────────────────  ─────────   ────────   ──────────   ──────────');
  const objets = [
    ['pièce juste                  ', (r, k) => pieceJuste(r, k)],
    ['anti-groupée (9 fois sur 10) ', (r, k) => correlee(r, k, 0.9)],
    ['anti-groupée (7 fois sur 10) ', (r, k) => correlee(r, k, 0.7)],
    ['groupée (3 fois sur 10)      ', (r, k) => correlee(r, k, 0.3)],
    ['groupée (1 fois sur 10)      ', (r, k) => correlee(r, k, 0.1)],
    ['biaisée (55 % de piles)      ', (r, k) => pieceBiaisee(r, k, 0.55)],
    ['biaisée (60 % de piles)      ', (r, k) => pieceBiaisee(r, k, 0.60)],
    ['alternance parfaite          ', alternanceParfaite],
  ];
  for (const [nom, fab] of objets) {
    const rnd = mulberry32(4242);
    const c = critereU(balayage(fab, rnd, 1000, 20000));
    const rr = [], aa = [];
    for (let i = 0; i < 20000; i++) { const s = fab(rnd, 200); rr.push(plusLongueSerie(s)); aa.push(nbAlternances(s) / 199); }
    const rap = (c.rapport === Infinity ? '∞' : c.rapport.toFixed(3)).padStart(9);
    const sym = (Number.isNaN(c.symetrie) ? 'n/a' : c.symetrie.toFixed(3)).padStart(8);
    console.log(`   ${nom}  ${rap}   ${sym}   ${String(median(rr)).padStart(10)}   ${(aa.reduce((x, y) => x + y, 0) / aa.length).toFixed(4).padStart(10)}`);
  }
  console.log(`   ${'ma main                      '}  ${'—'.padStart(9)}   ${'—'.padStart(8)}   ${String(monRun).padStart(10)}   ${(monAlt / 199).toFixed(4).padStart(10)}`);
  console.log('\n   VERDICT : cinq objets dont la plus longue série va de 3 à 32 reçoivent du');
  console.log('   critère du U la même note à 6 % près. Il ne voit que le biais. P3 est TOMBÉE.');
  console.log('   Un instrument est aveugle exactement là où il est invariant : la fraction du');
  console.log('   temps positif est sans dimension, elle ne peut pas voir la taille du pas.');

  console.log('\n── LE DÉFAUT DU BANC LUI-MÊME ────────────────────────────────────────');
  console.log('   (a) définition des retours à zéro, (b) mes bornes de comptage\n');
  const N2 = 200000;
  const rndA = mulberry32(20260903);
  const strict = balayage(pieceJuste, rndA, n, N2, false);
  const rndB = mulberry32(20260903);
  const lisse = balayage(pieceJuste, rndB, n, N2, true);
  const CASES = 20;
  const h = (arr) => { const t = new Array(CASES).fill(0); for (const f of arr) t[Math.min(CASES - 1, Math.floor(f * CASES))]++; return t.map((c) => c / arr.length); };
  const theo = Array.from({ length: CASES }, (_, i) => arcsinus((i + 1) / CASES) - arcsinus(i / CASES));
  const hs = h(strict), hl = h(lisse);
  const vt = (hh) => hh.reduce((s, v, i) => s + Math.abs(v - theo[i]), 0) / 2;
  console.log(`   première  case : strict ${(hs[0] * 100).toFixed(3)} %   lissé ${(hl[0] * 100).toFixed(3)} %   théorie ${(theo[0] * 100).toFixed(3)} %   (écart strict ${((hs[0] - theo[0]) * 100).toFixed(3)})`);
  console.log(`   dernière  case : strict ${(hs[19] * 100).toFixed(3)} %   lissé ${(hl[19] * 100).toFixed(3)} %   théorie ${(theo[19] * 100).toFixed(3)} %   (écart strict ${((hs[19] - theo[19]) * 100).toFixed(3)})`);
  console.log(`   écart-type d'une case à N=${N2} : ${(Math.sqrt(theo[0] * (1 - theo[0]) / N2) * 100).toFixed(4)} %  →  l'écart strict fait ${Math.abs((hs[0] - theo[0]) / Math.sqrt(theo[0] * (1 - theo[0]) / N2)).toFixed(0)} écarts-types`);
  console.log(`   distance totale à la courbe : strict ${(vt(hs) * 100).toFixed(3)} %   lissé ${(vt(hl) * 100).toFixed(3)} %`);

  console.log(`\n   (b) l'atome de réseau, et mes signes d'inégalité`);
  let a50 = 0, a950 = 0;
  for (const f of lisse) { const c = Math.round(f * n); if (c === 50) a50++; if (c === 950) a950++; }
  console.log(`   atomes exactement en 0,05 et 0,95 : ${(a50 / N2 * 100).toFixed(3)} % et ${(a950 / N2 * 100).toFixed(3)} %`);
  console.log(`   six bancs (trois graines × deux familles de générateur), N=50 000 chacun :`);
  console.log(`   bornes asymétriques « < 0,05 » / « >= 0,95 »  contre  symétriques « <= 0,05 » / « >= 0,95 »\n`);
  const bancs = [
    ['mulberry32  20260903', mulberry32(20260903)],
    ['mulberry32      1789', mulberry32(1789)],
    ['mulberry32    999331', mulberry32(999331)],
    ['xorshift128  9,8,7,6', xorshift128(9, 8, 7, 6)],
    ['xorshift128  5,5,5,5', xorshift128(5, 5, 5, 5)],
    ['xorshift128 1,2,3,44', xorshift128(1, 2, 3, 44)],
  ];
  const asy = [], sym = [];
  for (const [nom, rnd] of bancs) {
    const N3 = 50000;
    let gStrict = 0, gLarge = 0, d = 0;
    for (let i = 0; i < N3; i++) {
      const c = comptePositif(pieceJuste(rnd, n), true);
      if (c < 50) gStrict++;
      if (c <= 50) gLarge++;
      if (c >= 950) d++;
    }
    const p = (x) => x / N3 * 100;
    asy.push(p(d) - p(gStrict)); sym.push(p(d) - p(gLarge));
    console.log(`   ${nom}   asymétriques ${(p(d) - p(gStrict)).toFixed(3).padStart(7)}   symétriques ${(p(d) - p(gLarge)).toFixed(3).padStart(7)}`);
  }
  const moy = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const signes = (a) => a.map((e) => (e > 0 ? '+' : '−')).join('');
  console.log(`\n   moyenne : bornes asymétriques ${moy(asy).toFixed(4)} point (signes ${signes(asy)})`);
  console.log(`             bornes symétriques  ${moy(sym).toFixed(4)} point (signes ${signes(sym)})`);
  console.log('\n   Il n\'y avait rien à comprendre sur le hasard : il y avait un caractère à');
  console.log('   changer dans mon code.\n');
}

// exécuté directement ? (et non importé)
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('hasard.mjs')) {
  rapport();
}
