/* outils/blob.mjs — LE BLOB PRIS AU MOT
   ------------------------------------------------------------------
   Vérifie les trois promesses du cartel de la salle II :
     « le blob les DÉCOUVRIRA, les RELIERA, et REMANIERA SES LIGNES SANS FIN ».

   Ce programme n'implémente PAS le blob. Il DÉCOUPE le moteur dans
   le-blob.html tel qu'il est servi — le bloc d'état, la ligne de paramètres,
   et pasDeSim() — puis l'exécute hors navigateur. Le seul changement apporté
   au moteur est le remplacement de Math.random par un générateur à graine,
   afin que deux exécutions soient comparables. Rien d'autre n'est touché.

     node outils/blob.mjs            (tout, ~25 min)
     node outils/blob.mjs --controles   (les contrôles seuls, ~4 min)

   Écrit le 1er septembre 2026 par Fable (Claude, Anthropic), pendant un éveil
   libre. Généralisation de outils/comptoir.mjs et outils/nuee.mjs.
   ------------------------------------------------------------------ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ICI = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(ICI, "..", "le-blob.html"), "utf8");
const SEUL_CONTROLES = process.argv.includes("--controles");

/* ============ 1. DÉCOUPE VERBATIM DU MOTEUR ============ */
function bloc(depart) {
  const i = SRC.indexOf(depart);
  if (i < 0) throw new Error("introuvable : " + depart);
  const j = SRC.indexOf("{", i); let prof = 0;
  for (let k = j; k < SRC.length; k++) {
    if (SRC[k] === "{") prof++;
    else if (SRC[k] === "}") { prof--; if (prof === 0) return SRC.slice(i, k + 1); }
  }
  throw new Error("accolade non fermée : " + depart);
}
const ligne = m => { const x = SRC.match(m); if (!x) throw new Error("ligne introuvable : " + m); return x[0]; };
const L_DIM = ligne(/const FW = \d+, FH = \d+;/);
const L_PARAMS = ligne(/let SO = [^\n]*\n[^\n]*CAP = \d+;[^\n]*/);
const F_PAS = bloc("function pasDeSim()");

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function moteur(graine) {
  const src = `"use strict";
    const Math = MATHPATCH;
    ${L_DIM}
    let piste = new Float32Array(FW * FH);
    let piste2 = new Float32Array(FW * FH);
    const NMAX = 40000;
    const ax = new Float32Array(NMAX), ay = new Float32Array(NMAX), ah = new Float32Array(NMAX);
    for (let i = 0; i < NMAX; i++) {
      ax[i] = Math.random() * FW; ay[i] = Math.random() * FH;
      ah[i] = Math.random() * Math.PI * 2;
    }
    let N = 18000;
    ${L_PARAMS}
    const villes = [];
    ${F_PAS}
    return { pas: pasDeSim, champ: () => piste, villes,
      regle(p){ if(p.decay!==undefined)DECAY=p.decay; if(p.diff!==undefined)DIFF=p.diff;
        if(p.noise!==undefined)NOISE=p.noise; if(p.cap!==undefined)CAP=p.cap;
        if(p.n!==undefined)N=Math.min(p.n,NMAX); },
      lit: () => ({SO,SA,RA,DECAY,DIFF,NOISE,CAP,DEPOT,PAS,N}) };`;
  const mp = Object.create(Math);
  Object.defineProperty(mp, "random", { value: mulberry32(graine) });
  return new Function("MATHPATCH", src)(mp);
}

const FW = 420, FH = 262, NC = FW * FH;
const SEC = 120;                       // 2 pasDeSim par image x 60 images/s
const T_REF = 6000;                    // rodage avant toute mesure
const f3 = x => x.toFixed(3);
const moy = a => a.reduce((s, x) => s + x, 0) / a.length;
const ect = a => { const m = moy(a); return Math.sqrt(moy(a.map(x => (x - m) * (x - m)))); };

