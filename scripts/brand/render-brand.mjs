import { Resvg } from "@resvg/resvg-js";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const out = (name) => join(root, "assets", name);

const STOPS = `<Stop offset="0" stop-color="#FFD1E3"/><Stop offset="0.35" stop-color="#FFF2B3"/><Stop offset="0.7" stop-color="#BFF0E6"/><Stop offset="1" stop-color="#D3DAFF"/>`.replace(/Stop/g, "stop");
const DEFS = `<defs><linearGradient id="zapHolo" x1="0" y1="0" x2="1" y2="1">${STOPS}</linearGradient></defs>`;
const DISC = `<circle cx="60" cy="60" r="58" fill="#FFFFFF"/><circle cx="60" cy="60" r="53.5" fill="url(#zapHolo)" stroke="#111111" stroke-width="5"/>`;
const bolt = (color = "#111111") => `<path d="M38 36 H82 L54 60 H68 L38 84 H82" stroke="${color}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
const SPARKLE = `<path d="M104 6 Q105.6 16.4 116 18 Q105.6 19.6 104 30 Q102.4 19.6 92 18 Q102.4 16.4 104 6 Z" fill="#F8E58C" stroke="#111111" stroke-width="2.5" stroke-linejoin="round"/>`;
const HOLO_RECT = `<rect x="0" y="0" width="120" height="120" fill="url(#zapHolo)"/>`;

const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">${DEFS}${body}</svg>`;

const render = (name, body, size = 1024) => {
  const png = new Resvg(svg(body), { fitTo: { mode: "width", value: size }, background: "rgba(0,0,0,0)" }).render().asPng();
  writeFileSync(out(name), png);
  console.log("wrote", name, size);
};

const iconBody = HOLO_RECT + `<g transform="translate(60 60) scale(1.25) translate(-60 -60)">${bolt()}</g>`;
render("icon.png", iconBody);
render("splash-icon.png", DISC + bolt() + SPARKLE);
render("android-icon-foreground.png", bolt());
render("android-icon-background.png", HOLO_RECT);
render("android-icon-monochrome.png", bolt("#FFFFFF"));
render("favicon.png", iconBody, 48);
