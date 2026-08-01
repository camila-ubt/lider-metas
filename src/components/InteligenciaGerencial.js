"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  acumuladoPorDia,
  anoDaData,
  caminhoGrafico,
  coeficienteVariacao,
  desvioPadrao,
  diaDaData,
  faixaEstimada,
  intervaloMes,
  media,
  probabilidadeAtingir,
  regressaoLinear,
  somar,
  textoTendencia,
} from "@/lib/analiseGerencial";
import {
  contextoDoMes,
  fraseSemBase,
  nivelDoResultado,
  percentualDoResultado,
} from "@/lib/contextoMes";
import styles from "./AnaliseGerencial.module.css";

const dinheiro = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const compacto = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const percentual = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const nomesMeses = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
const nomesSemana = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

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

function variacao(atual, anterior) {
  if (!(anterior > 0)) return null;
  return ((atual - anterior) / anterior) * 100;
}

function listaNatural(lista) {
  if (!lista.length) return "nenhum";
  if (lista.length === 1) return lista[0];
  return `${lista.slice(0, -1).join(", ")} e ${lista.at(-1)}`;
}

function GraficoHistorico({ series, diaCorte }) {
  const maximo = Math.max(
    ...series.flatMap((item) => item.valores.map((valor) => Number(valor || 0))),
    1,
  );
  const marcas = [1, 8, 15, 22, diaCorte].filter(
    (dia, indice, lista) =>
      dia > 0 && dia <= diaCorte && lista.indexOf(dia) === indice,
  );
  const classes = [
    styles.historyLineOne,
    styles.historyLineTwo,
    styles.historyLineThree,
  ];

  return (
    <div className={styles.historyChartBox}>
      <svg
        viewBox="0 0 700 250"
        role="img"
        aria-label="Comparação histórica acumulada"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((proporcao) => {
          const y = 216 - proporcao * 182;
          return (
            <g key={proporcao}>
              <line
                x1="34"
                x2="666"
                y1={y}
                y2={y}
                className={styles.gridLine}
              />
              <text x="3" y={y + 4} className={styles.axisLabel}>
                {compacto.format(maximo * proporcao)}
              </text>
            </g>
          );
        })}

        {marcas.map((dia) => {
          const x = 34 + ((dia - 1) / Math.max(diaCorte - 1, 1)) * 632;
          return (
            <text
              x={x}
              y="240"
              textAnchor="middle"
              className={styles.axisLabel}
              key={dia}
            >
              {dia}
            </text>
          );
        })}

        {series.map((item, indice) => (
          <path
            className={classes[indice]}
            d={caminhoGrafico(item.valores, maximo)}
            key={item.ano}
          />
        ))}
      </svg>

      <div className={styles.historyLegend}>
        {series.map((item, indice) => (
          <span key={item.ano}>
            <i className={classes[indice]} /> {item.ano}: {dinheiro.format(item.total)}
          </span>
        ))}
      </div>
    </div>
  );
}

function BarraProbabilidade({ nome, valor }) {
  const exibido = valor === null ? 0 : valor;
  return (
    <div className={styles.probabilityRow}>
      <div>
        <strong>{nome}</strong>
        <span>
          {valor === null
            ? "Base estatística em formação"
            : `${percentual.format(exibido)}%`}
        </span>
      </div>
      <div className={styles.probabilityTrack}>
        <i style={{ width: `${Math.max(0, Math.min(exibido, 100))}%` }} />
      </div>
    </div>
  );
}

