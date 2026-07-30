import { Page } from "@playwright/test";

const TEST_USER = process.env.TEST_USER || "admin@menal-sarl.mr";
const TEST_PASS = process.env.TEST_PASS || "admin123";

export async function loginAs(page: Page, email = TEST_USER, password = TEST_PASS) {
  await page.goto("/login");
  await page.getByPlaceholder(/email/i).fill(email);
  await page.getByPlaceholder(/mot de passe/i).fill(password);
  await page.getByRole("button", { name: /connexion/i }).click();
  await page.waitForURL(/^\/$/, { timeout: 15000 });
}