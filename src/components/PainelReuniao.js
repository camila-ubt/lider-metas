"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  contextoDoMes,
  nivelDoResultado,
  percentualDoResultado,
  proximoNivel,
} from "@/lib/contextoMes";
import styles from "./PainelReuniao.module.css";

const dinheiro = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const percentual = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function mesDaTela() {
  return (
    document.querySelector('.top-actions input[type="month"]')?.value ||
    document.querySelector('input[type="month"]')?.value ||
    ""
  );
}

function painelAtivo() {
  return Boolean(
    document.querySelector("nav.tabs button:first-child")?.classList.contains("active"),
  );
}

function fimMes(valorMes) {
  const [ano, numeroMes] = valorMes.split("-").map(Number);
  const ultimoDia = new Date(ano, numeroMes, 0).getDate();
  return `${ano}-${String(numeroMes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
}

function media(lista) {
  return lista.length
    ? lista.reduce((soma, valor) => soma + Number(valor || 0), 0) / lista.length
    : 0;
}

function nomeTurno(periodo) {
  return periodo === "manha" ? "Manhã" : "Noite";
}

function listaCodigos(lista) {
  if (!lista.length) return "nenhuma";
  if (lista.length === 1) return lista[0];
  return `${lista.slice(0, -1).join(", ")} e ${lista.at(-1)}`;
}

function statusHistorico(turno, contexto) {
  if (contexto === "futuro") return "Análise disponível após o início do mês";
  if (!turno.temVendas) return "Aguardando lançamentos";
  if (turno.variacaoHistorica === null) return "Sem base histórica comparável";
  if (turno.variacaoHistorica < -5) {
    return `${percentual.format(Math.abs(turno.variacaoHistorica))}% abaixo da média histórica`;
  }
  if (turno.variacaoHistorica > 5) {
    return `${percentual.format(turno.variacaoHistorica)}% acima da média histórica`;
  }
  return "Dentro do padrão histórico do mesmo mês";
}

function calcularNotaGerencial(resumo) {
  if (!resumo.temMeta || !resumo.temVendas) return null;

  const resultado = Number(resumo.percentualGeral || 0);
  const lojasComMeta = resumo.ranking.filter((loja) => loja.meta > 0);
  const periodosComMeta = resumo.ranking.flatMap((loja) =>
    loja.periodos.filter((periodo) => periodo.meta > 0),
  );
  const lojasAbaixo = lojasComMeta.filter(
    (loja) => Number(loja.percentual || 0) < 100,
  ).length;
  const periodosAbaixo = periodosComMeta.filter(
    (periodo) => Number(periodo.percentual || 0) < 100,
  ).length;
  const todasLojasNaMeta = lojasComMeta.length > 0 && lojasAbaixo === 0;
  const todosPeriodosNaMeta =
    periodosComMeta.length > 0 && periodosAbaixo === 0;

  let nota;
  let teto;

  if (resultado < 100) {
    nota = (resultado / 100) * 6.9;
    teto = 6.9;
  } else if (resultado < 110) {
    nota = 7 + ((resultado - 100) / 10) * 1.5;
    teto = 8.9;
  } else if (resultado < 120) {
    nota = 9 + ((resultado - 110) / 10) * 0.5;
    teto = 9.7;
  } else {
    nota = 9.7 + Math.min((resultado - 120) / 20, 1) * 0.2;
    teto = 9.9;
  }

  if (todasLojasNaMeta) nota += 0.35;
  else nota -= lojasAbaixo * 0.25;

  if (todosPeriodosNaMeta) nota += 0.25;
  else nota -= periodosAbaixo * 0.1;

  const todasLojasNaSupermeta =
    lojasComMeta.length > 0 &&
    lojasComMeta.every((loja) => Number(loja.percentual || 0) >= 110);

  if (resultado >= 120 && todasLojasNaSupermeta && todosPeriodosNaMeta) {
    teto = 10;
  }

  return Math.min(teto, Math.max(0, nota));
}

function explicarNota(resumo) {
  const resultado = Number(resumo.percentualGeral || 0);

  if (resultado < 100) {
    return "A nota fica limitada abaixo de 7 porque o resultado geral não atingiu a Meta.";
  }
  if (resultado < 110) {
    return "A Meta foi atingida, mas a nota permanece abaixo de 9 enquanto a Supermeta não for alcançada.";
  }
  if (resultado < 120) {
    return "A Supermeta foi atingida; a nota 10 continua reservada à Megameta com desempenho equilibrado.";
  }
  return "A nota 10 exige Megameta geral, todas as lojas em Supermeta e todos os períodos com pelo menos 100% da Meta.";
}

export default function PainelReuniao() {
  const supabase = useMemo(() => createClient(), []);
  const [visivel, setVisivel] = useState(false);
  const [mes, setMes] = useState("");
  const [lojas, setLojas] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [metas, setMetas] = useState([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    let temporizador;

    function sincronizar() {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        setMes(mesDaTela());
        setVisivel(painelAtivo());
      }, 50);
    }

    sincronizar();
    document.addEventListener("click", sincronizar, true);
    document.addEventListener("change", sincronizar, true);
    const observador = new MutationObserver(sincronizar);
    observador.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "value"],
    });

    return () => {
      clearTimeout(temporizador);
      document.removeEventListener("click", sincronizar, true);
      document.removeEventListener("change", sincronizar, true);
      observador.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!visivel || !mes) return undefined;

    let ativo = true;
    setCarregando(true);
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
      setCarregando(false);
    });

    return () => {
      ativo = false;
    };
  }, [visivel, mes, supabase]);

  const resumo = useMemo(() => {
    if (!mes) return null;

    const contexto = contextoDoMes(mes);
    const vendasAteCorte = vendas.filter(
      (item) => Number(item.data.slice(8, 10)) <= contexto.diaCorte,
    );
    const totalVendido = vendasAteCorte.reduce(
      (soma, item) => soma + Number(item.valor_vendido || 0),
      0,
    );
    const totalMeta = metas.reduce(
      (soma, item) => soma + Number(item.valor_meta || 0),
      0,
    );
    const temMeta = totalMeta > 0;
    const temVendas = vendasAteCorte.length > 0;
    const nivelGeral = nivelDoResultado(totalVendido, totalMeta);
    const percentualGeral = percentualDoResultado(totalVendido, totalMeta);
    const proximo = proximoNivel(totalVendido, totalMeta);

    const ranking = lojas
      .map((loja) => {
        const vendasLoja = vendasAteCorte.filter(
          (item) => Number(item.loja_id) === Number(loja.id),
        );
        const vendido = vendasLoja.reduce(
          (soma, item) => soma + Number(item.valor_vendido || 0),
          0,
        );
        const meta = metas
          .filter((item) => Number(item.loja_id) === Number(loja.id))
          .reduce((soma, item) => soma + Number(item.valor_meta || 0), 0);
        const periodos = ["manha", "noite"].map((periodo) => {
          const vendidoPeriodo = vendasLoja
            .filter((item) => item.periodo === periodo)
            .reduce((soma, item) => soma + Number(item.valor_vendido || 0), 0);
          const metaPeriodo = metas
            .filter(
              (item) =>
                Number(item.loja_id) === Number(loja.id) &&
                item.periodo === periodo,
            )
            .reduce((soma, item) => soma + Number(item.valor_meta || 0), 0);
          return {
            periodo,
            vendido: vendidoPeriodo,
            meta: metaPeriodo,
            percentual: percentualDoResultado(vendidoPeriodo, metaPeriodo),
            nivel: nivelDoResultado(vendidoPeriodo, metaPeriodo),
          };
        });

        return {
          ...loja,
          vendido,
          meta,
          percentual: percentualDoResultado(vendido, meta),
          nivel: nivelDoResultado(vendido, meta),
          periodos,
        };
      })
      .sort((a, b) => (b.percentual ?? -1) - (a.percentual ?? -1));

    const turnos = ["manha", "noite"].map((periodo) => {
      const atuais = vendasAteCorte.filter((item) => item.periodo === periodo);
      const totalAtual = atuais.reduce(
        (soma, item) => soma + Number(item.valor_vendido || 0),
        0,
      );
      const metaTurno = metas
        .filter((item) => item.periodo === periodo)
        .reduce((soma, item) => soma + Number(item.valor_meta || 0), 0);
      const mediaAtual = contexto.diaCorte > 0 ? totalAtual / contexto.diaCorte : 0;
      const mediasAnuais = [contexto.ano - 1, contexto.ano - 2]
        .map((anoHistorico) => {
          const itens = historico.filter(
            (item) =>
              Number(item.data.slice(0, 4)) === anoHistorico &&
              item.periodo === periodo &&
              Number(item.data.slice(8, 10)) <= contexto.diaCorte,
          );
          if (!itens.length || contexto.diaCorte <= 0) return null;
          return (
            itens.reduce(
              (soma, item) => soma + Number(item.valor_vendido || 0),
              0,
            ) / contexto.diaCorte
          );
        })
        .filter((valor) => valor !== null);
      const mediaHistorica = media(mediasAnuais);
      const variacaoHistorica =
        mediaHistorica > 0
          ? ((mediaAtual - mediaHistorica) / mediaHistorica) * 100
          : null;
      const lojasTurno = ranking
        .map((loja) => ({
          loja,
          dados: loja.periodos.find((item) => item.periodo === periodo),
        }))
        .sort(
          (a, b) => (b.dados?.percentual ?? -1) - (a.dados?.percentual ?? -1),
        );

      return {
        periodo,
        totalAtual,
        meta: metaTurno,
        percentual: percentualDoResultado(totalAtual, metaTurno),
        nivel: nivelDoResultado(totalAtual, metaTurno),
        mediaAtual,
        mediaHistorica,
        variacaoHistorica,
        temVendas: atuais.length > 0,
        puxa: lojasTurno[0] || null,
        atencao: lojasTurno.at(-1) || null,
      };
    });

    const lojasAtingiram = ranking
      .filter((item) => (item.percentual ?? -1) >= 100)
      .map((item) => item.codigo);
    const lojasAbaixo = ranking
      .filter((item) => item.meta > 0 && (item.percentual ?? 0) < 100)
      .map((item) => item.codigo);
    const periodosAtingiram = ranking.flatMap((loja) =>
      loja.periodos
        .filter((item) => (item.percentual ?? -1) >= 100)
        .map((item) => `${loja.codigo} ${nomeTurno(item.periodo)}`),
    );
    const periodosAbaixo = ranking.flatMap((loja) =>
      loja.periodos
        .filter((item) => item.meta > 0 && (item.percentual ?? 0) < 100)
        .map((item) => `${loja.codigo} ${nomeTurno(item.periodo)}`),
    );

    return {
      contexto,
      totalVendido,
      totalMeta,
      temMeta,
      temVendas,
      nivelGeral,
      percentualGeral,
      proximo,
      ranking,
      destaque: ranking[0] || null,
      atencao: ranking.at(-1) || null,
      turnos,
      lojasAtingiram,
      lojasAbaixo,
      periodosAtingiram,
      periodosAbaixo,
    };
  }, [mes, lojas, vendas, historico, metas]);

  if (!visivel || !mes || carregando || !resumo) return null;

  const { contexto } = resumo;
  const futuro = contexto.tipo === "futuro";
  const encerrado = contexto.tipo === "encerrado";
  const ultimoDia = contexto.tipo === "ultimo-dia";
  const notaCalculada = calcularNotaGerencial(resumo);
  const criterioNota = notaCalculada === null ? null : explicarNota(resumo);

  let titulo;
  let sintese;
  let notaTexto = "—";

  if (futuro) {
    titulo = resumo.temMeta
      ? "Planejamento do próximo mês"
      : "Mês ainda não aberto";
    sintese = resumo.temMeta
      ? `O mês ainda não começou. As metas já somam ${dinheiro.format(resumo.totalMeta)}. Use este período para alinhar prioridades, escala e estratégia por turno.`
      : "O mês ainda não começou e as metas ainda não foram cadastradas. Cadastre os objetivos antes da abertura para que o acompanhamento comece corretamente.";
  } else if (encerrado) {
    titulo = "Avaliação do mês encerrado";
    sintese = resumo.temMeta
      ? `O mês encerrou com ${dinheiro.format(resumo.totalVendido)}, equivalente a ${percentual.format(resumo.percentualGeral || 0)}% da Meta. Resultado final: ${resumo.nivelGeral}.`
      : `O mês encerrou com ${dinheiro.format(resumo.totalVendido)}, mas não havia metas cadastradas para avaliar o atingimento.`;
    notaTexto = notaCalculada === null ? "—" : notaCalculada.toFixed(1);
  } else if (!resumo.temMeta) {
    titulo = ultimoDia ? "Último dia sem metas cadastradas" : "Metas ainda não cadastradas";
    sintese = "O mês está em andamento, mas as metas ainda não foram cadastradas. Cadastre-as para que o sistema consiga orientar o esforço e avaliar cada loja e turno.";
  } else if (!resumo.temVendas) {
    titulo = "Aguardando os primeiros lançamentos";
    sintese = "As metas estão cadastradas, mas ainda não há vendas lançadas neste mês. Assim que os primeiros dias forem preenchidos, o relatório começará a indicar ritmo e prioridades.";
  } else {
    const falta = resumo.proximo
      ? Math.max(resumo.proximo.valor - resumo.totalVendido, 0)
      : 0;
    titulo = ultimoDia
      ? "Último dia para consolidar o resultado"
      : "Onde concentrar os esforços até o fechamento";
    sintese = resumo.proximo
      ? `A operação está em ${percentual.format(resumo.percentualGeral || 0)}% da Meta. Faltam ${dinheiro.format(falta)} para a ${resumo.proximo.nome}. O resultado ainda está em construção: mantenha o foco nas lojas e turnos com maior distância do objetivo.`
      : "A Megameta já foi conquistada. Continue preservando o ritmo e a qualidade dos lançamentos até o fechamento.";
    notaTexto = notaCalculada === null ? "—" : notaCalculada.toFixed(1);
  }

  const motivosBase = futuro
    ? [
        resumo.temMeta
          ? "As metas já estão prontas para o início do mês."
          : "As metas precisam ser cadastradas antes da abertura.",
        "Ainda não há resultado a avaliar porque o período não começou.",
      ]
    : encerrado
      ? [
          resumo.temMeta
            ? `${listaCodigos(resumo.lojasAtingiram)} atingiram pelo menos a Meta.`
            : "O mês não possui metas para comparação.",
          resumo.lojasAbaixo.length
            ? `${listaCodigos(resumo.lojasAbaixo)} encerraram abaixo da Meta.`
            : resumo.temMeta
              ? "Nenhuma loja encerrou abaixo da Meta."
              : "O desempenho proporcional não pode ser calculado.",
          resumo.periodosAtingiram.length
            ? `Períodos que atingiram a Meta: ${listaCodigos(resumo.periodosAtingiram)}.`
            : "Nenhum período atingiu a Meta cadastrada.",
          resumo.periodosAbaixo.length
            ? `Períodos abaixo da Meta: ${listaCodigos(resumo.periodosAbaixo)}.`
            : "Nenhum período ficou abaixo da Meta.",
        ]
      : [
          resumo.proximo
            ? `Próximo objetivo geral: ${resumo.proximo.nome}.`
            : "O nível máximo já foi atingido.",
          resumo.destaque?.percentual !== null
            ? `${resumo.destaque?.codigo} lidera com ${percentual.format(resumo.destaque?.percentual || 0)}% da Meta.`
            : "Ainda não há ranking proporcional sem metas cadastradas.",
          resumo.atencao?.percentual !== null
            ? `${resumo.atencao?.codigo} exige maior acompanhamento neste momento.`
            : "Os pontos de atenção aparecerão após metas e vendas serem registradas.",
        ];
  const motivos = criterioNota ? [criterioNota, ...motivosBase] : motivosBase;

  return (
    <section className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <p>ROTEIRO DA REUNIÃO</p>
          <h2>{titulo}</h2>
        </div>
        <div className={styles.score}>
          <span>{encerrado ? "Nota final do mês" : futuro ? "Planejamento" : "Nota parcial"}</span>
          <strong>{notaTexto}</strong>
        </div>
      </header>

      <p className={styles.sintese}>{sintese}</p>

      <div className={styles.grid}>
        <article className={styles.positivo}>
          <h3>{futuro ? "Preparar" : "Reconhecer"}</h3>
          <p>
            {futuro
              ? resumo.temMeta
                ? `As metas estão definidas em ${dinheiro.format(resumo.totalMeta)} para o conjunto das lojas.`
                : "A prioridade agora é cadastrar as metas por loja e período."
              : encerrado
                ? resumo.destaque?.percentual !== null
                  ? `${resumo.destaque?.codigo} foi o destaque final, encerrando com ${percentual.format(resumo.destaque?.percentual || 0)}% da Meta.`
                  : `O maior faturamento foi de ${resumo.destaque?.codigo || "—"}.`
                : resumo.destaque?.percentual !== null
                  ? `${resumo.destaque?.codigo} lidera o mês com ${percentual.format(resumo.destaque?.percentual || 0)}% da Meta.`
                  : "O destaque aparecerá quando houver metas e vendas comparáveis."}
          </p>
        </article>

        <article className={styles.atencao}>
          <h3>{futuro ? "Antes da abertura" : "Ponto de atenção"}</h3>
          <p>
            {futuro
              ? "Confirme metas, escala e distribuição dos objetivos entre manhã e noite antes do primeiro lançamento."
              : encerrado
                ? resumo.lojasAbaixo.length
                  ? `${listaCodigos(resumo.lojasAbaixo)} encerraram abaixo da Meta e devem orientar o plano do próximo mês.`
                  : resumo.temMeta
                    ? "Todas as lojas encerraram com pelo menos 100% da Meta."
                    : "Sem metas cadastradas, não é possível identificar quem ficou atrás do objetivo."
                : resumo.atencao?.percentual !== null
                  ? `${resumo.atencao?.codigo} tem o menor desempenho proporcional e precisa de acompanhamento mais próximo.`
                  : "Cadastre as metas e mantenha os lançamentos atualizados para identificar prioridades."}
          </p>
        </article>
      </div>

      <section className={styles.turnosHistoricos}>
        <h3>{encerrado ? "Resultado final dos turnos" : futuro ? "Planejamento por turno" : "Leitura dos turnos"}</h3>
        <div className={styles.turnosGrid}>
          {resumo.turnos.map((turno) => (
            <article key={turno.periodo}>
              <header>
                <strong>{nomeTurno(turno.periodo)}</strong>
                <span>{statusHistorico(turno, contexto.tipo)}</span>
              </header>

              {futuro ? (
                <p>
                  Meta planejada: <b>{dinheiro.format(turno.meta)}</b>
                </p>
              ) : (
                <>
                  <p>
                    {encerrado ? "Média diária final" : "Média diária atual"}: {" "}
                    <b>{dinheiro.format(turno.mediaAtual)}</b>
                  </p>
                  <p>
                    Resultado do turno: {" "}
                    <b>
                      {turno.percentual === null
                        ? turno.nivel
                        : `${percentual.format(turno.percentual)}% · ${turno.nivel}`}
                    </b>
                  </p>
                </>
              )}

              {!futuro && turno.temVendas && (
                <div className={styles.turnoLojas}>
                  <p>
                    <span>{encerrado ? "Maior resultado" : "Puxa o resultado"}</span>
                    <b>
                      {turno.puxa?.loja?.codigo || "—"} · {turno.puxa?.dados?.percentual === null
                        ? dinheiro.format(turno.puxa?.dados?.vendido || 0)
                        : `${percentual.format(turno.puxa?.dados?.percentual || 0)}%`}
                    </b>
                  </p>
                  <p>
                    <span>{encerrado ? "Ficou atrás" : "Precisa de atenção"}</span>
                    <b>
                      {turno.atencao?.loja?.codigo || "—"} · {turno.atencao?.dados?.percentual === null
                        ? dinheiro.format(turno.atencao?.dados?.vendido || 0)
                        : `${percentual.format(turno.atencao?.dados?.percentual || 0)}%`}
                    </b>
                  </p>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <div className={styles.acoes}>
        <h3>{futuro ? "Antes de começar" : encerrado ? "Conclusões do mês" : "Por que essa nota?"}</h3>
        {motivos.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>
    </section>
  );
}
