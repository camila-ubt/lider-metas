"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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

function porcentagem(valor, base) {
  return base > 0 ? (valor / base) * 100 : 0;
}

function variacao(atual, anterior) {
  if (!(anterior > 0)) return null;
  return ((atual - anterior) / anterior) * 100;
}

function nivelDoResultado(vendido, meta) {
  if (!(meta > 0)) return "Sem meta";
  if (vendido >= meta * 1.3) return "Megameta";
  if (vendido >= meta * 1.2) return "Supermeta";
  if (vendido >= meta) return "Meta";
  return "Abaixo da Meta";
}

function nomePeriodo(periodo) {
  return periodo === "manha" ? "Manhã" : "Noite";
}

function mesDaTela() {
  const campo = document.querySelector('input[type="month"]');
  if (campo?.value) return campo.value;
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

function painelAtivo() {
  const primeiro = document.querySelector("nav.tabs button:first-child");
  return Boolean(primeiro?.classList.contains("active"));
}

function alvoDoFechamento() {
  return document.querySelector('div[class*="FechamentoMensal_report"]');
}

function Bloco({ titulo, resumo, children, modo, aberto = false }) {
  if (modo === "fechamento") {
    return (
      <article className={styles.fullBlock}>
        <header className={styles.fullBlockHeader}>
          <div>
            <h3>{titulo}</h3>
            {resumo && <p>{resumo}</p>}
          </div>
        </header>
        <div className={styles.blockContent}>{children}</div>
      </article>
    );
  }

  return (
    <details className={styles.collapse} open={aberto}>
      <summary>
        <div>
          <strong>{titulo}</strong>
          {resumo && <span>{resumo}</span>}
        </div>
        <i>⌄</i>
      </summary>
      <div className={styles.blockContent}>{children}</div>
    </details>
  );
}

function GraficoHistorico({ series, diaCorte }) {
  const maximo = Math.max(
    ...series.flatMap((item) => item.valores.map((valor) => Number(valor || 0))),
    1
  );
  const marcas = [1, 8, 15, 22, diaCorte].filter(
    (dia, indice, lista) => dia > 0 && dia <= diaCorte && lista.indexOf(dia) === indice
  );
  const classes = [styles.historyLineOne, styles.historyLineTwo, styles.historyLineThree];

  return (
    <div className={styles.historyChartBox}>
      <svg viewBox="0 0 700 250" role="img" aria-label="Comparação histórica acumulada">
        {[0, 0.25, 0.5, 0.75, 1].map((proporcao) => {
          const y = 216 - proporcao * 182;
          return (
            <g key={proporcao}>
              <line x1="34" x2="666" y1={y} y2={y} className={styles.gridLine} />
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
        <span>{valor === null ? "Sem dados suficientes" : `${percentual.format(exibido)}%`}</span>
      </div>
      <div className={styles.probabilityTrack}>
        <i style={{ width: `${Math.max(0, Math.min(exibido, 100))}%` }} />
      </div>
    </div>
  );
}

export default function AnaliseGerencial({ modo = "painel" }) {
  const supabase = useMemo(() => createClient(), []);
  const [autenticado, setAutenticado] = useState(false);
  const [visivel, setVisivel] = useState(false);
  const [portal, setPortal] = useState(null);
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

    const { data: listener } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      setAutenticado(Boolean(sessao));
    });

    return () => {
      ativo = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    function sincronizar() {
      setMes(mesDaTela());
      if (modo === "painel") {
        setVisivel(painelAtivo());
        return;
      }

      const alvo = alvoDoFechamento();
      setPortal(alvo);
      setVisivel(Boolean(alvo));
    }

    sincronizar();
    document.addEventListener("click", sincronizar, true);
    document.addEventListener("change", sincronizar, true);
    const observador = new MutationObserver(sincronizar);
    observador.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      document.removeEventListener("click", sincronizar, true);
      document.removeEventListener("change", sincronizar, true);
      observador.disconnect();
    };
  }, [modo]);

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

      const [lojasResp, vendasResp, metasResp, ...historicosResp] = await Promise.all([
        supabase.from("lojas").select("*").eq("ativa", true).order("ordem"),
        supabase
          .from("vendas_diarias")
          .select("data,loja_id,periodo,valor_vendido,observacao")
          .gte("data", atual.inicio)
          .lte("data", atual.fim)
          .order("data", { ascending: true }),
        supabase
          .from("metas_mensais")
          .select("loja_id,periodo,valor_meta")
          .eq("mes", `${mes}-01`),
        ...anteriores.map((item) =>
          supabase
            .from("vendas_diarias")
            .select("data,loja_id,periodo,valor_vendido")
            .gte("data", item.inicio)
            .lte("data", item.fim)
            .order("data", { ascending: true })
        ),
      ]);

      if (cancelado) return;
      const falha = [lojasResp, vendasResp, metasResp, ...historicosResp].find(
        (resposta) => resposta.error
      );

      if (falha?.error) {
        setErro(falha.error.message);
      } else {
        const lojasCarregadas = lojasResp.data || [];
        setLojas(lojasCarregadas);
        setVendas(vendasResp.data || []);
        setMetas(metasResp.data || []);
        setHistoricos(historicosResp.flatMap((resposta) => resposta.data || []));
        setFiltroLoja((atualFiltro) => {
          const existe = lojasCarregadas.some(
            (loja) => String(loja.id) === String(atualFiltro)
          );
          return atualFiltro === "geral" || existe ? atualFiltro : "geral";
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
    const mesAtual = ano === hoje.getFullYear() && numeroMes === hoje.getMonth() + 1;
    const mesPassado =
      ano < hoje.getFullYear() ||
      (ano === hoje.getFullYear() && numeroMes < hoje.getMonth() + 1);
    const diaCorte = mesAtual
      ? Math.min(hoje.getDate(), intervalo.ultimoDia)
      : mesPassado
        ? intervalo.ultimoDia
        : 0;
    const diasRestantes = Math.max(intervalo.ultimoDia - diaCorte, 0);
    const vendasConsideradas = vendas.filter((venda) => diaDaData(venda.data) <= diaCorte);
    const totalVendido = somar(vendasConsideradas);
    const totalMeta = somar(metas, "valor_meta");
    const esperadoPorDia = lojas.length * PERIODOS.length;
    const mapaDias = new Map();

    vendasConsideradas.forEach((venda) => {
      if (!mapaDias.has(venda.data)) {
        mapaDias.set(venda.data, { total: 0, slots: new Set() });
      }
      const registro = mapaDias.get(venda.data);
      registro.total += Number(venda.valor_vendido || 0);
      registro.slots.add(`${Number(venda.loja_id)}|${venda.periodo}`);
    });

    const diasCompletos = Array.from(mapaDias.entries())
      .filter(([, item]) => esperadoPorDia > 0 && item.slots.size >= esperadoPorDia)
      .sort(([dataA], [dataB]) => dataA.localeCompare(dataB));
    const valoresCompletos = diasCompletos.map(([, item]) => item.total);
    const mediaCompleta = valoresCompletos.length
      ? media(valoresCompletos)
      : diaCorte > 0
        ? totalVendido / diaCorte
        : 0;
    const desvioCompleto = desvioPadrao(valoresCompletos);
    const projecaoOperacional = diaCorte > 0
      ? (totalVendido / diaCorte) * intervalo.ultimoDia
      : 0;
    const faixa = faixaEstimada({
      atual: totalVendido,
      mediaDiaria: mediaCompleta,
      desvioDiario: desvioCompleto,
      diasRestantes,
    });
    const probabilidades = {
      meta: valoresCompletos.length >= 3
        ? probabilidadeAtingir({
            atual: totalVendido,
            alvo: totalMeta,
            mediaDiaria: mediaCompleta,
            desvioDiario: desvioCompleto,
            diasRestantes,
          })
        : null,
      super: valoresCompletos.length >= 3
        ? probabilidadeAtingir({
            atual: totalVendido,
            alvo: totalMeta * 1.2,
            mediaDiaria: mediaCompleta,
            desvioDiario: desvioCompleto,
            diasRestantes,
          })
        : null,
      mega: valoresCompletos.length >= 3
        ? probabilidadeAtingir({
            atual: totalVendido,
            alvo: totalMeta * 1.3,
            mediaDiaria: mediaCompleta,
            desvioDiario: desvioCompleto,
            diasRestantes,
          })
        : null,
    };

    const metasPorSlot = new Map(
      metas.map((meta) => [
        `${Number(meta.loja_id)}|${meta.periodo}`,
        Number(meta.valor_meta || 0),
      ])
    );

    const lojasResumo = lojas.map((loja) => {
      const vendasLoja = vendasConsideradas.filter(
        (venda) => Number(venda.loja_id) === Number(loja.id)
      );
      const vendido = somar(vendasLoja);
      const metaManha = metasPorSlot.get(`${Number(loja.id)}|manha`) || 0;
      const metaNoite = metasPorSlot.get(`${Number(loja.id)}|noite`) || 0;
      const meta = metaManha + metaNoite;
      const mapaLojaDia = new Map();

      vendasLoja.forEach((venda) => {
        if (!mapaLojaDia.has(venda.data)) {
          mapaLojaDia.set(venda.data, { total: 0, periodos: new Set() });
        }
        const item = mapaLojaDia.get(venda.data);
        item.total += Number(venda.valor_vendido || 0);
        item.periodos.add(venda.periodo);
      });

      const valoresDiasLoja = Array.from(mapaLojaDia.values())
        .filter((item) => item.periodos.size >= 2)
        .map((item) => item.total);

      const criarPeriodo = (periodo, metaPeriodo) => {
        const vendasPeriodo = vendasLoja.filter((venda) => venda.periodo === periodo);
        const vendidoPeriodo = somar(vendasPeriodo);
        return {
          periodo,
          nome: nomePeriodo(periodo),
          vendido: vendidoPeriodo,
          meta: metaPeriodo,
          percentual: porcentagem(vendidoPeriodo, metaPeriodo),
          projecao: diaCorte > 0
            ? (vendidoPeriodo / diaCorte) * intervalo.ultimoDia
            : 0,
        };
      };

      return {
        ...loja,
        vendido,
        meta,
        percentual: porcentagem(vendido, meta),
        falta: Math.max(meta - vendido, 0),
        projecao: diaCorte > 0 ? (vendido / diaCorte) * intervalo.ultimoDia : 0,
        nivel: nivelDoResultado(vendido, meta),
        consistencia: coeficienteVariacao(valoresDiasLoja),
        periodos: [
          criarPeriodo("manha", metaManha),
          criarPeriodo("noite", metaNoite),
        ],
      };
    });

    const ranking = [...lojasResumo].sort((a, b) => b.percentual - a.percentual);
    const destaque = ranking[0] || null;
    const atencao = ranking[ranking.length - 1] || null;
    const consistentes = lojasResumo
      .filter((loja) => loja.consistencia !== null)
      .sort((a, b) => a.consistencia - b.consistencia);
    const maisConsistente = consistentes[0] || null;
    const maisOscilante = consistentes[consistentes.length - 1] || null;

    const periodosResumo = PERIODOS.map((periodo) => {
      const periodoLojas = lojasResumo
        .map((loja) => ({
          loja,
          dados: loja.periodos.find((item) => item.periodo === periodo),
        }))
        .sort((a, b) => b.dados.percentual - a.dados.percentual);
      const vendido = periodoLojas.reduce((total, item) => total + item.dados.vendido, 0);
      const metaPeriodo = periodoLojas.reduce((total, item) => total + item.dados.meta, 0);
      const anterior = somar(
        historicos.filter(
          (venda) =>
            anoDaData(venda.data) === ano - 1 &&
            diaDaData(venda.data) <= diaCorte &&
            venda.periodo === periodo
        )
      );
      const lider = periodoLojas[0] || null;
      const pontoAtencao = periodoLojas[periodoLojas.length - 1] || null;

      return {
        periodo,
        nome: nomePeriodo(periodo),
        vendido,
        meta: metaPeriodo,
        percentual: porcentagem(vendido, metaPeriodo),
        projecao: diaCorte > 0 ? (vendido / diaCorte) * intervalo.ultimoDia : 0,
        anterior,
        variacao: variacao(vendido, anterior),
        lider,
        pontoAtencao,
      };
    });

    const ultimosValores = valoresCompletos.slice(-10);
    const tendencia = regressaoLinear(ultimosValores);
    const nomeTendencia = textoTendencia(tendencia.inclinacao, media(ultimosValores));

    const semana = new Map();
    diasCompletos.forEach(([data, item]) => {
      const indice = new Date(`${data}T12:00:00`).getDay();
      if (!semana.has(indice)) semana.set(indice, []);
      semana.get(indice).push(item.total);
    });
    const mediasSemana = Array.from(semana.entries())
      .map(([indice, valores]) => ({
        indice,
        nome: nomesSemana[indice],
        media: media(valores),
        quantidade: valores.length,
      }))
      .filter((item) => item.quantidade >= 2)
      .sort((a, b) => b.media - a.media);
    const diaForte = mediasSemana[0] || null;
    const diaFraco = mediasSemana[mediasSemana.length - 1] || null;

    const pendentes = Math.max(diaCorte - diasCompletos.length, 0);
    const acoes = [];
    if (pendentes > 0) {
      acoes.push(`Conferir e concluir os ${pendentes} dias ainda incompletos antes da reunião final.`);
    }
    if (atencao && atencao.percentual < 100) {
      acoes.push(
        `Priorizar ${atencao.codigo}, que está em ${percentual.format(atencao.percentual)}% da Meta e ainda precisa de ${dinheiro.format(atencao.falta)}.`
      );
    }
    periodosResumo.forEach((periodo) => {
      if (periodo.percentual < 100 && periodo.pontoAtencao) {
        acoes.push(
          `Na ${periodo.nome.toLowerCase()}, acompanhar mais de perto ${periodo.pontoAtencao.loja.codigo}, o menor percentual do período.`
        );
      }
    });
    if (nomeTendencia === "de queda") {
      acoes.push("Revisar os últimos dias, pois a tendência recente está em queda mesmo que a projeção ainda seja positiva.");
    }
    if (maisOscilante) {
      acoes.push(
        `Buscar mais regularidade em ${maisOscilante.codigo}, que apresentou a maior oscilação entre os dias completos.`
      );
    }
    if (destaque && destaque.percentual >= 100) {
      acoes.push(
        `Compartilhar com a equipe as práticas de ${destaque.codigo}, destaque do mês com ${percentual.format(destaque.percentual)}% da Meta.`
      );
    }
    if (diaFraco) {
      acoes.push(
        `Preparar uma ação específica para ${diaFraco.nome}, que apresenta a menor média entre os dias da semana com amostra suficiente.`
      );
    }

    return {
      ano,
      numeroMes,
      tituloMes: `${nomesMeses[numeroMes - 1]} de ${ano}`,
      totalDias: intervalo.ultimoDia,
      diaCorte,
      diasRestantes,
      totalVendido,
      totalMeta,
      percentualMeta: porcentagem(totalVendido, totalMeta),
      nivel: nivelDoResultado(totalVendido, totalMeta),
      projecaoOperacional,
      faixa,
      probabilidades,
      diasCompletos: diasCompletos.length,
      pendentes,
      amostraSuficiente: valoresCompletos.length >= 5,
      mediaCompleta,
      desvioCompleto,
      ranking,
      destaque,
      atencao,
      maisConsistente,
      maisOscilante,
      periodos: periodosResumo,
      tendencia: {
        ...tendencia,
        nome: nomeTendencia,
        quantidade: ultimosValores.length,
      },
      diaForte,
      diaFraco,
      acoes: acoes.slice(0, 7),
    };
  }, [mes, vendas, metas, lojas, historicos]);

  const historicoFiltrado = useMemo(() => {
    if (!analise) return [];
    const anos = [analise.ano - 2, analise.ano - 1, analise.ano];
    const filtrar = (lista) =>
      lista.filter((venda) => {
        if (diaDaData(venda.data) > analise.diaCorte) return false;
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

    return anos.map((ano) => {
      const lista = ano === analise.ano
        ? filtrar(vendas)
        : filtrar(historicos.filter((venda) => anoDaData(venda.data) === ano));
      return {
        ano,
        total: somar(lista),
        valores: acumuladoPorDia(lista, analise.diaCorte, analise.diaCorte),
      };
    });
  }, [analise, vendas, historicos, filtroLoja, filtroPeriodo]);

  if (!autenticado || !visivel) return null;

  const anterior = historicoFiltrado.find((item) => item.ano === analise?.ano - 1)?.total || 0;
  const atualHistorico = historicoFiltrado.find((item) => item.ano === analise?.ano)?.total || 0;
  const mudancaHistorica = variacao(atualHistorico, anterior);
  const resumoHistorico = mudancaHistorica === null
    ? "Ainda não há base suficiente para comparar com o ano anterior."
    : `${analise?.tituloMes} está ${percentual.format(Math.abs(mudancaHistorica))}% ${
        mudancaHistorica >= 0 ? "acima" : "abaixo"
      } do mesmo período de ${analise.ano - 1}.`;

  const conteudo = (
    <section className={`${styles.wrapper} ${modo === "fechamento" ? styles.reportWrapper : ""}`}>
      <header className={styles.mainHeader}>
        <div>
          <p>{modo === "fechamento" ? "Análise para a reunião" : "Leitura gerencial avançada"}</p>
          <h2>{modo === "fechamento" ? "Diagnóstico completo do mês" : "Insights para as líderes"}</h2>
          <span>
            {analise
              ? `${analise.tituloMes} · números atualizados até o dia ${analise.diaCorte}`
              : "Preparando a análise do mês selecionado."}
          </span>
        </div>
      </header>

      {carregando && <div className={styles.loading}>Calculando indicadores e comparações...</div>}
      {erro && <div className={styles.error}>{erro}</div>}

      {!carregando && !erro && analise && (
        <div className={styles.blocks}>
          <Bloco
            modo={modo}
            aberto
            titulo="Resumo gerencial"
            resumo="Resultado, nível atual, projeção e qualidade dos dados."
          >
            <div className={styles.metricGrid}>
              <article>
                <span>Resultado atual</span>
                <strong>{dinheiro.format(analise.totalVendido)}</strong>
                <small>{percentual.format(analise.percentualMeta)}% da Meta · {analise.nivel}</small>
              </article>
              <article>
                <span>Projeção operacional</span>
                <strong>{dinheiro.format(analise.projecaoOperacional)}</strong>
                <small>Ritmo médio até o dia {analise.diaCorte}</small>
              </article>
              <article>
                <span>Dias completos</span>
                <strong>{analise.diasCompletos}</strong>
                <small>{analise.pendentes} dias ainda incompletos</small>
              </article>
              <article>
                <span>Média dos dias completos</span>
                <strong>{dinheiro.format(analise.mediaCompleta)}</strong>
                <small>Base da leitura estatística</small>
              </article>
            </div>
            {analise.pendentes > 0 && (
              <p className={styles.warningText}>
                Existem dias incompletos. A projeção e os comparativos podem mudar após os lançamentos pendentes.
              </p>
            )}
          </Bloco>

          <Bloco
            modo={modo}
            titulo="Loja destaque e ponto de atenção"
            resumo="Ranking proporcional à Meta, não apenas pelo maior faturamento."
          >
            <div className={styles.highlightGrid}>
              <article className={styles.positiveCard}>
                <span>Loja destaque</span>
                <strong>
                  {analise.destaque
                    ? `${analise.destaque.codigo} — ${analise.destaque.nome}`
                    : "Sem dados"}
                </strong>
                {analise.destaque && (
                  <p>
                    {percentual.format(analise.destaque.percentual)}% da Meta, com {dinheiro.format(analise.destaque.vendido)} vendidos e projeção de {dinheiro.format(analise.destaque.projecao)}.
                  </p>
                )}
              </article>
              <article className={styles.attentionCard}>
                <span>Maior ponto de atenção</span>
                <strong>
                  {analise.atencao
                    ? `${analise.atencao.codigo} — ${analise.atencao.nome}`
                    : "Sem dados"}
                </strong>
                {analise.atencao && (
                  <p>
                    {percentual.format(analise.atencao.percentual)}% da Meta. {analise.atencao.falta > 0
                      ? `Faltam ${dinheiro.format(analise.atencao.falta)} para alcançar a Meta.`
                      : `O próximo objetivo é avançar além da ${analise.atencao.nivel}.`}
                  </p>
                )}
              </article>
            </div>
            <div className={styles.inlineFacts}>
              {analise.maisConsistente && (
                <span><b>Mais consistente:</b> {analise.maisConsistente.codigo}</span>
              )}
              {analise.maisOscilante && (
                <span><b>Maior oscilação:</b> {analise.maisOscilante.codigo}</span>
              )}
            </div>
          </Bloco>

          {analise.periodos.map((periodo) => (
            <Bloco
              modo={modo}
              titulo={`Leitura da ${periodo.nome.toLowerCase()}`}
              resumo={`Resultado do período e orientação para a líder da ${periodo.nome.toLowerCase()}.`}
              key={periodo.periodo}
            >
              <div className={styles.periodHeading}>
                <div>
                  <span>Total vendido</span>
                  <strong>{dinheiro.format(periodo.vendido)}</strong>
                </div>
                <div>
                  <span>Meta</span>
                  <strong>{dinheiro.format(periodo.meta)}</strong>
                </div>
                <div>
                  <span>Desempenho</span>
                  <strong>{percentual.format(periodo.percentual)}%</strong>
                </div>
                <div>
                  <span>Projeção</span>
                  <strong>{dinheiro.format(periodo.projecao)}</strong>
                </div>
              </div>

              <div className={styles.periodReading}>
                <p>
                  <b>Destaque do período:</b>{" "}
                  {periodo.lider
                    ? `${periodo.lider.loja.codigo}, com ${percentual.format(periodo.lider.dados.percentual)}% da própria Meta.`
                    : "sem dados suficientes."}
                </p>
                <p>
                  <b>Ponto de atenção:</b>{" "}
                  {periodo.pontoAtencao
                    ? `${periodo.pontoAtencao.loja.codigo}, com ${percentual.format(periodo.pontoAtencao.dados.percentual)}% da própria Meta.`
                    : "sem dados suficientes."}
                </p>
                <p>
                  <b>Comparação anual:</b>{" "}
                  {periodo.variacao === null
                    ? "não há base do ano anterior."
                    : `${Math.abs(periodo.variacao).toFixed(1).replace(".", ",")}% ${periodo.variacao >= 0 ? "acima" : "abaixo"} do mesmo período do ano anterior.`}
                </p>
                <p className={styles.actionNote}>
                  <b>Ação sugerida:</b>{" "}
                  {periodo.percentual < 100 && periodo.pontoAtencao
                    ? `concentrar o acompanhamento em ${periodo.pontoAtencao.loja.codigo} e acompanhar diariamente o valor necessário para a Meta.`
                    : periodo.percentual < 120
                      ? `manter o ritmo e compartilhar as práticas de ${periodo.lider?.loja.codigo || "quem lidera"} para buscar a Supermeta.`
                      : "preservar o padrão atual e documentar as práticas que produziram o resultado."}
                </p>
              </div>
            </Bloco>
          ))}

          <Bloco
            modo={modo}
            titulo="Comparativo histórico"
            resumo="Evolução acumulada do mesmo mês nos últimos três anos."
          >
            {modo === "painel" && (
              <div className={styles.filters}>
                <select
                  value={filtroLoja}
                  onChange={(evento) => setFiltroLoja(evento.target.value)}
                  aria-label="Filtrar loja no histórico"
                >
                  <option value="geral">Todas as lojas</option>
                  {lojas.map((loja) => (
                    <option value={loja.id} key={loja.id}>{loja.codigo}</option>
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
            )}
            <GraficoHistorico series={historicoFiltrado} diaCorte={analise.diaCorte} />
            <p className={styles.explanation}>{resumoHistorico}</p>
          </Bloco>

          <Bloco
            modo={modo}
            titulo="Projeção e inferência estatística"
            resumo="Estimativa de fechamento, faixa provável e chance de atingir os níveis."
          >
            <div className={styles.projectionExplain}>
              <article>
                <span>O que é projeção?</span>
                <p>
                  É uma estimativa do fechamento caso o ritmo médio observado continue. A projeção operacional divide o vendido pelos dias decorridos e multiplica pelo total de dias do mês.
                </p>
              </article>
              <article>
                <span>Faixa estatística aproximada</span>
                <strong>
                  {dinheiro.format(analise.faixa.minimo)} a {dinheiro.format(analise.faixa.maximo)}
                </strong>
                <p>
                  Faixa de referência baseada na variação dos dias completos. Não é garantia e não considera clima, turismo, campanhas ou mudanças de equipe.
                </p>
              </article>
            </div>

            <div className={styles.probabilityList}>
              <BarraProbabilidade nome="Meta" valor={analise.probabilidades.meta} />
              <BarraProbabilidade nome="Supermeta" valor={analise.probabilidades.super} />
              <BarraProbabilidade nome="Megameta" valor={analise.probabilidades.mega} />
            </div>

            <p className={analise.amostraSuficiente ? styles.infoText : styles.warningText}>
              {analise.amostraSuficiente
                ? `Estimativa calculada com ${analise.diasCompletos} dias completos e desvio diário de ${dinheiro.format(analise.desvioCompleto)}.`
                : `Amostra ainda pequena: há ${analise.diasCompletos} dias completos. As probabilidades devem ser interpretadas com cautela.`}
            </p>
          </Bloco>

          <Bloco
            modo={modo}
            titulo="Tendência e consistência"
            resumo="Ritmo recente, regularidade das lojas e comportamento por dia da semana."
          >
            <div className={styles.trendGrid}>
              <article>
                <span>Tendência recente</span>
                <strong>{analise.tendencia.nome}</strong>
                <p>
                  Variação linear estimada de {dinheiro.format(Math.abs(analise.tendencia.inclinacao))} por dia nos últimos {analise.tendencia.quantidade} dias completos.
                </p>
              </article>
              <article>
                <span>Dia mais forte</span>
                <strong>{analise.diaForte?.nome || "Sem amostra"}</strong>
                <p>{analise.diaForte ? `Média de ${dinheiro.format(analise.diaForte.media)}.` : "São necessárias ao menos duas ocorrências do mesmo dia da semana."}</p>
              </article>
              <article>
                <span>Dia mais fraco</span>
                <strong>{analise.diaFraco?.nome || "Sem amostra"}</strong>
                <p>{analise.diaFraco ? `Média de ${dinheiro.format(analise.diaFraco.media)}.` : "São necessárias ao menos duas ocorrências do mesmo dia da semana."}</p>
              </article>
              <article>
                <span>Regularidade</span>
                <strong>{analise.maisConsistente?.codigo || "Sem amostra"}</strong>
                <p>
                  {analise.maisConsistente
                    ? `Menor oscilação proporcional entre os dias completos. ${analise.maisOscilante?.codigo ? `${analise.maisOscilante.codigo} apresentou a maior variação.` : ""}`
                    : "Ainda não há dias completos suficientes por loja."}
                </p>
              </article>
            </div>
            <p className={styles.infoText}>
              Tendência indica associação com a sequência dos dias, não prova a causa do aumento ou da queda.
            </p>
          </Bloco>

          <Bloco
            modo={modo}
            titulo="Ações sugeridas"
            resumo="Prioridades objetivas para a reunião e para o próximo acompanhamento."
          >
            <div className={styles.actionsList}>
              {analise.acoes.length ? (
                analise.acoes.map((acao, indice) => (
                  <article key={`${indice}-${acao}`}>
                    <span>{indice + 1}</span>
                    <p>{acao}</p>
                  </article>
                ))
              ) : (
                <p>Preencha as metas e os lançamentos para gerar ações sugeridas.</p>
              )}
            </div>
          </Bloco>
        </div>
      )}
    </section>
  );

  if (modo === "fechamento") {
    return portal ? createPortal(conteudo, portal) : null;
  }

  return conteudo;
}
