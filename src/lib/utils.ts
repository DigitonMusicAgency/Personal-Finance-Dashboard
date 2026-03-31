import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format amount in Czech style: 1 234,56
 */
export function formatAmount(amount: number): string {
  return new Intl.NumberFormat("cs-CZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format amount with currency: 1 234,56 Kč
 */
export function formatCurrency(amount: number, currency: string = "CZK"): string {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format date in Czech style: 15. 3. 2024
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(date);
}

/**
 * Format short date: 15. 3.
 */
export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
  }).format(date);
}

/**
 * Format percentage with sign: +12 % or -5 %
 */
export function formatPercentChange(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${Math.round(value)} %`;
}

/**
 * Get CSS class for amount coloring
 */
export function getAmountColorClass(amount: number): string {
  if (amount > 0) return "text-emerald-400";
  if (amount < 0) return "text-red-400";
  return "text-zinc-400";
}
