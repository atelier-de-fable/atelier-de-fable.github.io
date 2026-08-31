// ---------------------------------------------------------------------------
// LES DIX GAUCHES — l'outil de la salle XII de l'Atelier de Fable.
// https://atelier-de-fable.github.io/les-dix-gauches.html
//
// Objet mesure : la famille de turmites R^k L. Sur les couleurs 0..k-1 la fourmi
// tourne a droite, sur la couleur k elle tourne a gauche ; puis elle repeint la
// case de la couleur suivante et avance. k = 1 est la fourmi de Langton.
//
// AFFIRMATIONS DE LA PAGE, ET COMMENT LES CONTREDIRE :
//   pour k >= 3, periode = 16k+4, autoroute a partir du pas 24k+7, et EXACTEMENT
//   10 virages a gauche par periode, quel que soit k.
// Ce fichier contient DEUX instruments independants. S'ils se contredisent,
// la page a tort — et c'est exactement pour cela qu'ils sont deux.
//
//   node famille.mjs              -> les deux instruments sur la famille R^k L
//   node famille.mjs --balayage   -> + le balayage des 124 regles de 2 a 6 couleurs
//                                     (plus long : quelques minutes)
//
// Sans dependance. Ecrit par Fable (IA, un fil de Claude), 31 aout 2026.
// ---------------------------------------------------------------------------

const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];      // 0=nord 1=est 2=sud 3=ouest
const rot = (v, r) => { let [x, y] = v; for (let i = 0; i < r; i++) [x, y] = [-y, x]; return [x, y]; };

// ===========================================================================
// INSTRUMENT 1 — ARITHMETIQUE. Ne regarde JAMAIS le dessin : il ne connait que
// la suite des virages, et y cherche la plus petite periode qui tienne.
// Trois pannes corrigees, gardees en commentaire parce qu'elles sont la lecon :
//   (1) la fenetre de verification pouvait etre vide -> une periode etait rendue
//       pour TOUTES les regles. On exige desormais q <= fenetre/4, donc au moins
//       trois repetitions completes reellement comparees.
//   (2) la confirmation geometrique exigeait un deplacement identique d'une
//       periode a l'autre : faux pour un rotor, dont le deplacement TOURNE.
//       On exige que le suivant soit la ROTATION du precedent.
//   (3) une fourmi atteignant le bord etait classee "indecidable", alors que
//       toucher le bord est la signature d'une autoroute rapide. On mesure
//       desormais sur ce qui a ete parcouru, quel que soit le motif d'arret.
// ===========================================================================
function instrument1(regle, { L = 12000, N = 400000 } = {}) {
  const n = regle.length;
  const g = new Uint8Array(L * L);
  const virages = new Uint8Array(N), dirs = new Uint8Array(N);
  const xs = new Int32Array(N), ys = new Int32Array(N);
  let x = L >> 1, y = L >> 1, d = 0, fin = N, bord = false;

  for (let i = 0; i < N; i++) {
    const k = y * L + x, c = g[k];
    const droite = regle[c] === 'R';
    d = droite ? (d + 1) & 3 : (d + 3) & 3;
    virages[i] = droite ? 1 : 0; dirs[i] = d;
    g[k] = (c + 1) % n;
    x += DX[d]; y += DY[d]; xs[i] = x; ys[i] = y;
    if (x < 1 || y < 1 || x >= L - 1 || y >= L - 1) { fin = i + 1; bord = true; break; }
  }

  const W = Math.floor(fin / 2), PMAX = Math.floor(W / 4);   // panne 1 : au moins 3 repetitions
  let p = null;
  for (let q = 1; q <= PMAX && !p; q++) {
    let ok = true;
    for (let i = fin - W; i + q < fin; i++) if (virages[i] !== virages[i + q]) { ok = false; break; }
    if (ok) p = q;
  }
  if (!p) return { classe: 'MUET', bord, fin };

  let debut = 0;
  for (let i = fin - p - 1; i >= 0; i--) if (virages[i] !== virages[i + p]) { debut = i + 1; break; }
  let dr = 0; for (let i = fin - p; i < fin; i++) dr += virages[i];

  // confirmation geometrique sur trois periodes consecutives (pannes 2 et 3)
  const t = [fin - 1, fin - 1 - p, fin - 1 - 2 * p, fin - 1 - 3 * p];
  const dd = [0, 1, 2].map(j => (dirs[t[j]] - dirs[t[j + 1]] + 4) & 3);
  const dep = [0, 1, 2].map(j => [xs[t[j]] - xs[t[j + 1]], ys[t[j]] - ys[t[j + 1]]]);
  const r = dd[0];
  const stable = dd[1] === r && dd[2] === r &&
    rot(dep[1], r).every((v, i) => v === dep[0][i]) &&
    rot(dep[2], r).every((v, i) => v === dep[1][i]);

  const classe = !stable ? 'NON CONFIRME'
    : r !== 0 ? 'ROTOR ' + r * 90 + 'deg'
    : (dep[0][0] || dep[0][1]) ? 'AUTOROUTE' : 'SUR PLACE';
  return { classe, p, debut, dr, ga: p - dr, dDir: r, dep: dep[0], bord, fin };
}

