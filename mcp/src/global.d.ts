export {};
declare global {
  interface Window {
    pskl: any;
    Events: any;
    jQuery: any;
    __piskelMcp: {
      applyPixels: (
        pixels: Array<{ x: number; y: number; color: string }>
      ) => boolean;
      floodFill: (x: number, y: number, color: string) => boolean;
      clearArea: (
        area: { x: number; y: number; w: number; h: number } | null
      ) => boolean;
      canvasInfo: () => any;
      getPixelHex: (
        x: number,
        y: number,
        layer: number | null,
        frame: number | null
      ) => number;
      previewDataUrl: (
        scale: number,
        layer: number | null,
        frame: number | null
      ) => string;
      getPalette: () => number[];
      setPrimaryColor: (hex: string) => boolean;
      serialize: () => string;
      loadFromString: (data: string) => Promise<boolean>;
      exportFramePng: (scale: number, frame: number | null) => string;
      exportSpritesheetPng: (scale: number, columns: number | null) => string;
      exportGif: (scale: number, fps: number | null) => Promise<string>;
    };
  }
}
