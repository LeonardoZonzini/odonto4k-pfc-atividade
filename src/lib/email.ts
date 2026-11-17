import "server-only";
import { APP_URL, primeiroNome } from "./config";

function molde(titulo: string, corpo: string, botao?: { texto: string; url: string }) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#050505;font-family:Arial,Helvetica,sans-serif;color:#F5F2EA">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#0E0D0B;border:1px solid #2A261D;border-radius:12px;padding:28px">
<tr><td style="font-size:15px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#F5F2EA;padding-bottom:20px">Odonto <span style="color:#E2B84C">4K</span></td></tr>
<tr><td style="font-size:22px;font-weight:700;line-height:1.25;color:#F5F2EA;padding-bottom:12px">${titulo}</td></tr>
<tr><td style="font-size:16px;line-height:1.55;color:#D9D3C4;padding-bottom:22px">${corpo}</td></tr>
${
  botao
    ? `<tr><td><a href="${botao.url}" style="display:block;text-align:center;background:#E2B84C;color:#130E02;font-weight:700;font-size:15px;letter-spacing:.05em;text-transform:uppercase;text-decoration:none;padding:15px;border-radius:10px">${botao.texto}</a></td></tr>`
    : ""
}
<tr><td style="font-size:12px;line-height:1.5;color:#9A9384;padding-top:22px">Você recebeu este e-mail porque tem uma conta no Odonto 4K.</td></tr>
</table></td></tr></table></body></html>`;
}

export async function enviarEmail(para: string, assunto: string, html: string) {
  const chave = process.env.RESEND_API_KEY;
  if (!chave) {
    console.log(`[email] para=${para} assunto="${assunto}"`);
    const link = html.match(/href="([^"]+)"/)?.[1];
    if (link) console.log(`[email] link: ${link}`);
    return false;
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Odonto 4K <contato@odonto4k.com.br>",
        to: [para],
        subject: assunto,
        html,
      }),
    });
    if (!r.ok) console.error("[email] falhou", r.status, await r.text());
    return r.ok;
  } catch (e) {
    console.error("[email] erro", e);
    return false;
  }
}

export function emailVerificacao(para: string, nome: string, token: string) {
  return enviarEmail(
    para,
    "Confirme seu e-mail no Odonto 4K",
    molde(
      `${primeiroNome(nome)}, confirme seu e-mail`,
      "Falta um toque para liberar sua conta por completo. O link vale por 48 horas.",
      { texto: "Confirmar e-mail", url: `${APP_URL}/verificar-email?token=${token}` },
    ),
  );
}

export function emailRedefinir(para: string, token: string) {
  return enviarEmail(
    para,
    "Redefinir sua senha do Odonto 4K",
    molde(
      "Crie uma nova senha",
      "Recebemos um pedido para trocar a senha da sua conta. O link vale por 1 hora e só funciona uma vez. Se não foi você, ignore este e-mail.",
      { texto: "Criar nova senha", url: `${APP_URL}/redefinir-senha?token=${token}` },
    ),
  );
}

export const SEQUENCIA_TESTE: { tipo: string; aposDias: number; assunto: string; titulo: string; corpo: string; botao: string }[] = [
  {
    tipo: "teste_d1",
    aposDias: 1,
    assunto: "Seu primeiro antes e depois leva 1 minuto",
    titulo: "Já mostrou um sorriso novo para um paciente?",
    corpo:
      "Abra o app, tire uma foto do paciente sorrindo e mostre o clareamento na hora. O clareamento e a análise do sorriso não gastam créditos.",
    botao: "Abrir o Odonto 4K",
  },
  {
    tipo: "teste_d3",
    aposDias: 3,
    assunto: "Lentes e alinhamento com IA: você ainda tem créditos",
    titulo: "Seus créditos de IA estão esperando",
    corpo:
      "Com um crédito você gera 3 versões do sorriso com lentes ou com os dentes alinhados. Depois é só enviar a proposta pelo WhatsApp do paciente.",
    botao: "Gerar uma simulação",
  },
  {
    tipo: "teste_d6",
    aposDias: 6,
    assunto: "Seu teste do Odonto 4K termina amanhã",
    titulo: "Seu teste termina amanhã",
    corpo:
      "Para continuar apresentando simulações e propostas aos seus pacientes, escolha um plano. Seus pacientes e planos ficam guardados.",
    botao: "Ver os planos",
  },
];

export function emailSequencia(para: string, item: (typeof SEQUENCIA_TESTE)[number]) {
  const url = item.tipo === "teste_d6" ? `${APP_URL}/app/creditos` : `${APP_URL}/app`;
  return enviarEmail(para, item.assunto, molde(item.titulo, item.corpo, { texto: item.botao, url }));
}

export function emailSuporte(de: string, assunto: string, mensagem: string) {
  const admins = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim()).filter(Boolean);
  if (!admins.length) return Promise.resolve(false);
  const seguro = mensagem.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!);
  return enviarEmail(admins[0], `[Suporte] ${assunto}`, molde(assunto, `De: ${de}<br><br>${seguro.replace(/\n/g, "<br>")}`));
}
