export function localDate(timezone = "Asia/Tehran", now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function addDays(date: string, days: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function faDate(date: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    ...options,
  }).format(new Date(date + "T12:00:00Z"));
}
export const number = (value: number) =>
  new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 }).format(value);
export const unitLabel: Record<string, string> = {
  g: "گرم",
  kg: "کیلوگرم",
  ml: "میلی‌لیتر",
  l: "لیتر",
  count: "عدد",
  pack: "بسته",
};
