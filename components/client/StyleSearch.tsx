"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";

import { tagLabel } from "@/lib/tags";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useDynamicTranslation } from "@/components/client/useDynamicTranslation";
import type { SearchResponse } from "@/app/api/search/route";

const MAX_BYTES = 12 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

/**
 * Search by reference photo.
 *
 * The image is analysed server-side into the shared tag vocabulary and scored
 * against every artist's real portfolio, so a result is always work the artist
 * has actually done. Nothing is stored: the photo is posted, read and dropped.
 */
export function StyleSearch() {
  const { t } = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResponse | null>(null);

  const summary = useDynamicTranslation(result ? [result.summary] : []);
  const tagNames = useDynamicTranslation(
    result ? [...result.baseTags, ...result.techniqueTags] : [],
  );
  const allTags = [...(result?.baseTags ?? []), ...(result?.techniqueTags ?? [])];
  const select = useCallback((next: File) => {
    setError(null);
    setResult(null);

    if (!ACCEPTED.includes(next.type)) {
      setError(t.search.error);
      return;
    }
    if (next.size > MAX_BYTES) {
      setError(t.search.error);
      return;
    }

    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(next));
    setFile(next);
  }, [preview, t]);

  const analyse = useCallback(async () => {
    if (!file) return;

    setIsAnalysing(true);
    setError(null);

    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/search", { method: "POST", body });
      const payload = (await response.json()) as SearchResponse & {
        error?: { message?: string };
      };

      if (!response.ok) {
        throw new Error(payload.error?.message ?? t.search.error);
      }
      setResult(payload);
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : t.search.error);
    } finally {
      setIsAnalysing(false);
    }
  }, [file, t]);

  return (
    <div className="grid gap-8 md:grid-cols-[1.1fr_1fr]">
      <div className="rounded-2xl border border-white/10 bg-ink-900 p-6">
        <span className="block text-sm font-medium">{t.search.title}</span>

        {preview ? (
          <div className="mt-3 space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt={t.search.dropHint}
              className="aspect-4/3 w-full rounded-xl border border-white/10 object-cover"
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full rounded-xl border border-white/15 px-4 py-3 text-sm font-medium"
            >
              {t.search.changePhoto}
            </button>
          </div>
        ) : (
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              const dropped = event.dataTransfer.files?.[0];
              if (dropped) select(dropped);
            }}
            className={`mt-3 flex aspect-4/3 items-center justify-center rounded-xl border-2 border-dashed px-6 text-center ${
              isDragging ? "border-blush-400 bg-blush-500/10" : "border-white/15"
            }`}
          >
            <div>
              <p className="text-white/70">{t.search.dropHint}</p>
              <p className="mt-1 text-xs text-white/40">{t.search.formats}</p>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => void analyse()}
          disabled={!file || isAnalysing}
          className="mt-4 w-full rounded-xl bg-blush-500 px-4 py-3 text-sm font-medium text-ink-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isAnalysing ? t.search.analysing : t.search.analyse}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          className="sr-only"
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            if (chosen) select(chosen);
          }}
        />

        {error ? (
          <p role="alert" className="mt-3 rounded-lg bg-blush-500/15 px-3 py-2 text-sm text-blush-300">
            {error}
          </p>
        ) : null}
      </div>

      <div>
        <h2 className="text-lg font-semibold">{t.search.resultsTitle}</h2>

        {result?.summary ? (
          <p className="mt-3 text-sm text-white/70">{summary[0] ?? result.summary}</p>
        ) : null}

        {result && allTags.length > 0 ? (
          <p className="mt-2 text-xs text-white/50">
            {t.search.matchedStyles}:{" "}
            <span className="text-white/70">
              {allTags.map((tag, index) => tagNames[index] ?? tagLabel(tag)).join(" · ")}            </span>
          </p>
        ) : null}

        {result && result.matches.length === 0 ? (
          <p className="mt-4 text-sm text-white/60">
            {allTags.length === 0 ? t.search.noAnalysis : t.search.noResults}
          </p>
        ) : null}

        <ul className="mt-4 space-y-3">
          {result?.matches.map((match) => (
            <li
              key={match.artistId}
              className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 p-4"
            >
              <div>
                <p className="font-semibold">{match.displayName}</p>
                <p className="text-sm text-white/60">
                  @{match.handle} · {t.home.fromPrice} {match.basePrice} {t.home.lev}
                </p>
                <p className="mt-1 text-xs text-blush-300">
                  {match.score}% {t.search.matchScore} ·{" "}
                  {match.matchedTags.map((tag) => tagLabel(tag)).join(" · ")}
                </p>
              </div>
              <Link
                href={
                  match.shareToken ? `/confirm/${match.shareToken}` : `/confirm/${match.artistId}`
                }
                className="shrink-0 rounded-xl bg-blush-500 px-4 py-2 text-sm font-medium text-ink-950 hover:opacity-90"
              >
                {t.client.tryStyle}
              </Link>
            </li>
          ))}
        </ul>

        <Link href="/artists" className="btn-ghost mt-6 !py-2.5 !text-sm">
          {t.search.browseAll}
        </Link>
      </div>
    </div>
  );
}
