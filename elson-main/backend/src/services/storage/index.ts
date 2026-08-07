/**
 * File storage abstraction — two drivers behind one interface:
 *  - "local" (default): files under config.uploadDir, exact historical behavior
 *    (docker-compose / Hetzner, and the CI).
 *  - "gcs": private GCS bucket via ADC (Cloud Run — ephemeral disk).
 *
 * Object keys are the relative paths historically used under uploadDir:
 *   "<userId>/phrase123_user4_1234.wav", "community/<uuid>.jpg", "failed/<uuid>.webm"
 * The public URLs stay "/recordings/<key>" in both modes.
 */

import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { config } from "../../config.js";
import { LocalStorage } from "./local.js";
import { GcsStorage } from "./gcs.js";

export interface PutOptions {
  contentType?: string;
}

export interface Storage {
  readonly driver: "local" | "gcs";
  /** Move a local (staging) file into the store under `key`. The source file is consumed. */
  putFile(key: string, localPath: string, opts?: PutOptions): Promise<void>;
  /** Write a small in-memory payload (e.g. a JSON sidecar) under `key`. */
  put(key: string, data: Buffer | string, opts?: PutOptions): Promise<void>;
  /** Read a whole object into memory — small files only. */
  get(key: string): Promise<Buffer>;
  /** Byte stream of the object; `range` start/end are INCLUSIVE (fs and GCS convention). */
  createReadStream(key: string, range?: { start: number; end: number }): NodeJS.ReadableStream;
  exists(key: string): Promise<boolean>;
  /** Delete `key`; a missing object is a no-op. */
  delete(key: string): Promise<void>;
  /** Logical move/rename between keys (rename on disk, server-side copy+delete on GCS). */
  move(srcKey: string, destKey: string): Promise<void>;
  /** Object size in bytes, or null if it does not exist. */
  stat(key: string): Promise<{ size: number } | null>;
}

const CONTENT_TYPES: Record<string, string> = {
  wav: "audio/wav",
  webm: "audio/webm",
  ogg: "audio/ogg",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  mp4: "video/mp4",
  json: "application/json",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

/** Best-effort content type from the key's extension (recordings are mostly audio). */
export function contentTypeFor(key: string): string {
  const ext = key.slice(key.lastIndexOf(".") + 1).toLowerCase();
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

/**
 * Multer/ffmpeg staging directory — always a REAL local directory, even in gcs
 * mode (ephemeral scratch space is fine on Cloud Run). In gcs mode it must NOT
 * live under uploadDir (which only exists as a bucket), so it moves to os.tmpdir().
 */
export function stagingDir(): string {
  return config.storageDriver === "gcs"
    ? path.join(os.tmpdir(), "elson-staging")
    : path.join(config.uploadDir, "_tmp");
}

export interface StorageOptions {
  driver?: "local" | "gcs";
  uploadDir?: string; // local driver root (default: config.uploadDir)
  bucket?: string;    // gcs bucket name (default: config.gcsBucket)
}

/** Build a storage instance; defaults come from config (env). */
export function createStorage(opts: StorageOptions = {}): Storage {
  const driver = opts.driver ?? config.storageDriver;
  if (driver === "gcs") {
    const bucket = opts.bucket ?? config.gcsBucket;
    if (!bucket) throw new Error("GCS_BUCKET requis quand STORAGE_DRIVER=gcs");
    return new GcsStorage(bucket);
  }
  return new LocalStorage(opts.uploadDir ?? config.uploadDir);
}

/** App-wide singleton, configured from env. */
export const storage: Storage = createStorage();

/**
 * Tools that need a REAL local file path (ffmpeg, yt-dlp, archiver.file, ...)
 * must materialize the object into the staging dir first.
 * - local driver: returns the historical path under uploadDir (no copy).
 * - gcs driver: downloads the object into the staging scratch dir and returns
 *   that path; the caller must delete it afterwards (or let it be cleaned by
 *   the ephemeral disk lifecycle).
 * Returns null if the object does not exist.
 */
export async function materialize(key: string): Promise<string | null> {
  if (config.storageDriver === "local") {
    const localPath = path.join(config.uploadDir, key);
    try { await fs.access(localPath); return localPath; } catch { return null; }
  }
  const tmp = path.join(stagingDir(), `mat_${randomUUID()}_${path.basename(key)}`);
  const buf = await storage.get(key).catch(() => null);
  if (!buf) return null;
  await fs.mkdir(path.dirname(tmp), { recursive: true });
  await fs.writeFile(tmp, buf);
  return tmp;
}
