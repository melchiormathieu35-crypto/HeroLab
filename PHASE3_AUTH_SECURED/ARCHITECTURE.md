# Phase 3 — Authentification Google & synchronisation

Contrat d'architecture. **Ce document précède le code** : rien n'est branché sur
Supabase avant que la chaîne, les frontières et le modèle de menace ne soient
fixés ici.

---

## 1. La chaîne, et ce que chaque maillon garantit

```
Google (fournisseur d'identité)
   │  ne fournit qu'une preuve d'identité, jamais un droit d'accès
   ▼
Supabase Auth (OAuth 2.0 + PKCE)
   │  échange le code contre une session signée ; vérifie l'émetteur
   ▼
User ID  (auth.users.id, uuid, immuable)
   │  SEULE source de vérité de l'identité — jamais l'e-mail, jamais un champ client
   ▼
profil utilisateur   (public.profiles)
   ▼
progression          (public.user_documents · doc_key = 'progress')
   ▼
stats                (public.user_documents · doc_key ∈ {hr, pr, bl, rating, journey})
   ▼
Career               (public.user_documents · doc_key = 'career')
```

Le point non négociable : **l'identité descend, elle ne remonte jamais**. Aucune
couche en aval ne peut choisir son `user_id`. Le client ne l'envoie pas ; il est
dérivé de `auth.uid()` par la base à chaque requête.

---

## 2. Décision structurante : la frontière moteur / synchronisation

Le moteur DF-B est gelé. Le brancher module par module sur Supabase supposerait
de modifier 18 méthodes `save()` / `load()` réparties dans 9 modules — c'est
précisément le « câblage improvisé » à proscrire : 18 endroits où oublier
l'isolation, 18 endroits à ré-auditer.

**La synchronisation s'intercale sous le moteur, au niveau du stockage.**

```
   Moteur DF-B  (inchangé — appelle localStorage.getItem/setItem)
        │
        ▼
   ┌──────────────────────────────────────────────┐
   │  HeroLabStore — adaptateur de persistance    │  ← frontière unique
   │  · préfixe les clés par identité             │
   │  · refuse d'écrire si l'identité a changé    │
   │  · met en file les écritures pour la synchro │
   └──────────────────────────────────────────────┘
        │                          │
        ▼                          ▼
   localStorage              Supabase (user_documents)
   (cache local)             (source de vérité distante)
```

Conséquences :

- Le moteur ne connaît ni Supabase, ni les sessions, ni les jetons. Il continue
  de fonctionner **hors ligne et sans compte**, exactement comme en Phase 2.
- L'isolation utilisateur est réalisée **en un seul endroit auditable**, pas
  dispersée dans le moteur.
- Retirer l'authentification revient à retirer un module, sans toucher au jeu.

### Espaces de noms des clés

| Contexte | Préfixe | Exemple |
|---|---|---|
| Invité (hors ligne, pas de compte) | `hl:guest:` | `hl:guest:pivot.v1` |
| Connecté | `hl:u:<user_id>:` | `hl:u:3f2a…:pivot.v1` |

Les clés historiques non préfixées (`pivot.v1`, …) sont traitées comme
**données invité héritées** : lues une fois pour la migration, jamais réécrites.

C'est ce préfixage qui ferme la faille la plus grave de ce type d'architecture :
sans lui, l'utilisateur B qui se connecte après A sur le même appareil hérite de
la progression de A — et la pousse dans son propre compte à la première synchro.

---

## 3. Modèle de données

### 3.1 `public.profiles`

Une ligne par compte, créée par déclencheur à l'inscription.

| Colonne | Type | Note |
|---|---|---|
| `id` | `uuid` PK | `references auth.users(id) on delete cascade` |
| `display_name` | `text` | contraint à 1–24 caractères |
| `avatar` | `text` | contraint à une liste blanche de symboles |
| `mentor_id` | `text` | nullable |
| `created_at`/`updated_at` | `timestamptz` | `updated_at` par déclencheur |

