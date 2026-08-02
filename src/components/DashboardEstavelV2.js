"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  minutosDoHorario,
  useHorariosPeriodos,
} from "@/lib/horariosPeriodos";
import styles from "./DashboardEstavelV2.module.css";

const dinheiro = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const compacto = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const nomesMeses = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function somar(lista, campo = "valor_vendido") {
  return lista.reduce((total, item) => total + Number(item?.[campo] || 0), 0);
}

function porcentagem(valor, base) {
  return base > 0 ? (valor / base) * 100 : 0;
}

function textoPercentual(valor) {
  return `${Number(valor || 0).toFixed(1).replace(".", ",")}%`;
}

function diaDaData(data) {
  return Number(String(data).slice(8, 10));
}

function intervaloMes(ano, mes) {
  const mesTexto = String(mes).padStart(2, "0");
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return {
    inicio: `${ano}-${mesTexto}-01`,
    fim: `${ano}-${mesTexto}-${String(ultimoDia).padStart(2, "0")}`,
  };
}

function nivelFechado(vendido, metaBase) {
  if (!(metaBase > 0)) return "Sem meta cadastrada";
  if (vendido >= metaBase * 1.2) return "Megameta";
  if (vendido >= metaBase * 1.1) return "Supermeta";
  if (vendido >= metaBase) return "Meta";
  return "abaixo da Meta";
}

function calcularJornada(vendido, metaBase) {
  const niveis = [
    { nome: "Meta", valor: metaBase, simbolo: "★" },
    { nome: "Supermeta", valor: metaBase * 1.1, simbolo: "◆" },
    { nome: "Megameta", valor: metaBase * 1.2, simbolo: "♛" },
  ];

  if (!(metaBase > 0)) {
    return { niveis, alvo: niveis[0], progresso: 0, falta: 0, completa: false, semMeta: true };
  }

  const pendente = niveis.findIndex((nivel) => vendido < nivel.valor);
  if (pendente === -1) {
    return { niveis, alvo: niveis[2], progresso: 100, falta: 0, completa: true, semMeta: false };
  }

  const alvo = niveis[pendente];
  const anterior = pendente > 0 ? niveis[pendente - 1].valor : 0;
  const faixa = Math.max(alvo.valor - anterior, 1);

  return {
    niveis,
    alvo,
    progresso: Math.max(0, Math.min(((vendido - anterior) / faixa) * 100, 100)),
    falta: Math.max(alvo.valor - vendido, 0),
    completa: false,
    semMeta: false,
  };
}

function larguraBarra(valor, maximo) {
  if (!maximo || valor <= 0) return "0%";
  return `${Math.min((valor / maximo) * 100, 100)}%`;
}

function caminho(valores, maximo, largura = 700, altura = 250, margem = 34) {
  const pontos = [];
  const divisorX = Math.max(valores.length - 1, 1);
  const areaLargura = largura - margem * 2;
  const areaAltura = altura - margem * 2;

  valores.forEach((valor, indice) => {
    if (valor === null || valor === undefined || !Number.isFinite(Number(valor))) return;
    const x = margem + (indice / divisorX) * areaLargura;
    const y = altura - margem - (Number(valor) / Math.max(maximo, 1)) * areaAltura;
    pontos.push(`${pontos.length ? "L" : "M"} ${x.toFixed(2)} ${y.toFixed(2)}`);
  });

  return pontos.join(" ");
}

