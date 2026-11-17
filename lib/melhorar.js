'use strict';
// IA 4K de Fotos — correção automática sem IA generativa.
// Só mexe em cor global, luz, ruído, nitidez e tamanho. Não redesenha nada:
// forma, posição e textura do dente continuam sendo os da foto original.

const sharp = require('sharp');

// Maior lado da foto de trabalho e do arquivo final.
const LADO_MAXIMO_ENTRADA = 3200;
const LADO_ALVO_UPSCALE = 2160;
const ESCALA_MAXIMA = 2;

// Cada tipo de foto muda só a intensidade das etapas.
//  wb        força da correção de cor (0 a 1)
//  gmin/gmax limites do ganho por canal (evita virar azulado/esverdeado)
//  alvo      brilho mediano desejado (0 a 1)
//  contraste curva em S leve (0 a 1)
//  cromaDen  suavização do ruído de cor (0 a 1)
//  lumaDen   suavização do ruído de luz (0 a 1)
//  nitidez   força do foco fino
//  clareza   força do contraste local (textura)
const PERFIS = {
  intraoral: {
    rotulo: 'Dentes de perto',
    wb: 0.85, gmin: 0.75, gmax: 1.3, alvo: 0.42, contraste: 0.8,
    cromaDen: 0.75, lumaDen: 0.25, nitidez: 1.0, clareza: 0.5,
  },
  sorriso: {
    rotulo: 'Sorriso ou rosto',
    wb: 0.7, gmin: 0.8, gmax: 1.25, alvo: 0.40, contraste: 0.7,
    cromaDen: 0.7, lumaDen: 0.25, nitidez: 0.8, clareza: 0.35,
  },
  antes_depois: {
    rotulo: 'Antes e depois',
    wb: 0.6, gmin: 0.85, gmax: 1.2, alvo: 0.40, contraste: 0.6,
    cromaDen: 0.6, lumaDen: 0.2, nitidez: 0.7, clareza: 0.3,
  },
  ambiente: {
    rotulo: 'Consultório',
    wb: 0.6, gmin: 0.8, gmax: 1.25, alvo: 0.42, contraste: 0.7,
    cromaDen: 0.6, lumaDen: 0.2, nitidez: 0.6, clareza: 0.4,
  },
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function luma(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// Estima o ganho de cada canal usando só pixels claros e pouco saturados
// (dentes, esclera, parede). Lábio e gengiva são saturados e ficam de fora,
// senão a foto toda seria "corrigida" pra tirar o vermelho da boca.
function estimarGanhos(px, n, perfil) {
  const ys = new Float32Array(n);
  for (let i = 0; i < n; i++) ys[i] = luma(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]);
  const ord = Float32Array.from(ys).sort();
  const p60 = ord[Math.floor(n * 0.6)];
  const p995 = ord[Math.floor(n * 0.995)];

  let sr = 0, sg = 0, sb = 0, c = 0;
  for (let i = 0; i < n; i++) {
    const r = px[i * 3], g = px[i * 3 + 1], b = px[i * 3 + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const sat = mx ? (mx - mn) / mx : 0;
    if (ys[i] >= p60 && ys[i] <= p995 && sat < 0.35 && mx < 250) {
      sr += r; sg += g; sb += b; c++;
    }
  }
  let origem = 'pixels claros';
  if (c < n * 0.02) {
    // Plano B: média cinza só dos pixels pouco saturados.
    sr = sg = sb = c = 0;
    for (let i = 0; i < n; i++) {
      const r = px[i * 3], g = px[i * 3 + 1], b = px[i * 3 + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx && (mx - mn) / mx < 0.6 && ys[i] > 20) { sr += r; sg += g; sb += b; c++; }
    }
    origem = 'media cinza';
  }
  if (c < n * 0.02) return { gains: [1, 1, 1], origem: 'sem referencia' };

  const mr = sr / c, mg = sg / c, mb = sb / c;
  const m = (mr + mg + mb) / 3;
  let g = [m / mr, m / mg, m / mb].map((x) => clamp(1 + perfil.wb * (x - 1), perfil.gmin, perfil.gmax));
  // mantém o brilho geral: a correção de cor não pode clarear nem escurecer.
  const k = luma(g[0], g[1], g[2]);
  g = g.map((x) => x / k);
  return { gains: g, origem };
}

// Curva de tom: níveis (preto e branco) + gama pro brilho mediano ir ao alvo.
function estimarTom(px, n, gains, perfil) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) {
    const r = Math.min(255, px[i * 3] * gains[0]);
    const g = Math.min(255, px[i * 3 + 1] * gains[1]);
    const b = Math.min(255, px[i * 3 + 2] * gains[2]);
    hist[Math.round(luma(r, g, b))]++;
  }
  const pct = (p) => {
    const alvo = n * p;
    let acc = 0;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= alvo) return v; }
    return 255;
  };
  const p1 = pct(0.01), p50 = pct(0.5), p997 = pct(0.997);
  const lo = clamp(p1 * 0.8, 0, 40);
  const hi = clamp(p997, 200, 255);
  const med01 = clamp((p50 - lo) / (hi - lo), 0.02, 0.98);
  const gama = clamp(Math.log(perfil.alvo) / Math.log(med01), 0.85, 1.3);
  return { lo, hi, gama };
}

