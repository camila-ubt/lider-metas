"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./FechamentoMensal.module.css";

const dinheiro = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const percentual = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
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

function intervaloMes(ano, mes) {
  const mesTexto = String(mes).padStart(2, "0");
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return {
    inicio: `${ano}-${mesTexto}-01`,
    fim: `${ano}-${mesTexto}-${String(ultimoDia).padStart(2, "0")}`,
    ultimoDia,
  };
}

function dataDoDia(ano, mes, dia) {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function nomePeriodo(periodo) {
  return periodo === "manha" ? "Manhã" : "Noite";
}

function avaliarNivel(vendido, meta) {
  const supermeta = meta * 1.2;
  const megameta = meta * 1.3;

  if (!(meta > 0)) {
    return {
      nome: "Sem meta",
      classe: "semMeta",
      proximo: null,
      falta: 0,
      percentual: 0,
      meta,
      supermeta,
      megameta,
    };
  }

  if (vendido >= megameta) {
    return {
      nome: "Megameta",
      classe: "mega",
      proximo: null,
      falta: 0,
      percentual: (vendido / meta) * 100,
      meta,
      supermeta,
      megameta,
    };
  }

  if (vendido >= supermeta) {
    return {
      nome: "Supermeta",
      classe: "super",
      proximo: "Megameta",
      falta: Math.max(megameta - vendido, 0),
      percentual: (vendido / meta) * 100,
      meta,
      supermeta,
      megameta,
    };
  }

  if (vendido >= meta) {
    return {
      nome: "Meta",
      classe: "meta",
      proximo: "Supermeta",
      falta: Math.max(supermeta - vendido, 0),
      percentual: (vendido / meta) * 100,
      meta,
      supermeta,
      megameta,
    };
  }

  return {
    nome: "Abaixo da Meta",
    classe: "abaixo",
    proximo: "Meta",
    falta: Math.max(meta - vendido, 0),
    percentual: (vendido / meta) * 100,
    meta,
    supermeta,
    megameta,
  };
}

function variacao(atual, anterior) {
  if (!(anterior > 0)) return null;
  return ((atual - anterior) / anterior) * 100;
}

function caminhoLinha(valores, maximo, largura = 720, altura = 250, margem = 32) {
  if (!valores.length) return "";
  const areaLargura = largura - margem * 2;
  const areaAltura = altura - margem * 2;

  return valores
    .map((valor, indice) => {
      const x = margem + (indice / Math.max(valores.length - 1, 1)) * areaLargura;
      const y = altura - margem - (Number(valor || 0) / Math.max(maximo, 1)) * areaAltura;
      return `${indice === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function GraficoAcumulado({ diario, meta }) {
  const acumulado = [];
  let total = 0;
  diario.forEach((valor) => {
    total += valor;
    acumulado.push(total);
  });

  const rotaMeta = diario.map((_, indice) => (meta / diario.length) * (indice + 1));
  const maximo = Math.max(...acumulado, meta * 1.3, 1);

  return (
    <div className={styles.chartBox}>
      <svg viewBox="0 0 720 250" role="img" aria-label="Evolução acumulada do mês">
        {[0, 0.25, 0.5, 0.75, 1].map((proporcao) => {
          const y = 218 - proporcao * 186;
          return (
            <line
              x1="32"
              x2="688"
              y1={y}
              y2={y}
              className={styles.gridLine}
              key={proporcao}
            />
          );
        })}
        <path className={styles.metaLine} d={caminhoLinha(rotaMeta, maximo)} />
        <path className={styles.salesLine} d={caminhoLinha(acumulado, maximo)} />
      </svg>
      <div className={styles.legend}>
        <span><i className={styles.salesDot} /> Realizado</span>
        <span><i className={styles.metaDot} /> Ritmo da Meta</span>
      </div>
    </div>
  );
}

function ChipNivel({ nome, valor, vendido }) {
  const atingido = valor > 0 && vendido >= valor;
  return (
    <div className={`${styles.levelChip} ${atingido ? styles.levelDone : ""}`}>
      <strong>{nome}</strong>
      <span>{atingido ? "Batida" : dinheiro.format(Math.max(valor - vendido, 0))}</span>
    </div>
  );
}

export default function FechamentoMensal() {
  const supabase = useMemo(() => createClient(), []);
  const [visivel, setVisivel] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [modo, setModo] = useState("pendencias");
  const [pendencias, setPendencias] = useState([]);
  const [dados, setDados] = useState(null);

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
    const imprimir = aberto && modo === "relatorio";
    document.body.classList.toggle("fechamento-print-active", imprimir);
    return () => document.body.classList.remove("fechamento-print-active");
  }, [aberto, modo]);

  function mesSelecionado() {
    const campo = document.querySelector('input[type="month"]');
    if (campo?.value) return campo.value;
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  }

  async function abrirFechamento() {
    setAberto(true);
    setCarregando(true);
    setErro("");
    setDados(null);
    setPendencias([]);

    const valorMes = mesSelecionado();
    const [ano, numeroMes] = valorMes.split("-").map(Number);
    const intervalo = intervaloMes(ano, numeroMes);
    const intervalosHistoricos = [ano - 2, ano - 1].map((anoHistorico) => ({
      ano: anoHistorico,
      ...intervaloMes(anoHistorico, numeroMes),
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
      ...intervalosHistoricos.map((item) =>
        supabase
          .from("vendas_diarias")
          .select("data,loja_id,periodo,valor_vendido")
          .gte("data", item.inicio)
          .lte("data", item.fim)
      ),
    ]);

    const falha = [lojasResp, vendasResp, metasResp, ...historicosResp].find(
      (resposta) => resposta.error
    );

    if (falha?.error) {
      setErro(falha.error.message);
      setCarregando(false);
      return;
    }

    const lojas = lojasResp.data || [];
    const vendas = vendasResp.data || [];
    const metas = metasResp.data || [];
    const chavesPreenchidas = new Set(
      vendas.map((venda) => `${venda.data}|${Number(venda.loja_id)}|${venda.periodo}`)
    );
    const faltas = [];

    for (let dia = 1; dia <= intervalo.ultimoDia; dia += 1) {
      const data = dataDoDia(ano, numeroMes, dia);
      periodos.forEach((periodo) => {
        lojas.forEach((loja) => {
          const chave = `${data}|${Number(loja.id)}|${periodo}`;
          if (!chavesPreenchidas.has(chave)) {
            faltas.push({ data, dia, loja, periodo });
          }
        });
      });
    }

    if (faltas.length) {
      setPendencias(faltas);
      setModo("pendencias");
      setCarregando(false);
      return;
    }

    const metasPorSlot = new Map(
      metas.map((meta) => [
        `${Number(meta.loja_id)}|${meta.periodo}`,
        Number(meta.valor_meta || 0),
      ])
    );

    const diario = Array.from({ length: intervalo.ultimoDia }, () => 0);
    vendas.forEach((venda) => {
      const dia = Number(String(venda.data).slice(8, 10));
      if (dia >= 1 && dia <= diario.length) {
        diario[dia - 1] += Number(venda.valor_vendido || 0);
      }
    });

    const lojasResumo = lojas.map((loja) => {
      const vendasLoja = vendas.filter(
        (venda) => Number(venda.loja_id) === Number(loja.id)
      );
      const vendido = somar(vendasLoja);
      const metaManha = metasPorSlot.get(`${Number(loja.id)}|manha`) || 0;
      const metaNoite = metasPorSlot.get(`${Number(loja.id)}|noite`) || 0;
      const meta = metaManha + metaNoite;
      const manhaVendido = somar(vendasLoja.filter((venda) => venda.periodo === "manha"));
      const noiteVendido = somar(vendasLoja.filter((venda) => venda.periodo === "noite"));

      return {
        ...loja,
        vendido,
        meta,
        nivel: avaliarNivel(vendido, meta),
        periodos: [
          {
            nome: "Manhã",
            vendido: manhaVendido,
            meta: metaManha,
            nivel: avaliarNivel(manhaVendido, metaManha),
          },
          {
            nome: "Noite",
            vendido: noiteVendido,
            meta: metaNoite,
            nivel: avaliarNivel(noiteVendido, metaNoite),
          },
        ],
      };
    });

    const totalVendido = somar(vendas);
    const totalMeta = somar(metas, "valor_meta");
    const totalManha = somar(vendas.filter((venda) => venda.periodo === "manha"));
    const totalNoite = somar(vendas.filter((venda) => venda.periodo === "noite"));
    const nivelGeral = avaliarNivel(totalVendido, totalMeta);
    const ranking = [...lojasResumo].sort(
      (a, b) => b.nivel.percentual - a.nivel.percentual
    );

    const historico = intervalosHistoricos.map((item, indice) => ({
      ano: item.ano,
      vendas: historicosResp[indice]?.data || [],
      total: somar(historicosResp[indice]?.data || []),
    }));
    historico.push({ ano, vendas, total: totalVendido });

    const anterior = historico.find((item) => item.ano === ano - 1)?.total || 0;
    const comparacaoAnterior = variacao(totalVendido, anterior);
    const melhorLoja = ranking[0];
    const atencaoLoja = ranking[ranking.length - 1];
    const participacaoNoite = totalVendido > 0 ? (totalNoite / totalVendido) * 100 : 0;
    const caixasNaoAbertos = vendas.filter(
      (venda) => Number(venda.valor_vendido || 0) === 0
    ).length;

    const insights = [];
    if (nivelGeral.nome === "Abaixo da Meta") {
      insights.push(`O resultado geral ficou ${dinheiro.format(nivelGeral.falta)} abaixo da Meta.`);
    } else if (nivelGeral.proximo) {
      insights.push(`O mês alcançou a ${nivelGeral.nome} e ficou a ${dinheiro.format(nivelGeral.falta)} da ${nivelGeral.proximo}.`);
    } else {
      insights.push("O resultado geral alcançou a Megameta do mês.");
    }

    if (melhorLoja) {
      insights.push(`${melhorLoja.codigo} liderou o mês com ${percentual.format(melhorLoja.nivel.percentual)}% da Meta.`);
    }
    if (atencaoLoja && atencaoLoja.nivel.percentual < 100) {
      insights.push(`${atencaoLoja.codigo} encerrou abaixo da Meta e precisa de atenção no próximo planejamento.`);
    }
    insights.push(`O período da noite representou ${percentual.format(participacaoNoite)}% das vendas do mês.`);

    if (comparacaoAnterior !== null) {
      const direcao = comparacaoAnterior >= 0 ? "cresceu" : "recuou";
      insights.push(`O total ${direcao} ${percentual.format(Math.abs(comparacaoAnterior))}% em relação ao mesmo mês de ${ano - 1}.`);
    }
    if (caixasNaoAbertos > 0) {
      insights.push(`${caixasNaoAbertos} caixas foram registrados como não abertos.`);
    }

    setDados({
      valorMes,
      ano,
      numeroMes,
      tituloMes: `${meses[numeroMes - 1]} de ${ano}`,
      totalVendido,
      totalMeta,
      totalManha,
      totalNoite,
      nivelGeral,
      lojas: ranking,
      historico,
      diario,
      insights,
      caixasNaoAbertos,
    });
    setModo("relatorio");
    setCarregando(false);
  }

  function irAoCalendario() {
    const botao = Array.from(document.querySelectorAll("nav.tabs button")).find(
      (item) => item.textContent?.trim() === "Lançar vendas"
    );
    botao?.click();
    window.scrollTo({ top: 0, behavior: "smooth" });
    setAberto(false);
  }

  function fechar() {
    setAberto(false);
    setErro("");
    setPendencias([]);
    setDados(null);
  }

  if (!visivel) return null;

  const pendenciasPorDia = pendencias.reduce((mapa, item) => {
    if (!mapa.has(item.data)) mapa.set(item.data, []);
    mapa.get(item.data).push(item);
    return mapa;
  }, new Map());

  return (
    <>
      <button type="button" className={styles.launcher} onClick={abrirFechamento}>
        Fechamento do mês
      </button>

      {aberto && (
        <div className={styles.backdrop} id="fechamento-impressao">
          <section className={`${styles.modal} ${modo === "relatorio" ? styles.reportModal : ""}`}>
            <div className={styles.modalHeader}>
              <div>
                <p>Reunião mensal</p>
                <h2>{modo === "relatorio" ? `Fechamento — ${dados?.tituloMes || ""}` : "Antes de fechar o mês"}</h2>
              </div>
              <button type="button" onClick={fechar} aria-label="Fechar">×</button>
            </div>

            {carregando && <div className={styles.loading}>Conferindo todos os lançamentos...</div>}
            {erro && <div className={styles.error}>{erro}</div>}

            {!carregando && !erro && modo === "pendencias" && (
              <div className={styles.pendingContent}>
                <div className={styles.warning}>
                  <strong>O fechamento ainda não pode ser concluído.</strong>
                  <span>
                    Faltam {pendencias.length} lançamentos em {pendenciasPorDia.size} dias. Preencha todos os caixas, inclusive os que não abriram.
                  </span>
                </div>

                <div className={styles.pendingList}>
                  {Array.from(pendenciasPorDia.entries()).slice(0, 12).map(([data, itens]) => (
                    <article key={data}>
                      <strong>{new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</strong>
                      <span>
                        {itens.map((item) => `${item.loja.codigo} ${nomePeriodo(item.periodo)}`).join(" · ")}
                      </span>
                    </article>
                  ))}
                  {pendenciasPorDia.size > 12 && (
                    <p>Mais {pendenciasPorDia.size - 12} dias com pendências.</p>
                  )}
                </div>

                <div className={styles.actions}>
                  <button type="button" className={styles.secondary} onClick={fechar}>Fechar</button>
                  <button type="button" className={styles.primary} onClick={irAoCalendario}>Ir ao calendário</button>
                </div>
              </div>
            )}

            {!carregando && !erro && modo === "relatorio" && dados && (
              <div className={styles.report}>
                <section className={styles.hero}>
                  <div>
                    <span>Resultado geral</span>
                    <strong>{dinheiro.format(dados.totalVendido)}</strong>
                    <small>{percentual.format(dados.nivelGeral.percentual)}% da Meta</small>
                  </div>
                  <div className={`${styles.resultBadge} ${styles[dados.nivelGeral.classe]}`}>
                    {dados.nivelGeral.nome}
                  </div>
                </section>

                <section className={styles.kpis}>
                  <article><span>Meta</span><strong>{dinheiro.format(dados.totalMeta)}</strong></article>
                  <article><span>Supermeta</span><strong>{dinheiro.format(dados.totalMeta * 1.2)}</strong></article>
                  <article><span>Megameta</span><strong>{dinheiro.format(dados.totalMeta * 1.3)}</strong></article>
                  <article><span>Caixas não abertos</span><strong>{dados.caixasNaoAbertos}</strong></article>
                </section>

                <section className={styles.reportSection}>
                  <div className={styles.sectionHeader}>
                    <div><p>Evolução do mês</p><h3>Vendas acumuladas</h3></div>
                  </div>
                  <GraficoAcumulado diario={dados.diario} meta={dados.totalMeta} />
                </section>

                <section className={styles.reportSection}>
                  <div className={styles.sectionHeader}>
                    <div><p>Ranking</p><h3>Resultado por loja</h3></div>
                  </div>
                  <div className={styles.storeList}>
                    {dados.lojas.map((loja, indice) => (
                      <article className={styles.storeResult} key={loja.id}>
                        <div className={styles.storeHeading}>
                          <span>{indice + 1}</span>
                          <div><strong>{loja.codigo} — {loja.nome}</strong><small>{dinheiro.format(loja.vendido)} · {percentual.format(loja.nivel.percentual)}%</small></div>
                          <b>{loja.nivel.nome}</b>
                        </div>
                        <div className={styles.levelRow}>
                          <ChipNivel nome="Meta" valor={loja.meta} vendido={loja.vendido} />
                          <ChipNivel nome="Super" valor={loja.meta * 1.2} vendido={loja.vendido} />
                          <ChipNivel nome="Mega" valor={loja.meta * 1.3} vendido={loja.vendido} />
                        </div>
                        <div className={styles.periodGrid}>
                          {loja.periodos.map((periodo) => (
                            <div key={periodo.nome}>
                              <span>{periodo.nome}</span>
                              <strong>{dinheiro.format(periodo.vendido)}</strong>
                              <small>{percentual.format(periodo.nivel.percentual)}% · {periodo.nivel.nome}</small>
                            </div>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <section className={styles.reportSection}>
                  <div className={styles.sectionHeader}>
                    <div><p>Comparativo histórico</p><h3>Mesmo mês em anos anteriores</h3></div>
                  </div>
                  <div className={styles.historyBars}>
                    {dados.historico.map((item) => {
                      const maior = Math.max(...dados.historico.map((registro) => registro.total), 1);
                      return (
                        <div key={item.ano}>
                          <span>{item.ano}</span>
                          <i><b style={{ width: `${Math.max((item.total / maior) * 100, 2)}%` }} /></i>
                          <strong>{dinheiro.format(item.total)}</strong>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className={styles.reportSection}>
                  <div className={styles.sectionHeader}>
                    <div><p>Leitura gerencial</p><h3>Insights do fechamento</h3></div>
                  </div>
                  <div className={styles.insights}>
                    {dados.insights.map((insight, indice) => (
                      <article key={`${indice}-${insight}`}><span>{indice + 1}</span><p>{insight}</p></article>
                    ))}
                  </div>
                </section>

                <div className={styles.actionsNoPrint}>
                  <button type="button" className={styles.secondary} onClick={fechar}>Fechar</button>
                  <button type="button" className={styles.primary} onClick={() => window.print()}>Imprimir / salvar PDF</button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
