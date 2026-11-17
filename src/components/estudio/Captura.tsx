"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ajustarPixels } from "@/lib/client/rosto";
import { avisar } from "../ui";
import { IcBrilho, IcCamera, IcFechar, IcGaleria, IcGirar } from "../Icones";

const LADO_MAX = 1800;

export function Captura({ aoEnviar, enviando }: { aoEnviar: (foto: Blob) => void; enviando: boolean }) {
  const arquivo = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const fluxo = useRef<MediaStream | null>(null);
  const [camera, setCamera] = useState(false);
  const [frontal, setFrontal] = useState(false);
  const [fonte, setFonte] = useState<ImageBitmap | HTMLCanvasElement | null>(null);
  const [previa, setPrevia] = useState("");
  const [giro, setGiro] = useState(0);
  const [aj, setAj] = useState({ brilho: 1, contraste: 1, saturacao: 1 });
  const [melhorando, setMelhorando] = useState(false);

  const pararCamera = useCallback(() => {
    fluxo.current?.getTracks().forEach((t) => t.stop());
    fluxo.current = null;
  }, []);

  useEffect(() => pararCamera, [pararCamera]);

  const abrirCamera = async (usarFrontal: boolean) => {
    pararCamera();
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: usarFrontal ? "user" : "environment", width: { ideal: 1920 }, height: { ideal: 1440 } },
        audio: false,
      });
      fluxo.current = s;
      setFrontal(usarFrontal);
      setCamera(true);
      requestAnimationFrame(() => {
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play().catch(() => {});
        }
      });
    } catch {
      setCamera(false);
      avisar("Não foi possível abrir a câmera. Escolha a foto pela galeria.", true);
      arquivo.current?.click();
    }
  };

  const receber = (bmp: ImageBitmap | HTMLCanvasElement) => {
    setFonte(bmp);
    setGiro(0);
    setAj({ brilho: 1, contraste: 1, saturacao: 1 });
  };

  const disparar = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    pararCamera();
    setCamera(false);
    receber(c);
  };

  const renderizar = useCallback(
    (aplicarAjuste: boolean) => {
      if (!fonte) return null;
      const lado = giro % 180 !== 0;
      const fw = fonte.width, fh = fonte.height;
      const escala = Math.min(1, LADO_MAX / Math.max(fw, fh));
      const w = Math.round((lado ? fh : fw) * escala), h = Math.round((lado ? fw : fh) * escala);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      ctx.translate(w / 2, h / 2);
      ctx.rotate((giro * Math.PI) / 180);
      ctx.drawImage(fonte, (-fw * escala) / 2, (-fh * escala) / 2, fw * escala, fh * escala);
      if (aplicarAjuste && (aj.brilho !== 1 || aj.contraste !== 1 || aj.saturacao !== 1)) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.putImageData(ajustarPixels(ctx.getImageData(0, 0, w, h), aj.brilho, aj.contraste, aj.saturacao), 0, 0);
      }
      return c;
    },
    [fonte, giro, aj],
  );

  useEffect(() => {
    const c = renderizar(false);
    if (!c) {
      setPrevia("");
      return;
    }
    let vivo = true;
    c.toBlob(
      (b) => {
        if (b && vivo) setPrevia(URL.createObjectURL(b));
      },
      "image/jpeg",
      0.9,
    );
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fonte, giro]);

  const melhorar = async () => {
    const c = renderizar(true);
    if (!c) return;
    setMelhorando(true);
    try {
      const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", 0.93));
      const fd = new FormData();
      fd.append("foto", blob!, "foto.jpg");
      const r = await fetch("/api/melhorar", { method: "POST", body: fd });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro || "Não foi possível melhorar a foto.");
      receber(await createImageBitmap(await r.blob()));
      avisar("Cor, luz e nitidez corrigidas.");
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível melhorar a foto.", true);
    } finally {
      setMelhorando(false);
    }
  };

  const usar = () => {
    const c = renderizar(true);
    c?.toBlob((b) => b && aoEnviar(b), "image/jpeg", 0.93);
  };

  if (camera) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black">
        <div className="relative flex-1 overflow-hidden">
          <video ref={video} playsInline muted className="h-full w-full object-cover" style={frontal ? { transform: "scaleX(-1)" } : undefined} />
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid slice" aria-hidden>
            <ellipse cx="50" cy="64" rx="27" ry="37" fill="none" stroke="#E2B84C" strokeWidth="0.5" strokeDasharray="2.5 1.8" />
            <path d="M38 82 Q50 90 62 82" fill="none" stroke="#E2B84C" strokeWidth="0.45" opacity=".8" />
          </svg>
          <p className="absolute inset-x-0 top-4 text-center font-mono text-[12px] font-bold uppercase tracking-[.1em] text-gold drop-shadow">
            Rosto inteiro na moldura · sorriso natural
          </p>
          <button
            className="absolute right-3 top-10 grid h-10 w-10 place-items-center rounded-full border border-line bg-black/70"
            aria-label="Fechar câmera"
            onClick={() => {
              pararCamera();
              setCamera(false);
            }}
          >
            <IcFechar className="h-5 w-5" />
          </button>
        </div>
        <div className="flex items-center justify-around px-6 pb-[calc(22px+env(safe-area-inset-bottom,0px))] pt-5">
          <button className="grid h-12 w-12 place-items-center rounded-full border border-line bg-panel" aria-label="Escolher da galeria" onClick={() => arquivo.current?.click()}>
            <IcGaleria className="h-6 w-6" />
          </button>
          <button
            className="h-[74px] w-[74px] rounded-full border-4 border-gold bg-ink shadow-[0_0_30px_-4px_var(--cy)] transition-transform active:scale-90"
            aria-label="Tirar foto"
            onClick={disparar}
          />
          <button className="grid h-12 w-12 place-items-center rounded-full border border-line bg-panel" aria-label="Trocar de câmera" onClick={() => void abrirCamera(!frontal)}>
            <IcGirar className="h-6 w-6" />
          </button>
        </div>
        <EntradaArquivo alvo={arquivo} aoReceber={(b) => { pararCamera(); setCamera(false); receber(b); }} />
      </div>
    );
  }

  if (fonte) {
    const controles = [
      ["brilho", "Brilho"],
      ["contraste", "Contraste"],
      ["saturacao", "Cor"],
    ] as const;
    return (
      <div className="entra flex flex-col gap-4">
        <div className="overflow-hidden rounded-xl border border-line bg-black">
          {previa && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previa}
              alt="Prévia da foto"
              className="mx-auto max-h-[52dvh] w-auto"
              style={{ filter: `brightness(${aj.brilho}) contrast(${aj.contraste}) saturate(${aj.saturacao})` }}
            />
          )}
        </div>
        <div className="flex flex-col gap-2">
          {controles.map(([chave, rotulo]) => (
            <label key={chave} className="flex items-center gap-3">
              <span className="w-20 font-mono text-[11px] font-bold uppercase tracking-[.08em] text-muted">{rotulo}</span>
              <input
                type="range"
                className="slider"
                min={0.7}
                max={1.3}
                step={0.01}
                value={aj[chave]}
                style={{ ["--p" as string]: `${((aj[chave] - 0.7) / 0.6) * 100}%` }}
                onChange={(e) => setAj((a) => ({ ...a, [chave]: Number(e.target.value) }))}
              />
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <button className="btn dark sm flex-1" onClick={() => setGiro((g) => (g + 90) % 360)}>
            <IcGirar className="h-4 w-4" /> Girar
          </button>
          <button className="btn dark sm flex-1" disabled={melhorando} onClick={melhorar}>
            <IcBrilho className="h-4 w-4" /> {melhorando ? "Melhorando…" : "Melhorar foto"}
          </button>
        </div>
        <button className="btn" disabled={enviando || melhorando} onClick={usar}>
          {enviando ? "Enviando…" : "Usar esta foto"}
        </button>
        <button className="btn ghost" disabled={enviando} onClick={() => setFonte(null)}>
          Escolher outra
        </button>
      </div>
    );
  }

  return (
    <div className="entra flex flex-col gap-4">
      <div className="flex flex-col gap-1 text-center">
        <span className="kick">Foto do paciente</span>
        <h2>Rosto inteiro, de frente, sorrindo</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button className="card items-center gap-2 py-8 transition-colors hover:border-gold" onClick={() => void abrirCamera(false)}>
          <IcCamera className="h-10 w-10 text-gold" />
          <b className="font-display text-[16px]">Tirar foto</b>
        </button>
        <button className="card items-center gap-2 py-8 transition-colors hover:border-gold" onClick={() => arquivo.current?.click()}>
          <IcGaleria className="h-10 w-10 text-gold" />
          <b className="font-display text-[16px]">Galeria</b>
        </button>
      </div>
      <ul className="list card">
        <li>Os olhos e o queixo precisam aparecer: a análise usa o rosto inteiro.</li>
        <li>Sorriso natural, com os dentes de cima bem à mostra.</li>
        <li>Luz de frente, sem sombra forte na boca. Evite flash direto.</li>
        <li>Câmera na altura dos olhos do paciente.</li>
      </ul>
      <EntradaArquivo alvo={arquivo} aoReceber={receber} />
    </div>
  );
}

function EntradaArquivo({ alvo, aoReceber }: { alvo: React.RefObject<HTMLInputElement | null>; aoReceber: (b: ImageBitmap) => void }) {
  return (
    <input
      ref={alvo}
      type="file"
      accept="image/*"
      hidden
      onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (!f) return;
        try {
          aoReceber(await createImageBitmap(f, { imageOrientation: "from-image" }));
        } catch {
          avisar("Não foi possível abrir esta imagem. Use uma foto JPG ou PNG.", true);
        }
      }}
    />
  );
}
