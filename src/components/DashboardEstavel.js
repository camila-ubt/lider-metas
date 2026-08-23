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
      vendido,
      etapas,
      nome: proxima?.nome || "Megameta",
      falta: proxima ? Math.max(proxima.valor - vendido, 0) : 0,
      quantidadeLojas: Math.max((props.lojas || []).length, 1),
    };
  }, [props.vendas, props.metas, props.lojas]);

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

  useEffect(() => {
    const incluirFaltaPorLoja = () => {
      const primeiroArticle = document.querySelector("section article");
      if (!primeiroArticle) return;

      const nomesAceitos = {
        Meta: "Meta",
        Super: "Supermeta",
        Supermeta: "Supermeta",
        Mega: "Megameta",
        Megameta: "Megameta",
      };

      const titulos = [...primeiroArticle.querySelectorAll("strong")];

      titulos.forEach((titulo) => {
        const nomeExibido = titulo.textContent?.trim();
        const nomeEtapa = nomesAceitos[nomeExibido];
        if (!nomeEtapa) return;

        const etapa = resumo.etapas.find((item) => item.nome === nomeEtapa);
        if (!etapa) return;

        const falta = Math.max(etapa.valor - resumo.vendido, 0);
        if (falta <= 0) return;

        const cardNivel = titulo.closest("div")?.parentElement;
        const detalhe = cardNivel?.querySelector("em");
        if (!detalhe) return;

        const textoAtual = detalhe.textContent?.trim() || "";
        const matchDia = textoAtual.match(/R\$\s*[\d.]+,\d{2}\/dia/);
        if (!matchDia) return;

        const valorDia = Number(
          matchDia[0]
            .replace("R$", "")
            .replace("/dia", "")
            .trim()
            .replace(/\./g, "")
            .replace(",", ".")
        );
        if (!Number.isFinite(valorDia)) return;

        const porLojaDia = valorDia / resumo.quantidadeLojas;
        const textoPorLoja = `${dinheiro.format(porLojaDia)}/loja/dia`;
        const textoSemLoja = textoAtual.replace(/\s*·\s*R\$\s*[\d.]+,\d{2}\/loja(?:\/dia)?/g, "");
        detalhe.textContent = `${textoSemLoja} · ${textoPorLoja}`;
      });
    };

    const quadro = requestAnimationFrame(incluirFaltaPorLoja);
    return () => cancelAnimationFrame(quadro);
  }, [resumo]);

  return <DashboardEstavelV2 {...props} />;
}
