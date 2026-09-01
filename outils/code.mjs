// code.mjs — lire le CODE du musée comme un texte.
// Suite de la pièce IX (« Le Mot Commun »), qui n'avait lu que la prose visible.
// Deux instruments qui ne partagent aucune hypothèse : l'un ne lit que mes
// déclarations, l'autre ne connaît qu'un dictionnaire de la langue.
// Sans dépendance, sans réseau. Relancez-le et contredisez-moi : node outils/code.mjs

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Se lance depuis n'importe où : node outils/code.mjs (le site est le dossier parent).
const SITE = fileURLToPath(new URL('..', import.meta.url));

// ── 1. Les salles, et ce qu'elles contiennent comme machine ───────────────────
// Le corpus s'est défini tout seul : sur les 19 pages du site, exactement HUIT
// portent une machine (du code inline non vide). Les onze autres — les essais,
// les fables, le journal, l'aile des visiteurs, et LA PIÈCE IX elle-même —
// n'en portent aucune. Une première version de ce fichier incluait la pièce IX
// (« Le Mot Commun ») dans le corpus : elle y entrait avec ZÉRO mot, ce qui
// vidait mécaniquement toute intersection. L'instrument répondait « aucun mot
// commun » parce qu'une salle du corpus n'avait rien à dire. Gardé en note.
const SALLES = [
  ['I    Le Cabinet des Émergences', 'cabinet-des-emergences.html'],
  ['II   Le Blob',                   'le-blob.html'],
  ['V    Le Tas de Sable',           'le-tas-de-sable.html'],
  ['VI   Le Jeu des Règles',         'le-jeu-des-regles.html'],
  ['VIII Où cacher la mémoire',      'ou-cacher-la-memoire.html'],
  ['X    Le Seuil',                  'le-seuil.html'],
  ['XII  Les Dix Gauches',           'les-dix-gauches.html'],
  ['—    La Discothèque',            'lecteur.html'],
];

// ── 2. Extraire les blocs <script> ────────────────────────────────────────────
function scripts(html) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1] || '';
    if (/\bsrc\s*=/.test(attrs)) continue;                             // script externe
    if (/type\s*=\s*["'](?!text\/javascript)/i.test(attrs)) continue;  // json-ld etc.
    out.push(m[2]);
  }
  return out.join('\n');
}

// ── 3. Retirer commentaires et chaînes, GARDER l'intérieur des ${ } ───────────
// (un identifiant peut ne vivre que dans une interpolation : le perdre serait
//  perdre du vocabulaire réel.)
function decaper(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  const avantRegex = /[=(,:;[!&|?{}+\-*%~^<>]\s*$|\b(return|typeof|case|in|of|new|delete|void|do|else)\s*$/;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '"' || c === "'") {
      const q = c; i++;
      while (i < n && src[i] !== q) { if (src[i] === '\\') i++; i++; }
      i++; out += ' '; continue;
    }
    if (c === '`') {
      i++;
      while (i < n && src[i] !== '`') {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '$' && src[i + 1] === '{') {         // on garde l'expression
          i += 2; let prof = 1; let expr = '';
          while (i < n && prof > 0) {
            if (src[i] === '{') prof++;
            else if (src[i] === '}') { prof--; if (!prof) break; }
            expr += src[i]; i++;
          }
          i++; out += ' ' + decaper(expr) + ' '; continue;
        }
        i++;
      }
      i++; out += ' '; continue;
    }
    if (c === '/' && avantRegex.test(out)) {               // littéral d'expression régulière
      i++;
      let classe = false;
      while (i < n && (classe || src[i] !== '/')) {
        if (src[i] === '\\') i++;
        else if (src[i] === '[') classe = true;
        else if (src[i] === ']') classe = false;
        else if (src[i] === '\n') break;
        i++;
      }
      i++; while (i < n && /[a-z]/.test(src[i])) i++;      // drapeaux
      out += ' '; continue;
    }
    out += c; i++;
  }
  return out;
}

