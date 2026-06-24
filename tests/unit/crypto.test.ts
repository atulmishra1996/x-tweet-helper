import { describe, it, expect } from "vitest";
import { encrypt, decrypt, safeEqual } from "@/lib/crypto";

describe("crypto", () => {
  it("round-trips a string through encrypt/decrypt", () => {
    const secret = "super-secret-token-123";
    const enc = encrypt(secret);
    expect(enc).not.toBe(secret);
    expect(decrypt(enc)).toBe(secret);
  });

  it("produces different ciphertext each time (random IV)", () => {
    const a = encrypt("same");
    const b = encrypt("same");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(decrypt(b));
  });

  it("safeEqual compares correctly", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
