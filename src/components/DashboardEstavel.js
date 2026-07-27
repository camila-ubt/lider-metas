"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./DashboardEstavel.module.css";

const dinheiro = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const compacto = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
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

function somar(lista, campo = "valor_vendido") {
  return lista.reduce(
    (total, item) => total + Number(item?.[campo] || 0),
    0
  );
}

function porcentagem(valor, base) {
  return base > 0 ? (valor / base) * 100 : 0;
}

function textoPercentual(valor, sinal = false) {
  const prefixo = sinal && valor > 0 ? "+" : "";
  return `${prefixo}${Number(valor || 0).toFixed(1).replace(".", ",")}%`;
}

function intervaloMes(ano, mes) {
  const numero = String(mes).padStart(2, "0");
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return {
    inicio: `${ano}-${numero}-01`,
    fim: `${ano}-${numero}-${String(ultimoDia).padStart(2, "0")}`,
  };
}

function diaDaData(data) {
  return Number(String(data).slice(8, 10));
}

function calcularJornada(vendido, metaBase) {
  const niveis = [
    { nome: "Meta", valor: metaBase, simbolo: "★" },
    { nome: "Supermeta", valor: metaBase * 1.2, simbolo: "◆" },
    { nome: "Megameta", valor: metaBase * 1.3, simbolo: "♛" },
  ];

  if (!(metaBase > 0)) {
    return {
      niveis,
      alvo: niveis[0],
      anterior: 0,
      falta: 0,
      progresso: 0,
      percentualAlvo: 0,
      completa: false,
      semMeta: true,
    };
  }

  const indicePendente = niveis.findIndex((nivel) => vendido < nivel.valor);

  if (indicePendente === -1) {
    return {
      niveis,
      alvo: niveis[2],
      anterior: niveis[1].valor,
      falta: 0,
      progresso: 100,
      percentualAlvo: porcentagem(vendido, niveis[2].valor),
      completa: true,
      semMeta: false,
    };
  }

  const alvo = niveis[indicePendente];
  const anterior = indicePendente > 0 ? niveis[indicePendente - 1].valor : 0;
  const intervalo = Math.max(alvo.valor - anterior, 1);
  const progresso = Math.max(
    0,
    Math.min(((vendido - anterior) / intervalo) * 100, 100)
  );

  return {
    niveis,
    alvo,
    anterior,
    falta: Math.max(alvo.valor - vendido, 0),
    progresso,
    percentualAlvo: porcentagem(vendido, alvo.valor),
    completa: false,
    semMeta: false,
  };
}

function caminho(valores, maximo, largura = 700, altura = 250, margem = 34) {
  const pontos = [];
  const divisorX = Math.max(valores.length - 1, 1);
  const areaLargura = largura - margem * 2;
  const areaAltura = altura - margem * 2;

  valores.forEach((valor, indice) => {
    if (
      valor === null ||
      valor === undefined ||
      !Number.isFinite(Number(valor))
    ) {
      return;
    }

    const x = margem + (indice / divisorX) * areaLargura;
    const y =
      altura - margem - (Number(valor) / Math.max(maximo, 1)) * areaAltura;
    pontos.push(`${pontos.length ? "L" : "M"} ${x.toFixed(2)} ${y.toFixed(2)}`);
  });

  return pontos.join(" ");
}

function larguraBarra(valor, maximo) {
  if (!maximo || valor <= 0) return "0%";
  return `${Math.min((valor / maximo) * 100, 100)}%`;
}

