import { describe, it, expect } from "vitest";
import { ColorSchema, SetPixelSchema, NewCanvasSchema } from "./schemas.js";

describe("schemas", () => {
  it("accepts valid colors", () => {
    expect(ColorSchema.parse("#FF0000")).toBe("#FF0000");
    expect(ColorSchema.parse("transparent")).toBe("transparent");
  });
  it("rejects invalid colors", () => {
    expect(() => ColorSchema.parse("red")).toThrow();
  });
  it("validates set_pixel args", () => {
    expect(SetPixelSchema.parse({ x: 1, y: 2, color: "#000000" })).toEqual({
      x: 1,
      y: 2,
      color: "#000000"
    });
    expect(() =>
      SetPixelSchema.parse({ x: -1, y: 0, color: "#000" })
    ).toThrow();
  });
  it("validates new_canvas args with defaults", () => {
    const v = NewCanvasSchema.parse({ width: 16, height: 16 });
    expect(v.fps).toBe(12);
  });
});
