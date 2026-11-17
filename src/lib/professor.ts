import "server-only";
import { randomBytes, scryptSync } from "node:crypto";
import { agora, DIA, novoId, rodar, um } from "./db";
import { lancar } from "./creditos";

// Conta de demonstração para quem avalia a atividade: e-mail já confirmado, sem onboarding e com
// plano ativo por 1 ano. É criada na subida do servidor se não existir (a Vercel perde o banco
// quando a função reinicia). No código fica só o hash; PROFESSOR_SENHA troca a senha por env.
const HASH_PADRAO =
  "scrypt$TM9xqsnO8aNFPeXCi1zlUw==$Iwr63gCYUFIFa5OKxKH7vu18gQhHFT6q20iXpMm+6cuGT2QN0Gy0irz/DCJuPxud6dVsjO3puUfkBggcpo/+Wg==";

function hashDaSenha() {
  const senha = process.env.PROFESSOR_SENHA;
  if (!senha) return HASH_PADRAO;
  const sal = randomBytes(16);
  const h = scryptSync(senha, sal, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${sal.toString("base64")}$${h.toString("base64")}`;
}

export function garantirProfessor() {
  try {
    const email = (process.env.PROFESSOR_EMAIL || "professor@odonto4k.app").trim().toLowerCase();
    if (um("SELECT id FROM users WHERE email = ?", email)) return;
    const id = novoId();
    const t = agora();
    rodar(
      "INSERT INTO users (id, email, nome, whatsapp, senha_hash, email_verificado, onboarding_ok, tutorial_ok, plano, plano_ciclo, pago_ate, proxima_recarga, ip_cadastro, criado_em, ultimo_acesso) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      id,
      email,
      "Professor Avaliador",
      "5500000000000",
      hashDaSenha(),
      1,
      1,
      1,
      "pro",
      "anual",
      t + 365 * DIA,
      t + 30 * DIA,
      "seed",
      t,
      t,
    );
    lancar(id, "plano", 60, "Créditos da conta de demonstração");
  } catch (e) {
    console.error("não consegui criar a conta do professor:", e);
  }
}
