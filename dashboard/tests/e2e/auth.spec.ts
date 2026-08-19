import { test, expect } from "@playwright/test";

import { generateTotp, wrongTotp } from "./helpers/totp";

const TEST_USER = process.env.TEST_USER || "admin@menal-sarl.mr";
const TEST_PASS = process.env.TEST_PASS || "admin123";

// Compte de test DEDIE avec MFA active, distinct de TEST_USER (qui n a pas
// MFA active dans les suites existantes de ce fichier). Aucune valeur par
// defaut plausible ici : contrairement a TEST_USER/TEST_PASS, il n existe pas
// de convention deja etablie pour un compte MFA de demo. Ces tests se
// desactivent proprement (test.skip) si l environnement ne fournit pas ces
// 3 variables, plutot que d echouer contre un compte qui n existe pas.
const TEST_MFA_USER = process.env.TEST_MFA_USER;
const TEST_MFA_PASS = process.env.TEST_MFA_PASS;
const TEST_MFA_SECRET = process.env.TEST_MFA_SECRET; // secret TOTP base32, cote /auth/mfa/setup
const MFA_CONFIGURED = Boolean(TEST_MFA_USER && TEST_MFA_PASS && TEST_MFA_SECRET);

test.describe("Authentification", () => {
  test("redirige vers /login si non authentifie", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("affiche le formulaire de connexion", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /connexion/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/mot de passe/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /connexion/i })).toBeVisible();
  });

  test("rejette des identifiants invalides", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("wrong@test.com");
    await page.getByLabel(/mot de passe/i).fill("wrongpassword");
    await page.getByRole("button", { name: /connexion/i }).click();
    await expect(page.getByText(/identifiants invalides|incorrect|erreur/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test("connexion reussie redirige vers le tableau de bord", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(TEST_USER);
    await page.getByLabel(/mot de passe/i).fill(TEST_PASS);
    await page.getByRole("button", { name: /connexion/i }).click();
    await expect(page).toHaveURL(/^\/$/, { timeout: 15000 });
    await expect(page.getByText(/menal/i)).toBeVisible();
  });

  test("deconnexion redirige vers /login", async ({ page }) => {
    // Se connecter d abord
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(TEST_USER);
    await page.getByLabel(/mot de passe/i).fill(TEST_PASS);
    await page.getByRole("button", { name: /connexion/i }).click();
    await page.waitForURL(/^\/$/, { timeout: 15000 });

    // Se deconnecter
    await page.getByRole("button", { name: /deconnexion|logout/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});

test.describe("Authentification — challenge MFA (TOTP)", () => {
  test.skip(
    !MFA_CONFIGURED,
    "TEST_MFA_USER / TEST_MFA_PASS / TEST_MFA_SECRET non fournis — " +
      "necessite un compte de test avec MFA deja active (voir /auth/mfa/setup + /auth/mfa/enable).",
  );

  test("des identifiants valides pour un compte MFA active affichent l ecran de code, pas le tableau de bord", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(TEST_MFA_USER!);
    await page.getByLabel(/mot de passe/i).fill(TEST_MFA_PASS!);
    await page.getByRole("button", { name: /connexion/i }).click();

    await expect(page.getByRole("heading", { name: /vérification en deux étapes/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByLabel(/code de vérification/i)).toBeVisible();
    // Toujours sur /login (le second facteur n a pas encore ete verifie) :
    // pas de redirection vers le tableau de bord a ce stade.
    await expect(page).toHaveURL(/\/login/);
  });

  test("un code TOTP correct termine la connexion et redirige vers le tableau de bord", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(TEST_MFA_USER!);
    await page.getByLabel(/mot de passe/i).fill(TEST_MFA_PASS!);
    await page.getByRole("button", { name: /connexion/i }).click();
    await expect(page.getByLabel(/code de vérification/i)).toBeVisible({ timeout: 10000 });

    const code = generateTotp(TEST_MFA_SECRET!);
    await page.getByLabel(/code de vérification/i).fill(code);
    await page.getByRole("button", { name: /vérifier/i }).click();

    await expect(page).toHaveURL(/^\/$/, { timeout: 15000 });
    await expect(page.getByText(/menal/i)).toBeVisible();
  });

  test("un code TOTP incorrect affiche une erreur et laisse l ecran de code visible", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(TEST_MFA_USER!);
    await page.getByLabel(/mot de passe/i).fill(TEST_MFA_PASS!);
    await page.getByRole("button", { name: /connexion/i }).click();
    await expect(page.getByLabel(/code de vérification/i)).toBeVisible({ timeout: 10000 });

    await page.getByLabel(/code de vérification/i).fill(wrongTotp(TEST_MFA_SECRET!));
    await page.getByRole("button", { name: /vérifier/i }).click();

    await expect(page.getByText(/code de vérification invalide/i)).toBeVisible({ timeout: 10000 });
    // Toujours sur l ecran de code : ni redirection, ni retour silencieux
    // au formulaire identifiants/mot de passe.
    await expect(page.getByLabel(/code de vérification/i)).toBeVisible();
  });
});