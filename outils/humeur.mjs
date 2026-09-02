#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
//  LA CINQUIÈME CACHETTE — banc de mesure
//  Salle XV de l'Atelier de Fable · https://atelier-de-fable.github.io
//
//  Une tortue à 2 couleurs et k humeurs. Sa table donne, pour chaque couple
//  (humeur s, couleur c) lue sous ses pattes, un triplet :
//        (couleur écrite, virage G/D, humeur suivante).
//  k = 1 → les 16 fourmis sans mémoire de tête (dont Langton = D sur 0, G sur 1).
//  k = 2 → 8^4 = 4096 machines.
//
//  On ne compare pas des TABLES, on compare des TRACÉS : la suite des virages
//  détermine le chemin exactement, à départ fixé. Et on ne classe pas une machine
//  par ce que sa table a l'air de faire, mais par son DESTIN observé :
//        rosace  — périodique, repasse éternellement sur son propre trait
//        ruban   — périodique, translation non nulle : un motif recopié le long
//                  d'une droite. L'autoroute de Langton est un ruban.
//        non rangée — aucune période trouvée à cet horizon.
//
//  Grille creuse (Map) : pas de bord, pas de tore, aucune limite spatiale.
//  Aucune dépendance.   node outils/humeur.mjs [horizon]
// ─────────────────────────────────────────────────────────────────────────────

const PAS  = Number(process.argv[2] || 200000);  // horizon
const DEB  = Math.floor(PAS * 0.75);             // période cherchée sur le dernier quart
const PMAX = 4096;                               // période maximale détectable

// ── la tortue ───────────────────────────────────────────────────────────────
function trace(table, pas) {
  const sol = new Map();
  let x = 0, y = 0, d = 0, s = 0;
  const v = new Uint8Array(pas);
  for (let i = 0; i < pas; i++) {
    const cle = x * 4000003 + y;
    const c = sol.get(cle) | 0;
    const r = table[s * 2 + c];
    v[i] = r.virage;
    sol.set(cle, r.ecrit);
    d = (d + (r.virage ? 1 : 3)) & 3;       // 0 = gauche, 1 = droite
    s = r.suiv;
    if (d === 0) y--; else if (d === 1) x++; else if (d === 2) y++; else x--;
  }
  return v;
}
const sig = v => {
  const o = new Uint8Array((v.length + 7) >> 3);
  for (let i = 0; i < v.length; i++) if (v[i]) o[i >> 3] |= 1 << (i & 7);
  return Buffer.from(o).toString('base64');
};

