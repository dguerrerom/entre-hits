#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(projectRoot, "src", "data");
const contentDir = join(projectRoot, "content");
const rowContextKey = Symbol("rowContext");
const weeklyColumns = ["date", "number", "category", "rank", "songId"];
const annualColumns = ["year", "category", "rank", "songId"];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function cleanWhitespace(value) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCsv(source, filename, expectedHeaders) {
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
  if (expectedHeaders) {
    assert(JSON.stringify(headers) === JSON.stringify(expectedHeaders), `${filename}: expected CSV headers ${expectedHeaders.join(", ")}`);
  }
  return rows.slice(1).map((values, rowIndex) => {
    assert(values.length === headers.length, `${filename}:${rowIndex + 2}: expected ${headers.length} fields, found ${values.length}`);
    const parsed = Object.fromEntries(headers.map((header, index) => [header, cleanWhitespace(values[index])]));
    Object.defineProperty(parsed, rowContextKey, { value: `${filename}:${rowIndex + 2}` });
    return parsed;
  });
}

function sourcePath(filename) {
  return relative(projectRoot, filename).replaceAll("\\", "/");
}

function sourceEntries(directory) {
  assert(existsSync(directory), `${sourcePath(directory)}: source directory is required`);
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith("."))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function rowContext(row) {
  return row[rowContextKey] ?? "CSV row";
}

function readCsvFile(filename, expectedHeaders) {
  return existsSync(filename) ? parseCsv(readFileSync(filename, "utf8"), sourcePath(filename), expectedHeaders) : [];
}

function csvCategory(value, context = "CSV") {
  assert(["national", "international"].includes(value), `${context}: unknown category ${JSON.stringify(value)}`);
  return value;
}

function integer(value, context) {
  assert(/^[1-9]\d*$/.test(value), `${context}: expected a positive integer, found ${JSON.stringify(value)}`);
  return Number(value);
}

function sundayDate(value, context) {
  assert(/^\d{4}-\d{2}-\d{2}$/.test(value), `${context}: date must use YYYY-MM-DD`);
  const date = new Date(`${value}T12:00:00Z`);
  assert(!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value, `${context}: invalid calendar date ${value}`);
  assert(date.getUTCDay() === 0, `${context}: date must be Sunday`);
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
  const directory = join(contentDir, "weekly");
  const editions = [];
  const seenIds = new Set();
  const seenDates = new Set();

  for (const yearEntry of sourceEntries(directory)) {
    const yearContext = sourcePath(join(directory, yearEntry.name));
    assert(yearEntry.isDirectory() && /^\d{4}$/.test(yearEntry.name), `${yearContext}: weekly sources must use YYYY directories`);
    const directoryYear = Number(yearEntry.name);
    const yearDirectory = join(directory, yearEntry.name);
    const files = sourceEntries(yearDirectory);
    assert(files.length > 0, `${yearContext}: weekly year directory cannot be empty`);

    for (const fileEntry of files) {
      const filename = join(yearDirectory, fileEntry.name);
      const fileContext = sourcePath(filename);
      const match = /^(\d{4}-\d{2}-\d{2})-(\d{2})\.csv$/.exec(fileEntry.name);
      assert(fileEntry.isFile() && match, `${fileContext}: weekly filename must use YYYY-MM-DD-NN.csv`);
      const [, date, numberText] = match;
      const year = integer(date.slice(0, 4), `${fileContext} year`);
      const number = Number(numberText);
      assert(number > 0, `${fileContext}: weekly number must be greater than zero`);
      const id = `${year}-${numberText}`;
      assert(year === directoryYear, `${fileContext}: filename year must match its directory`);
      sundayDate(date, fileContext);
      assert(!seenIds.has(id), `${fileContext}: duplicate weekly edition ${id}`);
      assert(!seenDates.has(date), `${fileContext}: duplicate weekly date ${date}`);

      const rows = readCsvFile(filename, weeklyColumns);
      assert(rows.length === 20, `${fileContext}: weekly edition must contain exactly 20 rows`);
      const edition = { id, year, number, date, charts: { national: [], international: [] } };
      const chartSongIds = { national: new Set(), international: new Set() };

      for (const row of rows) {
        const context = rowContext(row);
        assert(weeklyColumns.every((column) => row[column]), `${context}: weekly row requires ${weeklyColumns.join(", ")}`);
        assert(row.date === date, `${context}: date must match filename date ${date}`);
        assert(integer(row.number, `${context} number`) === number, `${context}: number must match filename number ${number}`);
        assert(songs.has(row.songId), `${context}: unknown songId ${row.songId}`);
        const category = csvCategory(row.category, context);
        assert(!chartSongIds[category].has(row.songId), `${context}: duplicate song ${row.songId} in ${category}`);
        chartSongIds[category].add(row.songId);
        const rank = integer(row.rank, `${context} rank`);
        assert(rank === edition.charts[category].length + 1, `${context}: ${category} rows must be ordered by rank`);
        edition.charts[category].push({ rank, songId: row.songId });
      }

      for (const category of ["national", "international"]) {
        assert(edition.charts[category].length === 10, `${fileContext}: ${category} chart must contain exactly 10 songs`);
      }

      seenIds.add(id);
      seenDates.add(date);
      editions.push(edition);
    }
  }
  return editions;
}

