"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useDynamicTranslation } from "@/components/client/useDynamicTranslation";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { PriceEstimate, SessionStatusView } from "@/lib/types";

export interface StatusTrackerProps {
  token: string;
  /** Poll interval in ms. Realtime pushes are reserved for the artist app (RLS). */
  pollIntervalMs?: number;
}

const POLL_INTERVAL_MS = 3_000;

/** Bulgarian readers see the BGN form, everyone else the USD form. */
const CURRENCY_BY_LOCALE = { bg: "BGN", en: "USD" } as const;

function currency(amount: number, locale: "bg" | "en"): string {
  return new Intl.NumberFormat(locale === "bg" ? "bg-BG" : "en-US", {
    style: "currency",
    currency: CURRENCY_BY_LOCALE[locale],
  }).format(amount);
}

function formatSlot(iso: string | null, locale: "bg" | "en"): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(locale === "bg" ? "bg-BG" : "en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Emoji per status; the words themselves come from the catalogue. */
const EMOJI: Record<SessionStatusView["status"], string> = {
  pending: "⏳",
  confirmed: "✅",
  counter_offer: "🔄",
  rejected: "❌",
};

function lineItems(estimate: PriceEstimate | null, total: number | null) {
  const items = estimate?.lineItems ?? [];
  const fallbackTotal = estimate?.total ?? total ?? 0;
  return { items, fallbackTotal };
}

/**
 * Live booking status. The client holds only a token, and `sessions` is RLS-locked
 * to the owning artist, so this page polls the server-side proxy (service role)
 * instead of subscribing to Realtime directly. Poll interval is 3s and pauses
 * while the tab is hidden.
 */
export function StatusTracker({ token, pollIntervalMs = POLL_INTERVAL_MS }: StatusTrackerProps) {
  const { t, locale } = useLocale();
  const [session, setSession] = useState<SessionStatusView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isResponding, setIsResponding] = useState(false);
  const hasSettled = useRef(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/sessions/${token}`, { cache: "no-store" });
      const payload = (await response.json()) as { session?: SessionStatusView; error?: { message?: string } };

      if (!response.ok || !payload.session) {
        setError(payload.error?.message ?? t.client.loadFailed);
        return;
      }
      setSession(payload.session);
      setError(null);
      hasSettled.current = payload.session.status !== "pending";
    } catch {
      setError(t.client.connectionLost);
    }
  }, [token, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (hasSettled.current || document.hidden) return;
      void load();
    }, pollIntervalMs);
    return () => clearInterval(timer);
  }, [load, pollIntervalMs]);

  const respond = useCallback(
    async (action: "accept_counter" | "decline_counter") => {
      setIsResponding(true);
      try {
        const response = await fetch(`/api/sessions/${token}/respond`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const payload = (await response.json()) as { session?: SessionStatusView; error?: { message?: string } };
        if (!response.ok || !payload.session) {
          throw new Error(payload.error?.message ?? t.common.error);
        }
        setSession(payload.session);
      } catch (respondError) {
        setError(respondError instanceof Error ? respondError.message : t.common.error);
      } finally {
        setIsResponding(false);
      }
    },
    [token, t],
  );

  const { items, fallbackTotal } = lineItems(session?.priceEstimate ?? null, session?.estimatedPrice ?? null);
  // Both the price breakdown and the artist's note are written by a person or a
  // model in English, so they are translated at runtime rather than from a catalogue.
  const lineLabels = useDynamicTranslation(items.map((item) => item.label));
  const artistNote = useDynamicTranslation(session?.artistNotes ? [session.artistNotes] : []);

  if (error && !session) {
    return (
      <main className="mx-auto max-w-lg px-5 py-24 text-center">
        <p role="alert" className="text-sm text-blush-300">
          {error}
        </p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="mx-auto max-w-lg px-5 py-24 text-center">
        <p role="status" className="text-sm text-white/60">{t.client.loadingBooking}</p>
      </main>
    );
  }

  const headline = {
    pending: { title: t.client.statusPendingTitle, body: t.client.statusPendingBody },
    confirmed: { title: t.client.statusConfirmedTitle, body: t.client.statusConfirmedBody },
    counter_offer: { title: t.client.statusCounterTitle, body: t.client.statusCounterBody },
    rejected: { title: t.client.statusRejectedTitle, body: t.client.statusRejectedBody },
  }[session.status];
  const activePrice = session.counterPrice ?? session.estimatedPrice ?? fallbackTotal;
  const activeSlot = session.counterAppointmentTime ?? session.requestedAppointmentTime;

  return (
    <main className="mx-auto max-w-lg space-y-6 px-5 pt-12 pb-24">
      <section className="rounded-2xl border border-white/10 bg-ink-900 p-6 text-center">
        <p className="text-5xl" aria-hidden="true">
          {EMOJI[session.status]}
        </p>
        <h1 className="mt-3 text-xl font-semibold">{headline.title}</h1>
        <p className="mt-2 text-sm text-white/60">{headline.body}</p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-ink-900 p-5">
        <h2 className="text-sm font-semibold text-white/80">{t.client.yourAppointment}</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-white/60">
              {session.counterPrice ? t.client.newPrice : t.client.estimatedTotal}
            </dt>
            <dd className="tabular-nums">{currency(activePrice, locale)}</dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-white/60">
              {session.counterAppointmentTime ? t.client.newTime : t.client.requestedTime}
            </dt>
            <dd className="text-right">{formatSlot(activeSlot, locale)}</dd>
          </div>
          {session.estimatedDurationMins ? (
            <div className="flex items-center justify-between">
              <dt className="text-white/60">{t.client.duration}</dt>
              <dd>
                {session.estimatedDurationMins} {t.client.unitMins}
              </dd>
            </div>
          ) : null}
        </dl>

        {items.length > 0 ? (
          <ul className="mt-4 space-y-1 border-t border-white/10 pt-3">
            {items.map((item, index) => (
              <li key={item.label} className="flex items-center justify-between text-xs text-white/60">
                <span>{lineLabels[index] ?? item.label}</span>
                <span className="tabular-nums">{currency(item.amount, locale)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {session.renderedResultUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={session.renderedResultUrl}
          alt={t.client.afterLabel}
          className="h-72 w-full rounded-2xl border border-white/10 object-cover"
        />
      ) : null}

      {session.artistNotes ? (
        <p className="rounded-2xl border border-white/10 bg-ink-900 p-4 text-sm text-white/80">
          <span className="font-semibold text-white/60">{t.client.artistNote}</span>{" "}
          {artistNote[0] ?? session.artistNotes}
        </p>
      ) : null}

      {session.status === "counter_offer" ? (
        <section className="space-y-3 rounded-2xl border border-blush-400/40 bg-blush-500/10 p-5">
          <p className="text-sm text-white/80">
            {session.counterPrice
              ? `${t.client.newTotal} ${currency(session.counterPrice, locale)}`
              : t.client.newTimeProposed}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void respond("accept_counter")}
              disabled={isResponding}
              className="flex-1 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-ink-950 disabled:opacity-50"
            >
              {t.client.acceptCounter}
            </button>
            <button
              type="button"
              onClick={() => void respond("decline_counter")}
              disabled={isResponding}
              className="rounded-xl border border-white/20 px-4 py-3 text-sm font-semibold disabled:opacity-50"
            >
              {t.client.declineCounter}
            </button>
          </div>
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="text-center text-sm text-blush-300">
          {error}
        </p>
      ) : null}

      <p className="text-center text-xs text-white/40">
        {t.client.keepLink} {token.slice(0, 8)}…
      </p>
    </main>
  );
}
