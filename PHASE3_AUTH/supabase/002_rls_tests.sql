-- ============================================================================
-- HeroLab — tests d'isolation RLS.
--
-- Chaque test échoue bruyamment (raise exception) au lieu de renvoyer un
-- rapport à interpréter : le script passe entièrement ou casse.
--
-- Local  : psql -f 000_supabase_shim.sql -f 001_schema.sql -f 002_rls_tests.sql
-- Supabase : appliquer 001 puis exécuter ce fichier dans le SQL Editor
--            (le shim n'est pas nécessaire, auth.uid() existe déjà — mais
--             auth.login_as() oui : voir la note en fin de fichier).
-- ============================================================================

do $$
declare
  alice uuid;
  bob   uuid;
  n     int;
  ok    boolean;
begin
  -- ─────────────────────────────────────────────────────── préparation ─────
  delete from auth.users where email in ('alice@test.local', 'bob@test.local');

  insert into auth.users (email, raw_user_meta_data)
  values ('alice@test.local', '{"name":"Alice"}'::jsonb) returning id into alice;
  insert into auth.users (email, raw_user_meta_data)
  values ('bob@test.local',   '{"name":"Bob"}'::jsonb)   returning id into bob;

  -- Le déclencheur doit avoir créé les deux profils.
  select count(*) into n from public.profiles where id in (alice, bob);
  if n <> 2 then
    raise exception 'ÉCHEC préparation : % profil(s) créé(s) automatiquement au lieu de 2', n;
  end if;
  raise notice 'PASS  le profil est créé automatiquement à l''inscription';

  -- Données de départ pour chacun.
  perform auth.login_as(alice);
  insert into public.user_documents (doc_key, payload)
  values ('progress', '{"xp": 100, "owner": "alice"}'::jsonb);
  reset role;

  perform auth.login_as(bob);
  insert into public.user_documents (doc_key, payload)
  values ('progress', '{"xp": 5, "owner": "bob"}'::jsonb);
  reset role;

  -- ═══════════════════════════════════════ 1. LECTURE CROSS-USER ═══════════
  perform auth.login_as(alice);

  select count(*) into n from public.user_documents;
  if n <> 1 then
    raise exception 'ÉCHEC 1a : Alice voit % documents au lieu du sien uniquement', n;
  end if;

  select count(*) into n from public.user_documents where user_id = bob;
  if n <> 0 then
    raise exception 'ÉCHEC 1b : Alice lit % document(s) de Bob', n;
  end if;

  select count(*) into n from public.profiles;
  if n <> 1 then
    raise exception 'ÉCHEC 1c : Alice voit % profils au lieu du sien', n;
  end if;
  reset role;
  raise notice 'PASS  1. un utilisateur ne lit que ses propres lignes';

  -- ═════════════════════════════ 2. USURPATION À L'INSERTION ═══════════════
  -- Le cas que WITH CHECK doit bloquer : écrire une ligne AU NOM d'un autre.
  perform auth.login_as(alice);
  ok := false;
  begin
    insert into public.user_documents (user_id, doc_key, payload)
    values (bob, 'career', '{"pirate": true}'::jsonb);
  exception when insufficient_privilege then
    ok := true;
  end;
  if not ok then
    raise exception 'ÉCHEC 2 : Alice a inséré une ligne au nom de Bob (WITH CHECK absent ?)';
  end if;
  reset role;
  raise notice 'PASS  2. insertion au nom d''autrui refusée';

  -- ═══════════════════ 3. ÉCRASEMENT DU DOCUMENT D'UN AUTRE ════════════════
  perform auth.login_as(alice);
  update public.user_documents
     set payload = '{"pirate": true}'::jsonb
   where user_id = bob;
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'ÉCHEC 3 : Alice a modifié % ligne(s) de Bob', n;
  end if;
  reset role;

  -- Le contenu de Bob doit être intact.
  perform auth.login_as(bob);
  select (payload ->> 'owner') = 'bob' into ok
    from public.user_documents where doc_key = 'progress';
  if not coalesce(ok, false) then
    raise exception 'ÉCHEC 3b : le document de Bob a été altéré';
  end if;
  reset role;
  raise notice 'PASS  3. écrasement du document d''autrui refusé';

  -- ══════════════════ 4. RÉASSIGNATION DE PROPRIÉTAIRE ═════════════════════
  -- Tentative de « donner » sa ligne à Bob (ou de voler la sienne) par UPDATE.
  -- Deux défenses se superposent : le déclencheur rend user_id immuable
  -- (refus silencieux) et WITH CHECK rejette la nouvelle ligne (refus par
  -- exception). Le test valide le RÉSULTAT, quel que soit le mécanisme qui a
  -- mordu le premier — sinon retirer une défense ferait « planter » le test au
  -- lieu de le faire échouer, ce qui masquerait la vraie régression.
  perform auth.login_as(alice);
  begin
    update public.user_documents set user_id = bob where doc_key = 'progress';
  exception when insufficient_privilege then
    null;   -- refus par WITH CHECK : acceptable
  end;
  reset role;

  perform auth.login_as(bob);
  select count(*) into n
    from public.user_documents
   where doc_key = 'progress' and payload ->> 'owner' = 'alice';
  if n <> 0 then
    raise exception 'ÉCHEC 4 : une ligne d''Alice est devenue la propriété de Bob';
  end if;
  reset role;

  perform auth.login_as(alice);
  select count(*) into n from public.user_documents where doc_key = 'progress';
  if n <> 1 then
    raise exception 'ÉCHEC 4b : Alice a perdu son document en tentant de le réassigner';
  end if;
  reset role;
  raise notice 'PASS  4. réassignation de propriétaire neutralisée';

  -- ════════════════════════ 5. SUPPRESSION CROSS-USER ══════════════════════
  perform auth.login_as(alice);
  delete from public.user_documents where user_id = bob;
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'ÉCHEC 5 : Alice a supprimé % ligne(s) de Bob', n;
  end if;
  reset role;

  perform auth.login_as(bob);
  select count(*) into n from public.user_documents;
  if n <> 1 then
    raise exception 'ÉCHEC 5b : le document de Bob a disparu';
  end if;
  reset role;
  raise notice 'PASS  5. suppression du document d''autrui refusée';

  -- ══════════════════════ 6. PROFIL D'AUTRUI EN ÉCRITURE ═══════════════════
  perform auth.login_as(alice);
  update public.profiles set display_name = 'Piraté' where id = bob;
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'ÉCHEC 6 : Alice a modifié le profil de Bob';
  end if;
  reset role;
  raise notice 'PASS  6. modification du profil d''autrui refusée';

  -- ═══════════════════════════ 7. VISITEUR ANONYME ═════════════════════════
  perform auth.logout();
  ok := false;
  begin
    select count(*) into n from public.user_documents;
    -- Si la lecture aboutit, elle doit au moins ne rien renvoyer.
    if n > 0 then
      raise exception 'ÉCHEC 7 : un visiteur anonyme lit % ligne(s)', n;
    end if;
    ok := true;
  exception when insufficient_privilege then
    ok := true;   -- refus franc : le résultat attendu
  end;
  if not ok then
    raise exception 'ÉCHEC 7 : accès anonyme non maîtrisé';
  end if;
  reset role;
  raise notice 'PASS  7. le visiteur anonyme n''accède à rien';

  -- ════════════════════ 8. LA RÉVISION N'EST PAS FALSIFIABLE ═══════════════
  perform auth.login_as(alice);
  update public.user_documents set revision = 9999 where doc_key = 'progress';
  select revision into n from public.user_documents where doc_key = 'progress';
  if n = 9999 then
    raise exception 'ÉCHEC 8 : un client a pu fixer la révision à sa guise';
  end if;
  reset role;
  raise notice 'PASS  8. la révision est contrôlée par la base (valeur : %)', n;

  -- ═══════════════════════ 9. CONTRAINTES DE CONTENU ═══════════════════════
  perform auth.login_as(alice);

  ok := false;
  begin
    insert into public.user_documents (doc_key, payload)
    values ('dépôt_arbitraire', '{}'::jsonb);
  exception when check_violation then ok := true;
  end;
  if not ok then
    raise exception 'ÉCHEC 9a : une clé de document hors liste blanche est acceptée';
  end if;

  ok := false;
  begin
    update public.profiles set display_name = repeat('x', 200) where id = alice;
  exception when check_violation then ok := true;
  end;
  if not ok then
    raise exception 'ÉCHEC 9b : un pseudo de 200 caractères est accepté';
  end if;

  ok := false;
  begin
    update public.profiles set avatar = '<script>' where id = alice;
  exception when check_violation then ok := true;
  end;
  if not ok then
    raise exception 'ÉCHEC 9c : un avatar hors liste blanche est accepté';
  end if;
  reset role;
  raise notice 'PASS  9. les contraintes de contenu tiennent côté serveur';

  -- ════════════════════════ 10. SUPPRESSION EN CASCADE ═════════════════════
  delete from auth.users where id = bob;
  select count(*) into n from public.user_documents where user_id = bob;
  if n <> 0 then
    raise exception 'ÉCHEC 10 : % document(s) orphelin(s) après suppression du compte', n;
  end if;
  select count(*) into n from public.profiles where id = bob;
  if n <> 0 then
    raise exception 'ÉCHEC 10b : profil orphelin après suppression du compte';
  end if;
  raise notice 'PASS  10. la suppression du compte efface bien ses données';

  -- ───────────────────────────────────────────────────────── nettoyage ─────
  delete from auth.users where email in ('alice@test.local', 'bob@test.local');

  raise notice '';
  raise notice '═══ 10 tests d''isolation RLS : TOUS PASSÉS ═══';
end $$;

-- ----------------------------------------------------------------------------
-- Note pour une exécution sur un vrai projet Supabase : `auth.login_as()` vient
-- du shim de test. Pour rejouer ces cas en conditions réelles, remplacer les
-- appels par :
--     set local role authenticated;
--     select set_config('request.jwt.claims',
--                       json_build_object('sub', '<uuid>')::text, true);
-- ----------------------------------------------------------------------------
