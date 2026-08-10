#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(projectRoot, "src", "data");
const contentDir = join(projectRoot, "content");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function cleanWhitespace(value) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCsv(source, filename) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error(`${filename}: unclosed quoted CSV field`);
  row.push(field);
  if (row.some((value) => value !== "")) rows.push(row);
  if (!rows.length) return [];

  const headers = rows[0].map(cleanWhitespace);
  return rows.slice(1).map((values, rowIndex) => {
    assert(values.length === headers.length, `${filename}:${rowIndex + 2}: expected ${headers.length} fields, found ${values.length}`);
    return Object.fromEntries(headers.map((header, index) => [header, cleanWhitespace(values[index])]));
  });
}

function readCsvDirectory(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((filename) => filename.endsWith(".csv") && !filename.startsWith("_"))
    .sort()
    .flatMap((filename) => parseCsv(readFileSync(join(directory, filename), "utf8"), filename));
}

function readCsvFile(filename) {
  return existsSync(filename) ? parseCsv(readFileSync(filename, "utf8"), filename) : [];
}

function identityPart(value) {
  return cleanWhitespace(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[‘’]/g, "'")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, "");
}

function csvCategory(value) {
  const category = identityPart(value);
  if (category === "national" || category === "nacional") return "national";
  if (category === "international" || category === "internacional") return "international";
  throw new Error(`Unknown CSV category: ${JSON.stringify(value)}`);
}

function normalizeTitle(title) {
  const cleaned = cleanWhitespace(title);
  return /^Amante\s+El Bandolero$/i.test(cleaned) ? "Amante" : cleaned;
}

function normalizeArtists(artists) {
  return cleanWhitespace(artists)
    .replace(/\s*,\s*/g, " & ")
    .replace(/\s*&\s*/g, " & ");
}

function artistIdentity(artists) {
  return cleanWhitespace(artists)
    .split(/\s*(?:&|,|\by\b)\s*/iu)
    .map(identityPart)
    .filter(Boolean)
    .join("+");
}

function songIdentity(title, artists) {
  return `${identityPart(normalizeTitle(title))}|${artistIdentity(artists)}`;
}

function songId(identity, title) {
  const slug = identityPart(title).slice(0, 36) || "song";
  const hash = createHash("sha256").update(identity).digest("hex").slice(0, 10);
  return `${slug}-${hash}`;
}

class SongCatalog {
  #songs = new Map();
  #aliases = new Map();

