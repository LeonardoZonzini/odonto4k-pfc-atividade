"use server";

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { agora, DIA, evento, novoId, rodar, todos, um } from "@/lib/db";
import {
  conferirSenha,
  consumirToken,
  criarSessao,
  criarToken,
  dentroDoLimite,
  encerrarSessao,
  exigirAdmin,
  exigirUsuario,
  hashSenha,
  ipDoPedido,
} from "@/lib/auth";
import { acessoDe, lancar, Usuario } from "@/lib/creditos";
import { linkCheckout, TESTE } from "@/lib/config";
import { emailRedefinir, emailSuporte, emailVerificacao } from "@/lib/email";
import { aplicarComprasPendentes } from "@/lib/kiwify";
import { apagarDadosClinicos } from "@/lib/manutencao";
import { apagarPasta, caminhoAbsoluto, lerArquivo, normalizarFoto, salvarArquivo } from "@/lib/imagem";

export type Estado = { erro?: string; ok?: string } | undefined;

const texto = (fd: FormData, campo: string, max = 200) => String(fd.get(campo) || "").trim().slice(0, max);
const soDigitos = (s: string) => s.replace(/\D/g, "");
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

function normalizarWhats(bruto: string) {
  let d = soDigitos(bruto);
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return d;
}

export async function criarConta(_: Estado, fd: FormData): Promise<Estado> {
  const ip = await ipDoPedido();
  if (!dentroDoLimite(`cadastro:${ip}`, 6, 10 * 60 * 1000)) return { erro: "Muitas tentativas. Aguarde alguns minutos." };
  const nome = texto(fd, "nome", 80);
  const email = texto(fd, "email", 120).toLowerCase();
  const whatsapp = normalizarWhats(texto(fd, "whatsapp", 30));
  const senha = String(fd.get("senha") || "");
  if (nome.length < 3) return { erro: "Informe seu nome completo." };
  if (!emailOk(email)) return { erro: "Informe um e-mail válido." };
  if (whatsapp.length < 12 || whatsapp.length > 13) return { erro: "Informe seu WhatsApp com DDD." };
  if (senha.length < 8) return { erro: "A senha precisa ter pelo menos 8 caracteres." };
  if (!fd.get("termos")) return { erro: "Para continuar, aceite os termos de uso e a política de privacidade." };
  if (um("SELECT id FROM users WHERE email = ?", email)) return { erro: "Já existe uma conta com este e-mail. Entre ou recupere a senha." };
  if (um("SELECT id FROM users WHERE whatsapp = ?", whatsapp)) return { erro: "Já existe uma conta com este WhatsApp." };
  if (ip !== "local" && ip !== "::1" && ip !== "127.0.0.1") {
    const doIp = um<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE ip_cadastro = ? AND criado_em > ?", ip, agora() - DIA)!;
    if (doIp.n >= 3) return { erro: "Não foi possível criar a conta agora. Tente novamente amanhã ou fale com o suporte." };
  }
  const id = novoId();
  const t = agora();
  rodar(
    "INSERT INTO users (id, email, nome, whatsapp, senha_hash, plano, teste_fim, ip_cadastro, criado_em, ultimo_acesso) VALUES (?,?,?,?,?,?,?,?,?,?)",
    id,
    email,
    nome,
    whatsapp,
    hashSenha(senha),
    "teste",
    t + TESTE.dias * DIA,
    ip,
    t,
    t,
  );
  lancar(id, "plano", TESTE.creditos, "Créditos do teste gratuito");
  aplicarComprasPendentes(email);
  await emailVerificacao(email, nome, criarToken(id, "verificar", 2 * DIA));
  await criarSessao(id);
  evento(id, "cadastro");
  redirect("/app/boas-vindas");
}

export async function entrar(_: Estado, fd: FormData): Promise<Estado> {
  const ip = await ipDoPedido();
  const email = texto(fd, "email", 120).toLowerCase();
  const senha = String(fd.get("senha") || "");
  if (!dentroDoLimite(`entrar:${ip}:${email}`, 8, 10 * 60 * 1000)) return { erro: "Muitas tentativas. Aguarde alguns minutos." };
  const u = um<{ id: string; senha_hash: string; onboarding_ok: number }>(
    "SELECT id, senha_hash, onboarding_ok FROM users WHERE email = ?",
    email,
  );
  if (!u || !conferirSenha(senha, u.senha_hash)) return { erro: "E-mail ou senha incorretos." };
  await criarSessao(u.id);
  evento(u.id, "login");
  redirect(u.onboarding_ok ? "/app" : "/app/boas-vindas");
}

