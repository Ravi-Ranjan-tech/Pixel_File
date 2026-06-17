// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImageEditState {
  id: string;
  file: File;
  previewUrl: string;
  dimensions: { width: number; height: number } | null;
  // Color adjustments
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  blur: number;
  // Pixel enhancement
  sharpen: number;   // 0-10
  denoise: number;   // 0-10
  clarity: number;   // 0-10
  upscale2x: boolean;
  // State
  aiAdjusted: boolean;
  aiAnalysis?: AiAnalysis;
}

export interface AiAnalysis {
  avgLuminance: number;
  dynamicRange: number;
  avgSaturation: number;
  shadowClip: boolean;
  highlightClip: boolean;
  label: string;
  suggestedSharpen: number;
  suggestedDenoise: number;
  suggestedClarity: number;
}

export const defaultSettings = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  blur: 0,
  sharpen: 0,
  denoise: 0,
  clarity: 0,
  upscale2x: false,
};

// ─── CSS Filter String ────────────────────────────────────────────────────────

export function getFilterString(
  state: Pick<ImageEditState, 'brightness' | 'contrast' | 'saturation' | 'blur' | 'hue' | 'sharpen' | 'denoise'>
) {
  const svgPart = (state.sharpen > 0 || state.denoise > 0)
    ? `url(#enhance-preview) `
    : '';
  const cssPart = [
    `brightness(${state.brightness}%)`,
    `contrast(${state.contrast}%)`,
    `saturate(${state.saturation}%)`,
    `hue-rotate(${state.hue}deg)`,
    state.blur > 0 ? `blur(${state.blur}px)` : '',
  ].filter(Boolean).join(' ');
  return svgPart + cssPart;
}

export function getEnhanceSvgParams(sharpen: number, denoise: number) {
  const s = (sharpen / 10) * 1.8;
  const d = (denoise / 10) * 1.2;
  return { sharpenAmount: s, denoiseStd: d };
}

// ─── Presets ──────────────────────────────────────────────────────────────────

export type PresetName = 'vivid' | 'bw' | 'warm' | 'cool' | 'fade' | 'punch' | 'matte' | 'none';

export interface Preset {
  label: string;
  settings: Omit<typeof defaultSettings, 'sharpen' | 'denoise' | 'clarity' | 'upscale2x'>;
}

export const PRESETS: Record<PresetName, Preset> = {
  none:  { label: 'None',  settings: { brightness: 100, contrast: 100, saturation: 100, blur: 0, hue: 0 } },
  vivid: { label: 'Vivid', settings: { brightness: 105, contrast: 125, saturation: 155, blur: 0, hue: 0 } },
  bw:    { label: 'B&W',   settings: { brightness: 100, contrast: 115, saturation: 0,   blur: 0, hue: 0 } },
  warm:  { label: 'Warm',  settings: { brightness: 105, contrast: 105, saturation: 115, blur: 0, hue: 15 } },
  cool:  { label: 'Cool',  settings: { brightness: 100, contrast: 105, saturation: 105, blur: 0, hue: -20 } },
  fade:  { label: 'Fade',  settings: { brightness: 112, contrast: 78,  saturation: 72,  blur: 0, hue: 0 } },
  punch: { label: 'Punch', settings: { brightness: 102, contrast: 135, saturation: 140, blur: 0, hue: 5 } },
  matte: { label: 'Matte', settings: { brightness: 108, contrast: 85,  saturation: 88,  blur: 0, hue: 8 } },
};

export const PRESET_KEYS: PresetName[] = ['none', 'vivid', 'bw', 'warm', 'cool', 'punch', 'matte', 'fade'];

