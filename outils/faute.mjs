// outils/faute.mjs — Salle XIV, « La Faute de Personne »
// Atelier de Fable, 2 septembre 2026.
//
// Reproduit tous les chiffres de la page la-faute-de-personne.html.
//   node outils/faute.mjs
// Aucune dependance. Environ 40 secondes.
//
// Question mesuree : un facteur de conversion f, une table de nombres entiers.
// Chaque ligne est convertie et arrondie separement, correctement. A quelle
// frequence la colonne obtenue cesse-t-elle d'etre coherente avec elle-meme ?

const R = (x) => Math.round(x);
const pct = (x, n = 3) => (x * 100).toFixed(n) + ' %';
const titre = (s) => console.log('\n' + s + '\n' + '-'.repeat(s.length));

// ============================================================ INSTRUMENT A
// Force brute sur tous les couples de lignes 1 <= b < a <= N.
function tauxBrut(f, N) {
  let total = 0, mauvais = 0, plus = 0, moins = 0, maxAbs = 0;
  for (let a = 2; a <= N; a++) {
    for (let b = 1; b < a; b++) {
      const D = R(a * f) - R(b * f) - R((a - b) * f);
      total++;
      if (D !== 0) {
        mauvais++;
        if (D > 0) plus++; else moins++;
        if (Math.abs(D) > maxAbs) maxAbs = Math.abs(D);
      }
    }
  }
  return { total, mauvais, taux: mauvais / total, plus, moins, maxAbs };
}

// ============================================================ INSTRUMENT B
// Enumeration EXACTE. Pour f = p/q irreductible, l'erreur d'arrondi de a*f ne
// depend que de a mod q : il suffit donc d'enumerer les q^2 classes de residus.
// Arithmetique entiere pure — aucun flottant n'intervient.
function arrondiRationnel(a, p, q) { return Math.floor((2 * a * p + q) / (2 * q)); }
function tauxExactRationnel(p, q) {
  let mauvais = 0;
  for (let i = 0; i < q; i++) {
    for (let j = 0; j < q; j++) {
      const A = arrondiRationnel(i + 2 * q, p, q);
      const B = arrondiRationnel(j + q, p, q);
      const C = arrondiRationnel(i + 2 * q - (j + q), p, q);
      if (A - B - C !== 0) mauvais++;
    }
  }
  return mauvais / (q * q);
}
const pgcd = (a, b) => b === 0 ? a : pgcd(b, a % b);

// Reduction exacte d'une ecriture decimale en p/q (BigInt).
function pgcdBig(a, b) { while (b) { const t = a % b; a = b; b = t; } return a; }
function reduireDecimal(s) {
  const pt = s.indexOf('.');
  const dec = pt === -1 ? 0 : s.length - pt - 1;
  const num = BigInt(s.replace('.', ''));
  const den = 10n ** BigInt(dec);
  const g = pgcdBig(num, den);
  return { p: num / g, q: den / g };
}

// ============================================================ TABLES A n LIGNES
function tauxTable(f, n, tirages, graine, borne = 100000) {
  let s = graine >>> 0;
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  let mauvais = 0, maxAbs = 0;
  for (let t = 0; t < tirages; t++) {
    let somme = 0, sommeArrondie = 0;
    for (let i = 0; i < n; i++) {
      const v = 1 + Math.floor(rnd() * borne);
      somme += v;
      sommeArrondie += R(v * f);
    }
    const D = sommeArrondie - R(somme * f);
    if (D !== 0) mauvais++;
    if (Math.abs(D) > maxAbs) maxAbs = Math.abs(D);
  }
  const p = mauvais / tirages;
  return { taux: p, maxAbs, se: Math.sqrt(p * (1 - p) / tirages) };
}
function varianceErreurs(p, q) {
  let s2 = 0;
  for (let a = 0; a < q; a++) { const t = a * p / q; const e = Math.round(t) - t; s2 += e * e; }
  return s2 / q;
}
const constante = (v) => 1 / Math.sqrt(2 * Math.PI * v);
const loiRacine = (v, n) => 1 - constante(v) / Math.sqrt(n + 1);

// ================================================================== EXECUTION
const LB = 0.45359237, PO = 25.4;

titre('LA PLAQUE');
{
  const l = [40500, 20000, 20500];
  const kg = l.map(v => R(v * LB));
  console.log(`  40500 lb -> ${(40500 * LB).toFixed(4)} -> ${kg[0]} kg`);
  console.log(`  20000 lb -> ${(20000 * LB).toFixed(4)} -> ${kg[1]} kg`);
  console.log(`  20500 lb -> ${(20500 * LB).toFixed(4)} -> ${kg[2]} kg`);
  console.log(`  livres : 40500 - 20000 = 20500 ? ${l[0] - l[1] === l[2]}`);
  console.log(`  kg     : ${kg[0]} - ${kg[1]} = ${kg[0] - kg[1]}, affiche ${kg[2]}, ecart ${kg[0] - kg[1] - kg[2]}`);
}

titre('TEMOINS QUI DOIVENT RENDRE ZERO (facteur entier)');
for (const f of [1, 3, 7, 10]) {
  const r = tauxBrut(f, 400);
  console.log(`  f=${String(f).padStart(2)}  ${r.mauvais}/${r.total}  ${r.mauvais === 0 ? 'OK' : '### ECHEC DU BANC ###'}`);
}