function LinhaAcumulada({ dados, maximo }) {
  const realizado = dados.map((item) => item.realizado);
  const projecao = dados.map((item) => item.projecao);
  const meta = dados.map((item) => item.meta);
  const supermeta = dados.map((item) => item.supermeta);
  const megameta = dados.map((item) => item.megameta);
  const marcasX = [1, 8, 15, 22, dados.length].filter(
    (valor, indice, lista) =>
      valor <= dados.length && lista.indexOf(valor) === indice
  );

  return (
    <div className={styles.chartArea}>
      <svg
        className={styles.lineChart}
        viewBox="0 0 700 250"
        role="img"
        aria-label="Gráfico acumulado das vendas e das metas do mês"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((proporcao) => {
          const y = 216 - proporcao * 182;
          return (
            <g key={proporcao}>
              <line
                className={styles.gridLine}
                x1="34"
                x2="666"
                y1={y}
                y2={y}
              />
              <text className={styles.axisLabel} x="3" y={y + 4}>
                {compacto.format(maximo * proporcao)}
              </text>
            </g>
          );
        })}

        {marcasX.map((dia) => {
          const x = 34 + ((dia - 1) / Math.max(dados.length - 1, 1)) * 632;
          return (
            <text
              className={styles.axisLabel}
              x={x}
              y="240"
              textAnchor="middle"
              key={dia}
            >
              {dia}
            </text>
          );
        })}

        <path className={styles.lineMega} d={caminho(megameta, maximo)} />
        <path className={styles.lineSuper} d={caminho(supermeta, maximo)} />
        <path className={styles.lineMeta} d={caminho(meta, maximo)} />
        <path
          className={styles.lineProjection}
          d={caminho(projecao, maximo)}
        />
        <path className={styles.lineReal} d={caminho(realizado, maximo)} />
      </svg>

      <div className={styles.legend}>
        <span><i /> Realizado</span>
        <span><i className={styles.projection} /> Projeção</span>
        <span><i className={styles.meta} /> Meta</span>
        <span><i className={styles.super} /> Supermeta</span>
        <span><i className={styles.mega} /> Megameta</span>
      </div>
    </div>
  );
}

