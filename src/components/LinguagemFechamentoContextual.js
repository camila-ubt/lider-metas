"use client";

import { useEffect } from "react";
import { contextoDoMes } from "@/lib/contextoMes";

function mesSelecionado() {
  return (
    document.querySelector('.top-actions input[type="month"]')?.value ||
    document.querySelector('input[type="month"]')?.value ||
    ""
  );
}

function texto(elemento) {
  return elemento?.textContent?.replace(/\s+/g, " ").trim() || "";
}

function definirTexto(elemento, valor) {
  if (elemento && texto(elemento) !== valor) elemento.textContent = valor;
}

function encontrarPorTexto(container, seletor, valor) {
  return Array.from(container.querySelectorAll(seletor)).find(
    (elemento) => texto(elemento).toLocaleLowerCase("pt-BR") === valor,
  );
}

function substituirInicio(container, seletor, inicio, substituto) {
  Array.from(container.querySelectorAll(seletor)).forEach((elemento) => {
    const atual = texto(elemento);
    if (atual.startsWith(inicio)) {
      definirTexto(elemento, `${substituto}${atual.slice(inicio.length)}`);
    }
  });
}

function aplicarNoFechamento() {
  const mes = mesSelecionado();
  if (!mes) return;

  const contexto = contextoDoMes(mes);
  const launcher = Array.from(document.querySelectorAll("button")).find(
    (botao) =>
      [
        "Prévia / fechamento",
        "Planejamento do mês",
        "Prévia do mês",
        "Fechamento do mês",
      ].includes(texto(botao)),
  );

  if (launcher) {
    definirTexto(
      launcher,
      contexto.tipo === "futuro"
        ? "Planejamento do mês"
        : contexto.tipo === "encerrado"
          ? "Fechamento do mês"
          : "Prévia do mês",
    );
  }

  const modal = document.querySelector("#fechamento-impressao");
  if (!modal) return;

  const titulo = modal.querySelector("h2");
  const tituloAtual = texto(titulo);
  const separador = tituloAtual.includes("—")
    ? tituloAtual.slice(tituloAtual.indexOf("—"))
    : "";

  if (contexto.tipo === "futuro") {
    definirTexto(titulo, `Planejamento ${separador}`.trim());
  } else if (contexto.tipo === "encerrado") {
    definirTexto(titulo, `Fechamento ${separador}`.trim());
  } else {
    definirTexto(titulo, `Prévia ${separador}`.trim());
  }

  const aviso = Array.from(modal.querySelectorAll("div")).find((elemento) => {
    const forte = elemento.querySelector(":scope > strong");
    return forte && elemento.querySelector(":scope > span");
  });
  const avisoTitulo = aviso?.querySelector(":scope > strong");
  const avisoTexto = aviso?.querySelector(":scope > span");

  if (contexto.tipo === "futuro") {
    definirTexto(avisoTitulo, "Mês ainda não iniciado");
    definirTexto(
      avisoTexto,
      "O período selecionado ainda não começou. Não há resultado, projeção ou probabilidade para avaliar. Cadastre as metas e alinhe o planejamento antes da abertura.",
    );
  } else if (contexto.tipo === "encerrado" && avisoTitulo) {
    definirTexto(avisoTitulo, "Fechamento com lançamentos pendentes");
  } else if (avisoTitulo && texto(avisoTitulo).includes("Prévia parcial")) {
    definirTexto(avisoTitulo, "Mês em andamento");
  }

  const resultadoGeral = encontrarPorTexto(
    modal,
    "span",
    "resultado geral",
  );
  if (contexto.tipo === "futuro") {
    definirTexto(resultadoGeral, "Planejamento do mês");
  } else if (contexto.tipo === "encerrado") {
    definirTexto(resultadoGeral, "Resultado final");
  }

  const tituloInsights = encontrarPorTexto(
    modal,
    "h3",
    "insights do fechamento",
  );
  if (contexto.tipo === "futuro") {
    definirTexto(tituloInsights, "Orientações antes da abertura");
  } else if (contexto.tipo !== "encerrado") {
    definirTexto(tituloInsights, "Insights do mês em andamento");
  }

  if (contexto.tipo === "futuro") {
    const projecao = encontrarPorTexto(modal, "span", "projeção");
    definirTexto(projecao, "Projeção após a abertura");

    const insights = Array.from(modal.querySelectorAll("article p")).filter(
      (paragrafo) => paragrafo.closest("section")?.querySelector("h3") === tituloInsights,
    );
    const mensagens = [
      "O mês ainda não começou; por isso, não há desempenho a avaliar.",
      "Cadastre as metas por loja e período antes da abertura.",
      "Projeções, tendências e comparativos serão iniciados com os primeiros lançamentos.",
    ];
    insights.forEach((paragrafo, indice) => {
      definirTexto(paragrafo, mensagens[indice] || mensagens.at(-1));
    });
  }

  if (contexto.tipo === "encerrado") {
    substituirInicio(
      modal,
      "p",
      "O resultado atual está",
      "O mês encerrou",
    );
    substituirInicio(
      modal,
      "p",
      "O resultado alcançou",
      "O mês encerrou com",
    );

    Array.from(modal.querySelectorAll("p")).forEach((paragrafo) => {
      let atual = texto(paragrafo);
      if (atual.includes(" lidera com ")) {
        atual = atual.replace(" lidera com ", " encerrou na liderança com ");
      }
      if (atual.includes(" está abaixo da Meta e merece atenção no planejamento.")) {
        atual = atual.replace(
          " está abaixo da Meta e merece atenção no planejamento.",
          " encerrou abaixo da Meta e deve orientar o plano do próximo mês.",
        );
      }
      if (atual.startsWith("Mantido o ritmo atual")) {
        atual = "O mês já encerrou. A leitura considera apenas os lançamentos disponíveis e não utiliza projeção futura.";
      }
      if (atual.startsWith("Prévia calculada com os lançamentos realizados")) {
        atual = "Fechamento parcial: ainda existem lançamentos pendentes, portanto os totais podem mudar após a conferência.";
      }
      definirTexto(paragrafo, atual);
    });
  }
}

export default function LinguagemFechamentoContextual() {
  useEffect(() => {
    let temporizador;
    let aplicando = false;

    function agendar() {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        if (aplicando) return;
        aplicando = true;
        aplicarNoFechamento();
        aplicando = false;
      }, 80);
    }

    agendar();
    document.addEventListener("click", agendar, true);
    document.addEventListener("change", agendar, true);
    const observador = new MutationObserver(agendar);
    observador.observe(document.body, { subtree: true, childList: true });

    return () => {
      clearTimeout(temporizador);
      document.removeEventListener("click", agendar, true);
      document.removeEventListener("change", agendar, true);
      observador.disconnect();
    };
  }, []);

  return null;
}
