import annualData from "../data/annual-charts.json";
import songData from "../data/songs.json";
import weeklyData from "../data/weekly-editions.json";

export const categories = ["national", "international"] as const;
export type Category = (typeof categories)[number];
export type Movement = number | "N" | "R";

export interface Song {
  id: string;
  title: string;
  artists: string;
  authors?: string;
  youtube?: string;
  spotify?: string;
}

export interface WeeklyEntry {
  rank: number;
  songId: string;
  movement: Movement;
  weeks: number;
}

export interface WeeklyEdition {
  id: string;
  year: number;
  number: number;
  date: string;
  charts: Record<Category, WeeklyEntry[]>;
}

export interface AnnualChart {
  id: string;
  year: number;
  category: Category;
  entries: Array<{ rank: number; songId: string }>;
}

export const songs = songData as Song[];
export const weeklyEditions = weeklyData as WeeklyEdition[];
export const annualCharts = annualData as AnnualChart[];
export const songsById = new Map(songs.map((song) => [song.id, song]));

export const categoryLabels: Record<Category, string> = {
  national: "Nacional",
  international: "Internacional",
};

export const categorySlugs: Record<Category, string> = {
  national: "nacional",
  international: "internacional",
};

export const slugCategories: Record<string, Category> = {
  nacional: "national",
  internacional: "international",
};

export const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function formatDate(date: string, options: Intl.DateTimeFormatOptions = {}) {
  const value = new Date(`${date}T12:00:00Z`);
  return new Intl.DateTimeFormat("es-CU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
    ...options,
  }).format(value);
}

export function weeklyPath(category: Category, date?: string) {
  const suffix = date ? `/${date}` : "";
  return `${basePath}/semanal/${categorySlugs[category]}${suffix}/`;
}

export function annualPath(category: Category, year?: number) {
  const suffix = year ? `/${year}` : "";
  return `${basePath}/anual/${categorySlugs[category]}${suffix}/`;
}

export function imagePath(
  variant: "semanal" | "anual",
  category: Category,
  key: string | number,
) {
  return `${basePath}/imagenes/${variant}/${categorySlugs[category]}/${key}.png`;
}

export function getEdition(date: string) {
  return weeklyEditions.find((edition) => edition.date === date);
}

export function getAdjacentEditions(date: string) {
  const index = weeklyEditions.findIndex((edition) => edition.date === date);
  return {
    previous: index > 0 ? weeklyEditions[index - 1] : undefined,
    next: index >= 0 && index < weeklyEditions.length - 1 ? weeklyEditions[index + 1] : undefined,
  };
}

export function getLatestPublishedEdition(reference = new Date()) {
  const cubaParts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    timeZone: "America/Havana",
  }).formatToParts(reference);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    cubaParts.find((entry) => entry.type === type)?.value ?? "";
  const cubaDate = `${part("year")}-${part("month")}-${part("day")}`;
  const weekday = part("weekday");
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  const value = new Date(`${cubaDate}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - Math.max(weekdayIndex, 0));
  const weekStart = value.toISOString().slice(0, 10);
  return [...weeklyEditions].reverse().find((edition) => edition.date <= weekStart) ?? weeklyEditions[0];
}

export function movementText(movement: Movement) {
  if (movement === "N") return "Nueva entrada";
  if (movement === "R") return "Reingreso";
  if (movement > 0) return `Sube ${movement} ${movement === 1 ? "posición" : "posiciones"}`;
  if (movement < 0) {
    const amount = Math.abs(movement);
    return `Baja ${amount} ${amount === 1 ? "posición" : "posiciones"}`;
  }
  return "Se mantiene";
}
