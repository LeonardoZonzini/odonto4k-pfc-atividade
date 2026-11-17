"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  carregarImagem,
  clarear,
  detectarRosto,
  Editaveis,
  Marcos,
  medianaFacial,
  medir,
  pontosIniciais,
  preaquecer,
  Pt,
  segmentarDentes,
  Segmentacao,
  tomSugerido,
} from "@/lib/client/rosto";
import { avisar, Comparador, Folha } from "../ui";
import { IcAlinhar, IcAnalise, IcBaixar, IcBrilho, IcCheck, IcComparar, IcCopiar, IcCreditos, IcDente, IcEnviar, IcOlho, IcVoltar, IcZoom } from "../Icones";
import { Captura } from "./Captura";
import { ItemAnalise, montarAnalise, RODAPE_ANALISE } from "./textos";

type Etapa = "foto" | "analise" | "simulacao" | "comparar" | "proposta";
type ModoSim = "clareamento" | "lentes" | "aparelho";
type Geracao = { id: string; tipo: "lentes" | "aparelho"; params: Record<string, unknown>; imagens: string[]; criado_em: number };
type PropostaItem = { id: string; token: string; titulo: string; valor: string; visualizacoes: number; criado_em: number };
type Foto = { caminho: string; largura: number; altura: number; v: number };
type EstadoSalvo = { pontos?: Editaveis; nivel?: number; base?: string };

export type PropsEstudio = {
  plano: { id: string; nome: string; foto: Foto | null; estado: EstadoSalvo };
  paciente: { id: string; nome: string; whatsapp: string };
  geracoes: Geracao[];
  propostas: PropostaItem[];
  saldoInicial: number;
  acessoAtivo: boolean;
  modoInicial: string;
  marca: string;
  appUrl: string;
};

const ETAPAS: { id: Etapa; nome: string }[] = [
  { id: "foto", nome: "Foto" },
  { id: "analise", nome: "Análise" },
  { id: "simulacao", nome: "Simulação" },
  { id: "comparar", nome: "Comparar" },
  { id: "proposta", nome: "Proposta" },
];

const NIVEIS = ["Original", "Natural", "Leve", "Médio", "Intenso", "Extra", "Máximo"];

const LOG_GERACAO: [number, string][] = [
  [0, "foto recebida"],
  [1.5, "isolando a região do sorriso"],
  [4, "protegendo lábios, pele e rosto"],
  [7, "desenhando 3 versões do tratamento"],
  [24, "ajustando luz e textura do esmalte"],
  [42, "encaixando o resultado na foto original"],
];

