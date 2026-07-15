-- TaxiTrainer AI — initial schema
-- Multi-city street-knowledge trainer. Everything is generic per city;
-- Santander is simply the first imported dataset.

create extension if not exists postgis;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type user_role as enum ('user', 'admin');
create type city_status as enum ('draft', 'importing', 'ready');
create type target_type as enum ('street', 'place', 'neighborhood');
create type place_category as enum (
  'hospital', 'hotel', 'beach', 'official_building', 'station',
  'university', 'monument', 'mall', 'police', 'fire_station',
  'court', 'market', 'park', 'square', 'other'
);

-- ---------------------------------------------------------------------------
-- Profiles (extends auth.users)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  avatar_url text,
  role user_role not null default 'user',
  active_city_id uuid,
  xp integer not null default 0,
  level integer not null default 1,
  streak_current integer not null default 0,
  streak_best integer not null default 0,
  last_activity_date date,
  daily_goal_xp integer not null default 50,
  settings jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Geographic catalog (imported from OpenStreetMap)
-- ---------------------------------------------------------------------------

create table public.cities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  country text not null default 'ES',
  center jsonb not null,                      -- [lng, lat]
  bbox jsonb,                                 -- [minLng, minLat, maxLng, maxLat]
  osm_relation_id bigint,
  status city_status not null default 'draft',
  streets_count integer not null default 0,
  places_count integer not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_active_city_fk
  foreign key (active_city_id) references public.cities (id) on delete set null;

create table public.neighborhoods (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities (id) on delete cascade,
  name text not null,
  osm_id bigint,
  geojson jsonb not null,                     -- Polygon | MultiPolygon
  centroid jsonb not null,                    -- [lng, lat]
  geom geometry(Geometry, 4326),
  unique (city_id, name)
);

create table public.streets (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities (id) on delete cascade,
  neighborhood_id uuid references public.neighborhoods (id) on delete set null,
  name text not null,
  normalized_name text not null,
  osm_way_ids bigint[] not null default '{}',
  highway_type text not null default 'residential',
  oneway boolean not null default false,
  length_m double precision not null default 0,
  geojson jsonb not null,                     -- LineString | MultiLineString
  centroid jsonb not null,                    -- [lng, lat]
  aliases text[] not null default '{}',
  geom geometry(Geometry, 4326),
  unique (city_id, normalized_name)
);

create index streets_city_idx on public.streets (city_id);
create index streets_geom_idx on public.streets using gist (geom);
create index streets_normalized_idx on public.streets (city_id, normalized_name);

create table public.intersections (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities (id) on delete cascade,
  street_a_id uuid not null references public.streets (id) on delete cascade,
  street_b_id uuid not null references public.streets (id) on delete cascade,
  point jsonb not null,                       -- [lng, lat]
  unique (street_a_id, street_b_id)
);

create index intersections_city_idx on public.intersections (city_id);
create index intersections_a_idx on public.intersections (street_a_id);
create index intersections_b_idx on public.intersections (street_b_id);

create table public.places (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities (id) on delete cascade,
  neighborhood_id uuid references public.neighborhoods (id) on delete set null,
  category place_category not null default 'other',
  name text not null,
  osm_id bigint,
  point jsonb not null,                       -- [lng, lat]
  address text,
  tags jsonb not null default '{}',
  unique (city_id, category, name)
);

create index places_city_idx on public.places (city_id);
create index places_category_idx on public.places (city_id, category);

-- Keep PostGIS geometry columns in sync with the GeoJSON the app consumes.
create or replace function public.sync_geom_from_geojson()
returns trigger language plpgsql as $$
begin
  new.geom := st_setsrid(st_geomfromgeojson(new.geojson::text), 4326);
  return new;
end;
$$;

create trigger streets_sync_geom before insert or update of geojson
  on public.streets for each row execute function public.sync_geom_from_geojson();
create trigger neighborhoods_sync_geom before insert or update of geojson
  on public.neighborhoods for each row execute function public.sync_geom_from_geojson();

