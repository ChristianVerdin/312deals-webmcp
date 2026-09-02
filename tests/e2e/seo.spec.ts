import { test, expect } from "@playwright/test"

test.describe("SEO & Meta", () => {
  const pages = [
    { path: "/", title: "312Deals" },
    { path: "/search", title: "Search" },
    { path: "/neighborhoods", title: "Neighborhoods" },
    { path: "/deals", title: "Deal Types" },
    { path: "/about", title: "About" },
    { path: "/contact", title: "Contact" },
  ]

  for (const { path, title } of pages) {
    test(`${path} has proper title containing "${title}"`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveTitle(new RegExp(title, "i"))
    })
  }

  test("homepage has JSON-LD structured data", async ({ page }) => {
    await page.goto("/")
    const jsonLd = page.locator('script[type="application/ld+json"]')
    const count = await jsonLd.count()
    expect(count).toBeGreaterThan(0)
  })

  test("sitemap.xml is accessible", async ({ page }) => {
    const response = await page.goto("/sitemap.xml")
    expect(response?.status()).toBe(200)
  })

  test("robots.txt is accessible", async ({ page }) => {
    const response = await page.goto("/robots.txt")
    expect(response?.status()).toBe(200)
  })
})