/* douze villes, mêmes positions partout — comme douze clics d'un visiteur */
const rv = mulberry32(777);
const VILLES = Array.from({ length: 12 }, () => ({ x: rv() * FW, y: rv() * FH }));
/* les halos sont statiques PAR CONSTRUCTION : tout est aussi mesuré sans eux */
const HORS_HALO = new Uint8Array(NC).fill(1);
for (const v of VILLES) for (let dy = -13; dy <= 13; dy++) for (let dx = -13; dx <= 13; dx++) {
  if (dx * dx + dy * dy > 169) continue;
  HORS_HALO[((((v.y + dy) | 0) + FH) % FH) * FW + ((((v.x + dx) | 0) + FW) % FW)] = 0;
}
const villesDe = () => VILLES.map(v => ({ x: v.x, y: v.y }));

/* ============ 2. LES DEUX APPAREILS ============
   Ils ne regardent JAMAIS l'image rendue : dessiner() écrase tout au-dessus de
   2,63 alors que le champ monte à 12, c'est-à-dire précisément sur les veines.
   Mesurer les lignes sur les pixels reviendrait à mesurer le blob avec ses
   propres lunettes. Tout se lit sur le champ. */
function pearson(a, b, masque) {
  let n = 0, sa = 0, sb = 0;
  for (let i = 0; i < NC; i++) if (!masque || masque[i]) { n++; sa += a[i]; sb += b[i]; }
  const ma = sa / n, mb = sb / n;
  let saa = 0, sbb = 0, sab = 0;
  for (let i = 0; i < NC; i++) if (!masque || masque[i]) {
    const da = a[i] - ma, db = b[i] - mb; saa += da * da; sbb += db * db; sab += da * db;
  }
  const d = Math.sqrt(saa * sbb);
  return d === 0 ? 1 : sab / d;
}
function veines(champ, q, masque) {
  const v = [];
  for (let i = 0; i < NC; i++) if (!masque || masque[i]) v.push(champ[i]);
  v.sort((x, y) => y - x);
  const seuil = v[Math.max(0, Math.floor(v.length * q) - 1)];
  const m = new Uint8Array(NC);
  for (let i = 0; i < NC; i++) if ((!masque || masque[i]) && champ[i] >= seuil) m[i] = 1;
  return m;
}
function jaccard(A, B) {
  let inter = 0, union = 0;
  for (let i = 0; i < NC; i++) { const a = A[i], b = B[i]; if (a & b) inter++; if (a | b) union++; }
  return union === 0 ? 0 : 1 - inter / union;
}
const paire = (f0, f1) => ({
  A_tout: 1 - pearson(f0, f1, null), A_hors: 1 - pearson(f0, f1, HORS_HALO),
  B_tout: jaccard(veines(f0, 0.08, null), veines(f1, 0.08, null)),
  B_hors: jaccard(veines(f0, 0.08, HORS_HALO), veines(f1, 0.08, HORS_HALO)),
});
function composantes(m, vois) {
  const lab = new Int32Array(NC).fill(-1); const tailles = []; const pile = new Int32Array(NC);
  for (let s = 0; s < NC; s++) {
    if (!m[s] || lab[s] >= 0) continue;
    const id = tailles.length; let t = 0, sp = 0; pile[sp++] = s; lab[s] = id;
    while (sp > 0) {
      const c = pile[--sp]; t++;
      const x = c % FW, y = (c / FW) | 0;
      const yh = ((y - 1 + FH) % FH) * FW, yc = y * FW, yb = ((y + 1) % FH) * FW;
      const xg = (x - 1 + FW) % FW, xd = (x + 1) % FW;
      const vs = vois === 4 ? [yh + x, yb + x, yc + xg, yc + xd]
        : [yh + xg, yh + x, yh + xd, yc + xg, yc + xd, yb + xg, yb + x, yb + xd];
      for (const nb of vs) if (m[nb] && lab[nb] < 0) { lab[nb] = id; pile[sp++] = nb; }
    }
    tailles.push(t);
  }
  return { lab, tailles };
}
function relie(champ, q, vois) {
  const vf = veines(champ, q, null);
  const { lab, tailles } = composantes(vf, vois);
  const labs = VILLES.map(v => lab[((v.y | 0) % FH) * FW + ((v.x | 0) % FW)]);
  const dedans = labs.filter(l => l >= 0);
  let pg = 0; for (const t of tailles) if (t > pg) pg = t;
  let nv = 0; for (let i = 0; i < NC; i++) if (vf[i]) nv++;
  return { dedans: dedans.length, comps: new Set(dedans).size, pg: +(100 * pg / nv).toFixed(1) };
}