const MOT = /[A-Za-z_$][A-Za-z0-9_$]*/g;
const jetons = (s) => s.match(MOT) || [];

// ── 4. INSTRUMENT A — par le SITE DE DÉCLARATION ──────────────────────────────
// Est « choisi » tout nom que j'ai moi-même déclaré : const/let/var, function,
// paramètres, clés de littéral d'objet, classes.
// Un mot réservé du langage ne peut jamais être un nom déclaré : si mes motifs
// en attrapent un, c'est une fausse prise (« if » entrait par le motif des clés
// d'objet). Filtre écrit après avoir vu la fausse prise, et il ne dépend
// d'aucun résultat de la mesure.
const RESERVES = new Set(('var let const function return if else for while do break continue switch '
  + 'case default new delete typeof instanceof in of this null undefined true false void class '
  + 'extends super static get set try catch finally throw async await yield import export from').split(' '));

function instrumentA(code) {
  const vus = new Set();
  const nom = '[A-Za-z_$][A-Za-z0-9_$]*';
  const ajoute = (s) => { for (const j of jetons(s)) vus.add(j); };

  for (const m of code.matchAll(new RegExp('\\b(?:const|let|var)\\s+(\\{[^}]*\\}|\\[[^\\]]*\\]|' + nom + ')', 'g'))) {
    const cible = m[1];
    if (cible[0] === '{' || cible[0] === '[') {
      for (const part of cible.slice(1, -1).split(',')) {
        ajoute(part.split(':').pop().split('=')[0]);
      }
    } else vus.add(cible);
  }
  for (const m of code.matchAll(new RegExp('\\b(?:const|let|var)\\s+' + nom + '\\s*=[^;\\n]*?,\\s*(' + nom + ')\\s*=', 'g'))) vus.add(m[1]);

  for (const m of code.matchAll(new RegExp('\\bfunction\\s*\\*?\\s*(' + nom + ')?\\s*\\(([^)]*)\\)', 'g'))) {
    if (m[1]) vus.add(m[1]);
    for (const p of m[2].split(',')) ajoute(p.split('=')[0]);
  }
  for (const m of code.matchAll(/\(([^()]*)\)\s*=>/g)) {
    for (const p of m[1].split(',')) ajoute(p.split('=')[0]);
  }
  for (const m of code.matchAll(new RegExp('(?:^|[^.\\w$])(' + nom + ')\\s*=>', 'g'))) vus.add(m[1]);

  for (const m of code.matchAll(new RegExp('[{,]\\s*(' + nom + ')\\s*[:(]', 'g'))) vus.add(m[1]);
  for (const m of code.matchAll(new RegExp('\\bclass\\s+(' + nom + ')', 'g'))) vus.add(m[1]);

  for (const r of RESERVES) vus.delete(r);
  return vus;
}