function GraficoAcumulado({ dados, maximo }) {
  const marcasX = [1, 8, 15, 22, dados.length].filter(
    (valor, indice, lista) => valor <= dados.length && lista.indexOf(valor) === indice,
  );

  return (
    <div className={styles.chartArea}>
      <svg className={styles.lineChart} viewBox="0 0 700 250" role="img" aria-label="Evolução acumulada das vendas e metas">
        {[0, 0.25, 0.5, 0.75, 1].map((proporcao) => {
          const y = 216 - proporcao * 182;
          return (
            <g key={proporcao}>
              <line className={styles.gridLine} x1="34" x2="666" y1={y} y2={y} />
              <text className={styles.axisLabel} x="3" y={y + 4}>{compacto.format(maximo * proporcao)}</text>
            </g>
          );
        })}
        {marcasX.map((dia) => {
          const x = 34 + ((dia - 1) / Math.max(dados.length - 1, 1)) * 632;
          return <text className={styles.axisLabel} x={x} y="240" textAnchor="middle" key={dia}>{dia}</text>;
        })}
        <path className={styles.lineMega} d={caminho(dados.map((item) => item.megameta), maximo)} />
        <path className={styles.lineSuper} d={caminho(dados.map((item) => item.supermeta), maximo)} />
        <path className={styles.lineMeta} d={caminho(dados.map((item) => item.meta), maximo)} />
        <path className={styles.lineProjection} d={caminho(dados.map((item) => item.projecao), maximo)} />
        <path className={styles.lineReal} d={caminho(dados.map((item) => item.realizado), maximo)} />
      </svg>
      <div className={styles.legend}>
        <span><i /> Realizado</span><span><i className={styles.projection} /> Projeção</span>
        <span><i className={styles.meta} /> Meta</span><span><i className={styles.super} /> Supermeta</span>
        <span><i className={styles.mega} /> Megameta</span>
      </div>
    </div>
  );
}

function textoNivel(nivel, vendido, encerrado, diasRestantes) {
  const falta = Math.max(nivel.valor - vendido, 0);
  if (!(nivel.valor > 0)) return "Sem meta";
  if (vendido >= nivel.valor) return encerrado ? "Conquistada" : "Batida";
  if (encerrado) return `Faltaram ${dinheiro.format(falta)}`;
  if (diasRestantes > 0) return `${dinheiro.format(falta / diasRestantes)}/dia`;
  return `Faltam ${dinheiro.format(falta)}`;
}

function Niveis({ vendido, jornada, encerrado = false, diasRestantes = 0, compacto: compactoVisual = false }) {
  return (
    <div className={compactoVisual ? styles.levelsCompact : styles.levels}>
      {jornada.niveis.map((nivel) => {
        const batida = nivel.valor > 0 && vendido >= nivel.valor;
        const atual = !encerrado && !jornada.completa && nivel.nome === jornada.alvo.nome;
        return (
          <div className={`${styles.level} ${batida ? styles.levelDone : ""} ${atual ? styles.levelCurrent : ""}`} key={nivel.nome}>
            <span>{nivel.simbolo}</span>
            <div><strong>{nivel.nome}</strong><small>{dinheiro.format(nivel.valor)}</small></div>
            <em>{textoNivel(nivel, vendido, encerrado, diasRestantes)}</em>
          </div>
        );
      })}
    </div>
  );
}

function PeriodoDetalhe({ periodo, encerrado }) {
  return (
    <article className={styles.periodCard}>
      <div className={styles.periodHeader}>
        <div><span>{periodo.nome}</span><strong>{dinheiro.format(periodo.vendido)}</strong></div>
        <b>{textoPercentual(periodo.percentual)}</b>
      </div>
      <div className={styles.periodSummary}>
        <span>Meta: {dinheiro.format(periodo.meta)}</span>
        <span>{encerrado ? `Fechou em ${nivelFechado(periodo.vendido, periodo.meta)}` : `Projeção: ${dinheiro.format(periodo.projecao)}`}</span>
      </div>
      <Niveis vendido={periodo.vendido} jornada={periodo.jornada} encerrado={encerrado} diasRestantes={periodo.diasRestantes} compacto />
    </article>
  );
}

