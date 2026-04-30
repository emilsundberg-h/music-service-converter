export type Provider = "spotify" | "apple";

export type ParsedTrack = {
  provider: Provider;
  type: "track";
  trackId: string;
  storefront?: string;
};

export type ParsedPlaylist = {
  provider: Provider;
  type: "playlist";
  playlistId: string;
  storefront?: string;
};

export type ParsedLink = ParsedTrack | ParsedPlaylist;

export function parseLink(input: string): ParsedLink | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const trackUri = trimmed.match(/^spotify:track:([a-zA-Z0-9]+)/);
  if (trackUri) return { provider: "spotify", type: "track", trackId: trackUri[1] };

  const playlistUri = trimmed.match(/^spotify:playlist:([a-zA-Z0-9]+)/);
  if (playlistUri) return { provider: "spotify", type: "playlist", playlistId: playlistUri[1] };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.hostname === "open.spotify.com" || url.hostname.endsWith(".spotify.com")) {
    const playlist = url.pathname.match(/\/playlist\/([a-zA-Z0-9]+)/);
    if (playlist) return { provider: "spotify", type: "playlist", playlistId: playlist[1] };
    const track = url.pathname.match(/\/track\/([a-zA-Z0-9]+)/);
    if (track) return { provider: "spotify", type: "track", trackId: track[1] };
    return null;
  }

  if (url.hostname === "music.apple.com" || url.hostname === "geo.music.apple.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const storefront = /^[a-z]{2}$/.test(parts[0] ?? "") ? parts[0] : "us";

    // Playlist: .../playlist/name/pl.xxxxx
    const plPart = parts.find((p) => p.startsWith("pl."));
    if (plPart && parts.includes("playlist")) {
      return { provider: "apple", type: "playlist", playlistId: plPart, storefront };
    }

    const iParam = url.searchParams.get("i");
    if (iParam && /^\d+$/.test(iParam)) {
      return { provider: "apple", type: "track", trackId: iParam, storefront };
    }
    const last = parts[parts.length - 1];
    if (last && /^\d+$/.test(last) && parts.includes("song")) {
      return { provider: "apple", type: "track", trackId: last, storefront };
    }
    return null;
  }

  return null;
}
