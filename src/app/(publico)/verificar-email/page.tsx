import Link from "next/link";
import { consumirToken } from "@/lib/auth";
import { evento, rodar } from "@/lib/db";

export const metadata = { title: "Confirmar e-mail" };

export default async function VerificarEmail({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const userId = token ? consumirToken(token, "verificar") : null;
  if (userId) {
    rodar("UPDATE users SET email_verificado = 1 WHERE id = ?", userId);
    evento(userId, "email_verificado");
  }
  return userId ? (
    <>
      <span className="kick">Tudo certo</span>
      <h1>E-mail confirmado</h1>
      <p className="text-muted">Sua conta está liberada por completo.</p>
      <Link href="/app" className="btn">
        Abrir o Odonto 4K
      </Link>
    </>
  ) : (
    <>
      <h1>Este link expirou</h1>
      <p className="text-muted">Entre na sua conta e peça um novo link de confirmação na tela Conta.</p>
      <Link href="/app/conta" className="btn">
        Ir para a Conta
      </Link>
    </>
  );
}
