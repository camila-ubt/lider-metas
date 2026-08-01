"use client";

import { useEffect } from "react";
import {
  minutosDoHorario,
  useHorariosPeriodos,
} from "@/lib/horariosPeriodos";

const dinheiro = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const nomesNiveis = new Set(["Meta", "Supermeta", "Megameta"]);

function texto(elemento) {
  return elemento?.textContent?.replace(/\s+/g, " ").trim() || "";
}

function valorMoeda(valor) {
  const numero = String(valor || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return Number(numero) || 0;
}

function mesSelecionado() {
  return (
    document.querySelector('.top-actions input[type="month"]')?.value ||
    document.querySelector('input[type="month"]')?.value ||
    ""
  );
}

function encontrarArtigoPorMarcador(marcador) {
  return Array.from(document.querySelectorAll("article")).find((artigo) =>
    Array.from(artigo.querySelectorAll("p")).some(
      (paragrafo) => texto(paragrafo).toUpperCase() === marcador,
    ),
  );
}

function encontrarRanking() {
  return encontrarArtigoPorMarcador("RANKING INTERATIVO");
}

function encontrarJornada() {
  return encontrarArtigoPorMarcador("JORNADA DO MÊS");
}

function diasDoMes(mes) {
  const [ano, numeroMes] = mes.split("-").map(Number);
  if (!ano || !numeroMes) return 0;
  return new Date(ano, numeroMes, 0).getDate();
}

function estadoDoMes(mes, horarios) {
  const [ano, numeroMes] = mes.split("-").map(Number);
  const agora = new Date();
  const totalDias = diasDoMes(mes);

  if (!ano || !numeroMes || !totalDias) {
    return {
      encerrado: false,
      totalDias: 0,
      geral: 0,
      manha: 0,
      noite: 0,
    };
  }

  const atual =
    ano === agora.getFullYear() && numeroMes === agora.getMonth() + 1;
  const passado =
    ano < agora.getFullYear() ||
    (ano === agora.getFullYear() && numeroMes < agora.getMonth() + 1);
  const futuro = !atual && !passado;

  if (passado) {
    return {
      encerrado: true,
      totalDias,
      geral: 0,
      manha: 0,
      noite: 0,
    };
  }

  if (futuro) {
    return {
      encerrado: false,
      totalDias,
      geral: totalDias,
      manha: totalDias,
      noite: totalDias,
    };
  }

  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
  const fimManha = minutosDoHorario(horarios.manhaFim);
  const fimNoite = Math.max(
    fimManha,
    minutosDoHorario(horarios.noiteFim),
  );
  const diasDepoisHoje = Math.max(totalDias - agora.getDate(), 0);

  return {
    encerrado: false,
    totalDias,
    geral: diasDepoisHoje + (minutosAgora < fimNoite ? 1 : 0),
    manha: diasDepoisHoje + (minutosAgora < fimManha ? 1 : 0),
    noite: diasDepoisHoje + (minutosAgora < fimNoite ? 1 : 0),
  };
}

function vendidoDaLoja(detalhes) {
  const rotulo = Array.from(detalhes.querySelectorAll("span")).find(
    (elemento) => texto(elemento) === "Vendido",
  );
  return valorMoeda(rotulo?.parentElement?.querySelector("strong")?.textContent);
}

function vendidoDoPeriodo(artigo) {
  const valor = Array.from(artigo.querySelectorAll("strong")).find((elemento) =>
    texto(elemento).startsWith("R$"),
  );
  return valorMoeda(valor?.textContent);
}

function vendidoDaJornada(artigo) {
  const subtitulo = Array.from(artigo.querySelectorAll("p")).find((elemento) =>
    texto(elemento).includes(" vendidos"),
  );
  return valorMoeda(subtitulo?.textContent);
}

function nomeDoPeriodo(artigo) {
  return texto(
    Array.from(artigo.querySelectorAll("span")).find((elemento) =>
      ["Manhã", "Noite"].includes(texto(elemento)),
    ),
  );
}

function formatarSituacao({ alvo, vendido, encerrado, diasCalculo, totalDias }) {
  if (!(alvo > 0)) return "Sem meta";
  if (vendido >= alvo) return encerrado ? "Conquistada" : "Batida";

  const falta = Math.max(alvo - vendido, 0);

  if (encerrado) {
    const mediaDoMes = totalDias > 0 ? falta / totalDias : falta;
    return `Faltaram ${dinheiro.format(falta)} · ${dinheiro.format(mediaDoMes)}/dia do mês`;
  }

  if (diasCalculo > 0) {
    return `Faltam ${dinheiro.format(falta)} · ${dinheiro.format(falta / diasCalculo)}/dia`;
  }

  return `Faltam ${dinheiro.format(falta)}`;
}

function atualizarNiveisDoBloco({ bloco, vendido, estado, diasCalculo }) {
  if (!bloco) return;

  Array.from(bloco.querySelectorAll("strong")).forEach((titulo) => {
    const nomeNivel = texto(titulo);
    if (!nomesNiveis.has(nomeNivel)) return;

    const conteudoNivel = titulo.parentElement;
    const cardNivel = conteudoNivel?.parentElement;
    const alvo = valorMoeda(conteudoNivel?.querySelector("small")?.textContent);
    const situacao = Array.from(cardNivel?.children || []).find(
      (elemento) => elemento.tagName === "EM",
    );
    if (!situacao) return;

    const novoTexto = formatarSituacao({
      alvo,
      vendido,
      encerrado: estado.encerrado,
      diasCalculo,
      totalDias: estado.totalDias,
    });

    if (texto(situacao) !== novoTexto) situacao.textContent = novoTexto;
  });
}

export default function DetalhesMetasRanking() {
  const horarios = useHorariosPeriodos();

  useEffect(() => {
    let quadro = null;

    function atualizar() {
      quadro = null;
      const mes = mesSelecionado();
      if (!mes) return;

      const estado = estadoDoMes(mes, horarios);
      const jornada = encontrarJornada();

      if (jornada) {
        atualizarNiveisDoBloco({
          bloco: jornada,
          vendido: vendidoDaJornada(jornada),
          estado,
          diasCalculo: estado.geral,
        });
      }

      const ranking = encontrarRanking();
      if (!ranking) return;

      ranking
        .querySelectorAll('button[aria-expanded="true"]')
        .forEach((botao) => {
          const detalhes = botao.nextElementSibling;
          if (!(detalhes instanceof HTMLElement)) return;

          const vendidoLoja = vendidoDaLoja(detalhes);

          Array.from(detalhes.querySelectorAll("strong")).forEach((titulo) => {
            const nomeNivel = texto(titulo);
            if (!nomesNiveis.has(nomeNivel)) return;

            const conteudoNivel = titulo.parentElement;
            const cardNivel = conteudoNivel?.parentElement;
            const alvo = valorMoeda(conteudoNivel?.querySelector("small")?.textContent);
            const situacao = Array.from(cardNivel?.children || []).find(
              (elemento) => elemento.tagName === "EM",
            );
            if (!situacao) return;

            const artigoMaisProximo = titulo.closest("article");
            const cardPeriodo =
              artigoMaisProximo && artigoMaisProximo !== ranking
                ? artigoMaisProximo
                : null;

            let vendido = vendidoLoja;
            let diasCalculo = estado.geral;

            if (cardPeriodo) {
              vendido = vendidoDoPeriodo(cardPeriodo);
              const periodo = nomeDoPeriodo(cardPeriodo);
              diasCalculo = periodo === "Manhã" ? estado.manha : estado.noite;
            }

            const novoTexto = formatarSituacao({
              alvo,
              vendido,
              encerrado: estado.encerrado,
              diasCalculo,
              totalDias: estado.totalDias,
            });

            if (texto(situacao) !== novoTexto) situacao.textContent = novoTexto;
          });
        });
    }

    function agendar() {
      if (quadro !== null) return;
      quadro = requestAnimationFrame(atualizar);
    }

    agendar();
    document.addEventListener("click", agendar, true);
    document.addEventListener("change", agendar, true);

    const observador = new MutationObserver(agendar);
    observador.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      document.removeEventListener("click", agendar, true);
      document.removeEventListener("change", agendar, true);
      observador.disconnect();
      if (quadro !== null) cancelAnimationFrame(quadro);
    };
  }, [horarios.manhaFim, horarios.noiteFim]);

  return null;
}
