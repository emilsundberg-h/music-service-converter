import type { Track, PlaylistInfo } from "./types";

type ItunesSong = {
  wrapperType: string;
  kind?: string;
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  trackViewUrl: string;
  trackTimeMillis?: number;
  artworkUrl100?: string;
  artworkUrl60?: string;
};

function toTrack(item: ItunesSong): Track {
  const artwork = item.artworkUrl100?.replace("100x100bb", "600x600bb") ?? item.artworkUrl60;
  return {
    name: item.trackName,
    artists: [item.artistName],
    album: item.collectionName,
    durationMs: item.trackTimeMillis,
    artworkUrl: artwork,
  };
}

export async function getAppleTrack(
  id: string,
  storefront = "us",
): Promise<{ track: Track; url: string } | null> {
  const tryOne = async (country: string) => {
    const res = await fetch(
      `https://itunes.apple.com/lookup?id=${id}&country=${country}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: ItunesSong[] };
    const song = data.results?.find((r) => r.kind === "song") ?? data.results?.[0];
    return song ?? null;
  };
  const song = (await tryOne(storefront)) ?? (storefront !== "us" ? await tryOne("us") : null);
  if (!song) return null;
  return { track: toTrack(song), url: song.trackViewUrl };
}

/* ------------------------------------------------------------------ */
/*  Apple Music playlist scraping via JSON-LD                         */
/* ------------------------------------------------------------------ */

type JsonLdTrack = {
  "@type": string;
  name: string;
  url: string;
  audio?: { thumbnailUrl?: string };
};

type JsonLdPlaylist = {
  "@type": string;
  name: string;
  description?: string;
  numTracks?: number;
  author?: { name?: string };
  track?: JsonLdTrack[];
};

export async function getApplePlaylist(
  playlistId: string,
  storefront = "us",
): Promise<{
  playlist: PlaylistInfo;
  tracks: { track: Track; url: string }[];
  url: string;
}> {
  const playlistUrl = `https://music.apple.com/${storefront}/playlist/p/${playlistId}`;

  const res = await fetch(playlistUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    redirect: "follow",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Kunde inte hämta Apple Music-spellista (${res.status}).`);
  const html = await res.text();

  // Extract JSON-LD
  const ldMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
  if (!ldMatch) throw new Error("Kunde inte läsa spellistdata från Apple Music.");
  const ld = JSON.parse(ldMatch[1]) as JsonLdPlaylist;

  if (!ld.track?.length) throw new Error("Spellistan verkar vara tom.");

  // Extract track IDs from URLs (e.g. .../song/name/1825994649)
  const trackEntries: { id: string; name: string; thumbnailUrl?: string; url: string }[] = [];
  for (const t of ld.track) {
    const idMatch = t.url.match(/\/(\d+)(?:\?|$)/);
    if (idMatch) {
      trackEntries.push({
        id: idMatch[1],
        name: t.name,
        thumbnailUrl: t.audio?.thumbnailUrl,
        url: t.url,
      });
    }
  }

  // Batch lookup via iTunes to get artist names (max ~200 IDs per request)
  const tracks: { track: Track; url: string }[] = [];
  const batchSize = 150;
  for (let i = 0; i < trackEntries.length; i += batchSize) {
    const batch = trackEntries.slice(i, i + batchSize);
    const ids = batch.map((e) => e.id).join(",");
    const lookupRes = await fetch(
      `https://itunes.apple.com/lookup?id=${ids}&country=${storefront}`,
      { cache: "no-store" },
    );
    if (lookupRes.ok) {
      const data = (await lookupRes.json()) as { results?: ItunesSong[] };
      const songMap = new Map<string, ItunesSong>();
      for (const r of data.results ?? []) {
        if (r.kind === "song" || r.wrapperType === "track") {
          songMap.set(String(r.trackId), r);
        }
      }
      for (const entry of batch) {
        const song = songMap.get(entry.id);
        if (song) {
          tracks.push({ track: toTrack(song), url: song.trackViewUrl });
        } else {
          // Fallback: use JSON-LD data without artist
          tracks.push({
            track: { name: entry.name, artists: ["Okänd artist"], artworkUrl: entry.thumbnailUrl },
            url: entry.url,
          });
        }
      }
    } else {
      // Fallback for failed batch
      for (const entry of batch) {
        tracks.push({
          track: { name: entry.name, artists: ["Okänd artist"], artworkUrl: entry.thumbnailUrl },
          url: entry.url,
        });
      }
    }
  }

  // Extract playlist image from og:image
  const ogImage = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]*)"/)?.[1];
  // Get final URL (Apple Music redirects to canonical URL)
  const finalUrl = res.url || playlistUrl;

  return {
    playlist: {
      name: ld.name,
      description: ld.description,
      imageUrl: ogImage || undefined,
      owner: ld.author?.name,
      trackCount: ld.numTracks ?? tracks.length,
    },
    tracks,
    url: finalUrl,
  };
}

export async function searchApple(params: {
  name: string;
  artists: string[];
  storefront?: string;
}): Promise<{ url: string; track: Track } | null> {
  const term = `${params.name} ${params.artists.join(" ")}`;
  // Try the given storefront first, then fall back to other markets
  const storefronts = [params.storefront ?? "se", "us", "gb"].filter(
    (v, i, a) => a.indexOf(v) === i,
  );

  for (const country of storefronts) {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=5&country=${country}`,
      { cache: "no-store" },
    );
    if (!res.ok) continue;
    const data = (await res.json()) as { results?: ItunesSong[] };
    const item = data.results?.[0];
    if (item) return { url: item.trackViewUrl, track: toTrack(item) };
  }
  return null;
}
