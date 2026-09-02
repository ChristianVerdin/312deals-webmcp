import { test, expect } from "@playwright/test"

test.describe("Venue Page", () => {
  test("renders venue details", async ({ page }) => {
    // Navigate to a known venue - use search to find one
    await page.goto("/search?limit=1")
    await page.waitForTimeout(2000)

    // Try to find a venue link
    const venueLink = page.locator("a[href*='/venues/']").first()
    if (await venueLink.isVisible()) {
      await venueLink.click()
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
      await expect(page.locator("main")).toBeVisible()
    }
  })

  test("404 for invalid venue", async ({ page }) => {
    const response = await page.goto("/venues/nonexistent-venue-xyz-12345")
    // Should show 404 page
    expect(response?.status()).toBe(404)
  })
})
