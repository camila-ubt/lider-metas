"use client";

import { useEffect, useMemo } from "react";
import DashboardEstavelV2 from "./DashboardEstavelV2";

const dinheiro = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default function DashboardEstavel(props) {
  const resumo = useMemo(() => {
    const vendido = (props.vendas || []).reduce(
      (total, item) => total + Number(item.valor_vendido || 0),
      0
    );
    const meta = (props.metas || []).reduce(
      (total, item) => total + Number(item.valor_meta || 0),
      0
    );

    const etapas = [
      { nome: "Meta", valor: meta },
      { nome: "Supermeta", valor: meta * 1.1 },
      { nome: "Megameta", valor: meta * 1.2 },
    ];
    const proxima = etapas.find((etapa) => vendido < etapa.valor);

    return {
      nome: proxima?.nome || "Megameta",
      falta: proxima ? Math.max(proxima.valor - vendido, 0) : 0,
    };
  }, [props.vendas, props.metas]);

  useEffect(() => {
    const corrigirCard = () => {
      const rotulos = [...document.querySelectorAll("article span")];
      const rotulo = rotulos.find((item) =>
        item.textContent?.trim().startsWith("Necessário por dia")
      );
      const card = rotulo?.closest("article");
      if (!card) return;

      const valor = card.querySelector("strong");
      const detalhe = card.querySelector("small");

      rotulo.textContent = `Necessário para ${resumo.nome}`;
      if (valor) valor.textContent = dinheiro.format(resumo.falta);
      if (detalhe) detalhe.textContent = "Valor total que ainda falta vender";
    };

    const quadro = requestAnimationFrame(corrigirCard);
    return () => cancelAnimationFrame(quadro);
  }, [resumo]);

  return <DashboardEstavelV2 {...props} />;
}
