-- ============================================================================
-- Échafaudage Supabase pour tests locaux.
--
-- Reproduit le strict nécessaire de l'environnement Supabase (schéma `auth`,
-- `auth.uid()`, rôles `anon` / `authenticated` / `service_role`) afin de pouvoir
-- exécuter RÉELLEMENT le schéma et les tests RLS sur un Postgres nu.
--
-- NE PAS APPLIQUER SUR UN PROJET SUPABASE : ces objets y existent déjà.
-- ============================================================================

create schema if not exists auth;

-- Version simplifiée de auth.users : seules les colonnes que le schéma utilise.
create table if not exists auth.users (
  id                    uuid primary key default gen_random_uuid(),
  email                 text unique,
  raw_user_meta_data    jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now()
);

-- Supabase dérive l'identité de la claim `sub` du JWT, transmise à la connexion
-- via le paramètre de session `request.jwt.claims`. On reproduit exactement ce
-- mécanisme : c'est lui que les policies interrogent.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    current_setting('request.jwt.claims', true)::jsonb ->> 'sub',
    ''
  )::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    current_setting('request.jwt.claims', true)::jsonb ->> 'role',
    'anon'
  );
$$;

-- Rôles applicatifs Supabase.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth   to anon, authenticated, service_role;

-- Helper de test : endosse l'identité d'un utilisateur comme le ferait PostgREST.
create or replace function auth.login_as(p_user uuid)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
end;
$$;

create or replace function auth.logout()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
end;
$$;