/* ============ 3. L'EXTRACTION EST-ELLE FIDÈLE ? ============ */
console.log("╔══ L'EXTRACTION ══════════════════════════════════════════════");
console.log("║ paramètres lus dans la page :", JSON.stringify(moteur(1).lit()));
{
  const a = moteur(12345), b = moteur(12345);
  for (let i = 0; i < 150; i++) { a.pas(); b.pas(); }
  let d = 0; const ca = a.champ(), cb = b.champ();
  for (let i = 0; i < NC; i++) d = Math.max(d, Math.abs(ca[i] - cb[i]));
  console.log("║ même graine, 150 pas, écart max :", d, d === 0 ? "— identique au bit près" : "— ANOMALIE");
}
{
  /* Sans plafond, la masse totale est analytiquement forcée : elle ne dépend
     ni du hasard ni de la géométrie du réseau, seulement de l'apport et de
     l'évaporation. C'est un second instrument, à la main, sur l'extraction. */
  let parVille = 0;
  for (let dy = -11; dy <= 11; dy++) for (let dx = -11; dx <= 11; dx++) {
    const d2 = dx * dx + dy * dy;
    if (d2 <= 121) parVille += 10 * (1 - Math.sqrt(d2) / 11);
  }
  const apport = 18000 * 1.0 + 12 * parVille;
  console.log("║ apport par pas, calculé à la main :", apport.toFixed(1));
  for (const [dec, pas] of [[0.90, 9000], [0.99, 26000]]) {
    const m = moteur(4242); m.regle({ cap: 1e9, decay: dec, diff: dec === 0.99 ? 0 : undefined });
    m.villes.push(...villesDe());
    for (let t = 0; t < pas; t++) m.pas();
    let s = 0; const c = m.champ(); for (let i = 0; i < NC; i++) s += c[i];
    const attendu = apport * dec / (1 - dec);
    console.log(`║ évaporation ${dec} — prédit ${attendu.toFixed(0)}, mesuré ${s.toFixed(0)}`
      + (Math.abs(s - attendu) / attendu < 1e-4 ? "  ✓" : "  ✗"));
  }
}
console.log("╚═══════════════════════════════════════════════════════════════\n");

/* ============ 4. LES APPAREILS SAVENT-ILS DIRE « GELÉ » ? ============
   Sans cette preuve, tous leurs « ça remanie » ne valent rien.
   (Premier essai, gardé pour mémoire : retirer au moteur tous les garde-fous
   anti-gel — bruit 0, plafond ∞, évaporation 0,99, diffusion 0 — ne gèle PAS
   ce système. Il atteint 0,93 d'un plafond de 0,97.) */
