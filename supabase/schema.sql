-- ============================================================================
--  PartyMatch — PostgreSQL / Supabase schema
--  Run in: Supabase Dashboard -> SQL Editor -> New query -> Run
--  Idempotent: safe to re-run.
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_cron";
create extension if not exists "pg_net";

-- ---------------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------------

create table if not exists public.parties (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,              -- QR room code, e.g. "NEON42"
  name          text not null,
  venue         text,
  starts_at     timestamptz not null default now(),
  expires_at    timestamptz not null,              -- hard TTL (24-48h after start)
  sponsor_title text,                            -- venue sponsorship ad card
  sponsor_body  text,
  sponsor_cta   text,
  sponsor_url   text,
  created_at    timestamptz not null default now()
);

create table if not exists public.profiles (
  id                  uuid primary key default gen_random_uuid(),
  party_id            uuid not null references public.parties(id) on delete cascade,
  first_name          varchar(30) not null,
  age                 int not null check (age >= 18 and age <= 99),
  bio                 varchar(120),
  hobbies             text[] not null default '{}',
  -- single / taken / complicated
  relationship_status varchar(16) not null default 'single'
    check (relationship_status in ('single','taken','complicated')),
  -- friends / casual / partner
  looking_for         varchar(16) not null default 'friends'
    check (looking_for in ('friends','casual','partner')),
  photo_url           text not null,
  photo_key           text not null,                    -- R2 object key, needed for hard delete
  session_token       text unique not null,
  is_active           boolean not null default true,
  is_hidden           boolean not null default false,  -- DSA: auto-hidden after report threshold
  consent_photo       boolean not null default false,  -- GDPR art. 9 explicit opt-in
  consent_at          timestamptz,
  report_count        int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.swipes (
  id          bigserial primary key,
  party_id    uuid not null references public.parties(id) on delete cascade,
  swiper_id   uuid not null references public.profiles(id) on delete cascade,
  target_id   uuid not null references public.profiles(id) on delete cascade,
  direction   varchar(10) not null check (direction in ('like','pass')),
  created_at  timestamptz not null default now(),
  constraint swipes_unique_pair unique (swiper_id, target_id),
  constraint swipes_no_self check (swiper_id <> target_id)
);

create table if not exists public.matches (
  id          uuid primary key default gen_random_uuid(),
  party_id    uuid not null references public.parties(id) on delete cascade,
  user1_id    uuid not null references public.profiles(id) on delete cascade,
  user2_id    uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint matches_unique_pair unique (user1_id, user2_id),
  -- canonical ordering guarantees the unique index catches both directions
  constraint matches_ordered check (user1_id < user2_id)
);

create table if not exists public.reports (
  id                   bigserial primary key,
  reported_profile_id  uuid not null references public.profiles(id) on delete cascade,
  reporter_profile_id  uuid not null references public.profiles(id) on delete cascade,
  reason               text,
  created_at           timestamptz not null default now(),
  constraint reports_unique_pair unique (reported_profile_id, reporter_profile_id)
);

-- ---------------------------------------------------------------------------
-- 2. INDEXES
-- ---------------------------------------------------------------------------

create index if not exists idx_parties_code        on public.parties (code);
create index if not exists idx_parties_expires     on public.parties (expires_at);

create index if not exists idx_profiles_party_live on public.profiles (party_id)
  where is_active and not is_hidden;
create index if not exists idx_profiles_token       on public.profiles (session_token);

create index if not exists idx_swipes_party_swiper on public.swipes (party_id, swiper_id);
create index if not exists idx_swipes_party_target on public.swipes (party_id, target_id);
create index if not exists idx_swipes_reciprocal   on public.swipes (target_id, swiper_id)
  where direction = 'like';

create index if not exists idx_matches_party       on public.matches (party_id);
create index if not exists idx_matches_user1       on public.matches (user1_id);
create index if not exists idx_matches_user2       on public.matches (user2_id);

create index if not exists idx_reports_reported    on public.reports (reported_profile_id);

-- ---------------------------------------------------------------------------
-- 3. TRIGGER: automatic match detection on reciprocal 'like'
-- ---------------------------------------------------------------------------

create or replace function public.fn_detect_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reciprocal boolean;
  u1 uuid;
  u2 uuid;
begin
  if new.direction <> 'like' then
    return new;
  end if;

  select exists (
    select 1 from public.swipes s
    where s.swiper_id = new.target_id
      and s.target_id = new.swiper_id
      and s.direction = 'like'
  ) into reciprocal;

  if not reciprocal then
    return new;
  end if;

  -- canonical ordering: smaller uuid first
  if new.swiper_id < new.target_id then
    u1 := new.swiper_id; u2 := new.target_id;
  else
    u1 := new.target_id; u2 := new.swiper_id;
  end if;

  insert into public.matches (party_id, user1_id, user2_id)
  values (new.party_id, u1, u2)
  on conflict (user1_id, user2_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_detect_match on public.swipes;
create trigger trg_detect_match
  after insert on public.swipes
  for each row execute function public.fn_detect_match();

-- ---------------------------------------------------------------------------
-- 4. TRIGGER: DSA moderation — auto-hide once the report threshold is reached
-- ---------------------------------------------------------------------------

create or replace function public.fn_apply_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  threshold constant int := 2;   -- 2 independent reports hide the profile instantly
  cnt int;
begin
  update public.profiles
     set report_count = report_count + 1
   where id = new.reported_profile_id
  returning report_count into cnt;

  if cnt >= threshold then
    update public.profiles
       set is_hidden = true, is_active = false
     where id = new.reported_profile_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apply_report on public.reports;
create trigger trg_apply_report
  after insert on public.reports
  for each row execute function public.fn_apply_report();

-- ---------------------------------------------------------------------------
-- 5. TRIGGER: updated_at bookkeeping
-- ---------------------------------------------------------------------------

create or replace function public.fn_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch
  before update on public.profiles
  for each row execute function public.fn_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 6. TRIGGER: enforce same-party swiping at the database level
-- ---------------------------------------------------------------------------

create or replace function public.fn_enforce_same_party()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare ok boolean;
begin
  select (a.party_id = new.party_id and b.party_id = new.party_id)
    into ok
  from public.profiles a, public.profiles b
  where a.id = new.swiper_id and b.id = new.target_id;

  if not coalesce(ok, false) then
    raise exception 'cross-party swipe rejected';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_swipes_same_party on public.swipes;
create trigger trg_swipes_same_party
  before insert on public.swipes
  for each row execute function public.fn_enforce_same_party();

-- ---------------------------------------------------------------------------
-- 7. DECK RPC — candidates for a given swiper, ordered "freshest first"
-- ---------------------------------------------------------------------------

create or replace function public.fn_get_deck(p_session_token text, p_limit int default 40)
returns table (
  id uuid,
  first_name varchar,
  age int,
  bio varchar,
  hobbies text[],
  relationship_status varchar,
  looking_for varchar,
  photo_url text
)
language sql
security definer
set search_path = public
as $$
  with me as (
    select p.id, p.party_id
    from public.profiles p
    where p.session_token = p_session_token
      and p.is_active and not p.is_hidden
  )
  select c.id, c.first_name, c.age, c.bio, c.hobbies,
         c.relationship_status, c.looking_for, c.photo_url
  from public.profiles c, me
  where c.party_id  = me.party_id
    and c.id       <> me.id
    and c.is_active
    and not c.is_hidden
    and not exists (
      select 1 from public.swipes s
      where s.swiper_id = me.id and s.target_id = c.id
    )
  order by c.created_at desc
  limit p_limit;
$$;

-- ---------------------------------------------------------------------------
-- 8. TTL / EPHEMERAL LIFECYCLE
-- ---------------------------------------------------------------------------

create table if not exists public.deletion_queue (
  id         bigserial primary key,
  photo_key  text not null,
  created_at timestamptz not null default now()
);

create or replace function public.fn_queue_photo_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.photo_key is not null and old.photo_key <> '' then
    insert into public.deletion_queue (photo_key) values (old.photo_key);
  end if;
  return old;
end;
$$;

drop trigger if exists trg_profile_photo_gc on public.profiles;
create trigger trg_profile_photo_gc
  before delete on public.profiles
  for each row execute function public.fn_queue_photo_delete();

create or replace function public.fn_purge_expired()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  with gone as (
    delete from public.parties
    where expires_at < now()
    returning 1
  )
  select count(*) into n from gone;
  return n;
end;
$$;

select cron.unschedule('partymatch-purge-fallback')
  where exists (select 1 from cron.job where jobname = 'partymatch-purge-fallback');
select cron.schedule('partymatch-purge-fallback', '30 4 * * *', $cron$ select public.fn_purge_expired(); $cron$);

-- ---------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY & REALTIME
-- ---------------------------------------------------------------------------

alter table public.parties        enable row level security;
alter table public.profiles       enable row level security;
alter table public.swipes         enable row level security;
alter table public.matches        enable row level security;
alter table public.reports        enable row level security;
alter table public.deletion_queue enable row level security;

drop policy if exists parties_read_live on public.parties;
create policy parties_read_live on public.parties
  for select to anon, authenticated
  using (expires_at > now());

drop policy if exists matches_read_live on public.matches;
create policy matches_read_live on public.matches
  for select to anon, authenticated
  using (exists (select 1 from public.parties p
                 where p.id = matches.party_id and p.expires_at > now()));

-- Inicjalizacja i rejestracja w Supabase Realtime
do $$
begin
  -- 1. Utwórz publikację supabase_realtime jeśli nie istnieje
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  -- 2. Dodaj tabelę matches do publikacji, jeśli jeszcze jej tam nie ma
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;
end $$;

alter table public.matches replica identity full;

-- ---------------------------------------------------------------------------
-- 10. Seed a demo party
-- ---------------------------------------------------------------------------

insert into public.parties (code, name, venue, starts_at, expires_at,
                            sponsor_title, sponsor_body, sponsor_cta, sponsor_url)
values ('NEON42', 'Neon Warehouse #42', 'Klub Prozak, Kraków',
        now(), now() + interval '36 hours',
        'Bar Deal: -20% na shoty',
        'Pokaż ten ekran przy barze i odbierz 20% zniżki na shoty do 2:00.',
        'Pokaż przy barze', 'https://example.com')
on conflict (code) do nothing;