// ─── Pixel Processing Kernels ─────────────────────────────────────────────────

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/** 3×3 convolution over RGB channels (ignores alpha) */
function convolve3x3(
  src: Uint8ClampedArray,
  w: number,
  h: number,
  kernel: number[]
): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (y === 0 || y === h - 1 || x === 0 || x === w - 1) {
        dst[i] = src[i]; dst[i+1] = src[i+1]; dst[i+2] = src[i+2]; dst[i+3] = src[i+3];
        continue;
      }
      for (let c = 0; c < 3; c++) {
        let acc = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            acc += src[((y + ky) * w + (x + kx)) * 4 + c] * kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }
        dst[i + c] = clamp(Math.round(acc));
      }
      dst[i + 3] = src[i + 3];
    }
  }
  return dst;
}

/** Separable 1D Gaussian kernel (sigma ~1) — radius 2 */
const GAUSS5 = [0.0625, 0.25, 0.375, 0.25, 0.0625];

function gaussianBlur(src: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const tmp = new Float32Array(src.length);
  const dst = new Uint8ClampedArray(src.length);

  // Horizontal pass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        let acc = 0;
        for (let k = -2; k <= 2; k++) {
          const sx = Math.min(Math.max(x + k, 0), w - 1);
          acc += src[(y * w + sx) * 4 + c] * GAUSS5[k + 2];
        }
        tmp[(y * w + x) * 4 + c] = acc;
      }
      tmp[(y * w + x) * 4 + 3] = src[(y * w + x) * 4 + 3];
    }
  }

  // Vertical pass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        let acc = 0;
        for (let k = -2; k <= 2; k++) {
          const sy = Math.min(Math.max(y + k, 0), h - 1);
          acc += tmp[(sy * w + x) * 4 + c] * GAUSS5[k + 2];
        }
        dst[(y * w + x) * 4 + c] = clamp(Math.round(acc));
      }
      dst[(y * w + x) * 4 + 3] = src[(y * w + x) * 4 + 3];
    }
  }
  return dst;
}

/** Unsharp mask: sharpened = original + amount × (original − blurred) */
function unsharpMask(
  src: Uint8ClampedArray,
  blurred: Uint8ClampedArray,
  amount: number
): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      dst[i + c] = clamp(Math.round(src[i + c] + amount * (src[i + c] - blurred[i + c])));
    }
    dst[i + 3] = src[i + 3];
  }
  return dst;
}

/** Clarity = large-radius unsharp mask (enhances mid-frequency detail / local contrast) */
function applyClarity(src: Uint8ClampedArray, w: number, h: number, amount: number): Uint8ClampedArray {
  // Multiple blur passes = large-radius Gaussian approximation
  let blurred = gaussianBlur(src, w, h);
  blurred = gaussianBlur(blurred, w, h);
  blurred = gaussianBlur(blurred, w, h);
  return unsharpMask(src, blurred, amount * 0.7);
}

/** Denoise = blend original with Gaussian blur */
function applyDenoise(src: Uint8ClampedArray, w: number, h: number, strength: number): Uint8ClampedArray {
  const blurred = gaussianBlur(src, w, h);
  const t = strength;          // 0 = original, 1 = blurred
  const dst = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      dst[i + c] = clamp(Math.round(src[i + c] * (1 - t) + blurred[i + c] * t));
    }
    dst[i + 3] = src[i + 3];
  }
  return dst;
}

/** Sharpen via 3×3 convolution kernel */
function applySharpen(src: Uint8ClampedArray, w: number, h: number, amount: number): Uint8ClampedArray {
  const s = amount;
  const kernel = [
     0,    -s,     0,
    -s, 1 + 4 * s, -s,
     0,    -s,     0,
  ];
  return convolve3x3(src, w, h, kernel);
}

/** HDR-like tone enhancement: boosts shadow detail and compresses highlights */
function applyHdrTone(src: Uint8ClampedArray): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(src.length);
  // Build lookup table: subtle S-curve with lifted shadows
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    // Lifted shadow toe + slight highlight compression
    const curve = Math.pow(t, 0.85) * 0.93 + 0.05 * t;
    lut[i] = clamp(Math.round(curve * 255));
  }
  for (let i = 0; i < src.length; i += 4) {
    dst[i]     = lut[src[i]];
    dst[i + 1] = lut[src[i + 1]];
    dst[i + 2] = lut[src[i + 2]];
    dst[i + 3] = src[i + 3];
  }
  return dst;
}

