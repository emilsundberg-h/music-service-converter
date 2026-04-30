import type { Track, PlaylistInfo } from "./types";

/* ------------------------------------------------------------------ */
/*  Spotify Web API — Client Credentials flow                         */
/* ------------------------------------------------------------------ */

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token;

  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Spotify API-nycklar saknas.");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Kunde inte hämta Spotify-token (${res.status}).`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return tokenCache.token;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

/* ------------------------------------------------------------------ */
/*  Spotify API types                                                 */
/* ------------------------------------------------------------------ */

type SpotifyImage = { url: string; width?: number; height?: number };
type SpotifyArtist = { name: string };

type SpotifyTrack = {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album: {
    name: string;
    images: SpotifyImage[];
  };
  duration_ms: number;
  external_ids?: { isrc?: string };
  external_urls: { spotify: string };
};

type SpotifyPlaylist = {
  id: string;
  name: string;
  description?: string;
  images: SpotifyImage[];
  owner: { display_name?: string };
  tracks: {
    items: { track: SpotifyTrack | null }[];
    next: string | null;
    total: number;
  };
  external_urls: { spotify: string };
};

type SpotifySearchResult = {
  tracks?: { items: SpotifyTrack[] };
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function bestImage(images: SpotifyImage[]): string | undefined {
  if (!images.length) return undefined;
  const sorted = [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return sorted[0].url;
}

function toTrack(s: SpotifyTrack): Track {
  return {
    name: s.name,
    artists: s.artists.map((a) => a.name),
    album: s.album.name,
    durationMs: s.duration_ms,
    isrc: s.external_ids?.isrc,
    artworkUrl: bestImage(s.album.images),
  };
}

/* ------------------------------------------------------------------ */
/*  Get track by ID                                                   */
/* ------------------------------------------------------------------ */

export async function getSpotifyTrack(id: string): Promise<{ track: Track; url: string }> {
  const token = await getAccessToken();
  const res = await fetch(`https://api.spotify.com/v1/tracks/${encodeURIComponent(id)}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Kunde inte hämta Spotify-låt (${res.status}).`);
  const data = (await res.json()) as SpotifyTrack;
  return { track: toTrack(data), url: data.external_urls.spotify };
}

/* ------------------------------------------------------------------ */
/*  Get playlist by ID                                                */
/* ------------------------------------------------------------------ */

export async function getSpotifyPlaylist(id: string): Promise<{
  playlist: PlaylistInfo;
  tracks: { track: Track; url: string }[];
  url: string;
}> {
  const token = await getAccessToken();
  const res = await fetch(
    `https://api.spotify.com/v1/playlists/${encodeURIComponent(id)}?fields=id,name,description,images,owner(display_name),external_urls,tracks(items(track(id,name,artists(name),album(name,images),duration_ms,external_ids,external_urls)),next,total)`,
    { headers: authHeaders(token), cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Kunde inte hämta Spotify-spellista (${res.status}).`);
  const data = (await res.json()) as SpotifyPlaylist;

  const tracks: { track: Track; url: string }[] = [];
  for (const item of data.tracks.items) {
    if (item.track) {
      tracks.push({ track: toTrack(item.track), url: item.track.external_urls.spotify });
    }
  }

  // Fetch remaining pages (Spotify returns max 100 per page)
  let nextUrl = data.tracks.next;
  while (nextUrl && tracks.length < 200) {
    const pageRes = await fetch(nextUrl, { headers: authHeaders(token), cache: "no-store" });
    if (!pageRes.ok) break;
    const page = (await pageRes.json()) as SpotifyPlaylist["tracks"];
    for (const item of page.items) {
      if (item.track) {
        tracks.push({ track: toTrack(item.track), url: item.track.external_urls.spotify });
      }
    }
    nextUrl = page.next;
  }

  return {
    playlist: {
      name: data.name,
      description: data.description || undefined,
      imageUrl: bestImage(data.images),
      owner: data.owner.display_name,
      trackCount: data.tracks.total,
    },
    tracks,
    url: data.external_urls.spotify,
  };
}

/* ------------------------------------------------------------------ */
/*  Search for a track on Spotify — returns a direct track link       */
/* ------------------------------------------------------------------ */

export async function searchSpotify(params: {
  name: string;
  artists: string[];
  isrc?: string;
}): Promise<{ url: string; track: Track } | null> {
  const token = await getAccessToken();

  // Prefer ISRC search for exact match
  const query = params.isrc
    ? `isrc:${params.isrc}`
    : `track:${params.name} artist:${params.artists[0] ?? ""}`;

  const res = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`,
    { headers: authHeaders(token), cache: "no-store" },
  );
  if (!res.ok) return null;

  const data = (await res.json()) as SpotifySearchResult;
  const hit = data.tracks?.items?.[0];
  if (!hit) return null;

  return {
    url: hit.external_urls.spotify,
    track: toTrack(hit),
  };
}
