import { MelhorarFoto } from "@/components/MelhorarFoto";

export const metadata = { title: "Melhorar foto" };

export default function PaginaMelhorar() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="kick">Ferramenta</span>
        <h1>Melhorar foto</h1>
        <p className="text-muted">Corrige cor, luz e nitidez sem redesenhar nada: o dente continua exatamente como está na foto.</p>
      </div>
      <MelhorarFoto />
    </>
  );
}
