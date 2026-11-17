import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <div className="entra mx-auto flex min-h-dvh w-full max-w-[440px] flex-col justify-center gap-4 px-4 py-10 text-center">
      <span className="kick">Erro 404</span>
      <h1 className="glitch">Esta página não existe</h1>
      <p className="text-muted">O link pode ter sido apagado ou digitado errado.</p>
      <Link href="/app" className="btn">
        Ir para o início
      </Link>
    </div>
  );
}
