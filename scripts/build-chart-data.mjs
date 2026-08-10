#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(projectRoot, "src", "data");
const contentDir = join(projectRoot, "content");

const workbookSources = [
  { year: 2024, file: "anual-24-ñ.xlsx" },
  { year: 2025, file: "anual-25.xlsx" },
  { year: 2026, file: "anual-26.xlsx" },
];

const manualEditions = [
  {
    year: 2026,
    number: 29,
    date: "2026-08-02",
    national: [
      ["El Chiquitico", "Orquesta Failde"],
      ["Tú Tienes Algo", "Indy Fontaine & Charlie Cruz"],
      ["Sin Ti", "Saudy & Lenier"],
      ["Si No Fuera Por Ti", "Leoni Torres"],
      ["Farándula", "Yuly y Havana C"],
      ["No He Podido Olvidarte", "Chacal & Yakarta"],
      ["Cualquiera (Salsa Version)", "Srta. Dayana"],
      ["Namore", "Saudy & Lenier"],
      ["Cumbia De Los Amigos", "Orquesta Failde & La Sonora Dinamita"],
      ["Cógelo Suave", "Leoni Torres & Javier Columbié"],
    ],
    international: [
      ["Te Hacen Falta Dos", "Manuel Turizo"],
      ["Dai Dai", "Shakira & Burna Boy"],
      ["Antes Que El Tiempo Se Vaya", "Fonseca & Juanes"],
      ["Dando Vueltas", "Rauw Alejandro"],
      ["Save Me Tonight", "Jennifer Lopez & David Guetta"],
      ["Love Pa Ti No Hay", "Fer Ariza & Nacho"],
      ["CHÉVERE", "ARIA VEGA & Ryan Castro"],
      ["Una Na Más", "Myke Towers"],
      ["Bring your love", "Madonna & Sabrina Carpenter"],
      ["Comenzar De Nuevo", "Nicky Jam"],
    ],
  },
  {
    year: 2026,
    number: 30,
    date: "2026-08-09",
    national: [
      ["El Chiquitico", "Orquesta Failde"],
      ["Tú Tienes Algo", "Indy Fontaine & Charlie Cruz"],
      ["Si No Fuera Por Ti", "Leoni Torres"],
      ["Sin Ti", "Saudy & Lenier"],
      ["No He Podido Olvidarte", "Chacal & Yakarta"],
      ["Farándula", "Yuly y Havana C"],
      ["Namore", "Saudy & Lenier"],
      ["Cógelo Suave", "Leoni Torres & Javier Columbié"],
      ["Cualquiera (Salsa Version)", "Srta. Dayana"],
      ["Cumbia De Los Amigos", "Orquesta Failde & La Sonora Dinamita"],
    ],
    international: [
      ["Te Hacen Falta Dos", "Manuel Turizo"],
      ["Antes Que El Tiempo Se Vaya", "Fonseca & Juanes"],
      ["Save Me Tonight", "Jennifer Lopez & David Guetta"],
      ["Dai Dai", "Shakira & Burna Boy"],
      ["CHÉVERE", "ARIA VEGA & Ryan Castro"],
      ["Dando Vueltas", "Rauw Alejandro"],
      ["Una Na Más", "Myke Towers"],
      ["Bring your love", "Madonna & Sabrina Carpenter"],
      ["Love Pa Ti No Hay", "Fer Ariza & Nacho"],
      ["Pa ti toa <3", "Ana Mena & Lola Índigo"],
    ],
  },
];