// ─── Canvas helpers ───────────────────────────────────────────────────────────

function imgToCanvas(imgEl: HTMLImageElement, scale = 1): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; w: number; h: number } {
  const w = Math.round(imgEl.naturalWidth * scale);
  const h = Math.round(imgEl.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(imgEl, 0, 0, w, h);
  return { canvas, ctx, w, h };
}

// ─── AI Analysis ─────────────────────────────────────────────────────────────

export async function analyzeImage(
  imgUrl: string
): Promise<{ brightness: number; contrast: number; saturation: number; hue: number; sharpen: number; denoise: number; clarity: number; aiAnalysis: AiAnalysis }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const scale = Math.min(1, 300 / Math.max(img.naturalWidth, img.naturalHeight));
      const { ctx, w, h } = imgToCanvas(img, scale);
      const { data } = ctx.getImageData(0, 0, w, h);

      const histogram = new Uint32Array(256);
      let totalLum = 0;
      let totalSat = 0;
      let edgeSum = 0;
      let noiseEstimate = 0;
      const n = w * h;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i] / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;

        const lum = Math.round((0.2126 * r + 0.7152 * g + 0.0722 * b) * 255);
        histogram[lum]++;
        totalLum += lum;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const l = (max + min) / 2;
        const sat = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
        totalSat += sat;
      }

      // Compute edge sharpness using simple gradient magnitude on center region
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = (y * w + x) * 4;
          const il = (y * w + x - 1) * 4;
          const ir = (y * w + x + 1) * 4;
          const it = ((y - 1) * w + x) * 4;
          const ib = ((y + 1) * w + x) * 4;
          const gx = Math.abs(data[il] - data[ir]);
          const gy = Math.abs(data[it] - data[ib]);
          edgeSum += Math.sqrt(gx * gx + gy * gy);

          // Laplacian noise estimate (difference from 4-neighbour average)
          const lap = Math.abs(data[i] * 4 - data[il] - data[ir] - data[it] - data[ib]);
          noiseEstimate += lap;
        }
      }

      const avgLuminance = totalLum / n;
      const avgSaturation = totalSat / n;
      const avgEdge = edgeSum / n;
      const avgNoise = noiseEstimate / n;

      // Percentile-based black/white points
      let cumulative = 0;
      let p2 = 0, p98 = 255;
      for (let i = 0; i < 256; i++) {
        cumulative += histogram[i];
        if (cumulative / n < 0.02) p2 = i;
        if (cumulative / n < 0.98) p98 = i;
      }

      const dynamicRange = Math.max(p98 - p2, 1);
      const shadowClip = p2 > 30;
      const highlightClip = p98 < 220;

      // Brightness / contrast / saturation (unchanged from before)
      const stretchRatio = Math.min(255 / dynamicRange, 2.5);
      let newContrast = Math.round(stretchRatio * 100);
      const midAfterContrast = ((p2 + p98) / 2 / 255 - 0.5) * stretchRatio + 0.5;
      let newBrightness = Math.round((0.5 / Math.max(midAfterContrast, 0.01)) * 100);
      let newSaturation = 100;
      if (avgSaturation < 0.25) newSaturation = Math.round(100 + (0.25 - avgSaturation) * 160);
      else if (avgSaturation > 0.70) newSaturation = Math.round(100 - (avgSaturation - 0.70) * 60);

      newBrightness = Math.min(Math.max(newBrightness, 60), 160);
      newContrast   = Math.min(Math.max(newContrast,   70), 180);
      newSaturation = Math.min(Math.max(newSaturation, 60), 180);

      // Enhance suggestions
      // Sharpen: low edge energy = blurry image → needs sharpening
      const suggestedSharpen = avgEdge < 8 ? Math.round(Math.min((8 - avgEdge) * 0.8, 8))
        : avgEdge < 15 ? 3 : 0;

      // Denoise: high noise estimate AND dark image = noisy → needs denoise
      const suggestedDenoise = (avgNoise > 60 && avgLuminance < 100)
        ? Math.round(Math.min((avgNoise - 40) / 20, 7))
        : avgNoise > 100 ? 3 : 0;

      // Clarity: low dynamic range images benefit from local contrast
      const suggestedClarity = dynamicRange < 120 ? Math.round(Math.min((120 - dynamicRange) / 15, 7)) : 2;

      // Label
      const labels: string[] = [];
      if (avgLuminance < 80)    labels.push('Underexposed');
      if (avgLuminance > 190)   labels.push('Overexposed');
      if (dynamicRange < 80)    labels.push('Low contrast');
      if (shadowClip)           labels.push('Crushed shadows');
      if (highlightClip)        labels.push('Clipped highlights');
      if (avgSaturation < 0.20) labels.push('Desaturated');
      if (avgSaturation > 0.75) labels.push('Oversaturated');
      if (avgEdge < 8)          labels.push('Soft/blurry');
      if (avgNoise > 60 && avgLuminance < 100) labels.push('Noisy');
      if (labels.length === 0)  labels.push('Well exposed');

      resolve({
        brightness: newBrightness,
        contrast:   newContrast,
        saturation: newSaturation,
        hue: 0,
        sharpen: suggestedSharpen,
        denoise: suggestedDenoise,
        clarity: suggestedClarity,
        aiAnalysis: {
          avgLuminance: Math.round(avgLuminance),
          dynamicRange: Math.round(dynamicRange),
          avgSaturation: Math.round(avgSaturation * 100) / 100,
          shadowClip,
          highlightClip,
          label: labels.join(' · '),
          suggestedSharpen,
          suggestedDenoise,
          suggestedClarity,
        },
      });
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imgUrl;
  });
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function exportEditedImage(
  imgUrl: string,
  state: ImageEditState,
  quality = 0.92
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const upscale = state.upscale2x ? 2 : 1;
      const { canvas, ctx, w, h } = imgToCanvas(img, upscale);

      // 1. Apply CSS color filters via canvas
      ctx.clearRect(0, 0, w, h);
      const cssParts = [
        `brightness(${state.brightness}%)`,
        `contrast(${state.contrast}%)`,
        `saturate(${state.saturation}%)`,
        `hue-rotate(${state.hue}deg)`,
        state.blur > 0 ? `blur(${state.blur}px)` : '',
      ].filter(Boolean).join(' ');
      ctx.filter = cssParts || 'none';
      ctx.drawImage(img, 0, 0, w, h);
      ctx.filter = 'none';

      // 2. Get pixel data for enhancement pipeline
      let { data } = ctx.getImageData(0, 0, w, h);
      let pixels = new Uint8ClampedArray(data);

      // Pipeline: denoise → clarity → sharpen
      if (state.denoise > 0) {
        const strength = (state.denoise / 10) * 0.65;
        pixels = applyDenoise(pixels, w, h, strength);
      }

      if (state.clarity > 0) {
        const amount = (state.clarity / 10) * 1.5;
        pixels = applyClarity(pixels, w, h, amount);
      }

      if (state.sharpen > 0) {
        const amount = (state.sharpen / 10) * 1.2;
        pixels = applySharpen(pixels, w, h, amount);
      }

      // 3. Write enhanced pixels back to canvas
      const outData = ctx.getImageData(0, 0, w, h);
      outData.data.set(pixels);
      ctx.putImageData(outData, 0, 0);

      // 4. Encode to blob
      const ext = state.file.name.split('.').pop()?.toLowerCase();
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const q = mime === 'image/png' ? undefined : quality;
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
        mime,
        q
      );
    };
    img.onerror = () => reject(new Error('Failed to load image for export'));
    img.src = imgUrl;
  });
}
