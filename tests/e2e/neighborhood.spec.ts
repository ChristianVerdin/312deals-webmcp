import { test, expect } from "@playwright/test"

test.describe("Neighborhoods", () => {
  test("index page loads with neighborhood cards", async ({ page }) => {
    await page.goto("/neighborhoods")
    // Client component — wait for hydration
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10000 })
    await expect(page.locator("main")).toBeVisible()
  })

  test("detail page loads with deals", async ({ page }) => {
    await page.goto("/neighborhoods/west-loop")
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(page.locator("main")).toBeVisible()
  })

  test("404 for invalid neighborhood", async ({ page }) => {
    const response = await page.goto("/neighborhoods/fake-neighborhood-xyz")
    expect(response?.status()).toBe(404)
  })
})
