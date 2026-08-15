# Hero Lab — instrumentation

## État actuel : aucune

Mesuré sur `index.html` : zéro outil d'analytics, zéro `fetch`, zéro
`XMLHttpRequest`, zéro `sendBeacon`. L'application ne communique avec aucun
serveur. Tout — équité, évaluation de mains, progression — est calculé et stocké
dans le navigateur du visiteur.

**Rien n'a été branché**, conformément à la consigne. Ce document décrit ce qui
serait nécessaire, pour que la décision se prenne sur une base concrète.

## Ce qui manque, concrètement

Sans instrumentation, ces questions n'ont aucune réponse :

- combien de visiteurs arrivent, et d'où ;
- combien terminent l'onboarding — le premier vrai filtre ;
- combien jouent une première main, puis une deuxième ;
- combien reviennent le lendemain ;
- si le tracker (l'argument différenciant) est utilisé, ou ignoré ;
- où les gens abandonnent.

## Ce qui existe déjà côté code

Les événements produit sont **déjà émis** par la logique métier ; il ne manque
qu'un point de collecte. Points d'accroche identifiés :

| événement | accroche existante |
|---|---|
| `app_open` | `App.init` |
| `onboarding_complete` | `Onboarding.finishOnboarding` |
| `first_hand` | `App.newHand` (premier appel, `Progress.summary().n === 0`) |
| `decision` | `Progress.record` |
| `session_start` / `session_complete` | `SessionCtl.startSession` / `endSession` |
| `drill_start` / `drill_complete` | `SessionCtl.drillLeak` / `endDrill` |
| `leak_detected` | `Progress.summary().leaks` |
| `tracker_import` | `Parser` (dans l'IIFE Feutre) |
| `lab_session` | `HRStats.record`, `PRStats.record`, `BLStats.record` |
| `export` / `reset` | `DataPort.exportAll` / `resetData` |

## Architecture proposée

Un module neutre, sans dépendance, désactivé par défaut :

```js
const Telemetry = {
  enabled: false,   // opt-in explicite : rien ne part sans décision
  sink: null,       // fonction fournie au démarrage (fetch, beacon, console)
  emit(event, props) {
    if (!Telemetry.enabled || !Telemetry.sink) return;
    try { Telemetry.sink({ event, props, ts: Date.now() }); } catch (e) { /* jamais bloquant */ }
  }
};
```

Trois propriétés importantes :

1. **Inerte tant que rien n'est branché** — le comportement par défaut reste le
   « zéro réseau » actuel, qui est un choix produit assumé.
2. **Aucun fournisseur dans le code** — le `sink` est injecté, donc changer
   d'outil ne touche pas l'application.
3. **Jamais bloquant** — une erreur de collecte ne doit pas casser une session
   d'entraînement.

### Ce qu'il ne faut pas envoyer

Les mains jouées, le pseudo, les historiques importés et le contenu du
`localStorage` sont des données personnelles de jeu. Seuls des compteurs
d'événements et des propriétés non identifiantes (mode, palier, durée) ont un
intérêt produit.

## Décision à prendre

Le choix de la destination t'appartient — il a des conséquences légales
(RGPD, bandeau de consentement) que le code ne peut pas trancher :

| option | conséquence |
|---|---|
| **Rien** | statu quo ; aucune mesure, aucune obligation |
| **Plausible / Fathom** | sans cookie, généralement sans bandeau ; payant |
| **Umami auto-hébergé** | données chez toi ; demande un serveur |
| **Endpoint maison** | contrôle total ; à construire et à maintenir |
| **Google Analytics** | gratuit ; cookies, bandeau de consentement obligatoire, et contradiction directe avec le parti « zéro réseau » du produit |

Tant que ce choix n'est pas fait, **ne pas ajouter `Telemetry` au code** : un
module mort n'apporte rien et se périme.