export default function InteligenciaGerencial() {
  const supabase = useMemo(() => createClient(), []);
  const [autenticado, setAutenticado] = useState(false);
  const [visivel, setVisivel] = useState(false);
  const [mes, setMes] = useState("");
  const [lojas, setLojas] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [metas, setMetas] = useState([]);
  const [historicos, setHistoricos] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [filtroLoja, setFiltroLoja] = useState("geral");
  const [filtroPeriodo, setFiltroPeriodo] = useState("todos");

  useEffect(() => {
    let ativo = true;
    supabase.auth.getSession().then(({ data }) => {
      if (ativo) setAutenticado(Boolean(data.session));
    });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_evento, sessao) => setAutenticado(Boolean(sessao)),
    );
    return () => {
      ativo = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

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
    document.addEventListener("change", sincronizar, true);
    document.addEventListener("click", sincronizar, true);
    const observador = new MutationObserver(sincronizar);
    observador.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "value"],
    });

    return () => {
      clearTimeout(temporizador);
      document.removeEventListener("change", sincronizar, true);
      document.removeEventListener("click", sincronizar, true);
      observador.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!autenticado || !visivel || !mes) return undefined;

    let cancelado = false;
    async function carregar() {
      setCarregando(true);
      setErro("");

      const [ano, numeroMes] = mes.split("-").map(Number);
      const atual = intervaloMes(ano, numeroMes);
      const anteriores = [ano - 2, ano - 1].map((anoHistorico) => ({
        ano: anoHistorico,
        ...intervaloMes(anoHistorico, numeroMes),
      }));

      const [lojasResp, vendasResp, metasResp, ...historicosResp] =
        await Promise.all([
          supabase.from("lojas").select("*").eq("ativa", true).order("ordem"),
          supabase
            .from("vendas_diarias")
            .select("*")
            .gte("data", atual.inicio)
            .lte("data", atual.fim)
            .order("data", { ascending: true }),
          supabase
            .from("metas_mensais")
            .select("*")
            .eq("mes", `${mes}-01`),
          ...anteriores.map((item) =>
            supabase
              .from("vendas_diarias")
              .select("*")
              .gte("data", item.inicio)
              .lte("data", item.fim)
              .order("data", { ascending: true }),
          ),
        ]);

      if (cancelado) return;
      const falha = [
        lojasResp,
        vendasResp,
        metasResp,
        ...historicosResp,
      ].find((resposta) => resposta.error);

      if (falha?.error) {
        setErro(falha.error.message);
      } else {
        const lojasCarregadas = lojasResp.data || [];
        setLojas(lojasCarregadas);
        setVendas(vendasResp.data || []);
        setMetas(metasResp.data || []);
        setHistoricos(historicosResp.flatMap((resposta) => resposta.data || []));
        setFiltroLoja((atualFiltro) =>
          atualFiltro === "geral" ||
          lojasCarregadas.some(
            (loja) => String(loja.id) === String(atualFiltro),
          )
            ? atualFiltro
            : "geral",
        );
      }
      setCarregando(false);
    }

    carregar();
    return () => {
      cancelado = true;
    };
  }, [autenticado, visivel, mes, supabase]);

  const analise = useMemo(() => {
    if (!mes) return null;

    const contexto = contextoDoMes(mes);
    const vendasConsideradas = vendas.filter(
      (venda) => diaDaData(venda.data) <= contexto.diaCorte,
    );
    const totalVendido = somar(vendasConsideradas);
    const totalMeta = somar(metas, "valor_meta");
    const temMeta = totalMeta > 0;
    const temVendas = vendasConsideradas.length > 0;
    const percentualGeral = percentualDoResultado(totalVendido, totalMeta);
    const nivelGeral = nivelDoResultado(totalVendido, totalMeta);

    const mapaDias = new Map();
    vendasConsideradas.forEach((venda) => {
      if (!mapaDias.has(venda.data)) {
        mapaDias.set(venda.data, { total: 0, slots: new Set() });
      }
      const registro = mapaDias.get(venda.data);
      registro.total += Number(venda.valor_vendido || 0);
      registro.slots.add(`${Number(venda.loja_id)}|${venda.periodo}`);
    });

    const diasObservados = Array.from(mapaDias.entries()).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    const esperadoPorDia = lojas.length * 2;
    const diasCompletos = diasObservados.filter(
      ([, item]) => esperadoPorDia > 0 && item.slots.size >= esperadoPorDia,
    );
    const valoresObservados = diasObservados.map(([, item]) => item.total);
    const valoresCompletos = diasCompletos.map(([, item]) => item.total);
    const baseEstatistica =
      valoresCompletos.length >= 3 ? valoresCompletos : valoresObservados;
    const mediaDiaria = baseEstatistica.length ? media(baseEstatistica) : 0;
    const desvioDiario = desvioPadrao(baseEstatistica);
    const projecaoOperacional =
      contexto.diaCorte > 0
        ? (totalVendido / contexto.diaCorte) * contexto.ultimoDia
        : 0;
    const faixa = faixaEstimada({
      atual: totalVendido,
      mediaDiaria,
      desvioDiario,
      diasRestantes: contexto.diasRestantes,
    });

    function chance(alvo) {
      if (
        contexto.tipo === "futuro" ||
        contexto.tipo === "encerrado" ||
        !(alvo > 0) ||
        baseEstatistica.length < 3
      ) {
        return null;
      }
      return probabilidadeAtingir({
        atual: totalVendido,
        alvo,
        mediaDiaria,
        desvioDiario,
        diasRestantes: contexto.diasRestantes,
      });
    }

    const probabilidades = {
      meta: chance(totalMeta),
      super: chance(totalMeta * 1.2),
      mega: chance(totalMeta * 1.3),
    };

    const lojasResumo = lojas.map((loja) => {
      const vendasLoja = vendasConsideradas.filter(
        (venda) => Number(venda.loja_id) === Number(loja.id),
      );
      const meta = metas
        .filter((item) => Number(item.loja_id) === Number(loja.id))
        .reduce((total, item) => total + Number(item.valor_meta || 0), 0);
      const mapaLoja = new Map();
      vendasLoja.forEach((venda) => {
        mapaLoja.set(
          venda.data,
          (mapaLoja.get(venda.data) || 0) + Number(venda.valor_vendido || 0),
        );
      });
      const vendido = somar(vendasLoja);
      return {
        ...loja,
        vendido,
        meta,
        percentual: percentualDoResultado(vendido, meta),
        nivel: nivelDoResultado(vendido, meta),
        consistencia: coeficienteVariacao(Array.from(mapaLoja.values())),
      };
    });

    const consistentes = lojasResumo
      .filter((loja) => loja.consistencia !== null)
      .sort((a, b) => a.consistencia - b.consistencia);
    const maisConsistente = consistentes[0] || null;
    const maisOscilante = consistentes.at(-1) || null;
    const ranking = [...lojasResumo].sort(
      (a, b) => (b.percentual ?? -1) - (a.percentual ?? -1),
    );

    const ultimosValores = valoresObservados.slice(-10);
    const tendencia = regressaoLinear(ultimosValores);
    const nomeTendencia = textoTendencia(
      tendencia.inclinacao,
      media(ultimosValores),
    );

    const semana = new Map();
    diasObservados.forEach(([data, item]) => {
      const indice = new Date(`${data}T12:00:00`).getDay();
      if (!semana.has(indice)) semana.set(indice, []);
      semana.get(indice).push(item.total);
    });
    const mediasSemana = Array.from(semana.entries())
      .map(([indice, valores]) => ({
        nome: nomesSemana[indice],
        media: media(valores),
        quantidade: valores.length,
      }))
      .filter((item) => item.quantidade >= 2)
      .sort((a, b) => b.media - a.media);

    const serieGeral = [contexto.ano - 2, contexto.ano - 1, contexto.ano].map(
      (anoSerie) => {
        const lista =
          anoSerie === contexto.ano
            ? vendasConsideradas
            : historicos.filter(
                (venda) =>
                  anoDaData(venda.data) === anoSerie &&
                  diaDaData(venda.data) <= contexto.diaCorte,
              );
        return { ano: anoSerie, total: somar(lista), vendas: lista };
      },
    );
    const anterior =
      serieGeral.find((item) => item.ano === contexto.ano - 1)?.total || 0;
    const mudancaHistorica = variacao(totalVendido, anterior);
    const ordenada = [...serieGeral].sort((a, b) => b.total - a.total);
    const posicaoHistorica =
      ordenada.findIndex((item) => item.ano === contexto.ano) + 1;

    const atingiram = ranking
      .filter((loja) => (loja.percentual ?? -1) >= 100)
      .map((loja) => loja.codigo);
    const abaixo = ranking
      .filter((loja) => loja.meta > 0 && (loja.percentual ?? 0) < 100)
      .map((loja) => loja.codigo);

    const insights = [];
    if (contexto.tipo === "futuro") {
      insights.push(
        temMeta
          ? `As metas do próximo mês já somam ${dinheiro.format(totalMeta)}.`
          : "As metas ainda precisam ser cadastradas antes da abertura do mês.",
      );
      insights.push(
        "Projeções e tendências começarão a ser calculadas após os primeiros lançamentos.",
      );
    } else if (contexto.tipo === "encerrado") {
      insights.push(
        temMeta
          ? `O mês encerrou em ${percentual.format(percentualGeral || 0)}% da Meta, com resultado final de ${nivelGeral}.`
          : `O mês encerrou com ${dinheiro.format(totalVendido)}, sem metas cadastradas para comparação.`,
      );
      if (atingiram.length) {
        insights.push(`${listaNatural(atingiram)} atingiram pelo menos a Meta.`);
      }
      if (abaixo.length) {
        insights.push(`${listaNatural(abaixo)} encerraram abaixo da Meta.`);
      }
      if (mudancaHistorica !== null) {
        insights.push(
          `O resultado final ficou ${percentual.format(Math.abs(mudancaHistorica))}% ${
            mudancaHistorica >= 0 ? "acima" : "abaixo"
          } do mesmo mês do ano anterior.`,
        );
      }
    } else if (!temMeta || !temVendas) {
      insights.push(fraseSemBase(contexto.tipo, temMeta, temVendas));
    } else {
      if (posicaoHistorica === 1 && serieGeral.some((item) => item.ano !== contexto.ano && item.total > 0)) {
        insights.push(
          `${nomesMeses[contexto.numeroMes - 1][0].toUpperCase()}${nomesMeses[contexto.numeroMes - 1].slice(1)} apresenta o melhor resultado dos últimos 3 anos até este momento.`,
        );
      } else if (mudancaHistorica !== null) {
        insights.push(
          `O resultado está ${percentual.format(Math.abs(mudancaHistorica))}% ${
            mudancaHistorica >= 0 ? "acima" : "abaixo"
          } do mesmo período do ano anterior.`,
        );
      }
      insights.push(`O ritmo recente está ${nomeTendencia}.`);
      if (maisConsistente) {
        insights.push(
          `${maisConsistente.codigo} apresenta a maior consistência entre as lojas.`,
        );
      }
      if (probabilidades.super !== null) {
        insights.push(
          `A probabilidade de Supermeta é de ${percentual.format(probabilidades.super)}%.`,
        );
      } else {
        insights.push(
          "Continue alimentando os lançamentos: a base estatística ainda está sendo formada.",
        );
      }
    }

    return {
      contexto,
      tituloMes: `${nomesMeses[contexto.numeroMes - 1]} de ${contexto.ano}`,
      totalVendido,
      totalMeta,
      temMeta,
      temVendas,
      percentualGeral,
      nivelGeral,
      projecaoOperacional,
      faixa,
      probabilidades,
      diasObservados: diasObservados.length,
      diasCompletos: diasCompletos.length,
      baseEstatistica: baseEstatistica.length,
      desvioDiario,
      tendencia: {
        ...tendencia,
        nome: nomeTendencia,
        quantidade: ultimosValores.length,
      },
      diaForte: mediasSemana[0] || null,
      diaFraco: mediasSemana.at(-1) || null,
      maisConsistente,
      maisOscilante,
      ranking,
      serieGeral,
      mudancaHistorica,
      insights: insights.slice(0, 4),
    };
  }, [mes, vendas, metas, lojas, historicos]);

  const historicoFiltrado = useMemo(() => {
    if (!analise) return [];
    return analise.serieGeral.map((serie) => {
      const lista = serie.vendas.filter((venda) => {
        if (
          filtroLoja !== "geral" &&
          Number(venda.loja_id) !== Number(filtroLoja)
        ) {
          return false;
        }
        if (filtroPeriodo !== "todos" && venda.periodo !== filtroPeriodo) {
          return false;
        }
        return true;
      });
      return {
        ano: serie.ano,
        total: somar(lista),
        valores: acumuladoPorDia(
          lista,
          analise.contexto.diaCorte,
          analise.contexto.diaCorte,
        ),
      };
    });
  }, [analise, filtroLoja, filtroPeriodo]);

  if (!autenticado || !visivel) return null;

  const futuro = analise?.contexto.tipo === "futuro";
  const encerrado = analise?.contexto.tipo === "encerrado";
  const atualHistorico = historicoFiltrado.find(
    (item) => item.ano === analise?.contexto.ano,
  )?.total;
  const anteriorHistorico = historicoFiltrado.find(
    (item) => item.ano === analise?.contexto.ano - 1,
  )?.total;
  const mudancaFiltrada = variacao(
    atualHistorico || 0,
    anteriorHistorico || 0,
  );

  let resumoHistorico = "A comparação começará quando o mês tiver lançamentos.";
  if (analise?.temVendas && mudancaFiltrada !== null) {
    resumoHistorico = `${analise.tituloMes} está ${percentual.format(
      Math.abs(mudancaFiltrada),
    )}% ${mudancaFiltrada >= 0 ? "acima" : "abaixo"} do mesmo ${
      encerrado ? "mês" : "período"
    } de ${analise.contexto.ano - 1}.`;
  } else if (analise?.temVendas) {
    resumoHistorico = "Há vendas no mês selecionado, mas não existe base do ano anterior para comparação.";
  }

  return (
    <details className="inteligencia-gerencial-unificada">
      <summary>
        <div>
          <strong>🧠 Inteligência Gerencial</strong>
          <span>
            {futuro
              ? "Planejamento do próximo período."
              : encerrado
                ? "Conclusões e comparativos do mês encerrado."
                : "Projeções, tendências e comparativos do mês em andamento."}
          </span>
        </div>
        <i aria-hidden="true">⌄</i>
      </summary>

      <div className="inteligencia-gerencial-conteudo">
        {carregando && (
          <div className={styles.loading}>Preparando a leitura do mês...</div>
        )}
        {erro && <div className={styles.error}>{erro}</div>}

        {!carregando && !erro && analise && (
          <>
            <section className="inteligencia-gerencial-secao">
              <h3>📊 Comparativo histórico</h3>
              {!futuro && analise.temVendas ? (
                <>
                  <div className={styles.filters}>
                    <select
                      value={filtroLoja}
                      onChange={(evento) => setFiltroLoja(evento.target.value)}
                      aria-label="Filtrar loja no histórico"
                    >
                      <option value="geral">Todas as lojas</option>
                      {lojas.map((loja) => (
                        <option value={loja.id} key={loja.id}>
                          {loja.codigo}
                        </option>
                      ))}
                    </select>
                    <select
                      value={filtroPeriodo}
                      onChange={(evento) => setFiltroPeriodo(evento.target.value)}
                      aria-label="Filtrar período no histórico"
                    >
                      <option value="todos">Todos os períodos</option>
                      <option value="manha">Manhã</option>
                      <option value="noite">Noite</option>
                    </select>
                  </div>
                  <GraficoHistorico
                    series={historicoFiltrado}
                    diaCorte={analise.contexto.diaCorte}
                  />
                </>
              ) : null}
              <p className={styles.explanation}>{resumoHistorico}</p>
            </section>

            <section className="inteligencia-gerencial-secao">
              <h3>
                {encerrado
                  ? "📈 Resultado estatístico final"
                  : futuro
                    ? "📈 Planejamento estatístico"
                    : "📈 Projeção estatística"}
              </h3>

              {futuro || !analise.temMeta || !analise.temVendas ? (
                <p className={styles.infoText}>
                  {fraseSemBase(
                    analise.contexto.tipo,
                    analise.temMeta,
                    analise.temVendas,
                  )}
                </p>
              ) : encerrado ? (
                <div className={styles.projectionExplain}>
                  <article>
                    <span>Resultado final</span>
                    <strong>{dinheiro.format(analise.totalVendido)}</strong>
                    <p>
                      {percentual.format(analise.percentualGeral || 0)}% da Meta · {analise.nivelGeral}.
                    </p>
                  </article>
                  <article>
                    <span>Leitura da variação diária</span>
                    <strong>{analise.diasObservados} dias com lançamentos</strong>
                    <p>
                      Desvio diário observado de {dinheiro.format(analise.desvioDiario)}. Como o mês encerrou, não há mais projeção nem probabilidade futura.
                    </p>
                  </article>
                </div>
              ) : (
                <>
                  <div className={styles.projectionExplain}>
                    <article>
                      <span>Resultado atual</span>
                      <strong>{dinheiro.format(analise.totalVendido)}</strong>
                      <p>
                        Projeção pelo ritmo médio: {dinheiro.format(
                          analise.projecaoOperacional,
                        )}.
                      </p>
                    </article>
                    <article>
                      <span>Faixa estatística aproximada</span>
                      <strong>
                        {dinheiro.format(analise.faixa.minimo)} a {" "}
                        {dinheiro.format(analise.faixa.maximo)}
                      </strong>
                      <p>
                        Faixa de referência, não garantia. O resultado ainda pode mudar com clima, turismo, campanhas e comportamento da equipe.
                      </p>
                    </article>
                  </div>

                  <div className={styles.probabilityList}>
                    <BarraProbabilidade
                      nome="Meta"
                      valor={analise.probabilidades.meta}
                    />
                    <BarraProbabilidade
                      nome="Supermeta"
                      valor={analise.probabilidades.super}
                    />
                    <BarraProbabilidade
                      nome="Megameta"
                      valor={analise.probabilidades.mega}
                    />
                  </div>

                  <p
                    className={
                      analise.baseEstatistica >= 3
                        ? styles.infoText
                        : styles.warningText
                    }
                  >
                    {analise.baseEstatistica >= 3
                      ? `Estimativa calculada com ${analise.baseEstatistica} dias na base estatística. Continue mantendo os lançamentos atualizados para acompanhar a evolução.`
                      : `A base ainda está sendo formada: há ${analise.diasObservados} dias com lançamentos. Continue preenchendo o mês para aumentar a confiabilidade das probabilidades.`}
                  </p>
                </>
              )}
            </section>

            <section className="inteligencia-gerencial-secao">
              <h3>{encerrado ? "📉 Tendências observadas no mês" : "📉 Tendências"}</h3>

              {futuro || !analise.temVendas ? (
                <p className={styles.infoText}>
                  {futuro
                    ? "As tendências começarão a ser calculadas após a abertura e os primeiros lançamentos do mês."
                    : "Ainda não há lançamentos suficientes para identificar ritmo, dias fortes ou regularidade das lojas."}
                </p>
              ) : (
                <div className={styles.trendGrid}>
                  <article>
                    <span>{encerrado ? "Tendência do período" : "Tendência recente"}</span>
                    <strong>{analise.tendencia.nome}</strong>
                    <p>
                      Variação linear de {dinheiro.format(
                        Math.abs(analise.tendencia.inclinacao),
                      )} por dia nos últimos {analise.tendencia.quantidade} dias observados.
                    </p>
                  </article>
                  <article>
                    <span>Dia mais forte</span>
                    <strong>{analise.diaForte?.nome || "Base em formação"}</strong>
                    <p>
                      {analise.diaForte
                        ? `Média de ${dinheiro.format(analise.diaForte.media)}.`
                        : "São necessárias ao menos duas ocorrências do mesmo dia da semana."}
                    </p>
                  </article>
                  <article>
                    <span>Dia mais fraco</span>
                    <strong>{analise.diaFraco?.nome || "Base em formação"}</strong>
                    <p>
                      {analise.diaFraco
                        ? `Média de ${dinheiro.format(analise.diaFraco.media)}.`
                        : "São necessárias ao menos duas ocorrências do mesmo dia da semana."}
                    </p>
                  </article>
                  <article>
                    <span>Regularidade</span>
                    <strong>
                      {analise.maisConsistente?.codigo || "Base em formação"}
                    </strong>
                    <p>
                      {analise.maisConsistente
                        ? `Menor oscilação proporcional. ${
                            analise.maisOscilante?.codigo
                              ? `${analise.maisOscilante.codigo} teve a maior variação.`
                              : ""
                          }`
                        : "Ainda não há dias suficientes por loja."}
                    </p>
                  </article>
                </div>
              )}
            </section>

            <section className="inteligencia-gerencial-secao">
              <h3>💡 Insights automáticos</h3>
              <div className="inteligencia-gerencial-insights">
                {(analise.insights.length
                  ? analise.insights
                  : [
                      fraseSemBase(
                        analise.contexto.tipo,
                        analise.temMeta,
                        analise.temVendas,
                      ),
                    ]
                ).map((insight) => (
                  <article key={insight}>
                    <p>{insight}</p>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </details>
  );
}
