import sharp from "sharp";
const dente = "M30 22 C38 16 46 22 50 22 C54 22 62 16 70 22 C80 30 76 48 72 58 C69 66 68 80 63 82 C58 84 57 66 50 66 C43 66 42 84 37 82 C32 80 31 66 28 58 C24 48 20 30 30 22 Z";
const icone = (s, r) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 100 100">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2D27A"/><stop offset="1" stop-color="#A8811F"/></linearGradient></defs>
<rect width="100" height="100" rx="${r}" fill="#050505"/>
<rect x="5" y="5" width="90" height="90" rx="${Math.max(r - 4, 0)}" fill="none" stroke="#2A261D" stroke-width="1.5"/>
<path d="${dente}" fill="none" stroke="url(#g)" stroke-width="4.5" stroke-linejoin="round"/>
<path d="M40 34 C44 31 47 32 50 34" fill="none" stroke="#F5F2EA" stroke-width="2.5" stroke-linecap="round" opacity=".85"/>
</svg>`;
await sharp(Buffer.from(icone(512, 22))).png().toFile("public/icone-512.png");
await sharp(Buffer.from(icone(192, 22))).png().toFile("public/icone-192.png");
await sharp(Buffer.from(icone(180, 0))).png().toFile("public/apple-touch-icon.png");
await sharp(Buffer.from(icone(512, 0))).png().toFile("public/icone-mascara-512.png");
await sharp(Buffer.from(icone(64, 22))).png().toFile("src/app/icon.png");
const carimbo = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="150" viewBox="0 0 720 150">
<rect x="3" y="3" width="714" height="144" rx="14" fill="#050505" fill-opacity=".86" stroke="#E2B84C" stroke-width="5"/>
<circle cx="62" cy="75" r="15" fill="#E2B84C"/>
<text x="104" y="103" font-family="Consolas, 'Courier New', monospace" font-weight="700" font-size="84" letter-spacing="9" fill="#E2B84C">SIMULAÇÃO</text>
</svg>`;
await sharp(Buffer.from(carimbo)).png().toFile("public/carimbo-simulacao.png");
console.log("arte ok");
