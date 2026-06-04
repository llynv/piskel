import { describe, it, expect } from "vitest";
import { hexToInt, normalizeHex, isValidColor } from "./color.js";

describe("color", () => {
  it("converts opaque hex to Piskel ABGR int", () => {
    expect(hexToInt("#FF0000")).toBe(((255 << 24) >>> 0) + 255);
  });
  it("treats transparent as 0", () => {
    expect(hexToInt("transparent")).toBe(0);
    expect(hexToInt("#00000000")).toBe(0);
  });
  it("supports #RRGGBBAA", () => {
    expect(hexToInt("#0000FF80")).toBe(((0x80 << 24) >>> 0) + (255 << 16));
  });
  it("normalizes shorthand and case", () => {
    expect(normalizeHex("#abc")).toBe("#AABBCC");
  });
  it("validates color strings", () => {
    expect(isValidColor("#FFF")).toBe(true);
    expect(isValidColor("transparent")).toBe(true);
    expect(isValidColor("red")).toBe(false);
    expect(isValidColor("#GGGGGG")).toBe(false);
  });
});
