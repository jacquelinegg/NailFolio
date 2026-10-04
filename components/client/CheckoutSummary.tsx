"use client";

import { useMemo, useState } from "react";

import { useDynamicTranslation } from "@/components/client/useDynamicTranslation";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { WebCalendarPicker } from "@/components/client/WebCalendarPicker";
import type { ArtistAwareDesign } from "@/lib/types";

export interface CheckoutSummaryProps {
  artistId: string;
  design: ArtistAwareDesign | null;
  handPhotoUrl: string | null;
  renderedUrl?: string | null;
  onBooked: (token: string) => void;
}

const DAYS_AHEAD = 30;

/**
 * How much notice an artist needs before a slot.
 */
const MIN_LEAD_MINUTES = 60;

/** Bulgarian readers see the BGN form, everyone else the USD form. */
const CURRENCY_BY_LOCALE = { bg: "BGN", en: "USD" } as const;

function currency(amount: number, locale: "bg" | "en"): string {
  return new Intl.NumberFormat(locale === "bg" ? "bg-BG" : "en-US", {
    style: "currency",
    currency: CURRENCY_BY_LOCALE[locale],
  }).format(amount);
}

function duration(mins: number): string {
  if (mins < 60) return `${mins} mins`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} mins`;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function slotTime(date: Date, hour: number, minute: number): Date {
  const slot = new Date(date);
  slot.setHours(hour, minute, 0, 0);
  return slot;
}

function isoLocal(date: Date, hour: number, minute: number): string {
  return slotTime(date, hour, minute).toISOString();
}

export function CheckoutSummary({
  artistId,
  design,
  handPhotoUrl,
  renderedUrl,
  onBooked,
}: CheckoutSummaryProps) {
  const { t, locale } = useLocale();
  const days = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: DAYS_AHEAD }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() + index);
      return date;
    });
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(days[0]?.toISOString() ?? "");
  const [selectedHour, setSelectedHour] = useState<string>("09");
  const [selectedMinute, setSelectedMinute] = useState<string>("00");
  const [timeError, setTimeError] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedHour = useMemo(
    () => Math.max(0, Math.min(23, Number(selectedHour) || 0)),
    [selectedHour],
  );
  const normalizedMinute = useMemo(
    () => Math.max(0, Math.min(59, Number(selectedMinute) || 0)),
    [selectedMinute],
  );

  const availableHours = useMemo(() => {
    const earliest = Date.now() + MIN_LEAD_MINUTES * 60_000;
    const slot = slotTime(new Date(selectedDate), normalizedHour, normalizedMinute);
    return slot.getTime() >= earliest;
  }, [selectedDate, normalizedHour, normalizedMinute]);

  const estimate = design?.estimate ?? null;
  const canSubmit = Boolean(
    design && handPhotoUrl && selectedDate && availableHours && clientName.trim() && clientPhone.trim(),
  );

  function sanitizeTime(value: string, max: number, label: "hour" | "minute"): string {
    const numeric = value.replace(/[^0-9]/g, "").slice(0, 2);
    const parsed = Number(numeric);
    if (numeric && (parsed > max || (label === "hour" && numeric.length === 2 && parsed < 0))) {
      setTimeError(label === "hour" ? "Hours must be 00-23" : "Minutes must be 00-59");
      return numeric.slice(0, 1);
    }
    setTimeError(null);
    return numeric;
  }

  // Price line labels come from the AI, so they are translated at runtime.
  const lineLabels = useDynamicTranslation(estimate ? estimate.lineItems.map((item) => item.label) : []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!design || !handPhotoUrl || !selectedDate) return;

    const hour = Math.max(0, Math.min(23, Number(selectedHour) || 0));
    const minute = Math.max(0, Math.min(59, Number(selectedMinute) || 0));

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistId,
          clientHandImageUrl: handPhotoUrl,
          renderedResultUrl: renderedUrl ?? null,
          generatedPrompt: design.prompt,
          priceEstimate: design.estimate,
          usedTags: design.usedTags,
          complexity: design.complexity,
          selectedLookId: design.sourceLookId ?? null,
          requestedAppointmentTime: isoLocal(new Date(selectedDate), hour, minute),
          clientName,
          clientPhone,
          clientEmail: clientEmail.trim() || null,
        }),
      });

      const payload = (await response.json()) as { token?: string; error?: { message?: string } };
      if (!response.ok || !payload.token) {
        throw new Error(payload.error?.message ?? t.client.bookingFailed);
      }

      onBooked(payload.token);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t.client.bookingFailed);
      setIsSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="checkout-heading" className="space-y-5">
      <header>
        <h2 id="checkout-heading" className="text-lg font-semibold">
          {t.client.stepFourTitle}
        </h2>
        <p className="mt-1 text-sm text-white/60">{t.client.stepFourBody}</p>
      </header>

      <div className="rounded-2xl border border-white/10 bg-ink-900 p-4">
        <h3 className="text-sm font-semibold text-white/80">{t.client.estimatedPrice}</h3>
        {estimate ? (
          <>
            <ul className="mt-3 space-y-2">
              {estimate.lineItems.map((item, index) => (
                <li key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-white/80">{lineLabels[index] ?? item.label}</span>
                  <span className="tabular-nums text-white">{currency(item.amount, locale)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
              <span className="font-semibold">{t.client.total}</span>
              <span className="text-lg font-semibold tabular-nums">{currency(estimate.total, locale)}</span>
            </div>
            <p className="mt-1 text-right text-xs text-white/50">
              {t.client.estimatedDuration}: {duration(estimate.durationMins)}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-white/50">{t.client.generateForPrice}</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <span className="text-sm font-medium">{t.client.pickDay}</span>
          <div className="mt-2">
            <WebCalendarPicker selectedDate={selectedDate} onSelectDate={setSelectedDate} daysAhead={30} />
          </div>
        </div>

        <div>
          <span className="text-sm font-medium">{t.client.pickTime}</span>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="23"
              value={selectedHour}
              onChange={(event) => setSelectedHour(sanitizeTime(event.target.value, 23, "hour"))}
              className="w-16 rounded-xl border border-white/10 bg-ink-800 px-3 py-3 text-center text-base font-semibold"
              placeholder="09"
            />
            <span className="text-lg font-semibold text-white/60">:</span>
            <input
              type="number"
              min="0"
              max="59"
              value={selectedMinute}
              onChange={(event) => setSelectedMinute(sanitizeTime(event.target.value, 59, "minute"))}
              className="w-16 rounded-xl border border-white/10 bg-ink-800 px-3 py-3 text-center text-base font-semibold"
              placeholder="00"
            />
          </div>
          {timeError ? (
            <p className="mt-2 text-sm text-white/50">{timeError}</p>
          ) : !availableHours ? (
            <p className="mt-2 text-sm text-white/50">{t.client.noSlotsToday}</p>
          ) : null}
        </div>

        <div className="space-y-3">
          <label className="block text-sm">
            <span className="font-medium">{t.client.yourName}</span>
            <input
              value={clientName}
              onChange={(event) => setClientName(event.target.value)}
              required
              maxLength={120}
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-3"
              placeholder="Alex Rivera"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">{t.client.phone}</span>
            <input
              value={clientPhone}
              onChange={(event) => setClientPhone(event.target.value)}
              required
              inputMode="tel"
              maxLength={32}
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-3"
              placeholder="+1 555 010 2024"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">{t.client.emailOptional}</span>
            <input
              value={clientEmail}
              onChange={(event) => setClientEmail(event.target.value)}
              type="email"
              maxLength={320}
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-3"
              placeholder="alex@example.com"
            />
          </label>
        </div>

        {error ? (
          <p role="alert" className="rounded-xl bg-blush-500/15 px-3 py-2 text-sm text-blush-300">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit || isSubmitting}
          className="w-full rounded-2xl bg-white px-5 py-4 text-base font-semibold text-ink-950 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSubmitting ? t.client.sending : t.client.submitBooking}
        </button>
        {!design ? <p className="text-center text-xs text-white/50">{t.client.needsDesign}</p> : null}
      </form>
    </section>
  );
}
