"use client";

import { useState } from "react";
import type { ConvertResult, PlaylistConvertResult, TrackRef } from "@/lib/types";
import type { Provider } from "@/lib/parse";

const META: Record<Provider, { name: string; color: string }> = {
  spotify: { name: "Spotify", color: "#1DB954" },
  apple: { name: "Apple Music", color: "#FA2D48" },
};

type Result = ConvertResult | PlaylistConvertResult;

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function convert(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setCopied(false);
    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json()) as Result | { error: string };
      if (!res.ok) throw new Error("error" in data ? data.error : "Okänt fel");
      setResult(data as Result);
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Något gick fel");
    } finally {
      setLoading(false);
    }
  }

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setUrl(text);
    } catch {
      // clipboard permission denied
    }
  }

  async function copy() {
    if (!result) return;
    try {
      if (result.type === "track") {
        await navigator.clipboard.writeText(result.to.url);
      } else {
        const urls = result.tracks
          .filter((t) => t.to)
          .map((t) => t.to!.url)
          .join("\n");
        await navigator.clipboard.writeText(urls);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  function reset() {
    setUrl("");
    setResult(null);
    setError(null);
    setCopied(false);
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center px-5 pt-12 pb-10 bg-gradient-to-b from-zinc-950 via-black to-zinc-950 text-zinc-50">
      <main className="w-full max-w-md flex flex-col flex-1">
        <header className="text-center mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/apple-touch-icon.png" alt="" className="mx-auto w-16 h-16 rounded-[18px] mb-5 shadow-xl shadow-black/60" />
          <h1 className="text-[28px] font-semibold tracking-tight">Konvertera musiklänk</h1>
          <p className="text-sm text-zinc-400 mt-1.5">Apple Music · Spotify</p>
        </header>

        <form onSubmit={convert} className="space-y-3">
          <div className="relative">
            <input
              type="url"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Klistra in en låt- eller spellistlänk…"
              className="w-full h-14 pl-4 pr-24 rounded-2xl bg-zinc-900/80 border border-zinc-800 placeholder-zinc-500 text-base outline-none focus:border-zinc-600 focus:bg-zinc-900 transition"
            />
            <button
              type="button"
              onClick={url ? reset : paste}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-10 px-3.5 rounded-xl bg-zinc-800 active:bg-zinc-700 text-sm font-medium transition"
            >
              {url ? "Rensa" : "Klistra"}
            </button>
          </div>
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="w-full h-14 rounded-2xl bg-white text-black font-semibold text-base active:scale-[0.98] transition disabled:opacity-30 disabled:pointer-events-none"
          >
            {loading ? "Konverterar…" : "Konvertera"}
          </button>
        </form>

        {error && (
          <div className="mt-5 p-4 rounded-2xl bg-red-950/40 border border-red-900/60 text-sm text-red-200">
            {error}
          </div>
        )}

        {result?.type === "track" && (
          <TrackResult result={result} copy={copy} copied={copied} />
        )}

        {result?.type === "playlist" && (
          <PlaylistResult result={result} copy={copy} copied={copied} />
        )}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Track result (existing UI)                                        */
/* ------------------------------------------------------------------ */

function TrackResult({ result, copy, copied }: { result: ConvertResult; copy: () => void; copied: boolean }) {
  return (
    <div className="mt-8 space-y-3">
      <TrackCard label="Från" data={result.from} dim />
      <div className="flex justify-center py-1">
        <ArrowDown />
      </div>
      <TrackCard label="Till" data={result.to} />
      <div className="flex gap-2 pt-2">
        <a
          href={result.to.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 h-12 rounded-2xl flex items-center justify-center font-semibold active:scale-[0.98] transition"
          style={{ background: META[result.to.provider].color, color: "#fff" }}
        >
          Öppna i {META[result.to.provider].name}
        </a>
        <button
          onClick={copy}
          className="h-12 px-5 rounded-2xl font-medium bg-zinc-800 active:bg-zinc-700 transition"
        >
          {copied ? "Kopierat!" : "Kopiera"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Playlist result                                                   */
/* ------------------------------------------------------------------ */

function PlaylistResult({ result, copy, copied }: { result: PlaylistConvertResult; copy: () => void; copied: boolean }) {
  const matched = result.tracks.filter((t) => t.to);
  const failed = result.tracks.filter((t) => !t.to);

  return (
    <div className="mt-8 space-y-4">
      {/* Playlist header */}
      <div className="flex gap-3.5 p-3.5 rounded-2xl border bg-zinc-900/80 border-zinc-800">
        {result.from.playlist.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={result.from.playlist.imageUrl}
            alt=""
            className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-zinc-800 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 uppercase tracking-wide mb-0.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: META[result.from.provider].color }} />
            Spellista · {META[result.from.provider].name}
          </div>
          <div className="font-medium text-zinc-50 truncate">{result.from.playlist.name}</div>
          {result.from.playlist.owner && (
            <div className="text-sm text-zinc-400 truncate">{result.from.playlist.owner}</div>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between px-1 text-sm">
        <span className="text-zinc-400">
          {matched.length} av {result.tracks.length} låtar hittades på {META[result.toProvider].name}
        </span>
        <button
          onClick={copy}
          className="h-9 px-4 rounded-xl font-medium text-sm bg-zinc-800 active:bg-zinc-700 transition"
        >
          {copied ? "Kopierat!" : "Kopiera alla"}
        </button>
      </div>

      {/* Track list */}
      <div className="space-y-1.5">
        {result.tracks.map((t, i) => (
          <PlaylistTrackRow key={i} from={t.from} to={t.to} toProvider={result.toProvider} />
        ))}
      </div>

      {failed.length > 0 && (
        <div className="px-1 text-xs text-zinc-500">
          {failed.length} {failed.length === 1 ? "låt" : "låtar"} kunde inte hittas.
        </div>
      )}
    </div>
  );
}

function PlaylistTrackRow({ from, to, toProvider }: { from: TrackRef; to: TrackRef | null; toProvider: Provider }) {
  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-xl ${to ? "bg-zinc-900/60" : "bg-zinc-900/30 opacity-50"}`}>
      {from.track.artworkUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={from.track.artworkUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-zinc-800 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-zinc-100 truncate">{from.track.name}</div>
        <div className="text-xs text-zinc-400 truncate">{from.track.artists.join(", ")}</div>
      </div>
      {to ? (
        <a
          href={to.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-zinc-800 active:bg-zinc-700 transition"
          title={`Öppna i ${META[toProvider].name}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-300">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      ) : (
        <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-zinc-600" title="Hittades inte">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared components                                                 */
/* ------------------------------------------------------------------ */

function TrackCard({ label, data, dim = false }: { label: string; data: TrackRef; dim?: boolean }) {
  const meta = META[data.provider];
  return (
    <div
      className={`flex gap-3 p-3.5 rounded-2xl border ${
        dim ? "bg-zinc-950/60 border-zinc-900" : "bg-zinc-900/80 border-zinc-800"
      }`}
    >
      {data.track.artworkUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.track.artworkUrl}
          alt=""
          className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-14 h-14 rounded-xl bg-zinc-800 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 uppercase tracking-wide mb-0.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
          {label} · {meta.name}
        </div>
        <div className="font-medium text-zinc-50 truncate">{data.track.name}</div>
        <div className="text-sm text-zinc-400 truncate">{data.track.artists.join(", ")}</div>
      </div>
    </div>
  );
}

function ArrowDown() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600">
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </svg>
  );
}
