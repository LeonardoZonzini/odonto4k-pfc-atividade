import type { FaceLandmarker } from "@mediapipe/tasks-vision";

export type Pt = { x: number; y: number };

export type Marcos = {
  pupilaE: Pt;
  pupilaD: Pt;
  comissuraE: Pt;
  comissuraD: Pt;
  cantoIntE: Pt;
  cantoIntD: Pt;
  labioSup: Pt;
  labioInf: Pt;
  faceE: Pt;
  faceD: Pt;
  irisPx: number;
  bocaInterna: Pt[];
  bocaExterna: Pt[];
};

export type Editaveis = {
  pupilaE: Pt;
  pupilaD: Pt;
  comissuraE: Pt;
  comissuraD: Pt;
  medianaDental: Pt;
};

export type Segmentacao = {
  x: number;
  y: number;
  w: number;
  h: number;
  alfa: Float32Array;
  area: number;
  dentesMinX: number;
  dentesMaxX: number;
  topoDentes: number;
  medianaSugerida: Pt | null;
  gengivaPx: number | null;
  mediaL: number;
  mediaB: number;
};

export type Medidas = {
  pxPorMm: number;
  bipupilarGraus: number;
  comissuraGraus: number;
  desvioMedianaMm: number;
  larguraSorrisoMm: number;
  larguraSorrisoPct: number;
  corredorPct: number | null;
  gengivaMm: number | null;
};

const LABIO_INT = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
const LABIO_EXT = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
const IRIS_MM = 11.7;

let detector: Promise<FaceLandmarker> | null = null;

function obterDetector() {
  detector ??= (async () => {
    const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const arquivos = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
    const opcoes = (delegate: "GPU" | "CPU") => ({
      baseOptions: { modelAssetPath: "/mediapipe/face_landmarker.task", delegate },
      runningMode: "IMAGE" as const,
      numFaces: 1,
    });
    try {
      return await FaceLandmarker.createFromOptions(arquivos, opcoes("GPU"));
    } catch {
      return await FaceLandmarker.createFromOptions(arquivos, opcoes("CPU"));
    }
  })();
  detector.catch(() => (detector = null));
  return detector;
}

export function preaquecer() {
  void obterDetector().catch(() => {});
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

export async function detectarRosto(fonte: HTMLCanvasElement | HTMLImageElement, largura: number, altura: number): Promise<Marcos | null> {
  const d = await obterDetector();
  const r = d.detect(fonte);
  const lm = r.faceLandmarks?.[0];
  if (!lm || lm.length < 478) return null;
  const p = (i: number): Pt => ({ x: lm[i].x * largura, y: lm[i].y * altura });
  const ordenar = (a: Pt, b: Pt): [Pt, Pt] => (a.x <= b.x ? [a, b] : [b, a]);
  const [pupilaE, pupilaD] = ordenar(p(468), p(473));
  const [comissuraE, comissuraD] = ordenar(p(61), p(291));
  const [cantoIntE, cantoIntD] = ordenar(p(78), p(308));
  const [faceE, faceD] = ordenar(p(234), p(454));
  const irisPx = (dist(p(469), p(471)) + dist(p(474), p(476))) / 2;
  return {
    pupilaE,
    pupilaD,
    comissuraE,
    comissuraD,
    cantoIntE,
    cantoIntD,
    labioSup: p(13),
    labioInf: p(14),
    faceE,
    faceD,
    irisPx,
    bocaInterna: LABIO_INT.map(p),
    bocaExterna: LABIO_EXT.map(p),
  };
}

function rgbParaLab(r: number, g: number, b: number): [number, number, number] {
  const lin = (c: number) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const R = lin(r), G = lin(g), B = lin(b);
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const X = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
  const Y = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
  const Z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}

function labParaRgb(L: number, a: number, b: number): [number, number, number] {
  const fy = (L + 16) / 116, fx = a / 500 + fy, fz = fy - b / 200;
  const inv = (t: number) => (t * t * t > 0.008856 ? t * t * t : (t - 16 / 116) / 7.787);
  const X = inv(fx) * 0.95047, Y = inv(fy), Z = inv(fz) * 1.08883;
  const gam = (c: number) => {
    c = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(c * 255)));
  };
  return [gam(X * 3.2406 - Y * 1.5372 - Z * 0.4986), gam(-X * 0.9689 + Y * 1.8758 + Z * 0.0415), gam(X * 0.0557 - Y * 0.204 + Z * 1.057)];
}