// ── le destin ───────────────────────────────────────────────────────────────
function destin(v) {
  const N = v.length;
  for (let p = 1; p <= PMAX; p++) {
    let ok = true;
    const court = Math.min(DEB + 300, N - p);          // élagage
    for (let i = DEB; i < court; i++) if (v[i] !== v[i + p]) { ok = false; break; }
    if (!ok) continue;
    for (let i = DEB; i + p < N; i++) if (v[i] !== v[i + p]) { ok = false; break; }
    if (!ok) continue;
    let d = 0;
    for (let i = 0; i < DEB; i++) d = (d + (v[i] ? 1 : 3)) & 3;
    let dx = 0, dy = 0, dd = d;
    for (let i = DEB; i < DEB + p; i++) {
      dd = (dd + (v[i] ? 1 : 3)) & 3;
      if (dd === 0) dy--; else if (dd === 1) dx++; else if (dd === 2) dy++; else dx--;
    }
    const rot = (dd - d) & 3;
    return (rot === 0 && (dx || dy)) ? { type: 'ruban', p } : { type: 'rosace', p };
  }
  return { type: 'non-rangee', p: 0 };
}
// motif périodique en forme canonique : rotation minimale, miroir G<->D identifié.
// Deux machines qui rejoignent la MÊME autoroute par des transitoires différents
// ont des tracés différents et le même motif. C'est le motif qu'il faut compter.
function motif(v, p) {
  let mot = '';
  for (let i = DEB; i < DEB + p; i++) mot += v[i] ? 'D' : 'G';
  const miroir = [...mot].map(c => (c === 'D' ? 'G' : 'D')).join('');
  const c = [];
  for (const w of [mot, miroir]) for (let r = 0; r < p; r++) c.push(w.slice(r) + w.slice(0, r));
  return c.sort()[0];
}
function etendue(v, n) {
  let x = 0, y = 0, d = 0, x0 = 0, x1 = 0, y0 = 0, y1 = 0;
  for (let i = 0; i < n; i++) {
    d = (d + (v[i] ? 1 : 3)) & 3;
    if (d === 0) y--; else if (d === 1) x++; else if (d === 2) y++; else x--;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return Math.max(x1 - x0, y1 - y0) + 1;
}

// ── les machines ────────────────────────────────────────────────────────────
// m est lu en base 8 (k=2) ou en base 4 (k=1) ; chiffre i = couple (humeur, couleur)
// bit 1 = couleur écrite, bit 2 = virage (0 gauche, 1 droite), bit 4 = humeur suivante.
function tableDe(m, k) {
  const t = [], b = k === 1 ? 2 : 3, msk = k === 1 ? 3 : 7;
  for (let i = 0; i < 2 * k; i++) {
    const q = (m >> (i * b)) & msk;
    t.push({ ecrit: q & 1, virage: (q >> 1) & 1, suiv: k === 1 ? 0 : (q >> 2) & 1 });
  }
  return t;
}
const lisible = t => t.map((r, i) =>
  '(' + 'AB'[i >> 1] + ',' + (i & 1) + ')→écrit ' + r.ecrit + ', ' +
  (r.virage ? 'D' : 'G') + ', ' + 'AB'[r.suiv]).join('  ·  ');

// espèce SYNTAXIQUE — la classification a priori, celle que la mesure va contredire
function espece(t) {
  let parle = false, ecoute = false;
  for (let c = 0; c < 2; c++)
    if (t[c].ecrit !== t[2 + c].ecrit || t[c].virage !== t[2 + c].virage) parle = true;
  for (let s = 0; s < 2; s++) if (t[s * 2].suiv !== t[s * 2 + 1].suiv) ecoute = true;
  if (!parle) return 'muette';                                   // l'humeur ne parle pas
  if (!ecoute) return t[0].suiv === 0 ? 'sourde-P1' : 'sourde-P2'; // elle n'écoute pas
  return 'franche';                                              // elle écoute et parle
}

// ── mesure ──────────────────────────────────────────────────────────────────
console.log('LA CINQUIÈME CACHETTE — horizon ' + PAS.toLocaleString('fr') +
  ' pas, période cherchée sur le dernier quart (max ' + PMAX + ')\n');

const sansHumeur = new Set(), auto16 = new Map();
let ros16 = 0, rub16 = 0, nr16 = 0, carre16 = 0;
for (let m = 0; m < 16; m++) {
  const v = trace(tableDe(m, 1), PAS);
  sansHumeur.add(sig(v));
  const d = destin(v);
  if (d.type === 'ruban') { rub16++; const k = motif(v, d.p); auto16.set(k, (auto16.get(k) || 0) + 1); }
  else if (d.type === 'rosace') { ros16++; if (etendue(v, PAS) <= 2) carre16++; }
  else nr16++;
}
console.log('LES 16 SANS HUMEUR  ·  ' + sansHumeur.size + ' tracés distincts');
console.log('  rosaces ' + ros16 + ' (dont ' + carre16 + ' qui meurent dans un carré de 2×2 cases)' +
  ' · rubans ' + rub16 + ' · non rangées ' + nr16);
console.log('  AUTOROUTES DISTINCTES : ' + auto16.size +
  ' — période ' + [...auto16.keys()].map(k => k.length).join(', ') + '\n');

const ESP = ['muette', 'sourde-P1', 'sourde-P2', 'franche'];
const st = {}; for (const e of ESP) st[e] = { n: 0, eff: 0, rosace: 0, ruban: 0, 'non-rangee': 0, carre: 0 };
const autos = new Map(), rosaces = new Set(), tracesNeuves = new Set();
const confinees = new Map();       // tracés des machines qui ne quittent pas un carré 2×2
let neuves = 0;

for (let m = 0; m < 4096; m++) {
  const t = tableDe(m, 2), e = espece(t);
  st[e].n++;
  const v = trace(t, PAS), s = sig(v), d = destin(v);
  st[e][d.type]++;
  if (etendue(v, PAS) <= 2) {
    if (!confinees.has(s)) confinees.set(s, { n: 0, ex: m, deb: [...v.slice(0, 10)].map(b => b ? 'D' : 'G').join('') });
    confinees.get(s).n++;
  }
  if (sansHumeur.has(s)) st[e].eff++; else { neuves++; tracesNeuves.add(s); }
  if (d.type === 'ruban') {
    const k = motif(v, d.p);
    if (!autos.has(k)) autos.set(k, { n: 0, esp: new Set(), ex: m });
    const o = autos.get(k); o.n++; o.esp.add(e);
  } else if (d.type === 'rosace') {
    rosaces.add(motif(v, d.p));
    if (etendue(v, PAS) <= 2) st[e].carre++;
  }
}

console.log('LES 4096 À DEUX HUMEURS');
console.log('espèce syntaxique   total   tracé déjà vu │  rosace   ruban   non rangée');
let T = { n: 0, eff: 0, rosace: 0, ruban: 0, nr: 0, carre: 0 };
for (const e of ESP) {
  const o = st[e];
  T = { n: T.n + o.n, eff: T.eff + o.eff, rosace: T.rosace + o.rosace,
        ruban: T.ruban + o.ruban, nr: T.nr + o['non-rangee'], carre: T.carre + o.carre };
  console.log('  ' + e.padEnd(16) + String(o.n).padStart(6) + String(o.eff).padStart(14) +
    ' │' + String(o.rosace).padStart(8) + String(o.ruban).padStart(8) + String(o['non-rangee']).padStart(12));
}
console.log('  ' + 'TOTAL'.padEnd(16) + String(T.n).padStart(6) + String(T.eff).padStart(14) +
  ' │' + String(T.rosace).padStart(8) + String(T.ruban).padStart(8) + String(T.nr).padStart(12));
console.log('\n  meurent dans un carré de 2×2 cases : ' + T.carre + ' / 4096 = ' +
  (100 * T.carre / 4096).toFixed(1) + ' %   (sans humeur : ' + carre16 + ' / 16 = ' +
  (100 * carre16 / 16).toFixed(1) + ' %)');
console.log('  tracés distincts autres que ceux des 16 : ' + tracesNeuves.size +
  ' (pour ' + neuves + ' machines)');

// Le carré 2×2 : on ne peut y rester qu'en tournant toujours du même côté — donc deux
// tracés, croyait-on. Il y en a QUATRE : deux d'entre eux font un seul virage de l'autre
// côté au premier pas, puis tournent en rond à jamais. Leur tracé est « neuf ». Leur
// destin est un carré. C'est toute la salle en une ligne.
console.log('\n  LES TRACÉS DU CARRÉ 2×2 (' + confinees.size + ', et non 2) :');
for (const [s, o] of confinees)
  console.log('    ' + String(o.n).padStart(5) + ' machines · ex #' + String(o.ex).padStart(4) +
    ' · début ' + o.deb + '…  ' + (sansHumeur.has(s) ? 'tracé déjà vu sans humeur' : '← TRACÉ NEUF, DESTIN CARRÉ'));

const nv = [...autos.entries()].filter(([k]) => !auto16.has(k));
console.log('\nLE COMPTE QUI COMPTE — des DESTINS, pas des tracés');
console.log('  motifs de rosace distincts   : ' + rosaces.size);
console.log('  AUTOROUTES DISTINCTES        : ' + autos.size +
  '  (dont ' + nv.length + ' qu\'aucune machine sans humeur ne construit)');
console.log('  périodes : ' + [...new Set([...autos.keys()].map(k => k.length))].sort((a, b) => a - b).join(', '));
const partage = [...autos.entries()].filter(([k]) => auto16.has(k));
for (const [k, o] of partage)
  console.log('  ↳ ' + o.n + ' machines à deux humeurs rejoignent l\'autoroute de Langton elle-même (période ' + k.length + ')');
console.log('\n  ⇒ ' + auto16.size + ' autoroute sans humeur, ' + autos.size + ' avec une humeur.');

// ── les vitrines de la salle ────────────────────────────────────────────────
console.log('\nLES MACHINES DE LA SALLE');
for (const m of [6, 49, 497, 169, 493, 57]) {
  const t = tableDe(m, 2), v = trace(t, PAS), d = destin(v);
  console.log('  #' + String(m).padStart(4) + '  ' + espece(t).padEnd(10) + d.type +
    (d.p ? ' p=' + d.p : '') + '\n        ' + lisible(t));
}
const lang = tableDe(0b1001, 1); // D sur 0 en écrivant 1 ; G sur 1 en écrivant 0
console.log('  Langton (sans humeur)  ' + destin(trace(lang, PAS)).type);

// ── le noyau non rangé : DE QUELLE FORME ? ──────────────────────────────────
// Piège : la boîte englobante de #57 et celle de #113 grandissent toutes deux en √t.
// Ce sont pourtant deux objets sans rapport. Une boîte ne distingue pas un filament
// d'un disque — il faut compter les CASES VISITÉES et le remplissage.
function forme(m, k, N, jalons) {
  const t = tableDe(m, k), sol = new Map(), vus = new Set();
  let x = 0, y = 0, d = 0, s = 0, x0 = 0, x1 = 0, y0 = 0, y1 = 0;
  const out = [];
  for (let i = 0; i < N; i++) {
    const cle = x * 4000003 + y; vus.add(cle);
    const c = sol.get(cle) | 0, r = t[s * 2 + c]; sol.set(cle, r.ecrit);
    d = (d + (r.virage ? 1 : 3)) & 3; s = r.suiv;
    if (d === 0) y--; else if (d === 1) x++; else if (d === 2) y++; else x--;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (jalons.includes(i + 1))
      out.push({ pas: i + 1, L: x1 - x0 + 1, H: y1 - y0 + 1, vus: vus.size, dist: Math.hypot(x, y) });
  }
  return out;
}
const JAL = [25000, 50000, 100000, 200000, 400000];
console.log('\nLE NOYAU NON RANGÉ — de quelle FORME ?');
for (const [m, k, nom] of [[113, 2, '#113'], [85, 2, ' #85'], [21, 2, ' #21'],
                           [57, 2, ' #57'], [3, 1, 'Langton (témoin : autoroute connue)']]) {
  console.log('\n  ' + nom);
  console.log('        pas       boîte   cases visitées   remplissage   distance    ×dist');
  let pd = null;
  for (const j of forme(m, k, 400000, JAL)) {
    const rap = pd === null ? '   —' : '  ×' + (j.dist / pd).toFixed(2);
    pd = j.dist;
    console.log('    ' + String(j.pas).padStart(7) + '  ' + (j.L + '×' + j.H).padStart(11) +
      '  ' + String(j.vus).padStart(13) + '  ' + ((100 * j.vus / (j.L * j.H)).toFixed(1) + ' %').padStart(11) +
      '  ' + j.dist.toFixed(0).padStart(9) + rap);
  }
}
console.log('\n  Lecture : remplissage CONSTANT et distance ×1,4 = une tache qui grandit en √t.');
console.log('            remplissage qui S\'EFFONDRE et distance ×2 = une autoroute (Langton).');
console.log('            remplissage de 0,5 % = un FILAMENT — #57 repasse ~211 fois par case.');
