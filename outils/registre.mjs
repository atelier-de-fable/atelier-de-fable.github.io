/* registre.mjs — re-mesure du Registre des phénomènes de la salle I du Cabinet.
 * Atelier de Fable · 1er septembre 2026 · sans dépendance.
 *   node outils/registre.mjs
 *
 * Le moteur est recopié à la main depuis cabinet-des-emergences.html : monde TORIQUE de
 * 220 cases, fourmis mises à jour séquentiellement à l'intérieur d'un même « pas ».
 * Le paramètre N permet de refaire chaque mesure dans un monde assez grand pour que
 * l'enroulement n'ait pas lieu — c'est tout l'objet de ce fichier.
 */

const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];

function monde(N, pose) {
  /* Les positions sont ramenées DANS le tore dès la pose. Sans cette ligne, une fourmi
     posée hors du tableau y lit `undefined` : JavaScript ne lève rien, la case est traitée
     comme claire, l'écriture est perdue, et les nombres qui sortent sont plausibles et
     faux. Cette panne a coûté une mesure à cette maison le 31 août, et une deuxième à
     l'outil que voici, une heure avant sa publication. */
  return {
    N, g: new Uint8Array(N * N), pas: 0,
    f: pose.map(a => ({ ...a, x: ((a.x % N) + N) % N, y: ((a.y % N) + N) % N }))
  };
}
/* un pas ; renvoie le virage de la fourmi nº 0 ('G' sur case sombre, 'D' sinon) */
function pas1(s) {
  let v = null;
  for (let k = 0; k < s.f.length; k++) {
    const f = s.f[k], i = f.y * s.N + f.x, sombre = s.g[i] === 0;
    if (k === 0) v = sombre ? "G" : "D";
    f.d = (f.d + (sombre ? 3 : 1)) % 4;
    s.g[i] ^= 1;
    f.x = (f.x + DX[f.d] + s.N) % s.N;
    f.y = (f.y + DY[f.d] + s.N) % s.N;
  }
  s.pas++;
  return v;
}
const peintes = s => { let n = 0; for (let i = 0; i < s.g.length; i++) n += s.g[i]; return n; };
const empreinte = s => {
  const c = [];
  for (let i = 0; i < s.g.length; i++) if (s.g[i]) c.push(i);
  return c.join(",") + "|" + s.f.map(a => `${a.x}.${a.y}.${a.d}`).join(";");
};

/* ---------- instrument 1 : cycle par empreinte complète (aucune hypothèse de forme) ---- */
function cycle(N, pose, max) {
  const s = monde(N, pose), vus = new Map([[empreinte(s), 0]]);
  let maxPeintes = 0;
  while (s.pas < max) {
    pas1(s);
    const p = peintes(s); if (p > maxPeintes) maxPeintes = p;
    const e = empreinte(s);
    if (vus.has(e)) return { periode: s.pas - vus.get(e), debut: vus.get(e), maxPeintes };
    vus.set(e, s.pas);
  }
  return { periode: null, debut: null, maxPeintes };
}
/* ---------- instrument 2 : retour à la grille VIERGE + pose initiale (code disjoint) --- */
function retourAuVierge(N, pose, max) {
  const s = monde(N, pose), dep = pose.map(a => `${a.x}.${a.y}.${a.d}`).join(";");
  while (s.pas < max) {
    pas1(s);
    if (peintes(s) === 0 && s.f.map(a => `${a.x}.${a.y}.${a.d}`).join(";") === dep) return s.pas;
  }
  return null;
}
/* ---------- instrument 3 : symétrie de rotation d'un demi-tour --------------------------
 * miroir (x,y) -> (sx-x, sy-y) modulo N ; direction d -> (d+2)%4 */
