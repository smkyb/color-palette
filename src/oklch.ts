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
