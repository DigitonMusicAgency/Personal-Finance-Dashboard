"use client";

export interface PeriodFilter {
  key: string;
  label: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function getDefaultPeriods(): PeriodFilter[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  const prevMonth = month === 0 ? 11 : month - 1;
  const prevMonthYear = month === 0 ? year - 1 : year;

  return [
    {
      key: "this-month",
      label: "Tento m\u011bs\u00edc",
      startDate: formatDate(new Date(year, month, 1)),
      endDate: formatDate(new Date(year, month, lastDayOfMonth(year, month))),
    },
    {
      key: "last-month",
      label: "Minul\u00fd m\u011bs\u00edc",
      startDate: formatDate(new Date(prevMonthYear, prevMonth, 1)),
      endDate: formatDate(
        new Date(prevMonthYear, prevMonth, lastDayOfMonth(prevMonthYear, prevMonth))
      ),
    },
    {
      key: "this-year",
      label: "Tento rok",
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    },
    {
      key: "last-year",
      label: "Minul\u00fd rok",
      startDate: `${year - 1}-01-01`,
      endDate: `${year - 1}-12-31`,
    },
    {
      key: "last-90-days",
      label: "Posledn\u00edch 90 dn\u016f",
      startDate: formatDate(
        new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90)
      ),
      endDate: formatDate(now),
    },
    {
      key: "all",
      label: "V\u0161e",
      startDate: "2020-01-01",
      endDate: "2099-12-31",
    },
  ];
}

export function getDefaultPeriod(): PeriodFilter {
  return getDefaultPeriods()[0];
}

interface PeriodFilterProps {
  value: PeriodFilter;
  onChange: (filter: PeriodFilter) => void;
}

export default function PeriodFilterBar({ value, onChange }: PeriodFilterProps) {
  const periods = getDefaultPeriods();

  return (
    <div className="flex flex-wrap gap-1">
      {periods.map((period) => {
        const isActive = period.key === value.key;
        return (
          <button
            key={period.key}
            type="button"
            onClick={() => onChange(period)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
            }`}
          >
            {period.label}
          </button>
        );
      })}
    </div>
  );
}
