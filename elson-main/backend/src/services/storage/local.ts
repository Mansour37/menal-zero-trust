/**
 * Local-disk storage driver — the historical behavior: object keys are relative
 * paths under config.uploadDir (e.g. "<userId>/phrase1_user2_3.wav"), directories
 * are created recursively on write, moves are plain fs renames.
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type { PutOptions, Storage } from "./index.js";

export class LocalStorage implements Storage {
  readonly driver = "local" as const;

  constructor(private readonly root: string) {}

  // Confine every key to the root dir (path-traversal guard, same intent as the
  // existing safeUnlink guards in the routes).
  private resolve(key: string): string {
    const rootAbs = path.resolve(this.root);
    const full = path.resolve(rootAbs, key);
    if (full !== rootAbs && !full.startsWith(rootAbs + path.sep)) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    return full;
  }

  async putFile(key: string, localPath: string, _opts?: PutOptions): Promise<void> {
    const dest = this.resolve(key);
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    // rename first (same-device, no RAM copy) — cross-device staging falls back to copy.
    try {
      await fsp.rename(localPath, dest);
    } catch {
      await fsp.copyFile(localPath, dest);
      await fsp.unlink(localPath).catch(() => {});
    }
  }

  async put(key: string, data: Buffer | string, _opts?: PutOptions): Promise<void> {
    const dest = this.resolve(key);
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    await fsp.writeFile(dest, data);
  }

  async get(key: string): Promise<Buffer> {
    return fsp.readFile(this.resolve(key));
  }

  createReadStream(key: string, range?: { start: number; end: number }): NodeJS.ReadableStream {
    // start/end are inclusive — same convention as GCS file.createReadStream.
    return fs.createReadStream(this.resolve(key), range ? { start: range.start, end: range.end } : {});
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fsp.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await fsp.unlink(this.resolve(key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }

  async move(srcKey: string, destKey: string): Promise<void> {
    const src = this.resolve(srcKey);
    const dest = this.resolve(destKey);
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    try {
      await fsp.rename(src, dest);
    } catch {
      await fsp.copyFile(src, dest);
      await fsp.unlink(src).catch(() => {});
    }
  }

  async stat(key: string): Promise<{ size: number } | null> {
    try {
      const st = await fsp.stat(this.resolve(key));
      return { size: st.size };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }
}
