"use client";

import { useRef, useState } from "react";
import { avisar, Comparador } from "./ui";
import { IcBaixar, IcGaleria } from "./Icones";

export function MelhorarFoto() {
  const entrada = useRef<HTMLInputElement>(null);
  const [antes, setAntes] = useState("");
  const [depois, setDepois] = useState("");
  const [proporcao, setProporcao] = useState(1);
  const [ocupado, setOcupado] = useState(false);

  const enviar = async (arquivo: File) => {
    setOcupado(true);
    setDepois("");
    const urlAntes = URL.createObjectURL(arquivo);
    setAntes(urlAntes);
    try {
      const bmp = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
      setProporcao(bmp.width / bmp.height);
      bmp.close();
      const fd = new FormData();
      fd.append("foto", arquivo);
      const r = await fetch("/api/melhorar", { method: "POST", body: fd });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.erro || "Não foi possível melhorar esta foto.");
      }
      setDepois(URL.createObjectURL(await r.blob()));
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível melhorar esta foto.", true);
      setAntes("");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={entrada}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void enviar(f);
          e.target.value = "";
        }}
      />
      {!antes && (
        <button className="card items-center gap-3 border-dashed py-12 text-center" onClick={() => entrada.current?.click()}>
          <IcGaleria className="h-10 w-10 text-gold" />
          <b className="font-display text-[18px]">Escolher uma foto</b>
          <span className="note">Sorriso, intraoral ou antes e depois. JPG ou PNG até 20 MB.</span>
        </button>
      )}
      {antes && !depois && (
        <div className="scanning overflow-hidden rounded-xl border border-gold-deep" style={{ aspectRatio: String(proporcao) }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={antes} alt="" className="h-full w-full object-cover opacity-70" />
        </div>
      )}
      {antes && depois && <Comparador antes={antes} depois={depois} proporcao={proporcao} rotuloDepois="4K" />}
      {ocupado && (
        <p className="note text-center font-mono" role="status">
          Corrigindo cor, luz e nitidez…
        </p>
      )}
      {depois && (
        <div className="flex flex-col gap-2">
          <a className="btn" href={depois} download="odonto4k-foto.jpg">
            <IcBaixar className="h-5 w-5" /> Salvar foto
          </a>
          <button className="btn dark" onClick={() => entrada.current?.click()}>
            Melhorar outra foto
          </button>
        </div>
      )}
    </div>
  );
}
