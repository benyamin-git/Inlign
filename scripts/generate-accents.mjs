import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

// Generates src/theme/accents.css: every color role for the six house accents
// in the Light, Dark and OLED themes, derived in OKLCH from the accent seeds
// with the design skill's clip rule (halve the chroma until the color is in
// sRGB gamut; keep the first in-gamut value, never search back up).
//
// The seed table must stay in sync with src/theme/accents.ts; theme.test.ts
// enforces both that sync and that the checked-in CSS matches this generator
// exactly.

export const ACCENT_SEEDS = {
  blue: { hue: 255, chroma: 0.21 },
  teal: { hue: 195, chroma: 0.16 },
  green: { hue: 145, chroma: 0.19 },
  orange: { hue: 45, chroma: 0.21 },
  rose: { hue: 15, chroma: 0.21 },
  violet: { hue: 300, chroma: 0.2 },
}

const SECONDARY_CHROMA = 0.28
const TERTIARY_CHROMA = 0.46
const TERTIARY_HUE_SHIFT = 60

const PRIMARY_TONES = {
  light: [
    ['primary', 0.4955, 1],
    ['on-primary', 1, 0],
    ['primary-container', 0.918, 0.36],
    ['on-primary-container', 0.24, 1.05],
    ['surface-tint', 0.4955, 1],
    ['inverse-primary', 0.835, 0.72],
  ],
  dark: [
    ['primary', 0.74, 1],
    ['on-primary', 0.325, 1.04],
    ['primary-container', 0.41, 1.02],
    ['on-primary-container', 0.918, 0.36],
    ['surface-tint', 0.74, 1],
    ['inverse-primary', 0.4955, 1],
  ],
}

const SECONDARY_TONES = {
  light: [
    ['secondary', 0.4859, 1],
    ['on-secondary', 1, 0],
    ['secondary-container', 0.9163, 1.02],
    ['on-secondary-container', 0.2272, 0.97],
  ],
  dark: [
    ['secondary', 0.8303, 1.04],
    ['on-secondary', 0.3124, 1.01],
    ['secondary-container', 0.4005, 0.95],
    ['on-secondary-container', 0.9163, 1.02],
  ],
}

const TERTIARY_TONES = {
  light: [
    ['tertiary', 0.4904, 1],
    ['on-tertiary', 1, 0],
    ['tertiary-container', 0.9184, 0.76],
    ['on-tertiary-container', 0.2323, 0.9],
  ],
  dark: [
    ['tertiary', 0.8367, 1.1],
    ['on-tertiary', 0.3171, 0.94],
    ['tertiary-container', 0.4044, 0.98],
    ['on-tertiary-container', 0.9184, 0.76],
  ],
}

// Source neutrals: the house-style table values. The generator keeps each
// value's lightness and chroma and substitutes the active accent hue; the
// fixed OLED neutrals live in tokens.css instead.
const NEUTRAL_SOURCES = {
  light: {
    background: '#fffbfe',
    'on-background': '#1c1b1f',
    surface: '#fffbfe',
    'on-surface': '#1c1b1f',
    'surface-variant': '#e7e0ec',
    'on-surface-variant': '#49454f',
    outline: '#79747e',
    'outline-variant': '#cac4d0',
    'inverse-surface': '#313033',
    'inverse-on-surface': '#f4eff4',
    'surface-container-lowest': '#ffffff',
    'surface-container-low': '#f7f2fa',
    'surface-container': '#f3edf7',
    'surface-container-high': '#ece6f0',
    'surface-container-highest': '#e6e0e9',
  },
  dark: {
    background: '#1c1b1f',
    'on-background': '#e6e1e5',
    surface: '#1c1b1f',
    'on-surface': '#e6e1e5',
    'surface-variant': '#49454f',
    'on-surface-variant': '#cac4d0',
    outline: '#938f99',
    'outline-variant': '#49454f',
    'inverse-surface': '#e6e1e5',
    'inverse-on-surface': '#313033',
    'surface-container-lowest': '#0f0d13',
    'surface-container-low': '#1d1b20',
    'surface-container': '#211f26',
    'surface-container-high': '#2b2930',
    'surface-container-highest': '#36343b',
  },
}

function srgbFromLinear(c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

function linearFromSrgb(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function oklchToLinear(L, C, H) {
  const hRad = (H * Math.PI) / 180
  const a = C * Math.cos(hRad)
  const b = C * Math.sin(hRad)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ ** 3
  const m = m_ ** 3
  const s = s_ ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

function inGamut(rgb) {
  return rgb.every((c) => c >= -0.0001 && c <= 1.0001)
}

function toHex(rgb) {
  return `#${rgb
    .map((c) =>
      Math.round(Math.min(1, Math.max(0, srgbFromLinear(c))) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

function oklchToHex(L, C, H) {
  let chroma = C
  let rgb = oklchToLinear(L, chroma, H)
  while (!inGamut(rgb) && chroma > 0.0001) {
    chroma /= 2
    rgb = oklchToLinear(L, chroma, H)
  }
  return toHex(rgb)
}

function hexToOklch(hex) {
  const r = linearFromSrgb(parseInt(hex.slice(1, 3), 16) / 255)
  const g = linearFromSrgb(parseInt(hex.slice(3, 5), 16) / 255)
  const b = linearFromSrgb(parseInt(hex.slice(5, 7), 16) / 255)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return { L, C: Math.hypot(a, bb) }
}

function familyDeclarations(tones, hue, chroma) {
  return tones
    .map(([role, L, scale]) => `  --md-sys-color-${role}: ${oklchToHex(L, chroma * scale, hue)};`)
    .join('\n')
}

function neutralDeclarations(theme, hue) {
  return Object.entries(NEUTRAL_SOURCES[theme])
    .map(([role, hex]) => {
      const { L, C } = hexToOklch(hex)
      return `  --md-sys-color-${role}: ${oklchToHex(L, C, hue)};`
    })
    .join('\n')
}

function block(selector, groups) {
  return `${selector} {\n${groups.join('\n\n')}\n}`
}

function familyGroups(theme, seed) {
  return [
    familyDeclarations(PRIMARY_TONES[theme], seed.hue, seed.chroma),
    familyDeclarations(SECONDARY_TONES[theme], seed.hue, seed.chroma * SECONDARY_CHROMA),
    familyDeclarations(
      TERTIARY_TONES[theme],
      seed.hue + TERTIARY_HUE_SHIFT,
      seed.chroma * TERTIARY_CHROMA,
    ),
  ]
}

export function renderAccentsCss() {
  const blocks = []
  for (const [id, seed] of Object.entries(ACCENT_SEEDS)) {
    for (const theme of ['light', 'dark']) {
      blocks.push(
        block(`[data-theme='${theme}'][data-accent='${id}']`, [
          ...familyGroups(theme, seed),
          neutralDeclarations(theme, seed.hue),
        ]),
      )
    }
    blocks.push(block(`[data-theme='oled'][data-accent='${id}']`, familyGroups('dark', seed)))
  }
  return `${blocks.join('\n\n')}\n`
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedDirectly) {
  writeFileSync(new URL('../src/theme/accents.css', import.meta.url), renderAccentsCss())
  console.log(`Generated ${Object.keys(ACCENT_SEEDS).length} accent palettes into accents.css`)
}