function readAnnualCharts(songs) {
  const directory = join(contentDir, "annual");
  const charts = [];

  for (const fileEntry of sourceEntries(directory)) {
    const filename = join(directory, fileEntry.name);
    const fileContext = sourcePath(filename);
    const match = /^(\d{4})\.csv$/.exec(fileEntry.name);
    assert(fileEntry.isFile() && match, `${fileContext}: annual filename must use YYYY.csv`);
    const year = Number(match[1]);
    const rows = readCsvFile(filename, annualColumns);
    assert(rows.length === 40, `${fileContext}: annual closing must contain exactly 40 rows`);
    const entries = { national: [], international: [] };
    const chartSongIds = { national: new Set(), international: new Set() };

    for (const row of rows) {
      const context = rowContext(row);
      assert(annualColumns.every((column) => row[column]), `${context}: annual row requires ${annualColumns.join(", ")}`);
      assert(integer(row.year, `${context} year`) === year, `${context}: year must match filename year ${year}`);
      assert(songs.has(row.songId), `${context}: unknown songId ${row.songId}`);
      const category = csvCategory(row.category, context);
      assert(!chartSongIds[category].has(row.songId), `${context}: duplicate song ${row.songId} in ${category}`);
      chartSongIds[category].add(row.songId);
      const rank = integer(row.rank, `${context} rank`);
      assert(rank === entries[category].length + 1, `${context}: ${category} rows must be ordered by rank`);
      entries[category].push({ rank, songId: row.songId });
    }

    for (const category of ["international", "national"]) {
      assert(entries[category].length === 20, `${fileContext}: ${category} closing must contain exactly 20 songs`);
      charts.push({ id: `${year}-${category}`, year, category, entries: entries[category] });
    }
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
    2026: Array.from({ length: 31 }, (_, index) => index + 1),
  };
  assert(weeklyEditions.length >= 95, `Expected at least 95 weekly editions, found ${weeklyEditions.length}`);
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
      assert(JSON.stringify(actual.slice(0, numbers.length)) === JSON.stringify(numbers), `${yearText}: unexpected initial edition numbers ${actual.join(", ")}`);
      assert(actual.every((number, index) => number === index + 1), `${yearText}: edition numbers must be consecutive`);
    } else {
      assert(JSON.stringify(actual) === JSON.stringify(numbers), `${yearText}: unexpected edition numbers ${actual.join(", ")}`);
    }
  }

  const weeklyYears = [...new Set(weeklyEditions.map((edition) => edition.year))].sort((left, right) => left - right);
  weeklyYears.forEach((year, index) => {
    assert(year === 2024 + index, `Weekly years must be consecutive from 2024, found ${weeklyYears.join(", ")}`);
    if (!Object.hasOwn(expectedNumbers, year)) {
      const actual = weeklyEditions.filter((edition) => edition.year === year).map((edition) => edition.number);
      assert(actual.every((number, numberIndex) => number === numberIndex + 1), `${year}: edition numbers must start at 1 and be consecutive`);
    }
  });

  for (const requiredYear of [2024, 2025]) {
    for (const category of ["national", "international"]) {
      assert(annualCharts.some((chart) => chart.id === `${requiredYear}-${category}`), `Missing published annual chart ${requiredYear}-${category}`);
    }
  }

  for (const edition of weeklyEditions) {
    sundayDate(edition.date, edition.id);
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

  const unaCosita = songs.find((song) => song.id === "unacosita-458b24d76d");
  assert(JSON.stringify(unaCosita?.authors) === JSON.stringify(["Carlos de Jesús Coronado Chirino", "Roberto Johayron Amores Rodríguez"]), "Una cosita authors are incorrect");

  const importedAuthorCredits = new Map([
    ["elwhatsapp-7a05174f95", ["Arian Chacón Hernández", "Sujer Salim Zaldívar", "Elio Revé Duverger", "Drayoan Linares Cervantes"]],
    ["temporal-566773360c", ["Efraín David Fines Nevares", "Álvaro Lenier Mesa Basulto", "Carlos Efrén Reyes Rosado"]],
    ["unclasico-b17f0c89df", ["Leoni Torres", "Mauro Silvino Bertran", "Bobby Sierra"]],
  ]);
  for (const [songId, authors] of importedAuthorCredits) {
    assert(JSON.stringify(songs.find((song) => song.id === songId)?.authors) === JSON.stringify(authors), `${songId}: imported authors are incorrect`);
  }

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
  assert(songsWithAuthors >= 152, `Expected at least 152 author credits, found ${songsWithAuthors}`);

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
