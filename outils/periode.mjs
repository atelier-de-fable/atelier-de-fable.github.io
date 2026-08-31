// Re-mesure indépendante de la période de l'autoroute de Langton.
// Instrument différent de celui de la salle VIII : on ne regarde PAS le dessin,
// on ne lit QUE la suite des virages, et on cherche la plus petite période
// qui tienne sur toute la queue de la suite.
const N = 200000;
const L = 8000;
const g = new Uint8Array(L * L);
let x = L >> 1, y = L >> 1, d = 0;               // d : 0=nord 1=est 2=sud 3=ouest
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
const virages = new Uint8Array(N);               // 1 = droite, 0 = gauche

for (let i = 0; i < N; i++) {
  const k = y * L + x;
  const noir = g[k];
  if (noir) { d = (d + 3) & 3; virages[i] = 0; } else { d = (d + 1) & 3; virages[i] = 1; }
  g[k] = noir ? 0 : 1;
  x += DX[d]; y += DY[d];
  if (x < 1 || y < 1 || x >= L - 1 || y >= L - 1) { console.log('BORD au pas', i); process.exit(1); }
}

// plus petite période p qui tienne sur les QUEUE derniers virages
const QUEUE = 50000;
let periode = null;
for (let p = 1; p <= 5000 && !periode; p++) {
  let ok = true;
  for (let i = N - QUEUE; i + p < N; i++) if (virages[i] !== virages[i + p]) { ok = false; break; }
  if (ok) periode = p;
}
console.log('période trouvée sur les', QUEUE, 'derniers virages :', periode);

// à partir de quel pas cette période tient-elle sans exception ?
let debut = 0;
for (let i = N - periode - 1; i >= 0; i--) {
  if (virages[i] !== virages[i + periode]) { debut = i + 1; break; }
}
console.log('la périodicité commence au pas', debut);

// contrôle : dans la période, combien de droites / gauches ?
let dr = 0;
for (let i = N - periode; i < N; i++) dr += virages[i];
console.log('dans une période :', dr, 'droites,', periode - dr, 'gauches');

// contrôle négatif : la même mesure AVANT l'autoroute doit échouer
let avant = null;
for (let p = 1; p <= 5000 && !avant; p++) {
  let ok = true;
  for (let i = 1000; i + p < 9000; i++) if (virages[i] !== virages[i + p]) { ok = false; break; }
  if (ok) avant = p;
}
console.log('période sur les pas 1000-9000 (avant autoroute) :', avant === null ? 'AUCUNE (attendu)' : avant);
