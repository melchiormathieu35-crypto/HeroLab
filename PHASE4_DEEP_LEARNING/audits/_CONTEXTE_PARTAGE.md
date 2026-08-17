# Contexte partagé — faits déjà établis PAR EXÉCUTION

Ces chiffres ont été mesurés en exécutant le code, pas estimés. **Ne pas les
re-dériver** : partir de là et produire de l'analyse, pas de la découverte.

## Fichiers

| Rôle | Chemin |
|---|---|
| Baseline à auditer (ne pas modifier) | `VERSION_PRODUCTION/herolab.html` (16 410 lignes, mono-fichier) |
| Copie de référence figée | `PHASE4_DEEP_LEARNING/baseline-reference.html` |
| Harness de test Node | `tests/harness.js` (extrait le JS du moteur et l'exécute sous `vm`) |
| Suites existantes | `tests/regression.js` (79 PASS), `tests/browser.js` (37 PASS) |

Le script du moteur s'identifie par la présence de `const RANKS = "23456789TJQKA"`.

Pour inspecter le moteur en Node :
```js
const { M } = require("./tests/harness")("VERSION_PRODUCTION/herolab.html");
// M.Ranges, M.Spot, M.Play, M.Progress, M.MODES, M.PROFILES, M.Parser…
```

## Inventaire mesuré

| Élément | Valeur | Emplacement |
|---|---|---|
| Modes d'entraînement | 13 (dont 4 ciblant une rue) | `MODES` |
| Niveaux de difficulté | 6 | `LEVELS` |
| Profils adverses | 9 en jeu, 16 dans le Profiling Lab | `PROFILES`, `ALL_PROFILES` l.10917 |
| Paliers de carrière | 5 (NL2→NL50) | `TIERS` l.4923 |
| Formats de session | 3 (50/200/500 mains) | `SESSION_LENGTHS` l.5382 |
| Succès | 16 | l.5781+ |
| Mentors / avatars | 3 / 12 | `MENTORS`, `AVATARS` |
| Fuites coachées en jeu | **10** | `LEAK_INFO` l.4849 |
| Fuites détectées par le tracker | **29** (8 high, 19 mid, 2 low) | règles `sev:` l.15000+ |
| Traductions + exercices de fuites | 29 / 29 (aucune orpheline) | `LEAK_PLAIN` l.14690, `LEAK_DRILL` l.14846 |
| Labs | 3, à 4 niveaux chacun | `HR_DIFFICULTY` l.9101, `PR_DIFFICULTY` l.11121, `BL_DIFFICULTY` l.12690 |
| Tracker | 9 vues, 59 KPI, ~13 stats standard | |
| Décisions par main | **4,6** — preflop 30 %, flop 23 %, turn 24 %, river 23 % | mesuré sur 300 mains/mode |

## Ranges — état exact

Défini l.2820-2940, consommé par `RangeModel.prior()` (l.8775+) et le jugement.

- `OPEN` : **5 positions** (UTG, HJ, CO, BTN, SB) — 284 mains cumulées
- `BB_DEF` : **5 positions** — 339 mains cumulées, **branche « call » uniquement**
- `THREEBET` : **GLOBALE**, non déclinée par position
  `value: "QQ+, AKs, AKo"` · `bluff: "A5s, A4s, A3s, A2s, KJs, QJs, JTs, T9s, 87s, 76s"`
- `FOURBET` : **GLOBALE** — `value: "KK+, AKs"` · `bluff: "A5s, A4s, AKo"`

`Ranges.parse(str)` accepte une liste séparée par virgules et renvoie un `Set`.
`Ranges.expand(token)` gère : `77`, `AKs`, `TT+`, `A5s+`, `T9s-65s` (écart
constant) et `A2s-AJs` (même carte haute — corrigé en Phase 2).

**Trou majeur déjà identifié : 3bet et 4bet ne sont pas déclinés par couple de
positions.** C'est le point de départ de l'agent C, pas sa conclusion.

## Persistance

9 clés `localStorage`. Modules porteurs d'état : `Progress` (l.4632, contient
`decisions[]`, `tagStats`, `history`), `Career`, `Player`, `HRStats`, `PRStats`,
`BLStats`, `Rating`, `Journey`.

`Progress.record()` enregistre chaque décision avec `{ts, street, pos, verdict,
lossBB, tags[], mode, level}`. `Progress.worstLeak()` et `Progress.focusFor()`
alimentent le mode « cible ».

## Contraintes non négociables

1. **Le moteur DF-B est gelé.** On peut s'y brancher, pas le réécrire.
2. **Ne jamais inventer de théorie poker** pour combler un trou. Toute
   référence stratégique nouvelle doit être documentée et justifiée.
3. **Aucun contenu de remplissage**, aucun exemple fabriqué, aucune statistique
   inventée.
4. Les suites Phase 2 doivent rester vertes (79 moteur, 37 navigateur).
5. La Phase 3 (authentification) vit sur `claude/phase3-google-auth`, **non
   fusionnée ici** : elle intercale une couche de stockage sous le moteur. En
   tenir compte pour toute proposition touchant la persistance.
