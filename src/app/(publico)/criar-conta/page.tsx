import Link from "next/link";
import { redirect } from "next/navigation";
import { criarConta } from "@/app/acoes";
import { usuarioAtual } from "@/lib/auth";
import { TESTE } from "@/lib/config";
import { Formulario } from "@/components/ui";

export const metadata = { title: "Criar conta" };

export default async function CriarConta() {
  if (await usuarioAtual()) redirect("/app");
  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="kick">Teste de {TESTE.dias} dias</span>
        <h1>Crie sua conta</h1>
        <p className="text-muted">Leva menos de um minuto. Você já entra com {TESTE.creditos} simulações com IA.</p>
      </div>
      <Formulario acao={criarConta} botao="Criar conta e entrar">
        <label className="campo">
          <span>Nome completo</span>
          <input name="nome" autoComplete="name" required minLength={3} placeholder="Dra. Ana Souza" />
        </label>
        <label className="campo">
          <span>E-mail</span>
          <input name="email" type="email" autoComplete="email" required placeholder="voce@clinica.com.br" />
        </label>
        <label className="campo">
          <span>WhatsApp com DDD</span>
          <input name="whatsapp" type="tel" inputMode="tel" autoComplete="tel" required placeholder="(11) 99999-9999" />
        </label>
        <label className="campo">
          <span>Senha</span>
          <input name="senha" type="password" autoComplete="new-password" required minLength={8} placeholder="Mínimo de 8 caracteres" />
        </label>
        <label className="flex items-start gap-3 text-[14px] text-muted">
          <input type="checkbox" name="termos" required className="mt-1 h-5 w-5 flex-none accent-[var(--cy)]" />
          <span>
            Li e aceito os{" "}
            <Link href="/termos" target="_blank" className="text-gold">
              termos de uso
            </Link>{" "}
            e a{" "}
            <Link href="/privacidade" target="_blank" className="text-gold">
              política de privacidade
            </Link>
            .
          </span>
        </label>
      </Formulario>
      <p className="note text-center">
        Já tem conta?{" "}
        <Link href="/entrar" className="text-gold">
          Entrar
        </Link>
      </p>
    </>
  );
}
