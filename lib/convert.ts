import { parseLink } from "./parse";
import { getAppleTrack, getApplePlaylist, searchApple } from "./apple";
import { getSpotifyTrack, getSpotifyPlaylist, searchSpotify } from "./spotify";
import type { ConvertResult, PlaylistConvertResult, PlaylistTrackResult } from "./types";

export async function convertLink(input: string): Promise<ConvertResult | PlaylistConvertResult> {
  const parsed = parseLink(input);
  if (!parsed) {
    throw new Error("Länken känns inte igen. Klistra in en låt- eller spellistlänk från Spotify eller Apple Music.");
  }

  if (parsed.type === "playlist") {
    if (parsed.provider === "spotify") return convertSpotifyPlaylist(parsed.playlistId);
    return convertApplePlaylist(parsed.playlistId, parsed.storefront);
  }

  if (parsed.provider === "spotify") {
    const source = await getSpotifyTrack(parsed.trackId);
    const target = await searchApple({ name: source.track.name, artists: source.track.artists });
    if (!target) throw new Error("Hittade ingen matchande låt på Apple Music.");
    return {
      type: "track",
      from: { provider: "spotify", url: source.url, track: source.track },
      to: { provider: "apple", url: target.url, track: target.track },
    };
  }

  const source = await getAppleTrack(parsed.trackId, parsed.storefront);
  if (!source) throw new Error("Kunde inte hämta låten från Apple Music.");
  const target = await searchSpotify({ name: source.track.name, artists: source.track.artists });
  if (!target) throw new Error("Hittade ingen matchande låt på Spotify.");
  return {
    type: "track",
    from: { provider: "apple", url: source.url, track: source.track },
    to: { provider: "spotify", url: target.url, track: target.track },
  };
}

async function convertSpotifyPlaylist(playlistId: string): Promise<PlaylistConvertResult> {
  const source = await getSpotifyPlaylist(playlistId);

  const tracks: PlaylistTrackResult[] = await Promise.all(
    source.tracks.map(async ({ track, url }): Promise<PlaylistTrackResult> => {
      const from = { provider: "spotify" as const, url, track };
      try {
        const match = await searchApple({ name: track.name, artists: track.artists });
        return { from, to: match ? { provider: "apple", url: match.url, track: match.track } : null };
      } catch {
        return { from, to: null };
      }
    }),
  );

  return {
    type: "playlist",
    from: { provider: "spotify", url: source.url, playlist: source.playlist },
    toProvider: "apple",
    tracks,
  };
}

async function convertApplePlaylist(playlistId: string, storefront = "us"): Promise<PlaylistConvertResult> {
  const source = await getApplePlaylist(playlistId, storefront);

  const tracks: PlaylistTrackResult[] = await Promise.all(
    source.tracks.map(async ({ track, url }): Promise<PlaylistTrackResult> => {
      const from = { provider: "apple" as const, url, track };
      try {
        const match = await searchSpotify({ name: track.name, artists: track.artists });
        return { from, to: match ? { provider: "spotify", url: match.url, track: match.track } : null };
      } catch {
        return { from, to: null };
      }
    }),
  );

  return {
    type: "playlist",
    from: { provider: "apple", url: source.url, playlist: source.playlist },
    toProvider: "spotify",
    tracks,
  };
}
