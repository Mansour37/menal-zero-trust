/**
 * Tests du module storage (driver local + factory).
 * Le driver gcs n'est PAS teste contre le reseau — on verifie seulement que la
 * factory refuse un bucket vide.
 *
 * Lancement : npm run test:unit (node --test via tsx).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// config.ts (importe par le module storage) exige des secrets au chargement —
// valeurs factices avant l'import du module sous test.
process.env.JWT_SECRET ??= "test-secret";
process.env.DB_PASSWORD ??= "test-password";
process.env.NODE_ENV = "test";

const { createStorage, contentTypeFor, stagingDir } = await import("./index.js");

async function tmpStore() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "elson-storage-"));
  return { dir, store: createStorage({ driver: "local", uploadDir: dir }) };
}

test("factory : local par defaut (STORAGE_DRIVER absent)", () => {
  assert.equal(createStorage().driver, "local");
});

test("factory : refuse GCS_BUCKET vide en driver gcs", () => {
  assert.throws(() => createStorage({ driver: "gcs", bucket: "" }), /GCS_BUCKET/);
});

test("local : put + get + exists + stat", async () => {
  const { dir, store } = await tmpStore();
  await store.put("u1/a.json", '{"ok":true}');
  assert.equal((await store.get("u1/a.json")).toString("utf8"), '{"ok":true}');
  assert.equal(await store.exists("u1/a.json"), true);
  assert.equal(await store.exists("u1/missing.json"), false);
  assert.deepEqual(await store.stat("u1/a.json"), { size: 11 });
  assert.equal(await store.stat("u1/missing.json"), null);
  await fs.rm(dir, { recursive: true, force: true });
});

test("local : putFile consomme la source et cree les repertoires (mkdir recursif)", async () => {
  const { dir, store } = await tmpStore();
  const src = path.join(dir, "staged.webm");
  await fs.writeFile(src, "webm-bytes");
  await store.putFile("user-abc/phrase1_user2_3.webm", src);
  assert.equal((await store.get("user-abc/phrase1_user2_3.webm")).toString(), "webm-bytes");
  await assert.rejects(fs.access(src)); // source consumed (rename)
  await fs.rm(dir, { recursive: true, force: true });
});

test("local : move puis delete (delete manquant = no-op)", async () => {
  const { dir, store } = await tmpStore();
  await store.put("failed/x.webm", "audio");
  await store.move("failed/x.webm", "u1/recovered.webm");
  assert.equal(await store.exists("failed/x.webm"), false);
  assert.equal((await store.get("u1/recovered.webm")).toString(), "audio");
  await store.delete("u1/recovered.webm");
  assert.equal(await store.exists("u1/recovered.webm"), false);
  await store.delete("u1/recovered.webm"); // idempotent, ne jette pas
  await fs.rm(dir, { recursive: true, force: true });
});

test("local : createReadStream avec Range inclusif", async () => {
  const { dir, store } = await tmpStore();
  await store.put("u1/r.wav", "hello world");
  const chunks: Buffer[] = [];
  for await (const c of store.createReadStream("u1/r.wav", { start: 2, end: 4 }) as AsyncIterable<Buffer>) chunks.push(c);
  assert.equal(Buffer.concat(chunks).toString(), "llo");
  await fs.rm(dir, { recursive: true, force: true });
});

test("local : cle hors racine rejetee (path traversal)", async () => {
  const { dir, store } = await tmpStore();
  await assert.rejects(store.put("../evil.txt", "x"), /Invalid storage key/);
  await fs.rm(dir, { recursive: true, force: true });
});

test("contentTypeFor : extensions audio connues, octet-stream sinon", () => {
  assert.equal(contentTypeFor("u1/a.wav"), "audio/wav");
  assert.equal(contentTypeFor("u1/a.webm"), "audio/webm");
  assert.equal(contentTypeFor("u1/a.json"), "application/json");
  assert.equal(contentTypeFor("u1/a.bin"), "application/octet-stream");
});

test("stagingDir : sous uploadDir/_tmp en driver local (comportement historique)", () => {
  assert.ok(stagingDir().endsWith("_tmp"));
});
