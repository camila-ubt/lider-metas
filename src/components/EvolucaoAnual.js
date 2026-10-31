"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import {
  alternarAnoHistorico, anosHistoricosDisponiveis, compararAnosEquivalentes,
  detalharMesEvolucao, MESES_CURTOS, montarComparativo, resumirSerieAnual,
} from "@/lib/evolucaoAnual.mjs";
import styles from "./EvolucaoAnual.module.css";

const dinheiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const CORES = ["#7650a7", "#248676", "#c88d4f"];
const COR_MES_PARCIAL = "#bf8423";

function PontoAnual({ cx, cy, index, value, cor, mesParcial, anoAtual, ativo = false }) {
  if (!Number.isFinite(cx) || !Number.isFinite(cy) || value == null) return null;
  const parcial = anoAtual && mesParcial === index + 1;
  return (
    <circle cx={cx} cy={cy} r={parcial ? (ativo ? 7 : 5.5) : (ativo ? 5 : 3)}
      fill={parcial ? COR_MES_PARCIAL : cor}
      stroke={parcial ? "#fff" : "none"} strokeWidth={parcial ? 2 : 0} />
  );
}

function formatoEixo(valor) {
  const abs = Math.abs(valor);
  if (abs >= 1000000) return numero.format(valor / 1000000) + " mi";
  if (abs >= 1000) return numero.format(valor / 1000) + " mil";
  return numero.format(valor);
}

function formatarMedida(valor) {
  return dinheiro.format(valor);
}

function MiniGrafico({ linhas, ano, aoSelecionarMes }) {
  const maximo = Math.max(1, ...linhas.map((item) => item.vendido ?? 0));
  const comDados = linhas.some((item) => item.temDados);

  if (!comDados) return <p className={styles.semDados}>Ainda não há lançamentos neste ano.</p>;

  return (
    <svg
      className={styles.miniSvg}
      viewBox="0 0 600 116"
      preserveAspectRatio="xMidYMid meet"
      role="group"
      aria-label={"Vendas mensais de " + ano + ". Selecione uma barra para abrir os detalhes."}
    >
      <line x1="12" y1="88" x2="588" y2="88" stroke="#e9e3f0" />
      {linhas.map((item, i) => {
        const altura = item.temDados ? Math.max(3, (item.vendido / maximo) * 77) : 0;
        const x = 15 + i * 48;
        return (
          <g key={item.mes}
            className={item.temDados ? styles.miniGrupoAcionavel : undefined}
            role={item.temDados ? "button" : undefined}
            tabIndex={item.temDados ? 0 : undefined}
            aria-label={item.temDados
              ? item.nome + " de " + ano + ": " + dinheiro.format(item.vendido) +
                (item.parcial ? ", parcial" : "") + ". Ver detalhes."
              : undefined}
            onClick={item.temDados ? () => aoSelecionarMes(item.mes) : undefined}
            onKeyDown={item.temDados ? (evento) => {
              if (evento.key === "Enter" || evento.key === " ") {
                evento.preventDefault();
                aoSelecionarMes(item.mes);
              }
            } : undefined}>
            {item.temDados && (
              <rect className={styles.miniAlvoToque}
                x={x} y="0" width="44" height="114" rx="6" fill="transparent" />
            )}
            {item.temDados && (
              <rect x={x + 10} y={88 - altura} width="25" height={altura}
                rx="5" fill={item.parcial ? COR_MES_PARCIAL : CORES[0]}>
                <title>{item.nome + ": " + dinheiro.format(item.vendido) + (item.parcial ? " (parcial)" : "")}</title>
              </rect>
            )}
            <text x={x + 22} y="108" fontSize="11" textAnchor="middle" fill="#73697e">{item.nome}</text>
          </g>
        );
      })}
    </svg>
  );
}

