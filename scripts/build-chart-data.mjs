#!/usr/bin/env node

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
  assert(headers.every(Boolean), `${filename}: CSV headers cannot be empty`);
  assert(new Set(headers).size === headers.length, `${filename}: duplicate CSV headers`);
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

function csvCategory(value) {
  assert(["national", "international"].includes(value), `Unknown CSV category: ${JSON.stringify(value)}`);
  return value;
}

function integer(value, context) {
  assert(/^\d+$/.test(value), `${context}: expected a positive integer, found ${JSON.stringify(value)}`);
  return Number(value);
}

function list(value, context, required = false) {
  if (!value) {
    assert(!required, `${context}: list is required`);
    return [];
  }
  const values = value.split(";").map(cleanWhitespace);
  assert(values.every(Boolean), `${context}: list contains an empty item`);
  assert(new Set(values).size === values.length, `${context}: list contains duplicates`);
  return values;
}

function optionalUrl(value, context) {
  if (!value) return;
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${context}: invalid URL ${JSON.stringify(value)}`);
  }
  assert(url.protocol === "https:", `${context}: URL must use HTTPS`);
}

function readSongCatalog() {
  const filename = join(contentDir, "songs", "catalog.csv");
  const rows = readCsvFile(filename);
  const requiredColumns = [
    "id", "sourceTitle", "baseTitle", "displayTitle", "language", "primaryArtists", "featuredArtists", "remixers",
    "versionType", "versionName", "versionStatus", "sourceName", "sourceUrl",
  ];
  const songs = new Map();

  for (const [index, row] of rows.entries()) {
    const context = `${filename}:${index + 2}`;
    assert(requiredColumns.every((column) => Object.hasOwn(row, column)), `${context}: catalog requires ${requiredColumns.join(", ")}`);
    assert(/^[a-z0-9]+-[a-f0-9]{10}$/.test(row.id), `${context}: invalid song ID ${JSON.stringify(row.id)}`);
    assert(!songs.has(row.id), `${context}: duplicate song ID ${row.id}`);
    for (const field of ["sourceTitle", "baseTitle", "displayTitle", "language", "primaryArtists"]) {
      assert(row[field], `${context}: ${field} is required`);
    }
    assert(["es", "en", "pt", "multilingual"].includes(row.language), `${context}: unsupported language ${JSON.stringify(row.language)}`);
    assert(!row.versionType || ["remix", "version"].includes(row.versionType), `${context}: unsupported versionType ${JSON.stringify(row.versionType)}`);
    assert(!row.versionName || row.versionType, `${context}: versionName requires versionType`);
    assert(!row.versionStatus || row.versionType, `${context}: versionStatus requires versionType`);
    assert(!row.versionStatus || ["independent"].includes(row.versionStatus), `${context}: unsupported versionStatus ${JSON.stringify(row.versionStatus)}`);
    assert(!row.remixers || row.versionType === "remix", `${context}: remixers require versionType remix`);
    assert(!row.sourceUrl || row.sourceName, `${context}: sourceUrl requires sourceName`);
    assert(!/\b(?:feat(?:uring)?|ft)\.?\b/i.test(row.displayTitle), `${context}: displayTitle must express featured artists through featuredArtists`);
    optionalUrl(row.sourceUrl, `${context} sourceUrl`);

    const song = {
      id: row.id,
      sourceTitle: row.sourceTitle,
      baseTitle: row.baseTitle,
      title: row.displayTitle,
      language: row.language,
      primaryArtists: list(row.primaryArtists, `${context} primaryArtists`, true),
    };
    for (const field of ["featuredArtists", "remixers"]) {
      const values = list(row[field], `${context} ${field}`);
      if (values.length) song[field] = values;
    }
    for (const field of ["versionType", "versionName", "versionStatus", "sourceName", "sourceUrl"]) {
      if (row[field]) song[field] = row[field];
    }
    songs.set(song.id, song);
  }

  return songs;
}

function addMetadata(songs) {
  const filename = join(contentDir, "songs", "metadata.csv");
  const seen = new Set();
  for (const [index, row] of readCsvFile(filename).entries()) {
    const context = `${filename}:${index + 2}`;
    assert(Object.hasOwn(row, "songId") && Object.hasOwn(row, "authors") && Object.hasOwn(row, "youtube") && Object.hasOwn(row, "spotify"), `${context}: metadata requires songId, authors, youtube and spotify`);
    assert(row.songId && songs.has(row.songId), `${context}: unknown songId ${JSON.stringify(row.songId)}`);
    assert(!seen.has(row.songId), `${context}: duplicate metadata for ${row.songId}`);
    const song = songs.get(row.songId);
    const authors = list(row.authors, `${context} authors`);
    if (authors.length) song.authors = authors;
    for (const field of ["youtube", "spotify"]) {
      optionalUrl(row[field], `${context} ${field}`);
      if (row[field]) song[field] = row[field];
    }
    assert(authors.length || row.youtube || row.spotify, `${context}: metadata requires authors, youtube or spotify`);
    seen.add(row.songId);
  }
}

function readWeeklyEditions(songs) {
  const rows = readCsvDirectory(join(contentDir, "weekly"));
  const grouped = new Map();

  for (const row of rows) {
    assert(row.date && row.number && row.category && row.rank && row.songId, "Weekly CSV requires date, number, category, rank and songId");
    assert(songs.has(row.songId), `Weekly CSV references unknown songId ${row.songId}`);
    const year = integer(row.date.slice(0, 4), `${row.date} year`);
    const number = integer(row.number, `${row.date} number`);
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
    edition.charts[category].push({ rank: integer(row.rank, `${row.date} rank`), songId: row.songId });
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

function readAnnualCharts(songs) {
  const rows = readCsvDirectory(join(contentDir, "annual"));
  const grouped = new Map();

  for (const row of rows) {
    assert(row.year && row.category && row.rank && row.songId, "Annual CSV requires year, category, rank and songId");
    assert(songs.has(row.songId), `Annual CSV references unknown songId ${row.songId}`);
    const year = integer(row.year, `${row.year} year`);
    const category = csvCategory(row.category);
    const id = `${year}-${category}`;
    if (!grouped.has(id)) grouped.set(id, { id, year, category, entries: [] });
    grouped.get(id).entries.push({ rank: integer(row.rank, `${id} rank`), songId: row.songId });
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

  const forbiddenKeys = new Set(["valor", "bonus", "total", "score", "artists"]);
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
  const sonrieleId = "sonriele-dc3a5895ca";
  const sonriele = songs.find((song) => song.id === sonrieleId);
  assert(sonriele?.primaryArtists.length === 1 && sonriele.primaryArtists[0] === "Daddy Yankee", "Sonríele must be credited to Daddy Yankee");
  const sonrieleEntries = weeklyEditions.flatMap((edition) => edition.charts.international
    .filter((entry) => entry.songId === sonrieleId)
    .map((entry) => ({ ...entry, date: edition.date })));
  assert(sonrieleEntries.length === 6, `Sonríele must have six weekly appearances, found ${sonrieleEntries.length}`);
  assert(sonrieleEntries.at(-1)?.date === "2026-01-18" && sonrieleEntries.at(-1)?.movement === -6, "Sonríele must move from #4 to #10 on the next published chart");

  const fortnight = songs.find((song) => song.id === "fortnightcyrilremix-227943921e");
  assert(fortnight?.sourceTitle === "Taylor Swift - Fortnight (Feat. Post Malone) (CYRIL REMIX)", "Fortnight must preserve its source title");
  assert(fortnight?.title === "Fortnight (remezcla de CYRIL)" && fortnight.baseTitle === "Fortnight", "Fortnight must use its Spanish editorial display title");
  assert(JSON.stringify(fortnight?.primaryArtists) === JSON.stringify(["Taylor Swift"]), "Fortnight must keep Taylor Swift as its primary artist");
  assert(JSON.stringify(fortnight?.featuredArtists) === JSON.stringify(["Post Malone"]), "Fortnight must credit Post Malone as featured artist");
  assert(JSON.stringify(fortnight?.remixers) === JSON.stringify(["CYRIL"]), "Fortnight must credit CYRIL as remixer");
  assert(JSON.stringify(fortnight?.authors) === JSON.stringify(["Taylor Swift", "Jack Antonoff", "Austin Post"]), "Fortnight authors are incorrect");
  assert(fortnight?.versionType === "remix" && fortnight.versionStatus === "independent", "Fortnight must remain an independent remix");
  assert(fortnight?.sourceName === "SoundCloud" && fortnight.sourceUrl === "https://soundcloud.com/cyrilriley/taylor-swift-fortnight-feat-post-malone-cyril-remix", "Fortnight source is incorrect");

  const versionTitles = new Map([
    ["cualquierasalsaversion-35bbdc0b45", "Cualquiera (versión salsa)"],
    ["holaperdidaremix-955c118019", "Hola perdida (remezcla)"],
    ["silencioremix-df7b7a94c2", "Silencio (remezcla)"],
    ["tedigoadioscumbia-7a0cc06fea", "Te digo adiós (versión cumbia)"],
  ]);
  for (const [songId, title] of versionTitles) {
    assert(songs.find((song) => song.id === songId)?.title === title, `${songId}: incorrect Spanish version title`);
  }
}

function writeJson(filename, value) {
  writeFileSync(join(outputDir, filename), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function main() {
  const catalog = readSongCatalog();
  addMetadata(catalog);
  const weeklyEditions = readWeeklyEditions(catalog);
  deriveWeeklyFields(weeklyEditions);
  const annualCharts = readAnnualCharts(catalog);
  const songs = [...catalog.values()].sort((left, right) => left.id.localeCompare(right.id));
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
