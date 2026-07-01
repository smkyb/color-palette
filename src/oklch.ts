// Inline OKLCH → sRGB conversion for high-performance pixel rendering.
// Avoids per-pixel library calls by implementing the math directly.

const DEG2RAD = Math.PI / 180;

/**
 * Convert OKLCH to linear sRGB values.
 * Returns [r, g, b] in linear light (may be outside [0,1] if out of gamut).
 */
function oklchToLinearRgb(L: number, C: number, H: number): [number, number, number] {
  // OKLCH → OKLab
  const hRad = H * DEG2RAD;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  // OKLab → LMS (cube root space)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  // Un-cube-root to get LMS
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  // LMS → linear sRGB
  const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  return [r, g, bl];
}

/**
 * Apply sRGB gamma (linear → gamma-corrected).
 */
function linearToSrgb(x: number): number {
  if (x <= 0.0031308) {
    return 12.92 * x;
  }
  return 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
}

/**
 * Convert OKLCH to sRGB [0-255] values.
 * Returns null if the color is outside the sRGB gamut.
 */
export function oklchToSrgb255(L: number, C: number, H: number): [number, number, number] | null {
  const [lr, lg, lb] = oklchToLinearRgb(L, C, H);

  // Gamut check — strict lower bound to avoid false positives near black
  if (lr < 0 || lr > 1.0001 || lg < 0 || lg > 1.0001 || lb < 0 || lb > 1.0001) {
    return null;
  }

  // Clamp, apply gamma, scale to 0-255
  const r = Math.round(linearToSrgb(Math.max(0, Math.min(1, lr))) * 255);
  const g = Math.round(linearToSrgb(Math.max(0, Math.min(1, lg))) * 255);
  const b = Math.round(linearToSrgb(Math.max(0, Math.min(1, lb))) * 255);

  return [r, g, b];
}

/**
 * Convert sRGB 0-255 values to hex string.
 */
export function rgb255ToHex(r: number, g: number, b: number): string {
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

function srgbToLinear(x: number): number {
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

export function hexToOklch(hex: string): { l: number, c: number, h: number } | null {
  const cleanHex = hex.replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(cleanHex)) {
    return null;
  }
  const r255 = parseInt(cleanHex.slice(0, 2), 16);
  const g255 = parseInt(cleanHex.slice(2, 4), 16);
  const b255 = parseInt(cleanHex.slice(4, 6), 16);

  const r = srgbToLinear(r255 / 255);
  const g = srgbToLinear(g255 / 255);
  const b = srgbToLinear(b255 / 255);

  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995477 * g + 0.1073969541 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const b_ = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  const C = Math.sqrt(a * a + b_ * b_);
  let H = C > 0.0001 ? Math.atan2(b_, a) * (180 / Math.PI) : 0;
  if (H < 0) H += 360;

  return { l: L, c: C, h: H };
}
