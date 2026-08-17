# Mettre la connexion Google en service

Compter une vingtaine de minutes, dont l'essentiel en attente de Google.

**Rien de tout cela n'est du code** : ce sont trois comptes à créer et deux
valeurs à recopier. Le code, lui, est prêt et testé.

---

## Pourquoi ces étapes ne peuvent pas être automatisées

| Étape | Pourquoi elle t'incombe |
|---|---|
| Créer le projet Supabase | Rattaché à ton compte, avec ta facturation |
| Créer les identifiants Google | Émis pour ton identité d'éditeur, avec un secret |
| Publier la page en HTTPS | Google refuse toute redirection vers `file://` |

Ce dernier point est le plus contre-intuitif : **ouvrir le fichier HTML par
double-clic ne permettra jamais la connexion Google.** L'application s'ouvrira et
fonctionnera, mais en mode invité. C'est normal, pas une panne.

---

## 1. Le projet Supabase

1. Sur [supabase.com](https://supabase.com) → **New project**. Note le mot de
   passe de la base, il ne sera plus affiché.
2. Une fois le projet prêt : **SQL Editor** → **New query**.
3. Coller l'intégralité de `supabase/001_schema.sql`, puis **Run**.
   Aucune erreur ne doit apparaître : le fichier se termine par deux contrôles
   qui échouent bruyamment si la sécurité au niveau des lignes n'est pas active.
4. Recommandé — vérifier l'isolation sur ta propre base : nouvelle requête,
   coller `supabase/002_rls_tests.sql`, **Run**. Attendu :
   `10 tests d'isolation RLS : TOUS PASSÉS`.

> Cette vérification est celle que je ne peux pas faire à ta place. Je l'ai
> exécutée sur un PostgreSQL local, ce qui prouve que les règles sont correctes,
> mais pas qu'elles sont bien appliquées **sur ton projet**.

## 2. Les identifiants Google

1. [console.cloud.google.com](https://console.cloud.google.com) → nouveau projet.
2. **APIs & Services** → **OAuth consent screen** → External → remplir le nom de
   l'application et l'e-mail de contact.
3. **Credentials** → **Create credentials** → **OAuth client ID** →
   type **Web application**.
4. Dans **Authorized redirect URIs**, coller l'URL de rappel indiquée par
   Supabase (Authentication → Providers → Google) ; elle a la forme :

   ```
   https://<ton-projet>.supabase.co/auth/v1/callback
   ```

5. Récupérer le **Client ID** et le **Client Secret**.
6. Retour dans Supabase : **Authentication** → **Providers** → **Google** →
   activer, coller les deux valeurs, **Save**.

## 3. Publier la page

Google exige une origine HTTPS. Au choix :

- **Netlify / Vercel / GitHub Pages** — déposer le fichier HTML, c'est tout.
- **En local pour tester** : `http://localhost` est accepté par Google.
  ```bash
  cd PHASE3_AUTH_SECURED && python3 -m http.server 8080
  # puis http://localhost:8080/herolab-auth.html
  ```

Puis déclarer l'adresse **exacte** de la page publiée dans Supabase :
**Authentication** → **URL Configuration** → **Redirect URLs**.

> **Une URL exacte, jamais de joker.** C'est ce réglage qui empêche un
> `redirect_to` arbitraire de détourner le jeton de session : une entrée en
> `https://mondomaine/*` annule cette protection.

## 4. Brancher l'application

Récupérer les deux valeurs dans Supabase → **Project Settings** → **API** :
l'**URL du projet** et la clé **`anon` / `public`**.

```bash
node PHASE3_AUTH_SECURED/configure.js https://<ton-projet>.supabase.co eyJhbGciOi...
```

Le script vérifie l'URL, contrôle que la clé est bien un JWT de rôle `anon`,
**refuse la clé `service_role`**, puis reconstruit l'artefact avec la bonne
politique de sécurité du contenu. Republier le fichier obtenu.

> La clé `anon` est publique par nature : elle sera lisible dans la page, comme
> dans toute application Supabase côté client. Elle ne protège rien — ce sont les
> règles RLS de l'étape 1 qui protègent les données. La clé `service_role`, elle,
> contourne ces règles : elle ne doit jamais quitter ton serveur.

---

## Vérifier que tout fonctionne

1. Ouvrir la page publiée : la pastille en haut à droite indique
   « Invité — hors ligne ».
2. **Se connecter** → écran Google → retour sur l'application. La pastille
   affiche ton nom, et l'URL a été nettoyée du code d'autorisation.
3. Jouer quelques mains, attendre trois secondes, recharger : la progression est
   là.
4. Dans Supabase → **Table Editor** → `user_documents` : une ligne par domaine,
   toutes portant **ton** `user_id`.
5. Se connecter avec un second compte Google : progression vierge, et la
   première reste inaccessible.

## Si ça ne marche pas

| Symptôme | Cause |
|---|---|
| Le bouton reste inactif | `configure.js` n'a pas été lancé, ou la page n'a pas été republiée |
| `redirect_uri_mismatch` | L'URI de l'étape 2.4 ne correspond pas exactement à celle de Supabase |
| Retour sur la page sans être connecté | L'adresse publiée n'est pas dans **Redirect URLs** (étape 3) |
| Rien ne se passe en `file://` | Attendu — Google exige HTTPS ou `localhost` |
| Connecté mais rien ne se synchronise | `001_schema.sql` n'a pas été appliqué |

## Revenir en arrière

```bash
node PHASE3_AUTH_SECURED/configure.js --reset
```

L'application repasse en mode invité hors ligne, strictement identique à la
Phase 2. Le moteur n'a jamais dépendu de l'authentification.
