import "server-only";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { ARQUIVOS_DIR } from "./db";

export function caminhoAbsoluto(relativo: string) {
  const abs = path.resolve(ARQUIVOS_DIR, relativo);
  if (!abs.startsWith(ARQUIVOS_DIR + path.sep)) throw new Error("caminho inválido");
  return abs;
}

export async function salvarArquivo(relativo: string, dados: Buffer) {
  const abs = caminhoAbsoluto(relativo);
  await fs.promises.mkdir(path.dirname(abs), { recursive: true });
  await fs.promises.writeFile(abs, dados);
  return relativo;
}

export async function lerArquivo(relativo: string) {
  return fs.promises.readFile(caminhoAbsoluto(relativo));
}

export async function apagarPasta(relativo: string) {
  await fs.promises.rm(caminhoAbsoluto(relativo), { recursive: true, force: true });
}

export async function normalizarFoto(entrada: Buffer, maximo = 1800) {
  const img = sharp(entrada, { failOn: "none" }).rotate();
  const { data, info } = await img
    .resize({ width: maximo, height: maximo, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  return { dados: data, largura: info.width, altura: info.height };
}

let carimboBase: Buffer | null = null;

export async function carimbar(entrada: Buffer) {
  carimboBase ??= await fs.promises.readFile(path.join(process.cwd(), "public", "carimbo-simulacao.png"));
  const meta = await sharp(entrada).metadata();
  const w = meta.width || 1000;
  const h = meta.height || 1000;
  const largura = Math.round(Math.max(120, Math.min(w * 0.3, 360)));
  const selo = await sharp(carimboBase).resize({ width: largura }).toBuffer();
  const margem = Math.round(Math.min(w, h) * 0.025);
  const seloMeta = await sharp(selo).metadata();
  return sharp(entrada)
    .composite([{ input: selo, left: margem, top: h - (seloMeta.height || 40) - margem }])
    .jpeg({ quality: 90 })
    .toBuffer();
}

export async function melhorarFoto(entrada: Buffer) {
  const base = sharp(entrada, { failOn: "none" }).rotate();
  const meta = await base.metadata();
  const maior = Math.max(meta.width || 0, meta.height || 0);
  const alvo = Math.min(2160, Math.max(maior, Math.min(maior * 2, 2160)));
  const reduzida = await base
    .clone()
    .resize({ width: 64, height: 64, fit: "inside" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let r = 0, g = 0, b = 0;
  const n = reduzida.info.width * reduzida.info.height;
  for (let i = 0; i < n; i++) {
    r += reduzida.data[i * 3];
    g += reduzida.data[i * 3 + 1];
    b += reduzida.data[i * 3 + 2];
  }
  r /= n; g /= n; b /= n;
  const cinza = (r + g + b) / 3 || 1;
  const forca = 0.6;
  const ganho = (c: number) => 1 + (cinza / (c || 1) - 1) * forca;
  const lum = cinza / 255;
  const gama = lum < 0.38 ? 1.25 : lum < 0.48 ? 1.12 : 1;
  const saida = await base
    .resize({ width: alvo, height: alvo, fit: "inside", kernel: "lanczos3" })
    .median(3)
    .recomb([
      [ganho(r), 0, 0],
      [0, ganho(g), 0],
      [0, 0, ganho(b)],
    ])
    .normalise({ lower: 1, upper: 99.5 })
    .gamma(gama)
    .modulate({ saturation: 1.06 })
    .sharpen({ sigma: 1.1, m1: 0.6, m2: 2.2 })
    .jpeg({ quality: 93, mozjpeg: true })
    .toBuffer();
  return saida;
}

export type Ponto = [number, number];

export type Recorte = { x: number; y: number; lado: number };

export function recorteDaBoca(pontos: Ponto[], largura: number, altura: number): Recorte {
  const xs = pontos.map((p) => p[0]);
  const ys = pontos.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  let lado = Math.max((maxX - minX) * 2.1, (maxY - minY) * 3.2, 256);
  lado = Math.round(Math.min(lado, largura, altura));
  const x = Math.round(Math.min(Math.max(cx - lado / 2, 0), largura - lado));
  const y = Math.round(Math.min(Math.max(cy - lado / 2, 0), altura - lado));
  return { x, y, lado };
}

function expandir(pontos: Ponto[], fx: number, fy: number): Ponto[] {
  const cx = pontos.reduce((s, p) => s + p[0], 0) / pontos.length;
  const cy = pontos.reduce((s, p) => s + p[1], 0) / pontos.length;
  return pontos.map((p) => [cx + (p[0] - cx) * fx, cy + (p[1] - cy) * fy]);
}

function caminhoSvg(pontos: Ponto[], rec: Recorte, escala: number) {
  return (
    pontos.map((p, i) => `${i ? "L" : "M"}${((p[0] - rec.x) * escala).toFixed(1)} ${((p[1] - rec.y) * escala).toFixed(1)}`).join(" ") + " Z"
  );
}

export async function prepararEdicao(foto: Buffer, pontosBoca: Ponto[], tamanho = 1024) {
  const meta = await sharp(foto).metadata();
  const rec = recorteDaBoca(pontosBoca, meta.width!, meta.height!);
  const escala = tamanho / rec.lado;
  const recorte = await sharp(foto)
    .extract({ left: rec.x, top: rec.y, width: rec.lado, height: rec.lado })
    .resize(tamanho, tamanho)
    .png()
    .toBuffer();
  const area = caminhoSvg(expandir(pontosBoca, 1.12, 1.35), rec, escala);
  const mascara = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${tamanho}" height="${tamanho}"><path fill="#000" fill-rule="evenodd" d="M0 0H${tamanho}V${tamanho}H0Z ${area}"/></svg>`,
    ),
  )
    .png()
    .toBuffer();
  return { rec, recorte, mascara };
}

export async function comporResultado(foto: Buffer, gerada: Buffer, pontosBoca: Ponto[], rec: Recorte) {
  const area = caminhoSvg(expandir(pontosBoca, 1.2, 1.5), rec, 1);
  const desfoque = Math.max(2, rec.lado * 0.012);
  const alfa = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${rec.lado}" height="${rec.lado}"><rect width="100%" height="100%" fill="#000"/><path fill="#fff" d="${area}"/></svg>`,
    ),
  )
    .blur(desfoque)
    .extractChannel(0)
    .toBuffer();
  const pedaco = await sharp(gerada)
    .resize(rec.lado, rec.lado, { kernel: "lanczos3" })
    .removeAlpha()
    .joinChannel(alfa)
    .png()
    .toBuffer();
  return sharp(foto)
    .composite([{ input: pedaco, left: rec.x, top: rec.y }])
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}
