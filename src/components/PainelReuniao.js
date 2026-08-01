"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./PainelReuniao.module.css";

const dinheiro = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const percentual = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const blocosSubstituidos = [
  "Loja destaque e ponto de atenção",
  "Leitura da manhã",
  "Leitura da noite",
  "Ações sugeridas",
];

function mesDaTela() {
  return document.querySelector('input[type="month"]')?.value || "";
}

function painelAtivo() {
  return Boolean(
    document.querySelector("nav.tabs button:first-child")?.classList.contains("active"),
  );
}

function fimMes(mes) {
  const [ano, numeroMes] = mes.split("-").map(Number);
  return `${ano}-${String(numeroMes).padStart(2, "0")}-${String(
    new Date(ano, numeroMes, 0).getDate(),
  ).padStart(2, "0")}`;
}

function hojeLocal() {
  const data = new Date();
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(
    data.getDate(),
  ).padStart(2, "0")}`;
}

function statusMes(mes) {
  if (hojeLocal() > fimMes(mes)) return "encerrado";
  if (hojeLocal() === fimMes(mes)) return "ultimo-dia";
  return "andamento";
}

function media(lista) {
  return lista.length
    ? lista.reduce((soma, valor) => soma + valor, 0) / lista.length
    : 0;
}

function proximoAlvo(vendido, meta) {
  const alvos = [
    { nome: "Meta", valor: meta },
    { nome: "Supermeta", valor: meta * 1.2 },
    { nome: "Megameta", valor: meta * 1.3 },
  ];
  return alvos.find((item) => vendido < item.valor) || alvos[2];
}

function nivelAtingido(vendido, meta) {
  if (!(meta > 0)) return "Sem meta";
  if (vendido >= meta * 1.3) return "Megameta";
  if (vendido >= meta * 1.2) return "Supermeta";
  if (vendido >= meta) return "Meta";
  return "Abaixo da Meta";
}

function textoHistorico(turno) {
  const nome = turno.periodo === "manha" ? "Manhã" : "Noite";
  if (turno.variacaoHistorica === null) {
    return `${nome} — sem histórico suficiente do mesmo mês.`;
  }
  if (turno.variacaoHistorica < -5) {
    return `${nome} — ${percentual.format(Math.abs(turno.variacaoHistorica))}% abaixo da média histórica do mesmo mês.`;
  }
  if (turno.variacaoHistorica > 5) {
    return `${nome} — ${percentual.format(turno.variacaoHistorica)}% acima da média histórica do mesmo mês.`;
  }
  return `${nome} — dentro do padrão histórico do mesmo mês.`;
}

export default function PainelReuniao() {
  const supabase = useMemo(() => createClient(), []);
  const [visivel, setVisivel] = useState(false);
  const [mes, setMes] = useState("");
  const [lojas, setLojas] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [metas, setMetas] = useState([]);

  useEffect(() => {
    function sincronizar() {
      setMes(mesDaTela());
      setVisivel(painelAtivo());
    }

    sincronizar();
    document.addEventListener("click", sincronizar, true);
    document.addEventListener("change", sincronizar, true);
    const observador = new MutationObserver(sincronizar);
    observador.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      document.removeEventListener("click", sincronizar, true);
      document.removeEventListener("change", sincronizar, true);
      observador.disconnect();
    };
  }, []);

  useEffect(() => {
    function ocultarRepetidos() {
      document.querySelectorAll("details").forEach((bloco) => {
        const titulo = bloco.querySelector("summary strong")?.textContent?.trim();
        if (blocosSubstituidos.includes(titulo)) bloco.style.display = "none";
      });
    }

    ocultarRepetidos();
    const observador = new MutationObserver(ocultarRepetidos);
    observador.observe(document.body, { subtree: true, childList: true });
    return () => observador.disconnect();
  }, []);

  useEffect(() => {
    if (!visivel || !mes) return undefined;
    let ativo = true;
    const [ano, numeroMes] = mes.split("-").map(Number);

    const historicos = [ano - 1, ano - 2].map((anoHistorico) => {
      const referencia = `${anoHistorico}-${String(numeroMes).padStart(2, "0")}`;
      return supabase
        .from("vendas_diarias")
        .select("data,loja_id,periodo,valor_vendido")
        .gte("data", `${referencia}-01`)
        .lte("data", fimMes(referencia));
    });

    Promise.all([
      supabase.from("lojas").select("*").eq("ativa", true).order("ordem"),
      supabase
        .from("vendas_diarias")
        .select("*")
        .gte("data", `${mes}-01`)
        .lte("data", fimMes(mes)),
      supabase.from("metas_mensais").select("*").eq("mes", `${mes}-01`),
      ...historicos,
    ]).then(([lojasResp, vendasResp, metasResp, ...historicosResp]) => {
      if (!ativo) return;
      setLojas(lojasResp.data || []);
      setVendas(vendasResp.data || []);
      setMetas(metasResp.data || []);
      setHistorico(historicosResp.flatMap((resposta) => resposta.data || []));
    });

    return () => {
      ativo = false;
    };
  }, [visivel, mes, supabase]);

  const resumo = useMemo(() => {
    if (!mes) return null;

    const [ano, numeroMes] = mes.split("-").map(Number);
    const contexto = statusMes(mes);
    const hoje = new Date();
    const ultimoDia = new Date(ano, numeroMes, 0).getDate();
    const diaCorte =
      contexto === "encerrado" ? ultimoDia : Math.min(hoje.getDate(), ultimoDia);

    const vendasAteCorte = vendas.filter(
      (item) => Number(item.data.slice(8, 10)) <= diaCorte,
    );
    const totalVendido = vendasAteCorte.reduce(
      (soma, item) => soma + Number(item.valor_vendido || 0),
      0,
    );
    const totalMeta = metas.reduce(
      (soma, item) => soma + Number(item.valor_meta || 0),
      0,
    );
    const alvo = proximoAlvo(totalVendido, totalMeta);
    const atingido = nivelAtingido(totalVendido, totalMeta);

    const ranking = lojas
      .map((loja) => {
        const vendido = vendasAteCorte
          .filter((item) => Number(item.loja_id) === Number(loja.id))
          .reduce((soma, item) => soma + Number(item.valor_vendido || 0), 0);
        const meta = metas
          .filter((item) => Number(item.loja_id) === Number(loja.id))
          .reduce((soma, item) => soma + Number(item.valor_meta || 0), 0);
        return {
          ...loja,
          vendido,
          meta,
          percentual: meta > 0 ? (vendido / meta) * 100 : 0,
        };
      })
      .sort((a, b) => b.percentual - a.percentual);

    const turnos = ["manha", "noite"].map((periodo) => {
      const atuais = vendasAteCorte.filter((item) => item.periodo === periodo);
      const totalAtual = atuais.reduce(
        (soma, item) => soma + Number(item.valor_vendido || 0),
        0,
      );
      const mediaAtual = diaCorte > 0 ? totalAtual / diaCorte : 0;

      const mediasAnuais = [ano - 1, ano - 2]
        .map((anoHistorico) => {
          const itens = historico.filter(
            (item) =>
              Number(item.data.slice(0, 4)) === anoHistorico &&
              item.periodo === periodo &&
              Number(item.data.slice(8, 10)) <= diaCorte,
          );
          if (!itens.length) return null;
          return (
            itens.reduce(
              (soma, item) => soma + Number(item.valor_vendido || 0),
              0,
            ) / diaCorte
          );
        })
        .filter((valor) => valor !== null);

      const mediaHistorica = media(mediasAnuais);
      const variacaoHistorica =
        mediaHistorica > 0
          ? ((mediaAtual - mediaHistorica) / mediaHistorica) * 100
          : null;

      const lojasTurno = lojas
        .map((loja) => {
          const vendido = atuais
            .filter((item) => Number(item.loja_id) === Number(loja.id))
            .reduce((soma, item) => soma + Number(item.valor_vendido || 0), 0);
          const meta = metas
            .filter(
              (item) =>
                Number(item.loja_id) === Number(loja.id) &&
                item.periodo === periodo,
            )
            .reduce((soma, item) => soma + Number(item.valor_meta || 0), 0);
          return {
            ...loja,
            vendido,
            meta,
            percentual: meta > 0 ? (vendido / meta) * 100 : 0,
          };
        })
        .sort((a, b) => b.percentual - a.percentual);

      return {
        periodo,
        mediaAtual,
        mediaHistorica,
        variacaoHistorica,
        puxa: lojasTurno[0],
        atencao: lojasTurno[lojasTurno.length - 1],
      };
    });

    const destaque = ranking[0];
    const atencao = ranking[ranking.length - 1];
    const desempenho = totalMeta > 0 ? (totalVendido / totalMeta) * 100 : 0;
    const diferencaLojas =
      destaque && atencao
        ? Math.max(0, destaque.percentual - atencao.percentual)
        : 0;

    const desempenhoTurnos = turnos.map((turno) =>
      turno.variacaoHistorica === null
        ? 1
        : Math.max(0, Math.min(1.2, 1 + turno.variacaoHistorica / 100)),
    );

    let nota = Math.min(6, Math.max(0, desempenho / 20));
    nota += Math.max(0, 2 - diferencaLojas / 15);
    nota += media(desempenhoTurnos) * 1.5;
    if (ranking.length && ranking.every((item) => item.percentual >= 100)) nota += 0.5;
    if (atingido === "Supermeta") nota += 0.5;
    if (atingido === "Megameta") nota += 1;

    return {
      contexto,
      totalVendido,
      totalMeta,
      alvo,
      atingido,
      ranking,
      destaque,
      atencao,
      turnos,
      nota: Math.min(10, Math.max(0, nota)),
      diferencaLojas,
    };
  }, [mes, lojas, vendas, historico, metas]);

  if (!visivel || !mes || !resumo?.totalMeta) return null;

  const todasAcima = resumo.ranking.every((item) => item.percentual >= 100);
  const faltaProximo = Math.max(resumo.alvo.valor - resumo.totalVendido, 0);
  const titulo =
    resumo.contexto === "encerrado"
      ? "Avaliação do mês encerrado"
      : resumo.contexto === "ultimo-dia"
        ? "Último dia para fechar o mês"
        : "Onde concentrar os esforços até o fechamento";

  const sintese =
    resumo.contexto === "encerrado"
      ? `A operação encerrou o mês com ${percentual.format(
          (resumo.totalVendido / resumo.totalMeta) * 100,
        )}% da Meta, atingindo ${resumo.atingido}. ${
          faltaProximo > 0
            ? `Ficou ${dinheiro.format(faltaProximo)} abaixo da ${resumo.alvo.nome}.`
            : "O maior nível previsto foi alcançado."
        }`
      : resumo.contexto === "ultimo-dia"
        ? `Hoje é o último dia do mês. A operação está em ${percentual.format(
            (resumo.totalVendido / resumo.totalMeta) * 100,
          )}% da Meta e precisa de ${dinheiro.format(
            faltaProximo,
          )} para alcançar a ${resumo.alvo.nome}.`
        : `A operação está em ${percentual.format(
            (resumo.totalVendido / resumo.totalMeta) * 100,
          )}% da Meta e segue rumo à ${resumo.alvo.nome}. Faltam ${dinheiro.format(
            faltaProximo,
          )}.`;

  const motivosNota = [
    resumo.atingido === "Megameta"
      ? "Megameta atingida."
      : resumo.atingido === "Supermeta"
        ? "Supermeta atingida."
        : resumo.atingido === "Meta"
          ? "Meta atingida, mas a Supermeta ainda não foi alcançada."
          : "Meta ainda não atingida.",
    todasAcima
      ? "Todas as lojas atingiram a Meta."
      : "Nem todas as lojas atingiram a Meta.",
    resumo.diferencaLojas <= 8
      ? "As lojas estão com desempenho próximo entre si."
      : `A diferença entre a primeira e a última loja é de ${percentual.format(
          resumo.diferencaLojas,
        )} pontos percentuais.`,
  ];

  return (
    <section className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <p>ROTEIRO DA REUNIÃO</p>
          <h2>{titulo}</h2>
        </div>
        <div className={styles.score}>
          <span>{resumo.contexto === "encerrado" ? "Nota final do mês" : "Nota parcial"}</span>
          <strong>{resumo.nota.toFixed(1)}</strong>
        </div>
      </header>

      <p className={styles.sintese}>{sintese}</p>

      <div className={styles.grid}>
        <article className={styles.positivo}>
          <h3>Reconhecer</h3>
          <p>
            {resumo.contexto === "encerrado"
              ? `${resumo.destaque?.codigo} foi a loja destaque do mês, encerrando com ${percentual.format(
                  resumo.destaque?.percentual || 0,
                )}% da Meta.`
              : `${resumo.destaque?.codigo} lidera o mês com ${percentual.format(
                  resumo.destaque?.percentual || 0,
                )}% da Meta.`}
          </p>
          <p>
            {todasAcima
              ? "Todas as lojas já superaram a Meta."
              : "A loja líder está puxando o resultado geral."}
          </p>
        </article>

        <article className={styles.atencao}>
          <h3>Ponto de atenção</h3>
          <p>
            {resumo.contexto === "encerrado"
              ? `${resumo.atencao?.codigo} encerrou com o menor desempenho proporcional: ${percentual.format(
                  resumo.atencao?.percentual || 0,
                )}% da Meta.`
              : `${resumo.atencao?.codigo} tem o menor desempenho proporcional do ranking.`}
          </p>
        </article>
      </div>

      <div className={styles.acoes}>
        <h3>Leitura dos turnos</h3>
        {resumo.turnos.map((turno) => (
          <div key={turno.periodo}>
            <p><b>{textoHistorico(turno)}</b></p>
            <p>
              Média diária atual: {dinheiro.format(turno.mediaAtual)} · média histórica: {dinheiro.format(turno.mediaHistorica)}
            </p>
            <p>
              <b>Puxa o resultado:</b> {turno.puxa?.codigo} ({percentual.format(turno.puxa?.percentual || 0)}% da meta do turno)
            </p>
            <p>
              <b>Precisa de atenção:</b> {turno.atencao?.codigo} ({percentual.format(turno.atencao?.percentual || 0)}% da meta do turno)
            </p>
          </div>
        ))}
      </div>

      <div className={styles.acoes}>
        <h3>Por que essa nota?</h3>
        {motivosNota.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>
    </section>
  );
}
