// Generates the accent role tokens for the six house accents in Light, Dark
// and OLED from the OKLCH derivation in the design skill's house style.
// Neutrals and status colours live in tokens.css; only accent roles are
// generated here because they are the ones derived from the seed hue/chroma.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const THEME_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../apps/web/src/theme");
const OUTPUT_FILE = resolve(THEME_DIR, "accents.css");
const THEMES = ["light", "dark", "oled"];

// Hue and seed chroma from the house accent table. Two documented primaries
// per accent guard the colour maths below.
const ACCENTS = [
  { name: "blue", hue: 255, chroma: 0.21, light: "#35639c", dark: "#7daeec" },
  { name: "teal", hue: 195, chroma: 0.16, light: "#127070", dark: "#69bbba" },
  { name: "green", hue: 145, chroma: 0.19, light: "#3c703f", dark: "#4bc957" },
  { name: "orange", hue: 45, chroma: 0.21, light: "#924c2b", dark: "#e29572" },
  { name: "rose", hue: 15, chroma: 0.21, light: "#94464e", dark: "#e58f95" },
  { name: "violet", hue: 300, chroma: 0.2, light: "#7638c0", dark: "#b49ce1" },
];

const GAMUT_EPSILON = 1e-6;

function oklchToLinearSrgb(lightness, chroma, hueDegrees) {
  const hue = (hueDegrees * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);

  const lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = lightness - 0.0894841775 * a - 1.291485548 * b;

  const l = lPrime ** 3;
  const m = mPrime ** 3;
  const s = sPrime ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function isInSrgbGamut(rgb) {
  return rgb.every((channel) => channel >= -GAMUT_EPSILON && channel <= 1 + GAMUT_EPSILON);
}

// House clipping rule: halve the chroma until the colour is in gamut and keep
// the first in-gamut value. Do not search back up toward the boundary.
function clipToSrgb(lightness, chroma, hue) {
  let clipped = chroma;
  let rgb = oklchToLinearSrgb(lightness, clipped, hue);

  while (!isInSrgbGamut(rgb)) {
    clipped /= 2;
    rgb = oklchToLinearSrgb(lightness, clipped, hue);
  }

  return rgb;
}

function encodeSrgb(channel) {
  const clamped = Math.min(1, Math.max(0, channel));
  return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
}

function toHex(lightness, chroma, hue) {
  const rgb = clipToSrgb(lightness, chroma, hue).map((channel) =>
    Math.round(encodeSrgb(channel) * 255),
  );

  return `#${rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function lightRoles(seedHue, seedChroma) {
  const secondaryChroma = seedChroma * 0.28;
  const tertiaryHue = (seedHue + 60) % 360;
  const tertiaryChroma = seedChroma * 0.46;

  return [
    ["primary", 0.4955, seedChroma, seedHue],
    ["on-primary", 1.0, 0, seedHue],
    ["primary-container", 0.918, seedChroma * 0.36, seedHue],
    ["on-primary-container", 0.24, seedChroma * 1.05, seedHue],
    ["surface-tint", 0.4955, seedChroma, seedHue],
    ["inverse-primary", 0.835, seedChroma * 0.72, seedHue],
    ["secondary", 0.4859, secondaryChroma, seedHue],
    ["on-secondary", 1.0, 0, seedHue],
    ["secondary-container", 0.9163, secondaryChroma * 1.02, seedHue],
    ["on-secondary-container", 0.2272, secondaryChroma * 0.97, seedHue],
    ["tertiary", 0.4904, tertiaryChroma, tertiaryHue],
    ["on-tertiary", 1.0, 0, tertiaryHue],
    ["tertiary-container", 0.9184, tertiaryChroma * 0.76, tertiaryHue],
    ["on-tertiary-container", 0.2323, tertiaryChroma * 0.9, tertiaryHue],
  ];
}

function darkRoles(seedHue, seedChroma) {
  const secondaryChroma = seedChroma * 0.28;
  const tertiaryHue = (seedHue + 60) % 360;
  const tertiaryChroma = seedChroma * 0.46;

  return [
    ["primary", 0.74, seedChroma, seedHue],
    ["on-primary", 0.325, seedChroma * 1.04, seedHue],
    ["primary-container", 0.41, seedChroma * 1.02, seedHue],
    ["on-primary-container", 0.918, seedChroma * 0.36, seedHue],
    ["surface-tint", 0.74, seedChroma, seedHue],
    ["inverse-primary", 0.4955, seedChroma, seedHue],
    ["secondary", 0.8303, secondaryChroma * 1.04, seedHue],
    ["on-secondary", 0.3124, secondaryChroma * 1.01, seedHue],
    ["secondary-container", 0.4005, secondaryChroma * 0.95, seedHue],
    ["on-secondary-container", 0.9163, secondaryChroma * 1.02, seedHue],
    ["tertiary", 0.8367, tertiaryChroma * 1.1, tertiaryHue],
    ["on-tertiary", 0.3171, tertiaryChroma * 0.94, tertiaryHue],
    ["tertiary-container", 0.4044, tertiaryChroma * 0.98, tertiaryHue],
    ["on-tertiary-container", 0.9184, tertiaryChroma * 0.76, tertiaryHue],
  ];
}

const ROLE_BUILDERS = {
  light: lightRoles,
  dark: darkRoles,
  oled: darkRoles,
};

function buildBlocks() {
  const blocks = [];

  for (const theme of THEMES) {
    for (const accent of ACCENTS) {
      const roles = ROLE_BUILDERS[theme](accent.hue, accent.chroma);
      const declarations = roles.map(([name, lightness, chroma, hue]) => ({
        name,
        value: toHex(lightness, chroma, hue),
      }));

      blocks.push({
        theme,
        accent: accent.name,
        declarations,
      });
    }
  }

  return blocks;
}

function findPrimary(blocks, theme, accent) {
  const block = blocks.find((entry) => entry.theme === theme && entry.accent === accent);
  assert.ok(block, `missing ${theme}/${accent} block`);

  const primary = block.declarations.find((entry) => entry.name === "primary");
  assert.ok(primary, `missing ${theme}/${accent} primary`);

  return primary.value;
}

const blocks = buildBlocks();

// The documented primaries are the contract for the derivation; if the maths
// or a role factor drifts, generation fails instead of writing wrong colours.
for (const accent of ACCENTS) {
  assert.equal(
    findPrimary(blocks, "light", accent.name),
    accent.light,
    `${accent.name} light primary`,
  );
  assert.equal(
    findPrimary(blocks, "dark", accent.name),
    accent.dark,
    `${accent.name} dark primary`,
  );
  assert.equal(
    findPrimary(blocks, "oled", accent.name),
    accent.dark,
    `${accent.name} OLED primary`,
  );
}

assert.equal(blocks.length, THEMES.length * ACCENTS.length, "expected 18 theme/accent blocks");

function render(entries) {
  const header = [
    "/*",
    " * Generated by scripts/generate-accents.mjs.",
    " * Do not edit by hand; run `pnpm generate:accents` instead.",
    " */",
    "",
  ].join("\n");

  const bodies = entries.map(({ theme, accent, declarations }) => {
    const lines = declarations.map(({ name, value }) => `  --${name}: ${value};`);
    return [`[data-theme="${theme}"][data-accent="${accent}"] {`, ...lines, "}"].join("\n");
  });

  return `${header}${bodies.join("\n\n")}\n`;
}

await mkdir(THEME_DIR, { recursive: true });
await writeFile(OUTPUT_FILE, render(blocks), "utf8");

console.log(`Wrote ${blocks.length} theme/accent blocks to ${OUTPUT_FILE}`);
