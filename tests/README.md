# Tests HeroLab

Deux suites, sans framework externe. Elles servent de garde-fou de régression
sur les bugs corrigés lors de la passe de durcissement production.

## Suite moteur (Node, sans navigateur)

```bash
node tests/regression.js VERSION_PRODUCTION/herolab.html
```

`tests/harness.js` extrait le JavaScript applicatif du HTML mono-page et
l'exécute dans un contexte `vm` avec des stubs DOM/localStorage. Les modules de
l'IIFE `window.Feutre` (Parser, Store, Stats…) sont exposés par injection avant
son `return`.

Elle couvre : `madeHand().draw`, `Ranges.expand`, les side pots, l'import
PokerStars et Winamax, les modes BvB / BTN vs BB, le Défi du jour, la qualité
des textes, et la validation des sauvegardes importées.

## Suite navigateur (Chromium/Playwright)

```bash
npm install --no-save playwright
node tests/browser.js VERSION_PRODUCTION/herolab.html
```

Elle vérifie ce que Node ne peut pas voir : chargement réel, absence d'erreur
console, absence de requête réseau, CSP (y compris l'export par blob et les
fontes `data:`), navigation dans toutes les vues, déroulé d'une main, les trois
labs, puis le mobile (360×800, 390×844, 412×915) et l'accessibilité.

## Vérifier qu'un test prouve bien quelque chose

Les deux suites acceptent un chemin en argument. Les lancer sur la version
d'origine doit produire des échecs — c'est ce qui atteste que le test capture
réellement le bug :

```bash
node tests/regression.js VERSION_ORIGINALE/herolab-original.html   # 47 échecs attendus
node tests/browser.js     VERSION_ORIGINALE/herolab-original.html  # échecs attendus
```
