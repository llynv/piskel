const HEX3 = /^#?([0-9a-fA-F]{3})$/;
const HEX6 = /^#?([0-9a-fA-F]{6})$/;
const HEX8 = /^#?([0-9a-fA-F]{8})$/;

export function isValidColor(input: string): boolean {
  if (input === "transparent" || input === "0") {
    return true;
  }
  return HEX3.test(input) || HEX6.test(input) || HEX8.test(input);
}

export function normalizeHex(input: string): string {
  if (input === "transparent" || input === "0") {
    return "transparent";
  }
  let h = input.replace("#", "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return "#" + h.toUpperCase();
}

export function hexToInt(input: string): number {
  if (input === "transparent" || input === "0") {
    return 0;
  }
  let h = input.replace("#", "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const a = h.length >= 8 ? parseInt(h.substring(6, 8), 16) : 255;
  if (a === 0) {
    return 0;
  }
  return ((a << 24) >>> 0) + (b << 16) + (g << 8) + r;
}

export function intToHex(value: number): string {
  if (value === 0) {
    return "transparent";
  }
  const r = value & 0xff;
  const g = (value >> 8) & 0xff;
  const b = (value >> 16) & 0xff;
  const a = (value >>> 24) & 0xff;
  const hx = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();
  return a === 255
    ? `#${hx(r)}${hx(g)}${hx(b)}`
    : `#${hx(r)}${hx(g)}${hx(b)}${hx(a)}`;
}