L'e-mail **n'est pas recopié** ici : il vit déjà dans `auth.users`, sous un
schéma protégé. Le dupliquer élargirait la surface de fuite sans bénéfice.

### 3.2 `public.user_documents`

Un document JSON par utilisateur et par domaine, calqué sur les clés existantes.

| Colonne | Type | Note |
|---|---|---|
| `user_id` | `uuid` | `references auth.users(id) on delete cascade` |
| `doc_key` | `text` | liste blanche : `progress, career, hr, pr, bl, rating, journey, player, tracker` |
| `payload` | `jsonb` | contenu applicatif, borné en taille |
| `revision` | `bigint` | incrémenté par déclencheur — sert à détecter les conflits |
| `updated_at` | `timestamptz` | par déclencheur |
| PK | `(user_id, doc_key)` | |

**Pourquoi un document JSON et non un schéma normalisé.** Le moteur produit déjà
ces structures ; les normaliser imposerait de réécrire la persistance des 9
modules — le refactor massif explicitement interdit. Le coût assumé est que la
base ne valide pas la *sémantique* du contenu. Ce coût est acceptable parce que,
comme expliqué en §6, le contenu n'est de toute façon pas digne de confiance :
le moteur tourne côté client.

---

## 4. RLS — la seule frontière qui compte

La clé `anon` de Supabase est **publique par conception** : elle est dans le
HTML, lisible par tous. Elle n'est pas un secret et ne protège rien. Ce qui
protège les données, c'est exclusivement RLS.

Règles appliquées à `profiles` et `user_documents` :

1. `ENABLE ROW LEVEL SECURITY` **et** `FORCE ROW LEVEL SECURITY`.
2. Aucune policy permissive par défaut : ce qui n'est pas autorisé est refusé.
3. Une policy par opération (`select`, `insert`, `update`, `delete`).
4. `USING (user_id = auth.uid())` **et** `WITH CHECK (user_id = auth.uid())`.

Le `WITH CHECK` est le point que l'on oublie le plus souvent, et c'est celui qui
compte le plus : sans lui, `USING` filtre la lecture mais laisse un utilisateur
**insérer ou déplacer une ligne vers le `user_id` d'autrui**. Un `UPDATE` sans
`WITH CHECK` permet de réassigner `user_id` — l'utilisateur ne peut pas lire la
ligne d'un autre, mais peut lui écraser la sienne.

Interdits complémentaires :

- La clé `service_role` ne doit **jamais** atteindre le client. Elle contourne
  RLS par construction.
- `user_id` porte un `DEFAULT auth.uid()` et le client ne l'envoie pas.
- Aucune vue ou fonction `SECURITY DEFINER` exposée au rôle `anon` sans
  filtrage explicite sur `auth.uid()`.

---

## 5. Sessions et jetons

| Sujet | Décision | Motif |
|---|---|---|
| Flux OAuth | **PKCE** | Pas de secret client possible dans une page statique ; PKCE empêche l'interception du code d'être exploitable. |
| Stockage de session | `localStorage` (défaut Supabase) | Voir la limite assumée ci-dessous. |
| URL de redirection | Liste blanche stricte côté tableau de bord Supabase | Sans liste blanche, un `redirect_to` arbitraire exfiltre le jeton. C'est la faille classique de ce flux. |
| Jeton dans l'URL | Nettoyé immédiatement après échange | Le fragment de callback ne doit rester ni dans l'historique ni dans un `Referer`. |
| Rafraîchissement | Automatique (SDK) | |
| Déconnexion | `signOut()` **puis purge de l'espace de noms local** | Sans la purge, les données restent lisibles par le compte suivant sur l'appareil. |

