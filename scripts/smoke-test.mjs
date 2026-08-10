#!/usr/bin/env node

import { chromium } from "playwright-core";

const origin = process.env.PREVIEW_URL ?? "http://127.0.0.1:4321/entre-hits";
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
  await page.waitForURL(/\/semanal\/nacional\/(?:2026-08-09\/)?$/);
  assert((await page.locator(".chart-masthead h1").textContent())?.includes("#30"), "Current route must select chart #30 for the current Cuban week.");

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
  assert(await page.locator(".calendar-month-next").isDisabled(), "Calendar must stop at the latest available month.");
  await page.keyboard.press("Escape");
  assert((await page.locator(".calendar-trigger").getAttribute("aria-expanded")) === "false", "Calendar trigger must expose its collapsed state.");
  assert(await page.locator(".calendar-trigger").evaluate((trigger) => trigger === document.activeElement), "Calendar must restore focus to its trigger when closed.");

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

  response = await page.goto(`${origin}/cancion/patitoa3-d542f2e175/`, { waitUntil: "networkidle" });
  assert(response?.ok(), "Single-appearance song-history route did not load.");
  assert((await page.locator(".performance-date-label").count()) === 1, "Single-appearance history must render one date label.");

  response = await page.goto(`${origin}/imagenes/semanal/nacional/2026-08-09.png`);
  assert(response?.ok(), "Downloadable chart image did not load.");
  assert(errors.length === 0, `Browser console errors: ${errors.join(" | ")}`);
  console.log("Smoke test passed: charts, calendar, song histories, archive, responsive layouts, and PNG route.");
} finally {
  await browser.close();
}
