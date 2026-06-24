import { test, expect } from "@playwright/test";

test("login page renders the X sign-in CTA", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("link", { name: /continue with x/i })).toBeVisible();
  await expect(page.getByText(/Twitter Helper/i).first()).toBeVisible();
});

test("unauthenticated app routes redirect to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});
