#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const origin = process.env.PREVIEW_URL ?? "http://127.0.0.1:4321/entre-hits";
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

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
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
  assert((await page.locator(".chart-entry").nth(6).locator(".weeks").textContent())?.trim() === "16", "Farándula must have 16 chart weeks.");
  assert((await page.locator(".chart-entry").nth(6).locator(".movement").getAttribute("aria-label")) === "Baja 1 posición", "Farándula movement is incorrect.");
  assert((await page.locator(".chart-entry").nth(7).locator(".weeks").textContent())?.trim() === "10", "Sin Ti must have 10 chart weeks.");
  assert((await page.locator(".chart-entry").nth(7).locator(".movement").getAttribute("aria-label")) === "Baja 4 posiciones", "Sin Ti movement is incorrect.");
  await assertNoOverflow("390px weekly chart #31 national");

  response = await page.goto(`${origin}/semanal/internacional/2026-08-16/`, { waitUntil: "networkidle" });
  assert(response?.ok(), "Weekly chart #31 international did not load.");
  assert((await page.locator(".song-authors").count()) === 10, "Every international song in chart #31 must include author credits.");
  assert((await page.locator(".movement--status").count()) === 2, "International chart #31 must contain two new entries.");
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
  assert(response?.ok(), "Canonical alias song-history route did not load.");
  assert((await page.locator(".song-header h1").textContent()) === "Sonríele", "Canonical song title is incorrect.");
  assert((await page.locator(".song-page-artists").textContent()) === "Daddy Yankee", "Canonical artist alias was not applied.");
  const appearanceMetric = page.locator(".performance-metrics > div").filter({ hasText: "Apariciones" });
  assert((await appearanceMetric.locator("dd").textContent()) === "6", "Canonical song history must combine six appearances.");
  await assertNoOverflow("390px canonical song history");

  response = await page.goto(`${origin}/cancion/dalmation-ec0a1e6f39/`, { waitUntil: "networkidle" });
  assert(response?.ok(), "Single-appearance song-history route did not load.");
  assert((await page.locator(".performance-date-label").count()) === 1, "Single-appearance history must render one date label.");
  assert((await page.locator(".song-page-authors").textContent())?.includes("José Álvaro Osorio Balvin"), "New song history must render its author credits.");

  response = await page.goto(`${origin}/imagenes/semanal/nacional/2026-08-16.png`);
  assert(response?.ok(), "Downloadable chart image did not load.");
  assert(errors.length === 0, `Browser console errors: ${errors.join(" | ")}`);
  console.log("Smoke test passed: charts, calendar, song histories, archive, responsive layouts, and PNG route.");
} finally {
  await browser.close();
}
