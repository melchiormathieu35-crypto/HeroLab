# graphify-out — instantané historique

**Ces fichiers décrivent `archive/pivot-simulateur-cashgame-17.html`, pas `index.html`.**

Ils ont été produits au commit `b2f68de`, avant le refactor architectural. `graph.json`,
`graph.html` et `GRAPH_REPORT.md` cartographient donc la génération précédente du produit :
ils ne connaissent ni `Storage`, ni `SessionCtl`, ni aucune des extractions faites depuis.

Conservés comme point de comparaison avant/après. **À ne pas lire comme l'architecture
courante** — pour celle-ci, voir `FINAL_ARCHITECTURE_AUDIT.md` à la racine.

Rappel mesuré, valable pour toute relecture du graphe : Graphify reconnaît les appels `X.y()`
mais rate les accès indexés `X[clé]`, qui sont le mode de consommation dominant des tables de
constantes de ce fichier (`RANKS` ×45, `STREET_FR` ×20, `ALL_PROFILES` ×19, `PROFILES` ×18,
`LEAK_INFO` ×18). Le graphe oriente ; il ne fait pas autorité sur les dépendances.
