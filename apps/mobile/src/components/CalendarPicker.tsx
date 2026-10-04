import { useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { alpha, palette, radii, spacing, type } from "../theme";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type CalendarPickerProps = {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  daysAhead?: number;
};

function toISODate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function shadow(color: string, opacity: number, radius: number, offsetY: number) {
  const boxShadow = `0 0 ${radius}px ${color}${opacity < 1 ? ` ${opacity}` : ""}`;
  if (Platform.OS === "android") {
    return { elevation: Math.round(radius / 2), shadowColor: color } as const;
  }
  if (Platform.OS === "web") {
    return { boxShadow } as const;
  }
  return {
    shadowColor: color,
    shadowOpacity: opacity,
    shadowRadius: radius,
    shadowOffset: { width: 0, height: offsetY },
  } as const;
}

export function CalendarPicker({ selectedDate, onSelectDate, daysAhead = 14 }: CalendarPickerProps) {
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
    return viewMonth.toLocaleString("default", { month: "long", year: "numeric" });
  }, [viewMonth]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            const prev = new Date(viewMonth);
            prev.setMonth(prev.getMonth() - 1);
            setViewMonth(prev);
          }}
          disabled={!canGoBack}
          style={[styles.navButton, !canGoBack && styles.navButtonDisabled]}
        >
          <Text style={[styles.navButtonText, !canGoBack && styles.navButtonTextDisabled]}>‹</Text>
        </Pressable>

        <Text style={styles.monthLabel}>{monthLabel}</Text>

        <Pressable
          onPress={() => {
            const next = new Date(viewMonth);
            next.setMonth(next.getMonth() + 1);
            setViewMonth(next);
          }}
          disabled={!canGoForward}
          style={[styles.navButton, !canGoForward && styles.navButtonDisabled]}
        >
          <Text style={[styles.navButtonText, !canGoForward && styles.navButtonTextDisabled]}>›</Text>
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label) => (
          <Text key={label} style={styles.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>

      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.weekRow}>
          {week.map((date) => {
            const isCurrentMonth = date.getMonth() === viewMonth.getMonth();
            const isToday = toISODate(date) === toISODate(today);
            const isSelected = toISODate(date) === selectedDate;
            const isDisabled = date < today || date > maxDate;

            return (
              <Pressable
                key={date.toISOString()}
                onPress={() => {
                  if (!isDisabled) {
                    onSelectDate(toISODate(date));
                  }
                }}
                disabled={isDisabled}
                style={[
                  styles.dayCell,
                  isSelected && styles.dayCellSelected,
                  isDisabled && styles.dayCellDisabled,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    !isCurrentMonth && styles.dayTextOutside,
                    isToday && styles.dayTextToday,
                    isSelected && styles.dayTextSelected,
                    isDisabled && styles.dayTextDisabled,
                  ]}
                >
                  {date.getDate()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: alpha(palette.ink900, 0.7),
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: alpha(palette.blush, 0.12),
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  navButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    backgroundColor: alpha(palette.pearl, 0.08),
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  navButtonText: {
    color: palette.pearl,
    fontSize: 20,
    fontWeight: "600",
  },
  navButtonTextDisabled: {
    color: palette.ash,
  },
  monthLabel: {
    ...type.display,
    color: palette.pearl,
    fontSize: 18,
    textTransform: "capitalize",
  },
  weekdayRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: spacing.xs,
  },
  weekdayLabel: {
    ...type.body,
    color: palette.ash,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    width: 32,
    textAlign: "center",
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    gap: spacing.xs,
  },
  dayCell: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    backgroundColor: "transparent",
  },
  dayCellSelected: {
    backgroundColor: palette.rose,
    ...shadow(palette.rose, 0.35, 10, 0),
  },
  dayCellDisabled: {
    opacity: 0.3,
  },
  dayText: {
    ...type.body,
    color: palette.pearl,
    fontSize: 14,
  },
  dayTextOutside: {
    color: palette.ashDim,
  },
  dayTextToday: {
    fontWeight: "700",
    color: palette.mint,
  },
  dayTextSelected: {
    color: palette.ink900,
    fontWeight: "700",
  },
  dayTextDisabled: {
    color: palette.ashDim,
  },
});
