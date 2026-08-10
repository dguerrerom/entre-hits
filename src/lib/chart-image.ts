import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import type { Category } from "./charts";

interface ImageEntry {
  rank: number;
  title: string;
  artists: string;
}

interface ImageOptions {
  variant: "weekly" | "annual";
  category: Category;
  entries: ImageEntry[];
  number?: number;
  date?: string;
  year?: number;
}

const regularFont = resolve(process.cwd(), "fonts/FiraSans-Regular.ttf");
const boldFont = resolve(process.cwd(), "fonts/FiraSans-Bold.ttf");
const blackFont = resolve(process.cwd(), "fonts/FiraSans-Black.ttf");
const logo = readFileSync(resolve(process.cwd(), "public/brand/entre-mezclas.png")).toString("base64");

const palette = {
  national: { accent: "#538135", soft: "#E2EFD9", label: "NACIONAL" },
  international: { accent: "#0070C0", soft: "#DEEAF6", label: "INTERNACIONAL" },
} as const;

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function shorten(value: string, length: number) {
  if (value.length <= length) return value;
  return `${value.slice(0, Math.max(0, length - 1)).trim()}…`;
}

function spanishDate(date: string) {
  return new Intl.DateTimeFormat("es-CU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

export function renderChartImage(options: ImageOptions) {
  const { variant, category, entries, number, date, year } = options;
  const theme = palette[category];
  const annual = variant === "annual";
  const width = 1080;
  const height = annual ? 1920 : 1350;
  const rowHeight = annual ? 77 : 96;
  const rowsTop = annual ? 248 : 242;
  const titleLimit = annual ? 48 : 46;
  const artistLimit = annual ? 68 : 66;
  const heading = annual ? `TOP 20 ${theme.label}` : `LISTA #${number} ${theme.label}`;
  const issue = annual ? `CIERRE ANUAL ${year}` : spanishDate(date!);

  const rows = entries.map((entry, index) => {
    const y = rowsTop + index * rowHeight;
    return `
      <g transform="translate(0 ${y})">
        <rect x="60" y="0" width="960" height="${rowHeight}" fill="${index % 2 ? "#FFFFFF" : "#FAFAF8"}"/>
        <line x1="60" y1="${rowHeight}" x2="1020" y2="${rowHeight}" stroke="#171717" stroke-width="1"/>
        <circle cx="101" cy="${rowHeight / 2}" r="27" fill="#FFFFFF" stroke="#171717" stroke-width="2"/>
        <text x="101" y="${rowHeight / 2 + 10}" text-anchor="middle" font-size="27" font-weight="700">${entry.rank}</text>
        <rect x="148" y="${annual ? 17 : 20}" width="5" height="${annual ? 43 : 54}" fill="${theme.accent}"/>
        <text x="176" y="${annual ? 36 : 43}" fill="${theme.accent}" font-size="${annual ? 25 : 29}" font-weight="700">${escapeXml(shorten(entry.title, titleLimit))}</text>
        <text x="176" y="${annual ? 62 : 76}" fill="#171717" font-size="${annual ? 19 : 22}">${escapeXml(shorten(entry.artists, artistLimit))}</text>
      </g>`;
  }).join("");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" fill="#F3F3F0"/>
      <rect x="60" y="46" width="960" height="166" fill="#FFFFFF" stroke="#171717" stroke-width="2"/>
      <rect x="60" y="46" width="16" height="166" fill="${theme.accent}"/>
      <image href="data:image/png;base64,${logo}" x="94" y="68" width="122" height="122" preserveAspectRatio="xMidYMid meet"/>
      <text x="248" y="108" fill="#171717" font-size="55" font-weight="900" letter-spacing="-2">ENTRE HITS</text>
      <text x="248" y="157" fill="${theme.accent}" font-size="34" font-weight="700">${heading}</text>
      <text x="248" y="188" fill="#555555" font-size="19">${escapeXml(issue)}</text>
      <rect x="60" y="212" width="960" height="30" fill="${theme.soft}"/>
      <text x="90" y="234" fill="${theme.accent}" font-size="15" font-weight="700">POSICIÓN</text>
      <text x="176" y="234" fill="${theme.accent}" font-size="15" font-weight="700">CANCIÓN / ARTISTA</text>
      ${rows}
      <text x="60" y="${height - 38}" fill="#555555" font-size="16">Entre Mezclas · Radio Holguín La Nueva</text>
      <text x="1020" y="${height - 38}" text-anchor="end" fill="#171717" font-size="16" font-weight="700">ENTRE HITS</text>
    </svg>`;

  const renderer = new Resvg(svg, {
    fitTo: { mode: "original" },
    font: {
      fontFiles: [regularFont, boldFont, blackFont],
      loadSystemFonts: false,
      defaultFontFamily: "Fira Sans",
    },
  });
  return renderer.render().asPng();
}
