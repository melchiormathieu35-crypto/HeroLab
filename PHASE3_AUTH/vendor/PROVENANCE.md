# Dépendance embarquée

| | |
|---|---|
| Paquet | `@supabase/supabase-js` |
| Version | 2.112.3 |
| Fichier | `dist/umd/supabase.js` (build UMD officiel) |
| Empreinte | voir `SHA256SUMS` |

Le SDK est **embarqué dans l'artefact**, jamais chargé depuis un CDN : `script-src`
reste ainsi sans origine externe, et un CDN compromis n'est pas un vecteur.

Vérifié à l'intégration : aucun `eval(`, aucun `new Function(`, aucune référence
de source map résiduelle.

Pour mettre à jour :

    npm install --no-save @supabase/supabase-js@<version>
    cp node_modules/@supabase/supabase-js/dist/umd/supabase.js \
       PHASE3_AUTH/vendor/supabase-js-<version>.umd.js
    sha256sum PHASE3_AUTH/vendor/*.umd.js > PHASE3_AUTH/vendor/SHA256SUMS
    node PHASE3_AUTH/build.js