async function consultarAno(supabase, ano) {
  const inicio = ano + "-01-01";
  const fim = ano + "-12-31";
  const metasResposta = await supabase.from("metas_mensais")
    .select("mes,loja_id,periodo,valor_meta")
    .gte("mes", inicio).lte("mes", fim);
  if (metasResposta.error) throw metasResposta.error;

  const vendas = [];
  for (let offset = 0; ; offset += 1000) {
    const resposta = await supabase.from("vendas_diarias")
      .select("id,data,loja_id,periodo,valor_vendido")
      .gte("data", inicio).lte("data", fim)
      .order("id", { ascending: true })
      .range(offset, offset + 999);
    if (resposta.error) throw resposta.error;
    const pagina = resposta.data || [];
    vendas.push(...pagina);
    if (pagina.length < 1000) break;
  }
  return { vendas, metas: metasResposta.data || [] };
}

export default function EvolucaoAnual({ ano, lojas, vendas, metas }) {
  const supabase = useMemo(() => createClient(), []);
  const hoje = useMemo(() => new Date(), []);
  const [aberto, setAberto] = useState(false);
  const [lojaId, setLojaId] = useState("geral");
  const [periodo, setPeriodo] = useState("todos");
  const [modo, setModo] = useState("acumulado");
  const [mesSelecionado, setMesSelecionado] = useState(null);
  const [anosMarcados, setAnosMarcados] = useState(() => ({
    ano,
    anos: anosHistoricosDisponiveis(ano).slice(0, 2),
  }));
  const [historico, setHistorico] = useState({});
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState("");
  const cache = useRef({});
  const botaoExpandirRef = useRef(null);
  const fecharRef = useRef(null);
  const janelaRef = useRef(null);
  const detalheMesRef = useRef(null);
  const abrirPeloMiniRef = useRef(false);

  const mini = useMemo(() => resumirSerieAnual({
    ano, lojasIds: lojas.map((loja) => loja.id), periodo: "todos", vendas, metas, hoje,
  }), [ano, lojas, vendas, metas, hoje]);

  const anosDisponiveis = useMemo(() => anosHistoricosDisponiveis(ano), [ano]);
  // Ao trocar o ano principal, os anos exibidos são redefinidos sem herdar escolhas antigas.
  const anosAnteriores = useMemo(() => (
    anosMarcados.ano === ano ? anosMarcados.anos : anosDisponiveis.slice(0, 2)
  ), [ano, anosMarcados, anosDisponiveis]);

  function alternarAno(anoEscolhido) {
    setAnosMarcados((estado) => {
      const atuais = estado.ano === ano ? estado.anos : anosDisponiveis.slice(0, 2);
      return {
        ano,
        anos: alternarAnoHistorico(atuais, anoEscolhido, ano),
      };
    });
  }

  useEffect(() => {
    if (!aberto) return undefined;
    let ativo = true;
    const faltantes = anosAnteriores.filter((y) => !cache.current[y]);
    if (!faltantes.length) {
      setHistorico({ ...cache.current });
      setBuscando(false);
      setErro("");
      return undefined;
    }
    setBuscando(true);
    setErro("");
    Promise.all(faltantes.map(async (y) => ({ ano: y, dados: await consultarAno(supabase, y) })))
      .then((resultados) => {
        if (!ativo) return;
        for (const item of resultados) cache.current[item.ano] = item.dados;
        setHistorico({ ...cache.current });
      })
      .catch((error) => {
        console.error("Consulta da evolução anual:", error);
        if (ativo) setErro("Não foi possível consultar todos os anos anteriores.");
      })
      .finally(() => { if (ativo) setBuscando(false); });
    return () => { ativo = false; };
  }, [aberto, ano, anosAnteriores, supabase]);

  useEffect(() => {
    if (!aberto) return undefined;
    const anterior = document.activeElement;
    const scrollAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    fecharRef.current?.focus();
    function teclado(evento) {
      if (evento.key === "Escape") {
        evento.preventDefault();
        setAberto(false);
      } else if (evento.key === "Tab") {
        const controles = [...(janelaRef.current?.querySelectorAll(
          'button:not([disabled]), select:not([disabled]), input:not([disabled]), a[href]'
        ) || [])];
        if (!controles.length) return;
        if (evento.shiftKey && document.activeElement === controles[0]) {
          evento.preventDefault();
          controles[controles.length - 1].focus();
        } else if (!evento.shiftKey && document.activeElement === controles[controles.length - 1]) {
          evento.preventDefault();
          controles[0].focus();
        } else if (!janelaRef.current?.contains(document.activeElement)) {
          evento.preventDefault();
          controles[0].focus();
        }
      }
    }
    document.addEventListener("keydown", teclado);
    return () => {
      document.removeEventListener("keydown", teclado);
      document.body.style.overflow = scrollAnterior;
      if (anterior instanceof HTMLElement && anterior.isConnected) anterior.focus();
      else botaoExpandirRef.current?.focus();
    };
  }, [aberto]);

  const ids = useMemo(() => lojaId === "geral"
    ? lojas.map((loja) => loja.id)
    : lojas.filter((loja) => String(loja.id) === lojaId).map((loja) => loja.id),
    [lojaId, lojas]);

  const series = useMemo(() => {
    const resultado = {
      [ano]: resumirSerieAnual({ ano, lojasIds: ids, periodo, vendas, metas, hoje }),
    };
    for (const anoAnterior of anosAnteriores) {
      const dados = historico[anoAnterior];
      if (dados) {
        resultado[anoAnterior] = resumirSerieAnual({
          ano: anoAnterior, lojasIds: ids, periodo,
          vendas: dados.vendas, metas: dados.metas, hoje,
        });
      }
    }
    return resultado;
  }, [ano, ids, periodo, vendas, metas, historico, anosAnteriores, hoje]);

  const anosComparados = useMemo(
    () => [ano, ...anosAnteriores.filter((y) => Boolean(series[y]))],
    [ano, anosAnteriores, series]
  );
  const dadosGrafico = useMemo(
    () => montarComparativo(series, anosComparados, modo),
    [series, anosComparados, modo]
  );
  const anoReferencia = anosAnteriores[0] ?? null;
  const variacao = useMemo(
    () => compararAnosEquivalentes(series[ano], anoReferencia === null ? undefined : series[anoReferencia]),
    [series, ano, anoReferencia]
  );
  const valorAno = series[ano].reduce((total, item) => total + (item.vendido || 0), 0);
  const mesesObservados = series[ano].filter((item) => item.temDados).length;
  const mesParcial = series[ano].find((item) => item.parcial)?.mes ?? null;
  const parcial = mesParcial !== null;
  const temGraficos = dadosGrafico.some((item) => anosComparados.some((y) => item[String(y)] !== null));
  const TipoGrafico = modo === "mensal" ? BarChart : LineChart;
  const detalheMes = useMemo(
    () => mesSelecionado === null ? null : detalharMesEvolucao(
      series[ano], anoReferencia === null ? undefined : series[anoReferencia], mesSelecionado
    ),
    [ano, anoReferencia, mesSelecionado, series]
  );

  useEffect(() => {
    if (!aberto || mesSelecionado === null || !abrirPeloMiniRef.current) return;
    abrirPeloMiniRef.current = false;
    detalheMesRef.current?.scrollIntoView({ block: "nearest" });
  }, [aberto, mesSelecionado]);

  function abrirMesPeloResumo(mes) {
    abrirPeloMiniRef.current = true;
    setModo("mensal");
    setMesSelecionado(mes);
    setAberto(true);
  }

  function escolherMesNoGrafico(estado) {
    const indicePorNome = MESES_CURTOS.indexOf(String(estado?.activeLabel ?? ""));
    const indiceBruto = estado?.activeTooltipIndex;
    const indicePorPosicao = indiceBruto == null ? -1 : Number(indiceBruto);
    const indice = indicePorNome >= 0 ? indicePorNome : indicePorPosicao;
    if (Number.isInteger(indice) && indice >= 0 && indice < 12) setMesSelecionado(indice + 1);
  }

  return (
    <>
      <section className={styles.previa} aria-label="Gráfico de evolução anual">
        <div className={styles.previaTopo}>
          <div>
            <h3>Evolução do ano</h3>
            <p>{ano} · vendas mensais das três lojas</p>
          </div>
          <button type="button" ref={botaoExpandirRef} className={styles.botaoExpandir}
            onClick={() => {
              abrirPeloMiniRef.current = false;
              setModo("acumulado");
              setMesSelecionado(null);
              setAberto(true);
            }}>
            Ver análise completa <span aria-hidden="true">↗</span>
          </button>
        </div>
        <MiniGrafico linhas={mini} ano={ano} aoSelecionarMes={abrirMesPeloResumo} />
        <p className={styles.instrucaoMini}>Toque em uma barra para abrir os detalhes do mês.</p>
        {parcial && (
          <p className={styles.legendaParcial}>
            <span className={styles.marcadorParcial} aria-hidden="true" />
            {MESES_CURTOS[mesParcial - 1]} de {ano} · resultado parcial
          </p>
        )}
      </section>

      {aberto && createPortal(
        <div className={styles.fundo} onMouseDown={(evento) => {
          if (evento.target === evento.currentTarget) setAberto(false);
        }}>
          <section ref={janelaRef} role="dialog" aria-modal="true"
            aria-labelledby="evolucao-anual-modal-titulo" className={styles.janela}>
            <header className={styles.cabecalho}>
              <div>
                <span>Análise histórica</span>
                <h2 id="evolucao-anual-modal-titulo">Evolução anual · {ano}</h2>
              </div>
              <button ref={fecharRef} type="button" className={styles.fechar}
                onClick={() => setAberto(false)}>Fechar ×</button>
            </header>
            <div className={styles.conteudo}>
              <div className={styles.filtros}>
                <label>Loja
                  <select value={lojaId} onChange={(e) => setLojaId(e.target.value)}>
                    <option value="geral">Geral das 3 lojas</option>
                    {lojas.map((loja) => (
                      <option key={loja.id} value={String(loja.id)}>{loja.codigo} · {loja.nome}</option>
                    ))}
                  </select>
                </label>
                <label>Período
                  <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
                    <option value="todos">Manhã + Noite</option>
                    <option value="manha">Manhã</option>
                    <option value="noite">Noite</option>
                  </select>
                </label>
                <label>Visualização
                  <select value={modo} onChange={(e) => setModo(e.target.value)}>
                    <option value="acumulado">Acumulado no ano</option>
                    <option value="mensal">Vendas mês a mês</option>
                  </select>
                </label>
              </div>

              {anosDisponiveis.length > 0 && (
                <fieldset className={styles.anosComparar}>
                  <legend>Comparar com <span>(até 2 anos)</span></legend>
                  <div className={styles.anosOpcoes}>
                    {anosDisponiveis.map((anoAnterior) => {
                      const marcado = anosAnteriores.includes(anoAnterior);
                      const bloqueado = !marcado && anosAnteriores.length >= 2;
                      return (
                        <label key={anoAnterior} className={styles.anoOpcao}>
                          <input type="checkbox" checked={marcado} disabled={bloqueado}
                            onChange={() => alternarAno(anoAnterior)} />
                          <span>{anoAnterior}</span>
                        </label>
                      );
                    })}
                    {!anosAnteriores.length && <small>Exibindo apenas {ano}.</small>}
                  </div>
                </fieldset>
              )}

              <div className={styles.kpis}>
                <div><span>Vendido em {ano}</span><strong>{dinheiro.format(valorAno)}</strong>
                  <small>{mesesObservados} mês(es) com registros{parcial ? " · inclui o atual" : ""}</small></div>
                <div><span>{anoReferencia === null ? "Comparativo histórico" : "Comparativo com " + anoReferencia}</span>
                  <strong>{variacao.percentual === null ? "—" :
                    (variacao.percentual > 0 ? "+" : "") + numero.format(variacao.percentual) + "%"}</strong>
                  <small>{anoReferencia === null ? (anosDisponiveis.length ? "Selecione um ano para comparar" : "Histórico disponível desde 2024") :
                    buscando && !series[anoReferencia] ? "Carregando histórico..." :
                    variacao.meses ? variacao.meses + " mês(es) fechados equivalentes" : "Sem meses comparáveis"}</small>
                </div>
              </div>

              <div className={styles.tituloGrafico}>
                <h3>{modo === "acumulado" ? "Evolução acumulada" : "Vendas por mês"}</h3>
                <span>{anosComparados.join(" × ")}</span>
              </div>
              {parcial && (
                <p className={styles.legendaParcial}>
                  <span className={styles.marcadorParcial} aria-hidden="true" />
                  {MESES_CURTOS[mesParcial - 1]} de {ano} · parcial, ainda em andamento
                </p>
              )}
              {erro && <p role="alert" className={styles.aviso}>{erro}</p>}
              {buscando && <p role="status" className={styles.aviso}>Carregando anos anteriores...</p>}
              {temGraficos ? (
                <div className={styles.grafico}>
                  <ResponsiveContainer width="100%" height="100%">
                    <TipoGrafico data={dadosGrafico} margin={{ top: 24, right: 10, left: 0, bottom: 0 }}
                      onClick={escolherMesNoGrafico} cursor="pointer">
                      <CartesianGrid stroke="#ebe5f1" strokeDasharray="4 4" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#73697e" }} tickLine={false} />
                      <YAxis width={70} tick={{ fontSize: 11, fill: "#73697e" }} tickLine={false}
                        tickFormatter={formatoEixo} />
                      <Tooltip
                        formatter={(valor, nome) => [formatarMedida(valor), nome]}
                        labelFormatter={(nome) => "Mês: " + nome +
                          (mesParcial === MESES_CURTOS.indexOf(String(nome)) + 1
                            ? " · " + ano + " parcial" : "")}
                        contentStyle={{ borderRadius: 12, borderColor: "#e4ddec" }}
                      />
                      <Legend />
                      {mesParcial !== null && (
                        <ReferenceLine x={MESES_CURTOS[mesParcial - 1]}
                          stroke={COR_MES_PARCIAL} strokeDasharray="4 4"
                          label={{ value: "Parcial", fill: COR_MES_PARCIAL, position: "top", fontSize: 11 }} />
                      )}
                      {mesSelecionado !== null && mesSelecionado !== mesParcial && (
                        <ReferenceLine x={MESES_CURTOS[mesSelecionado - 1]}
                          stroke="#8e82a0" strokeDasharray="4 4" />
                      )}
                      {anosComparados.map((y, i) => modo === "mensal" ? (
                        <Bar key={y} name={String(y)} dataKey={String(y)}
                          fill={CORES[i]} maxBarSize={16} radius={[3, 3, 0, 0]}
                          isAnimationActive={false}>
                          {dadosGrafico.map((item, indice) => (
                            <Cell key={item.mes}
                              fill={i === 0 && mesParcial === indice + 1 ? COR_MES_PARCIAL : CORES[i]} />
                          ))}
                        </Bar>
                      ) : (
                        <Line key={y} name={String(y)} dataKey={String(y)}
                          type="monotone" stroke={CORES[i]} strokeWidth={i === 0 ? 3 : 2}
                          dot={(props) => <PontoAnual {...props} cor={CORES[i]}
                            mesParcial={mesParcial} anoAtual={i === 0} />}
                          activeDot={(props) => <PontoAnual {...props} cor={CORES[i]}
                            mesParcial={mesParcial} anoAtual={i === 0} ativo />}
                          connectNulls={false} isAnimationActive={false} />
                      ))}
                    </TipoGrafico>
                  </ResponsiveContainer>
                </div>
              ) : <p className={styles.semDados}>Não há registros para este filtro.</p>}
              {temGraficos && (
                <div className={styles.selecaoMes}>
                  <span>Toque no gráfico ou escolha um mês para ver os detalhes.</span>
                  <label>Mês
                    <select value={mesSelecionado ?? ""} onChange={(evento) =>
                      setMesSelecionado(evento.target.value ? Number(evento.target.value) : null)}>
                      <option value="">Selecionar</option>
                      {MESES_CURTOS.map((nome, i) =>
                        <option key={nome} value={i + 1}>{nome}</option>
                      )}
                    </select>
                  </label>
                </div>
              )}
              {detalheMes && (
                <section ref={detalheMesRef} className={styles.detalheMes}
                  aria-label={"Detalhes de " + detalheMes.nome + " de " + ano} aria-live="polite">
                  <header className={styles.detalheMesTopo}>
                    <div>
                      <h4>{detalheMes.nome} de {ano}</h4>
                      {detalheMes.parcial && <span className={styles.mesParcial}>Em andamento</span>}
                    </div>
                    <button type="button" aria-label="Fechar detalhe do mês"
                      onClick={() => setMesSelecionado(null)}>Fechar ×</button>
                  </header>
                  <div className={styles.detalheMesValores}>
                    <div>
                      <span>Vendido</span>
                      <strong>{detalheMes.temDados ? dinheiro.format(detalheMes.vendido) : "—"}</strong>
                    </div>
                    <div>
                      <span>Meta</span>
                      <strong>{detalheMes.meta !== null ? dinheiro.format(detalheMes.meta) : "—"}</strong>
                    </div>
                    <div>
                      <span>Atingimento</span>
                      <strong>{detalheMes.percentual !== null ? numero.format(detalheMes.percentual) + "%" : "—"}</strong>
                    </div>
                  </div>
                  <div className={styles.balancoMes}>
                    <p>
                      <strong>Diferença para a meta: </strong>
                      {detalheMes.diferencaMeta === null ? "Sem comparação disponível" :
                        (detalheMes.diferencaMeta > 0 ? "+" : "") + dinheiro.format(detalheMes.diferencaMeta)}
                    </p>
                    <p>
                      <strong>{anoReferencia === null ? "Comparativo histórico: " : "Mesmo mês de " + anoReferencia + ": "}</strong>
                      {anoReferencia === null ? (anosDisponiveis.length ? "Selecione um ano acima" : "Histórico indisponível") :
                        detalheMes.vendidoAnterior === null
                          ? (buscando && !series[anoReferencia] ? "Carregando..." : "Sem registros")
                          : dinheiro.format(detalheMes.vendidoAnterior)}
                      {detalheMes.variacaoAnterior !== null && (
                        <span className={detalheMes.variacaoAnterior >= 0 ? styles.variacaoPositiva : styles.variacaoNegativa}>
                          {" · " + (detalheMes.variacaoAnterior > 0 ? "+" : "") +
                            numero.format(detalheMes.variacaoAnterior) + "% (" +
                            (detalheMes.diferencaAnterior > 0 ? "+" : "") +
                            dinheiro.format(detalheMes.diferencaAnterior) + ")"}
                        </span>
                      )}
                    </p>
                    {detalheMes.parcial && <small>O mês atual é parcial. A variação anual só aparece após o fechamento.</small>}
                    {!detalheMes.temDados && <small>Sem lançamentos registrados para este filtro no mês escolhido.</small>}
                  </div>
                </section>
              )}
              <p className={styles.nota}>
                Meses sem lançamentos aparecem como lacunas, sem valores estimados.
                {modo === "acumulado" ? " O acumulado soma apenas meses com registros." : ""}
                {parcial ? " O mês atual é parcial; a comparação mensal com anos fechados exige cautela." : ""}
              </p>

              <details className={styles.tabelaDetalhada}>
                <summary>Ver valores mês a mês</summary>
                <div className={styles.rolagem}>
                  <table>
                    <thead><tr><th scope="col">Mês</th>
                      {anosComparados.map((y) => <th scope="col" key={y}>{y}</th>)}
                    </tr></thead>
                    <tbody>{dadosGrafico.map((linha) => <tr key={linha.mes}>
                      <th scope="row">{linha.mes}</th>
                      {anosComparados.map((y) => (
                        <td key={y}>{linha[String(y)] === null ? "—" :
                          formatarMedida(linha[String(y)])}</td>
                      ))}
                    </tr>)}</tbody>
                  </table>
                </div>
              </details>
            </div>
          </section>
        </div>,
        document.body
      )}
    </>
  );
}
