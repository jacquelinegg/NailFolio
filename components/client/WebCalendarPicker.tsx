"use client";

import { useMemo, useState } from "react";

import { useLocale } from "@/lib/i18n/LocaleProvider";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type WebCalendarPickerProps = {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  daysAhead?: number;
};

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function WebCalendarPicker({ selectedDate, onSelectDate, daysAhead = 30 }: WebCalendarPickerProps) {
  const { locale } = useLocale();
  const [viewMonth, setViewMonth] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });

  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  const maxDate = useMemo(() => addDays(today, daysAhead), [today, daysAhead]);

  const days = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startOffset = (firstDay.getDay() + 6) % 7;

    const days: Date[] = [];

    for (let i = 0; i < startOffset; i++) {
      days.push(addDays(firstDay, -startOffset + i));
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day));
    }

    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        days.push(addDays(lastDay, i));
      }
    }

    return days;
  }, [viewMonth]);

  const weeks = useMemo(() => {
    const result: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7));
    }
    return result;
  }, [days]);

  const canGoBack = useMemo(() => {
    const minDate = new Date(today);
    minDate.setDate(minDate.getDate() - 1);
    return viewMonth > minDate;
  }, [today, viewMonth]);

  const canGoForward = useMemo(() => {
    const maxMonth = new Date(maxDate);
    maxMonth.setDate(maxMonth.getDate() + 1);
    return viewMonth < maxMonth;
  }, [maxDate, viewMonth]);

  const monthLabel = useMemo(() => {
    return viewMonth.toLocaleString(locale === "bg" ? "bg-BG" : "en-US", { month: "long", year: "numeric" });
  }, [viewMonth, locale]);

  const weekdayLabels = useMemo(() => {
    const labels = WEEKDAY_LABELS;
    if (locale === "bg") {
      return ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
    }
    return labels;
  }, [locale]);

  return (
    <div className="rounded-2xl border border-white/10 bg-ink-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            const prev = new Date(viewMonth);
            prev.setMonth(prev.getMonth() - 1);
            setViewMonth(prev);
          }}
          disabled={!canGoBack}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/80 disabled:opacity-30"
        >
          ‹
        </button>

        <span className="text-base font-semibold capitalize text-white">{monthLabel}</span>

        <button
          type="button"
          onClick={() => {
            const next = new Date(viewMonth);
            next.setMonth(next.getMonth() + 1);
            setViewMonth(next);
          }}
          disabled={!canGoForward}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/80 disabled:opacity-30"
        >
          ›
        </button>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1">
        {weekdayLabels.map((label) => (
          <div key={label} className="text-center text-xs font-semibold uppercase tracking-wide text-white/50">
            {label}
          </div>
        ))}
      </div>

      {weeks.map((week, weekIndex) => (
        <div key={weekIndex} className="mb-1 grid grid-cols-7 gap-1">
          {week.map((date) => {
            const isCurrentMonth = date.getMonth() === viewMonth.getMonth();
            const isToday = toISODate(date) === toISODate(today);
            const isSelected = toISODate(date) === selectedDate;
            const isDisabled = date < today || date > maxDate;

            return (
              <button
                key={date.toISOString()}
                type="button"
                onClick={() => {
                  if (!isDisabled) {
                    onSelectDate(toISODate(date));
                  }
                }}
                disabled={isDisabled}
                className={`
                  flex h-10 w-10 items-center justify-center rounded-full text-sm
                  ${isSelected ? "bg-blush-400 font-bold text-ink-900" : ""}
                  ${!isSelected && !isDisabled ? "text-white hover:bg-white/10" : ""}
                  ${isDisabled ? "cursor-not-allowed text-white/20" : ""}
                  ${!isCurrentMonth ? "text-white/30" : ""}
                  ${isToday && !isSelected ? "font-bold text-mint" : ""}
                `}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