  constructor(aliasRows) {
    for (const row of aliasRows) {
      assert(row.aliasTitle && row.aliasArtists && row.title && row.artists, "Song alias CSV requires aliasTitle, aliasArtists, title and artists");
      const aliasIdentity = songIdentity(row.aliasTitle, row.aliasArtists);
      const canonical = {
        title: normalizeTitle(row.title),
        artists: normalizeArtists(row.artists),
      };
      assert(aliasIdentity !== songIdentity(canonical.title, canonical.artists), `Redundant song alias for ${row.aliasTitle} / ${row.aliasArtists}`);
      assert(!this.#aliases.has(aliasIdentity), `Duplicate song alias for ${row.aliasTitle} / ${row.aliasArtists}`);
      this.#aliases.set(aliasIdentity, canonical);
    }
    for (const canonical of this.#aliases.values()) {
      assert(!this.#aliases.has(songIdentity(canonical.title, canonical.artists)), `Song alias target must be canonical: ${canonical.title} / ${canonical.artists}`);
    }
  }

  register(title, artists, authoritative = false) {
    const sourceTitle = normalizeTitle(title);
    const sourceArtists = normalizeArtists(artists);
    const canonical = this.#aliases.get(songIdentity(sourceTitle, sourceArtists));
    const normalizedTitle = canonical?.title ?? sourceTitle;
    const normalizedArtists = canonical?.artists ?? sourceArtists;
    const identity = songIdentity(normalizedTitle, normalizedArtists);
    let song = this.#songs.get(identity);

    if (!song) {
      song = {
        id: songId(identity, normalizedTitle),
        title: normalizedTitle,
        artists: normalizedArtists,
        identity,
      };
      this.#songs.set(identity, song);
    } else if (authoritative) {
      song.title = normalizedTitle;
      song.artists = normalizedArtists;
    }

    return song;
  }

  addMetadata(rows) {
    for (const row of rows) {
      assert(row.title && row.artists, "Song metadata CSV requires title and artists");
      const song = this.register(row.title, row.artists, true);
      for (const key of ["authors", "youtube", "spotify"]) {
        if (row[key]) song[key] = row[key];
      }
    }
  }

  output() {
    return [...this.#songs.values()]
      .map(({ identity: _identity, ...song }) => song)
      .sort((left, right) => left.id.localeCompare(right.id));
  }
}

function readWeeklyEditions(catalog) {
  const rows = readCsvDirectory(join(contentDir, "weekly"));
  const grouped = new Map();

  for (const row of rows) {
    assert(row.date && row.number && row.category && row.rank && row.artists && row.title, "Weekly CSV requires date, number, category, rank, artists and title");
    const year = Number(row.date.slice(0, 4));
    const number = Number(row.number);
    const id = `${year}-${String(number).padStart(2, "0")}`;
    const category = csvCategory(row.category);

    if (!grouped.has(id)) {
      grouped.set(id, {
        id,
        year,
        number,
        date: row.date,
        charts: { national: [], international: [] },
      });
    }

    const edition = grouped.get(id);
    assert(edition.date === row.date, `${id}: inconsistent dates in weekly CSV`);
    edition.charts[category].push({
      rank: Number(row.rank),
      songId: catalog.register(row.title, row.artists, true).id,
    });
  }

  const editions = [...grouped.values()];
  for (const edition of editions) {
    for (const category of ["national", "international"]) {
      edition.charts[category].sort((left, right) => left.rank - right.rank);
      assert(edition.charts[category].length === 10, `${edition.date} ${category}: weekly CSV requires 10 songs`);
      edition.charts[category].forEach((entry, index) => {
        assert(entry.rank === index + 1, `${edition.date} ${category}: ranks must be 1-10`);
      });
    }
  }

  return editions;
}

function readAnnualCharts(catalog) {
  const rows = readCsvDirectory(join(contentDir, "annual"));
  const grouped = new Map();

  for (const row of rows) {
    assert(row.year && row.category && row.rank && row.artists && row.title, "Annual CSV requires year, category, rank, artists and title");
    const year = Number(row.year);
    const category = csvCategory(row.category);
    const id = `${year}-${category}`;
    if (!grouped.has(id)) grouped.set(id, { id, year, category, entries: [] });
    grouped.get(id).entries.push({
      rank: Number(row.rank),
      songId: catalog.register(row.title, row.artists, true).id,
    });
  }

  const charts = [...grouped.values()];
  for (const chart of charts) {
    chart.entries.sort((left, right) => left.rank - right.rank);
    assert(chart.entries.length === 20, `${chart.id}: annual CSV requires 20 songs`);
    chart.entries.forEach((entry, index) => {
      assert(entry.rank === index + 1, `${chart.id}: ranks must be 1-20`);
    });
  }

  return charts;
}

function deriveWeeklyFields(editions) {
  editions.sort((left, right) => left.date.localeCompare(right.date));
  const seen = { national: new Set(), international: new Set() };
  const previous = { national: new Map(), international: new Map() };
  const appearances = new Map();

  for (const edition of editions) {
    for (const category of ["national", "international"]) {
      const current = new Map();
      for (const entry of edition.charts[category]) {
        const priorRank = previous[category].get(entry.songId);
        entry.movement = priorRank === undefined
          ? seen[category].has(entry.songId) ? "R" : "N"
          : priorRank - entry.rank;

        const appearancesKey = `${edition.year}|${category}|${entry.songId}`;
        entry.weeks = (appearances.get(appearancesKey) ?? 0) + 1;
        appearances.set(appearancesKey, entry.weeks);
        current.set(entry.songId, entry.rank);
        seen[category].add(entry.songId);
      }
      previous[category] = current;
    }
  }
}

function validate({ weeklyEditions, annualCharts, songs }) {
  const expectedNumbers = {
    2024: [...Array.from({ length: 20 }, (_, index) => index + 1), ...Array.from({ length: 18 }, (_, index) => index + 23)],
    2025: Array.from({ length: 26 }, (_, index) => index + 1),
    2026: Array.from({ length: 30 }, (_, index) => index + 1),
  };
  assert(weeklyEditions.length >= 94, `Expected at least 94 weekly editions, found ${weeklyEditions.length}`);
  assert(annualCharts.length >= 4, `Expected at least 4 annual charts, found ${annualCharts.length}`);

  const songIds = new Set(songs.map((song) => song.id));
  assert(songIds.size === songs.length, "Catalog contains duplicate song IDs");
  const seen = { national: new Set(), international: new Set() };
  const previous = { national: new Map(), international: new Map() };
  const appearances = new Map();

  for (const [yearText, numbers] of Object.entries(expectedNumbers)) {
    const actual = weeklyEditions
      .filter((edition) => edition.year === Number(yearText))
      .map((edition) => edition.number);
    if (yearText === "2026") {
      assert(JSON.stringify(actual.slice(0, 30)) === JSON.stringify(numbers), `${yearText}: unexpected initial edition numbers ${actual.join(", ")}`);
      assert(actual.every((number, index) => index === 0 || number > actual[index - 1]), `${yearText}: edition numbers must increase`);
    } else {
      assert(JSON.stringify(actual) === JSON.stringify(numbers), `${yearText}: unexpected edition numbers ${actual.join(", ")}`);
    }
  }

  for (const edition of weeklyEditions) {
    assert(/^\d{4}-\d{2}-\d{2}$/.test(edition.date), `${edition.id}: invalid date`);
    assert(new Date(`${edition.date}T12:00:00Z`).getUTCDay() === 0, `${edition.id}: date must be Sunday`);
    assert(edition.id === `${edition.year}-${String(edition.number).padStart(2, "0")}`, `${edition.id}: invalid ID`);

    for (const category of ["national", "international"]) {
      const entries = edition.charts[category];
      assert(entries?.length === 10, `${edition.id} ${category}: expected 10 ranks`);
      const current = new Map();

      entries.forEach((entry, index) => {
        assert(entry.rank === index + 1, `${edition.id} ${category}: ranks must be 1-10`);
        assert(songIds.has(entry.songId), `${edition.id}: missing catalog song ${entry.songId}`);
        assert(!current.has(entry.songId), `${edition.id} ${category}: duplicate song ${entry.songId}`);
        const priorRank = previous[category].get(entry.songId);
        const expectedMovement = priorRank === undefined
          ? seen[category].has(entry.songId) ? "R" : "N"
          : priorRank - entry.rank;
        assert(entry.movement === expectedMovement, `${edition.id} ${category} #${entry.rank}: incorrect movement`);
        const key = `${edition.year}|${category}|${entry.songId}`;
        const expectedWeeks = (appearances.get(key) ?? 0) + 1;
        assert(entry.weeks === expectedWeeks, `${edition.id} ${category} #${entry.rank}: incorrect weeks`);
        appearances.set(key, expectedWeeks);
        current.set(entry.songId, entry.rank);
        seen[category].add(entry.songId);
      });
      previous[category] = current;
    }
  }

  for (const chart of annualCharts) {
    assert(chart.year >= 2024, `${chart.id}: unsupported annual year`);
    assert(["national", "international"].includes(chart.category), `${chart.id}: invalid category`);
    assert(chart.entries.length === 20, `${chart.id}: expected 20 ranks`);
    const chartSongIds = new Set();
    chart.entries.forEach((entry, index) => {
      assert(entry.rank === index + 1, `${chart.id}: ranks must be 1-20`);
      assert(songIds.has(entry.songId), `${chart.id}: missing catalog song ${entry.songId}`);
      assert(!chartSongIds.has(entry.songId), `${chart.id}: duplicate song ${entry.songId}`);
      chartSongIds.add(entry.songId);
    });
  }

  const forbiddenKeys = new Set(["valor", "bonus", "total", "score"]);
  function checkKeys(value) {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      assert(!forbiddenKeys.has(key.toLocaleLowerCase("es")), `Build output retains forbidden key ${key}`);
      checkKeys(child);
    }
  }
  checkKeys({ weeklyEditions, annualCharts, songs });

  const first2026 = weeklyEditions.find((edition) => edition.id === "2026-01");
  assert(first2026?.date === "2026-01-18", "2026 #1 date correction was not preserved");
  const amante = songs.filter((song) => identityPart(song.title) === identityPart("Amante"));
  assert(amante.length >= 1 && amante.every((song) => song.title === "Amante"), "Amante title correction was not preserved");
  const sonriele = songs.filter((song) => identityPart(song.title) === identityPart("Sonríele"));
  assert(sonriele.length === 1 && sonriele[0].artists === "Daddy Yankee", "Sonríele alias was not resolved to Daddy Yankee");
  const returnEdition = weeklyEditions.find((edition) => edition.date === "2026-01-18");
  const returnEntry = returnEdition?.charts.international.find((entry) => entry.songId === sonriele[0].id);
  assert(returnEntry?.movement === -6, "Sonríele must move from #4 to #10 on the next published chart");
}

function writeJson(filename, value) {
  writeFileSync(join(outputDir, filename), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function main() {
  const catalog = new SongCatalog(readCsvFile(join(contentDir, "songs", "aliases.csv")));
  const weeklyEditions = readWeeklyEditions(catalog);
  deriveWeeklyFields(weeklyEditions);
  const annualCharts = readAnnualCharts(catalog);
  catalog.addMetadata(readCsvFile(join(contentDir, "songs", "metadata.csv")));
  const songs = catalog.output();
  const songsWithAuthors = songs.filter((song) => song.authors).length;

  validate({ weeklyEditions, annualCharts, songs });
  assert(songsWithAuthors >= 20, `Expected at least 20 author credits, found ${songsWithAuthors}`);

  mkdirSync(outputDir, { recursive: true });
  writeJson("weekly-editions.json", weeklyEditions);
  writeJson("annual-charts.json", annualCharts);
  writeJson("songs.json", songs);

  const yearCounts = Object.fromEntries(
    [2024, 2025, 2026].map((year) => [year, weeklyEditions.filter((edition) => edition.year === year).length]),
  );
  console.log(
    `Validated ${weeklyEditions.length} weekly editions (${Object.entries(yearCounts).map(([year, count]) => `${year}: ${count}`).join(", ")}), ${annualCharts.length} annual charts, ${songs.length} songs, and ${songsWithAuthors} author credits.`,
  );
}

main();
