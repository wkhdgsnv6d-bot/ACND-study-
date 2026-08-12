import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Colour contrast, asserted against the tokens themselves.
 *
 * An axe run in a browser catches this too, but only for pages that happen to
 * be open and only when someone remembers to run it. These ratios were arrived
 * at by measurement after a real audit found `subtle-foreground` failing on
 * every screen and every status pill failing in the light theme; without a test
 * the next palette adjustment quietly undoes that.
 *
 * WCAG 2.1 AA: 4.5:1 for body text. Nothing here is large enough to claim the
 * 3:1 exemption — the smallest of it is 11px sidebar headings.
 */

const AA = 4.5;

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

/* ------------------------------------------------------------------ */
/* oklch → relative luminance                                          */
/* ------------------------------------------------------------------ */

/** Linear-light sRGB, which is exactly what WCAG's luminance formula wants. */
function oklchToLinearRgb(L: number, C: number, hDeg: number): [number, number, number] {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  return [
    clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

const encode = (x: number) =>
  x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
const decode = (x: number) =>
  x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;

function luminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * decode(r) + 0.7152 * decode(g) + 0.0722 * decode(b);
}

function contrast(fg: Token, bg: Token): number {
  const [a, b] = [luminance(toSrgb(fg)), luminance(toSrgb(bg))].sort((x, y) => y - x);
  return (a! + 0.05) / (b! + 0.05);
}

/* ------------------------------------------------------------------ */
/* Token parsing                                                       */
/* ------------------------------------------------------------------ */

interface Token {
  L: number;
  C: number;
  H: number;
  /** Present when the token is a translucent tint, e.g. `--primary-muted`. */
  alpha?: number;
  /** What the tint sits on. Resolved before contrast is computed. */
  over?: Token;
}

/** Gamma-encoded sRGB, which is the space browsers composite alpha in. */
function toSrgb(token: Token): [number, number, number] {
  const colour = oklchToLinearRgb(token.L, token.C, token.H).map(encode) as [
    number,
    number,
    number,
  ];
  if (token.alpha === undefined || !token.over) return colour;

  const base = toSrgb(token.over);
  return [0, 1, 2].map(
    (i) => colour[i]! * token.alpha! + base[i]! * (1 - token.alpha!),
  ) as [number, number, number];
}

/**
 * Reads a custom property out of one theme block. `:root` is the dark theme and
 * `.light` opts out of it, so the two are parsed from their own slices of the
 * file rather than by first match.
 */
function tokens(theme: "dark" | "light"): (name: string) => Token {
  const start = theme === "dark" ? css.indexOf(":root {") : css.indexOf(".light {");
  const end = css.indexOf("\n}", start);
  const block = css.slice(start, end);

  return (name: string) => {
    const match = block.match(
      new RegExp(`--${name}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)(?:\\s*/\\s*([\\d.]+))?\\)`),
    );
    if (!match) throw new Error(`--${name} not found in the ${theme} theme`);
    return {
      L: Number(match[1]),
      C: Number(match[2]),
      H: Number(match[3]),
      ...(match[4] ? { alpha: Number(match[4]) } : {}),
    };
  };
}

/* ------------------------------------------------------------------ */

const TONES = ["primary", "success", "warning", "destructive", "info"] as const;

describe.each(["dark", "light"] as const)("%s theme contrast", (theme) => {
  const t = tokens(theme);
  const surfaces = ["background", "surface-1", "surface-2", "surface-3"] as const;

  describe.each(["foreground", "muted-foreground", "subtle-foreground"] as const)(
    "%s",
    (fg) => {
      it.each(surfaces)(`meets AA on %s`, (surface) => {
        expect(contrast(t(fg), t(surface))).toBeGreaterThanOrEqual(AA);
      });
    },
  );

  /**
   * Status pills put `text-{tone}` on `bg-{tone}-muted` — the same hue as a
   * translucent tint over the card. Both the text/tint pair and the text on a
   * plain surface have to hold up.
   */
  describe.each(TONES)("%s", (tone) => {
    it("is readable as text on a plain surface", () => {
      for (const surface of ["surface-1", "surface-2"] as const) {
        expect(
          contrast(t(tone), t(surface)),
          `${tone} on ${surface} in the ${theme} theme`,
        ).toBeGreaterThanOrEqual(AA);
      }
    });

    it("is readable as text on its own muted tint", () => {
      for (const surface of ["surface-1", "surface-2"] as const) {
        const tint = { ...t(`${tone}-muted`), over: t(surface) };
        expect(
          contrast(t(tone), tint),
          `${tone} on ${tone}-muted over ${surface} in the ${theme} theme`,
        ).toBeGreaterThanOrEqual(AA);
      }
    });

    it("has a readable foreground when used as a solid fill", () => {
      expect(contrast(t(`${tone}-foreground`), t(tone))).toBeGreaterThanOrEqual(AA);
    });
  });
});
