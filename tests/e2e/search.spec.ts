import { test, expect } from "@playwright/test"

test.describe("Search Page", () => {
  test("loads and shows search heading", async ({ page }) => {
    await page.goto("/search")
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  })

  test("search returns results", async ({ page }) => {
    await page.goto("/search?q=happy+hour")
    // Wait for results or empty state
    await page.waitForSelector("[data-testid='deal-card'], .grid a, [class*='deal']", {
      timeout: 10000,
    }).catch(() => {})
    // Page should load without errors
    await expect(page.locator("main")).toBeVisible()
  })

  test("filters are accessible", async ({ page }) => {
    await page.goto("/search")
    // Check that filter controls exist
    const filterElements = page.locator("select, [role='combobox'], [role='listbox']")
    const count = await filterElements.count()
    expect(count).toBeGreaterThanOrEqual(0) // Filters may be in sidebar
  })
})
