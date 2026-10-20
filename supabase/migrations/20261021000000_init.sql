-- Tablekeep schema: campaigns, members, live dice rolls, initiative and session notes.
-- Every table uses row level security so players only ever see their own campaigns.

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- create a profile automatically when someone signs up
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- campaigns ----------
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  invite_code text not null unique default upper(substr(md5(random()::text), 1, 6)),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  round integer not null default 1 check (round >= 1),
  active_combatant_id uuid,
  created_at timestamptz not null default now()
);

create table public.campaign_members (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'player' check (role in ('dm', 'player')),
  character_name text not null default '' check (char_length(character_name) <= 60),
  joined_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

create index campaign_members_user_idx on public.campaign_members (user_id);

-- membership checks used by the policies below; security definer avoids recursive RLS
create function public.is_campaign_member(target_campaign uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campaign_members
    where campaign_id = target_campaign and user_id = (select auth.uid())
  );
$$;

create function public.is_campaign_dm(target_campaign uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campaign_members
    where campaign_id = target_campaign and user_id = (select auth.uid()) and role = 'dm'
  );
$$;

-- the creator becomes the campaign's DM
create function public.add_owner_as_dm()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.campaign_members (campaign_id, user_id, role)
  values (new.id, new.owner_id, 'dm');
  return new;
end;
$$;

create trigger on_campaign_created
  after insert on public.campaigns
  for each row execute function public.add_owner_as_dm();

-- join a campaign with its invite code
create function public.join_campaign(code text, character_name text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not signed in';
  end if;

  select id into found_id from public.campaigns where invite_code = upper(trim(code));
  if found_id is null then
    raise exception 'invalid invite code';
  end if;

  insert into public.campaign_members (campaign_id, user_id, character_name)
  values (found_id, (select auth.uid()), left(coalesce(join_campaign.character_name, ''), 60))
  on conflict (campaign_id, user_id) do nothing;

  return found_id;
end;
$$;

-- ---------- dice rolls ----------
create table public.dice_rolls (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  roller_name text not null,
  expression text not null check (char_length(expression) <= 40),
  detail jsonb not null,
  total integer not null,
  created_at timestamptz not null default now()
);

create index dice_rolls_campaign_idx on public.dice_rolls (campaign_id, created_at desc);

-- ---------- initiative ----------
create table public.combatants (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  initiative integer not null default 0,
  hp integer not null default 0,
  max_hp integer not null default 0 check (max_hp >= 0),
  is_npc boolean not null default false,
  created_at timestamptz not null default now()
);

create index combatants_campaign_idx on public.combatants (campaign_id);

alter table public.campaigns
  add constraint campaigns_active_combatant_fkey
  foreign key (active_combatant_id) references public.combatants (id) on delete set null;

-- ---------- session notes ----------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  played_on date not null default current_date,
  notes text not null default '' check (char_length(notes) <= 20000),
  recap text not null default '',
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sessions_campaign_idx on public.sessions (campaign_id, played_on desc);

-- ---------- row level security ----------
alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;
alter table public.dice_rolls enable row level security;
alter table public.combatants enable row level security;
alter table public.sessions enable row level security;

-- profiles: you can read people you share a campaign with, and edit yourself
create policy "read own and fellow members' profiles" on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.campaign_members mine
      join public.campaign_members theirs on theirs.campaign_id = mine.campaign_id
      where mine.user_id = (select auth.uid()) and theirs.user_id = profiles.id
    )
  );

create policy "update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- campaigns
-- the owner check lets the creator read the row back while the DM membership trigger is still running
create policy "members read campaigns" on public.campaigns
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_campaign_member(id));

create policy "anyone signed in creates campaigns they own" on public.campaigns
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "members update campaign (turn tracking)" on public.campaigns
  for update to authenticated
  using (public.is_campaign_member(id))
  with check (public.is_campaign_member(id));

create policy "owner deletes campaign" on public.campaigns
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- members
create policy "members see each other" on public.campaign_members
  for select to authenticated
  using (public.is_campaign_member(campaign_id));

create policy "members edit their own character name" on public.campaign_members
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "leave a campaign, or dm removes a player" on public.campaign_members
  for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_campaign_dm(campaign_id));

-- dice rolls: members read; you can only post rolls as yourself
create policy "members read rolls" on public.dice_rolls
  for select to authenticated
  using (public.is_campaign_member(campaign_id));

create policy "members roll as themselves" on public.dice_rolls
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_campaign_member(campaign_id));

-- combatants: the whole table can manage initiative
create policy "members read combatants" on public.combatants
  for select to authenticated
  using (public.is_campaign_member(campaign_id));

create policy "members add combatants" on public.combatants
  for insert to authenticated
  with check (public.is_campaign_member(campaign_id));

create policy "members update combatants" on public.combatants
  for update to authenticated
  using (public.is_campaign_member(campaign_id))
  with check (public.is_campaign_member(campaign_id));

create policy "members remove combatants" on public.combatants
  for delete to authenticated
  using (public.is_campaign_member(campaign_id));

-- sessions
create policy "members read sessions" on public.sessions
  for select to authenticated
  using (public.is_campaign_member(campaign_id));

create policy "members write sessions" on public.sessions
  for insert to authenticated
  with check (created_by = (select auth.uid()) and public.is_campaign_member(campaign_id));

create policy "members update sessions" on public.sessions
  for update to authenticated
  using (public.is_campaign_member(campaign_id))
  with check (public.is_campaign_member(campaign_id));

create policy "dm or author deletes sessions" on public.sessions
  for delete to authenticated
  using (created_by = (select auth.uid()) or public.is_campaign_dm(campaign_id));

-- ---------- realtime ----------
alter publication supabase_realtime add table public.dice_rolls, public.combatants, public.campaigns, public.campaign_members;

-- deletes carry the full old row so realtime filters (campaign_id) still match them
alter table public.combatants replica identity full;
alter table public.campaign_members replica identity full;
