"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function numeroMoeda(texto) {
  const encontrado = String(texto || "").match(/R\$\s*([\d.]+,\d{2})/);
  if (!encontrado) return 0;
  return Number(encontrado[1].replace(/\./g, "").replace(",", "."));
}

function formatarDias(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: valor % 1 ? 1 : 0,
    maximumFractionDigits: 1,
  });
}

function inicioMes(valor) {
  return `${valor}-01`;
}

function diasEquivalentesRestantes(mesSelecionado, periodosAtivos) {
  if (!mesSelecionado) return 0;

  const periodos = periodosAtivos.length ? periodosAtivos : ["manha", "noite"];
  const [ano, mes] = mesSelecionado.split("-").map(Number);
  const agora = new Date();
  const anoAtual = agora.getFullYear();
  const mesAtual = agora.getMonth() + 1;
  const totalDias = new Date(ano, mes, 0).getDate();
  const pesoDia = periodos.length * 0.5;

  if (ano < anoAtual || (ano === anoAtual && mes < mesAtual)) return 0;
  if (ano > anoAtual || (ano === anoAtual && mes > mesAtual)) {
    return totalDias * pesoDia;
  }

  const diasCompletosDepoisDeHoje = Math.max(totalDias - agora.getDate(), 0);
  const hora = agora.getHours() + agora.getMinutes() / 60;
  let restanteHoje = 0;

  if (periodos.includes("manha") && hora < 16) restanteHoje += 0.5;
  if (periodos.includes("noite") && hora < 22) restanteHoje += 0.5;

  return diasCompletosDepoisDeHoje * pesoDia + restanteHoje;
}

export default function AjusteDiasEquivalentes() {
  const supabase = useMemo(() => createClient(), []);
  const [mes, setMes] = useState("");
  const [periodosAtivos, setPeriodosAtivos] = useState(["manha", "noite"]);

  useEffect(() => {
    function sincronizarMes() {
      setMes(document.querySelector('input[type="month"]')?.value || "");
    }

    sincronizarMes();
    document.addEventListener("click", sincronizarMes, true);
    document.addEventListener("change", sincronizarMes, true);

    return () => {
      document.removeEventListener("click", sincronizarMes, true);
      document.removeEventListener("change", sincronizarMes, true);
    };
  }, []);

  useEffect(() => {
    if (!mes) return undefined;
    let cancelado = false;

    async function carregarPerfilTurnos() {
      const { data, error } = await supabase
        .from("metas_mensais")
        .select("periodo,valor_meta")
        .eq("mes", inicioMes(mes));

      if (cancelado || error) return;

      const ativos = [...new Set(
        (data || [])
          .filter((meta) => Number(meta.valor_meta || 0) > 0)
          .map((meta) => meta.periodo)
          .filter((periodo) => periodo === "manha" || periodo === "noite")
      )];

      setPeriodosAtivos(ativos.length ? ativos : ["manha", "noite"]);
    }

    carregarPerfilTurnos();

    const canal = supabase
      .channel(`dias-equivalentes-${mes}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "metas_mensais" },
        carregarPerfilTurnos
      )
      .subscribe();

    return () => {
      cancelado = true;
      supabase.removeChannel(canal);
    };
  }, [mes, supabase]);

  useEffect(() => {
    let agendamento;

    function atualizar() {
      clearTimeout(agendamento);
      agendamento = setTimeout(() => {
        const cards = Array.from(document.querySelectorAll("article"));
        const cardNecessario = cards.find((card) =>
          card.querySelector("span")?.textContent?.trim().startsWith("Necessário por")
        );

        if (!cardNecessario) return;

        const textoFalta = Array.from(document.querySelectorAll("b, strong")).find((item) =>
          item.textContent?.trim().startsWith("Faltam R$")
        );
        const falta = numeroMoeda(textoFalta?.textContent);
        const mesSelecionado = document.querySelector('input[type="month"]')?.value;
        const dias = diasEquivalentesRestantes(mesSelecionado, periodosAtivos);

        const titulo = cardNecessario.querySelector("span");
        const valor = cardNecessario.querySelector("strong");
        const detalhe = cardNecessario.querySelector("small");

        if (titulo) titulo.textContent = "Necessário por dia equivalente";
        if (valor) {
          valor.textContent = new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(dias > 0 ? falta / dias : 0);
        }
        if (detalhe) {
          detalhe.textContent = `${formatarDias(dias)} ${dias === 1 ? "dia equivalente" : "dias equivalentes"}`;
        }
      }, 40);
    }

    atualizar();
    document.addEventListener("click", atualizar, true);
    document.addEventListener("change", atualizar, true);

    const observador = new MutationObserver(atualizar);
    observador.observe(document.body, { subtree: true, childList: true });

    const relogio = window.setInterval(atualizar, 60000);

    return () => {
      clearTimeout(agendamento);
      clearInterval(relogio);
      document.removeEventListener("click", atualizar, true);
      document.removeEventListener("change", atualizar, true);
      observador.disconnect();
    };
  }, [periodosAtivos]);

  return null;
}
