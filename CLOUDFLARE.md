# Cloudflare Workers + Durable Objects

Canlı oyun sunucusu her odayı bir `RoomDurableObject` örneğine yönlendirir. Oyun durumu Durable Object SQLite storage içinde tutulur; WebSocket bağlantıları Hibernation API ile odaya bağlanır. Böylece aynı odadaki tüm hamleler tek bir yetkili state üzerinden işlenir.

## Yerel çalıştırma

1. `.dev.vars.example` dosyasını `.dev.vars` olarak kopyala ve Supabase değerlerini doldur.
2. Yerel deneme için `GAME_WS_AUTH_REQUIRED=false` ve `GAME_WS_DEV_ALLOW_GUESTS=true` kullanılabilir. Bu değerler yalnızca geliştirme içindir.
3. Terminal 1: `npm run cf:dev`
4. Terminal 2: `.env` içindeki `EXPO_PUBLIC_GAME_WS_URL=ws://localhost:8788` ile `npm run web`

## Canlıya alma

```bash
npx wrangler login
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put SUPABASE_URL
npx wrangler deploy
```

Canlı web build’inde `EXPO_PUBLIC_GAME_WS_URL` değerini Worker adresine `wss://...workers.dev` olarak ayarla. `GAME_ALLOWED_ORIGINS` değerini de yalnızca gerçek web adreslerini içerecek şekilde Wrangler ortam değişkeni olarak tanımla.

Worker erişim tokenını Supabase üzerinden doğrular; istemcinin gönderdiği `userId` yetki kanıtı olarak kullanılmaz. Service role anahtarı yalnızca Cloudflare secret olarak tutulur.
