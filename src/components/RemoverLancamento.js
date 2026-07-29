"use client";

import { useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

const CHAVE_TELA = "lider-metas-restaurar-tela";
const CHAVE_MES = "lider-metas-restaurar-mes";

function texto(elemento) {
  return elemento?.textContent?.trim() || "";
}

function dadosSelecionados(modal) {
  const campoMes = document.querySelector('.top-actions input[type="month"]');
  const titulo = texto(modal.querySelector("#titulo-modal-venda"));
  const dia = titulo.match(/\b(\d{1,2})\b/)?.[1];
  const loja = modal.querySelector(".slot-store-card.is-selected");
  const periodo = texto(
    modal.querySelector(".slot-period-card.is-selected strong")
  ).toLowerCase();

  if (!campoMes?.value || !dia || !loja) return null;

  return {
    data: `${campoMes.value}-${String(dia).padStart(2, "0")}`,
    mes: campoMes.value,
    codigoLoja: texto(loja.querySelector("strong")),
    periodo: periodo === "manhã" ? "manha" : "noite",
    preenchido: loja.classList.contains("is-filled"),
  };
}

function restaurarTela() {
  const tela = sessionStorage.getItem(CHAVE_TELA);
  const mes = sessionStorage.getItem(CHAVE_MES);
  if (!tela && !mes) return;

  let tentativas = 0;
  const intervalo = window.setInterval(() => {
    tentativas += 1;
    const campoMes = document.querySelector('.top-actions input[type="month"]');
    const botaoLancamentos = Array.from(
      document.querySelectorAll(".tabs button")
    ).find((botao) => texto(botao) === "Lançar vendas");

    if (mes && campoMes && campoMes.value !== mes) {
      const definirValor = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      definirValor?.call(campoMes, mes);
      campoMes.dispatchEvent(new Event("change", { bubbles: true }));
    }

    if (tela === "lancamentos" && botaoLancamentos) {
      botaoLancamentos.click();
    }

    if ((campoMes || !mes) && (botaoLancamentos || tela !== "lancamentos")) {
      sessionStorage.removeItem(CHAVE_TELA);
      sessionStorage.removeItem(CHAVE_MES);
      window.clearInterval(intervalo);
    } else if (tentativas >= 30) {
      window.clearInterval(intervalo);
    }
  }, 100);
}

export default function RemoverLancamento() {
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    restaurarTela();

    let quadro = null;

    function sincronizar() {
      quadro = null;
      const modal = document.querySelector(
        'section[aria-labelledby="titulo-modal-venda"]'
      );
      if (!modal) return;

      const formulario = modal.querySelector("form");
      const acoes = formulario?.querySelector(".modal-actions");
      if (!formulario || !acoes) return;

      const dados = dadosSelecionados(modal);
      let botao = formulario.querySelector("[data-remover-lancamento]");

      if (!dados?.preenchido) {
        botao?.remove();
        return;
      }

      if (botao) return;

      botao = document.createElement("button");
      botao.type = "button";
      botao.className = "zero-button";
      botao.dataset.removerLancamento = "true";
      botao.textContent = "Remover lançamento e deixar vazio";
      botao.style.borderColor = "#e5b8b8";
      botao.style.background = "#fff3f3";
      botao.style.color = "#963b3b";

      botao.addEventListener("click", async () => {
        const selecao = dadosSelecionados(modal);
        if (!selecao?.preenchido) return;

        const confirmou = window.confirm(
          "Remover este lançamento? Ele voltará a ficar vazio e pendente, sem contar como zero."
        );
        if (!confirmou) return;

        botao.disabled = true;
        botao.textContent = "Removendo...";

        const { data: loja, error: erroLoja } = await supabase
          .from("lojas")
          .select("id")
          .eq("codigo", selecao.codigoLoja)
          .maybeSingle();

        if (erroLoja || !loja) {
          window.alert(erroLoja?.message || "Loja não encontrada.");
          botao.disabled = false;
          botao.textContent = "Remover lançamento e deixar vazio";
          return;
        }

        const { error } = await supabase
          .from("vendas_diarias")
          .delete()
          .eq("data", selecao.data)
          .eq("loja_id", loja.id)
          .eq("periodo", selecao.periodo);

        if (error) {
          window.alert(`Não foi possível remover: ${error.message}`);
          botao.disabled = false;
          botao.textContent = "Remover lançamento e deixar vazio";
          return;
        }

        sessionStorage.setItem(CHAVE_TELA, "lancamentos");
        sessionStorage.setItem(CHAVE_MES, selecao.mes);
        window.location.reload();
      });

      formulario.insertBefore(botao, acoes);
    }

    function agendar() {
      if (quadro !== null) return;
      quadro = window.requestAnimationFrame(sincronizar);
    }

    agendar();
    const observador = new MutationObserver(agendar);
    observador.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      observador.disconnect();
      if (quadro !== null) window.cancelAnimationFrame(quadro);
    };
  }, [supabase]);

  return null;
}
