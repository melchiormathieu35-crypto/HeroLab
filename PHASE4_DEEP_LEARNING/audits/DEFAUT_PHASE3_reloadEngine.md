# Défaut Phase 3 découvert pendant l'audit Phase 4

**Gravité : moyenne. Non déployé** (l'artefact publié sur herolab.eu est celui de
la Phase 2, sans authentification). Aucune exposition en production.

## Le défaut

`PHASE3_AUTH_SECURED/src/auth-sync.js`, `reloadEngine()` l.191-197 :

```js
for (const name of ENGINE_MODULES) {
  const mod = window[name];              // ← toujours undefined
  if (mod && typeof mod.load === "function") { … }
}
```

Les huit modules d'état du moteur (`Progress`, `Career`, `Player`, `HRStats`,
`PRStats`, `BLStats`, `Rating`, `Journey`) sont déclarés en `const` au niveau du
script. Ils vivent donc dans l'environnement lexical global et **ne sont pas des
propriétés de `window`**. La boucle ne s'exécute jamais.

Mesuré en Chromium sur l'artefact réel :

```
modules visibles via window[...] : 0
modules réellement présents      : 8
XP de A avant bascule            : 4242
XP encore en mémoire après bascule vers B : 4242
```

## Conséquence

L'isolation du **stockage** fonctionne (les 21 tests le prouvent) : B ne peut pas
lire les clés de A sur le disque. Mais l'état **en mémoire** du moteur n'est
jamais rechargé. Après une bascule de compte sans rechargement de page, le
moteur continue de servir les données de A à B.

C'est précisément la fuite que la Phase 3 était censée fermer, subsistant à un
étage que la couche ne voyait pas.

## Pourquoi mes tests ne l'ont pas vu

Les 21 tests d'isolation manipulent le stockage et vérifient le stockage. Aucun
ne vérifie l'état en mémoire du moteur après un changement d'identité. **J'ai
testé la couche que j'avais écrite, pas le résultat qui compte.**

Deuxième facteur : le `try/catch` par module. Il visait à tolérer l'absence d'un
module, mais comme `mod` valait `undefined`, la garde `if` sautait silencieusement
— aucune erreur n'a jamais été levée. Une garde trop permissive a transformé un
défaut bruyant en défaut muet.

## Correction

Le mécanisme est connu : l'agent K a démontré qu'un module **ajouté à la fin du
script du moteur** partage sa portée lexicale et voit donc les `const`. Deux
options :

1. Faire exposer les modules par le moteur (touche le moteur gelé — à éviter).
2. Déplacer `reloadEngine` dans un module injecté en fin de script moteur, où
   les modules sont accessibles par leur nom. La substitution de stockage, elle,
   doit rester **avant** le moteur. La couche Phase 3 se scinde donc en deux
   points d'injection au lieu d'un.

**Test de non-régression à ajouter** (celui qui manquait) : après
`Auth._apply({user:{id:B}})`, `Progress.data` ne doit plus contenir la valeur
écrite par A. À faire échouer sur la version actuelle avant de corriger.

## Décision

Consigné, **non corrigé dans l'immédiat** : la Phase 4 impose l'audit avant toute
modification applicative, et le défaut n'est pas exposé. À traiter au moment de
la fusion Phase 3 / Phase 4, avec le test manquant.
