# Keyif 101 security checklist

## Implemented

- Supabase authentication is required for WebSocket create, join, and action messages.
- The server verifies the Supabase access token with `auth.getUser`; it never trusts a client supplied user id.
- Client messages are serialized per connection, limited to 8 KB, and rate limited to 40 messages per 10 seconds.
- Only the allowlisted game actions are accepted. Tile ids, meld indexes, room codes, and collection sizes are validated before the game engine runs.
- Room codes use 48 bits of randomness, rooms are capped, abandoned rooms expire, and a short reconnect reservation preserves a player's seat.
- The server is authoritative for turn order, game rules, timeout moves, meld validation, score snapshots, and trusted result writes.
- Opponent hands are replaced with opaque placeholders before state broadcast; each client receives its own hand only.
- Production handshakes require an allowlisted Origin. Production clients must use `wss://`.
- The service role key is server-only. The browser receives only the Supabase anon key, protected by RLS.
- Profile economy and statistics cannot be changed through the browser update policy. Daily bonuses and bot gifts use validated RPCs.
- Client submitted game history writes are disabled. The WebSocket server writes trusted game state and actions with `service_role` when configured.
- `.env` and Supabase CLI temporary files are ignored by Git.

## Production requirements

- Set `NODE_ENV=production`, `GAME_WS_AUTH_REQUIRED=true`, `GAME_ALLOWED_ORIGINS` to the exact HTTPS site origin, and `SUPABASE_SERVICE_ROLE_KEY` only in the WebSocket host's secret store.
- Terminate TLS at the reverse proxy and expose the game server as `wss://...`; do not expose port 8787 directly without TLS.
- Build the web client with the public `EXPO_PUBLIC_SUPABASE_URL`, anon key, and `EXPO_PUBLIC_GAME_WS_URL=wss://...` values.
- Keep database backups and monitor WebSocket connection, error, and rate-limit metrics.
- Run dependency audit and rotate the Supabase service role key if it is ever exposed.

The WebSocket room state is currently memory resident. Production deployments should use one sticky WebSocket instance or move room state and locks to a shared store such as Redis before horizontal scaling.
