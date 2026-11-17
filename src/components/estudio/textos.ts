import type { Medidas } from "@/lib/client/rosto";

export type ItemAnalise = {
  id: "bipupilar" | "comissuras" | "mediana" | "largura" | "corredor" | "gengiva";
  nome: string;
  valor: string;
  destaque: string;
  texto: string;
};

const n1 = (v: number) => Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function montarAnalise(m: Medidas): ItemAnalise[] {
  const bip = Math.abs(m.bipupilarGraus);
  const com = Math.abs(m.comissuraGraus);
  const desvio = Math.abs(m.desvioMedianaMm);
  const ladoDesvio = m.desvioMedianaMm > 0 ? "esquerdo" : "direito";
  const ladoAlto = m.comissuraGraus > 0 ? "direito" : "esquerdo";

  const itens: ItemAnalise[] = [
    {
      id: "bipupilar",
      nome: "Linha bipupilar",
      valor: `${n1(bip)}°`,
      destaque: bip <= 1.5 ? "Rosto nivelado na foto" : "Cabeça inclinada na foto",
      texto:
        bip <= 1.5
          ? "A linha que liga as pupilas é a referência horizontal do rosto. Ela está praticamente reta, então as outras medidas partem de uma base confiável."
          : "A linha que liga as pupilas é a referência horizontal do rosto. A cabeça está um pouco inclinada nesta foto, e as demais medidas já descontam essa inclinação.",
    },
    {
      id: "comissuras",
      nome: "Linha das comissuras",
      valor: `${n1(com)}°`,
      destaque: com <= 2 ? "Sorriso paralelo aos olhos" : `Canto ${ladoAlto} da boca mais alto`,
      texto:
        com <= 2
          ? "A linha que liga os cantos da boca acompanha a linha dos olhos. É o que se espera de um sorriso equilibrado."
          : `Ao sorrir, o canto ${ladoAlto} da boca sobe mais do que o outro. Isso faz o sorriso parecer inclinado em relação aos olhos e pode ser compensado no desenho das bordas dos dentes.`,
    },
    {
      id: "mediana",
      nome: "Linha média",
      valor: `${n1(desvio)} mm`,
      destaque: desvio <= 1 ? "Linhas médias coincidentes" : desvio <= 2 ? "Desvio leve" : `Desvio para o lado ${ladoDesvio}`,
      texto:
        desvio <= 1
          ? "A linha entre os dois incisivos centrais coincide com a linha média do rosto."
          : desvio <= 2
            ? `A linha entre os incisivos centrais está ${n1(desvio)} mm para o lado ${ladoDesvio} do paciente. Um desvio desse tamanho costuma passar despercebido.`
            : `A linha entre os incisivos centrais está ${n1(desvio)} mm para o lado ${ladoDesvio} do paciente em relação ao centro do rosto. É um desvio que as pessoas costumam notar.`,
    },
    {
      id: "largura",
      nome: "Largura do sorriso",
      valor: `${Math.round(m.larguraSorrisoPct)}%`,
      destaque: `${n1(m.larguraSorrisoMm)} mm entre os cantos da boca`,
      texto: `Ao sorrir, a boca ocupa ${Math.round(m.larguraSorrisoPct)}% da largura do rosto. Use esta medida para comparar o antes e o depois e para conversar sobre quantos dentes aparecem no sorriso.`,
    },
  ];

  if (m.corredorPct !== null) {
    const c = m.corredorPct;
    itens.push({
      id: "corredor",
      nome: "Corredor bucal",
      valor: `${Math.round(c)}%`,
      destaque: c < 8 ? "Sorriso cheio" : c <= 18 ? "Corredor equilibrado" : "Corredor amplo",
      texto:
        c < 8
          ? "Os dentes preenchem quase toda a largura do sorriso. Quase não há espaço escuro nas laterais."
          : c <= 18
            ? "Há um pequeno espaço escuro entre os dentes do fundo e os cantos da boca. Essa proporção costuma ser percebida como natural."
            : "Aparece um espaço escuro maior nas laterais do sorriso. Ele pode ser reduzido com expansão da arcada ou com lentes nos pré-molares.",
    });
  }

  if (m.gengivaMm !== null) {
    const g = m.gengivaMm;
    itens.push({
      id: "gengiva",
      nome: "Exposição da gengiva",
      valor: `${n1(g)} mm`,
      destaque: g < 0.5 ? "Gengiva quase não aparece" : g <= 3 ? "Exposição dentro do esperado" : "Sorriso gengival",
      texto:
        g < 0.5
          ? "O lábio superior cobre a margem da gengiva ao sorrir. É uma linha de sorriso média ou baixa."
          : g <= 3
            ? `Aparecem cerca de ${n1(g)} mm de gengiva acima dos incisivos centrais. Até 3 mm é considerado harmônico.`
            : `Aparecem cerca de ${n1(g)} mm de gengiva acima dos incisivos centrais. Acima de 3 mm o sorriso é chamado de gengival, e vale conversar sobre gengivoplastia.`,
    });
  }
  return itens;
}

export const RODAPE_ANALISE = "Medidas estimadas a partir da foto. A escala em milímetros usa o diâmetro da íris como referência.";
