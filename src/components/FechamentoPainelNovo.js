"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { contextoDoMes, nivelDoResultado, percentualDoResultado, proximoNivel } from "@/lib/contextoMes";
import styles from "./FechamentoPainelNovo.module.css";

const dinheiro = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const percentual = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const compacto = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const meses = [
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

const periodos = ["manha", "noite"];

function somar(lista, campo = "valor_vendido") {
  return lista.reduce((total, item) => total + Number(item?.[campo] || 0), 0);
}

function intervaloMes(ano, numeroMes) {
  const mesTexto = String(numeroMes).padStart(2, "0");
  const ultimoDia = new Date(ano, numeroMes, 0).getDate();
  return {
    inicio: `${ano}-${mesTexto}-01`,
    fim: `${ano}-${mesTexto}-${String(ultimoDia).padStart(2, "0")}`,
    ultimoDia,
  };
}

function dataDoDia(ano, numeroMes, dia) {
  return `${ano}-${String(numeroMes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function diaDaData(data) {
  return Number(String(data).slice(8, 10));
}

function nomePeriodo(periodo) {
  return periodo === "manha" ? "Manhã" : "Noite";
}

function variacao(atual, anterior) {
  if (!(anterior > 0)) return null;
  return ((atual - anterior) / anterior) * 100;
}

function classeNivel(nivel) {
  if (nivel === "Megameta") return "mega";
  if (nivel === "Supermeta") return "super";
  if (nivel === "Meta") return "meta";
  if (nivel === "Abaixo da Meta") return "abaixo";
  return "semMeta";
}

function jornada(vendido, meta) {
  const niveis = [
    { nome: "Meta", valor: meta, simbolo: "★" },
    { nome: "Supermeta", valor: meta * 1.2, simbolo: "◆" },
    { nome: "Megameta", valor: meta * 1.3, simbolo: "♛" },
  ];

  if (!(meta > 0)) {
    return {
      niveis,
      nivel: "Sem meta cadastrada",
      proximo: null,
      falta: 0,
      progressoEtapa: 0,
      completa: false,
    };
  }

  const proximo = proximoNivel(vendido, meta);
  const nivel = nivelDoResultado(vendido, meta);

  if (!proximo) {
    return {
      niveis,
      nivel,
      proximo: null,
      falta: 0,
      progressoEtapa: 100,
      completa: true,
    };
  }

  const indice = niveis.findIndex((item) => item.nome === proximo.nome);
  const anterior = indice > 0 ? niveis[indice - 1].valor : 0;
  const faixa = Math.max(proximo.valor - anterior, 1);

  return {
    niveis,
    nivel,
    proximo,
    falta: Math.max(proximo.valor - vendido, 0),
    progressoEtapa: Math.max(0, Math.min(((vendido - anterior) / faixa) * 100, 100)),
    completa: false,
  };
}

function caminhoLinha(valores, maximo, largura = 720, altura = 250, margem = 34) {
  const areaLargura = largura - margem * 2;
  const areaAltura = altura - margem * 2;
  let iniciou = false;

  return valores
    .map((valor, indice) => {
      if (valor === null || valor === undefined || !Number.isFinite(Number(valor))) {
        return "";
      }
      const x = margem + (indice / Math.max(valores.length - 1, 1)) * areaLargura;
      const y = altura - margem - (Number(valor) / Math.max(maximo, 1)) * areaAltura;
      const comando = iniciou ? "L" : "M";
      iniciou = true;
      return `${comando} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .filter(Boolean)
    .join(" ");
}

function GraficoJornada({ diario, meta, diaCorte, projecao, mostrarProjecao }) {
  const acumulado = [];
  let total = 0;
  diario.forEach((valor) => {
    total += valor;
    acumulado.push(total);
  });

  const realizado = acumulado.map((valor, indice) => (indice < diaCorte ? valor : null));
  const rotaMeta = diario.map((_, indice) => (meta / Math.max(diario.length, 1)) * (indice + 1));
  const rotaSuper = diario.map((_, indice) => ((meta * 1.2) / Math.max(diario.length, 1)) * (indice + 1));
  const rotaMega = diario.map((_, indice) => ((meta * 1.3) / Math.max(diario.length, 1)) * (indice + 1));
  const linhaProjecao = diario.map(() => null);

  if (mostrarProjecao && diaCorte > 0) {
    linhaProjecao[diaCorte - 1] = acumulado[diaCorte - 1] || 0;
    linhaProjecao[diario.length - 1] = projecao;
  }

  const maximo = Math.max(...acumulado, projecao || 0, meta * 1.3, 1);

  return (
    <div className={styles.chartBox}>
      <svg viewBox="0 0 720 250" role="img" aria-label="Jornada acumulada do mês">
        {[0, 0.25, 0.5, 0.75, 1].map((proporcao) => {
          const y = 216 - proporcao * 182;
          return (
            <g key={proporcao}>
              <line x1="34" x2="686" y1={y} y2={y} className={styles.gridLine} />
              <text x="3" y={y + 4} className={styles.axisLabel}>
                {compacto.format(maximo * proporcao)}
              </text>
            </g>
          );
        })}
        <path className={styles.megaLine} d={caminhoLinha(rotaMega, maximo)} />
        <path className={styles.superLine} d={caminhoLinha(rotaSuper, maximo)} />
        <path className={styles.metaLine} d={caminhoLinha(rotaMeta, maximo)} />
        {mostrarProjecao && (
          <path className={styles.projectionLine} d={caminhoLinha(linhaProjecao, maximo)} />
        )}
        <path className={styles.salesLine} d={caminhoLinha(realizado, maximo)} />
      </svg>
      <div className={styles.legend}>
        <span><i className={styles.salesDot} /> Realizado</span>
        {mostrarProjecao && <span><i className={styles.projectionDot} /> Projeção</span>}
        <span><i className={styles.metaDot} /> Meta</span>
        <span><i className={styles.superDot} /> Supermeta</span>
        <span><i className={styles.megaDot} /> Megameta</span>
      </div>
    </div>
  );
}

function JornadaNiveis({ vendido, meta, contexto }) {
  const dados = jornada(vendido, meta);

  return (
    <div className={styles.levels}>
      {dados.niveis.map((nivel) => {
        const atingido = nivel.valor > 0 && vendido >= nivel.valor;
        const atual = dados.proximo?.nome === nivel.nome;
        return (
          <div
            className={`${styles.level} ${atingido ? styles.levelDone : ""} ${atual ? styles.levelCurrent : ""}`}
            key={nivel.nome}
          >
            <span>{nivel.simbolo}</span>
            <div>
              <strong>{nivel.nome}</strong>
              <small>{dinheiro.format(nivel.valor)}</small>
            </div>
            <em>
              {contexto === "futuro"
                ? "Planejada"
                : atingido
                  ? "Atingida"
                  : atual
                    ? `Faltam ${dinheiro.format(dados.falta)}`
                    : "Próxima etapa"}
            </em>
          </div>
        );
      })}
    </div>
  );
}

function BarraComparativa({ rotulo, valor, maximo, variante = "vendido" }) {
  return (
    <div className={styles.barRow}>
      <span>{rotulo}</span>
      <div className={styles.barTrack}>
        <i
          className={styles[variante]}
          style={{ width: `${maximo > 0 ? Math.min((valor / maximo) * 100, 100) : 0}%` }}
        />
      </div>
      <b>{compacto.format(valor)}</b>
    </div>
  );
}

export default function FechamentoPainelNovo() {
  const supabase = useMemo(() => createClient(), []);
  const [visivel, setVisivel] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [dados, setDados] = useState(null);
  const [mostrarPendencias, setMostrarPendencias] = useState(false);
  const [tipoTela, setTipoTela] = useState("andamento");

  useEffect(() => {
    let ativo = true;
    supabase.auth.getSession().then(({ data }) => {
      if (ativo) setVisivel(Boolean(data.session));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      setVisivel(Boolean(sessao));
    });

    return () => {
      ativo = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    document.body.classList.toggle("fechamento-print-active", aberto && Boolean(dados));
    return () => document.body.classList.remove("fechamento-print-active");
  }, [aberto, dados]);

  useEffect(() => {
    function sincronizarContexto() {
      const campo = document.querySelector('.top-actions input[type="month"]');
      if (campo?.value) setTipoTela(contextoDoMes(campo.value).tipo);
    }

    sincronizarContexto();
    document.addEventListener("change", sincronizarContexto, true);
    return () => document.removeEventListener("change", sincronizarContexto, true);
  }, []);

  function mesSelecionado() {
    const campo = document.querySelector('.top-actions input[type="month"]');
    if (campo?.value) return campo.value;
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  }

  async function abrirRelatorio() {
    setAberto(true);
    setCarregando(true);
    setErro("");
    setDados(null);
    setMostrarPendencias(false);

    const valorMes = mesSelecionado();
    const contexto = contextoDoMes(valorMes);
    const intervalo = intervaloMes(contexto.ano, contexto.numeroMes);
    const historicos = [contexto.ano - 2, contexto.ano - 1].map((ano) => ({
      ano,
      ...intervaloMes(ano, contexto.numeroMes),
    }));

    const [lojasResp, vendasResp, metasResp, ...historicosResp] = await Promise.all([
      supabase.from("lojas").select("*").eq("ativa", true).order("ordem"),
      supabase
        .from("vendas_diarias")
        .select("data,loja_id,periodo,valor_vendido,observacao")
        .gte("data", intervalo.inicio)
        .lte("data", intervalo.fim)
        .order("data", { ascending: true }),
      supabase
        .from("metas_mensais")
        .select("loja_id,periodo,valor_meta")
        .eq("mes", `${valorMes}-01`),
      ...historicos.map((item) =>
        supabase
          .from("vendas_diarias")
          .select("data,loja_id,periodo,valor_vendido")
          .gte("data", item.inicio)
          .lte("data", item.fim)
          .order("data", { ascending: true }),
      ),
    ]);

    const falha = [lojasResp, vendasResp, metasResp, ...historicosResp].find(
      (resposta) => resposta.error,
    );

    if (falha?.error) {
      setErro(falha.error.message);
      setCarregando(false);
      return;
    }

    const lojas = lojasResp.data || [];
    const vendasMes = vendasResp.data || [];
    const vendas = vendasMes.filter((item) => diaDaData(item.data) <= contexto.diaCorte);
    const metas = metasResp.data || [];
    const totalMeta = somar(metas, "valor_meta");
    const totalVendido = somar(vendas);
    const temMeta = totalMeta > 0;
    const temVendas = vendas.length > 0;
    const diasComLancamento = new Set(vendas.map((item) => item.data)).size;
    const mediaDiaria = contexto.diaCorte > 0 ? totalVendido / contexto.diaCorte : 0;
    const projecao =
      contexto.tipo === "andamento" || contexto.tipo === "ultimo-dia"
        ? mediaDiaria * intervalo.ultimoDia
        : contexto.tipo === "encerrado"
          ? totalVendido
          : 0;
    const jornadaGeral = jornada(totalVendido, totalMeta);
    const necessarioDia =
      jornadaGeral.proximo && contexto.diasRestantes > 0
        ? jornadaGeral.falta / contexto.diasRestantes
        : 0;
    const nivelProjetado = temMeta && projecao > 0
      ? nivelDoResultado(projecao, totalMeta)
      : "Sem projeção";

    const metasPorSlot = new Map(
      metas.map((meta) => [
        `${Number(meta.loja_id)}|${meta.periodo}`,
        Number(meta.valor_meta || 0),
      ]),
    );

    const diario = Array.from({ length: intervalo.ultimoDia }, () => 0);
    vendas.forEach((item) => {
      const dia = diaDaData(item.data);
      if (dia >= 1 && dia <= diario.length) diario[dia - 1] += Number(item.valor_vendido || 0);
    });

    const lojasResumo = lojas
      .map((loja) => {
        const vendasLoja = vendas.filter((item) => Number(item.loja_id) === Number(loja.id));
        const vendido = somar(vendasLoja);
        const metaManha = metasPorSlot.get(`${Number(loja.id)}|manha`) || 0;
        const metaNoite = metasPorSlot.get(`${Number(loja.id)}|noite`) || 0;
        const meta = metaManha + metaNoite;
        const projecaoLoja =
          contexto.tipo === "andamento" || contexto.tipo === "ultimo-dia"
            ? contexto.diaCorte > 0
              ? (vendido / contexto.diaCorte) * intervalo.ultimoDia
              : 0
            : vendido;
        const periodosResumo = periodos.map((periodo) => {
          const vendidoPeriodo = somar(vendasLoja.filter((item) => item.periodo === periodo));
          const metaPeriodo = periodo === "manha" ? metaManha : metaNoite;
          const projecaoPeriodo =
            contexto.tipo === "andamento" || contexto.tipo === "ultimo-dia"
              ? contexto.diaCorte > 0
                ? (vendidoPeriodo / contexto.diaCorte) * intervalo.ultimoDia
                : 0
              : vendidoPeriodo;
          return {
            periodo,
            nome: nomePeriodo(periodo),
            vendido: vendidoPeriodo,
            meta: metaPeriodo,
            percentual: percentualDoResultado(vendidoPeriodo, metaPeriodo),
            nivel: nivelDoResultado(vendidoPeriodo, metaPeriodo),
            projecao: projecaoPeriodo,
          };
        });

        return {
          ...loja,
          vendido,
          meta,
          percentual: percentualDoResultado(vendido, meta),
          nivel: nivelDoResultado(vendido, meta),
          projecao: projecaoLoja,
          jornada: jornada(vendido, meta),
          periodos: periodosResumo,
        };
      })
      .sort((a, b) => (b.percentual ?? -1) - (a.percentual ?? -1));

    const turnos = periodos.map((periodo) => {
      const vendasTurno = vendas.filter((item) => item.periodo === periodo);
      const vendido = somar(vendasTurno);
      const meta = somar(metas.filter((item) => item.periodo === periodo), "valor_meta");
      const projecaoTurno =
        contexto.tipo === "andamento" || contexto.tipo === "ultimo-dia"
          ? contexto.diaCorte > 0
            ? (vendido / contexto.diaCorte) * intervalo.ultimoDia
            : 0
          : vendido;
      const lojasTurno = lojasResumo
        .map((loja) => ({ loja, dados: loja.periodos.find((item) => item.periodo === periodo) }))
        .sort((a, b) => (b.dados?.percentual ?? -1) - (a.dados?.percentual ?? -1));
      return {
        periodo,
        nome: nomePeriodo(periodo),
        vendido,
        meta,
        percentual: percentualDoResultado(vendido, meta),
        nivel: nivelDoResultado(vendido, meta),
        projecao: projecaoTurno,
        lider: lojasTurno[0] || null,
        atencao: lojasTurno.at(-1) || null,
      };
    });

    const chavesPreenchidas = new Set(
      vendas.map((item) => `${item.data}|${Number(item.loja_id)}|${item.periodo}`),
    );
    const pendencias = [];
    if (contexto.tipo !== "futuro") {
      for (let dia = 1; dia <= contexto.diaCorte; dia += 1) {
        const data = dataDoDia(contexto.ano, contexto.numeroMes, dia);
        periodos.forEach((periodo) => {
          lojas.forEach((loja) => {
            const chave = `${data}|${Number(loja.id)}|${periodo}`;
            if (!chavesPreenchidas.has(chave)) {
              pendencias.push({ data, loja, periodo });
            }
          });
        });
      }
    }

    const corteHistorico = contexto.tipo === "futuro" ? intervalo.ultimoDia : contexto.diaCorte;
    const historico = historicos.map((item, indice) => {
      const lista = (historicosResp[indice]?.data || []).filter(
        (venda) => diaDaData(venda.data) <= corteHistorico,
      );
      return { ano: item.ano, total: somar(lista) };
    });
    historico.push({ ano: contexto.ano, total: totalVendido });

    const anterior = historico.find((item) => item.ano === contexto.ano - 1)?.total || 0;
    const comparacaoAnterior = variacao(totalVendido, anterior);
    const caixasNaoAbertos = vendas.filter(
      (item) => Number(item.valor_vendido || 0) === 0,
    ).length;
    const lojasAbaixo = lojasResumo.filter((loja) => loja.meta > 0 && (loja.percentual ?? 0) < 100);
    const lojasMeta = lojasResumo.filter((loja) => (loja.percentual ?? -1) >= 100);
    const periodosAbaixo = lojasResumo.flatMap((loja) =>
      loja.periodos
        .filter((item) => item.meta > 0 && (item.percentual ?? 0) < 100)
        .map((item) => `${loja.codigo} ${item.nome}`),
    );
    const periodosMeta = lojasResumo.flatMap((loja) =>
      loja.periodos
        .filter((item) => (item.percentual ?? -1) >= 100)
        .map((item) => `${loja.codigo} ${item.nome}`),
    );

    const insights = [];
    if (contexto.tipo === "futuro") {
      insights.push(
        temMeta
          ? `As metas do mês somam ${dinheiro.format(totalMeta)} e já podem orientar escala e prioridades.`
          : "O mês ainda não começou e as metas precisam ser cadastradas antes da abertura.",
      );
      const referencia = historico.find((item) => item.ano === contexto.ano - 1);
      if (referencia?.total > 0) {
        insights.push(`O mesmo mês do ano anterior fechou em ${dinheiro.format(referencia.total)}.`);
      }
      insights.push("Projeções e ritmo serão apresentados somente após os primeiros lançamentos.");
    } else if (contexto.tipo === "encerrado") {
      insights.push(
        temMeta
          ? `O mês encerrou em ${percentual.format(percentualDoResultado(totalVendido, totalMeta) || 0)}% da Meta, com resultado final em ${nivelDoResultado(totalVendido, totalMeta)}.`
          : `O mês encerrou com ${dinheiro.format(totalVendido)}, sem meta cadastrada para avaliar o atingimento.`,
      );
      if (lojasAbaixo.length) {
        insights.push(`${lojasAbaixo.map((loja) => loja.codigo).join(", ")} encerraram abaixo da Meta.`);
      } else if (temMeta) {
        insights.push("Todas as lojas encerraram com pelo menos 100% da Meta.");
      }
      if (periodosAbaixo.length) {
        insights.push(`Períodos abaixo da Meta: ${periodosAbaixo.join(", ")}.`);
      } else if (periodosMeta.length) {
        insights.push("Todos os períodos cadastrados atingiram a Meta.");
      }
      if (comparacaoAnterior !== null) {
        insights.push(`O resultado ficou ${percentual.format(Math.abs(comparacaoAnterior))}% ${comparacaoAnterior >= 0 ? "acima" : "abaixo"} do mesmo mês de ${contexto.ano - 1}.`);
      }
    } else {
      if (!temMeta) {
        insights.push("O mês está em andamento, mas ainda não há metas cadastradas para orientar o esforço.");
      } else if (!temVendas) {
        insights.push("As metas estão cadastradas; o painel aguarda os primeiros lançamentos do mês.");
      } else if (jornadaGeral.proximo) {
        insights.push(`Faltam ${dinheiro.format(jornadaGeral.falta)} para a ${jornadaGeral.proximo.nome}.`);
        insights.push(`Mantido o ritmo atual, o fechamento projetado é ${dinheiro.format(projecao)} — ${nivelProjetado}.`);
      } else {
        insights.push("A Megameta já foi atingida; o foco agora é sustentar o resultado até o fechamento.");
      }
      if (lojasResumo[0]?.percentual !== null) {
        insights.push(`${lojasResumo[0].codigo} lidera com ${percentual.format(lojasResumo[0].percentual || 0)}% da Meta.`);
      }
      const piorPeriodo = lojasResumo
        .flatMap((loja) => loja.periodos.map((item) => ({ ...item, codigo: loja.codigo })))
        .filter((item) => item.meta > 0)
        .sort((a, b) => (a.percentual ?? 0) - (b.percentual ?? 0))[0];
      if (piorPeriodo) {
        insights.push(`${piorPeriodo.codigo} ${piorPeriodo.nome} é o período mais distante da Meta no momento.`);
      }
    }

    setDados({
      valorMes,
      contexto,
      tituloMes: `${meses[contexto.numeroMes - 1]} de ${contexto.ano}`,
      lojas,
      vendas,
      metas,
      totalMeta,
      totalVendido,
      temMeta,
      temVendas,
      mediaDiaria,
      projecao,
      nivelProjetado,
      jornadaGeral,
      necessarioDia,
      diasComLancamento,
      diario,
      lojasResumo,
      turnos,
      historico,
      comparacaoAnterior,
      pendencias,
      caixasNaoAbertos,
      lojasAbaixo,
      lojasMeta,
      periodosAbaixo,
      periodosMeta,
      insights: insights.slice(0, 4),
    });
    setCarregando(false);
  }

  function fechar() {
    setAberto(false);
    setErro("");
    setDados(null);
    setMostrarPendencias(false);
  }

  function irAoCalendario() {
    const botao = Array.from(document.querySelectorAll("nav.tabs button")).find(
      (item) => item.textContent?.trim() === "Lançar vendas",
    );
    botao?.click();
    setAberto(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!visivel) return null;

  const contextoAtual = dados?.contexto?.tipo || tipoTela;
  const textoBotao =
    contextoAtual === "futuro"
      ? "Planejamento do mês"
      : contextoAtual === "encerrado"
        ? "Fechamento do mês"
        : "Prévia do mês";

  const maximoLojas = dados
    ? Math.max(...dados.lojasResumo.flatMap((loja) => [loja.vendido, loja.meta * 1.3, loja.projecao]), 1)
    : 1;
  const maximoHistorico = dados ? Math.max(...dados.historico.map((item) => item.total), 1) : 1;
  const pendenciasPorDia = dados?.pendencias.reduce((mapa, item) => {
    if (!mapa.has(item.data)) mapa.set(item.data, []);
    mapa.get(item.data).push(item);
    return mapa;
  }, new Map()) || new Map();

  return (
    <>
      <button type="button" className={styles.launcher} onClick={abrirRelatorio}>
        {textoBotao}
      </button>

      {aberto && (
        <div className={styles.backdrop} id="fechamento-impressao">
          <section className={styles.modal}>
            <div className={styles.modalHeader}>
              <div>
                <p>
                  {dados?.contexto.tipo === "encerrado"
                    ? "FECHAMENTO CONSOLIDADO"
                    : dados?.contexto.tipo === "futuro"
                      ? "PLANEJAMENTO MENSAL"
                      : "PRÉVIA GERENCIAL"}
                </p>
                <h2>{dados?.tituloMes || "Preparando relatório"}</h2>
              </div>
              <button type="button" onClick={fechar} aria-label="Fechar">×</button>
            </div>

            {carregando && <div className={styles.loading}>Atualizando os indicadores do painel...</div>}
            {erro && <div className={styles.error}>{erro}</div>}

            {!carregando && !erro && dados && (
              <div className={styles.report}>
                {dados.pendencias.length > 0 && (
                  <section className={styles.warning}>
                    <div>
                      <strong>
                        {dados.contexto.tipo === "encerrado"
                          ? "Fechamento com lançamentos pendentes"
                          : "Prévia com lançamentos pendentes"}
                      </strong>
                      <span>
                        Faltam {dados.pendencias.length} lançamentos em {pendenciasPorDia.size} dias. Os totais podem mudar após a conferência.
                      </span>
                    </div>
                    <div className={styles.warningActions}>
                      <button type="button" onClick={() => setMostrarPendencias((valor) => !valor)}>
                        {mostrarPendencias ? "Ocultar pendências" : "Ver pendências"}
                      </button>
                      <button type="button" onClick={irAoCalendario}>Ir aos lançamentos</button>
                    </div>
                    {mostrarPendencias && (
                      <div className={styles.pendingList}>
                        {Array.from(pendenciasPorDia.entries()).slice(0, 12).map(([data, itens]) => (
                          <article key={data}>
                            <strong>{new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</strong>
                            <span>{itens.map((item) => `${item.loja.codigo} ${nomePeriodo(item.periodo)}`).join(" · ")}</span>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                <section className={styles.hero}>
                  <div className={styles.heroTop}>
                    <div>
                      <span>
                        {dados.contexto.tipo === "futuro"
                          ? "Meta planejada"
                          : dados.contexto.tipo === "encerrado"
                            ? "Resultado final"
                            : "Resultado atual"}
                      </span>
                      <strong>
                        {dados.contexto.tipo === "futuro"
                          ? dinheiro.format(dados.totalMeta)
                          : dinheiro.format(dados.totalVendido)}
                      </strong>
                      <small>
                        {dados.contexto.tipo === "futuro"
                          ? dados.temMeta
                            ? "Objetivo total cadastrado"
                            : "Metas ainda não cadastradas"
                          : dados.temMeta
                            ? `${percentual.format(percentualDoResultado(dados.totalVendido, dados.totalMeta) || 0)}% da Meta`
                            : "Sem meta para comparação"}
                      </small>
                    </div>
                    <div className={`${styles.resultBadge} ${styles[classeNivel(dados.contexto.tipo === "futuro" ? "Sem meta cadastrada" : dados.jornadaGeral.nivel)]}`}>
                      {dados.contexto.tipo === "futuro"
                        ? dados.temMeta
                          ? "Planejamento pronto"
                          : "Aguardando metas"
                        : dados.jornadaGeral.nivel}
                    </div>
                  </div>

                  {dados.contexto.tipo !== "futuro" && dados.temMeta && (
                    <div className={styles.activeGoal}>
                      <div>
                        <strong>
                          {dados.jornadaGeral.proximo
                            ? `Rumo à ${dados.jornadaGeral.proximo.nome}`
                            : "Megameta conquistada"}
                        </strong>
                        <b>
                          {dados.jornadaGeral.proximo
                            ? `Faltam ${dinheiro.format(dados.jornadaGeral.falta)}`
                            : "Nível máximo atingido"}
                        </b>
                      </div>
                      <i><span style={{ width: `${dados.jornadaGeral.progressoEtapa}%` }} /></i>
                    </div>
                  )}

                  <JornadaNiveis
                    vendido={dados.contexto.tipo === "futuro" ? 0 : dados.totalVendido}
                    meta={dados.totalMeta}
                    contexto={dados.contexto.tipo}
                  />
                </section>

                <section className={styles.kpis}>
                  <article>
                    <span>{dados.contexto.tipo === "encerrado" ? "Total vendido" : "Vendido até agora"}</span>
                    <strong>{dinheiro.format(dados.totalVendido)}</strong>
                    <small>{dados.diasComLancamento} dias com lançamento</small>
                  </article>
                  <article>
                    <span>
                      {dados.contexto.tipo === "encerrado"
                        ? "Nível final"
                        : dados.contexto.tipo === "futuro"
                          ? "Meta cadastrada"
                          : "Projeção de fechamento"}
                    </span>
                    <strong>
                      {dados.contexto.tipo === "encerrado"
                        ? dados.jornadaGeral.nivel
                        : dados.contexto.tipo === "futuro"
                          ? dinheiro.format(dados.totalMeta)
                          : dinheiro.format(dados.projecao)}
                    </strong>
                    <small>
                      {dados.contexto.tipo === "andamento" || dados.contexto.tipo === "ultimo-dia"
                        ? `Projeção: ${dados.nivelProjetado}`
                        : dados.contexto.tipo === "encerrado"
                          ? "Resultado consolidado"
                          : "Antes da abertura"}
                    </small>
                  </article>
                  <article>
                    <span>Média diária</span>
                    <strong>
                      {dados.contexto.tipo === "futuro" ? "—" : dinheiro.format(dados.mediaDiaria)}
                    </strong>
                    <small>
                      {dados.contexto.tipo === "futuro"
                        ? "Disponível após o início"
                        : `Considerando ${dados.contexto.diaCorte} dias do mês`}
                    </small>
                  </article>
                  <article>
                    <span>
                      {dados.contexto.tipo === "andamento" || dados.contexto.tipo === "ultimo-dia"
                        ? dados.jornadaGeral.proximo
                          ? `Necessário/dia para ${dados.jornadaGeral.proximo.nome}`
                          : "Megameta atingida"
                        : dados.contexto.tipo === "encerrado"
                          ? "Caixas não abertos"
                          : "Referência histórica"}
                    </span>
                    <strong>
                      {dados.contexto.tipo === "andamento" || dados.contexto.tipo === "ultimo-dia"
                        ? dados.jornadaGeral.proximo
                          ? dinheiro.format(dados.necessarioDia)
                          : "Conquistada"
                        : dados.contexto.tipo === "encerrado"
                          ? dados.caixasNaoAbertos
                          : dinheiro.format(dados.historico.find((item) => item.ano === dados.contexto.ano - 1)?.total || 0)}
                    </strong>
                    <small>
                      {dados.contexto.tipo === "andamento" || dados.contexto.tipo === "ultimo-dia"
                        ? `${dados.contexto.diasRestantes} dias restantes`
                        : dados.contexto.tipo === "encerrado"
                          ? "Registros com venda zerada"
                          : `Mesmo mês de ${dados.contexto.ano - 1}`}
                    </small>
                  </article>
                </section>

                {dados.contexto.tipo !== "futuro" && dados.temVendas && (
                  <section className={styles.reportSection}>
                    <div className={styles.sectionHeader}>
                      <div><p>JORNADA DO MÊS</p><h3>Realizado, projeção e níveis</h3></div>
                    </div>
                    <GraficoJornada
                      diario={dados.diario}
                      meta={dados.totalMeta}
                      diaCorte={dados.contexto.diaCorte}
                      projecao={dados.projecao}
                      mostrarProjecao={dados.contexto.tipo === "andamento" || dados.contexto.tipo === "ultimo-dia"}
                    />
                  </section>
                )}

                <section className={styles.reportSection}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <p>COMPARATIVO DAS LOJAS</p>
                      <h3>
                        {dados.contexto.tipo === "encerrado"
                          ? "Resultado final por loja"
                          : dados.contexto.tipo === "futuro"
                            ? "Distribuição das metas"
                            : "Vendido, próximo nível e projeção"}
                      </h3>
                    </div>
                  </div>
                  <div className={styles.storeList}>
                    {dados.lojasResumo.map((loja, indice) => (
                      <article className={styles.storeCard} key={loja.id}>
                        <div className={styles.storeHeading}>
                          <span>{indice + 1}</span>
                          <div>
                            <strong>{loja.codigo} — {loja.nome}</strong>
                            <small>
                              {dados.contexto.tipo === "futuro"
                                ? `Meta total: ${dinheiro.format(loja.meta)}`
                                : loja.percentual === null
                                  ? "Sem meta cadastrada"
                                  : `${percentual.format(loja.percentual)}% da Meta · ${loja.nivel}`}
                            </small>
                          </div>
                          <b>
                            {dados.contexto.tipo === "futuro"
                              ? dinheiro.format(loja.meta)
                              : dinheiro.format(loja.vendido)}
                          </b>
                        </div>

                        {dados.contexto.tipo !== "futuro" && (
                          <div className={styles.storeBars}>
                            <BarraComparativa rotulo="Vendido" valor={loja.vendido} maximo={maximoLojas} variante="vendido" />
                            <BarraComparativa
                              rotulo={loja.jornada.proximo?.nome || "Megameta"}
                              valor={loja.jornada.proximo?.valor || loja.meta * 1.3}
                              maximo={maximoLojas}
                              variante="metaBar"
                            />
                            {(dados.contexto.tipo === "andamento" || dados.contexto.tipo === "ultimo-dia") && (
                              <BarraComparativa rotulo="Projeção" valor={loja.projecao} maximo={maximoLojas} variante="projectionBar" />
                            )}
                          </div>
                        )}

                        <div className={styles.periodGrid}>
                          {loja.periodos.map((item) => (
                            <div key={item.periodo}>
                              <span>{item.nome}</span>
                              <strong>
                                {dados.contexto.tipo === "futuro"
                                  ? dinheiro.format(item.meta)
                                  : dinheiro.format(item.vendido)}
                              </strong>
                              <small>
                                {dados.contexto.tipo === "futuro"
                                  ? "Meta planejada"
                                  : item.percentual === null
                                    ? "Sem meta"
                                    : `${percentual.format(item.percentual)}% · ${item.nivel}`}
                              </small>
                            </div>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <section className={styles.twoColumns}>
                  <article className={styles.reportSection}>
                    <div className={styles.sectionHeader}>
                      <div><p>PERÍODOS</p><h3>Manhã × noite</h3></div>
                    </div>
                    <div className={styles.turnosGrid}>
                      {dados.turnos.map((turno) => (
                        <div key={turno.periodo}>
                          <header>
                            <strong>{turno.nome}</strong>
                            <b>
                              {dados.contexto.tipo === "futuro"
                                ? dinheiro.format(turno.meta)
                                : turno.percentual === null
                                  ? turno.nivel
                                  : `${percentual.format(turno.percentual)}%`}
                            </b>
                          </header>
                          <p>
                            {dados.contexto.tipo === "futuro" ? "Meta" : "Vendido"}: {" "}
                            <strong>{dinheiro.format(dados.contexto.tipo === "futuro" ? turno.meta : turno.vendido)}</strong>
                          </p>
                          {dados.contexto.tipo !== "futuro" && (
                            <>
                              <p>Nível: <strong>{turno.nivel}</strong></p>
                              {(dados.contexto.tipo === "andamento" || dados.contexto.tipo === "ultimo-dia") && (
                                <p>Projeção: <strong>{dinheiro.format(turno.projecao)}</strong></p>
                              )}
                              <small>
                                Liderança: {turno.lider?.loja?.codigo || "—"} · Atenção: {turno.atencao?.loja?.codigo || "—"}
                              </small>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className={styles.reportSection}>
                    <div className={styles.sectionHeader}>
                      <div><p>COMPARATIVO HISTÓRICO</p><h3>Mesmo mês, mesma referência</h3></div>
                    </div>
                    <div className={styles.historyBars}>
                      {dados.historico.map((item) => (
                        <div key={item.ano}>
                          <span>{item.ano}</span>
                          <i><b style={{ width: `${Math.max((item.total / maximoHistorico) * 100, item.total > 0 ? 2 : 0)}%` }} /></i>
                          <strong>{dinheiro.format(item.total)}</strong>
                        </div>
                      ))}
                    </div>
                    {dados.comparacaoAnterior !== null && dados.contexto.tipo !== "futuro" && (
                      <p className={styles.historyNote}>
                        {percentual.format(Math.abs(dados.comparacaoAnterior))}% {dados.comparacaoAnterior >= 0 ? "acima" : "abaixo"} de {dados.contexto.ano - 1}.
                      </p>
                    )}
                  </article>
                </section>

                <section className={styles.reportSection}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <p>LEITURA GERENCIAL</p>
                      <h3>
                        {dados.contexto.tipo === "encerrado"
                          ? "Conclusões do fechamento"
                          : dados.contexto.tipo === "futuro"
                            ? "Orientações para a abertura"
                            : "Prioridades da prévia"}
                      </h3>
                    </div>
                  </div>
                  <div className={styles.insights}>
                    {dados.insights.map((insight, indice) => (
                      <article key={`${indice}-${insight}`}>
                        <span>{indice + 1}</span>
                        <p>{insight}</p>
                      </article>
                    ))}
                  </div>
                </section>

                <div className={styles.actionsNoPrint}>
                  <button type="button" className={styles.secondary} onClick={fechar}>Fechar</button>
                  {dados.pendencias.length > 0 && (
                    <button type="button" className={styles.secondary} onClick={irAoCalendario}>Corrigir lançamentos</button>
                  )}
                  <button type="button" className={styles.primary} onClick={() => window.print()}>
                    {dados.contexto.tipo === "encerrado" ? "Imprimir / salvar PDF" : "Salvar prévia em PDF"}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