const annualOrders = [
  {
    year: 2024,
    category: "international",
    titles: [
      "Vocation",
      "Puntería",
      "Si Antes Te Hubiera Conocido",
      "Espresso",
      "CONTIGO",
      "Illusion",
      "Fortnight (CYRIL REMIX)",
      "Punta Cana",
      "LIFETIMES",
      "Beautiful Things",
      "Houdini",
      "yes, and?",
      "Ohnana",
      "Bonita",
      "Ale Ale",
      "LUNA",
      "Desire",
      "Sálvame",
      "Touching The Sky",
      "PLIS",
    ],
  },
  {
    year: 2024,
    category: "national",
    titles: [
      "Catalina",
      "Silencio (Remix)",
      "La Vida Es Buena",
      "No Te Instales",
      "El Amor Que Espere",
      "Una copia de mí",
      "Te Digo Adiós (Cumbia)",
      "Los Besos Que Te Di",
      "Fuera Fuera",
      "Modo Van Van",
      "El WhatsApp",
      "La Lámpara",
      { title: "Cu-Pr", artistHint: "Havana D' Primera" },
      { title: "Dile Al Amor", artistHint: "Charanga Latina" },
      { title: "La Vida Bailando", artistHint: "Wil Campa" },
      "La Persona Correcta",
      "Nunca Te Olvidaré",
      "Que viva el amor",
      "Salsa Kuduro",
      "Bla, Bla, Bla",
    ],
  },
  {
    year: 2025,
    category: "international",
    titles: [
      "Volver",
      "Cosas Pendientes",
      "APT.",
      "Abracadabra",
      "Señor Bendito",
      "¿Dónde Estabas?",
      "Papasito",
      "El Cielo",
      "CARITA TRISTE",
      "Soltera",
      "Qué Haces",
      "Me Muevo",
      "Bzrp Music Sessions, Vol. 61",
      "Pa’ Qué Volviste?",
      "No Tiene Sentido",
      "UWAIE",
      "En Privado",
      "LIFETIMES",
      "Die With A Smile",
      "Luna",
    ],
  },
  {
    year: 2025,
    category: "national",
    titles: [
      "Un Clásico",
      "Qué Hago",
      "Asi Como Yo",
      "Orgullo",
      "Por Tu Culpa",
      "Amante",
      "Todo El Mundo Bailando",
      "Que Te Vaya Bien",
      "Tacto Que Llegó El Reparto",
      "Ya Lo Ves",
      "Mañana Te Olvido",
      "Y Ojalá",
      "Bonita",
      "Nos Vamos",
      "Los Besos Que Te Di",
      "Pa' Toda La Vida",
      "Bailando Suave",
      "Catalina",
      "Morena",
      "No Volveré",
    ],
  },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function unzipText(file, member) {
  try {
    return execFileSync("unzip", ["-p", file, member], {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error("The migration requires the system `unzip` command.");
    }
    throw error;
  }
}

function decodeXml(value) {
  return value
    .replace(/_x([0-9A-Fa-f]{4})_/g, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function attributes(source) {
  return Object.fromEntries(
    [...source.matchAll(/([\w:-]+)="([^"]*)"/g)].map((match) => [
      match[1],
      decodeXml(match[2]),
    ]),
  );
}

function xmlText(source) {
  return [...source.matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g)]
    .map((match) => decodeXml(match[1]))
    .join("");
}

function readDataSheet(workbookPath) {
  const workbook = unzipText(workbookPath, "xl/workbook.xml");
  const sheetTag = [...workbook.matchAll(/<sheet\b([^>]*)\/?>(?:<\/sheet>)?/g)]
    .map((match) => attributes(match[1]))
    .find((sheet) => sheet.name === "Data");
  assert(sheetTag, `${workbookPath}: Data sheet not found`);

  const relationships = unzipText(workbookPath, "xl/_rels/workbook.xml.rels");
  const relationship = [
    ...relationships.matchAll(/<Relationship\b([^>]*)\/?>(?:<\/Relationship>)?/g),
  ]
    .map((match) => attributes(match[1]))
    .find((entry) => entry.Id === sheetTag["r:id"]);
  assert(relationship, `${workbookPath}: Data sheet relationship not found`);

  const target = relationship.Target.replace(/^\/?xl\//, "");
  const sheetXml = unzipText(workbookPath, `xl/${target}`);
  let sharedStrings = [];
  try {
    const stringsXml = unzipText(workbookPath, "xl/sharedStrings.xml");
    sharedStrings = [...stringsXml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(
      (match) => xmlText(match[1]),
    );
  } catch (error) {
    if (error.status !== 11) throw error;
  }

  const rows = [];
  for (const rowMatch of sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = {};
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const cellAttributes = attributes(cellMatch[1]);
      const column = cellAttributes.r?.match(/^[A-Z]+/)?.[0];
      if (!column) continue;
      const valueMatch = cellMatch[2].match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/);
      if (cellAttributes.t === "inlineStr") {
        row[column] = xmlText(cellMatch[2]);
      } else if (valueMatch) {
        const value = decodeXml(valueMatch[1]);
        row[column] = cellAttributes.t === "s" ? sharedStrings[Number(value)] : value;
      }
    }
    if (Object.keys(row).length) rows.push(row);
  }

  return rows;
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

function csvCategory(value) {
  const category = identityPart(value);
  if (category === "national" || category === "nacional") return "national";
  if (category === "international" || category === "internacional") return "international";
  throw new Error(`Unknown CSV category: ${JSON.stringify(value)}`);
}

function readWeeklyCsvEditions() {
  const rows = readCsvDirectory(join(contentDir, "weekly"));
  const grouped = new Map();
  for (const row of rows) {
    assert(row.date && row.number && row.category && row.rank && row.artists && row.title, "Weekly CSV requires date, number, category, rank, artists and title");
    const year = Number(row.date.slice(0, 4));
    const number = Number(row.number);
    const key = `${row.date}|${number}`;
    if (!grouped.has(key)) {
      grouped.set(key, { year, number, date: row.date, national: [], international: [] });
    }
    const category = csvCategory(row.category);
    grouped.get(key)[category].push({ rank: Number(row.rank), title: row.title, artists: row.artists });
  }
  return [...grouped.values()].map((edition) => {
    for (const category of ["national", "international"]) {
      edition[category].sort((left, right) => left.rank - right.rank);
      assert(edition[category].length === 10, `${edition.date} ${category}: weekly CSV requires 10 songs`);
      edition[category] = edition[category].map(({ rank, title, artists }, index) => {
        assert(rank === index + 1, `${edition.date} ${category}: ranks must be 1-10`);
        return [title, artists];
      });
    }
    return edition;
  });
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

function identityPart(value) {
  return cleanWhitespace(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[‘’]/g, "'")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, "");
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

function splitSong(value) {
  const cleaned = cleanWhitespace(value);
  const separator = cleaned.lastIndexOf(" - ");
  assert(separator > 0, `Cannot split artist and title: ${JSON.stringify(value)}`);
  return {
    artists: normalizeArtists(cleaned.slice(0, separator)),
    title: normalizeTitle(cleaned.slice(separator + 3)),
  };
}

function excelDate(value) {
  const raw = cleanWhitespace(value);
  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    const milliseconds = (Number(raw) - 25569) * 86400 * 1000;
    return new Date(milliseconds).toISOString().slice(0, 10);
  }
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  assert(match, `Unsupported date value: ${JSON.stringify(value)}`);
  return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

function categoryName(value) {
  const category = identityPart(value);
  if (category === "nacional") return "national";
  if (category === "internacional") return "international";
  throw new Error(`Unknown chart category: ${JSON.stringify(value)}`);
}

function parseWorkbook(source) {
  const workbookPath = join(projectRoot, source.file);
  const rows = readDataSheet(workbookPath);
  const header = rows[0];
  assert(
    header?.A === "Conteo" && header?.F === "Canción",
    `${source.file}: unexpected Data sheet columns`,
  );

  return rows.slice(1).filter((row) => row.A).map((row) => {
    const editionNumber = Number(row.A);
    const song = splitSong(row.F);
    let date = excelDate(row.B);
    if (source.year === 2026 && editionNumber === 1) date = "2026-01-18";
    return {
      sourceYear: source.year,
      editionNumber,
      date,
      category: categoryName(row.C),
      rank: Number(row.D),
      importedPreviousRank: Number(row.E),
      ...song,
    };
  });
}

function readDocxAuthors() {
  const docxPath = join(projectRoot, "25 - 5 de julio de 2026.docx");
  let documentXml;
  try {
    documentXml = unzipText(docxPath, "word/document.xml");
  } catch (error) {
    if (error.code === "ENOENT" || error.status === 9) return new Map();
    throw error;
  }

  const paragraphs = [...documentXml.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)]
    .map((match) => cleanWhitespace(xmlText(match[1])))
    .filter(Boolean);
  const authors = new Map();

  for (let index = 0; index < paragraphs.length - 1; index += 1) {
    const line = paragraphs[index];
    const separator = line.lastIndexOf("/");
    if (separator <= 0 || line === "Canción / Artista") continue;
    const title = normalizeTitle(line.slice(0, separator));
    const artists = normalizeArtists(line.slice(separator + 1));
    const author = paragraphs[index + 1];
    if (!title || !artists || !author || /^(?:[①-⑩]|\d+|N|R)$/u.test(author)) continue;
    authors.set(songIdentity(title, artists), author);
  }

  return authors;
}

class SongCatalog {
  #songs = new Map();

  register(title, artists, authoritative = false) {
    const normalizedTitle = normalizeTitle(title);
    const normalizedArtists = normalizeArtists(artists);
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

  addAuthors(authorMap) {
    for (const [identity, authors] of authorMap) {
      const song = this.#songs.get(identity);
      if (song) song.authors = authors;
    }
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

  values() {
    return [...this.#songs.values()];
  }

  output() {
    return this.values()
      .map(({ identity: _identity, ...song }) => song)
      .sort((left, right) => left.id.localeCompare(right.id));
  }
}

function groupSourceEditions(rows, catalog) {
  const editions = new Map();
  for (const row of rows) {
    const year = Number(row.date.slice(0, 4));
    assert(
      year === row.sourceYear,
      `Edition ${row.sourceYear} #${row.editionNumber} has date ${row.date}`,
    );
    const id = `${year}-${String(row.editionNumber).padStart(2, "0")}`;
    if (!editions.has(id)) {
      editions.set(id, {
        id,
        year,
        number: row.editionNumber,
        date: row.date,
        source: "xlsx",
        charts: { national: [], international: [] },
      });
    }
    const edition = editions.get(id);
    assert(edition.date === row.date, `${id}: inconsistent dates in source rows`);
    const song = catalog.register(row.title, row.artists);
    edition.charts[row.category].push({
      rank: row.rank,
      songId: song.id,
      importedPreviousRank: row.importedPreviousRank,
    });
  }
  return [...editions.values()];
}

function addManualEditions(editions, catalog) {
  for (const source of [...manualEditions, ...readWeeklyCsvEditions()]) {
    const id = `${source.year}-${String(source.number).padStart(2, "0")}`;
    assert(!editions.some((edition) => edition.id === id), `${id}: duplicate manual edition`);
    const charts = {};
    for (const category of ["national", "international"]) {
      charts[category] = source[category].map(([title, artists], index) => ({
        rank: index + 1,
        songId: catalog.register(title, artists, true).id,
      }));
    }
    editions.push({
      id,
      year: source.year,
      number: source.number,
      date: source.date,
      source: "manual",
      charts,
    });
  }
}

function addCsvAnnualCharts(charts, catalog) {
  const rows = readCsvDirectory(join(contentDir, "annual"));
  const grouped = new Map();
  for (const row of rows) {
    assert(row.year && row.category && row.rank && row.artists && row.title, "Annual CSV requires year, category, rank, artists and title");
    const year = Number(row.year);
    const category = csvCategory(row.category);
    const key = `${year}-${category}`;
    if (!grouped.has(key)) grouped.set(key, { id: key, year, category, entries: [] });
    grouped.get(key).entries.push({
      rank: Number(row.rank),
      songId: catalog.register(row.title, row.artists, true).id,
    });
  }
  for (const chart of grouped.values()) {
    assert(!charts.some((existing) => existing.id === chart.id), `${chart.id}: duplicate annual chart`);
    chart.entries.sort((left, right) => left.rank - right.rank);
    assert(chart.entries.length === 20, `${chart.id}: annual CSV requires 20 songs`);
    charts.push(chart);
  }
}

function deriveWeeklyFields(editions) {
  editions.sort((left, right) => left.date.localeCompare(right.date));
  const seen = { national: new Set(), international: new Set() };
  const previous = { national: new Map(), international: new Map() };
  const annualAppearances = new Map();
  const previousPositionErrors = [];

  for (const edition of editions) {
    for (const category of ["national", "international"]) {
      const current = new Map();
      edition.charts[category].sort((left, right) => left.rank - right.rank);
      for (const entry of edition.charts[category]) {
        const priorRank = previous[category].get(entry.songId);
        entry.movement = priorRank === undefined
          ? seen[category].has(entry.songId) ? "R" : "N"
          : priorRank - entry.rank;

        const appearancesKey = `${edition.year}|${category}|${entry.songId}`;
        entry.weeks = (annualAppearances.get(appearancesKey) ?? 0) + 1;
        annualAppearances.set(appearancesKey, entry.weeks);

        if (
          edition.year === 2026 &&
          edition.number > 1 &&
          entry.importedPreviousRank !== undefined
        ) {
          const expectedPreviousRank = priorRank ?? 11;
          if (entry.importedPreviousRank !== expectedPreviousRank) {
            previousPositionErrors.push({
              edition: edition.number,
              category,
              rank: entry.rank,
              imported: entry.importedPreviousRank,
              actual: expectedPreviousRank,
            });
          }
        }

        delete entry.importedPreviousRank;
        current.set(entry.songId, entry.rank);
        seen[category].add(entry.songId);
      }
      previous[category] = current;
    }
    delete edition.source;
  }

  return previousPositionErrors;
}

function titleIdentity(title) {
  return identityPart(normalizeTitle(title));
}

function buildAnnualCharts(sourceRows, catalog) {
  return annualOrders.map((annual) => {
    const candidates = sourceRows.filter(
      (row) => row.sourceYear === annual.year && row.category === annual.category,
    );
    const entries = annual.titles.map((item, index) => {
      const { title, artistHint } = typeof item === "string" ? { title: item } : item;
      let matches = candidates.filter((row) => titleIdentity(row.title) === titleIdentity(title));
      if (artistHint) {
        const hint = identityPart(artistHint);
        matches = matches.filter((row) => identityPart(row.artists).includes(hint));
      }
      const identities = new Map(
        matches.map((row) => [songIdentity(row.title, row.artists), row]),
      );
      assert(
        identities.size === 1,
        `${annual.year} ${annual.category} annual #${index + 1} ${JSON.stringify(title)} matched ${identities.size} songs`,
      );
      const match = [...identities.values()][0];
      const song = catalog.register(title, match.artists, true);
      return { rank: index + 1, songId: song.id };
    });
    return {
      id: `${annual.year}-${annual.category}`,
      year: annual.year,
      category: annual.category,
      entries,
    };
  });
}

function validate({ weeklyEditions, annualCharts, songs, previousPositionErrors }) {
  const expectedNumbers = {
    2024: [...Array.from({ length: 20 }, (_, index) => index + 1), ...Array.from({ length: 18 }, (_, index) => index + 23)],
    2025: Array.from({ length: 26 }, (_, index) => index + 1),
    2026: Array.from({ length: 30 }, (_, index) => index + 1),
  };
  assert(weeklyEditions.length >= 94, `Expected at least 94 weekly editions, found ${weeklyEditions.length}`);
  assert(annualCharts.length >= 4, `Expected at least 4 annual charts, found ${annualCharts.length}`);
  assert(
    previousPositionErrors.length >= 5,
    `Expected to correct at least the 5 confirmed 2026 previous-position errors, found ${previousPositionErrors.length}`,
  );

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
    chart.entries.forEach((entry, index) => {
      assert(entry.rank === index + 1, `${chart.id}: ranks must be 1-20`);
      assert(songIds.has(entry.songId), `${chart.id}: missing catalog song ${entry.songId}`);
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
  assert(first2026?.date === "2026-01-18", "2026 #1 date correction was not applied");
  const amante = songs.filter((song) => titleIdentity(song.title) === titleIdentity("Amante"));
  assert(amante.length >= 1 && amante.every((song) => song.title === "Amante"), "Amante title correction was not applied");
}

function writeJson(filename, value) {
  writeFileSync(join(outputDir, filename), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function main() {
  const catalog = new SongCatalog();
  const sourceRows = workbookSources.flatMap(parseWorkbook);
  assert(sourceRows.length === 1840, `Expected 1,840 XLSX chart rows, found ${sourceRows.length}`);

  const weeklyEditions = groupSourceEditions(sourceRows, catalog);
  addManualEditions(weeklyEditions, catalog);
  const previousPositionErrors = deriveWeeklyFields(weeklyEditions);
  const annualCharts = buildAnnualCharts(sourceRows, catalog);
  catalog.addAuthors(readDocxAuthors());
  addCsvAnnualCharts(annualCharts, catalog);
  catalog.addMetadata(readCsvDirectory(join(contentDir, "songs")));
  const songs = catalog.output();
  const songsWithAuthors = songs.filter((song) => song.authors).length;

  validate({ weeklyEditions, annualCharts, songs, previousPositionErrors });
  assert(songsWithAuthors >= 20, `Expected at least 20 DOCX author matches, found ${songsWithAuthors}`);

  mkdirSync(outputDir, { recursive: true });
  writeJson("weekly-editions.json", weeklyEditions);
  writeJson("annual-charts.json", annualCharts);
  writeJson("songs.json", songs);

  const yearCounts = Object.fromEntries(
    [2024, 2025, 2026].map((year) => [year, weeklyEditions.filter((edition) => edition.year === year).length]),
  );
  console.log(
    `Validated ${weeklyEditions.length} weekly editions (${Object.entries(yearCounts).map(([year, count]) => `${year}: ${count}`).join(", ")}), ${annualCharts.length} annual charts, ${songs.length} songs, ${songsWithAuthors} author credits, and ${previousPositionErrors.length} corrected 2026 previous-position errors.`,
  );
}

main();