export async function sair() {
  await encerrarSessao();
  redirect("/");
}

export async function esqueciSenha(_: Estado, fd: FormData): Promise<Estado> {
  const ip = await ipDoPedido();
  const email = texto(fd, "email", 120).toLowerCase();
  if (!emailOk(email)) return { erro: "Informe um e-mail válido." };
  if (!dentroDoLimite(`esqueci:${ip}`, 5, 15 * 60 * 1000)) return { erro: "Muitas tentativas. Aguarde alguns minutos." };
  const u = um<{ id: string }>("SELECT id FROM users WHERE email = ?", email);
  if (u) await emailRedefinir(email, criarToken(u.id, "reset", 60 * 60 * 1000));
  return { ok: "Se existir uma conta com este e-mail, enviamos um link para criar uma nova senha." };
}

export async function redefinirSenha(_: Estado, fd: FormData): Promise<Estado> {
  const token = texto(fd, "token", 100);
  const senha = String(fd.get("senha") || "");
  if (senha.length < 8) return { erro: "A senha precisa ter pelo menos 8 caracteres." };
  if (senha !== String(fd.get("confirmar") || "")) return { erro: "As senhas não são iguais." };
  const userId = consumirToken(token, "reset");
  if (!userId) return { erro: "Este link expirou ou já foi usado. Peça um novo." };
  rodar("UPDATE users SET senha_hash = ? WHERE id = ?", hashSenha(senha), userId);
  rodar("DELETE FROM sessions WHERE user_id = ?", userId);
  redirect("/entrar?ok=senha");
}

export async function reenviarVerificacao(): Promise<Estado> {
  const u = await exigirUsuario();
  if (u.email_verificado) return { ok: "Seu e-mail já está confirmado." };
  if (!dentroDoLimite(`verificar:${u.id}`, 3, 30 * 60 * 1000)) return { erro: "Aguarde alguns minutos para pedir um novo link." };
  await emailVerificacao(u.email, u.nome, criarToken(u.id, "verificar", 2 * DIA));
  return { ok: `Enviamos um novo link para ${u.email}.` };
}

async function criarCasoDemo(u: Usuario) {
  const origem = path.join(process.cwd(), "public", "demo", "sorriso.jpg");
  if (!fs.existsSync(origem)) return;
  const t = agora();
  const pid = novoId();
  const planId = novoId();
  const { dados, largura, altura } = await normalizarFoto(await fs.promises.readFile(origem));
  const caminho = await salvarArquivo(`${u.id}/${pid}/${planId}/original.jpg`, dados);
  rodar(
    "INSERT INTO patients (id, user_id, nome, consentimento_em, demo, criado_em) VALUES (?,?,?,?,1,?)",
    pid,
    u.id,
    "Paciente demonstração",
    t,
    t,
  );
  rodar(
    "INSERT INTO plans (id, patient_id, user_id, nome, foto, foto_w, foto_h, criado_em, atualizado_em) VALUES (?,?,?,?,?,?,?,?,?)",
    planId,
    pid,
    u.id,
    "Plano 1",
    caminho,
    largura,
    altura,
    t,
    t,
  );
}

export async function salvarOnboarding(fd: FormData) {
  const u = await exigirUsuario();
  const perfil = {
    atuacao: texto(fd, "atuacao", 60),
    experiencia: texto(fd, "experiencia", 60),
    objetivo: texto(fd, "objetivo", 60),
  };
  rodar(
    "UPDATE users SET perfil = ?, clinica_nome = CASE WHEN ? <> '' THEN ? ELSE clinica_nome END, onboarding_ok = 1 WHERE id = ?",
    JSON.stringify(perfil),
    texto(fd, "clinica", 80),
    texto(fd, "clinica", 80),
    u.id,
  );
  if (!u.onboarding_ok) await criarCasoDemo(u).catch((e) => console.error("[demo]", e));
  evento(u.id, "onboarding", perfil);
  redirect("/app");
}

