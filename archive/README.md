# Archive

Ce dossier conserve les générations antérieures du produit. **Rien ici n'est déployé ni
maintenu.** La source de production est `../index.html`.

## `pivot-simulateur-cashgame-17.html`

Génération précédente, publiée sous le nom **Pivot**. Conservée pour référence historique et
pour pouvoir rejouer une comparaison de comportement si un doute surgit sur une régression.

Ce fichier est **fonctionnel et syntaxiquement valide** : ouvert dans un navigateur, il démarre.
C'est précisément pourquoi il est isolé ici — à la racine, rien ne signalait qu'il n'était plus
la version courante, et il pouvait être ouvert ou déployé par erreur.

Écart avec la version courante — aucun des modules suivants n'y existe :

| module | rôle |
|---|---|
| `Storage` | point d'accès unique à la persistance |
| `StorageGuard` | notification d'échec d'écriture |
| `Modal` | dialogues (remplace `confirm`/`prompt` natifs) |
| `Studio` | mode créateur `?admin=1` |
| `Onboarding` | création du profil |
| `DataPort` | export / import / réinitialisation |
| `ProfileUI` · `DailyUI` · `JourneyUI` · `SessionCtl` | responsabilités extraites d'`App` |

Il ne partage donc ni l'architecture, ni la couche de persistance, ni le nom du produit. Il ne
doit pas servir de base à un correctif : toute modification doit partir de `../index.html`.