export default function DashboardEstavel({ mes, vendas, metas, lojas }) {
  const supabase = useMemo(() => createClient(), []);
  const [historicoAnterior, setHistoricoAnterior] = useState([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);
  const [filtroLoja, setFiltroLoja] = useState("geral");
  const [filtroPeriodo, setFiltroPeriodo] = useState("todos");

  useEffect(() => {
    let cancelado = false;

    async function carregarHistorico() {
      const [ano, numeroMes] = mes.split("-").map(Number);
      setCarregandoHistorico(true);

      const respostas = await Promise.all(
        [ano - 2, ano - 1].map((anoHistorico) => {
          const intervalo = intervaloMes(anoHistorico, numeroMes);
          return supabase
            .from("vendas_diarias")
            .select("data,loja_id,periodo,valor_vendido")
            .gte("data", intervalo.inicio)
            .lte("data", intervalo.fim)
            .order("data", { ascending: true });
        })
      );

      if (cancelado) return;
      setHistoricoAnterior(
        respostas.flatMap((resposta) => resposta.data || [])
      );
      setCarregandoHistorico(false);
    }

    carregarHistorico();
    return () => {
      cancelado = true;
    };
  }, [mes, supabase]);

  const dados = useMemo(() => {
    const [ano, numeroMes] = mes.split("-").map(Number);
    const hoje = new Date();
    const totalDias = new Date(ano, numeroMes, 0).getDate();
    const atual =
      ano === hoje.getFullYear() && numeroMes === hoje.getMonth() + 1;
    const passado =
      ano < hoje.getFullYear() ||
      (ano === hoje.getFullYear() && numeroMes < hoje.getMonth() + 1);
    const diaCorte = atual
      ? Math.min(hoje.getDate(), totalDias)
      : passado
        ? totalDias
        : 0;
    const diasRestantes = Math.max(totalDias - diaCorte, 0);

    const dias = Array.from({ length: totalDias }, () => 0);
    const porLoja = new Map();
    const diasLancados = new Set();
    let totalVendido = 0;
    let totalManha = 0;
    let totalNoite = 0;

    lojas.forEach((loja) => {
      porLoja.set(Number(loja.id), {
        ...loja,
        vendido: 0,
        meta: 0,
        manha: 0,
        noite: 0,
        metaManha: 0,
        metaNoite: 0,
        dias: Array.from({ length: totalDias }, () => 0),
      });
    });

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
        loja.dias[dia - 1] += valor;
        if (venda.periodo === "manha") loja.manha += valor;
        if (venda.periodo === "noite") loja.noite += valor;
      }
    });

    metas.forEach((meta) => {
      const valor = Number(meta.valor_meta || 0);
      const loja = porLoja.get(Number(meta.loja_id));
      if (!loja) return;

      loja.meta += valor;
      if (meta.periodo === "manha") loja.metaManha += valor;
      if (meta.periodo === "noite") loja.metaNoite += valor;
    });

    const meta = somar(metas, "valor_meta");
    const supermeta = meta * 1.2;
    const megameta = meta * 1.3;
    const jornada = calcularJornada(totalVendido, meta);
    const media = diaCorte > 0 ? totalVendido / diaCorte : 0;
    const projecao = diaCorte > 0 ? media * totalDias : 0;
    const necessarioDia =
      diasRestantes > 0 ? jornada.falta / diasRestantes : 0;
    const ritmoAlvo = totalDias > 0 ? jornada.alvo.valor / totalDias : 0;
    const diferencaRitmo = media - ritmoAlvo;

    let acumulado = 0;
    const acumuladoGeral = dias.map((valor, indice) => {
      acumulado += valor;
      const dia = indice + 1;
      return {
        realizado: dia <= diaCorte ? acumulado : null,
        projecao:
          diaCorte > 0 && dia >= diaCorte
            ? totalVendido + media * (dia - diaCorte)
            : null,
        meta: meta ? (meta / totalDias) * dia : 0,
        supermeta: supermeta ? (supermeta / totalDias) * dia : 0,
        megameta: megameta ? (megameta / totalDias) * dia : 0,
      };
    });

    const lojasDetalhadas = [...porLoja.values()].map((loja) => {
      const jornadaLoja = calcularJornada(loja.vendido, loja.meta);
      const projecaoLoja =
        diaCorte > 0 ? (loja.vendido / diaCorte) * totalDias : 0;

      const criarPeriodo = (nome, vendido, metaPeriodo) => {
        const jornadaPeriodo = calcularJornada(vendido, metaPeriodo);
        return {
          nome,
          vendido,
          meta: metaPeriodo,
          percentual: porcentagem(vendido, metaPeriodo),
          projecao: diaCorte > 0 ? (vendido / diaCorte) * totalDias : 0,
          jornada: jornadaPeriodo,
        };
      };

      return {
        ...loja,
        percentual: porcentagem(loja.vendido, loja.meta),
        projecao: projecaoLoja,
        jornada: jornadaLoja,
        necessarioDia:
          diasRestantes > 0 ? jornadaLoja.falta / diasRestantes : 0,
        periodos: [
          criarPeriodo("Manhã", loja.manha, loja.metaManha),
          criarPeriodo("Noite", loja.noite, loja.metaNoite),
        ],
      };
    });

    const ranking = [...lojasDetalhadas].sort(
      (a, b) => b.percentual - a.percentual
    );
    const emRota =
      jornada.alvo.valor > 0 && projecao >= jornada.alvo.valor;
    const nivelAtual = jornada.completa
      ? "Megameta conquistada"
      : emRota
        ? `Em rota para a ${jornada.alvo.nome}`
        : `Rumo à ${jornada.alvo.nome}`;
    const nivelProjetado =
      megameta > 0 && projecao >= megameta
        ? "Megameta"
        : supermeta > 0 && projecao >= supermeta
          ? "Supermeta"
          : meta > 0 && projecao >= meta
            ? "Meta"
            : "abaixo da Meta";

    const maiorGrafico = Math.max(
      megameta,
      projecao,
      totalVendido,
      ...acumuladoGeral.flatMap((item) => [
        item.realizado || 0,
        item.projecao || 0,
        item.megameta || 0,
      ]),
      1
    );

    return {
      ano,
      numeroMes,
      totalDias,
      diaCorte,
      diasRestantes,
      diasLancados: diasLancados.size,
      totalVendido,
      totalManha,
      totalNoite,
      meta,
      supermeta,
      megameta,
      jornada,
      media,
      projecao,
      necessarioDia,
      diferencaRitmo,
      acumuladoGeral,
      lojasDetalhadas,
      ranking,
      nivelAtual,
      nivelProjetado,
      emRota,
      maiorGrafico,
    };
  }, [mes, vendas, metas, lojas]);

  const comparativoHistorico = useMemo(() => {
    const anos = [dados.ano - 2, dados.ano - 1, dados.ano];
    const atualFiltrado = vendas.filter((venda) => {
      if (diaDaData(venda.data) > dados.diaCorte) return false;
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
      const lista =
        ano === dados.ano
          ? atualFiltrado
          : historicoAnterior.filter((venda) => {
              if (Number(String(venda.data).slice(0, 4)) !== ano) return false;
              if (diaDaData(venda.data) > dados.diaCorte) return false;
              if (
                filtroLoja !== "geral" &&
                Number(venda.loja_id) !== Number(filtroLoja)
              ) {
                return false;
              }
              if (
                filtroPeriodo !== "todos" &&
                venda.periodo !== filtroPeriodo
              ) {
                return false;
              }
              return true;
            });
      return { ano, total: somar(lista) };
    });
  }, [
    dados.ano,
    dados.diaCorte,
    vendas,
    historicoAnterior,
    filtroLoja,
    filtroPeriodo,
  ]);

  const insights = useMemo(() => {
    const lista = [];
    const lider = dados.ranking[0];
    const atencao = [...dados.lojasDetalhadas]
      .filter((loja) => loja.meta > 0 && !loja.jornada.completa)
      .sort((a, b) => a.jornada.percentualAlvo - b.jornada.percentualAlvo)[0];
    const atual =
      comparativoHistorico.find((item) => item.ano === dados.ano)?.total || 0;
    const anterior =
      comparativoHistorico.find((item) => item.ano === dados.ano - 1)?.total || 0;
    const variacao =
      anterior > 0 ? ((atual - anterior) / anterior) * 100 : null;
    const turno = dados.totalManha >= dados.totalNoite ? "manhã" : "noite";
    const turnoValor = Math.max(dados.totalManha, dados.totalNoite);

    if (dados.meta > 0) {
      if (dados.jornada.completa) {
        lista.push(
          `A Megameta já foi conquistada, com ${dinheiro.format(
            dados.totalVendido - dados.megameta
          )} acima do nível máximo.`
        );
      } else if (dados.projecao >= dados.jornada.alvo.valor) {
        lista.push(
          `O ritmo atual projeta ${dinheiro.format(
            dados.projecao
          )}, suficiente para alcançar a ${dados.jornada.alvo.nome}.`
        );
      } else {
        lista.push(
          `Para alcançar a ${dados.jornada.alvo.nome}, o total precisa de ${dinheiro.format(
            dados.necessarioDia
          )} por dia restante.`
        );
      }
    }

    if (lider) {
      lista.push(
        `${lider.codigo} lidera o mês com ${textoPercentual(
          lider.percentual
        )} da Meta alcançada.`
      );
    }

    if (dados.totalVendido > 0) {
      lista.push(
        `O turno da ${turno} representa ${textoPercentual(
          (turnoValor / dados.totalVendido) * 100
        )} das vendas do mês.`
      );
    }

    if (variacao !== null) {
      lista.push(
        `${nomesMeses[dados.numeroMes - 1]} está ${textoPercentual(
          Math.abs(variacao)
        )} ${variacao >= 0 ? "acima" : "abaixo"} do mesmo período de ${
          dados.ano - 1
        }.`
      );
    }

    if (atencao?.necessarioDia > 0) {
      lista.push(
        `${atencao.codigo} precisa de ${dinheiro.format(
          atencao.necessarioDia
        )} por dia restante para alcançar a ${atencao.jornada.alvo.nome}.`
      );
    }

    return lista;
  }, [dados, comparativoHistorico]);

  const maximoLojas = Math.max(
    ...dados.lojasDetalhadas.flatMap((loja) => [
      loja.vendido,
      loja.jornada.alvo.valor,
      loja.projecao,
    ]),
    1
  );
  const maximoPeriodos = Math.max(
    ...dados.lojasDetalhadas.flatMap((loja) => [loja.manha, loja.noite]),
    1
  );
  const maximoHistorico = Math.max(
    ...comparativoHistorico.map((item) => item.total),
    1
  );

  return (
    <section className={styles.dashboard}>
      <article className={styles.hero}>
        <div className={styles.heroTop}>
          <div>
            <p className={styles.eyebrow}>Jornada do mês</p>
            <h2>{dados.nivelAtual}</h2>
            <p className={styles.subtitle}>
              {dinheiro.format(dados.totalVendido)} vendidos · projeção de {" "}
              {dinheiro.format(dados.projecao)}
            </p>
          </div>
          <span
            className={`${styles.status} ${
              dados.emRota || dados.jornada.completa ? styles.statusGood : ""
            }`}
          >
            {dados.jornada.completa
              ? "Nível máximo"
              : dados.emRota
                ? "Em rota"
                : "Atenção"}
          </span>
        </div>

        <div className={styles.activeGoal}>
          <div className={styles.activeGoalHeader}>
            <div>
              <span>
                {dados.jornada.completa ? "Jornada concluída" : "Próximo nível"}
              </span>
              <strong>{dados.jornada.alvo.nome}</strong>
            </div>
            <b>
              {dados.jornada.completa
                ? `${textoPercentual(dados.jornada.percentualAlvo)} alcançado`
                : `Faltam ${dinheiro.format(dados.jornada.falta)}`}
            </b>
          </div>
          <div className={styles.activeTrack}>
            <span style={{ width: `${dados.jornada.progresso}%` }} />
          </div>
          <small>
            {dados.jornada.completa
              ? "Meta, Supermeta e Megameta conquistadas"
              : `${textoPercentual(
                  dados.jornada.progresso
                )} do caminho desta etapa`}
          </small>
        </div>

        <div className={styles.stepGrid}>
          {dados.jornada.niveis.map((nivel, indice) => {
            const conquistado = nivel.valor > 0 && dados.totalVendido >= nivel.valor;
            const atual =
              !dados.jornada.completa &&
              nivel.nome === dados.jornada.alvo.nome;

            return (
              <div
                className={`${styles.step} ${
                  conquistado ? styles.stepDone : ""
                } ${atual ? styles.stepCurrent : ""}`}
                key={nivel.nome}
              >
                <span className={styles.stepIcon}>{nivel.simbolo}</span>
                <strong>{nivel.nome}</strong>
                <small>{dinheiro.format(nivel.valor)}</small>
                <em>
                  {conquistado ? "Conquistada" : atual ? "Objetivo atual" : "Bloqueada"}
                </em>
              </div>
            );
          })}
        </div>
      </article>

      <div className={styles.kpiGrid}>
        <article className={styles.kpi}>
          <span>Total vendido</span>
          <strong>{dinheiro.format(dados.totalVendido)}</strong>
          <small>
            {textoPercentual(porcentagem(dados.totalVendido, dados.meta))} da Meta
          </small>
        </article>
        <article className={styles.kpi}>
          <span>Projeção</span>
          <strong>{dinheiro.format(dados.projecao)}</strong>
          <small>Fechamento projetado: {dados.nivelProjetado}</small>
        </article>
        <article className={styles.kpi}>
          <span>
            {dados.jornada.completa
              ? "Jornada concluída"
              : `Necessário para ${dados.jornada.alvo.nome}`}
          </span>
          <strong>
            {dados.jornada.completa
              ? dinheiro.format(0)
              : dinheiro.format(dados.necessarioDia)}
          </strong>
          <small>{dados.diasRestantes} dias restantes</small>
        </article>
        <article className={styles.kpi}>
          <span>Média diária</span>
          <strong>{dinheiro.format(dados.media)}</strong>
          <small
            className={
              dados.diferencaRitmo >= 0 ? styles.positive : styles.negative
            }
          >
            {dados.diferencaRitmo >= 0 ? "+" : ""}
            {dinheiro.format(dados.diferencaRitmo)} vs. ritmo da {" "}
            {dados.jornada.alvo.nome}
          </small>
        </article>
      </div>

      <article className={styles.chartCard}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Evolução acumulada</p>
            <h2>Realizado, projeção e rotas de meta</h2>
          </div>
          <span className={styles.subtitle}>
            {dados.diasLancados} dias lançados
          </span>
        </div>
        <LinhaAcumulada
          dados={dados.acumuladoGeral}
          maximo={dados.maiorGrafico}
        />
      </article>

      <div className={styles.chartGrid}>
        <article className={styles.chartCard}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Comparativo das lojas</p>
              <h2>Vendido, próximo nível e projeção</h2>
            </div>
          </div>
          <div className={styles.barList}>
            {dados.lojasDetalhadas.map((loja) => (
              <div className={styles.barGroup} key={loja.id}>
                <div className={styles.barTitle}>
                  <strong>{loja.codigo}</strong>
                  <span>
                    {loja.jornada.completa
                      ? "Megameta conquistada"
                      : `Próximo: ${loja.jornada.alvo.nome}`}
                  </span>
                </div>
                <div className={styles.barRow}>
                  <span>Vendido</span>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{ width: larguraBarra(loja.vendido, maximoLojas) }}
                    />
                  </div>
                  <b>{compacto.format(loja.vendido)}</b>
                </div>
                <div className={styles.barRow}>
                  <span>{loja.jornada.alvo.nome}</span>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFillMeta}
                      style={{
                        width: larguraBarra(
                          loja.jornada.alvo.valor,
                          maximoLojas
                        ),
                      }}
                    />
                  </div>
                  <b>{compacto.format(loja.jornada.alvo.valor)}</b>
                </div>
                <div className={styles.barRow}>
                  <span>Projeção</span>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFillProjection}
                      style={{ width: larguraBarra(loja.projecao, maximoLojas) }}
                    />
                  </div>
                  <b>{compacto.format(loja.projecao)}</b>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.chartCard}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Períodos</p>
              <h2>Manhã × noite por loja</h2>
            </div>
          </div>
          <div className={styles.barList}>
            {dados.lojasDetalhadas.map((loja) => (
              <div className={styles.barGroup} key={loja.id}>
                <div className={styles.barTitle}>
                  <strong>{loja.codigo}</strong>
                  <span>{dinheiro.format(loja.vendido)}</span>
                </div>
                <div className={styles.barRow}>
                  <span>Manhã</span>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFillMorning}
                      style={{ width: larguraBarra(loja.manha, maximoPeriodos) }}
                    />
                  </div>
                  <b>{compacto.format(loja.manha)}</b>
                </div>
                <div className={styles.barRow}>
                  <span>Noite</span>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFillNight}
                      style={{ width: larguraBarra(loja.noite, maximoPeriodos) }}
                    />
                  </div>
                  <b>{compacto.format(loja.noite)}</b>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Loja por loja</p>
            <h2>Desempenho completo por período</h2>
          </div>
        </div>
        <div className={styles.storeGrid}>
          {dados.lojasDetalhadas.map((loja) => (
            <article className={styles.storeCard} key={loja.id}>
              <div className={styles.storeHeader}>
                <div>
                  <span className={styles.storeCode}>{loja.codigo}</span>
                  <h3 className={styles.storeName}>{loja.nome}</h3>
                </div>
                <strong>{textoPercentual(loja.percentual)}</strong>
              </div>

              <p className={styles.storeValue}>
                {dinheiro.format(loja.vendido)}
              </p>
              <div className={styles.miniProgress}>
                <span
                  style={{
                    width: `${Math.min(loja.jornada.percentualAlvo, 100)}%`,
                  }}
                />
              </div>
              <div className={styles.storeMeta}>
                <span>Meta: {dinheiro.format(loja.meta)}</span>
                <span>Projeção: {dinheiro.format(loja.projecao)}</span>
              </div>
              <div className={styles.nextStoreLevel}>
                <b>
                  {loja.jornada.completa
                    ? "Megameta conquistada"
                    : `Próximo nível: ${loja.jornada.alvo.nome}`}
                </b>
                <span>
                  {loja.jornada.completa
                    ? `${textoPercentual(
                        loja.jornada.percentualAlvo
                      )} da Megameta`
                    : `Faltam ${dinheiro.format(loja.jornada.falta)}`}
                </span>
              </div>

              <div className={styles.periodGrid}>
                {loja.periodos.map((periodo) => (
                  <div className={styles.periodBox} key={periodo.nome}>
                    <div className={styles.periodHeader}>
                      <strong>{periodo.nome}</strong>
                      <em>{textoPercentual(periodo.percentual)}</em>
                    </div>
                    <p>{dinheiro.format(periodo.vendido)}</p>
                    <dl className={styles.periodStats}>
                      <div>
                        <dt>Meta</dt>
                        <dd>{dinheiro.format(periodo.meta)}</dd>
                      </div>
                      <div>
                        <dt>Projeção</dt>
                        <dd>{dinheiro.format(periodo.projecao)}</dd>
                      </div>
                      <div>
                        <dt>Próximo nível</dt>
                        <dd>{periodo.jornada.alvo.nome}</dd>
                      </div>
                      <div>
                        <dt>
                          {periodo.jornada.completa ? "Resultado" : "Falta"}
                        </dt>
                        <dd>
                          {periodo.jornada.completa
                            ? "Conquistada"
                            : dinheiro.format(periodo.jornada.falta)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </article>

      <div className={styles.chartGrid}>
        <article className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Ranking</p>
              <h2>Posição das lojas</h2>
            </div>
          </div>
          <div className={styles.rankList}>
            {dados.ranking.map((loja, indice) => (
              <div className={styles.rankItem} key={loja.id}>
                <span className={styles.rankNumber}>{indice + 1}</span>
                <strong>{loja.codigo} — {loja.nome}</strong>
                <b>{textoPercentual(loja.percentual)}</b>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.chartCard}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Comparativo histórico</p>
              <h2>Mesmo mês, até o mesmo dia</h2>
            </div>
            <div className={styles.filters}>
              <select
                value={filtroLoja}
                onChange={(evento) => setFiltroLoja(evento.target.value)}
                aria-label="Filtrar loja"
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
                aria-label="Filtrar período"
              >
                <option value="todos">Todos os períodos</option>
                <option value="manha">Manhã</option>
                <option value="noite">Noite</option>
              </select>
            </div>
          </div>
          {carregandoHistorico ? (
            <p className={styles.loading}>
              Carregando comparação histórica...
            </p>
          ) : (
            <div className={styles.barList}>
              {comparativoHistorico.map((item) => (
                <div className={styles.barRow} key={item.ano}>
                  <strong>{item.ano}</strong>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFillHistory}
                      style={{
                        width: larguraBarra(item.total, maximoHistorico),
                      }}
                    />
                  </div>
                  <b>{compacto.format(item.total)}</b>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>

      <article className={styles.insightCard}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Insights automáticos</p>
            <h2>O que merece atenção neste mês</h2>
          </div>
        </div>
        <div className={styles.insightGrid}>
          {insights.length ? (
            insights.map((insight, indice) => (
              <p
                className={styles.insight}
                key={`${indice}-${insight}`}
              >
                {insight}
              </p>
            ))
          ) : (
            <p className={styles.insight}>
              Preencha as metas e os lançamentos para gerar os insights do mês.
            </p>
          )}
        </div>
      </article>
    </section>
  );
}