-- ---------------------------------------------------------------------------
-- Question bank (optional pre-generated / AI-generated questions)
-- ---------------------------------------------------------------------------

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities (id) on delete cascade,
  type text not null,
  prompt text not null,
  payload jsonb not null default '{}',
  answer jsonb not null default '{}',
  difficulty smallint not null default 1 check (difficulty between 1 and 3),
  generated_by text not null default 'system' check (generated_by in ('system', 'ai', 'admin')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index questions_city_type_idx on public.questions (city_id, type) where active;

-- ---------------------------------------------------------------------------
-- Activity: sessions, answers, exams
-- ---------------------------------------------------------------------------

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  city_id uuid not null references public.cities (id) on delete cascade,
  mode text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  score double precision not null default 0,
  max_score double precision not null default 0,
  xp_earned integer not null default 0,
  duration_s integer not null default 0,
  is_exam boolean not null default false,
  meta jsonb not null default '{}'
);

create index sessions_user_idx on public.sessions (user_id, started_at desc);

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  city_id uuid not null references public.cities (id) on delete cascade,
  question_type text not null,
  street_id uuid references public.streets (id) on delete set null,
  place_id uuid references public.places (id) on delete set null,
  neighborhood_id uuid references public.neighborhoods (id) on delete set null,
  correct boolean not null,
  score double precision not null default 0,
  expected jsonb,
  given jsonb,
  distance_m double precision,
  time_ms integer not null default 0,
  location jsonb,                             -- [lng, lat] of user interaction, feeds the error heatmap
  created_at timestamptz not null default now()
);

create index answers_user_idx on public.answers (user_id, created_at desc);
create index answers_heatmap_idx on public.answers (city_id, correct) where location is not null;
create index answers_street_idx on public.answers (street_id);

-- ---------------------------------------------------------------------------
-- Spaced repetition (SM-2 per learnable target)
-- ---------------------------------------------------------------------------

create table public.mastery (
  user_id uuid not null references public.profiles (id) on delete cascade,
  city_id uuid not null references public.cities (id) on delete cascade,
  target_type target_type not null,
  target_id uuid not null,
  repetitions integer not null default 0,
  ease double precision not null default 2.5,
  interval_days double precision not null default 0,
  due_at timestamptz not null default now(),
  mastery smallint not null default 0 check (mastery between 0 and 100),
  lapses integer not null default 0,
  last_correct boolean,
  updated_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

create index mastery_due_idx on public.mastery (user_id, city_id, due_at);

-- ---------------------------------------------------------------------------
-- Gamification
-- ---------------------------------------------------------------------------

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null,
  icon text not null default '🏆',
  xp_reward integer not null default 0,
  criteria jsonb not null default '{}'        -- { "type": "streets_mastered", "threshold": 50 }
);

create table public.user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create table public.study_days (
  user_id uuid not null references public.profiles (id) on delete cascade,
  city_id uuid not null references public.cities (id) on delete cascade,
  day date not null,
  xp integer not null default 0,
  time_s integer not null default 0,
  answers_count integer not null default 0,
  correct_count integer not null default 0,
  primary key (user_id, city_id, day)
);

-- ---------------------------------------------------------------------------
-- Favorites, collections, routes
-- ---------------------------------------------------------------------------

