import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("Tableau de bord - Vue d ensemble", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test("affiche les 4 cartes KPI", async ({ page }) => {
    await expect(page.getByText(/requetes totales|total requests/i)).toBeVisible();
    await expect(page.getByText(/taux d.erreur|error rate/i)).toBeVisible();
    await expect(page.getByText(/alertes actives|active alerts/i)).toBeVisible();
    await expect(page.getByText(/latence|latency/i)).toBeVisible();
  });

  test("affiche le graphique de requetes", async ({ page }) => {
    await expect(page.locator(".recharts-responsive-container, [data-testid=chart]")).toBeVisible({
      timeout: 10000,
    });
  });

  test("affiche la liste des derniers logs", async ({ page }) => {
    await expect(page.getByRole("table")).toBeVisible({ timeout: 10000 });
  });

  test("le lien Logs dans la sidebar fonctionne", async ({ page }) => {
    await page.getByRole("link", { name: /logs/i }).click();
    await expect(page).toHaveURL(/\/logs/);
  });

  test("le lien Alertes dans la sidebar fonctionne", async ({ page }) => {
    await page.getByRole("link", { name: /alert/i }).click();
    await expect(page).toHaveURL(/\/alerts/);
  });
});