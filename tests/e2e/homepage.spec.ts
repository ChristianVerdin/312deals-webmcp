import { test, expect } from "@playwright/test"

test.describe("Homepage", () => {
  test("loads and shows key elements", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveTitle(/312Deals/)
    // H1 is inside a client component — wait for hydration
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole("navigation").first()).toBeVisible()
  })

  test("shows social proof stats", async ({ page }) => {
    await page.goto("/")
    // Stats are client-rendered — wait for hydration
    await page.waitForTimeout(2000)
    await expect(page.getByText(/2,850/)).toBeVisible({ timeout: 10000 })
  })

  test("search bar navigates to search page", async ({ page }) => {
    await page.goto("/")
    const searchInput = page.getByPlaceholder(/search/i).first()
    if (await searchInput.isVisible()) {
      await searchInput.fill("tacos")
      await searchInput.press("Enter")
      await expect(page).toHaveURL(/search/)
    }
  })

  test("footer contains key links", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("link", { name: "About" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Contact" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Privacy Policy" })).toBeVisible()
  })
})
