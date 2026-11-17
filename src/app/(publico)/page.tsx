import Link from "next/link";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/auth";
import { TESTE } from "@/lib/config";
import { Vitrine } from "@/components/Vitrine";

export default async function Entrada({ searchParams }: { searchParams: Promise<{ conta?: string }> }) {
  if (await usuarioAtual()) redirect("/app");
  const { conta } = await searchParams;
  return (
    <>
      {conta === "apagada" && <p className="sucesso">Sua conta e todos os dados foram apagados.</p>}
      <div className="flex flex-col gap-2 text-center">
        <span className="kick">Simulador de sorriso</span>
        <h1 className="glitch">
          Mostre o <span className="hl">depois</span> antes de começar o tratamento
        </h1>
      </div>
      <Vitrine />
      <div className="flex flex-col gap-3">
        <Link href="/criar-conta" className="btn shine">
          Começar teste de {TESTE.dias} dias
        </Link>
        <Link href="/entrar" className="btn vi">
          Já tenho conta
        </Link>
        <p className="note text-center">
          {TESTE.creditos} simulações com IA incluídas no teste. Sem cartão de crédito.
        </p>
      </div>
    </>
  );
}
