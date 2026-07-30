import { test, expect } from "@playwright/test";

const TEST_USER = process.env.TEST_USER || "admin@menal-sarl.mr";
const TEST_PASS = process.env.TEST_PASS || "admin123";

test.describe("Authentification", () => {
  test("redirige vers /login si non authentifie", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("affiche le formulaire de connexion", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /connexion/i })).toBeVisible();
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
    await expect(page.getByPlaceholder(/mot de passe/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /connexion/i })).toBeVisible();
  });

  test("rejette des identifiants invalides", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder(/email/i).fill("wrong@test.com");
    await page.getByPlaceholder(/mot de passe/i).fill("wrongpassword");
    await page.getByRole("button", { name: /connexion/i }).click();
    await expect(page.getByText(/identifiants invalides|incorrect|erreur/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test("connexion reussie redirige vers le tableau de bord", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder(/email/i).fill(TEST_USER);
    await page.getByPlaceholder(/mot de passe/i).fill(TEST_PASS);
    await page.getByRole("button", { name: /connexion/i }).click();
    await expect(page).toHaveURL(/^\/$/, { timeout: 15000 });
    await expect(page.getByText(/menal/i)).toBeVisible();
  });

  test("deconnexion redirige vers /login", async ({ page }) => {
    // Se connecter d abord
    await page.goto("/login");
    await page.getByPlaceholder(/email/i).fill(TEST_USER);
    await page.getByPlaceholder(/mot de passe/i).fill(TEST_PASS);
    await page.getByRole("button", { name: /connexion/i }).click();
    await page.waitForURL(/^\/$/, { timeout: 15000 });

    // Se deconnecter
    await page.getByRole("button", { name: /deconnexion|logout/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});