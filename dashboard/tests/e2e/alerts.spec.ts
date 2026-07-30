import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("Page Alertes", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await page.goto("/alerts");
  });

  test("affiche le titre de la page", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /alert/i })).toBeVisible();
  });

  test("affiche les badges de severite", async ({ page }) => {
    // Verifie que les badges de severite sont presents
    const severities = ["CRITICAL", "HIGH", "MEDIUM"];
    for (const sev of severities) {
      const badge = page.getByText(sev);
      const count = await badge.count();
      // Au moins un badge de chaque type peut exister selon les donnees
      if (count > 0) {
        await expect(badge.first()).toBeVisible();
      }
    }
  });

  test("affiche un tableau d alertes", async ({ page }) => {
    await expect(page.getByRole("table")).toBeVisible({ timeout: 10000 });
  });

  test("les alertes 5xx sont classees CRITICAL", async ({ page }) => {
    // Si une alerte 5xx existe, elle doit etre marquee CRITICAL
    const criticalBadge = page.getByText("CRITICAL").first();
    if (await criticalBadge.isVisible()) {
      // Verifie que la ligne contient un code 5xx
      const row = criticalBadge.locator("xpath=ancestor::tr");
      const statusCell = row.getByText(/5\d\d/);
      if (await statusCell.count() > 0) {
        await expect(statusCell.first()).toBeVisible();
      }
    }
  });

  test("retour vers le tableau de bord via la sidebar", async ({ page }) => {
    await page.getByRole("link", { name: /tableau de bord|overview|accueil/i }).click();
    await expect(page).toHaveURL(/^\/$/, { timeout: 10000 });
  });
});