export function Estudio(props: PropsEstudio) {
  const { plano, paciente } = props;
  const [foto, setFoto] = useState<Foto | null>(plano.foto);
  const [etapa, setEtapa] = useState<Etapa>(plano.foto ? (props.modoInicial === "analise" ? "analise" : "simulacao") : "foto");
  const [status, setStatus] = useState<"vazio" | "analisando" | "pronto" | "semRosto">(plano.foto ? "analisando" : "vazio");
  const [trocando, setTrocando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [marcos, setMarcos] = useState<Marcos | null>(null);
  const [segOriginal, setSegOriginal] = useState<Segmentacao | null>(null);
  const [pontos, setPontos] = useState<Editaveis | null>(null);
  const [nivel, setNivel] = useState(plano.estado.nivel || 0);
  const [base, setBase] = useState(plano.estado.base || "");
  const [versaoBase, setVersaoBase] = useState(0);
  const [temDentes, setTemDentes] = useState(true);
  const [modoSim, setModoSim] = useState<ModoSim>(
    props.modoInicial === "lentes" || props.modoInicial === "aparelho" ? props.modoInicial : "clareamento",
  );
  const [lentes, setLentes] = useState({ formato: "oval", cor: "BL2", dentes: 8 });
  const [clarearJunto, setClarearJunto] = useState(false);
  const [geracoes, setGeracoes] = useState<Geracao[]>(props.geracoes);
  const [gerando, setGerando] = useState<{ id: string; inicio: number } | null>(null);
  const [decorrido, setDecorrido] = useState(0);
  const [saldo, setSaldo] = useState(props.saldoInicial);
  const [bloqueio, setBloqueio] = useState<null | "creditos" | "acesso" | "verificar">(null);
  const [vendoAntes, setVendoAntes] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [indice, setIndice] = useState(0);
  const [linhas, setLinhas] = useState(true);
  const [depoisUrl, setDepoisUrl] = useState("");
  const [propostas, setPropostas] = useState<PropostaItem[]>(props.propostas);
  const [criando, setCriando] = useState(false);
  const [form, setForm] = useState({ titulo: "", texto: "", valor: "" });
  const [revelar, setRevelar] = useState(0);

  const tela = useRef<HTMLCanvasElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const imgOriginal = useRef<HTMLImageElement | null>(null);
  const imgBase = useRef<HTMLImageElement | null>(null);
  const seg = useRef<Segmentacao | null>(null);
  const dadosBase = useRef<ImageData | null>(null);
  const envioResultado = useRef<Promise<unknown> | null>(null);
  const arrastando = useRef<keyof Editaveis | null>(null);
  const estadoInicial = useRef(plano.estado);

  const W = foto?.largura || 1;
  const H = foto?.altura || 1;
  const urlOriginal = foto ? `/api/arquivos/${foto.caminho}?v=${foto.v}` : "";

  useEffect(() => {
    preaquecer();
  }, []);

  const prepararBase = useCallback(
    async (caminho: string, m: Marcos, f: Foto) => {
      let img = imgOriginal.current!;
      if (caminho) {
        try {
          img = await carregarImagem(`/api/arquivos/${caminho}`);
        } catch {
          img = imgOriginal.current!;
        }
      }
      imgBase.current = img;
      const off = document.createElement("canvas");
      off.width = f.largura;
      off.height = f.altura;
      const ctx = off.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, f.largura, f.altura);
      const s = segmentarDentes(ctx, m, f.largura, f.altura);
      seg.current = s;
      dadosBase.current = s ? ctx.getImageData(s.x, s.y, s.w, s.h) : null;
      setTemDentes(Boolean(s));
      setVersaoBase((v) => v + 1);
      return s;
    },
    [],
  );

  useEffect(() => {
    if (!foto) return;
    let vivo = true;
    setStatus("analisando");
    (async () => {
      try {
        const img = await carregarImagem(`/api/arquivos/${foto.caminho}?v=${foto.v}`);
        if (!vivo) return;
        imgOriginal.current = img;
        imgBase.current = img;
        setVersaoBase((v) => v + 1);
        const off = document.createElement("canvas");
        off.width = foto.largura;
        off.height = foto.altura;
        const ctx = off.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0, foto.largura, foto.altura);
        const m = await detectarRosto(off, foto.largura, foto.altura);
        if (!vivo) return;
        if (!m) {
          setMarcos(null);
          setStatus("semRosto");
          return;
        }
        const sOriginal = segmentarDentes(ctx, m, foto.largura, foto.altura);
        setMarcos(m);
        setSegOriginal(sOriginal);
        const salvo = estadoInicial.current;
        setPontos(salvo.pontos?.pupilaE ? salvo.pontos : pontosIniciais(m, sOriginal));
        await prepararBase(salvo.base || "", m, foto);
        if (vivo) setStatus("pronto");
      } catch {
        if (vivo) setStatus("semRosto");
      }
    })();
    return () => {
      vivo = false;
    };
  }, [foto, prepararBase]);

  const mostrarOriginal = etapa !== "simulacao" || vendoAntes;

  useEffect(() => {
    const c = tela.current;
    if (!c || !imgOriginal.current) return;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    if (mostrarOriginal || !imgBase.current) {
      ctx.drawImage(imgOriginal.current, 0, 0, W, H);
      return;
    }
    ctx.drawImage(imgBase.current, 0, 0, W, H);
    if (seg.current && dadosBase.current && nivel > 0) ctx.putImageData(clarear(dadosBase.current, seg.current, nivel), seg.current.x, seg.current.y);
  }, [etapa, nivel, mostrarOriginal, versaoBase, status, trocando, W, H]);

  useEffect(() => {
    if (status !== "pronto" || !pontos) return;
    const t = setTimeout(() => {
      void fetch(`/api/planos/${plano.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: { pontos, nivel, base } }),
      }).catch(() => {});
    }, 900);
    return () => clearTimeout(t);
  }, [pontos, nivel, base, status, plano.id]);

  const medidas = useMemo(() => (marcos && pontos ? medir(marcos, pontos, segOriginal) : null), [marcos, pontos, segOriginal]);
  const analise = useMemo(() => (medidas ? montarAnalise(medidas) : []), [medidas]);
  const itemAtual: ItemAnalise | undefined = analise[Math.min(indice, analise.length - 1)];

  const enviarFoto = async (blob: Blob) => {
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append("foto", blob, "foto.jpg");
      const r = await fetch(`/api/planos/${plano.id}/foto`, { method: "POST", body: fd });
      const j = await r.json().catch(() => ({ erro: r.status === 413 ? "A foto é grande demais. Tente uma imagem menor." : "" }));
      if (!r.ok) {
        if (j.paywall) setBloqueio("acesso");
        else avisar(j.erro || "Não foi possível enviar a foto.", true);
        return;
      }
      estadoInicial.current = {};
      setNivel(0);
      setBase("");
      setGeracoes([]);
      setPontos(null);
      setMarcos(null);
      setTrocando(false);
      setFoto({ caminho: j.foto, largura: j.largura, altura: j.altura, v: j.v });
      setEtapa(props.modoInicial === "analise" ? "analise" : "simulacao");
    } catch {
      avisar("Falha de conexão ao enviar a foto. Tente de novo.", true);
    } finally {
      setEnviando(false);
    }
  };

  const escolherBase = async (caminho: string) => {
    if (!marcos || !foto) return;
    setBase(caminho);
    await prepararBase(caminho, marcos, foto);
  };

  const gerar = async (tipo: "lentes" | "aparelho") => {
    if (!marcos || gerando) return;
    if (!props.acessoAtivo) return setBloqueio("acesso");
    if (saldo < 1) return setBloqueio("creditos");
    try {
      const r = await fetch("/api/geracoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plano.id,
          tipo,
          params: tipo === "lentes" ? lentes : { clarear: clarearJunto },
          boca: marcos.bocaInterna.map((p) => [Math.round(p.x), Math.round(p.y)]),
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        if (j.paywall) setBloqueio(saldo < 1 ? "creditos" : "acesso");
        else if (j.verificar) setBloqueio("verificar");
        else avisar(j.erro || "Não foi possível iniciar a geração.", true);
        return;
      }
      setSaldo(j.saldo);
      setDecorrido(0);
      setGerando({ id: j.id, inicio: Date.now() });
    } catch {
      avisar("Falha de conexão. Tente de novo.", true);
    }
  };

  useEffect(() => {
    if (!gerando) return;
    let vivo = true;
    const relogio = setInterval(() => setDecorrido((Date.now() - gerando.inicio) / 1000), 500);
    const consultar = async () => {
      try {
        const r = await fetch(`/api/geracoes/${gerando.id}`);
        if (r.status === 401) {
          window.location.href = "/entrar";
          return;
        }
        const j = await r.json();
        if (!vivo) return;
        if (j.status === "pronto") {
          setGeracoes((g) => [{ id: j.id, tipo: j.tipo, params: j.params, imagens: j.imagens, criado_em: j.criado_em }, ...g]);
          setSaldo(j.saldo);
          setGerando(null);
          setNivel(0);
          avisar("3 versões prontas. Toque para escolher.");
          setRevelar(Date.now());
          try {
            navigator.vibrate?.([12, 60, 24]);
          } catch {}
          void escolherBaseRef.current(j.imagens[0]);
          return;
        }
        if (j.status === "erro" || !r.ok) {
          setSaldo(j.saldo ?? saldo);
          setGerando(null);
          avisar("A geração não foi concluída. Seu crédito foi devolvido.", true);
          return;
        }
      } catch {}
      if (vivo) espera = setTimeout(consultar, 2500);
    };
    let espera = setTimeout(consultar, 3000);
    return () => {
      vivo = false;
      clearInterval(relogio);
      clearTimeout(espera);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gerando]);

  const escolherBaseRef = useRef(escolherBase);
  escolherBaseRef.current = escolherBase;

  const comporDepois = useCallback(() => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(imgBase.current || imgOriginal.current!, 0, 0, W, H);
    if (seg.current && dadosBase.current && nivel > 0) ctx.putImageData(clarear(dadosBase.current, seg.current, nivel), seg.current.x, seg.current.y);
    return c;
  }, [W, H, nivel]);

  const temSimulacao = nivel > 0 || base !== "";
  const geracaoDaBase = geracoes.find((g) => g.imagens.includes(base));

  const irPara = (destino: Etapa) => {
    if (destino !== "foto" && status !== "pronto") return;
    if ((destino === "comparar" || destino === "proposta") && !temSimulacao) {
      avisar("Faça uma simulação primeiro: escolha um nível de clareamento ou gere uma versão com IA.");
      setEtapa("simulacao");
      return;
    }
    if (destino === "comparar" || destino === "proposta") {
      const c = comporDepois();
      envioResultado.current = new Promise<void>((ok) => {
        c.toBlob(
          async (b) => {
            if (b) {
              setDepoisUrl(URL.createObjectURL(b));
              const fd = new FormData();
              fd.append("imagem", b, "resultado.jpg");
              await fetch(`/api/planos/${plano.id}/resultado`, { method: "POST", body: fd }).catch(() => {});
            }
            ok();
          },
          "image/jpeg",
          0.93,
        );
      });
      if (destino === "proposta" && !form.titulo) {
        const titulo =
          geracaoDaBase?.tipo === "lentes"
            ? "Lentes de contato dental"
            : geracaoDaBase?.tipo === "aparelho"
              ? "Alinhamento do sorriso"
              : "Clareamento dental";
        setForm({
          titulo,
          texto:
            "Esta é uma simulação de como o seu sorriso pode ficar com o tratamento proposto. Na consulta explico cada etapa, o tempo de tratamento e as formas de pagamento.",
          valor: "",
        });
      }
    }
    setVendoAntes(false);
    setEtapa(destino);
  };

  const criarProposta = async () => {
    if (form.titulo.trim().length < 3) return avisar("Dê um nome ao tratamento proposto.", true);
    setCriando(true);
    try {
      await envioResultado.current;
      const r = await fetch("/api/propostas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plano.id, ...form }),
      });
      const j = await r.json();
      if (!r.ok) return avisar(j.erro || "Não foi possível criar a proposta.", true);
      setPropostas((p) => [{ id: j.id, token: j.token, titulo: form.titulo, valor: form.valor, visualizacoes: 0, criado_em: Date.now() }, ...p]);
      avisar("Proposta criada. Envie o link para o paciente.");
    } catch {
      avisar("Falha de conexão. Tente de novo.", true);
    } finally {
      setCriando(false);
    }
  };

  const exportarImagem = async () => {
    if (!imgOriginal.current) return;
    await document.fonts.ready;
    const depois = comporDepois();
    const retrato = H >= W;
    const L = 1080;
    const topo = 96, rodape = 84, vao = 8;
    const lw = retrato ? (L - vao) / 2 : L;
    const lh = Math.round(lw * (H / W));
    const altura = topo + (retrato ? lh : lh * 2 + vao) + rodape;
    const c = document.createElement("canvas");
    c.width = L;
    c.height = altura;
    const ctx = c.getContext("2d")!;
    const estilo = getComputedStyle(document.documentElement);
    const display = estilo.getPropertyValue("--f-display") || "sans-serif";
    const mono = estilo.getPropertyValue("--f-mono") || "monospace";
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, L, altura);
    ctx.fillStyle = "#F5F2EA";
    ctx.font = `700 34px ${display}`;
    ctx.textBaseline = "middle";
    ctx.fillText(props.marca.toUpperCase().slice(0, 34), 36, topo / 2);
    ctx.fillStyle = "#E2B84C";
    ctx.fillRect(0, topo - 4, L, 4);
    const x2 = retrato ? lw + vao : 0, y2 = retrato ? topo : topo + lh + vao;
    ctx.drawImage(imgOriginal.current, 0, topo, lw, lh);
    ctx.drawImage(depois, x2, y2, lw, lh);
    const etiqueta = (texto: string, x: number, y: number, ouro: boolean) => {
      ctx.font = `800 24px ${mono}`;
      const tw = ctx.measureText(texto).width + 28;
      ctx.fillStyle = ouro ? "#E2B84C" : "rgba(0,0,0,.72)";
      ctx.fillRect(x, y, tw, 44);
      ctx.fillStyle = ouro ? "#130E02" : "#F5F2EA";
      ctx.fillText(texto, x + 14, y + 23);
    };
    etiqueta("ANTES", 18, topo + 18, false);
    etiqueta("DEPOIS", x2 + 18, y2 + 18, true);
    ctx.font = `800 26px ${mono}`;
    const sim = "● SIMULAÇÃO";
    const sw = ctx.measureText(sim).width + 36;
    const sy = y2 + lh - 66;
    ctx.fillStyle = "rgba(5,5,5,.86)";
    ctx.strokeStyle = "#E2B84C";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(x2 + 18, sy, sw, 48, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#E2B84C";
    ctx.fillText(sim, x2 + 36, sy + 25);
    ctx.fillStyle = "#9A9384";
    ctx.font = `600 19px ${mono}`;
    ctx.fillText("Simulação ilustrativa. Não representa garantia de resultado.", 36, altura - rodape / 2);
    c.toBlob(
      (b) => {
        if (!b) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(b);
        a.download = `simulacao-${paciente.nome.split(" ")[0].toLowerCase()}.jpg`;
        a.click();
        avisar("Imagem salva.");
        void fetch("/api/eventos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: "imagem_exportada" }) });
      },
      "image/jpeg",
      0.93,
    );
  };

  const paraSvg = (e: React.PointerEvent): Pt | null => {
    const s = svg.current;
    const matriz = s?.getScreenCTM();
    if (!s || !matriz) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(matriz.inverse());
    return { x: Math.max(0, Math.min(W, p.x)), y: Math.max(0, Math.min(H, p.y)) };
  };

  const moverPonto = (e: React.PointerEvent) => {
    const chave = arrastando.current;
    if (!chave) return;
    const p = paraSvg(e);
    if (p) setPontos((atual) => (atual ? { ...atual, [chave]: p } : atual));
  };

  const estiloZoom = useMemo(() => {
    if (!zoom || !marcos) return undefined;
    const largura = Math.hypot(marcos.comissuraD.x - marcos.comissuraE.x, marcos.comissuraD.y - marcos.comissuraE.y);
    const s = Math.max(1.4, Math.min(3.2, W / (largura * 1.9)));
    const cx = (marcos.comissuraE.x + marcos.comissuraD.x) / 2 / W;
    const cy = (marcos.labioSup.y + marcos.labioInf.y) / 2 / H;
    const tx = Math.min(0, Math.max(1 / s - 1, 0.5 / s - cx));
    const ty = Math.min(0, Math.max(1 / s - 1, 0.5 / s - cy));
    return { transform: `scale(${s}) translate(${tx * 100}%, ${ty * 100}%)`, transformOrigin: "0 0" };
  }, [zoom, marcos, W, H]);

  const linkDe = (token: string) => `${props.appUrl}/p/${token}`;
  const zapDe = (token: string) =>
    `https://wa.me/${paciente.whatsapp}?text=${encodeURIComponent(
      `Olá, ${paciente.nome.split(" ")[0]}! Preparei a simulação do seu sorriso. Veja aqui: ${linkDe(token)}`,
    )}`;

  const palco = foto && !trocando && (etapa === "foto" || etapa === "analise" || etapa === "simulacao");
  const etapaIndice = ETAPAS.findIndex((e) => e.id === etapa);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1120px] flex-col px-4 pb-10">
      <header className="sticky top-0 z-20 -mx-4 flex flex-col gap-2.5 border-b border-line bg-bg/95 px-4 pb-2.5 pt-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link href={`/app/pacientes/${paciente.id}`} aria-label="Voltar para o paciente" className="grid h-9 w-9 flex-none place-items-center rounded-lg border border-line bg-panel">
            <IcVoltar className="h-5 w-5" />
          </Link>
          <div className="flex min-w-0 flex-1 flex-col leading-tight">
            <b className="truncate font-display text-[16px]">{paciente.nome}</b>
            <span className="note truncate !text-[12px]">{plano.nome}</span>
          </div>
          <Link href="/app/creditos" className="tag gold no-underline" aria-label={`${saldo} créditos`}>
            <IcCreditos className="h-3.5 w-3.5" />
            {saldo}
          </Link>
        </div>
        <nav className="flex gap-1" aria-label="Etapas">
          {ETAPAS.map((e, i) => (
            <button
              key={e.id}
              onClick={() => irPara(e.id)}
              aria-current={etapa === e.id ? "step" : undefined}
              disabled={e.id !== "foto" && status !== "pronto"}
              className={`flex-1 rounded-md border px-1 py-1.5 font-mono text-[10px] font-extrabold uppercase tracking-[.06em] transition-colors disabled:opacity-35 ${
                etapa === e.id ? "border-gold bg-gold-soft text-gold" : i < etapaIndice ? "border-line text-ink" : "border-line text-muted"
              }`}
            >
              {e.nome}
            </button>
          ))}
        </nav>
      </header>

      <div className="grid flex-1 gap-5 pt-4 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        {palco && (
          <div className="lg:sticky lg:top-[108px]">
            <div
              className={`relative mx-auto overflow-hidden rounded-xl border border-line bg-black ${status === "analisando" || gerando ? "scanning" : ""}`}
              style={{ maxWidth: `calc(${etapa === "foto" ? 56 : 60}dvh * ${W / H})` }}
            >
              <div style={estiloZoom} className="transition-transform duration-300">
                <canvas ref={tela} width={W} height={H} className="block h-auto w-full" aria-label="Foto do paciente" />
                {revelar > 0 && <div key={revelar} className="revelacao" />}
                {etapa === "analise" && linhas && marcos && pontos && itemAtual && (
                  <svg
                    ref={svg}
                    viewBox={`0 0 ${W} ${H}`}
                    className="absolute inset-0 h-full w-full touch-none"
                    onPointerMove={moverPonto}
                    onPointerUp={() => (arrastando.current = null)}
                    onPointerLeave={() => (arrastando.current = null)}
                  >
                    <Linhas id={itemAtual.id} m={marcos} e={pontos} s={segOriginal} W={W} H={H} pegar={(k, ev) => {
                      arrastando.current = k;
                      (ev.target as Element).setPointerCapture?.(ev.pointerId);
                    }} />
                  </svg>
                )}
              </div>
              {etapa === "simulacao" && status === "pronto" && (
                <div className="absolute bottom-2 right-2 flex gap-2">
                  <button
                    className={`grid h-10 w-10 place-items-center rounded-full border bg-black/75 ${zoom ? "border-gold text-gold" : "border-line"}`}
                    aria-label="Aproximar o sorriso"
                    aria-pressed={zoom}
                    onClick={() => setZoom((z) => !z)}
                  >
                    <IcZoom className="h-5 w-5" />
                  </button>
                  {temSimulacao && (
                    <button
                      className={`flex h-10 select-none items-center gap-1.5 rounded-full border bg-black/75 px-3 font-mono text-[11px] font-extrabold uppercase tracking-wider ${vendoAntes ? "border-gold text-gold" : "border-line"}`}
                      onPointerDown={() => setVendoAntes(true)}
                      onPointerUp={() => setVendoAntes(false)}
                      onPointerLeave={() => setVendoAntes(false)}
                      onContextMenu={(e) => e.preventDefault()}
                    >
                      <IcOlho className="h-4 w-4" /> Segure: antes
                    </button>
                  )}
                </div>
              )}
              {etapa === "analise" && status === "pronto" && (
                <div className="absolute bottom-2 right-2 flex gap-2">
                  <button
                    className={`grid h-10 w-10 place-items-center rounded-full border bg-black/75 ${zoom ? "border-gold text-gold" : "border-line"}`}
                    aria-label="Aproximar o sorriso"
                    aria-pressed={zoom}
                    onClick={() => setZoom((z) => !z)}
                  >
                    <IcZoom className="h-5 w-5" />
                  </button>
                  <button
                    className={`grid h-10 w-10 place-items-center rounded-full border bg-black/75 ${linhas ? "border-gold text-gold" : "border-line"}`}
                    aria-label="Mostrar ou esconder as linhas"
                    aria-pressed={linhas}
                    onClick={() => setLinhas((l) => !l)}
                  >
                    <IcAnalise className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>
            {status === "analisando" && (
              <p className="note mt-3 text-center font-mono" role="status">
                Lendo o rosto e o sorriso…
              </p>
            )}
          </div>
        )}

        <div className={`flex flex-col gap-4 ${palco ? "" : "lg:col-span-2 lg:mx-auto lg:w-full lg:max-w-[560px]"}`}>
          {(etapa === "foto" && (!foto || trocando)) && <Captura aoEnviar={enviarFoto} enviando={enviando} />}

          {etapa === "foto" && foto && !trocando && (
            <div className="entra flex flex-col gap-3">
              {status === "semRosto" ? (
                <div className="card alert">
                  <h3>Não encontramos o rosto nesta foto</h3>
                  <p className="text-[15px] text-[var(--ok-2)]">
                    Use uma foto de frente, com o rosto inteiro (olhos e queixo aparecendo) e o paciente sorrindo com os dentes à mostra.
                  </p>
                </div>
              ) : (
                <div className="card">
                  <span className="kick">Foto pronta</span>
                  <h3>O rosto e o sorriso foram reconhecidos</h3>
                  <p className="note">Siga para a análise ou vá direto para a simulação.</p>
                </div>
              )}
              {status === "pronto" && (
                <div className="flex gap-2">
                  <button className="btn vi" onClick={() => irPara("analise")}>
                    Análise
                  </button>
                  <button className="btn" onClick={() => irPara("simulacao")}>
                    Simulação
                  </button>
                </div>
              )}
              <button className="btn dark" onClick={() => setTrocando(true)}>
                Trocar foto
              </button>
              {(geracoes.length > 0 || propostas.length > 0) && (
                <p className="note text-center">Ao trocar a foto, as simulações deste plano são refeitas a partir da nova imagem.</p>
              )}
            </div>
          )}

          {etapa === "foto" && trocando && foto && (
            <button className="btn ghost" onClick={() => setTrocando(false)}>
              Manter a foto atual
            </button>
          )}

          {etapa !== "foto" && status === "semRosto" && (
            <div className="card alert">
              <h3>Não encontramos o rosto nesta foto</h3>
              <button className="btn" onClick={() => { setEtapa("foto"); setTrocando(true); }}>
                Trocar foto
              </button>
            </div>
          )}

          {etapa === "analise" && status === "pronto" && itemAtual && (
            <div className="entra flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <button className="btn dark sm" disabled={indice === 0} onClick={() => setIndice((i) => Math.max(0, i - 1))} aria-label="Análise anterior">
                  ‹
                </button>
                <div className="flex flex-1 flex-col items-center">
                  <span className="kick">
                    Análise {Math.min(indice, analise.length - 1) + 1} de {analise.length}
                  </span>
                  <div className="bar mt-1.5 w-full">
                    <i style={{ width: `${((Math.min(indice, analise.length - 1) + 1) / analise.length) * 100}%` }} />
                  </div>
                </div>
                <button className="btn dark sm" disabled={indice >= analise.length - 1} onClick={() => setIndice((i) => Math.min(analise.length - 1, i + 1))} aria-label="Próxima análise">
                  ›
                </button>
              </div>
              <div key={itemAtual.id} className="card entra">
                <div className="flex items-baseline gap-3">
                  <h3 className="flex-1">{itemAtual.nome}</h3>
                  <span className="font-display text-[26px] font-bold text-gold">{itemAtual.valor}</span>
                </div>
                <p>
                  <mark>{itemAtual.destaque}</mark>
                </p>
                <p className="text-[15px] text-[var(--ok-2)]">{itemAtual.texto}</p>
              </div>
              <p className="note">Arraste os pontos dourados sobre a foto para ajustar as linhas.</p>
              <div className="chips">
                {analise.map((a, i) => (
                  <span key={a.id} role="button" tabIndex={0} onClick={() => setIndice(i)} onKeyDown={(e) => e.key === "Enter" && setIndice(i)} style={{ cursor: "pointer", opacity: i === indice ? 1 : 0.7 }}>
                    {a.nome}: <b>{a.valor}</b>
                  </span>
                ))}
              </div>
              <p className="note !text-[12px]">{RODAPE_ANALISE}</p>
              <button className="btn" onClick={() => irPara("simulacao")}>
                Ir para a simulação
              </button>
            </div>
          )}

          {etapa === "simulacao" && status === "pronto" && (
            <div className="entra flex flex-col gap-4">
              <div className="seg" role="tablist" aria-label="Tratamento">
                {(
                  [
                    ["clareamento", "Clareamento", IcBrilho],
                    ["lentes", "Lentes", IcDente],
                    ["aparelho", "Alinhamento", IcAlinhar],
                  ] as const
                ).map(([id, nome, Icone]) => (
                  <button key={id} role="tab" aria-pressed={modoSim === id} onClick={() => setModoSim(id)} className="!flex items-center justify-center gap-1.5">
                    <Icone className="h-4 w-4" /> {nome}
                  </button>
                ))}
              </div>

              {modoSim === "clareamento" && (
                <div className="card">
                  {temDentes ? (
                    <>
                      <div className="flex items-baseline gap-2">
                        <h3 className="flex-1">Clareamento</h3>
                        <span className="font-mono text-[13px] font-bold text-gold">{NIVEIS[nivel]}</span>
                      </div>
                      <input
                        type="range"
                        className="slider"
                        min={0}
                        max={6}
                        step={1}
                        value={nivel}
                        aria-label="Nível de clareamento"
                        style={{ ["--p" as string]: `${(nivel / 6) * 100}%` }}
                        onChange={(e) => setNivel(Number(e.target.value))}
                      />
                      <div className="flex justify-between font-mono text-[10px] font-bold uppercase tracking-wider text-muted">
                        <span>Original</span>
                        <span>Máximo</span>
                      </div>
                      <div className="flex gap-2">
                        <button className="btn dark sm flex-1" onClick={() => seg.current && setNivel(tomSugerido(seg.current))}>
                          <IcBrilho className="h-4 w-4" /> Sugerir tom
                        </button>
                        <button className="btn dark sm flex-1" disabled={nivel === 0} onClick={() => setNivel(0)}>
                          Zerar
                        </button>
                      </div>
                      <p className="note">O clareamento é feito na hora e não gasta créditos.</p>
                    </>
                  ) : (
                    <>
                      <h3>Os dentes não aparecem o suficiente</h3>
                      <p className="text-[15px] text-[var(--ok-2)]">Para simular o clareamento, use uma foto com o sorriso aberto e os dentes de cima à mostra.</p>
                    </>
                  )}
                </div>
              )}

              {modoSim === "lentes" && (
                <div className="card">
                  <h3>Lentes de contato dental</h3>
                  <Opcoes rotulo="Formato" valor={lentes.formato} aoMudar={(v) => setLentes((l) => ({ ...l, formato: v }))} opcoes={[["oval", "Oval"], ["quadrado", "Quadrado"], ["triangular", "Triangular"]]} />
                  <Opcoes rotulo="Cor" valor={lentes.cor} aoMudar={(v) => setLentes((l) => ({ ...l, cor: v }))} opcoes={[["BL1", "BL1"], ["BL2", "BL2"], ["A1", "A1"], ["B1", "B1"]]} />
                  <Opcoes rotulo="Dentes" valor={String(lentes.dentes)} aoMudar={(v) => setLentes((l) => ({ ...l, dentes: Number(v) }))} opcoes={[["6", "6"], ["8", "8"], ["10", "10"]]} />
                  <button className="btn shine" disabled={Boolean(gerando)} onClick={() => gerar("lentes")}>
                    Gerar 3 versões · 1 crédito
                  </button>
                </div>
              )}

              {modoSim === "aparelho" && (
                <div className="card">
                  <h3>Depois do alinhamento</h3>
                  <p className="text-[15px] text-[var(--ok-2)]">Mostra os dentes alinhados e nivelados, como ao final do aparelho ou dos alinhadores.</p>
                  <button className={`opt ${clarearJunto ? "picked" : ""}`} aria-pressed={clarearJunto} onClick={() => setClarearJunto((c) => !c)}>
                    <span className="rd" />
                    Clarear um ou dois tons junto
                  </button>
                  <button className="btn shine" disabled={Boolean(gerando)} onClick={() => gerar("aparelho")}>
                    Gerar 3 versões · 1 crédito
                  </button>
                </div>
              )}

              {gerando && (
                <div className="term" role="status" aria-live="polite">
                  <div className="term-h">
                    <i />
                    <i />
                    <i />
                    <span>odonto4k · ia · {Math.floor(decorrido)}s</span>
                  </div>
                  <div className="term-b">
                    {LOG_GERACAO.filter(([t]) => decorrido >= t).map(([t, texto], i, lista) => (
                      <div key={t}>
                        <span className="c">▸</span> {texto}
                        {i < lista.length - 1 ? <span className="m"> ok</span> : <span className="caret ml-1.5" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {geracoes.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="kick">Versões</span>
                  <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
                    <Miniatura ativa={base === ""} rotulo="Original" url={urlOriginal} aoEscolher={() => escolherBase("")} />
                    {geracoes.flatMap((g) =>
                      g.imagens.map((img, i) => (
                        <Miniatura
                          key={img}
                          ativa={base === img}
                          rotulo={`${g.tipo === "lentes" ? "Lentes" : "Alinh."} ${i + 1}`}
                          url={`/api/arquivos/${img}`}
                          aoEscolher={() => escolherBase(img)}
                        />
                      )),
                    )}
                  </div>
                </div>
              )}

              <button className="btn" onClick={() => irPara("comparar")}>
                <IcComparar className="h-5 w-5" /> Comparar antes e depois
              </button>
            </div>
          )}

          {etapa === "comparar" && foto && (
            <div className="entra flex flex-col gap-4 lg:mx-auto lg:w-full lg:max-w-[560px]">
              <div className="flex flex-col gap-1 text-center">
                <span className="kick">Antes e depois</span>
                <h2>Arraste para comparar</h2>
              </div>
              {depoisUrl ? (
                <Comparador antes={urlOriginal} depois={depoisUrl} proporcao={W / H} />
              ) : (
                <div className="scanning rounded-xl border border-line bg-black" style={{ aspectRatio: String(W / H) }} />
              )}
              <button className="btn shine" onClick={() => irPara("proposta")}>
                <IcEnviar className="h-5 w-5" /> Criar proposta para o paciente
              </button>
              <div className="flex gap-2">
                <button className="btn dark" onClick={exportarImagem}>
                  <IcBaixar className="h-5 w-5" /> Salvar imagem
                </button>
                <button className="btn dark" onClick={() => irPara("simulacao")}>
                  Ajustar
                </button>
              </div>
            </div>
          )}

          {etapa === "proposta" && foto && (
            <div className="entra flex flex-col gap-4 lg:mx-auto lg:w-full lg:max-w-[560px]">
              <div className="flex flex-col gap-1">
                <span className="kick">Proposta</span>
                <h2>O que o paciente vai receber</h2>
              </div>
              <div className="card">
                <label className="campo">
                  <span>Tratamento</span>
                  <input value={form.titulo} maxLength={90} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Lentes de contato dental" />
                </label>
                <label className="campo">
                  <span>Mensagem para o paciente</span>
                  <textarea value={form.texto} maxLength={1500} onChange={(e) => setForm((f) => ({ ...f, texto: e.target.value }))} />
                </label>
                <label className="campo">
                  <span>Investimento (opcional)</span>
                  <input value={form.valor} maxLength={40} onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))} placeholder="R$ 4.800 ou 12x de R$ 400" />
                </label>
                <button className="btn shine" disabled={criando} onClick={criarProposta}>
                  {criando ? "Criando…" : "Gerar link da proposta"}
                </button>
                <p className="note">O link abre o antes e depois com a marca “SIMULAÇÃO”, a sua mensagem e um botão para o paciente chamar você no WhatsApp.</p>
              </div>

              {propostas.map((p, i) => (
                <div key={p.id} className={`card ${i === 0 ? "gold" : ""}`}>
                  <div className="flex items-start gap-2">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <b className="truncate font-display text-[17px]">{p.titulo}</b>
                      <span className="note">
                        {new Date(p.criado_em).toLocaleDateString("pt-BR")}
                        {p.valor ? ` · ${p.valor}` : ""}
                      </span>
                    </div>
                    <span className="tag gold">
                      <IcOlho className="h-3.5 w-3.5" /> {p.visualizacoes}
                    </span>
                  </div>
                  <code className="truncate rounded-md border border-line bg-black px-2.5 py-2 font-mono text-[12px] text-champ">{linkDe(p.token)}</code>
                  <a className="btn ok" href={zapDe(p.token)} target="_blank" rel="noreferrer">
                    <IcEnviar className="h-5 w-5" /> Enviar no WhatsApp
                  </a>
                  <div className="flex gap-2">
                    <button
                      className="btn dark sm flex-1"
                      onClick={async () => {
                        const copiou = await navigator.clipboard.writeText(linkDe(p.token)).then(
                          () => true,
                          () => false,
                        );
                        avisar(copiou ? "Link copiado." : "Não foi possível copiar. Abra a proposta e copie o endereço.", !copiou);
                      }}
                    >
                      <IcCopiar className="h-4 w-4" /> Copiar
                    </button>
                    <a className="btn dark sm flex-1" href={`/p/${p.token}`} target="_blank" rel="noreferrer">
                      <IcOlho className="h-4 w-4" /> Abrir
                    </a>
                    <a className="btn dark sm flex-1" href={`/api/p/${p.token}/proposta.pdf`} target="_blank" rel="noreferrer">
                      <IcBaixar className="h-4 w-4" /> PDF
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Folha aberta={bloqueio !== null} fechar={() => setBloqueio(null)}>
        {bloqueio === "verificar" ? (
          <>
            <span className="kick">Falta um passo</span>
            <h2>Confirme seu e-mail para usar a IA</h2>
            <p className="text-[var(--ok-2)]">Enviamos um link de confirmação no seu cadastro. Você pode pedir um novo na tela Conta.</p>
            <Link href="/app/conta" className="btn">
              Ir para a Conta
            </Link>
          </>
        ) : (
          <>
            <span className="kick">{bloqueio === "creditos" ? "Créditos" : "Acesso pausado"}</span>
            <h2>{bloqueio === "creditos" ? "Seus créditos de IA acabaram" : "Escolha um plano para continuar"}</h2>
            <p className="text-[var(--ok-2)]">
              {bloqueio === "creditos"
                ? "O clareamento, a análise e as propostas continuam liberados. Para gerar lentes e alinhamento com IA, escolha um plano ou um pacote de créditos."
                : "Seus pacientes e planos estão guardados. Assine para voltar a simular e enviar propostas."}
            </p>
            <Link href="/app/creditos" className="btn ok shine">
              Ver planos
            </Link>
          </>
        )}
        <button className="btn dark" onClick={() => setBloqueio(null)}>
          Agora não
        </button>
      </Folha>
    </div>
  );
}

function Opcoes({ rotulo, valor, aoMudar, opcoes }: { rotulo: string; valor: string; aoMudar: (v: string) => void; opcoes: [string, string][] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[11px] font-bold uppercase tracking-[.1em] text-muted">{rotulo}</span>
      <div className="seg">
        {opcoes.map(([id, nome]) => (
          <button key={id} aria-pressed={valor === id} onClick={() => aoMudar(id)}>
            {nome}
          </button>
        ))}
      </div>
    </div>
  );
}

function Miniatura({ ativa, rotulo, url, aoEscolher }: { ativa: boolean; rotulo: string; url: string; aoEscolher: () => void }) {
  return (
    <button
      onClick={aoEscolher}
      aria-pressed={ativa}
      className={`relative h-24 w-24 flex-none overflow-hidden rounded-lg border-2 bg-black transition-colors ${ativa ? "border-gold shadow-[0_0_18px_-6px_var(--cy)]" : "border-line"}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
      <span className={`absolute inset-x-0 bottom-0 px-1 py-0.5 font-mono text-[9.5px] font-extrabold uppercase tracking-wide ${ativa ? "bg-gold text-gold-ink" : "bg-black/75 text-ink"}`}>
        {rotulo}
      </span>
      {ativa && (
        <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-gold text-gold-ink">
          <IcCheck className="h-3.5 w-3.5" />
        </span>
      )}
    </button>
  );
}

function Linhas({
  id,
  m,
  e,
  s,
  W,
  H,
  pegar,
}: {
  id: ItemAnalise["id"];
  m: Marcos;
  e: Editaveis;
  s: Segmentacao | null;
  W: number;
  H: number;
  pegar: (k: keyof Editaveis, ev: React.PointerEvent) => void;
}) {
  const t = Math.max(1.5, W / 420);
  const ouro = "#E2B84C", champ = "#F5F2EA";
  const estender = (a: Pt, b: Pt, f: number): [Pt, Pt] => {
    const dx = b.x - a.x, dy = b.y - a.y;
    return [{ x: a.x - dx * f, y: a.y - dy * f }, { x: b.x + dx * f, y: b.y + dy * f }];
  };
  const linha = (a: Pt, b: Pt, cor: string, extra: React.SVGProps<SVGLineElement> = {}) => (
    <>
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#000" strokeOpacity={0.45} strokeWidth={t * 2.6} strokeLinecap="round" />
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={cor} strokeWidth={t} strokeLinecap="round" {...extra} />
    </>
  );
  const alca = (k: keyof Editaveis) => (
    <g key={k} style={{ cursor: "grab" }} onPointerDown={(ev) => pegar(k, ev)}>
      <circle cx={e[k].x} cy={e[k].y} r={Math.max(18, W / 26)} fill="transparent" />
      <circle cx={e[k].x} cy={e[k].y} r={Math.max(5, W / 110)} fill={ouro} stroke="#130E02" strokeWidth={t} />
    </g>
  );
  const { centro, dir, eixo } = medianaFacial(e.pupilaE, e.pupilaD);
  const ateBoca = (m.labioInf.y - centro.y) * 1.35;

  if (id === "bipupilar") {
    const [a, b] = estender(e.pupilaE, e.pupilaD, 0.6);
    return (
      <>
        {linha(a, b, ouro)}
        {alca("pupilaE")}
        {alca("pupilaD")}
      </>
    );
  }
  if (id === "comissuras") {
    const [a, b] = estender(e.comissuraE, e.comissuraD, 0.35);
    const meio = { x: (e.comissuraE.x + e.comissuraD.x) / 2, y: (e.comissuraE.y + e.comissuraD.y) / 2 };
    const meia = Math.hypot(b.x - a.x, b.y - a.y) / 2;
    return (
      <>
        {linha({ x: meio.x - eixo.x * meia, y: meio.y - eixo.y * meia }, { x: meio.x + eixo.x * meia, y: meio.y + eixo.y * meia }, champ, { strokeDasharray: `${t * 4} ${t * 4}`, strokeOpacity: 0.8 })}
        {linha(a, b, ouro)}
        {alca("comissuraE")}
        {alca("comissuraD")}
      </>
    );
  }
  if (id === "mediana") {
    const fim = { x: centro.x + dir.x * ateBoca, y: centro.y + dir.y * ateBoca };
    const ini = { x: centro.x - dir.x * ateBoca * 0.25, y: centro.y - dir.y * ateBoca * 0.25 };
    const meia = m.irisPx * 1.1;
    const d1 = { x: e.medianaDental.x - dir.x * meia, y: e.medianaDental.y - dir.y * meia };
    const d2 = { x: e.medianaDental.x + dir.x * meia, y: e.medianaDental.y + dir.y * meia };
    return (
      <>
        {linha(ini, fim, champ, { strokeDasharray: `${t * 4} ${t * 4}`, strokeOpacity: 0.85 })}
        {linha(d1, d2, ouro)}
        {alca("medianaDental")}
      </>
    );
  }
  if (id === "largura") {
    const marca = (p: Pt) => linha({ x: p.x - dir.x * m.irisPx * 0.5, y: p.y - dir.y * m.irisPx * 0.5 }, { x: p.x + dir.x * m.irisPx * 0.5, y: p.y + dir.y * m.irisPx * 0.5 }, ouro);
    return (
      <>
        {linha(m.faceE, m.faceD, champ, { strokeDasharray: `${t * 4} ${t * 4}`, strokeOpacity: 0.6 })}
        {linha(e.comissuraE, e.comissuraD, ouro)}
        {marca(e.comissuraE)}
        {marca(e.comissuraD)}
        {alca("comissuraE")}
        {alca("comissuraD")}
      </>
    );
  }
  if (id === "corredor" && s) {
    const y1 = m.labioSup.y - m.irisPx * 0.4, y2 = m.labioInf.y + m.irisPx * 0.4;
    const faixa = (x1: number, x2: number) => <rect x={Math.min(x1, x2)} y={y1} width={Math.abs(x2 - x1)} height={y2 - y1} fill={ouro} fillOpacity={0.28} />;
    return (
      <>
        {faixa(m.cantoIntE.x, s.dentesMinX)}
        {faixa(s.dentesMaxX, m.cantoIntD.x)}
        {linha({ x: s.dentesMinX, y: y1 }, { x: s.dentesMinX, y: y2 }, ouro)}
        {linha({ x: s.dentesMaxX, y: y1 }, { x: s.dentesMaxX, y: y2 }, ouro)}
        {linha({ x: m.cantoIntE.x, y: y1 }, { x: m.cantoIntE.x, y: y2 }, champ, { strokeDasharray: `${t * 3} ${t * 3}` })}
        {linha({ x: m.cantoIntD.x, y: y1 }, { x: m.cantoIntD.x, y: y2 }, champ, { strokeDasharray: `${t * 3} ${t * 3}` })}
      </>
    );
  }
  if (id === "gengiva" && s) {
    const cx = e.medianaDental.x;
    const meia = m.irisPx * 1.3;
    const yLabio = s.topoDentes - (s.gengivaPx || 0);
    return (
      <>
        {linha({ x: cx - meia, y: yLabio }, { x: cx + meia, y: yLabio }, champ, { strokeDasharray: `${t * 3} ${t * 3}` })}
        {linha({ x: cx - meia, y: s.topoDentes }, { x: cx + meia, y: s.topoDentes }, ouro)}
        {linha({ x: cx + meia * 0.85, y: yLabio }, { x: cx + meia * 0.85, y: s.topoDentes }, ouro)}
      </>
    );
  }
  return null;
}
