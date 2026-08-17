-- ============================================================================
-- HeroLab — Phase 3 : schéma et politiques d'isolation
--
-- À appliquer sur un projet Supabase vierge (SQL Editor ou `supabase db push`).
-- Idempotent : réexécutable sans effet de bord.
--
-- Principe directeur : le client n'envoie JAMAIS son user_id. Il est dérivé de
-- auth.uid() par défaut et vérifié par WITH CHECK à chaque écriture.
-- ============================================================================

-- ─────────────────────────────────────────────────────────── profils ────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text        not null default 'Joueur',
  avatar        text        not null default '♠',
  mentor_id     text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Bornes serveur : le client peut mentir, la base non.
  constraint profiles_display_name_len check (char_length(display_name) between 1 and 24),
  constraint profiles_avatar_allowed   check (avatar in ('♠','♥','♦','♣','⬢','◆','★','⬟','▲','●','⯃','✦')),
  constraint profiles_mentor_len       check (mentor_id is null or char_length(mentor_id) <= 32)
);

comment on table public.profiles is
  'Profil applicatif. L''e-mail n''est pas recopié ici : il vit dans auth.users.';

-- ──────────────────────────────────────────────── documents applicatifs ─────
create table if not exists public.user_documents (
  user_id     uuid        not null default auth.uid()
                          references auth.users (id) on delete cascade,
  doc_key     text        not null,
  payload     jsonb       not null default '{}'::jsonb,
  revision    bigint      not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  primary key (user_id, doc_key),

  -- Liste blanche : un client ne peut pas créer des clés arbitraires et se
  -- servir de la table comme d'un stockage libre.
  constraint user_documents_key_allowed check (
    doc_key in ('progress','career','hr','pr','bl','rating','journey','player','tracker')
  ),
  -- Garde-fou de volume : évite qu'un compte serve de dépôt de données.
  constraint user_documents_payload_size check (pg_column_size(payload) <= 1048576),
  constraint user_documents_payload_object check (jsonb_typeof(payload) = 'object')
);

comment on column public.user_documents.revision is
  'Incrémenté par déclencheur. Sert à détecter un conflit d''écriture concurrente.';

create index if not exists user_documents_user_idx
  on public.user_documents (user_id);

-- ──────────────────────────────────────────────────────── déclencheurs ──────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.bump_revision()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  -- La révision est gérée par la base : un client ne peut pas la falsifier
  -- pour gagner une résolution de conflit.
  new.revision := old.revision + 1;
  -- Ceinture et bretelles : le user_id d'une ligne est immuable. Même si une
  -- policy était mal écrite un jour, une ligne ne pourrait pas changer de
  -- propriétaire par UPDATE.
  new.user_id := old.user_id;
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists user_documents_bump on public.user_documents;
create trigger user_documents_bump
  before update on public.user_documents
  for each row execute function public.bump_revision();

-- ───────────────────────────────── création automatique du profil ───────────
-- SECURITY DEFINER est nécessaire ici (insertion dans public.profiles au nom
-- d'un utilisateur qui vient d'être créé), donc : search_path vide, aucun
-- paramètre issu du client, et rien d'autre que cette insertion.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    -- Le nom Google est une donnée non fiable : on la borne et on ne
    -- l'utilise que comme valeur initiale, jamais comme identifiant.
    coalesce(nullif(left(new.raw_user_meta_data ->> 'name', 24), ''), 'Joueur')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- ROW LEVEL SECURITY
--
-- FORCE en plus de ENABLE : même le propriétaire de la table est soumis aux
-- policies. Sans FORCE, un rôle propriétaire les contourne silencieusement.
-- ============================================================================

alter table public.profiles        enable row level security;
alter table public.profiles        force  row level security;
alter table public.user_documents  enable row level security;
alter table public.user_documents  force  row level security;

-- Aucune permission implicite : on part de zéro et on n'accorde que le strict
-- nécessaire aux rôles porteurs d'un JWT utilisateur.
revoke all on public.profiles       from anon, authenticated;
revoke all on public.user_documents from anon, authenticated;

grant select, insert, update, delete on public.profiles       to authenticated;
grant select, insert, update, delete on public.user_documents to authenticated;
-- `anon` (visiteur non connecté) n'a aucun accès : le mode invité est purement
-- local, il ne touche pas la base.

-- ─────────────────────────────────────────────────── policies profiles ──────
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using      (id = (select auth.uid()))
  with check (id = (select auth.uid()));   -- interdit de réassigner la ligne

drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own on public.profiles
  for delete to authenticated
  using (id = (select auth.uid()));

-- ────────────────────────────────────────────── policies user_documents ─────
drop policy if exists user_documents_select_own on public.user_documents;
create policy user_documents_select_own on public.user_documents
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists user_documents_insert_own on public.user_documents;
create policy user_documents_insert_own on public.user_documents
  for insert to authenticated
  -- WITH CHECK seul compte à l'insertion : sans lui, un client insère une
  -- ligne au nom d'autrui (il ne la relira pas, mais il l'aura écrasée).
  with check (user_id = (select auth.uid()));

drop policy if exists user_documents_update_own on public.user_documents;
create policy user_documents_update_own on public.user_documents
  for update to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists user_documents_delete_own on public.user_documents;
create policy user_documents_delete_own on public.user_documents
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ============================================================================
-- Vérifications de posture — doivent renvoyer 0 ligne.
-- ============================================================================

-- 1. Toute table de `public` doit avoir RLS activée ET forcée.
do $$
declare bad text;
begin
  select string_agg(c.relname, ', ') into bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and (not c.relrowsecurity or not c.relforcerowsecurity);
  if bad is not null then
    raise exception 'RLS absente ou non forcée sur : %', bad;
  end if;
end $$;

-- 2. Aucune policy ne doit être ouverte à tous les rôles sans condition.
do $$
declare bad text;
begin
  select string_agg(policyname, ', ') into bad
  from pg_policies
  where schemaname = 'public'
    and (qual = 'true' or with_check = 'true');
  if bad is not null then
    raise exception 'Policy permissive détectée : %', bad;
  end if;
end $$;
