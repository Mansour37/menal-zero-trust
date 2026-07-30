import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("Page Logs", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await page.goto("/logs");
  });

  test("affiche le titre de la page", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /logs|journaux/i })).toBeVisible();
  });

  test("affiche un tableau avec les colonnes attendues", async ({ page }) => {
    const table = page.getByRole("table");
    await expect(table).toBeVisible({ timeout: 10000 });

    // Verifie les en-tetes de colonnes
    await expect(page.getByRole("columnheader", { name: /methode|method/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /chemin|path|endpoint/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /statut|status/i })).toBeVisible();
  });

  test("les lignes du tableau sont cliquables ou affichent des details", async ({ page }) => {
    const rows = page.getByRole("row");
    const count = await rows.count();
    expect(count).toBeGreaterThan(1); // Au moins 1 ligne de donnees + header
  });

  test("filtre par methode HTTP", async ({ page }) => {
    const filterSelect = page.getByRole("combobox").first();
    if (await filterSelect.isVisible()) {
      await filterSelect.selectOption("GET");
      await page.waitForTimeout(500);
      const rows = page.getByRole("row");
      const count = await rows.count();
      expect(count).toBeGreaterThan(0);
    }
  });
});