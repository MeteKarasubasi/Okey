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

GitHub Pages web build’i `https://metekarasubasi.github.io/Okey/` adresini kullanır. GitHub Actions içindeki `EXPO_PUBLIC_GAME_WS_URL` Worker adresine ayarlanmıştır. Yeni bir canlı domain kullanırsan `GAME_ALLOWED_ORIGINS` değerine o domainin origin’ini ekle.

Worker erişim tokenını Supabase üzerinden doğrular; istemcinin gönderdiği `userId` yetki kanıtı olarak kullanılmaz. Service role anahtarı yalnızca Cloudflare secret olarak tutulur.
