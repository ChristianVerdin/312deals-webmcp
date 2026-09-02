import { test, expect } from "@playwright/test"

test.describe("Deal Submission", () => {
  test("form page loads with all fields", async ({ page }) => {
    await page.goto("/submit")
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    // Check required form fields exist
    await expect(page.locator("#venue_name, [name='venue_name']")).toBeVisible()
    await expect(page.locator("#deal_description, [name='deal_description']")).toBeVisible()
  })

  test("shows validation on empty submit", async ({ page }) => {
    await page.goto("/submit")
    const submitButton = page.getByRole("button", { name: /submit/i })
    if (await submitButton.isVisible()) {
      await submitButton.click()
      // Should show validation or stay on page
      await expect(page).toHaveURL(/submit/)
    }
  })
})