export async function concluirTutorial() {
  const u = await exigirUsuario();
  rodar("UPDATE users SET tutorial_ok = 1 WHERE id = ?", u.id);
}

export async function criarPaciente(_: Estado, fd: FormData): Promise<Estado> {
  const u = await exigirUsuario();
  if (!acessoDe(u).ativo) return { erro: "Seu acesso está pausado. Escolha um plano para cadastrar novos pacientes." };
  const nome = texto(fd, "nome", 80);
  if (nome.length < 2) return { erro: "Informe o nome do paciente." };
  if (!fd.get("consentimento")) return { erro: "Confirme que o paciente autorizou o uso da imagem." };
  const whats = texto(fd, "whatsapp", 30) ? normalizarWhats(texto(fd, "whatsapp", 30)) : "";
  const t = agora();
  const pid = novoId();
  const planId = novoId();
  rodar(
    "INSERT INTO patients (id, user_id, nome, nascimento, whatsapp, consentimento_em, criado_em) VALUES (?,?,?,?,?,?,?)",
    pid,
    u.id,
    nome,
    texto(fd, "nascimento", 10),
    whats,
    t,
    t,
  );
  rodar(
    "INSERT INTO plans (id, patient_id, user_id, nome, criado_em, atualizado_em) VALUES (?,?,?,?,?,?)",
    planId,
    pid,
    u.id,
    "Plano 1",
    t,
    t,
  );
  evento(u.id, "paciente_criado");
  const modo = texto(fd, "modo", 20);
  redirect(`/app/estudio/${planId}${modo ? `?modo=${encodeURIComponent(modo)}` : ""}`);
}

type PlanoLinha = { id: string; patient_id: string; user_id: string; nome: string; foto: string; foto_w: number; foto_h: number; estado: string };

function planoDoUsuario(u: Usuario, planId: string) {
  return um<PlanoLinha>("SELECT * FROM plans WHERE id = ? AND user_id = ?", planId, u.id);
}

export async function novoPlano(fd: FormData) {
  const u = await exigirUsuario();
  const pid = texto(fd, "paciente", 40);
  const p = um<{ id: string }>("SELECT id FROM patients WHERE id = ? AND user_id = ?", pid, u.id);
  if (!p || !acessoDe(u).ativo) redirect(`/app/pacientes/${pid}`);
  const n = um<{ n: number }>("SELECT COUNT(*) AS n FROM plans WHERE patient_id = ?", pid)!.n;
  const ultimo = um<PlanoLinha>("SELECT * FROM plans WHERE patient_id = ? AND foto <> '' ORDER BY criado_em DESC LIMIT 1", pid);
  const t = agora();
  const planId = novoId();
  let foto = "";
  if (ultimo) {
    foto = await salvarArquivo(`${u.id}/${pid}/${planId}/original.jpg`, await lerArquivo(ultimo.foto));
  }
  rodar(
    "INSERT INTO plans (id, patient_id, user_id, nome, foto, foto_w, foto_h, criado_em, atualizado_em) VALUES (?,?,?,?,?,?,?,?,?)",
    planId,
    pid,
    u.id,
    `Plano ${n + 1}`,
    foto,
    ultimo?.foto_w || 0,
    ultimo?.foto_h || 0,
    t,
    t,
  );
  redirect(`/app/estudio/${planId}`);
}

export async function renomearPlano(fd: FormData) {
  const u = await exigirUsuario();
  const plano = planoDoUsuario(u, texto(fd, "plano", 40));
  const nome = texto(fd, "nome", 60);
  if (plano && nome) {
    rodar("UPDATE plans SET nome = ?, atualizado_em = ? WHERE id = ?", nome, agora(), plano.id);
    revalidatePath(`/app/pacientes/${plano.patient_id}`);
  }
}

export async function apagarPlano(fd: FormData) {
  const u = await exigirUsuario();
  const plano = planoDoUsuario(u, texto(fd, "plano", 40));
  if (!plano) return;
  rodar("DELETE FROM proposals WHERE plan_id = ?", plano.id);
  rodar("DELETE FROM generations WHERE plan_id = ?", plano.id);
  rodar("DELETE FROM plans WHERE id = ?", plano.id);
  await apagarPasta(`${u.id}/${plano.patient_id}/${plano.id}`).catch(() => {});
  revalidatePath(`/app/pacientes/${plano.patient_id}`);
}

