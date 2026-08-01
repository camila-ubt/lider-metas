"use client";

import { useEffect } from "react";

const BLOCOS = [
  {
    origem: "comparativo histórico",
    titulo: "📊 Comparativo histórico",
  },
  {
    origem: "projeção e inferência estatística",
    titulo: "📈 Projeção estatística",
  },
  {
    origem: "tendência e consistência",
    titulo: "📉 Tendências",
  },
];

function normalizar(valor) {
  return String(valor || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function localizarAnaliseOriginal() {
  const marcador = Array.from(document.querySelectorAll("p")).find(
    (elemento) => normalizar(elemento.textContent) === "leitura gerencial avançada",
  );

  return marcador?.closest("section") || null;
}

function localizarBloco(secao, titulo) {
  return Array.from(secao.querySelectorAll("details")).find((details) => {
    const summary = details.querySelector(":scope > summary");
    const strong = summary?.querySelector("strong");
    return normalizar(strong?.textContent || summary?.textContent).startsWith(titulo);
  });
}

function prepararBloco(bloco) {
  bloco.open = true;
  bloco.style.setProperty("display", "block", "important");
  bloco.style.setProperty("margin", "0", "important");
  bloco.style.setProperty("border", "0", "important");
  bloco.style.setProperty("box-shadow", "none", "important");
  bloco.style.setProperty("background", "transparent", "important");

  const summary = bloco.querySelector(":scope > summary");
  if (summary) summary.style.setProperty("display", "none", "important");
}

function textoDoParagrafo(bloco, teste) {
  return Array.from(bloco.querySelectorAll("p"))
    .map((item) => item.textContent?.trim())
    .find((texto) => texto && teste(normalizar(texto)));
}

function gerarInsights(blocos) {
  const [historico, projecao, tendencia] = blocos;
  const insights = [];

  const comparacao = textoDoParagrafo(
    historico,
    (texto) => texto.includes("mesmo período") || texto.includes("mesmo periodo"),
  );
  if (comparacao) insights.push(comparacao);

  const supermeta = Array.from(projecao.querySelectorAll("strong")).find(
    (item) => normalizar(item.textContent) === "supermeta",
  );
  const chanceSuper = supermeta?.parentElement?.querySelector("span")?.textContent?.trim();
  if (chanceSuper) {
    insights.push(`A probabilidade de Supermeta é de ${chanceSuper}.`);
  }

  const artigosTendencia = Array.from(tendencia.querySelectorAll("article"));
  const artigoRitmo = artigosTendencia.find(
    (artigo) =>
      normalizar(artigo.querySelector("span")?.textContent) === "tendência recente",
  );
  const ritmo = artigoRitmo?.querySelector("strong")?.textContent?.trim();
  const detalheRitmo = artigoRitmo?.querySelector("p")?.textContent?.trim();
  if (ritmo) {
    insights.push(`O ritmo recente está ${ritmo}.${detalheRitmo ? ` ${detalheRitmo}` : ""}`);
  }

  const artigoRegularidade = artigosTendencia.find(
    (artigo) => normalizar(artigo.querySelector("span")?.textContent) === "regularidade",
  );
  const lojaConsistente = artigoRegularidade?.querySelector("strong")?.textContent?.trim();
  const detalheConsistencia = artigoRegularidade?.querySelector("p")?.textContent?.trim();
  if (lojaConsistente && normalizar(lojaConsistente) !== "sem amostra") {
    insights.push(
      `${lojaConsistente} apresenta a maior consistência.${
        detalheConsistencia ? ` ${detalheConsistencia}` : ""
      }`,
    );
  }

  return insights.slice(0, 4);
}

function criarAba(blocos) {
  const details = document.createElement("details");
  details.className = "inteligencia-gerencial-unificada";
  details.dataset.inteligenciaGerencial = "true";

  const summary = document.createElement("summary");
  summary.innerHTML = `
    <div>
      <strong>🧠 Inteligência Gerencial</strong>
      <span>Projeções, tendências e comparativos históricos.</span>
    </div>
    <i aria-hidden="true">⌄</i>
  `;

  const conteudo = document.createElement("div");
  conteudo.className = "inteligencia-gerencial-conteudo";

  BLOCOS.forEach((configuracao, indice) => {
    const secao = document.createElement("section");
    secao.className = "inteligencia-gerencial-secao";

    const titulo = document.createElement("h3");
    titulo.textContent = configuracao.titulo;

    prepararBloco(blocos[indice]);
    secao.append(titulo, blocos[indice]);
    conteudo.appendChild(secao);
  });

  const secaoInsights = document.createElement("section");
  secaoInsights.className = "inteligencia-gerencial-secao";

  const tituloInsights = document.createElement("h3");
  tituloInsights.textContent = "💡 Insights automáticos";

  const listaInsights = document.createElement("div");
  listaInsights.className = "inteligencia-gerencial-insights";

  const insights = gerarInsights(blocos);
  const textos = insights.length
    ? insights
    : ["Os insights serão gerados assim que houver dados suficientes no mês selecionado."];

  textos.forEach((texto) => {
    const artigo = document.createElement("article");
    const paragrafo = document.createElement("p");
    paragrafo.textContent = texto;
    artigo.appendChild(paragrafo);
    listaInsights.appendChild(artigo);
  });

  secaoInsights.append(tituloInsights, listaInsights);
  conteudo.appendChild(secaoInsights);
  details.append(summary, conteudo);

  return details;
}

function montar() {
  const original = localizarAnaliseOriginal();
  const atual = document.querySelector("details.inteligencia-gerencial-unificada");

  if (!original) {
    atual?.remove();
    return false;
  }

  if (original.dataset.inteligenciaSubstituida === "true" && atual) {
    return true;
  }

  const blocos = BLOCOS.map((item) => localizarBloco(original, item.origem));
  if (blocos.some((bloco) => !bloco)) return false;

  atual?.remove();
  const aba = criarAba(blocos);
  original.parentElement?.insertBefore(aba, original);
  original.style.setProperty("display", "none", "important");
  original.dataset.inteligenciaSubstituida = "true";

  return true;
}

export default function InteligenciaGerencialUnificada() {
  useEffect(() => {
    let temporizador;
    let montando = false;
    let tentativas = 0;

    const executar = () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        if (montando) return;
        montando = true;
        const pronto = montar();
        montando = false;

        if (!pronto && tentativas < 50) {
          tentativas += 1;
          executar();
        }
      }, 100);
    };

    executar();

    const observador = new MutationObserver((mutacoes) => {
      const alteracaoExterna = mutacoes.some((mutacao) => {
        const alvo = mutacao.target;
        return !(
          alvo instanceof Element &&
          alvo.closest(".inteligencia-gerencial-unificada")
        );
      });

      if (alteracaoExterna) executar();
    });

    observador.observe(document.body, { subtree: true, childList: true });

    return () => {
      clearTimeout(temporizador);
      observador.disconnect();
    };
  }, []);

  return null;
}
