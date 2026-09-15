-- Security hardening for the browser client and the authoritative game server.
alter table public.games add column if not exists room_code text;
alter table public.games add column if not exists game_state jsonb;
alter table public.games add column if not exists last_sequence bigint not null default 0;
alter table public.games add column if not exists last_activity timestamptz not null default timezone('utc', now());
create unique index if not exists games_room_code_unique on public.games (room_code) where room_code is not null;

create or replace function public.prevent_client_profile_economy_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' and (
    new.coins <> old.coins or new.games <> old.games or new.wins <> old.wins or new.last_bonus <> old.last_bonus
  ) then
    raise exception 'Ekonomi ve istatistik alanları yalnızca oyun sunucusu tarafından güncellenebilir';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_economy on public.profiles;
create trigger protect_profile_economy before update on public.profiles
for each row execute function public.prevent_client_profile_economy_change();

drop policy if exists "Users can insert their own profile" on public.profiles;

create or replace function public.claim_daily_bonus()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
  today text := to_char((now() at time zone 'utc')::date, 'YYYY-MM-DD');
begin
  if auth.uid() is null then raise exception 'Oturum gerekli'; end if;
  update public.profiles
  set coins = coins + 750, last_bonus = today
  where id = auth.uid() and last_bonus <> today
  returning coins into new_balance;
  if new_balance is null then raise exception 'Günlük hediye bugün zaten alındı'; end if;
  return new_balance;
end;
$$;
revoke all on function public.claim_daily_bonus() from public, anon;
grant execute on function public.claim_daily_bonus() to authenticated;

drop policy if exists "Users can send gifts" on public.gift_events;
create or replace function public.send_bot_gift(recipient_key text, gift_hours integer, gift_cost integer, gift_emoji text, gift_title text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining integer;
  expected_cost integer;
begin
  if auth.uid() is null then raise exception 'Oturum gerekli'; end if;
  if recipient_key !~ '^bot-[1-3]$' then raise exception 'Geçersiz hediye alıcısı'; end if;
  expected_cost := case gift_hours when 2 then 100 when 3 then 180 when 5 then 300 when 24 then 750 else -1 end;
  if expected_cost < 0 or gift_cost <> expected_cost then raise exception 'Geçersiz hediye fiyatı'; end if;
  if char_length(gift_emoji) < 1 or char_length(gift_emoji) > 16 or char_length(gift_title) < 1 or char_length(gift_title) > 80 then raise exception 'Geçersiz hediye bilgisi'; end if;
  update public.profiles set coins = coins - expected_cost
  where id = auth.uid() and coins >= expected_cost
  returning coins into remaining;
  if remaining is null then raise exception 'Yetersiz coin'; end if;
  insert into public.gift_events(sender_id, recipient_bot_key, hours, cost, emoji, title)
  values (auth.uid(), recipient_key, gift_hours, expected_cost, gift_emoji, gift_title);
  return remaining;
end;
$$;
revoke all on function public.send_bot_gift(text, integer, integer, text, text) from public, anon;
grant execute on function public.send_bot_gift(text, integer, integer, text, text) to authenticated;

create or replace function public.record_server_result(target_user_id uuid, did_win boolean, reward integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then raise exception 'Yalnızca oyun sunucusu sonuç yazabilir'; end if;
  if reward < 0 or reward > 750 then raise exception 'Geçersiz ödül'; end if;
  update public.profiles
  set games = games + 1, wins = wins + case when did_win then 1 else 0 end, coins = coins + reward
  where id = target_user_id;
end;
$$;
revoke all on function public.record_server_result(uuid, boolean, integer) from public, anon, authenticated;
grant execute on function public.record_server_result(uuid, boolean, integer) to service_role;

-- Client submitted game history is informational only; the server writes trusted state with service_role.
drop policy if exists "Users can create games" on public.games;
drop policy if exists "Owners can update games" on public.games;
drop policy if exists "Players can join their seat" on public.game_players;
drop policy if exists "Players can write own actions" on public.game_actions;
drop policy if exists "Players can write round history" on public.game_rounds;
drop policy if exists "Players can update round history" on public.game_rounds;
