import "server-only";
import { PDFDocument, PDFFont, rgb, StandardFonts } from "pdf-lib";
import sharp from "sharp";

function limpo(texto: string) {
  return texto
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7E -ÿ\n]/g, "");
}

function quebrar(texto: string, fonte: PDFFont, tamanho: number, largura: number) {
  const linhas: string[] = [];
  for (const paragrafo of limpo(texto).split("\n")) {
    let atual = "";
    for (const palavra of paragrafo.split(/\s+/)) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (fonte.widthOfTextAtSize(tentativa, tamanho) > largura && atual) {
        linhas.push(atual);
        atual = palavra;
      } else atual = tentativa;
    }
    linhas.push(atual);
  }
  return linhas;
}

export async function pdfDaProposta(d: {
  clinica: string;
  dentista: string;
  logo?: Buffer | null;
  paciente: string;
  titulo: string;
  texto: string;
  valor: string;
  data: string;
  antes: Buffer;
  depois: Buffer;
}) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(limpo(`Proposta de tratamento - ${d.paciente}`));
  const pagina = pdf.addPage([595.28, 841.89]);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const preto = rgb(0.03, 0.03, 0.03);
  const cinza = rgb(0.42, 0.4, 0.36);
  const ouro = rgb(0.66, 0.51, 0.12);
  const M = 44;
  const L = 595.28 - M * 2;
  let y = 841.89 - M;

  pagina.drawRectangle({ x: 0, y: 841.89 - 8, width: 595.28, height: 8, color: ouro });

  let xTitulo = M;
  if (d.logo) {
    try {
      const png = await sharp(d.logo).resize({ height: 120, withoutEnlargement: true }).png().toBuffer();
      const img = await pdf.embedPng(png);
      const h = 40;
      const w = (img.width / img.height) * h;
      pagina.drawImage(img, { x: M, y: y - h, width: w, height: h });
      xTitulo = M + w + 12;
    } catch {}
  }
  pagina.drawText(limpo(d.clinica || d.dentista), { x: xTitulo, y: y - 18, size: 16, font: negrito, color: preto });
  if (d.clinica && d.dentista) pagina.drawText(limpo(d.dentista), { x: xTitulo, y: y - 34, size: 10, font: normal, color: cinza });
  y -= 64;

  pagina.drawText("PROPOSTA DE TRATAMENTO", { x: M, y, size: 9, font: negrito, color: ouro });
  y -= 24;
  for (const linha of quebrar(d.titulo, negrito, 22, L)) {
    pagina.drawText(linha, { x: M, y, size: 22, font: negrito, color: preto });
    y -= 27;
  }
  pagina.drawText(limpo(`Paciente: ${d.paciente}   |   ${d.data}`), { x: M, y, size: 10, font: normal, color: cinza });
  y -= 22;

  const antes = await pdf.embedJpg(await sharp(d.antes).resize({ width: 1100, withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer());
  const depois = await pdf.embedJpg(await sharp(d.depois).resize({ width: 1100, withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer());
  const vao = 12;
  const lw = (L - vao) / 2;
  const lh = Math.min((antes.height / antes.width) * lw, 330);
  const lwReal = (antes.width / antes.height) * lh;
  const deslocamento = (lw - lwReal) / 2;
  pagina.drawImage(antes, { x: M + deslocamento, y: y - lh, width: lwReal, height: lh });
  pagina.drawImage(depois, { x: M + lw + vao + deslocamento, y: y - lh, width: lwReal, height: lh });
  y -= lh + 14;
  pagina.drawText("ANTES", { x: M, y, size: 9, font: negrito, color: cinza });
  pagina.drawText(limpo("DEPOIS (SIMULAÇÃO)"), { x: M + lw + vao, y, size: 9, font: negrito, color: ouro });
  y -= 26;

  for (const linha of quebrar(d.texto, normal, 11.5, L)) {
    if (y < 150) break;
    pagina.drawText(linha, { x: M, y, size: 11.5, font: normal, color: preto });
    y -= 16.5;
  }

  if (d.valor) {
    y -= 12;
    pagina.drawRectangle({ x: M, y: y - 50, width: L, height: 58, color: rgb(0.97, 0.95, 0.9), borderColor: ouro, borderWidth: 1 });
    pagina.drawText("INVESTIMENTO", { x: M + 14, y: y - 12, size: 9, font: negrito, color: cinza });
    pagina.drawText(limpo(d.valor), { x: M + 14, y: y - 38, size: 20, font: negrito, color: preto });
  }

  const aviso =
    "As imagens de \"depois\" são simulações ilustrativas geradas por computador para apoiar a conversa sobre o tratamento. Não representam promessa nem garantia de resultado. O resultado real depende de avaliação clínica, das condições de cada paciente e do plano de tratamento definido pelo cirurgião-dentista.";
  let ya = 86;
  pagina.drawLine({ start: { x: M, y: ya + 14 }, end: { x: M + L, y: ya + 14 }, thickness: 0.6, color: rgb(0.85, 0.83, 0.78) });
  for (const linha of quebrar(aviso, normal, 8.5, L)) {
    pagina.drawText(linha, { x: M, y: ya, size: 8.5, font: normal, color: cinza });
    ya -= 11.5;
  }
  return Buffer.from(await pdf.save());
}