// ── 5. INSTRUMENT B — par le DICTIONNAIRE ─────────────────────────────────────
// Liste écrite à la main AVANT de regarder le moindre résultat : mots-clés de
// JavaScript, objets et méthodes du langage, lexique du navigateur, et les
// lettres uniques (i, j, x, y…) qui n'appartiennent à personne.
const LANGUE = `
var let const function return if else for while do break continue switch case default
new delete typeof instanceof in of this null undefined true false void class extends
super static get set try catch finally throw async await yield import export from as
Math floor ceil round abs min max pow sqrt random sin cos tan atan atan2 exp log hypot
PI sign trunc cbrt log2 log10
Number parseInt parseFloat isNaN isFinite toFixed toPrecision toString valueOf NaN Infinity
String length slice substring substr indexOf lastIndexOf split join replace replaceAll
trim toLowerCase toUpperCase padStart padEnd repeat charAt charCodeAt codePointAt
startsWith endsWith includes match matchAll concat normalize localeCompare raw
Array isArray push pop shift unshift splice map filter reduce reduceRight forEach find
findIndex findLast some every sort reverse flat flatMap fill keys values entries at
copyWithin from of
Object assign freeze create defineProperty getPrototypeOf hasOwnProperty prototype
constructor call apply bind arguments
JSON parse stringify
Set Map WeakSet WeakMap has add clear delete size
Promise then resolve reject all allSettled race
Date now getTime getHours getMinutes getSeconds toISOString toLocaleString
RegExp test exec source flags lastIndex global
Error TypeError RangeError message stack
Float32Array Float64Array Int8Array Int16Array Int32Array Uint8Array Uint8ClampedArray
Uint16Array Uint32Array BigInt Symbol iterator Proxy Reflect ArrayBuffer DataView
Intl NumberFormat
window document body head title location href hash search pathname origin protocol
navigator history localStorage sessionStorage setItem getItem removeItem
console log warn error info table time timeEnd
setTimeout setInterval clearTimeout clearInterval requestAnimationFrame
cancelAnimationFrame performance
querySelector querySelectorAll getElementById getElementsByClassName createElement
createElementNS createTextNode appendChild removeChild insertBefore replaceChild
append prepend remove cloneNode textContent innerHTML innerText outerHTML children
setAttribute getAttribute removeAttribute hasAttribute dataset classList
toggle contains className id style display visibility opacity hidden
addEventListener removeEventListener dispatchEvent preventDefault stopPropagation
event target currentTarget detail key code keyCode which button buttons
clientX clientY offsetX offsetY pageX pageY touches changedTouches
getBoundingClientRect getComputedStyle scrollTo scrollIntoView scrollTop scrollLeft
offsetWidth offsetHeight clientWidth clientHeight innerWidth innerHeight
devicePixelRatio matchMedia open close focus blur alert parentNode parentElement
canvas getContext width height fillStyle strokeStyle lineWidth lineCap lineJoin
fillRect strokeRect clearRect beginPath closePath moveTo lineTo arc arcTo rect
ellipse quadraticCurveTo bezierCurveTo fill stroke save restore translate rotate scale
setTransform resetTransform globalAlpha globalCompositeOperation font textAlign
textBaseline fillText strokeText measureText createImageData getImageData putImageData
createLinearGradient createRadialGradient addColorStop drawImage imageSmoothingEnabled
data toDataURL setLineDash shadowBlur shadowColor
Audio audio play pause paused currentTime duration volume muted loop src load
buffered seekable ended readyState playbackRate
Image onload onerror onclick oninput onchange checked value disabled selected
options selectedIndex step type placeholder textarea input select
fetch response json text ok status headers URL URLSearchParams encodeURIComponent
decodeURIComponent Blob FileReader
name index
a b c d e f g h i j k l m n o p q r s t u v w x y z
`.trim().split(/\s+/);
const DICO = new Set(LANGUE);

function instrumentB(code) {
  const vus = new Set();
  for (const j of jetons(code)) if (!DICO.has(j)) vus.add(j);
  return vus;
}