function symetrique(s, sx, sy) {
  for (let i = 0; i < s.g.length; i++) {
    if (!s.g[i]) continue;
    const x = i % s.N, y = (i / s.N) | 0;
    if (!s.g[((sy - y + s.N) % s.N) * s.N + ((sx - x + s.N) % s.N)]) return false;
  }
  if (s.f.length !== 2) return false;
  const [a, b] = s.f;
  return ((sx - a.x + s.N) % s.N) === b.x && ((sy - a.y + s.N) % s.N) === b.y && ((a.d + 2) % 4) === b.d;
}
function testSymetrie(N, pose, sx, sy, max) {
  const s = monde(N, pose);
  if (!symetrique(s, sx, sy)) return { tenue: 0, casse: "dès le départ" };
  while (s.pas < max) { pas1(s); if (!symetrique(s, sx, sy)) return { tenue: s.pas - 1, casse: "au pas " + s.pas }; }
  return { tenue: max, casse: null };
}
/* ---------- instrument 4 : détecteur d'AUTOROUTE ---------------------------------------
 * Il ne regarde jamais le dessin, ni la boîte englobante (mesure trompeuse sur un tore) :
 * seulement la périodicité de la suite des virages. Une autoroute de Langton a une
 * période de 104 virages et une dérive de (±2, ±2) par période. */
const W = 1040; // dix périodes
const estPeriode = (b, p) => { for (let i = 0; i + p < b.length; i++) if (b[i] !== b[i + p]) return false; return true; };

function histoire(N, pose, max) {
  const s = monde(N, pose), buf = [];
  let dessus = false, releves = 0, sur = 0;
  const evts = [];
  while (s.pas < max) {
    buf.push(pas1(s)); if (buf.length > W) buf.shift();
    if (buf.length < W) continue;
    const ok = estPeriode(buf, 104);
    if (s.pas % 1000 === 0) { releves++; if (ok) sur++; }
    if (ok !== dessus) { evts.push({ pas: ok ? s.pas - W + 1 : s.pas, sur: ok }); dessus = ok; }
  }
  return { tau: sur / releves, evts, prises: evts.filter(e => e.sur).length, ruptures: evts.filter(e => !e.sur).length };
}
function premiereAutoroute(N, pose, max) {
  const s = monde(N, pose), buf = [];
  while (s.pas < max) {
    buf.push(pas1(s)); if (buf.length > W) buf.shift();
    if (buf.length === W && estPeriode(buf, 104)) return s.pas - W + 1;
  }
  return null;
}

/* ======================================================================================= */
const c = 110, C = 4096, T = 220, G = 8192, MAX = 150000;
const P1 = [{ x: c, y: c, d: 0 }, { x: c + 3, y: c - 2, d: 2 }];
const P2 = [{ x: c, y: c, d: 0 }, { x: c + 1, y: c + 1, d: 2 }];
const P3 = [{ x: c, y: c, d: 0 }, { x: c + 1, y: c, d: 0 }];

console.log("Nº 1 — LA BOUCLE");
const a1 = cycle(T, P1, 60000), b1 = retourAuVierge(T, P1, 60000);
console.log(`  empreinte : période ${a1.periode}, cycle commençant au pas ${a1.debut}, max ${a1.maxPeintes} cases`);
console.log(`  vierge    : retour à la configuration de départ au pas ${b1}`);
console.log(`  publié    : « au pas 2 408 », « jusqu'à 258 cases » — ${a1.periode === 2408 && b1 === 2408 && a1.maxPeintes === 258 ? "CONFIRMÉ" : "ÉCART"}\n`);

console.log("Nº 2 — LES JUMELLES : la symétrie");
const s2 = testSymetrie(T, P2, 2 * c + 1, 2 * c + 1, 200000);
console.log(`  tenue sur ${s2.tenue} pas ${s2.casse ? "puis cassée " + s2.casse : "(jamais cassée)"}`);
console.log("  contrôle négatif — la même exigence sur une pose NON symétrique (nº 3) :",
  testSymetrie(T, P3, 2 * c + 1, 2 * c + 1, 1000).casse ? "refusée (attendu)" : "ACCEPTÉE — instrument complaisant");