function desfocar(origem: Float32Array, w: number, h: number, raio: number) {
  if (raio < 1) return origem;
  const tmp = new Float32Array(origem.length);
  const saida = new Float32Array(origem.length);
  const janela = raio * 2 + 1;
  for (let y = 0; y < h; y++) {
    let soma = 0;
    for (let x = -raio; x <= raio; x++) soma += origem[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = soma / janela;
      soma += origem[y * w + Math.min(w - 1, x + raio + 1)] - origem[y * w + Math.max(0, x - raio)];
    }
  }
  for (let x = 0; x < w; x++) {
    let soma = 0;
    for (let y = -raio; y <= raio; y++) soma += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      saida[y * w + x] = soma / janela;
      soma += tmp[Math.min(h - 1, y + raio + 1) * w + x] - tmp[Math.max(0, y - raio) * w + x];
    }
  }
  return saida;
}

export function segmentarDentes(ctx: CanvasRenderingContext2D, m: Marcos, largura: number, altura: number): Segmentacao | null {
  const xs = m.bocaInterna.map((p) => p.x), ys = m.bocaInterna.map((p) => p.y);
  const folga = Math.max(3, Math.round(m.irisPx * 0.15));
  const x = Math.max(0, Math.floor(Math.min(...xs)) - folga);
  const y = Math.max(0, Math.floor(Math.min(...ys)) - folga);
  const w = Math.min(largura, Math.ceil(Math.max(...xs)) + folga) - x;
  const h = Math.min(altura, Math.ceil(Math.max(...ys)) + folga) - y;
  if (w < 12 || h < 6) return null;

  const tela = document.createElement("canvas");
  tela.width = w;
  tela.height = h;
  const c2 = tela.getContext("2d", { willReadFrequently: true })!;
  c2.beginPath();
  m.bocaInterna.forEach((p, i) => (i ? c2.lineTo(p.x - x, p.y - y) : c2.moveTo(p.x - x, p.y - y)));
  c2.closePath();
  c2.fillStyle = "#fff";
  c2.fill();
  const dentro = c2.getImageData(0, 0, w, h).data;
  const px = ctx.getImageData(x, y, w, h).data;

  const n = w * h;
  const Ls = new Float32Array(n), As = new Float32Array(n), Bs = new Float32Array(n), nota = new Float32Array(n);
  const dentroMask = new Uint8Array(n);
  let minimo = Infinity, maximo = -Infinity, total = 0;
  for (let i = 0; i < n; i++) {
    if (dentro[i * 4 + 3] < 128) continue;
    dentroMask[i] = 1;
    const [L, a, b] = rgbParaLab(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
    Ls[i] = L; As[i] = a; Bs[i] = b;
    const s = L - 1.7 * Math.max(a, 0);
    nota[i] = s;
    if (s < minimo) minimo = s;
    if (s > maximo) maximo = s;
    total++;
  }
  if (total < 60 || maximo - minimo < 8) return null;

  const hist = new Float64Array(64);
  for (let i = 0; i < n; i++) if (dentroMask[i]) hist[Math.min(63, Math.floor(((nota[i] - minimo) / (maximo - minimo)) * 64))]++;
  let somaTotal = 0;
  for (let i = 0; i < 64; i++) somaTotal += i * hist[i];
  let somaB = 0, pesoB = 0, melhor = 0, corte = 32;
  for (let i = 0; i < 64; i++) {
    pesoB += hist[i];
    if (!pesoB) continue;
    const pesoF = total - pesoB;
    if (!pesoF) break;
    somaB += i * hist[i];
    const entre = pesoB * pesoF * Math.pow(somaB / pesoB - (somaTotal - somaB) / pesoF, 2);
    if (entre > melhor) {
      melhor = entre;
      corte = i;
    }
  }
  const limiar = minimo + ((corte + 1) / 64) * (maximo - minimo);

  const bruto = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (!dentroMask[i]) continue;
    const dente = (nota[i] > limiar || (Ls[i] > 58 && As[i] < 10)) && As[i] < 19 && Ls[i] > 30;
    if (dente) bruto[i] = 1;
  }
  const raio = Math.max(1, Math.round(m.irisPx * 0.035));
  const suave = desfocar(bruto, w, h, raio);
  const alfa = new Float32Array(n);
  let area = 0, minX = w, maxX = 0, somaL = 0, somaBb = 0;
  for (let i = 0; i < n; i++) {
    const v = Math.min(1, Math.max(0, (suave[i] - 0.3) / 0.4));
    const a = v * v * (3 - 2 * v);
    alfa[i] = dentroMask[i] ? a : a * 0.5;
    if (a > 0.5) {
      area++;
      const cx = i % w;
      if (cx < minX) minX = cx;
      if (cx > maxX) maxX = cx;
      somaL += Ls[i];
      somaBb += Bs[i];
    }
  }
  if (area < 40) return null;

  const pxPorMm = m.irisPx / IRIS_MM;
  const centroX = Math.round((m.pupilaE.x + m.pupilaD.x) / 2 - x);
  const faixa = Math.max(3, Math.round(pxPorMm * 4.5));
  const colunas: number[] = [];
  let topoDentes = h;
  for (let cx = Math.max(1, centroX - faixa); cx <= Math.min(w - 2, centroX + faixa); cx++) {
    for (let cy = 0; cy < h; cy++) {
      if (alfa[cy * w + cx] > 0.5) {
        if (cy < topoDentes) topoDentes = cy;
        break;
      }
    }
  }
  let medianaSugerida: Pt | null = null;
  if (topoDentes < h) {
    const alturaFaixa = Math.max(4, Math.round(pxPorMm * 7));
    const inicio = Math.max(1, centroX - faixa), fim = Math.min(w - 2, centroX + faixa);
    for (let cx = inicio; cx <= fim; cx++) {
      let soma = 0;
      for (let cy = topoDentes; cy < Math.min(h, topoDentes + alturaFaixa); cy++) soma += bruto[cy * w + cx] * Ls[cy * w + cx];
      colunas.push(soma);
    }
    let menor = Infinity, maior = -Infinity, indice = -1;
    for (let i = 1; i < colunas.length - 1; i++) {
      const v = (colunas[i - 1] + colunas[i] * 2 + colunas[i + 1]) / 4;
      if (v > maior) maior = v;
      if (v < menor) {
        menor = v;
        indice = i;
      }
    }
    const bordaOk = indice > 2 && indice < colunas.length - 3;
    const mx = maior > 0 && (maior - menor) / maior > 0.1 && bordaOk ? inicio + indice : centroX;
    medianaSugerida = { x: mx + x, y: topoDentes + y + alturaFaixa / 2 };
  }

  let gengivaPx: number | null = null;
  if (medianaSugerida && topoDentes < h) {
    const cxm = Math.round(medianaSugerida.x - x);
    const meia = Math.max(2, Math.round(pxPorMm * 3.5));
    const alturas: number[] = [];
    for (let cx = Math.max(0, cxm - meia); cx <= Math.min(w - 1, cxm + meia); cx++) {
      let gengiva = 0, achou = false;
      for (let cy = 0; cy < h; cy++) {
        const i = cy * w + cx;
        if (!dentroMask[i]) continue;
        if (alfa[i] > 0.5) {
          achou = true;
          break;
        }
        if (As[i] > 11 && Ls[i] > 22) gengiva++;
      }
      if (achou) alturas.push(gengiva);
    }
    if (alturas.length) {
      alturas.sort((a, b) => a - b);
      gengivaPx = alturas[Math.floor(alturas.length / 2)];
    }
  }

  return {
    x, y, w, h, alfa, area,
    dentesMinX: minX + x,
    dentesMaxX: maxX + x,
    topoDentes: topoDentes + y,
    medianaSugerida,
    gengivaPx,
    mediaL: somaL / area,
    mediaB: somaBb / area,
  };
}