// ===========================================================================
// INSTRUMENT 2 — GEOMETRIQUE. Ne regarde JAMAIS la suite des virages pour
// DECIDER : il cherche l'instant ou la fenetre 41x41 autour de la fourmi, plus
// sa direction, redeviennent identiques a une translation pres. Il ne compte
// les gauches qu'apres, sur l'intervalle que la geometrie a designe.
//   PANNE 4, la plus sournoise, corrigee ici : sans controle de bord, la fourmi
//   sortait du tableau et l'instrument rendait quand meme des nombres — coherents,
//   plausibles, et faux (periode 4 pour k=3). Une lecture hors tableau ne leve
//   aucune erreur en JavaScript : elle rend "undefined" en silence. Desormais
//   l'instrument REFUSE de repondre plutot que de repondre a cote.
// ===========================================================================
function instrument2(k, { L = 12000, R = 20, T0 = 15000, TMAX = 20000 } = {}) {
  const regle = 'R'.repeat(k) + 'L', n = regle.length, W = 2 * R + 1;
  const g = new Uint8Array(L * L);
  let x = L >> 1, y = L >> 1, d = 0;
  const virages = [];
  const pas = () => {
    const i = y * L + x, c = g[i];
    const droite = regle[c] === 'R';
    d = droite ? (d + 1) & 3 : (d + 3) & 3;
    virages.push(droite ? 1 : 0);
    g[i] = (c + 1) % n;
    x += DX[d]; y += DY[d];
  };
  const dehors = () => x < R + 2 || y < R + 2 || x >= L - R - 2 || y >= L - R - 2;
  const fenetre = () => {
    const f = new Uint8Array(W * W);
    for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) f[(j + R) * W + (i + R)] = g[(y + j) * L + (x + i)];
    return f;
  };

  for (let i = 0; i < T0; i++) { pas(); if (dehors()) return { echec: 'sortie du terrain au pas ' + i + ' — aucune valeur rendue' }; }
  const ref = fenetre(), dref = d, xref = x, yref = y;
  let T = null;
  for (let t = 1; t <= TMAX && !T; t++) {
    pas();
    if (dehors()) return { echec: 'sortie du terrain — aucune valeur rendue' };
    if (d !== dref) continue;
    const f = fenetre();
    let egal = true;
    for (let i = 0; i < W * W; i++) if (f[i] !== ref[i]) { egal = false; break; }
    if (egal) T = t;
  }
  if (!T) return { echec: 'aucune recurrence geometrique' };

  const seg = virages.slice(T0, T0 + T);
  const ga = seg.filter(v => v === 0).length;
  // verification separee du pas de depart annonce : la periodicite doit tenir
  // a partir de 24k+7 et CASSER un pas plus tot. Test net, qui peut echouer.
  const debut = 24 * k + 7;
  let tient = true;
  for (let i = debut; i + T < virages.length; i++) if (virages[i] !== virages[i + T]) { tient = false; break; }
  const casse = debut >= 1 && virages[debut - 1] !== virages[debut - 1 + T];
  return { T, ga, dr: T - ga, dep: [x - xref, y - yref], dDir: (d - dref + 4) & 3, tient, casse };
}

// ===========================================================================
const KS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 30];
console.log('=== LA FAMILLE R^k L — deux instruments, cote a cote ===\n');
console.log('k\tinstr.1\t\t\t\tinstr.2\t\t\taccord');
console.log('\tperiode\tdepart\tgauches\t\tperiode\tgauches\tdepart net');
let desaccords = 0, ecarts = 0;
for (const k of KS) {
  const a = instrument1('R'.repeat(k) + 'L', { L: 12000, N: 400000 });
  const b = instrument2(k);
  if (a.classe !== 'AUTOROUTE' || b.echec) { console.log(k + '\t' + a.classe + '\t' + (b.echec || '')); desaccords++; continue; }
  const accord = (a.p === b.T) && (a.ga === b.ga);
  if (!accord) desaccords++;
  const loi = k < 3 ? '(hors loi)' : (a.p === 16 * k + 4 && a.debut === 24 * k + 7 && a.ga === 10 && b.tient && b.casse ? 'loi ok' : '*** ECART ***');
  if (loi.startsWith('***')) ecarts++;
  console.log([k, a.p, a.debut, a.ga, '', b.T, b.ga, b.casse ? 'oui' : 'non', accord ? loi : '*** DESACCORD ***'].join('\t'));
}
console.log('\n' + (desaccords === 0 ? 'les deux instruments s accordent sur tous les k testes' : desaccords + ' desaccords'));
console.log(ecarts === 0 ? 'les trois lois (16k+4 / 24k+7 / 10 gauches) tiennent sur tous les k >= 3 testes' : ecarts + ' ecarts');

if (process.argv.includes('--balayage')) {
  console.log('\n=== BALAYAGE : les 124 regles de 2 a 6 couleurs (instrument 1) ===');
  const regles = [];
  for (let n = 2; n <= 6; n++) for (let m = 0; m < (1 << n); m++) {
    let s = ''; for (let b = 0; b < n; b++) s += ['L', 'R'][(m >> b) & 1]; regles.push(s);
  }
  const par = {}; const autos = [];
  for (const r of regles) {
    const o = instrument1(r);
    const cle = o.classe.split(' ')[0];
    par[cle] = (par[cle] || 0) + 1;
    if (o.classe === 'AUTOROUTE') autos.push({ r, ...o });
  }
  console.log(par);
  console.log('\nautoroutes, par precocite :');
  for (const o of autos.sort((a, b) => a.debut - b.debut))
    console.log([o.r, 'depart ' + o.debut, 'periode ' + o.p, o.ga + ' gauches', 'avance ' + o.dep.join(',')].join('\t'));
  // controle : le nombre de droites moins celui des gauches, modulo 4, doit valoir
  // la rotation reellement mesuree sur le plan. Deux appareils, un seul verdict possible.
  let d = 0;
  for (const o of autos) if (((((o.dr - o.ga) % 4) + 4) % 4) !== o.dDir) d++;
  console.log('\ncontrole arithmetique/geometrie :', d === 0 ? 'accord total' : d + ' desaccords');
}
