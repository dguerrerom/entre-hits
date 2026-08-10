import type { APIRoute, GetStaticPaths } from "astro";
import { categories, categorySlugs, songsById, weeklyEditions, type Category, type WeeklyEdition } from "../../../../lib/charts";
import { renderChartImage } from "../../../../lib/chart-image";

export const prerender = true;

export const getStaticPaths = (() =>
  weeklyEditions.flatMap((edition) =>
    categories.map((category) => ({
      params: { category: categorySlugs[category], date: edition.date },
      props: { category, edition },
    })),
  )) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const category = props.category as Category;
  const edition = props.edition as WeeklyEdition;
  const entries = edition.charts[category].map((entry) => {
    const song = songsById.get(entry.songId)!;
    return { rank: entry.rank, title: song.title, artists: song.artists };
  });
  const image = renderChartImage({
    variant: "weekly",
    category,
    entries,
    number: edition.number,
    date: edition.date,
  });
  return new Response(Uint8Array.from(image), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `inline; filename="entre-hits-${edition.date}-${categorySlugs[category]}.png"`,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
