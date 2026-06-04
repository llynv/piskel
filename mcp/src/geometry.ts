export interface Point {
  x: number;
  y: number;
}

export function line(x0: number, y0: number, x1: number, y1: number): Point[] {
  const pts: Point[] = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  while (true) {
    pts.push({ x, y });
    if (x === x1 && y === y1) {
      break;
    }
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  return pts;
}

export function rect(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: boolean
): Point[] {
  const pts: Point[] = [];
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const edge = i === 0 || j === 0 || i === w - 1 || j === h - 1;
      if (fill || edge) {
        pts.push({ x: x + i, y: y + j });
      }
    }
  }
  return pts;
}

export function ellipse(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: boolean
): Point[] {
  const set = new Set<string>();
  const cx = x + (w - 1) / 2;
  const cy = y + (h - 1) / 2;
  const rx = w / 2;
  const ry = h / 2;
  const add = (px: number, py: number) =>
    set.add(`${Math.round(px)},${Math.round(py)}`);
  const steps = Math.max(8, Math.ceil((rx + ry) * 4));
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    add(cx + Math.cos(t) * (rx - 0.5), cy + Math.sin(t) * (ry - 0.5));
  }
  if (fill) {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const nx = (x + i - cx) / (rx - 0.5 || 0.5);
        const ny = (y + j - cy) / (ry - 0.5 || 0.5);
        if (nx * nx + ny * ny <= 1) {
          set.add(`${x + i},${y + j}`);
        }
      }
    }
  }
  return [...set].map((s) => {
    const [px, py] = s.split(",").map(Number);
    return { x: px, y: py };
  });
}