export async function apagarPaciente(fd: FormData) {
  const u = await exigirUsuario();
  const pid = texto(fd, "paciente", 40);
  const p = um<{ id: string }>("SELECT id FROM patients WHERE id = ? AND user_id = ?", pid, u.id);
  if (!p) redirect("/app/pacientes");
  rodar("DELETE FROM proposals WHERE plan_id IN (SELECT id FROM plans WHERE patient_id = ?)", pid);
  rodar("DELETE FROM generations WHERE plan_id IN (SELECT id FROM plans WHERE patient_id = ?)", pid);
  rodar("DELETE FROM plans WHERE patient_id = ?", pid);
  rodar("DELETE FROM patients WHERE id = ?", pid);
  await apagarPasta(`${u.id}/${pid}`).catch(() => {});
  redirect("/app/pacientes");
}

export async function salvarConta(_: Estado, fd: FormData): Promise<Estado> {
  const u = await exigirUsuario();
  const nome = texto(fd, "nome", 80);
  const whatsapp = normalizarWhats(texto(fd, "whatsapp", 30));
  if (nome.length < 3) return { erro: "Informe seu nome completo." };
  if (whatsapp.length < 12 || whatsapp.length > 13) return { erro: "Informe seu WhatsApp com DDD." };
  if (um("SELECT id FROM users WHERE whatsapp = ? AND id <> ?", whatsapp, u.id)) return { erro: "Este WhatsApp já está em outra conta." };
  let logo = u.clinica_logo;
  const arquivo = fd.get("logo");
  if (arquivo instanceof File && arquivo.size > 0) {
    if (arquivo.size > 6 * 1024 * 1024) return { erro: "A logo precisa ter até 6 MB." };
    try {
      const png = await sharp(Buffer.from(await arquivo.arrayBuffer()))
        .resize({ width: 600, height: 600, fit: "inside", withoutEnlargement: true })
        .png()
        .toBuffer();
      // Nome único: o arquivo é servido com cache longo, e o nome fixo prendia a logo antiga no navegador.
      logo = await salvarArquivo(`${u.id}/_clinica/logo-${novoId(6)}.png`, png);
    } catch {
      return { erro: "Não foi possível ler a logo. Envie um arquivo PNG ou JPG." };
    }
  }
  if (fd.get("remover_logo")) logo = "";
  rodar(
    "UPDATE users SET nome = ?, whatsapp = ?, clinica_nome = ?, clinica_logo = ? WHERE id = ?",
    nome,
    whatsapp,
    texto(fd, "clinica", 80),
    logo,
    u.id,
  );
  if (u.clinica_logo && u.clinica_logo !== logo) {
    await fs.promises.rm(caminhoAbsoluto(u.clinica_logo), { force: true }).catch(() => {});
  }
  revalidatePath("/app", "layout");
  return { ok: "Dados salvos." };
}

export async function trocarSenha(_: Estado, fd: FormData): Promise<Estado> {
  const u = await exigirUsuario();
  const atual = String(fd.get("atual") || "");
  const nova = String(fd.get("nova") || "");
  const linha = um<{ senha_hash: string }>("SELECT senha_hash FROM users WHERE id = ?", u.id)!;
  if (!conferirSenha(atual, linha.senha_hash)) return { erro: "A senha atual não confere." };
  if (nova.length < 8) return { erro: "A nova senha precisa ter pelo menos 8 caracteres." };
  rodar("UPDATE users SET senha_hash = ? WHERE id = ?", hashSenha(nova), u.id);
  rodar("DELETE FROM sessions WHERE user_id = ?", u.id);
  await criarSessao(u.id);
  return { ok: "Senha alterada. Os outros aparelhos foram desconectados." };
}