export function clarear(original: ImageData, seg: Segmentacao, nivel: number): ImageData {
  const saida = new ImageData(new Uint8ClampedArray(original.data), original.width, original.height);
  if (nivel <= 0) return saida;
  const t = nivel / 6;
  const d = saida.data;
  for (let i = 0; i < seg.alfa.length; i++) {
    const a = seg.alfa[i];
    if (a < 0.02) continue;
    const [L, A, B] = rgbParaLab(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
    const k = a * t;
    const L2 = Math.min(97, L + k * (20 * Math.pow(Math.max(0, 1 - L / 100), 0.6) + 4));
    const [r, g, b] = labParaRgb(L2, A * (1 - k * 0.5), B * (1 - k * 0.82));
    d[i * 4] = r;
    d[i * 4 + 1] = g;
    d[i * 4 + 2] = b;
  }
  return saida;
}

export function tomSugerido(seg: Segmentacao) {
  const amarelo = Math.max(0, seg.mediaB - 6) / 4;
  const escuro = Math.max(0, 74 - seg.mediaL) / 7;
  return Math.max(1, Math.min(5, Math.round(1 + (amarelo + escuro) / 2)));
}

export function pontosIniciais(m: Marcos, seg: Segmentacao | null): Editaveis {
  const meio = { x: (m.pupilaE.x + m.pupilaD.x) / 2, y: (m.labioSup.y + m.labioInf.y) / 2 };
  return {
    pupilaE: m.pupilaE,
    pupilaD: m.pupilaD,
    comissuraE: m.comissuraE,
    comissuraD: m.comissuraD,
    medianaDental: seg?.medianaSugerida || projetarNaMediana(m.pupilaE, m.pupilaD, meio),
  };
}

export function medianaFacial(pe: Pt, pd: Pt) {
  const centro = { x: (pe.x + pd.x) / 2, y: (pe.y + pd.y) / 2 };
  const dx = pd.x - pe.x, dy = pd.y - pe.y;
  const tam = Math.hypot(dx, dy) || 1;
  return { centro, dir: { x: -dy / tam, y: dx / tam }, eixo: { x: dx / tam, y: dy / tam } };
}

function projetarNaMediana(pe: Pt, pd: Pt, p: Pt): Pt {
  const { centro, dir } = medianaFacial(pe, pd);
  const t = (p.x - centro.x) * dir.x + (p.y - centro.y) * dir.y;
  return { x: centro.x + dir.x * t, y: centro.y + dir.y * t };
}

export function medir(m: Marcos, e: Editaveis, seg: Segmentacao | null): Medidas {
  const pxPorMm = m.irisPx / IRIS_MM;
  const grau = (a: Pt, b: Pt) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  const bip = grau(e.pupilaE, e.pupilaD);
  const com = grau(e.comissuraE, e.comissuraD) - bip;
  const { centro, eixo } = medianaFacial(e.pupilaE, e.pupilaD);
  const desvioPx = (e.medianaDental.x - centro.x) * eixo.x + (e.medianaDental.y - centro.y) * eixo.y;
  const larguraPx = dist(e.comissuraE, e.comissuraD);
  const facePx = dist(m.faceE, m.faceD) || 1;
  let corredor: number | null = null;
  if (seg) {
    const interno = dist(m.cantoIntE, m.cantoIntD) || 1;
    corredor = Math.max(0, Math.min(60, (1 - (seg.dentesMaxX - seg.dentesMinX) / interno) * 100));
  }
  return {
    pxPorMm,
    bipupilarGraus: bip,
    comissuraGraus: com,
    desvioMedianaMm: desvioPx / pxPorMm,
    larguraSorrisoMm: larguraPx / pxPorMm,
    larguraSorrisoPct: (larguraPx / facePx) * 100,
    corredorPct: corredor,
    gengivaMm: seg && seg.gengivaPx !== null ? seg.gengivaPx / pxPorMm : null,
  };
}

export function carregarImagem(url: string) {
  return new Promise<HTMLImageElement>((ok, falha) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => falha(new Error("imagem"));
    img.src = url;
  });
}

export function ajustarPixels(dados: ImageData, brilho: number, contraste: number, saturacao: number) {
  const d = dados.data;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] * brilho, g = d[i + 1] * brilho, b = d[i + 2] * brilho;
    r = (r - 127.5) * contraste + 127.5;
    g = (g - 127.5) * contraste + 127.5;
    b = (b - 127.5) * contraste + 127.5;
    const cinza = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    d[i] = cinza + (r - cinza) * saturacao;
    d[i + 1] = cinza + (g - cinza) * saturacao;
    d[i + 2] = cinza + (b - cinza) * saturacao;
  }
  return dados;
}
