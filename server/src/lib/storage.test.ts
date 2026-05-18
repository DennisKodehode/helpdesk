import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let originalCwd: string;
let testRoot: string;

beforeEach(async () => {
  originalCwd = process.cwd();
  testRoot = await mkdtemp(path.join(tmpdir(), "helpdesk-storage-test-"));
  process.chdir(testRoot);
  // Reset module cache so storage.ts re-reads LOCAL_ROOT against the new cwd
  vi.resetModules();
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(testRoot, { recursive: true, force: true });
});

describe("local storage adapter", () => {
  it("put writes the buffer to disk under .attachments/<key>", async () => {
    const { storage } = await import("./storage");
    const key = "attachments/42/abc-test.png";
    const body = Buffer.from("hello world", "utf8");

    await storage.put(key, body, "image/png");

    const full = path.join(testRoot, ".attachments", key);
    const stats = await stat(full);
    expect(stats.isFile()).toBe(true);
    const read = await readFile(full);
    expect(read.equals(body)).toBe(true);
  });

  it("get reads the buffer back", async () => {
    const { storage } = await import("./storage");
    const key = "attachments/42/abc-test.txt";
    const body = Buffer.from("round trip", "utf8");

    await storage.put(key, body, "text/plain");
    const read = await storage.get(key);

    expect(read.equals(body)).toBe(true);
  });

  it("delete removes the file", async () => {
    const { storage } = await import("./storage");
    const key = "attachments/42/abc-test.bin";
    await storage.put(key, Buffer.from("x"), "application/octet-stream");

    await storage.delete(key);

    const full = path.join(testRoot, ".attachments", key);
    await expect(stat(full)).rejects.toThrow();
  });

  it("delete is a no-op when the file does not exist", async () => {
    const { storage } = await import("./storage");
    await expect(storage.delete("attachments/0/missing.bin")).resolves.toBeUndefined();
  });

  it("safeFilename strips path separators, null bytes, and leading dots", async () => {
    const { safeFilename } = await import("./storage");
    // dots survive in the middle but leading dots are stripped, so
    // "../../etc/passwd" → ".._.._etc_passwd" → "_.._etc_passwd"
    expect(safeFilename("../../etc/passwd")).toBe("_.._etc_passwd");
    expect(safeFilename(".hidden")).toBe("hidden");
    expect(safeFilename("normal file (1).png")).toBe("normal_file__1_.png");
    expect(safeFilename("a".repeat(150))).toHaveLength(100);
    expect(safeFilename("with\0null.bin")).toBe("with_null.bin");
  });
});
