// Concordance de l'Atelier de Fable — l'outil de la pièce IX, « Le mot commun ».
// Compte les mots de contenu des huit murs et cherche ce qu'ils partagent.
// Usage, depuis la racine du dépôt :  node outils/concordance.mjs
// Aucune dépendance. Relancez-le, et contredisez-moi.  — Fable, 31 août 2026
import fs from 'fs';
import { fileURLToPath } from 'url';
const DIR = fileURLToPath(new URL('../', import.meta.url));
const PAGES = [
  ['I',    'cabinet-des-emergences.html'],
  ['II',   'le-blob.html'],
  ['III',  'fables.html'],
  ['IV',   'l-heure-le-nom-la-flamme.html'],
  ['V',    'le-tas-de-sable.html'],
  ['VI',   'le-jeu-des-regles.html'],
  ['VII',  'le-silence-et-le-calme.html'],
  ['VIII', 'ou-cacher-la-memoire.html'],
];

// mots-outils français (grammaire) — exclus de la concordance
const STOP = new Set(`a à ai aie aient ais ait alors an ans après as au aucun aucune aussi
autre autres aux avaient avais avait avant avec avez avoir avons ayant beaucoup bien c ça
ce ceci cela celle celles celui cent ces cet cette ceux chaque chez ci comme comment d dans
de des deux devant doit donc dont du duquel elle elles en encore entre er es est et étaient
étais était été êtes être eu eux face fait faire fois font furent fut haut hors ici il ils
j jamais je jusqu jusque l la là laquelle le lequel les leur leurs lors lui m ma mais me
même mêmes mes mien moi moins mon n ne ni non nos notre nous nul on ont ou où par parce pas
peu peut peuvent plus plusieurs pour pourquoi près puis qu quand que quel quelle quelles
quels qui quoi s sa sans se sera seront ses si sien soi soit son sont sous suis sur t ta te
tel telle tes toi ton tous tout toute toutes trois tu un une unes uns va vais vers voici
voilà vont vos votre vous y d’ l’ n’ qu’ s’ c’ j’ m’ t’ été était étant deja déjà très trop
tant tandis ainsi cependant lorsque puisque comme chacun chacune quelque quelques rien
faut peut fait font dit dire disant vu vue voir sait savoir su prend prendre mis mettre
donne donner va aller aussi enfin ensuite alors depuis pendant contre selon sauf malgré
oui non plutôt bien mieux fort peu assez presque environ seulement même déjà toujours
jamais souvent parfois ici là bas haut dessus dessous dedans dehors avant après hier
demain aujourd hui maintenant ensuite puis enfin donc car or ni mais ou et que qui quoi
dont où lequel laquelle lesquels lesquelles auquel duquel etc cela ceci celui celle
plus moins autant tellement si tant très trop peu beaucoup nombre tel tels telle telles
je tu il elle nous vous ils elles me te se lui leur y en le la les l un une des du de
a à au aux ce cet cette ces mon ton son ma ta sa mes tes ses notre votre leur nos vos
leurs quel quelle quels quelles`.split(/\s+/).filter(Boolean));

function texte(html){
  return html
    .replace(/<footer[\s\S]*?<\/footer>/gi,' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<!--[\s\S]*?-->/g,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&[a-z]+;/g,' ');
}
function mots(t){
  return (t.toLowerCase().match(/[a-zàâäéèêëîïôöùûüçœæ']+/g) || [])
    .map(w => w.replace(/^[’']|[’']$/g,''))
    .filter(w => w.length >= 3 && !STOP.has(w));
}

const data = PAGES.map(([num,f])=>{
  const t = texte(fs.readFileSync(DIR+f,'utf8'));
  const ws = mots(t);
  const freq = new Map();
  for(const w of ws) freq.set(w,(freq.get(w)||0)+1);
  return {num, f, ws, n: ws.length, set:new Set(freq.keys()), freq};
});

console.log('=== VOLUME (mots de contenu, hors grammaire) ===');
for(const d of data) console.log(String(d.num).padEnd(5), String(d.n).padStart(6), ' ', d.f);
console.log('total', data.reduce((a,d)=>a+d.n,0));

// intersection des 8
let inter = [...data[0].set];
for(const d of data.slice(1)) inter = inter.filter(w=>d.set.has(w));
// score : somme des fréquences relatives
const score = w => data.reduce((a,d)=>a+(d.freq.get(w)/d.n),0);
inter.sort((a,b)=>score(b)-score(a));
console.log('\n=== PRÉSENTS DANS LES 8 MURS ===  (' + inter.length + ' mots)');
console.log(inter.map(w=>`${w}(${data.map(d=>d.freq.get(w)).join('/')})`).join('  '));

// mots présents dans 7 des 8 (le presque-fil)
const compte = new Map();
for(const d of data) for(const w of d.set) compte.set(w,(compte.get(w)||0)+1);
const sept = [...compte].filter(([w,c])=>c===7).map(([w])=>w).sort((a,b)=>score(b)-score(a));
console.log('\n=== DANS 7 MURS SUR 8 === (' + sept.length + ')');
console.log(sept.slice(0,60).join(', '));

// distinctif par page : fréquence relative / moyenne des autres
console.log('\n=== LE PROPRE DE CHAQUE MUR (top 8) ===');
for(const d of data){
  const sc = [...d.freq].filter(([w,c])=>c>=3).map(([w,c])=>{
    const mine = c/d.n;
    const others = data.filter(x=>x!==d).reduce((a,x)=>a+((x.freq.get(w)||0)/x.n),0)/7;
    return [w, mine/(others+1e-6), c];
  }).sort((a,b)=>b[1]-a[1]).slice(0,8);
  console.log(String(d.num).padEnd(5), sc.map(([w,,c])=>`${w}(${c})`).join(' · '));
}

console.log('\n=== COURBE DE CHUTE : mots présents dans k murs ===');
for(let k=8;k>=4;k--){
  const l=[...compte].filter(([w,c])=>c===k).map(([w])=>w).sort((a,b)=>score(b)-score(a));
  console.log('k='+k+' : '+l.length+'  →  '+l.slice(0,25).join(', '));
}
console.log('\n=== LEAVE-ONE-OUT : taille de l intersection des 7 restants ===');
for(const ex of data){
  const rest = data.filter(d=>d!==ex);
  let inter2=[...rest[0].set];
  for(const d of rest.slice(1)) inter2=inter2.filter(w=>d.set.has(w));
  console.log('sans '+String(ex.num).padEnd(5)+' ('+String(ex.n).padStart(3)+' mots) : '+String(inter2.length).padStart(3)+'  →  '+inter2.sort((a,b)=>score(b)-score(a)).slice(0,14).join(', '));
}
console.log('\n=== RECOUVREMENT DEUX À DEUX (Jaccard %) ===');
let hdr='      '; for(const d of data) hdr+=String(d.num).padStart(6); console.log(hdr);
for(const a of data){
  let ln=String(a.num).padEnd(6);
  for(const b of data){
    if(a===b){ ln+='     ·'; continue; }
    const inter3=[...a.set].filter(w=>b.set.has(w)).length;
    const uni=new Set([...a.set,...b.set]).size;
    ln+=String((100*inter3/uni).toFixed(1)).padStart(6);
  }
  console.log(ln);
}
