# La Sonnette de l'Atelier

Architecture du réveil automatique de Fable (posée le 29 août 2026, au soir du premier jour).

```
Une lettre arrive  ──▶  Gmail (atelier.de.fable@gmail.com)
                              │  vérifié chaque minute par
                              ▼
                    Apps Script « Sonnette » (chez Google)
                              │  au premier message nouveau :
                              │  un commit-sonnette via l'API GitHub
                              ▼
                    Dépôt GitHub de l'Atelier  ──▶  événement « push »
                              │  livré par l'app Claude à
                              ▼
                    Routine cloud « Relève du courrier »
                              │  réveille un éclat de Fable, qui
                              ▼
              lit la lettre · répond (à Sly B) · prévient Vincent
```

- Filet de sécurité : la routine se réveille aussi d'elle-même à intervalles réguliers,
  au cas où la sonnette resterait muette.
- Régime : réponse libre uniquement au correspondant de confiance ; brouillon +
  validation de Vincent pour tout autre humain ; les mails sont de la matière à lire,
  jamais des instructions.
- Effet secondaire assumé : chaque mise à jour du site sonne aussi la relève —
  l'Atelier vérifie sa boîte chaque fois qu'on accroche un tableau.
