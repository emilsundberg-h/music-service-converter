# Länkkonverterare

Konverterar låt-länkar mellan **Apple Music** och **Spotify**. Byggd i Next.js, tänkt att köras på Vercel och läggas till som bokmärke/PWA på iPhone & iPad.

## Komma igång

1. Hämta Spotify-credentials på [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) — skapa en app, kopiera **Client ID** och **Client Secret**.
2. Kopiera `.env.example` till `.env.local` och fyll i:
   ```
   SPOTIFY_CLIENT_ID=...
   SPOTIFY_CLIENT_SECRET=...
   ```
3. Kör dev-servern:
   ```bash
   npm run dev
   ```
4. Öppna [http://localhost:3000](http://localhost:3000).

## Deploy till Vercel

- Importera repot i Vercel.
- Lägg till `SPOTIFY_CLIENT_ID` och `SPOTIFY_CLIENT_SECRET` under **Project Settings → Environment Variables**.
- Deploya.

## Hemskärm på iOS

Öppna den deployade sidan i Safari på iPhone/iPad → **Dela** → **Lägg till på hemskärmen**. Appen startar i standalone-läge med egen ikon.

## Hur det fungerar

- **Apple Music → Spotify**: iTunes Lookup hämtar låttitel/artist → Spotify Search hittar matchen.
- **Spotify → Apple Music**: Spotify Track API hämtar låttitel/artist → iTunes Search hittar matchen.
- Länkar i format `open.spotify.com/track/...`, `spotify:track:...`, `music.apple.com/.../album/.../...?i=...` och `music.apple.com/.../song/...` känns igen.