export default function DashboardEstavelV2({ mes, vendas, metas, lojas }) {
  const supabase = useMemo(() => createClient(), []);
  const horarios = useHorariosPeriodos();
  const [historicoAnterior, setHistoricoAnterior] = useState([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);
  const [filtroLoja, setFiltroLoja] = useState("geral");
  const [filtroPeriodo, setFiltroPeriodo] = useState("todos");
  const [lojaAberta, setLojaAberta] = useState(null);

  useEffect(() => {
    let cancelado = false;
    async function carregarHistorico() {
      const [ano, numeroMes] = mes.split("-").map(Number);
      setCarregandoHistorico(true);
      const respostas = await Promise.all([ano - 2, ano - 1].map((anoHistorico) => {
        const intervalo = intervaloMes(anoHistorico, numeroMes);
        return supabase.from("vendas_diarias").select("data,loja_id,periodo,valor_vendido")
          .gte("data", intervalo.inicio).lte("data", intervalo.fim).order("data", { ascending: true });
      }));
      if (cancelado) return;
      setHistoricoAnterior(respostas.flatMap((resposta) => resposta.data || []));
      setCarregandoHistorico(false);
    }
    carregarHistorico();
    return () => { cancelado = true; };
  }, [mes, supabase]);

  const dados = useMemo(() => {
    const [ano, numeroMes] = mes.split("-").map(Number);
    const agora = new Date();
    const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
    const fimManha = minutosDoHorario(horarios.manhaFim);
    const fimNoite = Math.max(
      minutosDoHorario(horarios.manhaFim),
      minutosDoHorario(horarios.noiteFim),
    );
    const totalDias = new Date(ano, numeroMes, 0).getDate();
    const mesAtual = ano === agora.getFullYear() && numeroMes === agora.getMonth() + 1;
    const mesPassado = ano < agora.getFullYear() || (ano === agora.getFullYear() && numeroMes < agora.getMonth() + 1);
    const mesFuturo = !mesAtual && !mesPassado;
    const diaCorte = mesAtual ? Math.min(agora.getDate(), totalDias) : mesPassado ? totalDias : 0;
    const diasDepoisHoje = mesAtual ? Math.max(totalDias - diaCorte, 0) : mesFuturo ? totalDias : 0;
    const diasRestantesGeral = mesPassado ? 0 : mesFuturo ? totalDias : diasDepoisHoje + (minutosAgora < fimNoite ? 1 : 0);
    const diasRestantesManha = mesPassado ? 0 : mesFuturo ? totalDias : diasDepoisHoje + (minutosAgora < fimManha ? 1 : 0);
    const diasRestantesNoite = mesPassado ? 0 : mesFuturo ? totalDias : diasDepoisHoje + (minutosAgora < fimNoite ? 1 : 0);

    const dias = Array.from({ length: totalDias }, () => 0);
    const porLoja = new Map();
    const diasLancados = new Set();
    let totalVendido = 0;
    let totalManha = 0;
    let totalNoite = 0;

    lojas.forEach((loja) => porLoja.set(Number(loja.id), { ...loja, vendido: 0, meta: 0, manha: 0, noite: 0, metaManha: 0, metaNoite: 0 }));

    vendas.forEach((venda) => {
      const valor = Number(venda.valor_vendido || 0);
      const dia = diaDaData(venda.data);
      const loja = porLoja.get(Number(venda.loja_id));
      totalVendido += valor;
      diasLancados.add(venda.data);
      if (dia >= 1 && dia <= totalDias) dias[dia - 1] += valor;
      if (venda.periodo === "manha") totalManha += valor;
      if (venda.periodo === "noite") totalNoite += valor;
      if (loja) {
        loja.vendido += valor;
        if (venda.periodo === "manha") loja.manha += valor;
        if (venda.periodo === "noite") loja.noite += valor;
      }
    });

    metas.forEach((metaItem) => {
      const valor = Number(metaItem.valor_meta || 0);
      const loja = porLoja.get(Number(metaItem.loja_id));
      if (!loja) return;
      loja.meta += valor;
      if (metaItem.periodo === "manha") loja.metaManha += valor;
      if (metaItem.periodo === "noite") loja.metaNoite += valor;
    });

    const meta = somar(metas, "valor_meta");
    const supermeta = meta * 1.1;
    const megameta = meta * 1.2;
    const jornada = calcularJornada(totalVendido, meta);
    const media = diaCorte > 0 ? totalVendido / diaCorte : 0;
    const projecao = mesPassado ? totalVendido : diaCorte > 0 ? media * totalDias : 0;
    const necessarioDia = diasRestantesGeral > 0 ? jornada.falta / diasRestantesGeral : 0;

    let acumulado = 0;
    const acumuladoGeral = dias.map((valor, indice) => {
      acumulado += valor;
      const dia = indice + 1;
      return {
        realizado: dia <= diaCorte ? acumulado : null,
        projecao: diaCorte > 0 && dia >= diaCorte ? totalVendido + media * (dia - diaCorte) : null,
        meta: meta ? (meta / totalDias) * dia : 0,
        supermeta: supermeta ? (supermeta / totalDias) * dia : 0,
        megameta: megameta ? (megameta / totalDias) * dia : 0,
      };
    });

    const criarPeriodo = (nome, vendido, metaPeriodo, diasRestantes) => ({
      nome,
      vendido,
      meta: metaPeriodo,
      percentual: porcentagem(vendido, metaPeriodo),
      projecao: mesPassado ? vendido : diaCorte > 0 ? (vendido / diaCorte) * totalDias : 0,
      jornada: calcularJornada(vendido, metaPeriodo),
      diasRestantes,
    });

    const lojasDetalhadas = [...porLoja.values()].map((loja) => ({
      ...loja,
      percentual: porcentagem(loja.vendido, loja.meta),
      projecao: mesPassado ? loja.vendido : diaCorte > 0 ? (loja.vendido / diaCorte) * totalDias : 0,
      jornada: calcularJornada(loja.vendido, loja.meta),
      diasRestantes: diasRestantesGeral,
      periodos: [
        criarPeriodo("Manhã", loja.manha, loja.metaManha, diasRestantesManha),
        criarPeriodo("Noite", loja.noite, loja.metaNoite, diasRestantesNoite),
      ],
    }));

    const ranking = [...lojasDetalhadas].sort((a, b) => b.percentual - a.percentual);
    const nivelProjetado = megameta > 0 && projecao >= megameta ? "Megameta" : supermeta > 0 && projecao >= supermeta ? "Supermeta" : meta > 0 && projecao >= meta ? "Meta" : "abaixo da Meta";
    const maiorGrafico = Math.max(megameta, projecao, totalVendido, ...acumuladoGeral.flatMap((item) => [item.realizado || 0, item.projecao || 0, item.megameta || 0]), 1);

    return {
      ano, numeroMes, totalDias, diaCorte, mesAtual, mesPassado, mesFuturo,
      diasRestantes: diasRestantesGeral, diasRestantesManha, diasRestantesNoite,
      diasLancados: diasLancados.size, totalVendido, totalManha, totalNoite,
      meta, supermeta, megameta, jornada, media, projecao, necessarioDia,
      acumuladoGeral, lojasDetalhadas, ranking, nivelProjetado, maiorGrafico,
      nivelFechado: nivelFechado(totalVendido, meta),
    };
  }, [mes, vendas, metas, lojas, horarios]);

  useEffect(() => { setLojaAberta(null); }, [mes]);

  const comparativoHistorico = useMemo(() => {
    const anos = [dados.ano - 2, dados.ano - 1, dados.ano];
    const filtrar = (lista) => lista.filter((venda) => {
      if (diaDaData(venda.data) > dados.diaCorte) return false;
      if (filtroLoja !== "geral" && Number(venda.loja_id) !== Number(filtroLoja)) return false;
      if (filtroPeriodo !== "todos" && venda.periodo !== filtroPeriodo) return false;
      return true;
    });
    return anos.map((anoItem) => {
      const lista = anoItem === dados.ano ? filtrar(vendas) : filtrar(historicoAnterior.filter((venda) => Number(String(venda.data).slice(0, 4)) === anoItem));
      return { ano: anoItem, total: somar(lista) };
    });
  }, [dados.ano, dados.diaCorte, vendas, historicoAnterior, filtroLoja, filtroPeriodo]);

  const insights = useMemo(() => {
    const lista = [];
    const lider = dados.ranking[0];
    const atual = comparativoHistorico.find((item) => item.ano === dados.ano)?.total || 0;
    const anterior = comparativoHistorico.find((item) => item.ano === dados.ano - 1)?.total || 0;
    const variacao = anterior > 0 ? ((atual - anterior) / anterior) * 100 : null;
    const turno = dados.totalManha >= dados.totalNoite ? "manhã" : "noite";
    const turnoValor = Math.max(dados.totalManha, dados.totalNoite);

    if (dados.mesPassado) lista.push(`O mês fechou em ${dados.nivelFechado}.`);
    else if (dados.jornada.completa) lista.push("Meta, Supermeta e Megameta já foram conquistadas no total do mês.");
    else if (dados.meta > 0) lista.push(`Faltam ${dinheiro.format(dados.jornada.falta)} para a ${dados.jornada.alvo.nome}; são ${dinheiro.format(dados.necessarioDia)} por dia restante.`);
    if (lider) lista.push(`${lider.codigo} lidera o ranking com ${textoPercentual(lider.percentual)} da Meta.`);
    if (dados.totalVendido > 0) lista.push(`O turno da ${turno} representa ${textoPercentual((turnoValor / dados.totalVendido) * 100)} das vendas.`);
    if (variacao !== null) lista.push(`${nomesMeses[dados.numeroMes - 1]} está ${textoPercentual(Math.abs(variacao))} ${variacao >= 0 ? "acima" : "abaixo"} do mesmo período de ${dados.ano - 1}.`);
    return lista;
  }, [dados, comparativoHistorico]);

  const maximoLojas = Math.max(...dados.lojasDetalhadas.flatMap((loja) => [loja.vendido, loja.jornada.alvo.valor, loja.projecao]), 1);
  const maximoPeriodos = Math.max(...dados.lojasDetalhadas.flatMap((loja) => [loja.manha, loja.noite]), 1);
  const maximoHistorico = Math.max(...comparativoHistorico.map((item) => item.total), 1);

  const tituloJornada = dados.mesPassado
    ? `Fechou em ${dados.nivelFechado}`
    : dados.jornada.completa
      ? "Megameta conquistada"
      : `Rumo à ${dados.jornada.alvo.nome}`;

  return (
    <section className={styles.dashboard}>
      <article className={styles.hero}>
        <div className={styles.heroTop}>
          <div>
            <p className={styles.eyebrow}>Jornada do mês</p>
            <h2>{tituloJornada}</h2>
            <p className={styles.subtitle}>
              {dinheiro.format(dados.totalVendido)} vendidos
              {!dados.mesPassado && ` · projeção de ${dinheiro.format(dados.projecao)}`}
            </p>
          </div>
          <span className={styles.status}>
            {dados.mesPassado ? `Resultado final: ${dados.nivelFechado}` : dados.jornada.completa ? "Nível máximo" : `Próximo: ${dados.jornada.alvo.nome}`}
          </span>
        </div>
        <div className={styles.activeGoal}>
          <div className={styles.activeGoalHeader}>
            <strong>{dados.mesPassado ? "Resultado final" : dados.jornada.alvo.nome}</strong>
            <b>{dados.mesPassado ? dados.nivelFechado : dados.jornada.completa ? "Conquistada" : `Faltam ${dinheiro.format(dados.jornada.falta)}`}</b>
          </div>
          <div className={styles.activeTrack}><span style={{ width: `${dados.jornada.progresso}%` }} /></div>
          <small>{dados.mesPassado ? `${textoPercentual(porcentagem(dados.totalVendido, dados.meta))} da Meta` : `${textoPercentual(dados.jornada.progresso)} desta etapa`}</small>
        </div>
        <Niveis vendido={dados.totalVendido} jornada={dados.jornada} encerrado={dados.mesPassado} diasRestantes={dados.diasRestantes} />
      </article>

      <div className={styles.kpiGrid}>
        <article className={styles.kpi}><span>Total vendido</span><strong>{dinheiro.format(dados.totalVendido)}</strong><small>{textoPercentual(porcentagem(dados.totalVendido, dados.meta))} da Meta</small></article>
        <article className={styles.kpi}><span>{dados.mesPassado ? "Resultado final" : "Projeção"}</span><strong>{dados.mesPassado ? dados.nivelFechado : dinheiro.format(dados.projecao)}</strong><small>{dados.mesPassado ? dinheiro.format(dados.totalVendido) : `Fechamento projetado: ${dados.nivelProjetado}`}</small></article>
        <article className={styles.kpi}><span>{dados.mesPassado ? "Fechamento" : dados.jornada.completa ? "Megameta conquistada" : `Necessário para ${dados.jornada.alvo.nome}`}</span><strong>{dados.mesPassado ? dados.nivelFechado : dinheiro.format(dados.necessarioDia)}</strong><small>{dados.mesPassado ? "Mês encerrado" : dados.diasRestantes > 1 ? `${dados.diasRestantes} dias restantes` : "Valor necessário no dia"}</small></article>
        <article className={styles.kpi}><span>Média diária</span><strong>{dinheiro.format(dados.media)}</strong><small>{dados.diasLancados} dias com lançamento</small></article>
      </div>

      <article className={styles.card}>
        <div className={styles.sectionHeader}><div><p className={styles.eyebrow}>Evolução acumulada</p><h2>Realizado, projeção e rotas de meta</h2></div></div>
        <GraficoAcumulado dados={dados.acumuladoGeral} maximo={dados.maiorGrafico} />
      </article>

      <div className={styles.twoColumns}>
        <article className={styles.card}>
          <div className={styles.sectionHeader}><div><p className={styles.eyebrow}>Comparativo das lojas</p><h2>{dados.mesPassado ? "Resultado final por loja" : "Vendido, próximo nível e projeção"}</h2></div></div>
          <div className={styles.barList}>
            {dados.ranking.map((loja) => (
              <div className={styles.barGroup} key={loja.id}>
                <div className={styles.barTitle}><strong>{loja.codigo}</strong><span>{dados.mesPassado ? `Fechou em ${nivelFechado(loja.vendido, loja.meta)}` : loja.jornada.completa ? "Megameta batida" : `Próximo: ${loja.jornada.alvo.nome}`}</span></div>
                <div className={styles.barRow}><span>Vendido</span><div className={styles.barTrack}><div className={styles.barFill} style={{ width: larguraBarra(loja.vendido, maximoLojas) }} /></div><b>{compacto.format(loja.vendido)}</b></div>
                <div className={styles.barRow}><span>{dados.mesPassado ? "Meta" : loja.jornada.alvo.nome}</span><div className={styles.barTrack}><div className={styles.barFillMeta} style={{ width: larguraBarra(dados.mesPassado ? loja.meta : loja.jornada.alvo.valor, maximoLojas) }} /></div><b>{compacto.format(dados.mesPassado ? loja.meta : loja.jornada.alvo.valor)}</b></div>
                {!dados.mesPassado && <div className={styles.barRow}><span>Projeção</span><div className={styles.barTrack}><div className={styles.barFillProjection} style={{ width: larguraBarra(loja.projecao, maximoLojas) }} /></div><b>{compacto.format(loja.projecao)}</b></div>}
              </div>
            ))}
          </div>
        </article>

        <article className={styles.card}>
          <div className={styles.sectionHeader}><div><p className={styles.eyebrow}>Períodos</p><h2>Manhã × noite por loja</h2></div></div>
          <div className={styles.barList}>
            {dados.ranking.map((loja) => (
              <div className={styles.barGroup} key={loja.id}>
                <div className={styles.barTitle}><strong>{loja.codigo}</strong><span>{dinheiro.format(loja.vendido)}</span></div>
                <div className={styles.barRow}><span>Manhã</span><div className={styles.barTrack}><div className={styles.barFillMorning} style={{ width: larguraBarra(loja.manha, maximoPeriodos) }} /></div><b>{compacto.format(loja.manha)}</b></div>
                <div className={styles.barRow}><span>Noite</span><div className={styles.barTrack}><div className={styles.barFillNight} style={{ width: larguraBarra(loja.noite, maximoPeriodos) }} /></div><b>{compacto.format(loja.noite)}</b></div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className={styles.card}>
        <div className={styles.sectionHeader}><div><p className={styles.eyebrow}>Ranking interativo</p><h2>Toque na loja para abrir os detalhes</h2></div></div>
        <div className={styles.rankList}>
          {dados.ranking.map((loja, indice) => {
            const aberta = Number(lojaAberta) === Number(loja.id);
            const resultadoLoja = nivelFechado(loja.vendido, loja.meta);
            return (
              <div className={styles.rankWrapper} key={loja.id}>
                <button type="button" className={`${styles.rankButton} ${aberta ? styles.rankButtonOpen : ""}`} onClick={() => setLojaAberta(aberta ? null : loja.id)} aria-expanded={aberta}>
                  <span className={styles.rankNumber}>{indice + 1}</span>
                  <span className={styles.rankName}><strong>{loja.codigo} — {loja.nome}</strong><small>{dados.mesPassado ? `Fechou em ${resultadoLoja}` : loja.jornada.completa ? "Megameta batida" : `Próximo nível: ${loja.jornada.alvo.nome}`}</small></span>
                  <b>{textoPercentual(loja.percentual)}</b><span className={styles.chevron}>⌄</span>
                </button>
                {aberta && (
                  <div className={styles.rankDetails}>
                    <div className={styles.storeOverview}>
                      <div><span>Vendido</span><strong>{dinheiro.format(loja.vendido)}</strong></div>
                      <div><span>{dados.mesPassado ? "Resultado final" : "Projeção"}</span><strong>{dados.mesPassado ? resultadoLoja : dinheiro.format(loja.projecao)}</strong></div>
                      <div><span>{dados.mesPassado ? "Fechamento" : "Próximo nível"}</span><strong>{dados.mesPassado ? resultadoLoja : loja.jornada.alvo.nome}</strong></div>
                    </div>
                    <Niveis vendido={loja.vendido} jornada={loja.jornada} encerrado={dados.mesPassado} diasRestantes={loja.diasRestantes} />
                    <div className={styles.periodGrid}>{loja.periodos.map((periodo) => <PeriodoDetalhe periodo={periodo} encerrado={dados.mesPassado} key={periodo.nome} />)}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </article>

      <div className={styles.twoColumns}>
        <article className={styles.card}>
          <div className={styles.sectionHeader}>
            <div><p className={styles.eyebrow}>Comparativo histórico</p><h2>Mesmo mês, até o mesmo dia</h2></div>
            <div className={styles.filters}>
              <select value={filtroLoja} onChange={(evento) => setFiltroLoja(evento.target.value)} aria-label="Filtrar loja"><option value="geral">Todas as lojas</option>{lojas.map((loja) => <option value={loja.id} key={loja.id}>{loja.codigo}</option>)}</select>
              <select value={filtroPeriodo} onChange={(evento) => setFiltroPeriodo(evento.target.value)} aria-label="Filtrar período"><option value="todos">Todos os períodos</option><option value="manha">Manhã</option><option value="noite">Noite</option></select>
            </div>
          </div>
          {carregandoHistorico ? <p className={styles.loading}>Carregando comparação histórica...</p> : <div className={styles.barList}>{comparativoHistorico.map((item) => <div className={styles.barRow} key={item.ano}><strong>{item.ano}</strong><div className={styles.barTrack}><div className={styles.barFillHistory} style={{ width: larguraBarra(item.total, maximoHistorico) }} /></div><b>{compacto.format(item.total)}</b></div>)}</div>}
        </article>

        <article className={styles.card}>
          <div className={styles.sectionHeader}><div><p className={styles.eyebrow}>Insights automáticos</p><h2>O que merece atenção</h2></div></div>
          <div className={styles.insights}>{insights.length ? insights.map((insight, indice) => <p key={`${indice}-${insight}`}>{insight}</p>) : <p>Preencha metas e lançamentos para gerar os insights.</p>}</div>
        </article>
      </div>
    </section>
  );
}
