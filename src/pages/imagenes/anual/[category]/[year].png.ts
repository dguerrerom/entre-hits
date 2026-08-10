import type { APIRoute, GetStaticPaths } from "astro";
import { annualCharts, categorySlugs, songsById, type AnnualChart, type Category } from "../../../../lib/charts";
import { renderChartImage } from "../../../../lib/chart-image";

export const prerender = true;

export const getStaticPaths = (() =>
  annualCharts.map((annual) => ({
    params: { category: categorySlugs[annual.category], year: String(annual.year) },
    props: { annual },
  }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const annual = props.annual as AnnualChart;
  const category = annual.category as Category;
  const entries = annual.entries.map((entry) => {
    const song = songsById.get(entry.songId)!;
    return { rank: entry.rank, title: song.title, artists: song.artists };
  });
  const image = renderChartImage({
    variant: "annual",
    category,
    entries,
    year: annual.year,
  });
  return new Response(Uint8Array.from(image), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `inline; filename="entre-hits-anual-${annual.year}-${categorySlugs[category]}.png"`,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