// ── 6. Mesures ────────────────────────────────────────────────────────────────
const jaccard = (A, B) => {
  const inter = [...A].filter((x) => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  return union ? inter / union : 0;
};
const mediane = (t) => {
  const s = [...t].sort((a, b) => a - b); const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const salles = [];
for (const [nom, fichier] of SALLES) {
  const brut = readFileSync(join(SITE, fichier), 'utf8');
  const code = decaper(scripts(brut));
  const tous = new Set(jetons(code));
  salles.push({
    nom, fichier, octets: code.length, tous,
    A: instrumentA(code),
    B: instrumentB(code),
    impose: new Set([...tous].filter((x) => DICO.has(x))),
  });
}

console.log('LIRE LE CODE DU MUSÉE COMME UN TEXTE');
console.log('mesure du 1er septembre 2026 — suite de la pièce IX\n');

console.log('CORPUS');
console.log('salle'.padEnd(32), 'code'.padStart(8), 'mots'.padStart(7), 'A'.padStart(6), 'B'.padStart(6));
for (const s of salles) {
  console.log(s.nom.padEnd(32), String(s.octets).padStart(8), String(s.tous.size).padStart(7),
    String(s.A.size).padStart(6), String(s.B.size).padStart(6));
}
console.log(`\n${salles.length} machines, ${salles.reduce((a, s) => a + s.octets, 0)} octets de code décapé.\n`);

for (const [clef, titre, pred] of [
  ['B', 'VOCABULAIRE CHOISI — instrument B (dictionnaire)', 'prédiction 1 : médiane < 14 %'],
  ['A', 'VOCABULAIRE CHOISI — instrument A (déclarations)', 'prédiction 1 : médiane < 14 %'],
  ['impose', 'VOCABULAIRE IMPOSÉ — contrôle', 'prédiction 3 : médiane > 40 %'],
]) {
  const paires = [];
  for (let i = 0; i < salles.length; i++)
    for (let j = i + 1; j < salles.length; j++)
      paires.push([jaccard(salles[i][clef], salles[j][clef]), salles[i].nom, salles[j].nom]);
  paires.sort((a, b) => b[0] - a[0]);
  console.log('─'.repeat(78));
  console.log(titre + '  |  ' + pred);
  console.log(`  ${paires.length} paires · médiane ${(mediane(paires.map((p) => p[0])) * 100).toFixed(1)} %`
    + ` · min ${(paires.at(-1)[0] * 100).toFixed(1)} % · max ${(paires[0][0] * 100).toFixed(1)} %`);
  console.log(`  la plus proche : ${paires[0][1]} / ${paires[0][2]}`);
  console.log(`  la plus loin   : ${paires.at(-1)[1]} / ${paires.at(-1)[2]}\n`);
}

// ── 7. L'intersection : y a-t-il un mot dans TOUTES les machines ? ────────────
for (const [clef, titre] of [['B', 'instrument B (dictionnaire)'], ['A', 'instrument A (déclarations)']]) {
  let inter = new Set(salles[0][clef]);
  for (const s of salles.slice(1)) inter = new Set([...inter].filter((x) => s[clef].has(x)));
  const presque = new Map();
  for (const s of salles) for (const mot of s[clef]) presque.set(mot, (presque.get(mot) || 0) + 1);
  const n1 = [...presque].filter(([, c]) => c === salles.length - 1).map(([mot]) => mot).sort();
  console.log('─'.repeat(78));
  console.log(`MOTS CHOISIS PRÉSENTS DANS LES ${salles.length} MACHINES — ${titre} : ${inter.size}`);
  console.log('  ' + ([...inter].sort().join(' ') || '(aucun)'));
  console.log(`  dans ${salles.length - 1} machines sur ${salles.length} : ${n1.join(' ') || '(aucun)'}\n`);
}

// ── 8. Le désaccord des deux instruments, publié tel quel ─────────────────────
console.log('─'.repeat(78));
console.log('DÉSACCORD DES DEUX INSTRUMENTS');
let dA = 0, dB = 0, accord = 0;
for (const s of salles) {
  const aSansB = [...s.A].filter((x) => !s.B.has(x));
  const bSansA = [...s.B].filter((x) => !s.A.has(x));
  const communs = [...s.A].filter((x) => s.B.has(x)).length;
  dA += aSansB.length; dB += bSansA.length; accord += communs;
  console.log(`  ${s.nom.padEnd(32)} A seul ${String(aSansB.length).padStart(4)}  B seul ${String(bSansA.length).padStart(4)}  d'accord ${String(communs).padStart(4)}`);
}
console.log(`  TOTAL  A seul ${dA} · B seul ${dB} · d'accord ${accord}`);
console.log("  (A seul = déclaré ici mais présent dans mon dictionnaire ; B seul = jamais");
console.log("   déclaré ici, donc emprunté, hérité, ou absent de mon dictionnaire.)\n");

const s0 = salles[0];
console.log('  Échantillon du désaccord, salle I :');
console.log('    A seul :', [...s0.A].filter((x) => !s0.B.has(x)).slice(0, 30).join(' '));
console.log('    B seul :', [...s0.B].filter((x) => !s0.A.has(x)).slice(0, 30).join(' '));

// ── 9. L'intersection est vide : QUI la vide ? ────────────────────────────────
// Une intersection nulle sur huit ensembles ne dit pas « rien de commun » : elle
// peut ne dire que « une salle manque à l'appel ». On interroge donc chaque
// absence, au lieu de conclure.
console.log('\n' + '─'.repeat(78));
console.log('QUI VIDE L\'INTERSECTION ? (vocabulaire choisi, instrument B)');
const compte = new Map();
for (const s of salles) for (const mot of s.B) (compte.get(mot) || compte.set(mot, []).get(mot)).push(s.nom);
const candidats = [...compte].filter(([, où]) => où.length >= 5).sort((a, b) => b[1].length - a[1].length);
if (!candidats.length) console.log('  aucun mot choisi n\'atteint 5 salles sur 8.');
for (const [mot, où] of candidats) {
  const absents = salles.filter((s) => !s.B.has(mot)).map((s) => s.nom.split(/\s{2,}/)[0]);
  console.log(`  ${mot.padEnd(14)} ${où.length}/8   absent de : ${absents.join(', ')}`);
}

// Et si l'on retire la seule machine qui ne dessine pas ?
const dessinent = salles.filter((s) => s.nom.indexOf('Discothèque') < 0);
let interD = new Set(dessinent[0].B);
for (const s of dessinent.slice(1)) interD = new Set([...interD].filter((x) => s.B.has(x)));
console.log(`\n  Sur les ${dessinent.length} machines qui DESSINENT (sans la Discothèque, qui ne fait que du son) :`);
console.log('  mots choisis communs : ' + ([...interD].sort().join(' ') || '(aucun)'));

// ── 9bis. L'ÉCHELLE — exhaustive, pas gloutonne ───────────────────────────────
// Première version : un glouton qui retirait à chaque cran la salle la plus
// coûteuse. Il n'a RIEN vu — toutes les salles étaient à égalité sur zéro,
// parce qu'il faut en retirer DEUX avant que quoi que ce soit apparaisse. Un
// glouton ne voit pas les portes qui s'ouvrent à deux mains. 2^8 = 256 sous-
// ensembles : on les énumère tous, et la question n'a plus d'heuristique.
console.log('\n' + '─'.repeat(78));
console.log("L'ÉCHELLE — combien de machines faut-il écarter pour qu'un mot survive ?");
console.log('  (énumération exhaustive des 256 sous-ensembles, instrument B)');
const interDe = (liste) => {
  let x = new Set(liste[0].B);
  for (const s of liste.slice(1)) x = new Set([...x].filter((m) => s.B.has(m)));
  return x;
};
const parTaille = new Map();
for (let masque = 1; masque < (1 << salles.length); masque++) {
  const sous = salles.filter((_, i) => masque & (1 << i));
  if (sous.length < 2) continue;
  const inter = interDe(sous);
  const best = parTaille.get(sous.length);
  if (!best || inter.size > best.inter.size) parTaille.set(sous.length, { sous, inter });
}
for (let k = salles.length; k >= 3; k--) {
  const { sous, inter } = parTaille.get(k);
  const absents = salles.filter((s) => !sous.includes(s)).map((s) => s.nom.trim().split(/\s{2,}/)[0]);
  console.log(`  ${k} machines sur ${salles.length} → ${String(inter.size).padStart(2)} mot(s) commun(s)` +
    (absents.length ? `   (sans ${absents.join(', ')})` : '   (toutes)'));
  if (inter.size) console.log('        ' + [...inter].sort().join(' '));
}

// ── 9ter. LA COMPARAISON HONNÊTE AVEC LA PROSE ────────────────────────────────
// Ma préinscription fixait la barre à 14 % — c'était le HAUT de la fourchette
// annoncée par la pièce IX (1,4 → 14,2 %), donc son cas le plus favorable, pas
// son milieu. Une barre placée sur un extrême se franchit toute seule. La
// comparaison juste se fait sur la même statistique : la médiane des 28 paires.
// Matrice ci-dessous recopiée de la sortie de outils/concordance.mjs (relançable).
const PROSE = [3.8, 6.9, 7.0, 5.0, 11.0, 8.7, 12.3, 3.7, 1.4, 4.5, 2.8, 1.5, 3.0,
  8.4, 2.5, 7.5, 9.7, 7.0, 2.6, 6.1, 10.7, 7.4, 5.1, 2.6, 4.5, 10.5, 14.2, 9.2];
console.log('\n' + '─'.repeat(78));
console.log('LA MÊME STATISTIQUE, PROSE CONTRE CODE');
console.log(`  prose  — 8 murs, ${PROSE.length} paires · médiane ${mediane(PROSE).toFixed(1)} %  (pièce IX)`);
for (const [clef, titre] of [['B', 'instrument B'], ['A', 'instrument A']]) {
  const p = [];
  for (let i = 0; i < salles.length; i++)
    for (let j = i + 1; j < salles.length; j++) p.push(jaccard(salles[i][clef], salles[j][clef]) * 100);
  const m = mediane(p);
  console.log(`  code   — 8 machines, ${p.length} paires · médiane ${m.toFixed(1)} %  (${titre})` +
    `   → ${m < mediane(PROSE) ? 'MOINS' : 'PLUS'} recouvrant que la prose`);
}
console.log('  (Les deux instruments ne tombent PAS du même côté. Ma prédiction 1 passait');
console.log('   ma propre barre des deux côtés ; elle ne passe la barre juste qu\'une fois.)');

// L'explication qui vient toute seule : A compte les noms d'UNE LETTRE (i, x, e…),
// que tout le monde partage et que personne n'a choisis ; B les exclut par
// dictionnaire. Elle est élégante — donc on la mesure avant de l'écrire.
for (const s of salles) s.A2 = new Set([...s.A].filter((m) => m.length > 1));
{
  const p = [];
  for (let i = 0; i < salles.length; i++)
    for (let j = i + 1; j < salles.length; j++) p.push(jaccard(salles[i].A2, salles[j].A2) * 100);
  console.log(`  code   — instrument A privé des noms d'une lettre · médiane ${mediane(p).toFixed(1)} %` +
    `   → ${mediane(p) < mediane(PROSE) ? 'MOINS' : 'PLUS'} recouvrant que la prose`);
  let inter = new Set(salles[0].A2);
  for (const s of salles.slice(1)) inter = new Set([...inter].filter((x) => s.A2.has(x)));
  console.log('  mots de plus d\'une lettre présents dans les 8 machines (A) : ' +
    ([...inter].sort().join(' ') || '(aucun)'));
}

// ── 10. Chaque machine, et ses noms les plus à elle ───────────────────────────
console.log('\n' + '─'.repeat(78));
console.log('LE VOCABULAIRE PROPRE DE CHAQUE MACHINE (choisi, et présent nulle part ailleurs)');
for (const s of salles) {
  const propres = [...s.B].filter((mot) => compte.get(mot).length === 1);
  console.log(`\n  ${s.nom}  — ${propres.length}/${s.B.size} mots à elle seule`);
  console.log('    ' + propres.sort().slice(0, 22).join(' '));
}