titre('LE CAS GENERIQUE : livre -> kg, tous les couples jusqu a 2000');
{
  const g = tauxBrut(LB, 2000);
  console.log(`  couples    : ${g.total}`);
  console.log(`  incoherents: ${g.mauvais}  soit ${pct(g.taux, 4)}`);
  console.log(`  D = +1     : ${g.plus}`);
  console.log(`  D = -1     : ${g.moins}   (equilibre : ${pct(g.plus / g.mauvais)})`);
  console.log(`  max |D|    : ${g.maxAbs}   <- jamais 2 : trois erreurs dans [-1/2,1/2[ ne peuvent pas sommer plus loin`);
}

titre('APPARIEMENT DES DEUX INSTRUMENTS (exact vs force brute)');
{
  let desaccords = 0;
  for (const [p, q] of [[1, 3], [127, 5], [1, 7], [1, 2], [3, 8], [5, 6], [2, 9], [7, 11]]) {
    const ex = tauxExactRationnel(p, q), br = tauxBrut(p / q, 700).taux;
    if (Math.abs(ex - br) > 0.005) desaccords++;
    console.log(`  ${p}/${String(q).padEnd(3)} exact=${pct(ex, 4)}  brute=${pct(br, 4)}  ecart=${((ex - br) * 100).toFixed(4)} pt`);
  }
  console.log(`  desaccords > 0,5 pt : ${desaccords}  ${desaccords === 0 ? 'OK' : '### DIVERGENCE ###'}`);
}

titre('LA LOI : 1/4 si q pair, (q^2-1)/(4q^2) si q impair — jusqu a q = 400');
{
  let testes = 0, echecs = 0;
  for (let q = 1; q <= 400; q++) {
    const attendu = (q % 2 === 0) ? 0.25 : (q * q - 1) / (4 * q * q);
    const ps = [];
    for (let p = 1; p < Math.max(2, q) && ps.length < 6; p++) if (pgcd(p, q) === 1) ps.push(p);
    for (let p = q - 1; p > 0 && ps.length < 12; p--) if (pgcd(p, q) === 1 && !ps.includes(p)) ps.push(p);
    for (const p of ps) { testes++; if (Math.abs(tauxExactRationnel(p, q) - attendu) > 1e-12) echecs++; }
  }
  console.log(`  couples (p,q) testes : ${testes}   ecarts : ${echecs}   ${echecs === 0 ? 'LA LOI TIENT' : '### LOI FAUSSE ###'}`);
}

titre('LES VRAIES UNITES (reduction exacte en BigInt, puis loi appliquee)');
for (const [nom, s] of [
  ['livre -> kg', '0.45359237'], ['pied -> m', '0.3048'], ['once -> g', '28.349523125'],
  ['gallon US -> L', '3.785411784'], ['euro -> franc', '6.55957'], ['calorie -> J', '4.1868'],
  ['mille -> km', '1.609344'], ['pouce -> mm', '25.4'], ['atmosphere -> Pa', '101325'],
]) {
  const { q } = reduireDecimal(s);
  const pair = q % 2n === 0n;
  const taux = pair ? '25 % exactement'
    : q === 1n ? '0 % — impossible'
    : (0.25 - 1 / (4 * Number(q) * Number(q))) * 100 + ' %';
  console.log(`  ${nom.padEnd(18)} q=${q.toString().padEnd(12)} ${(pair ? 'pair' : 'impair').padEnd(7)} ${taux}`);
}

titre('TABLES A n LIGNES + UN TOTAL');
console.log(`  loi ecrite d avance : 1 - 1,3820/racine(n+1)`);
for (const n of [2, 3, 5, 10, 20, 50, 100, 200, 400]) {
  const r = tauxTable(LB, n, 200000, 12345 + n);
  console.log(`  n=${String(n).padStart(3)}  mesure=${pct(r.taux)}  predit=${pct(loiRacine(1 / 12, n))}  ecart=${((r.taux - loiRacine(1 / 12, n)) * 100).toFixed(3)} pt  max|D|=${r.maxAbs}`);
}

titre('LE CONTROLE QUI TESTE L EXPLICATION ET NON LA COURBE');
console.log(`  variance des erreurs d arrondi : livre 1/12 = ${(1 / 12).toFixed(6)}   pouce (q=5) = ${varianceErreurs(127, 5).toFixed(6)}`);
console.log(`  constantes predites            : livre ${constante(1 / 12).toFixed(4)}          pouce ${constante(varianceErreurs(127, 5)).toFixed(4)}`);
for (const n of [50, 200, 800]) {
  const a = tauxTable(LB, n, 1000000, 4242 + n), b = tauxTable(PO, n, 1000000, 4242 + n);
  const sep = (a.taux - b.taux) * 100, bruit = Math.sqrt(a.se ** 2 + b.se ** 2) * 100;
  console.log(`  n=${String(n).padStart(3)}  livre ${pct(a.taux)} (predit ${pct(loiRacine(1 / 12, n))})  pouce ${pct(b.taux)} (predit ${pct(loiRacine(varianceErreurs(127, 5), n))})`);
  console.log(`         separation ${sep.toFixed(3)} pt contre ${bruit.toFixed(3)} pt de bruit -> ${Math.abs(sep) > 3 * bruit ? 'LES DEUX FACTEURS DIFFERENT' : 'indiscernables'}`);
}

titre('LE TEMOIN QUI A TROUVE UNE LIMITE DU MONTAGE');
console.log('  le taux ne devait PAS dependre de l ordre de grandeur des valeurs. Il en depend en bas.');
for (const borne of [100, 10000, 100000, 10000000]) {
  const r = tauxTable(LB, 200, 500000, 99, borne);
  console.log(`  valeurs dans 1..${String(borne).padStart(8)}  taux=${pct(r.taux)} +/- ${(r.se * 100).toFixed(3)}`);
}
console.log('  -> cent valeurs distinctes ne se repartissent pas sur un reseau de 10^8 points.');
