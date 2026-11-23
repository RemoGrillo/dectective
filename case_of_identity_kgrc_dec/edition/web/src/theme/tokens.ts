// Design tokens (single source for the CSS variables in global.css and for the WCAG contrast test).
// Light theme: white reading surfaces on a neutral grey ground; giallo yellow is an ACCENT (brand block, Reality,
// highlights, active states), never a full-page ground except on the cover. Text on yellow is always ink.
export const light = {
  bg: "#F3F3F1",        // page ground (neutral, not beige)
  paper: "#FFFFFF",     // reading surfaces, cards
  ink: "#141414",       // text
  ink2: "#3D3D3D",      // secondary text
  muted: "#666666",     // tertiary text (captions)
  line: "#D6D6D2",      // hairlines
  yellow: "#F2C200",    // accent fill (text on it: ink)
  yellowSoft: "#FFF3BF",// highlight wash (text on it: ink)
  red: "#B3121F",       // lies, delusions, conflicts; text on white allowed
  redSoft: "#FCE7E9",   // wash behind red-marked content (text on it: ink or red)
  onRed: "#FFFFFF",
  onYellow: "#141414",
} as const;

export const dark = {
  bg: "#111214",
  paper: "#1B1C1F",
  ink: "#EFEFEA",
  ink2: "#C8C8C2",
  muted: "#A3A39C",
  line: "#36383C",
  yellow: "#F2C200",
  yellowSoft: "#3B3200",
  red: "#FF6B6B",
  redSoft: "#3A1619",
  onRed: "#141414",
  onYellow: "#141414",
} as const;

/** Text/background pairs actually used by the UI, with the minimum ratio each must meet. */
export const contrastPairs: { name: string; fg: string; bg: string; min: number }[] = [
  { name: "light: ink on paper", fg: light.ink, bg: light.paper, min: 7 },
  { name: "light: ink on ground", fg: light.ink, bg: light.bg, min: 7 },
  { name: "light: secondary on paper", fg: light.ink2, bg: light.paper, min: 7 },
  { name: "light: muted on paper", fg: light.muted, bg: light.paper, min: 4.5 },
  { name: "light: muted on ground", fg: light.muted, bg: light.bg, min: 4.5 },
  { name: "light: ink on yellow (brand, Reality, buttons)", fg: light.onYellow, bg: light.yellow, min: 7 },
  { name: "light: ink on yellow wash (selection)", fg: light.ink, bg: light.yellowSoft, min: 7 },
  { name: "light: red text on paper", fg: light.red, bg: light.paper, min: 4.5 },
  { name: "light: red text on red wash", fg: light.red, bg: light.redSoft, min: 4.5 },
  { name: "light: ink on red wash", fg: light.ink, bg: light.redSoft, min: 7 },
  { name: "light: label on red (badges)", fg: light.onRed, bg: light.red, min: 4.5 },
  { name: "dark: ink on paper", fg: dark.ink, bg: dark.paper, min: 7 },
  { name: "dark: ink on ground", fg: dark.ink, bg: dark.bg, min: 7 },
  { name: "dark: secondary on paper", fg: dark.ink2, bg: dark.paper, min: 7 },
  { name: "dark: muted on paper", fg: dark.muted, bg: dark.paper, min: 4.5 },
  { name: "dark: ink on yellow", fg: dark.onYellow, bg: dark.yellow, min: 7 },
  { name: "dark: ink on yellow wash", fg: dark.ink, bg: dark.yellowSoft, min: 7 },
  { name: "dark: red text on paper", fg: dark.red, bg: dark.paper, min: 4.5 },
  { name: "dark: red text on red wash", fg: dark.red, bg: dark.redSoft, min: 4.5 },
  { name: "dark: label on red", fg: dark.onRed, bg: dark.red, min: 4.5 },
];

function channel(c: number) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
export function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
export function contrast(a: string, b: string) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
