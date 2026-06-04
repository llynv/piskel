import { z } from "zod";
import { isValidColor } from "./color.js";

export const ColorSchema = z.string().refine(isValidColor, {
  message: "Color must be #RGB, #RRGGBB, #RRGGBBAA, or 'transparent'"
});

const Coord = z.number().int().min(0);
const Dim = z.number().int().min(1);

export const NewCanvasSchema = z.object({
  width: Dim,
  height: Dim,
  name: z.string().optional(),
  fps: z.number().int().min(1).max(60).default(12)
});

export const SetPixelSchema = z.object({
  x: Coord,
  y: Coord,
  color: ColorSchema
});

export const SetPixelsSchema = z.object({
  pixels: z.array(z.object({ x: Coord, y: Coord, color: ColorSchema })).min(1)
});

export const LineSchema = z.object({
  x1: Coord,
  y1: Coord,
  x2: Coord,
  y2: Coord,
  color: ColorSchema
});

export const RectSchema = z.object({
  x: Coord,
  y: Coord,
  w: Dim,
  h: Dim,
  color: ColorSchema,
  fill: z.boolean().default(false)
});

export const EllipseSchema = RectSchema;

export const FloodFillSchema = z.object({
  x: Coord,
  y: Coord,
  color: ColorSchema
});

export const PreviewSchema = z.object({
  scale: z.number().int().min(1).max(32).default(8),
  frame: z.number().int().min(0).optional(),
  layer: z.number().int().min(0).optional()
});

export const GetPixelSchema = z.object({
  x: Coord,
  y: Coord,
  layer: z.number().int().min(0).optional(),
  frame: z.number().int().min(0).optional()
});

export const PathSchema = z.object({ path: z.string().min(1) });
