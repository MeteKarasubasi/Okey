create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Misafir',
  coins integer not null default 25000 check (coins >= 0),
  games integer not null default 0 check (games >= 0),
  wins integer not null default 0 check (wins >= 0),
  last_bonus text not null default '',
  vibration boolean not null default true,
  quick boolean not null default false,
  theme text not null default 'green' check (theme in ('green', 'blue', 'plum')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile" on public.profiles for select using (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.set_profile_updated_at()
returns trigger language plpgsql security invoker as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_profile_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), 'Misafir'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create table if not exists public.friendship_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_user_id uuid references auth.users(id) on delete cascade,
  recipient_bot_key text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default timezone('utc', now()),
  check ((recipient_user_id is not null) <> (recipient_bot_key is not null))
);

create unique index if not exists friendship_pending_unique
on public.friendship_requests (sender_id, recipient_user_id, recipient_bot_key)
where status = 'pending';

alter table public.friendship_requests enable row level security;
create policy "Users can view their friendship requests" on public.friendship_requests
for select using (auth.uid() = sender_id or auth.uid() = recipient_user_id);
create policy "Users can send friendship requests" on public.friendship_requests
for insert with check (auth.uid() = sender_id);
create policy "Recipients can update friendship requests" on public.friendship_requests
for update using (auth.uid() = recipient_user_id) with check (auth.uid() = recipient_user_id);

create table if not exists public.gift_events (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_user_id uuid references auth.users(id) on delete cascade,
  recipient_bot_key text,
  hours integer not null check (hours in (2, 3, 5, 24)),
  cost integer not null check (cost >= 0),
  emoji text not null,
  title text not null,
  created_at timestamptz not null default timezone('utc', now()),
  check ((recipient_user_id is not null) <> (recipient_bot_key is not null))
);

alter table public.gift_events enable row level security;
create policy "Users can view their gifts" on public.gift_events
for select using (auth.uid() = sender_id or auth.uid() = recipient_user_id);
create policy "Users can send gifts" on public.gift_events
for insert with check (auth.uid() = sender_id);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('classic', 'pairs')),
  status text not null default 'waiting' check (status in ('waiting', 'in_progress', 'round_finished', 'finished')),
  round_count integer not null default 5 check (round_count > 0),
  current_turn integer not null default 0 check (current_turn between 0 and 3),
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.game_players (
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references auth.users(id) on delete cascade,
  seat integer not null check (seat between 0 and 3),
  total_score integer not null default 0,
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (game_id, player_id),
  unique (game_id, seat)
);

create table if not exists public.game_actions (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.games(id) on delete cascade,
  sequence bigint not null,
  player_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (game_id, sequence)
);

create table if not exists public.game_rounds (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  round_no integer not null check (round_no > 0),
  status text not null default 'in_progress' check (status in ('in_progress', 'finished')),
  winner_seat integer check (winner_seat between 0 and 3),
  finish_type text,
  score_snapshot jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz,
  unique (game_id, round_no)
);

alter table public.game_actions alter column sequence type bigint using sequence::bigint;

alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.game_actions enable row level security;
alter table public.game_rounds enable row level security;

drop policy if exists "Users can create games" on public.games;
create policy "Users can create games" on public.games for insert with check (auth.uid() = created_by);
drop policy if exists "Owners can update games" on public.games;
create policy "Owners can update games" on public.games for update using (auth.uid() = created_by) with check (auth.uid() = created_by);
drop policy if exists "Players can join their seat" on public.game_players;
create policy "Players can join their seat" on public.game_players for insert with check (auth.uid() = player_id);
drop policy if exists "Players can write own actions" on public.game_actions;
create policy "Players can write own actions" on public.game_actions for insert with check (auth.uid() = player_id and exists (select 1 from public.game_players member where member.game_id = public.game_actions.game_id and member.player_id = auth.uid()));
drop policy if exists "Players can view round history" on public.game_rounds;
create policy "Players can view round history" on public.game_rounds for select using (exists (select 1 from public.game_players viewer where viewer.game_id = public.game_rounds.game_id and viewer.player_id = auth.uid()) or exists (select 1 from public.games owner where owner.id = public.game_rounds.game_id and owner.created_by = auth.uid()));
drop policy if exists "Players can write round history" on public.game_rounds;
create policy "Players can write round history" on public.game_rounds for insert with check (exists (select 1 from public.game_players member where member.game_id = public.game_rounds.game_id and member.player_id = auth.uid()) or exists (select 1 from public.games owner where owner.id = public.game_rounds.game_id and owner.created_by = auth.uid()));
drop policy if exists "Players can update round history" on public.game_rounds;
create policy "Players can update round history" on public.game_rounds for update using (exists (select 1 from public.games owner where owner.id = public.game_rounds.game_id and owner.created_by = auth.uid()));
create policy "Players can view their games" on public.games for select using (auth.uid() = created_by or exists (select 1 from public.game_players viewer where viewer.game_id = public.games.id and viewer.player_id = auth.uid()));
create policy "Players can view game seats" on public.game_players for select using (auth.uid() = player_id or exists (select 1 from public.game_players viewer where viewer.game_id = public.game_players.game_id and viewer.player_id = auth.uid()));
create policy "Players can view game actions" on public.game_actions for select using (exists (select 1 from public.game_players viewer where viewer.game_id = public.game_actions.game_id and viewer.player_id = auth.uid()));

create or replace function public.send_bot_gift(recipient_key text, gift_hours integer, gift_cost integer, gift_emoji text, gift_title text)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  remaining integer;
begin
  if auth.uid() is null then raise exception 'Oturum gerekli'; end if;
  if gift_hours not in (2, 3, 5, 24) or gift_cost < 0 then raise exception 'Geçersiz hediye'; end if;
  update public.profiles
  set coins = coins - gift_cost
  where id = auth.uid() and coins >= gift_cost
  returning coins into remaining;
  if remaining is null then raise exception 'Yetersiz coin'; end if;
  insert into public.gift_events(sender_id, recipient_bot_key, hours, cost, emoji, title)
  values (auth.uid(), recipient_key, gift_hours, gift_cost, gift_emoji, gift_title);
  return remaining;
end;
$$;

grant execute on function public.send_bot_gift(text, integer, integer, text, text) to authenticated;