function montarLUTs(gains, tom, perfil) {
  const luts = [new Uint8Array(256), new Uint8Array(256), new Uint8Array(256)];
  for (let c = 0; c < 3; c++) {
    for (let v = 0; v < 256; v++) {
      const x = clamp((Math.min(255, v * gains[c]) - tom.lo) / (tom.hi - tom.lo), 0, 1);
      // O gama age nas sombras e meios-tons e some perto do branco: o dente não estoura.
      const t = x + (Math.pow(x, tom.gama) - x) * (1 - x);
      const s = t * t * (3 - 2 * t);
      const y = t + (s - t) * perfil.contraste * 0.3;
      luts[c][v] = Math.round(clamp(y, 0, 1) * 243 + 3); // 3..246: sem preto chapado nem branco estourado
    }
  }
  return luts;
}

// Uma passada: denoise (cor e luz) + correção de cor + curva de tom.
function aplicar(full, low, med, luts, perfil) {
  const out = Buffer.allocUnsafe(full.length);
  const cd = perfil.cromaDen, ld = perfil.lumaDen;
  for (let i = 0; i < full.length; i += 3) {
    const fr = full[i], fg = full[i + 1], fb = full[i + 2];
    const lr = low[i], lg = low[i + 1], lb = low[i + 2];
    const mr = med[i], mg = med[i + 1], mb = med[i + 2];

    const yF = luma(fr, fg, fb), yM = luma(mr, mg, mb);
    const y = yF + (yM - yF) * ld;

    const cbF = -0.168736 * fr - 0.331264 * fg + 0.5 * fb;
    const crF = 0.5 * fr - 0.418688 * fg - 0.081312 * fb;
    const cbL = -0.168736 * lr - 0.331264 * lg + 0.5 * lb;
    const crL = 0.5 * lr - 0.418688 * lg - 0.081312 * lb;
    const cb = cbF + (cbL - cbF) * cd;
    const cr = crF + (crL - crF) * cd;

    const r = clamp(y + 1.402 * cr, 0, 255);
    const g = clamp(y - 0.344136 * cb - 0.714136 * cr, 0, 255);
    const b = clamp(y + 1.772 * cb, 0, 255);

    out[i] = luts[0][r | 0];
    out[i + 1] = luts[1][g | 0];
    out[i + 2] = luts[2][b | 0];
  }
  return out;
}

async function melhorar(bufferEntrada, tipo) {
  const perfil = PERFIS[tipo] || PERFIS.sorriso;

  // 1) Lê, corrige a rotação do celular e limita o tamanho de trabalho.
  const base = await sharp(bufferEntrada, { limitInputPixels: 120e6, failOn: 'error' })
    .rotate()
    .resize({ width: LADO_MAXIMO_ENTRADA, height: LADO_MAXIMO_ENTRADA, fit: 'inside', withoutEnlargement: true })
    .removeAlpha()
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = base.info;
  const raw = { raw: { width: w, height: h, channels: 3 } };

  // 2) Versões auxiliares: cor suavizada e luz suavizada.
  const [low, med, amostra] = await Promise.all([
    sharp(base.data, raw)
      .resize(Math.max(8, Math.round(w / 4)), Math.max(8, Math.round(h / 4)), { kernel: 'lanczos3' })
      .blur(1.2)
      .resize(w, h, { kernel: 'cubic' })
      .raw().toBuffer(),
    sharp(base.data, raw).median(3).raw().toBuffer(),
    sharp(base.data, raw).resize({ width: 320, height: 320, fit: 'inside' }).raw().toBuffer({ resolveWithObject: true }),
  ]);

  // 3) Mede a foto e monta as curvas.
  const nAm = amostra.info.width * amostra.info.height;
  const { gains, origem } = estimarGanhos(amostra.data, nAm, perfil);
  const tom = estimarTom(amostra.data, nAm, gains, perfil);
  const luts = montarLUTs(gains, tom, perfil);
  const corrigida = aplicar(base.data, low, med, luts, perfil);

  // 4) Aumento leve: só se a foto for pequena, no máximo 2x.
  const lado = Math.max(w, h);
  const escala = lado < LADO_ALVO_UPSCALE ? Math.min(ESCALA_MAXIMA, LADO_ALVO_UPSCALE / lado) : 1;
  const wf = Math.round(w * escala), hf = Math.round(h * escala);

  // 5) Foco fino + contraste local (o sharpen do sharp só mexe na luz, sem halo de cor).
  let pipe = sharp(corrigida, raw);
  if (escala > 1) pipe = pipe.resize(wf, hf, { kernel: 'lanczos3' });
  const n = perfil.nitidez;
  const saida = await pipe
    .sharpen({ sigma: 1.0, m1: 0.05 * n, m2: 0.8 * n, x1: 3, y2: 10, y3: 14 })
    .sharpen({ sigma: 9, m1: 0, m2: 0.5 * perfil.clareza, x1: 3, y2: 8, y3: 8 })
    .jpeg({ quality: 92, mozjpeg: true, chromaSubsampling: '4:4:4' }) // sem EXIF/GPS no arquivo final
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: saida.data,
    info: {
      tipo: PERFIS[tipo] ? tipo : 'sorriso',
      largura: saida.info.width,
      altura: saida.info.height,
      escala: Number(escala.toFixed(2)),
      ganhos: gains.map((x) => Number(x.toFixed(3))),
      referenciaDeCor: origem,
      niveis: { preto: Math.round(tom.lo), branco: Math.round(tom.hi), gama: Number(tom.gama.toFixed(2)) },
    },
  };
}

module.exports = { melhorar, PERFIS };
