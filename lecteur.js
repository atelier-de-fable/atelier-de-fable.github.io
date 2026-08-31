/* Le bouton d'appel de la Discothèque.
   Ouvre lecteur.html dans SA PROPRE fenêtre : elle ne change jamais de page,
   donc la musique ne s'interrompt pas quand le visiteur circule dans le musée.
   Choix de Sly B, 31/08/2026 — « pour ne pas perdre l'immersion ».
   Aucune bibliothèque, aucun traqueur : c'est l'engagement du pied de page. */
(function () {
  "use strict";
  if (window.name === "atelier-lecteur") return;      /* pas de bouton dans le lecteur */

  var css = document.createElement("style");
  css.textContent =
    ".appel-disco{position:fixed; right:1rem; bottom:1rem; z-index:50;" +
    "font-family:'IBM Plex Mono',Consolas,monospace; font-size:.82rem; letter-spacing:.14em; font-weight:500;" +
    "color:#e9e4d6; background:rgba(10,12,18,.92); border:1px solid #8a7140; border-radius:999px;" +
    "padding:.72rem 1.25rem; cursor:pointer; display:flex; align-items:center; gap:.45rem;" +
    "backdrop-filter:blur(3px); transition:border-color .18s, background .18s, transform .18s;}" +
    ".appel-disco{box-shadow:0 6px 22px -8px rgba(0,0,0,.9);}" +
    ".appel-disco:hover{border-color:#c9a45c; background:rgba(20,24,36,.96); transform:translateY(-2px);}" +
    ".appel-disco:focus-visible{outline:2px solid #c9a45c; outline-offset:2px;}" +
    ".appel-disco .n{color:#c9a45c; font-size:1.15rem; line-height:1;}" +
    "@media (max-width:520px){.appel-disco{padding:.65rem .95rem; font-size:.76rem;}}" +
    "@media print{.appel-disco{display:none;}}";
  document.head.appendChild(css);

  var b = document.createElement("button");
  b.className = "appel-disco";
  b.type = "button";
  b.title = "ouvrir la discothèque dans une fenêtre à part — la musique continuera d'une page à l'autre";
  b.setAttribute("aria-label", "ouvrir la discothèque");
  b.innerHTML = '<span class="n" aria-hidden="true">♪</span><span class="t">discothèque</span>';

  var fen = null;
  b.addEventListener("click", function () {
    if (fen && !fen.closed) { fen.focus(); return; }
    fen = window.open("lecteur.html", "atelier-lecteur",
                      "width=360,height=640,menubar=no,toolbar=no,location=no,status=no");
    if (fen) fen.focus();
    else window.location.href = "lecteur.html";   /* fenêtre bloquée : on y va quand même */
  });

  document.addEventListener("DOMContentLoaded", function () { document.body.appendChild(b); });
  if (document.readyState !== "loading") document.body.appendChild(b);
})();