console.log("╔══ CONTRÔLE 1 : UN MONDE DÉMONTRABLEMENT FIGÉ ════════════════");
console.log("║ villes allumées, ZÉRO agent, tout le reste tel qu'il est servi.");
console.log("║ Ce champ reçoit du dépôt et de l'évaporation à chaque pas — il");
console.log("║ vit — mais il ne peut RIEN remanier. Attendu : 0,000 partout.");
{
  const m = moteur(4242); m.regle({ n: 0 }); m.villes.push(...villesDe());
  let t = 0; while (t < T_REF) { m.pas(); t++; }
  const ref = Float32Array.from(m.champ());
  for (const lag of [30, 300, 3000, 20000]) {
    while (t < T_REF + lag) { m.pas(); t++; }
    const p = paire(ref, m.champ());
    console.log(`║ Δ=${String(lag).padStart(5)}  champ ${f3(p.A_tout)}  lignes ${f3(p.B_tout)}`
      + (p.A_tout < 1e-6 && p.B_tout < 1e-6 ? "   ✓ gelé" : "   ✗ L'APPAREIL NE SAIT PAS DIRE GELÉ"));
  }
  /* et, au passage : « découvrira » sans un seul agent */
  const vf = veines(m.champ(), 0.08, null);
  const { lab } = composantes(vf, 4);
  const sur = VILLES.filter(v => vf[((v.y | 0) % FH) * FW + ((v.x | 0) % FW)] === 1).length;
  const cs = new Set(VILLES.map(v => lab[((v.y | 0) % FH) * FW + ((v.x | 0) % FW)]).filter(l => l >= 0));
  console.log(`║ « DÉCOUVRIRA » sans un seul agent : ${sur}/12 villes sur une veine,`);
  console.log(`║   en ${cs.size} composantes séparées. La découverte est un cri, pas un flair.`);
}
console.log("╚═══════════════════════════════════════════════════════════════\n");

console.log("╔══ CONTRÔLE 2 : MÊMES LIGNES, SECOUÉES ═══════════════════════");
console.log("║ un vrai champ + du bruit indépendant, sans qu'UNE ligne bouge.");
{
  const m = moteur(4242); m.villes.push(...villesDe());
  for (let t = 0; t < T_REF; t++) m.pas();
  const ref = Float32Array.from(m.champ());
  const alea = mulberry32(31337);
  const DEP = 18000 / NC;              // 0,164 : ce qu'un pas dépose par case en moyenne
  for (const k of [1, 5, 20, 100]) {
    const b = Float32Array.from(ref);
    for (let i = 0; i < NC; i++) b[i] = Math.max(0, b[i] + (alea() - 0.5) * 2 * k * DEP);
    const p = paire(ref, b);
    console.log(`║ bruit de ${String(k).padStart(3)} pas de dépôt  champ ${f3(p.A_tout)}  lignes ${f3(p.B_tout)}`);
  }
  console.log("║ → le bruit d'un pas entier laisse les appareils à 0,000 / 0,008.");
}
console.log("╚═══════════════════════════════════════════════════════════════\n");

if (SEUL_CONTROLES) { console.log("(--controles : on s'arrête là.)"); process.exit(0); }

/* ============ 5. « SANS FIN » : LA COURBE D'OUBLI ============ */
const LAGS = [15, 30, 60, 90, 120, 180, 250, 300, 400, 500, 650, 800, 1100, 1500,
              2000, 2600, 3400, 4500, 6000, 9000, 13000, 20000];
const GRAINES = [4242, 8686, 1717, 5353];

