/**
 * Google Cloud Storage driver — private bucket, Application Default Credentials
 * (no key file: Cloud Run's service account identity). Object keys mirror the
 * local driver's relative paths ("<userId>/file.wav", "failed/<uuid>.webm", ...).
 */

import fsp from "node:fs/promises";
import { Storage as GcsClient, type Bucket } from "@google-cloud/storage";
import { contentTypeFor, type PutOptions, type Storage } from "./index.js";

export class GcsStorage implements Storage {
  readonly driver = "gcs" as const;
  private readonly bucket: Bucket;

  constructor(bucketName: string) {
    if (!bucketName) throw new Error("GCS_BUCKET requis quand STORAGE_DRIVER=gcs");
    this.bucket = new GcsClient().bucket(bucketName);
  }

  async putFile(key: string, localPath: string, opts?: PutOptions): Promise<void> {
    // resumable:false — audio files are ≤10MB, one-shot upload is faster and has
    // no partial-session state to clean up.
    await this.bucket.upload(localPath, {
      destination: key,
      resumable: false,
      contentType: opts?.contentType ?? contentTypeFor(key),
    });
    // The staging source is consumed, matching the local driver's rename semantics.
    await fsp.unlink(localPath).catch(() => {});
  }

  async put(key: string, data: Buffer | string, opts?: PutOptions): Promise<void> {
    await this.bucket.file(key).save(data, {
      resumable: false,
      contentType: opts?.contentType ?? contentTypeFor(key),
    });
  }

  async get(key: string): Promise<Buffer> {
    const [buf] = await this.bucket.file(key).download();
    return buf;
  }

  createReadStream(key: string, range?: { start: number; end: number }): NodeJS.ReadableStream {
    // start/end are inclusive byte offsets (GCS native convention, same as fs).
    return this.bucket.file(key).createReadStream(range ? { start: range.start, end: range.end } : {});
  }

  async exists(key: string): Promise<boolean> {
    const [ok] = await this.bucket.file(key).exists();
    return ok;
  }

  async delete(key: string): Promise<void> {
    await this.bucket.file(key).delete({ ignoreNotFound: true });
  }

  async move(srcKey: string, destKey: string): Promise<void> {
    // Server-side copy + delete — no local round-trip.
    await this.bucket.file(srcKey).move(destKey);
  }

  async stat(key: string): Promise<{ size: number } | null> {
    try {
      const [meta] = await this.bucket.file(key).getMetadata();
      return { size: Number(meta.size ?? 0) };
    } catch (err) {
      if ((err as { code?: number }).code === 404) return null;
      throw err;
    }
  }
}
