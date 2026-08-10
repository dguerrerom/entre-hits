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

  let response = await page.goto(`${origin}/semanal/nacional/`, { waitUntil: "networkidle" });
  assert(response?.ok(), "The current weekly route did not load.");
  await page.waitForURL(/\/semanal\/nacional\/(?:2026-08-09\/)?$/);
  assert((await page.locator(".chart-masthead h1").textContent())?.includes("#30"), "Current route must select chart #30 for the current Cuban week.");

  response = await page.goto(`${origin}/semanal/internacional/2026-08-09/`, { waitUntil: "networkidle" });
  assert(response?.ok(), "The current weekly chart did not load.");
  assert((await page.locator(".chart-entry").count()) === 10, "Weekly chart must contain 10 entries.");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(overflow <= 1, `Mobile page overflows horizontally by ${overflow}px.`);

  await page.locator(".calendar-trigger").click();
  assert(await page.locator("#chart-calendar").evaluate((dialog) => dialog.hasAttribute("open")), "Calendar did not open.");
  assert((await page.locator("a.calendar-day").count()) > 0, "Calendar has no available editions.");
  await page.keyboard.press("Escape");

  response = await page.goto(`${origin}/anual/nacional/2025/`, { waitUntil: "networkidle" });
  assert(response?.ok(), "Annual chart did not load.");
  assert((await page.locator(".chart-entry").count()) === 20, "Annual chart must contain 20 entries.");

  response = await page.goto(`${origin}/archivo/`, { waitUntil: "networkidle" });
  assert(response?.ok(), "Archive did not load.");
  assert((await page.locator(".weekly-archive details").count()) === 3, "Archive must group three years.");

  response = await page.goto(`${origin}/imagenes/semanal/nacional/2026-08-09.png`);
  assert(response?.ok(), "Downloadable chart image did not load.");
  assert(errors.length === 0, `Browser console errors: ${errors.join(" | ")}`);
  console.log("Smoke test passed: mobile layout, calendar, annual chart, archive, and PNG route.");
} finally {
  await browser.close();
}
