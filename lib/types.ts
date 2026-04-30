import type { Provider } from "./parse";

export type Track = {
  name: string;
  artists: string[];
  album?: string;
  durationMs?: number;
  isrc?: string;
  artworkUrl?: string;
};

export type TrackRef = {
  provider: Provider;
  url: string;
  track: Track;
};

export type ConvertResult = {
  type: "track";
  from: TrackRef;
  to: TrackRef;
};

export type PlaylistInfo = {
  name: string;
  description?: string;
  imageUrl?: string;
  owner?: string;
  trackCount: number;
};

export type PlaylistTrackResult = {
  from: TrackRef;
  to: TrackRef | null;
};

export type PlaylistConvertResult = {
  type: "playlist";
  from: {
    provider: Provider;
    url: string;
    playlist: PlaylistInfo;
  };
  toProvider: Provider;
  tracks: PlaylistTrackResult[];
};
