/* ============================================================================
   Configuration Supabase.

   Ces deux valeurs sont PUBLIQUES par conception : elles sont lisibles dans le
   HTML livré, comme dans toute application Supabase côté client. Elles ne
   protègent rien. Ce qui protège les données, c'est exclusivement RLS
   (voir ARCHITECTURE.md §4).

   ⚠ N'INSCRIRE ICI QUE LA CLÉ `anon`.
     La clé `service_role` contourne RLS par construction : la placer dans un
     fichier livré au navigateur exposerait publiquement TOUTES les données de
     TOUS les utilisateurs. Le build refuse de produire un artefact qui la
     contient.

   Laisser les valeurs vides désactive proprement l'authentification :
   l'application retombe sur le mode invité, hors ligne, comme en Phase 2.
   ========================================================================== */
window.HEROLAB_SUPABASE = {
  url: "",       // ex. https://abcdefghijklm.supabase.co
  anonKey: ""    // clé « anon / public » du projet
};