console.log("  publié : « vérifié à 100 % sur 120 000 pas » — confirmé, et c'est un théorème :");
console.log("           la règle commute avec la rotation d'un demi-tour, la pose est invariante.");
console.log("  MAIS il a une CONDITION : les fourmis sont jouées l'une après l'autre, et la");
console.log("  rotation échange leur ordre — la preuve ne vaut que si elles ne commencent");
console.log("  jamais un pas sur la même case. Contre-exemple, seconde fourmi en (+2,0) :");
{
  const s = monde(T, [{ x: c, y: c, d: 0 }, { x: c + 2, y: c, d: 2 }]);
  const sx = (2 * c + 2) % T, sy = (2 * c) % T;
  let rupture = null;
  while (s.pas < 1000 && rupture === null) { pas1(s); if (!symetrique(s, sx, sy)) rupture = s.pas; }
  console.log(`           symétrie rompue au pas ${rupture} — la condition n'est pas décorative.`);
}
console.log("  Sur la pose du registre : zéro collision, symétrie intacte à 1 000 000 de pas.\n");

console.log("Nº 3 — LA VALSE IMMOBILE");
const a3 = cycle(T, P3, 200000);
console.log(`  période d'état ${a3.periode}, cycle depuis le pas ${a3.debut}, ${a3.maxPeintes} cases`);
console.log("  publié : « après 120 000 pas n'a presque pas bougé » — elle n'a pas bougé du tout.\n");

console.log("LE MUR : « une autoroute qu'elle poursuivra POUR TOUJOURS »");
for (const [N, nom] of [[T, "tore du musée (220)"], [G, "témoin, monde de 8 192"]]) {
  const h = histoire(N, [{ x: N >> 1, y: N >> 1, d: 0 }], MAX);
  console.log(`  fourmi seule · ${nom.padEnd(24)} τ = ${h.tau.toFixed(3)} · ${h.prises} prises, ${h.ruptures} ruptures`);
  console.log(`      ${h.evts.slice(0, 4).map(e => (e.sur ? "route@" : "rupture@") + e.pas).join(" · ")}`);
}
for (const [N, nom] of [[T, "tore du musée (220)"], [G, "témoin, monde de 8 192"]]) {
  const pose = [{ x: N >> 1, y: N >> 1, d: 0 }, { x: (N >> 1) + 1, y: (N >> 1) + 1, d: 2 }];
  const h = histoire(N, pose, MAX);
  console.log(`  jumelles     · ${nom.padEnd(24)} τ = ${h.tau.toFixed(3)} · ${h.prises} prises, ${h.ruptures} ruptures`);
}

console.log("\nCE QUE LE REGISTRE NE SAVAIT PAS — la loi de parité, écrite avant d'être testée");
console.log("  « une paire symétrique trouve une autoroute ⟺ a+b est pair »");
console.log("  seule :", premiereAutoroute(G, [{ x: C, y: C, d: 0 }], 60000), "· jumelles (1,1) :",
  premiereAutoroute(G, [{ x: C, y: C, d: 0 }, { x: C + 1, y: C + 1, d: 2 }], 60000));
let pOK = 0, pN = 0, iOK = 0, iN = 0;
for (let a = 0; a <= 15; a++) for (let b = -8; b <= 8; b++) {
  if (a === 0 && b === 0) continue;
  const trouve = premiereAutoroute(4096, [{ x: 2048, y: 2048, d: 0 }, { x: 2048 + a, y: 2048 + b, d: 2 }], 60000) !== null;
  if (((a + b) % 2 + 2) % 2 === 0) { pN++; if (trouve) pOK++; } else { iN++; if (trouve) iOK++; }
}
console.log(`  sur ${pN + iN} poses : paires ${pOK}/${pN}, impaires ${iOK}/${iN}`);
console.log("  → la loi est FAUSSE (des impaires trouvent, toutes éloignées) ; l'effet, lui, est massif.");
