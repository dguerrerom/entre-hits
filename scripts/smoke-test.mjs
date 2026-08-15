#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const origin = process.env.PREVIEW_URL ?? "http://127.0.0.1:4321";
const weeklyEditions = JSON.parse(readFileSync(new URL("../src/data/weekly-editions.json", import.meta.url), "utf8"));
const cubaParts = new Intl.DateTimeFormat("en-CA", {
  year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", timeZone: "America/Havana",
}).formatToParts(new Date());
const cubaPart = (type) => cubaParts.find((part) => part.type === type)?.value ?? "";
const currentWeek = new Date(`${cubaPart("year")}-${cubaPart("month")}-${cubaPart("day")}T12:00:00Z`);
const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(cubaPart("weekday"));
currentWeek.setUTCDate(currentWeek.getUTCDate() - Math.max(weekday, 0));
const currentWeekDate = currentWeek.toISOString().slice(0, 10);
const expectedCurrent = [...weeklyEditions].reverse().find((edition) => edition.date <= currentWeekDate);
if (!expectedCurrent) throw new Error("No published weekly edition is available for the smoke test.");
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
  headless: true,
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertPng(response, label, width, height) {
  assert(response?.ok(), `${label} did not load.`);
  assert(response.headers()["content-type"] === "image/png", `${label} must use the image/png content type.`);
  const image = await response.body();
  assert(image.subarray(1, 4).toString("ascii") === "PNG", `${label} is not a valid PNG.`);
  assert(image.readUInt32BE(16) === width && image.readUInt32BE(20) === height, `${label} must measure ${width}x${height}.`);
}

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      const location = message.location();
      errors.push(`${message.text()}${location.url ? ` (${location.url}:${location.lineNumber})` : ""}`);
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  const assertNoOverflow = async (label) => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(overflow <= 1, `${label} overflows horizontally by ${overflow}px.`);
  };

  let response = await page.goto(`${origin}/semanal/nacional/`, { waitUntil: "networkidle" });
  assert(response?.ok(), "The current weekly route did not load.");
  await page.waitForFunction((number) => document.querySelector(".chart-masthead h1")?.textContent?.includes(`#${number}`), expectedCurrent.number);
  await page.waitForURL(new RegExp(`/semanal/nacional/(?:${expectedCurrent.date}/)?$`));
  assert((await page.locator(".chart-masthead h1").textContent())?.includes(`#${expectedCurrent.number}`), "Current route must select the latest chart for the current Cuban week.");

  response = await page.goto(`${origin}/semanal/internacional/2026-08-09/`, { waitUntil: "networkidle" });
  assert(response?.ok(), "The current weekly chart did not load.");
  assert((await page.locator(".chart-entry").count()) === 10, "Weekly chart must contain 10 entries.");
  assert((await page.locator("a.song-history-link").count()) === 10, "Every weekly song must link to its history page.");
  await assertNoOverflow("390px weekly chart");
  assert((await page.locator('.category-tabs a[aria-current="page"]').textContent()) === "Internacional", "Active category must be exposed semantically.");

  await page.locator(".calendar-trigger").click();
  assert(await page.locator("#chart-calendar").evaluate((dialog) => dialog.hasAttribute("open")), "Calendar did not open.");
  assert((await page.locator(".calendar-trigger").getAttribute("aria-expanded")) === "true", "Calendar trigger must expose its expanded state.");
  assert((await page.locator("a.calendar-day").count()) > 0, "Calendar has no available editions.");
  assert((await page.locator('.calendar-day[aria-current="date"]').count()) === 1, "Calendar must expose the selected date.");
  assert(await page.locator('.calendar-day[aria-current="date"]').evaluate((day) => day === document.activeElement), "Calendar must focus the selected date when opened.");
  assert((await page.locator("[data-calendar-year]").count()) === 3, "Calendar must expose every available year.");
  assert((await page.locator("[data-calendar-month]").count()) === 12, "Calendar must expose all twelve months.");
  assert((await page.locator('[data-calendar-year="2026"]').getAttribute("aria-pressed")) === "true", "Calendar must expose the active year.");
  assert((await page.locator('[data-calendar-month="7"]').getAttribute("aria-pressed")) === "true", "Calendar must expose the active month.");
  assert(await page.locator('[data-calendar-month="8"]').isDisabled(), "Calendar must disable future months.");

  await page.locator('[data-calendar-year="2025"]').click();
  assert((await page.locator(".calendar-month-label").textContent())?.includes("2025"), "Year shortcut did not jump to 2025.");
  assert(await page.locator('[data-calendar-month="10"]').isDisabled(), "Calendar must disable months without editions.");
  await page.locator('[data-calendar-month="9"]').click();
  assert((await page.locator(".calendar-month-label").textContent())?.toLocaleLowerCase("es").includes("octubre de 2025"), "Month shortcut did not jump to October 2025.");
  await page.locator(".calendar-month-next").click();
  assert((await page.locator(".calendar-month-label").textContent())?.toLocaleLowerCase("es").includes("enero de 2026"), "Month navigation must skip empty months.");

  await page.locator('a.calendar-day[tabindex="0"]').press("Shift+PageUp");
  assert((await page.locator(".calendar-month-label").textContent())?.toLocaleLowerCase("es").includes("enero de 2025"), "Shift+PageUp must jump to the previous year.");
  await page.locator(".calendar-selected-return").click();
  assert((await page.locator(".calendar-month-label").textContent())?.includes("2026"), "Selected-count shortcut did not restore the current month.");
  assert(await page.locator('.calendar-day[aria-current="date"]').evaluate((day) => day === document.activeElement), "Selected-count shortcut must restore focus to the selected date.");
  assert(await page.locator(".calendar-month-next").isDisabled(), "Calendar must stop at the latest available month.");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector(".calendar-trigger")?.getAttribute("aria-expanded") === "false");
  assert((await page.locator(".calendar-trigger").getAttribute("aria-expanded")) === "false", "Calendar trigger must expose its collapsed state.");
  assert(await page.locator(".calendar-trigger").evaluate((trigger) => trigger === document.activeElement), "Calendar must restore focus to its trigger when closed.");

  response = await page.goto(`${origin}/semanal/nacional/2026-08-16/`, { waitUntil: "networkidle" });
  assert(response?.ok(), "Weekly chart #31 national did not load.");
  assert((await page.locator(".chart-masthead h1").textContent())?.includes("#31"), "Weekly chart #31 must expose its edition number.");
  assert((await page.locator(".song-authors").count()) === 10, "Every national song in chart #31 must include author credits.");
  assert((await page.locator(".movement--status").count()) === 2, "National chart #31 must contain two new entries.");
  assert((await page.locator(".platform-links--compact .platform-link").count()) === 10, "Every national song in chart #31 must expose its verified platform link.");
  const compactPlatformLink = page.locator(".platform-links--compact .platform-link").first();
  assert((await compactPlatformLink.getAttribute("aria-label"))?.includes("en YouTube (abre en una pestaña nueva)"), "Compact platform links must describe their destination and new-tab behavior.");
  assert((await compactPlatformLink.getAttribute("target")) === "_blank", "Compact platform links must preserve the external-media browsing context.");
  assert((await compactPlatformLink.getAttribute("rel")) === "noopener noreferrer", "Compact platform links must isolate the external browsing context.");
  const compactPlatformBox = await compactPlatformLink.boundingBox();
  assert(compactPlatformBox && compactPlatformBox.height >= 32, "Compact platform links must provide a target at least 32px high.");
  assert((await page.locator(".chart-entry").nth(6).locator(".weeks").textContent())?.trim() === "16", "Farándula must have 16 chart weeks.");
  assert((await page.locator(".chart-entry").nth(6).locator(".movement").getAttribute("aria-label")) === "Baja 1 posición", "Farándula movement is incorrect.");
  assert((await page.locator(".chart-entry").nth(7).locator(".weeks").textContent())?.trim() === "10", "Sin Ti must have 10 chart weeks.");
  assert((await page.locator(".chart-entry").nth(7).locator(".movement").getAttribute("aria-label")) === "Baja 4 posiciones", "Sin Ti movement is incorrect.");
  await assertNoOverflow("390px weekly chart #31 national");

  response = await page.goto(`${origin}/semanal/internacional/2026-08-16/`, { waitUntil: "networkidle" });
  assert(response?.ok(), "Weekly chart #31 international did not load.");
  assert((await page.locator(".song-authors").count()) === 10, "Every international song in chart #31 must include author credits.");
  assert((await page.locator(".movement--status").count()) === 2, "International chart #31 must contain two new entries.");
  assert((await page.locator(".chart-entry").nth(1).locator(".song-line > span:last-child").textContent()) === "Fonseca y Juanes", "Multiple primary artists must use a Spanish conjunction.");
  assert((await page.locator(".chart-entry").nth(1).locator(".song-authors").textContent()) === "Autoría: Juan Fernando Fonseca Carrera, Juan Esteban Aristizábal Vásquez y Felipe Andy Clay Cruz", "Author credits must use Spanish list punctuation.");
  await assertNoOverflow("390px weekly chart #31 international");

  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${origin}/semanal/internacional/2026-08-09/`, { waitUntil: "networkidle" });
    await assertNoOverflow(`${width}px weekly chart`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  response = await page.goto(`${origin}/anual/nacional/2025/`, { waitUntil: "networkidle" });
  assert(response?.ok(), "Annual chart did not load.");
  assert((await page.locator(".chart-entry").count()) === 20, "Annual chart must contain 20 entries.");

  response = await page.goto(`${origin}/archivo/`, { waitUntil: "networkidle" });
  assert(response?.ok(), "Archive did not load.");
  assert((await page.locator(".weekly-archive details").count()) === 3, "Archive must group three years.");
  await assertNoOverflow("390px archive");

  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto(`${origin}/archivo/`, { waitUntil: "networkidle" });
  await assertNoOverflow("320px archive");

  response = await page.goto(`${origin}/cancion/losbesosquetedi-f1fa430ac3/`, { waitUntil: "networkidle" });
  assert(response?.ok(), "Long song-history route did not load.");
  assert((await page.locator(".performance-point").count()) === 21, "Long song history must contain 21 ranked appearances.");
  assert((await page.locator(".performance-off-point").count()) === 17, "Long song history must expose 17 off-chart editions.");
  assert((await page.locator(".performance-annual a").count()) === 2, "Song history must link its two annual placements.");
  await assertNoOverflow("320px song history");
  await page.locator(".performance-details summary").click();
  assert((await page.locator(".performance-table-wrap tbody tr").count()) === 38, "Expanded song history must contain every published chart in its span.");
  await assertNoOverflow("320px expanded song history");

  for (const width of [768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${origin}/cancion/losbesosquetedi-f1fa430ac3/`, { waitUntil: "networkidle" });
    await assertNoOverflow(`${width}px song history`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  response = await page.goto(`${origin}/cancion/sonriele-dc3a5895ca/`, { waitUntil: "networkidle" });
  assert(response?.ok(), "Canonical song-history route did not load.");
  assert((await page.locator(".song-header h1").textContent()) === "Sonríele", "Canonical song title is incorrect.");
  assert((await page.locator(".song-page-artists").textContent()) === "Daddy Yankee", "Canonical primary artist credit is incorrect.");
  const appearanceMetric = page.locator(".performance-metrics > div").filter({ hasText: "Apariciones" });
  assert((await appearanceMetric.locator("dd").textContent()) === "6", "Canonical song history must combine six appearances.");
  await assertNoOverflow("390px canonical song history");

  response = await page.goto(`${origin}/cancion/dalmation-ec0a1e6f39/`, { waitUntil: "networkidle" });
  assert(response?.ok(), "Single-appearance song-history route did not load.");
  assert((await page.locator(".performance-date-label").count()) === 1, "Single-appearance history must render one date label.");
  assert((await page.locator(".song-page-authors").textContent())?.includes("José Álvaro Osorio Balvín"), "New song history must render its author credits.");
  const detailPlatformLink = page.locator(".platform-links--detail .platform-link");
  assert((await detailPlatformLink.count()) === 1, "The song history must expose its verified platform link.");
  assert((await detailPlatformLink.textContent())?.trim() === "Ver en YouTube", "Detailed platform links must state their action and destination.");
  assert((await detailPlatformLink.getAttribute("aria-label")) === "Ver Dalmation en YouTube (abre en una pestaña nueva)", "Detailed platform links must identify the song, destination, and new-tab behavior.");
  const detailPlatformBox = await detailPlatformLink.boundingBox();
  assert(detailPlatformBox && detailPlatformBox.height >= 44, "Detailed platform links must provide a target at least 44px high.");
  await assertNoOverflow("390px song history with platform link");

  response = await page.goto(`${origin}/cancion/fortnightcyrilremix-227943921e/`, { waitUntil: "networkidle" });
  assert(response?.ok(), "Structured remix song-history route did not load.");
  assert((await page.locator(".song-header h1").textContent()) === "Fortnight (remezcla de CYRIL)", "Remix display title is incorrect.");
  assert((await page.locator(".song-page-artists").textContent()) === "Taylor Swift con Post Malone", "Featured artist credit must use con.");
  assert((await page.locator(".song-page-meta").filter({ hasText: "Remezcla:" }).textContent()) === "Remezcla: CYRIL", "Remixer role is missing.");
  assert((await page.locator(".song-page-meta").filter({ hasText: "Estado:" }).textContent()) === "Estado: Remezcla independiente", "Independent remix status is missing.");
  const sourceLink = page.locator(".song-page-meta").filter({ hasText: "Fuente:" }).locator("a");
  assert((await sourceLink.textContent()) === "SoundCloud", "Remix source name is missing.");
  assert((await sourceLink.getAttribute("href")) === "https://soundcloud.com/cyrilriley/taylor-swift-fortnight-feat-post-malone-cyril-remix", "Remix source URL is incorrect.");
  assert((await page.locator(".song-page-meta").filter({ hasText: "Título en la fuente:" }).locator("cite").textContent()) === "Taylor Swift - Fortnight (Feat. Post Malone) (CYRIL REMIX)", "Source title was not preserved.");
  await assertNoOverflow("390px structured remix song history");

  const weeklyImageResponse = await page.request.get(`${origin}/imagenes/semanal/nacional/2026-08-16.png`);
  await assertPng(weeklyImageResponse, "Downloadable weekly chart image", 1080, 1350);
  const annualImageResponse = await page.request.get(`${origin}/imagenes/anual/internacional/2024.png`);
  await assertPng(annualImageResponse, "Downloadable annual chart image", 1080, 1920);
  assert(errors.length === 0, `Browser console errors: ${errors.join(" | ")}`);
  console.log("Smoke test passed: charts, calendar, song histories, archive, responsive layouts, and PNG route.");
} finally {
  await browser.close();
}