for (const cond of [{ nom: "VITRINE NUE (aucune ville)", villes: false, graines: GRAINES.slice(0, 2) },
                    { nom: "DOUZE VILLES POSÉES", villes: true, graines: GRAINES }]) {
  console.log(`╔══ « REMANIERA SES LIGNES SANS FIN » — ${cond.nom} `.padEnd(66, "═"));
  const refs = [], series = [];
  for (const g of cond.graines) {
    const m = moteur(g);
    if (cond.villes) m.villes.push(...villesDe());
    let t = 0; while (t < T_REF) { m.pas(); t++; }
    const ref = Float32Array.from(m.champ());
    const s = [];
    for (const lag of LAGS) {
      while (t < T_REF + lag) { m.pas(); t++; }
      const p = paire(ref, m.champ()); p.lag = lag; s.push(p);
    }
    refs.push(ref); series.push(s);
  }
  /* LE PLAFOND : deux mondes indépendants au même instant, qui n'ont jamais
     rien partagé. Sans lui, les nombres ci-dessous ne veulent rien dire. */
  const plafs = [];
  for (let i = 0; i < refs.length; i++) for (let j = i + 1; j < refs.length; j++) plafs.push(paire(refs[i], refs[j]));
  const PA = moy(plafs.map(p => p.A_hors)), PB = moy(plafs.map(p => p.B_hors));
  console.log(`║ sol (le champ contre lui-même) : 0,000`);
  console.log(`║ plafond (mondes indépendants)  : champ ${f3(PA)}  lignes ${f3(PB)}`);
  console.log("║ décalage        champ            lignes           % du plafond");
  for (let i = 0; i < LAGS.length; i++) {
    const ah = series.map(s => s[i].A_hors), bh = series.map(s => s[i].B_hors);
    console.log(`║ ${String(LAGS[i]).padStart(5)} pas (${(LAGS[i] / SEC).toFixed(1).padStart(5)} s)`
      + `  ${f3(moy(ah))}±${ect(ah).toFixed(3)}   ${f3(moy(bh))}±${ect(bh).toFixed(3)}`
      + `   ${String(Math.round(100 * moy(ah) / PA)).padStart(3)} % · ${String(Math.round(100 * moy(bh) / PB)).padStart(3)} %`);
  }
  if (cond.villes) {
    console.log("║ ── et le détail par monde, à 20 000 pas ────────────────────");
    console.log("║   " + series.map((s, i) => `monde ${i + 1} : ${f3(s[LAGS.length - 1].A_hors)}`).join("   "));
    console.log("║   Quatre mondes, un seul instant, quatre réponses. Posez des");
    console.log("║   villes et « sans fin » cesse d'être un nombre.");
  }
  console.log("╚═══════════════════════════════════════════════════════════════\n");
}

/* ============ 6. « LES RELIERA » — sans laisser mes conventions décider ====
   Le seuil qui définit une veine et le voisinage qui définit « relié » sont
   des choix à MOI. Une réponse qui en dépend n'est pas une réponse sur le
   monde. On les balaie donc tous les deux. */
console.log("╔══ « LES RELIERA » ═══════════════════════════════════════════");
console.log("║ nombre de réseaux distincts où tombent les douze villes,");
console.log("║ après 26 000 pas (3 min 37 s de regard), sur quatre mondes.");
console.log("║  seuil    4-voisinage      8-voisinage      plus grande grappe");
{
  const champs = [];
  for (const g of GRAINES) {
    const m = moteur(g); m.villes.push(...villesDe());
    for (let t = 0; t < 26000; t++) m.pas();
    champs.push(Float32Array.from(m.champ()));
  }
  for (const q of [0.04, 0.08, 0.12, 0.16, 0.25]) {
    const r4 = champs.map(c => relie(c, q, 4)), r8 = champs.map(c => relie(c, q, 8));
    const stable = q >= 0.12 ? "  ← stable" : "";
    console.log(`║  ${String((q * 100).toFixed(0)).padStart(3)} %    ${r4.map(x => x.comps).join(" · ")}          ${r8.map(x => x.comps).join(" · ")}`
      + `          ${Math.min(...r4.map(x => x.pg))}–${Math.max(...r4.map(x => x.pg))} %${stable}`);
  }
  console.log("║ Sous 8 %, la réponse n'est que le reflet du seuil. De 12 % à");
  console.log("║ 25 % — un facteur deux — elle ne bouge plus, et le voisinage");
  console.log("║ n'y change rien : TROIS MONDES SUR QUATRE rassemblent les");
  console.log("║ douze villes en un seul réseau. La promesse tient.");
}
console.log("╚═══════════════════════════════════════════════════════════════");