**Limite assumée et documentée.** Une session en `localStorage` est lisible par
tout script s'exécutant dans la page : en cas de XSS, le jeton est exfiltrable.
L'alternative (cookie `HttpOnly`) exige un backend, explicitement hors périmètre.
La conséquence est directe : **avec l'authentification, une XSS cesse d'être un
défaut cosmétique pour devenir une prise de compte.** L'échappement systématique
audité en Phase 2 passe donc du statut de bonne pratique à celui de contrôle de
sécurité — et la CSP devient un filet indispensable, pas un confort.

---

## 6. Ce que cette architecture ne protège pas — et pourquoi c'est acceptable

Le moteur de jeu tourne **entièrement côté client**. Un utilisateur peut donc
ouvrir la console et écrire ce qu'il veut dans sa propre progression. Aucune RLS
n'y change quoi que ce soit.

RLS protège **les données des autres**, pas la véracité des siennes.

C'est acceptable ici parce qu'il s'agit d'un outil d'entraînement personnel :
tricher revient à se mentir à soi-même. Cela cesserait de l'être le jour où
apparaîtraient un classement public, un système de récompenses ou un enjeu
monétaire — il faudrait alors valider les décisions côté serveur. **Ce document
est le bon endroit pour dire que cette porte est ouverte et volontairement non
fermée.**

---

## 7. Migration depuis localStorage

Déclenchée **uniquement sur action explicite** de l'utilisateur, jamais en
arrière-plan à la connexion.

```
connexion réussie
      │
      ├─ données distantes ?  ─ non ─┐
      │        │ oui                 │
      │        ▼                     ▼
      │   données locales invité ?   import direct
      │        │ oui                 (une seule issue possible)
      │        ▼
      │   CONFLIT → on ne tranche pas à la place de l'utilisateur :
      │             on lui montre les deux (date, volume de mains,
      │             niveau) et il choisit. Aucune fusion automatique.
      ▼
   purge des clés héritées seulement après confirmation d'écriture
```

Invariants :

- **Idempotence** : rejouer la migration ne duplique ni n'écrase rien.
- **Aucune perte silencieuse** : les données invité ne sont supprimées qu'après
  une écriture distante confirmée.
- **Aucune fusion automatique** : deux historiques de progression ne se fusionnent
  pas sans décision humaine.

---

## 8. Conséquence sur la CSP — décision explicite

La Phase 2 s'est conclue sur `default-src 'none'; connect-src 'none'`, justifié
par une application sans réseau. **La Phase 3 invalide cette prémisse.**

La CSP est donc rouverte au strict nécessaire :

```
connect-src 'self' https://<ref>.supabase.co;
```

et **rien d'autre** — pas de `*`, pas de joker de sous-domaine.

Le SDK Supabase est **embarqué dans le fichier**, pas chargé depuis un CDN.
`script-src` reste ainsi sans origine externe : un CDN compromis n'est pas un
vecteur, et l'application conserve sa propriété d'artefact unique et vérifiable.

C'est un affaiblissement réel du modèle de sécurité, consenti en échange de la
fonctionnalité. Il est borné, et c'est le seul.

---

## 9. Ce qui est vérifiable ici, et ce qui ne l'est pas

| Élément | Vérifiable en CI | Comment |
|---|---|---|
| Isolation des espaces de noms locaux | Oui | tests exécutés sous Node/Chromium |
| Non-fuite A → B au changement de compte | Oui | idem |
| Idempotence de la migration | Oui | idem |
| Purge à la déconnexion | Oui | idem |
| Absence de `service_role` dans l'artefact | Oui | scan du fichier |
| Étroitesse de la CSP | Oui | scan + navigateur |
| **Policies RLS** | **Non** | exigent une vraie base Postgres |

Les policies RLS sont livrées avec une suite de tests SQL exécutable
(`supabase/rls_tests.sql`). **Elle n'a pas été exécutée ici** — aucun projet
Supabase n'est rattaché à cet environnement. Elle est écrite pour être lancée
telle quelle, et son résultat conditionne la mise en production.
