export interface ClassColor {
  hex: string;
  hslCss: string;
  textOn: string;
}

function djb2(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const hPrime = h / 60;
  const x = c * (1 - Math.abs((hPrime % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hPrime >= 0 && hPrime < 1) { r = c; g = x; b = 0; }
  else if (hPrime < 2) { r = x; g = c; b = 0; }
  else if (hPrime < 3) { r = 0; g = c; b = x; }
  else if (hPrime < 4) { r = 0; g = x; b = c; }
  else if (hPrime < 5) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const m = lNorm - c / 2;
  const toHex = (v: number) => {
    const n = Math.round((v + m) * 255);
    return Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function classNameToColor(name: string): ClassColor {
  const normalized = name.trim().toLowerCase();
  const hash = djb2(normalized);
  const hue = hash % 360;
  const saturation = 70;
  const lightness = 50;
  return {
    hex: hslToHex(hue, saturation, lightness),
    hslCss: `hsl(${hue}deg ${saturation}% ${lightness}%)`,
    textOn: '#ffffff'
  };
}
