# Hero Lab — pipeline de déploiement

## Chemin cible

```
code local
  → push sur une branche de travail
      → CI GitHub Actions (syntaxe · 66 contrats · 34 red-team · empreinte moteur)
          → merge dans main (uniquement si tous les checks sont verts)
              → Netlify, build automatique depuis main
                  → https://herolab.eu
```

Source de production : **`index.html` à la racine de `main`**. Rien d'autre.

## État réel au moment de la rédaction

⚠️ **Le maillon Netlify ← GitHub n'existe pas encore.** Ce document décrit la cible ;
la section « Action manuelle requise » dit exactement ce qui manque.

Mesuré sur le déploiement courant de `herolab.eu` (API Netlify) :

| champ | valeur | ce que cela signifie |
|---|---|---|
| `site` | `bright-banoffee-bee41f` | le projet Netlify qui sert `herolab.eu` |
| `deploy` | `6a7b272c185dca24423ad7d3` | déploiement actuellement publié |
| `manual_deploy` | `true` | déposé à la main |
| `deploy_source` | `"drop"` | glisser-déposer, pas un build |
| `commit_ref` | `null` | **aucun lien avec un dépôt Git** |
| `branch` | `null` | aucune branche source |
| `created_at` | `2026-08-11T13:44:12Z` | antérieur au refactor (14 août) |
| contenu | `1 new file uploaded` → `index.html` | **un seul fichier**, ni `robots.txt` ni `sitemap.xml` |

Conséquence : **merger la PR ne déploie rien.** Tant que le lien Git n'est pas
établi, le dépôt et la production restent deux univers séparés.

## Action manuelle requise (je ne peux pas la faire)

L'API Netlify accessible depuis l'agent expose la lecture de projets, la gestion
des variables d'environnement, et un dépôt manuel — **mais aucune opération pour
lier un dépôt Git**. Déclencher un dépôt manuel depuis l'agent reproduirait
exactement le problème que ce document corrige. Cette étape t'appartient.

### 1. Lier le projet au dépôt

Sur <https://app.netlify.com/projects/bright-banoffee-bee41f> →
**Project configuration → Build & deploy → Continuous deployment → Link repository**

- dépôt : `melchiormathieu35-crypto/HeroLab`
- branche de production : **`main`**
- build command : *(vide)*
- publish directory : **`.`**

`netlify.toml` à la racine porte déjà `publish`, les en-têtes et les règles 404 ;
Netlify le lira automatiquement et ces réglages primeront.

### 2. Ordre des opérations — important

Faire le lien **après** avoir mergé la PR, jamais avant.

`main` ne contient aujourd'hui **qu'un seul fichier** :
`pivot-simulateur-cashgame-17.html`. Il n'y a **pas d'`index.html`**. Lier Netlify
à `main` en l'état publierait un site dont la racine renvoie 404 et dont le seul
fichier atteignable serait l'ancienne génération du produit.

L'ordre sûr :

1. CI verte sur la PR ;
2. merge dans `main` ;
3. vérifier que `main` contient bien `index.html`, `robots.txt`, `sitemap.xml`,
   `netlify.toml`, `assets/og-image.png` ;
4. **puis** lier Netlify à `main` ;
5. laisser le premier build automatique se faire ;
6. vérifier (§ Vérification).

### 3. Stratégie de rollback

Le déploiement manuel du 11 août reste dans l'historique Netlify. Si le premier
build automatique produit un résultat inattendu :

**Deploys → sélectionner le déploiement `6a7b272c185dca24423ad7d3` → Publish deploy.**

La production revient instantanément à l'état actuel. Aucune donnée utilisateur
n'est en jeu : tout est stocké dans le `localStorage` du visiteur, jamais côté
serveur. Un rollback ne fait donc perdre aucune progression.

## Vérification après le premier build automatique

À faire depuis un navigateur — **l'agent n'y a pas accès**, le proxy sortant
bloque `herolab.eu` et `*.netlify.app`.

| # | vérification | attendu |
|---|---|---|
| 1 | `https://herolab.eu/` | l'application Hero Lab démarre |
| 2 | commit déployé | le SHA de `main`, visible dans l'onglet Deploys |
| 3 | `https://herolab.eu/robots.txt` | 200, contient `Disallow: /archive/` |
| 4 | `https://herolab.eu/sitemap.xml` | 200, XML valide |
| 5 | `https://herolab.eu/assets/og-image.png` | 200, image 1200×630 |
| 6 | `https://herolab.eu/archive/pivot-simulateur-cashgame-17.html` | **404** |
| 7 | `http://herolab.eu/` | redirection 301 vers HTTPS |
| 8 | `view-source:` → `<link rel="canonical">` | `https://herolab.eu/` |
| 9 | aperçu de partage | via <https://www.opengraph.xyz/> ou le validateur de la plateforme |
| 10 | console navigateur | aucune erreur |

## Domaine

`herolab.eu` est **déjà** rattaché au projet Netlify (`primarySiteUrl:
https://herolab.eu`, `ssl_url` en HTTPS). Aucune action DNS n'est nécessaire et
aucune n'a été entreprise — la consigne était de ne pas toucher au domaine sans
preuve de nécessité.

**NON VÉRIFIÉ depuis l'agent** : validité du certificat, redirection HTTP→HTTPS,
comportement de `www.herolab.eu`. À contrôler au point 7 ci-dessus.

## Ce que la CI garantit avant merge

`.github/workflows/ci.yml` échoue si :

- la syntaxe de `index.html` ou de la génération archivée est invalide ;
- l'un des 66 tests de contrats échoue ;
- l'un des 34 scénarios red-team échoue ;
- l'empreinte du moteur diverge de `tests/baseline.json` ;
- un fichier suivi a été modifié pendant l'exécution des tests ;
- un fichier requis en production est absent (`index.html`, `robots.txt`,
  `sitemap.xml`, `netlify.toml`, l'image sociale) ;
- le `canonical` n'est pas une URL absolue sur le domaine de production ;
- le JSON-LD est invalide.

La CI ne déploie pas. Le déploiement est déclenché par Netlify sur `main`, ce qui
garde une seule autorité sur la production.
