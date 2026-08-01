"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  PERIODOS,
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
  const campo = document.querySelector('.top-actions input[type="month"]');
  if (campo?.value) return campo.value;

  const alternativa = document.querySelector('input[type="month"]');
  if (alternativa?.value) return alternativa.value;

  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

function painelAtivo() {
  const primeiro = document.querySelector("nav.tabs button:first-child");
  return Boolean(primeiro?.classList.contains("active"));
}

function variacao(atual, anterior) {
  if (!(anterior > 0)) return null;
  return ((atual - anterior) / anterior) * 100;
}

function porcentagem(valor, base) {
  return base > 0 ? (valor / base) * 100 : 0;
}

function esperar(tempo) {
  return new Promise((resolve) => setTimeout(resolve, tempo));
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
            ? "Sem dados suficientes"
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
      (_evento, sessao) => {
        setAutenticado(Boolean(sessao));
      },
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
      childList: true,
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

    async function consultarAtual(inicio, fim) {
      return supabase
        .from("vendas_diarias")
        .select("*")
        .gte("data", inicio)
        .lte("data", fim)
        .order("data", { ascending: true });
    }

    async function carregar() {
      setCarregando(true);
      setErro("");

      const { data: sessao } = await supabase.auth.getSession();
      if (!sessao.session) {
        if (!cancelado) {
          setErro("A sessão expirou. Entre novamente para atualizar a análise.");
          setCarregando(false);
        }
        return;
      }

      const [ano, numeroMes] = mes.split("-").map(Number);
      const atual = intervaloMes(ano, numeroMes);
      const anteriores = [ano - 2, ano - 1].map((anoHistorico) => ({
        ano: anoHistorico,
        ...intervaloMes(anoHistorico, numeroMes),
      }));

      let vendasResp = await consultarAtual(atual.inicio, atual.fim);

      // A consulta é repetida uma vez quando volta vazia para evitar a leitura
      // antes da sessão do navegador terminar de sincronizar.
      if (!vendasResp.error && (vendasResp.data || []).length === 0) {
        await esperar(250);
        vendasResp = await consultarAtual(atual.inicio, atual.fim);
      }

      const [lojasResp, metasResp, ...historicosResp] = await Promise.all([
        supabase.from("lojas").select("*").eq("ativa", true).order("ordem"),
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
        vendasResp,
        lojasResp,
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
        setFiltroLoja((filtroAtual) => {
          const existe = lojasCarregadas.some(
            (loja) => String(loja.id) === String(filtroAtual),
          );
          return filtroAtual === "geral" || existe ? filtroAtual : "geral";
        });
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

    const [ano, numeroMes] = mes.split("-").map(Number);
    const hoje = new Date();
    const intervalo = intervaloMes(ano, numeroMes);
    const mesAtual =
      ano === hoje.getFullYear() && numeroMes === hoje.getMonth() + 1;
    const mesPassado =
      ano < hoje.getFullYear() ||
      (ano === hoje.getFullYear() && numeroMes < hoje.getMonth() + 1);
    const diaCorte = mesAtual
      ? Math.min(hoje.getDate(), intervalo.ultimoDia)
      : mesPassado
        ? intervalo.ultimoDia
        : 0;
    const diasRestantes = Math.max(intervalo.ultimoDia - diaCorte, 0);
    const vendasConsideradas = vendas.filter(
      (venda) => diaDaData(venda.data) <= diaCorte,
    );
    const totalVendido = somar(vendasConsideradas);
    const totalMeta = somar(metas, "valor_meta");

    const mapaDias = new Map();
    vendasConsideradas.forEach((venda) => {
      if (!mapaDias.has(venda.data)) {
        mapaDias.set(venda.data, { total: 0, slots: new Set() });
      }
      const registro = mapaDias.get(venda.data);
      registro.total += Number(venda.valor_vendido || 0);
      registro.slots.add(`${Number(venda.loja_id)}|${venda.periodo}`);
    });

    const esperadoPorDia = lojas.length * PERIODOS.length;
    const diasObservados = Array.from(mapaDias.entries()).sort(([a], [b]) =>
      a.localeCompare(b),
    );
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
      diaCorte > 0 ? (totalVendido / diaCorte) * intervalo.ultimoDia : 0;
    const faixa = faixaEstimada({
      atual: totalVendido,
      mediaDiaria,
      desvioDiario,
      diasRestantes,
    });

    function calcularChance(alvo) {
      if (!(alvo > 0)) return null;
      if (diasRestantes <= 0) return totalVendido >= alvo ? 100 : 0;
      if (baseEstatistica.length < 3) return null;
      return probabilidadeAtingir({
        atual: totalVendido,
        alvo,
        mediaDiaria,
        desvioDiario,
        diasRestantes,
      });
    }

    const probabilidades = {
      meta: calcularChance(totalMeta),
      super: calcularChance(totalMeta * 1.2),
      mega: calcularChance(totalMeta * 1.3),
    };

    const lojasResumo = lojas.map((loja) => {
      const vendasLoja = vendasConsideradas.filter(
        (venda) => Number(venda.loja_id) === Number(loja.id),
      );
      const mapaLoja = new Map();
      vendasLoja.forEach((venda) => {
        mapaLoja.set(
          venda.data,
          (mapaLoja.get(venda.data) || 0) + Number(venda.valor_vendido || 0),
        );
      });
      const valores = Array.from(mapaLoja.values());
      return {
        ...loja,
        vendido: somar(vendasLoja),
        consistencia: coeficienteVariacao(valores),
      };
    });

    const lojasComConsistencia = lojasResumo
      .filter((loja) => loja.consistencia !== null)
      .sort((a, b) => a.consistencia - b.consistencia);
    const maisConsistente = lojasComConsistencia[0] || null;
    const maisOscilante =
      lojasComConsistencia[lojasComConsistencia.length - 1] || null;

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
    const diaForte = mediasSemana[0] || null;
    const diaFraco = mediasSemana[mediasSemana.length - 1] || null;

    const anos = [ano - 2, ano - 1, ano];
    const serieGeral = anos.map((anoSerie) => {
      const lista =
        anoSerie === ano
          ? vendasConsideradas
          : historicos.filter(
              (venda) =>
                anoDaData(venda.data) === anoSerie &&
                diaDaData(venda.data) <= diaCorte,
            );
      return {
        ano: anoSerie,
        total: somar(lista),
        vendas: lista,
      };
    });

    const atualSerie = serieGeral.find((item) => item.ano === ano);
    const anteriorSerie = serieGeral.find((item) => item.ano === ano - 1);
    const mudanca = variacao(atualSerie?.total || 0, anteriorSerie?.total || 0);
    const ordenada = [...serieGeral].sort((a, b) => b.total - a.total);
    const posicao = ordenada.findIndex((item) => item.ano === ano) + 1;

    const insights = [];
    if (posicao === 1 && serieGeral.some((item) => item.ano !== ano && item.total > 0)) {
      insights.push(
        `${nomesMeses[numeroMes - 1][0].toUpperCase()}${nomesMeses[numeroMes - 1].slice(1)} foi o melhor resultado dos últimos 3 anos.`,
      );
    } else if (
      posicao === serieGeral.length &&
      serieGeral.some((item) => item.ano !== ano && item.total > 0)
    ) {
      insights.push(
        `${nomesMeses[numeroMes - 1][0].toUpperCase()}${nomesMeses[numeroMes - 1].slice(1)} apresenta o menor resultado da série de 3 anos.`,
      );
    } else if (mudanca !== null) {
      insights.push(
        `O resultado está ${percentual.format(Math.abs(mudanca))}% ${
          mudanca >= 0 ? "acima" : "abaixo"
        } do mesmo período do ano anterior.`,
      );
    }

    if (ultimosValores.length >= 2) {
      insights.push(`O ritmo recente está ${nomeTendencia}.`);
    }

    if (maisConsistente) {
      insights.push(
        `${maisConsistente.codigo} apresenta a maior consistência entre as lojas.`,
      );
    }

    if (probabilidades.super !== null) {
      insights.push(
        `A probabilidade de Supermeta é de ${percentual.format(
          probabilidades.super,
        )}%.`,
      );
    }

    return {
      ano,
      numeroMes,
      tituloMes: `${nomesMeses[numeroMes - 1]} de ${ano}`,
      diaCorte,
      totalDias: intervalo.ultimoDia,
      totalVendido,
      totalMeta,
      projecaoOperacional,
      faixa,
      probabilidades,
      diasCompletos: diasCompletos.length,
      diasObservados: diasObservados.length,
      baseEstatistica: baseEstatistica.length,
      mediaDiaria,
      desvioDiario,
      tendencia: {
        ...tendencia,
        nome: nomeTendencia,
        quantidade: ultimosValores.length,
      },
      diaForte,
      diaFraco,
      maisConsistente,
      maisOscilante,
      serieGeral,
      mudanca,
      posicao,
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
          analise.diaCorte,
          analise.diaCorte,
        ),
      };
    });
  }, [analise, filtroLoja, filtroPeriodo]);

  if (!autenticado || !visivel) return null;

  const atualHistorico = historicoFiltrado.find(
    (item) => item.ano === analise?.ano,
  )?.total;
  const anteriorHistorico = historicoFiltrado.find(
    (item) => item.ano === analise?.ano - 1,
  )?.total;
  const mudancaFiltrada = variacao(
    atualHistorico || 0,
    anteriorHistorico || 0,
  );
  const resumoHistorico =
    mudancaFiltrada === null
      ? "Ainda não há base suficiente para comparar com o ano anterior."
      : `${analise?.tituloMes} está ${percentual.format(
          Math.abs(mudancaFiltrada),
        )}% ${mudancaFiltrada >= 0 ? "acima" : "abaixo"} do mesmo período de ${
          analise.ano - 1
        }.`;

  return (
    <details className="inteligencia-gerencial-unificada">
      <summary>
        <div>
          <strong>🧠 Inteligência Gerencial</strong>
          <span>Projeções, tendências e comparativos históricos.</span>
        </div>
        <i aria-hidden="true">⌄</i>
      </summary>

      <div className="inteligencia-gerencial-conteudo">
        {carregando && (
          <div className={styles.loading}>
            Calculando indicadores e comparações...
          </div>
        )}

        {erro && <div className={styles.error}>{erro}</div>}

        {!carregando && !erro && analise && (
          <>
            <section className="inteligencia-gerencial-secao">
              <h3>📊 Comparativo histórico</h3>
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
                diaCorte={analise.diaCorte}
              />
              <p className={styles.explanation}>{resumoHistorico}</p>
            </section>

            <section className="inteligencia-gerencial-secao">
              <h3>📈 Projeção estatística</h3>
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
                    {dinheiro.format(analise.faixa.minimo)} a{" "}
                    {dinheiro.format(analise.faixa.maximo)}
                  </strong>
                  <p>
                    Referência baseada na variação diária. Não é garantia e não
                    considera clima, turismo, campanhas ou mudanças de equipe.
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
                  ? `Estimativa calculada com ${analise.baseEstatistica} dias na base estatística e desvio diário de ${dinheiro.format(
                      analise.desvioDiario,
                    )}.`
                  : `Amostra ainda pequena: há ${analise.diasObservados} dias com lançamentos. As probabilidades devem ser interpretadas com cautela.`}
              </p>
            </section>

            <section className="inteligencia-gerencial-secao">
              <h3>📉 Tendências</h3>
              <div className={styles.trendGrid}>
                <article>
                  <span>Tendência recente</span>
                  <strong>{analise.tendencia.nome}</strong>
                  <p>
                    Variação linear estimada de{" "}
                    {dinheiro.format(Math.abs(analise.tendencia.inclinacao))} por
                    dia nos últimos {analise.tendencia.quantidade} dias com
                    lançamentos.
                  </p>
                </article>
                <article>
                  <span>Dia mais forte</span>
                  <strong>{analise.diaForte?.nome || "Sem amostra"}</strong>
                  <p>
                    {analise.diaForte
                      ? `Média de ${dinheiro.format(analise.diaForte.media)}.`
                      : "São necessárias ao menos duas ocorrências do mesmo dia da semana."}
                  </p>
                </article>
                <article>
                  <span>Dia mais fraco</span>
                  <strong>{analise.diaFraco?.nome || "Sem amostra"}</strong>
                  <p>
                    {analise.diaFraco
                      ? `Média de ${dinheiro.format(analise.diaFraco.media)}.`
                      : "São necessárias ao menos duas ocorrências do mesmo dia da semana."}
                  </p>
                </article>
                <article>
                  <span>Regularidade</span>
                  <strong>
                    {analise.maisConsistente?.codigo || "Sem amostra"}
                  </strong>
                  <p>
                    {analise.maisConsistente
                      ? `Menor oscilação proporcional. ${
                          analise.maisOscilante?.codigo
                            ? `${analise.maisOscilante.codigo} apresentou a maior variação.`
                            : ""
                        }`
                      : "Ainda não há dias suficientes por loja."}
                  </p>
                </article>
              </div>
            </section>

            <section className="inteligencia-gerencial-secao">
              <h3>💡 Insights automáticos</h3>
              <div className="inteligencia-gerencial-insights">
                {(analise.insights.length
                  ? analise.insights
                  : [
                      "Os insights serão gerados assim que houver dados suficientes no mês selecionado.",
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
