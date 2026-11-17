export const APP_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

export const TESTE = { dias: 7, creditos: 10 };

export type PlanoId = "pro" | "clinica";

export const PLANOS: Record<
  PlanoId,
  { id: PlanoId; nome: string; mensal: number; anual: number; creditos: number; resumo: string; itens: string[] }
> = {
  pro: {
    id: "pro",
    nome: "Pro",
    mensal: 97,
    anual: 970,
    creditos: 60,
    resumo: "Para o consultório que apresenta casos toda semana.",
    itens: [
      "60 simulações com IA por mês",
      "Clareamento e análise do sorriso sem limite",
      "Propostas com a marca da sua clínica",
      "Pacientes e planos ilimitados",
    ],
  },
  clinica: {
    id: "clinica",
    nome: "Clínica",
    mensal: 197,
    anual: 1970,
    creditos: 200,
    resumo: "Para a clínica com mais de um dentista atendendo.",
    itens: [
      "200 simulações com IA por mês",
      "Clareamento e análise do sorriso sem limite",
      "Propostas com a marca da sua clínica",
      "Atendimento prioritário no suporte",
    ],
  },
};

export const PACOTE = { creditos: 30, preco: 47 };

export const CUSTO_GERACAO = 1;
export const VARIACOES = 3;

export const TOLERANCIA_PAGAMENTO_DIAS = 3;
export const RETENCAO_INATIVO_DIAS = 90;
export const SESSAO_DIAS = 30;

export function linkCheckout(chave: "pro_mensal" | "pro_anual" | "clinica_mensal" | "clinica_anual" | "pacote") {
  const mapa = {
    pro_mensal: process.env.KIWIFY_LINK_PRO_MENSAL,
    pro_anual: process.env.KIWIFY_LINK_PRO_ANUAL,
    clinica_mensal: process.env.KIWIFY_LINK_CLINICA_MENSAL,
    clinica_anual: process.env.KIWIFY_LINK_CLINICA_ANUAL,
    pacote: process.env.KIWIFY_LINK_PACOTE,
  };
  return mapa[chave] || "";
}

export function ehAdmin(email: string) {
  const lista = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return lista.includes(email.toLowerCase());
}

/** "Dra. Ana Souza" vira "Dra. Ana"; "Ana Souza" vira "Ana". */
export function primeiroNome(nome: string) {
  const p = nome.trim().split(/\s+/);
  return /^(dra?|profa?)\.?$/i.test(p[0] || "") && p[1] ? `${p[0]} ${p[1]}` : p[0] || "";
}

export function reais(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: v % 1 ? 2 : 0 });
}