create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  city_id uuid not null references public.cities (id) on delete cascade,
  target_type target_type not null,
  target_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  city_id uuid not null references public.cities (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.collection_items (
  collection_id uuid not null references public.collections (id) on delete cascade,
  target_type target_type not null,
  target_id uuid not null,
  added_at timestamptz not null default now(),
  primary key (collection_id, target_type, target_id)
);

create table public.routes (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  name text not null,
  origin_place_id uuid references public.places (id) on delete set null,
  destination_place_id uuid references public.places (id) on delete set null,
  geojson jsonb not null,
  distance_m double precision not null default 0,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Server-side helpers
-- ---------------------------------------------------------------------------

-- Atomically applies session results: xp, streak, study day aggregation.
create or replace function public.apply_session_result(
  p_city_id uuid,
  p_xp integer,
  p_time_s integer,
  p_answers integer,
  p_correct integer
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_last date;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  insert into study_days (user_id, city_id, day, xp, time_s, answers_count, correct_count)
  values (v_user, p_city_id, current_date, p_xp, p_time_s, p_answers, p_correct)
  on conflict (user_id, city_id, day) do update set
    xp = study_days.xp + excluded.xp,
    time_s = study_days.time_s + excluded.time_s,
    answers_count = study_days.answers_count + excluded.answers_count,
    correct_count = study_days.correct_count + excluded.correct_count;

  select last_activity_date into v_last from profiles where id = v_user;

  update profiles set
    xp = xp + p_xp,
    level = 1 + floor(sqrt((xp + p_xp) / 100.0))::int,
    streak_current = case
      when v_last = current_date then streak_current
      when v_last = current_date - 1 then streak_current + 1
      else 1
    end,
    last_activity_date = current_date
  where id = v_user;

  update profiles set streak_best = greatest(streak_best, streak_current)
  where id = v_user;
end;
$$;

-- Leaderboard (top users by XP).
create or replace view public.leaderboard as
  select id, username, avatar_url, xp, level, streak_current
  from public.profiles
  order by xp desc
  limit 100;

-- Error heatmap points for a city.
create or replace view public.error_heatmap as
  select city_id, location, question_type, created_at
  from public.answers
  where correct = false and location is not null;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.cities enable row level security;
alter table public.neighborhoods enable row level security;
alter table public.streets enable row level security;
alter table public.intersections enable row level security;
alter table public.places enable row level security;
alter table public.questions enable row level security;
alter table public.sessions enable row level security;
alter table public.answers enable row level security;
alter table public.mastery enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.study_days enable row level security;
alter table public.favorites enable row level security;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
alter table public.routes enable row level security;

-- Public catalog: readable by anyone, writable only by admins.
create policy "cities readable" on public.cities for select using (true);
create policy "cities admin write" on public.cities for all using (public.is_admin());
create policy "neighborhoods readable" on public.neighborhoods for select using (true);
create policy "neighborhoods admin write" on public.neighborhoods for all using (public.is_admin());
create policy "streets readable" on public.streets for select using (true);
create policy "streets admin write" on public.streets for all using (public.is_admin());
create policy "intersections readable" on public.intersections for select using (true);
create policy "intersections admin write" on public.intersections for all using (public.is_admin());
create policy "places readable" on public.places for select using (true);
create policy "places admin write" on public.places for all using (public.is_admin());
create policy "questions readable" on public.questions for select using (true);
create policy "questions admin write" on public.questions for all using (public.is_admin());
create policy "achievements readable" on public.achievements for select using (true);
create policy "achievements admin write" on public.achievements for all using (public.is_admin());

-- Profiles: everyone can see basic public info (leaderboard), owner can update.
create policy "profiles readable" on public.profiles for select using (true);
create policy "profiles self update" on public.profiles for update using (auth.uid() = id);

-- Personal data: strict ownership.
create policy "sessions own" on public.sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "answers own" on public.answers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "mastery own" on public.mastery for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_achievements own read" on public.user_achievements for select using (auth.uid() = user_id);
create policy "user_achievements own insert" on public.user_achievements for insert with check (auth.uid() = user_id);
create policy "study_days own" on public.study_days for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "favorites own" on public.favorites for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "collections own" on public.collections for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "collection_items own" on public.collection_items for all
  using (exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid()));
create policy "routes readable" on public.routes for select using (user_id is null or auth.uid() = user_id);
create policy "routes own write" on public.routes for insert with check (auth.uid() = user_id);
create policy "routes own update" on public.routes for update using (auth.uid() = user_id);
create policy "routes own delete" on public.routes for delete using (auth.uid() = user_id);
