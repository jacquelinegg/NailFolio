"use client";

import { useCallback, useId, useRef, useState } from "react";

import { useLocale } from "@/lib/i18n/LocaleProvider";

export interface HandPhotoUploadProps {
  /** Uploaded hand photo URL; `null` until a photo is chosen. */
  value: string | null;
  onChange: (url: string) => void;
  /** Notified when the client picks a new photo (before/while uploading). */
  onLocalPreview?: (dataUrl: string) => void;
  disabled?: boolean;
}

const MAX_BYTES = 12 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

/**
 * Served from `public/hand.png`; the mobile dropzone requests the same file
 * from the API base, so the two platforms cannot drift apart on it either.
 */
const HAND_SHOT_URL = "/hand.png";

/**
 * Example shot shown in the empty dropzone.
 *
 * A photograph teaches the framing the try-on needs — flat, well lit, fingers
 * spread — in a way a label cannot. Decorative, so it carries an empty `alt`
 * and the surrounding copy stays the accessible description.
 *
 * `hand.png` is a cut-out, so the styling lives in `.hand-shot` (aura, pearl
 * shine, rim light, blush veil) rather than in a border: a frame drawn around
 * mostly transparent pixels would read as an empty box.
 */
function HandShot() {
  return (
    <span className="hand-shot">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={HAND_SHOT_URL} alt="" width={1207} height={559} />
      <span className="hand-shot__tint" />
    </span>
  );
}

/**
 * Step 2 of the client funnel: a clear, well-lit photo of the hand.
 * Mobile browsers get the native camera through `capture="environment"`; desktop
 * users get drag-and-drop plus a file picker.
 */
export function HandPhotoUpload({ value, onChange, onLocalPreview, disabled = false }: HandPhotoUploadProps) {
  const { t } = useLocale();
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File) => {
      setError(null);

      if (!ACCEPTED.includes(file.type)) {
        setError(t.client.wrongFormat);
        return;
      }
      if (file.size > MAX_BYTES) {
        setError(t.client.tooLarge);
        return;
      }

      onLocalPreview?.(URL.createObjectURL(file));
      setIsUploading(true);

      try {
        const body = new FormData();
        body.append("file", file);

        const response = await fetch("/api/hand-photo", { method: "POST", body });
        const payload = (await response.json()) as { url?: string; error?: { message?: string } };

        if (!response.ok || !payload.url) {
          throw new Error(payload.error?.message ?? t.client.uploadFailed);
        }
        onChange(payload.url);
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : t.client.uploadFailed);
      } finally {
        setIsUploading(false);
      }
    },
    [onChange, onLocalPreview, t],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (file) void upload(file);
    },
    [upload],
  );

  return (
    <section aria-labelledby={`${inputId}-heading`} className="space-y-4">
      <header>
        <h2 id={`${inputId}-heading`} className="text-lg font-semibold">
          {t.client.stepOneTitle}
        </h2>
        <p className="mt-1 text-sm text-white/60">{t.client.stepOneBody}</p>
      </header>

      {value ? (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={t.client.yourUploadAlt}
            className="h-64 w-full rounded-2xl border border-white/10 object-cover"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={disabled || isUploading}
              className="flex-1 rounded-xl border border-white/15 px-4 py-3 text-sm font-medium disabled:opacity-50"
            >
              {t.client.retakePhoto}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isUploading}
              className="flex-1 rounded-xl border border-white/15 px-4 py-3 text-sm font-medium disabled:opacity-50"
            >
              {t.client.chooseAnother}
            </button>
          </div>
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
            handleFiles(event.dataTransfer.files);
          }}
          className={`dropzone rounded-2xl border-2 border-dashed p-8 text-center transition ${
            isDragging ? "border-blush-400 bg-blush-500/10" : "border-white/15"
          }`}
        >
          <HandShot />
          <p className="mt-3 font-medium">{t.client.dropHere}</p>
          <p className="mt-1 text-sm text-white/60">{t.client.photoHint}</p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={disabled || isUploading}
              className="rounded-xl bg-blush-500 px-5 py-3 text-sm font-semibold text-ink-950 disabled:opacity-50"
            >
              {isUploading ? t.client.uploadingPhoto : t.client.takePhoto}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isUploading}
              className="rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold disabled:opacity-50"
            >
              {t.client.chooseFromLibrary}
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        accept={ACCEPTED.join(",")}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => handleFiles(event.target.files)}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        capture="environment"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => handleFiles(event.target.files)}
      />

      {isUploading ? (
        <p role="status" className="text-sm text-white/60">{t.client.uploadingPhoto}</p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-lg bg-blush-500/15 px-3 py-2 text-sm text-blush-300">
          {error}
        </p>
      ) : null}
    </section>
  );
}