export async function abrirTicket(_: Estado, fd: FormData): Promise<Estado> {
  const u = await exigirUsuario();
  const assunto = texto(fd, "assunto", 100);
  const mensagem = texto(fd, "mensagem", 3000);
  if (assunto.length < 3 || mensagem.length < 10) return { erro: "Conte em poucas palavras como podemos ajudar." };
  if (!dentroDoLimite(`ticket:${u.id}`, 5, 60 * 60 * 1000)) return { erro: "Você já enviou várias mensagens. Aguarde nosso retorno." };
  rodar("INSERT INTO tickets (user_id, assunto, mensagem, criado_em) VALUES (?,?,?,?)", u.id, assunto, mensagem, agora());
  await emailSuporte(`${u.nome} <${u.email}>`, assunto, mensagem);
  return { ok: "Mensagem enviada. Respondemos no seu e-mail em até 1 dia útil." };
}

export async function apagarConta(_: Estado, fd: FormData): Promise<Estado> {
  const u = await exigirUsuario();
  const linha = um<{ senha_hash: string }>("SELECT senha_hash FROM users WHERE id = ?", u.id)!;
  if (!conferirSenha(String(fd.get("senha") || ""), linha.senha_hash)) return { erro: "Senha incorreta." };
  await apagarDadosClinicos(u.id);
  rodar("DELETE FROM ledger WHERE user_id = ?", u.id);
  rodar("DELETE FROM tokens WHERE user_id = ?", u.id);
  rodar("DELETE FROM tickets WHERE user_id = ?", u.id);
  rodar("DELETE FROM emails_enviados WHERE user_id = ?", u.id);
  rodar("DELETE FROM sessions WHERE user_id = ?", u.id);
  rodar("DELETE FROM users WHERE id = ?", u.id);
  await encerrarSessao();
  redirect("/?conta=apagada");
}

export async function irParaCheckout(chave: "pro_mensal" | "pro_anual" | "clinica_mensal" | "clinica_anual" | "pacote"): Promise<{ url?: string; erro?: string }> {
  const u = await exigirUsuario();
  const base = linkCheckout(chave);
  evento(u.id, "checkout_clique", chave);
  if (!base) return { erro: "O pagamento está indisponível no momento. Fale com o suporte para concluir sua assinatura." };
  const url = new URL(base);
  url.searchParams.set("email", u.email);
  url.searchParams.set("name", u.nome);
  if (u.whatsapp) url.searchParams.set("phone", u.whatsapp);
  return { url: url.toString() };
}

export async function adminCreditos(fd: FormData) {
  await exigirAdmin();
  const id = texto(fd, "usuario", 40);
  const qtd = Math.trunc(Number(fd.get("quantidade")));
  if (id && Number.isFinite(qtd) && qtd !== 0 && Math.abs(qtd) <= 5000) lancar(id, "extra", qtd, "Ajuste do suporte");
  revalidatePath("/admin");
}

export async function adminPlano(fd: FormData) {
  await exigirAdmin();
  const id = texto(fd, "usuario", 40);
  const plano = texto(fd, "plano", 20);
  const dias = Math.trunc(Number(fd.get("dias")));
  if (!id || !Number.isFinite(dias)) return;
  const t = agora();
  if (plano === "teste") {
    rodar("UPDATE users SET plano = 'teste', teste_fim = ?, inativo_desde = 0 WHERE id = ?", t + dias * DIA, id);
  } else if (plano === "pro" || plano === "clinica") {
    rodar(
      "UPDATE users SET plano = ?, plano_status = 'ativo', pago_ate = ?, proxima_recarga = ?, inativo_desde = 0 WHERE id = ?",
      plano,
      t + dias * DIA,
      t,
      id,
    );
  }
  revalidatePath("/admin");
}

export async function adminTicket(fd: FormData) {
  await exigirAdmin();
  rodar("UPDATE tickets SET status = ? WHERE id = ?", texto(fd, "status", 20), Number(fd.get("ticket")));
  revalidatePath("/admin");
}

export async function listarPropostas(planId: string) {
  const u = await exigirUsuario();
  return todos<{ id: string; token: string; titulo: string; valor: string; visualizacoes: number; criado_em: number }>(
    "SELECT id, token, titulo, valor, visualizacoes, criado_em FROM proposals WHERE plan_id = ? AND user_id = ? ORDER BY criado_em DESC",
    planId,
    u.id,
  );
}
