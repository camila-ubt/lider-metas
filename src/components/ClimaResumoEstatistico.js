"use client";

import { useMemo } from "react";
import styles from "./ClimaVendas.module.css";

const TIPOS_CLIMA = [
  { tipo: "sol", rotulo: "Firme", icone: "☀️" },
  { tipo: "nublado", rotulo: "Nublado", icone: "☁️" },
  { tipo: "garoa", rotulo: "Sereno/garoa", icone: "💧" },
  { tipo: "chuva", rotulo: "Chuva", icone: "🌧️" },
  { tipo: "forte", rotulo: "Chuva forte", icone: "⛈️" },
];

const dinheiro = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function valoresValidos(valores) {
  return valores
    .map(Number)
    .filter((valor) => Number.isFinite(valor) && valor > 0);
}

function media(valores) {
  const validos = valoresValidos(valores);
  if (!validos.length) return 0;
  return validos.reduce((total, valor) => total + valor, 0) / validos.length;
}

function mediana(valores) {
  const validos = valoresValidos(valores).sort((a, b) => a - b);
  if (!validos.length) return 0;
  const meio = Math.floor(validos.length / 2);
  return validos.length % 2
    ? validos[meio]
    : (validos[meio - 1] + validos[meio]) / 2;
}

function desvioPadrao(valores) {
  const validos = valoresValidos(valores);
  if (validos.length < 2) return 0;
  const m = media(validos);
  const variancia =
    validos.reduce((total, valor) => total + (valor - m) ** 2, 0) /
    (validos.length - 1);
  return Math.sqrt(variancia);
}

function distribuicao(valores) {
  const validos = valoresValidos(valores).sort((a, b) => a - b);
  return {
    n: validos.length,
    mediana: mediana(validos),
    minimo: validos[0] || 0,
    maximo: validos.at(-1) || 0,
    desvio: desvioPadrao(validos),
  };
}

function percentual(valor) {
  if (!Number.isFinite(valor)) return "—";
  const arredondado = Math.round(valor);
  return `${arredondado > 0 ? "+" : ""}${arredondado}%`;
}

function correlacaoPearson(pares) {
  if (pares.length < 3) return null;
  const xs = pares.map((par) => par.x);
  const ys = pares.map((par) => par.y);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let numerador = 0;
  let somaX = 0;
  let somaY = 0;

  pares.forEach(({ x, y }) => {
    const dx = x - mx;
    const dy = y - my;
    numerador += dx * dy;
    somaX += dx ** 2;
    somaY += dy ** 2;
  });

  const denominador = Math.sqrt(somaX * somaY);
  return denominador > 0 ? numerador / denominador : null;
}

function interpretarCorrelacao(r) {
  if (!Number.isFinite(r)) return "Sem variação suficiente";
  const abs = Math.abs(r);
  const intensidade =
    abs < 0.2
      ? "muito fraca"
      : abs < 0.4
        ? "fraca"
        : abs < 0.6
          ? "moderada"
          : abs < 0.8
            ? "forte"
            : "muito forte";
  const direcao = r < 0 ? "negativa" : r > 0 ? "positiva" : "nula";
  return `${intensidade} ${direcao}`;
}

export default function ClimaResumoEstatistico({
  vendas = [],
  lojas = [],
  periodos = [],
  climaEfetivo = [],
  climaApi = [],
  climaPorSlot,
  insightsPorPeriodo = {},
  carregando = false,
  erro = "",
  onDetalhes,
}) {
  const estatisticas = useMemo(() => {
    const vendaDoTipo = (periodoId, tipos, lojaId = null) =>
      vendas
        .filter((venda) => {
          if (periodoId && venda.periodo !== periodoId) return false;
          if (lojaId !== null && Number(venda.loja_id) !== Number(lojaId)) return false;
          const clima = climaPorSlot?.get(`${venda.data}-${venda.periodo}`);
          return clima && tipos.includes(clima.tipo);
        })
        .map((venda) => Number(venda.valor_vendido || 0));

    const comparacoes = {};
    periodos.forEach((periodo) => {
      const firmes = vendaDoTipo(periodo.id, ["sol"]);
      const chuvosos = vendaDoTipo(periodo.id, ["chuva", "forte"]);
      const mediaFirme = media(firmes);
      const mediaChuva = media(chuvosos);
      comparacoes[periodo.id] = {
        mediaFirme,
        mediaChuva,
        variacao:
          mediaFirme > 0 && mediaChuva > 0
            ? ((mediaChuva - mediaFirme) / mediaFirme) * 100
            : null,
      };
    });

    const lojasComparacao = lojas.map((loja) => {
      const firmes = vendaDoTipo(null, ["sol"], loja.id);
      const chuvosos = vendaDoTipo(null, ["chuva", "forte"], loja.id);
      const mediaFirme = media(firmes);
      const mediaChuva = media(chuvosos);
      return {
        loja,
        mediaFirme,
        mediaChuva,
        variacao:
          mediaFirme > 0 && mediaChuva > 0
            ? ((mediaChuva - mediaFirme) / mediaFirme) * 100
            : null,
      };
    });

    const firmesGerais = vendaDoTipo(null, ["sol"]);
    const chuvaGeral = vendaDoTipo(null, ["chuva", "forte"]);

    const paresCorrelacao = climaApi
      .map((clima) => {
        if (!Number.isFinite(Number(clima.chuva))) return null;
        const vendasDoSlot = vendas
          .filter(
            (venda) =>
              venda.data === clima.data && venda.periodo === clima.periodo,
          )
          .map((venda) => Number(venda.valor_vendido || 0));
        const vendaMedia = media(vendasDoSlot);
        return vendaMedia > 0
          ? { x: Number(clima.chuva), y: vendaMedia }
          : null;
      })
      .filter(Boolean);

    const correlacao = correlacaoPearson(paresCorrelacao);

    return {
      comparacoes,
      lojasComparacao,
      dispersaoFirme: distribuicao(firmesGerais),
      dispersaoChuva: distribuicao(chuvaGeral),
      correlacao,
      nCorrelacao: paresCorrelacao.length,
    };
  }, [vendas, lojas, periodos, climaApi, climaPorSlot]);

  return (
    <section className={styles.resumo} aria-label="Resumo estatístico de clima e vendas">
      <div className={styles.resumoCabecalho}>
        <div>
          <span className={styles.eyebrow}>Clima e vendas</span>
          <h2>Estatísticas do mês</h2>
          <p className={styles.resumoSubtitulo}>
            Comparações descritivas do mês selecionado. Quanto maior o histórico, mais confiável fica a leitura.
          </p>
        </div>
        <button type="button" className={styles.verDetalhes} onClick={onDetalhes}>
          Ver análise completa
        </button>
      </div>

      {carregando ? (
        <p className={styles.estado}>Carregando histórico climático...</p>
      ) : erro ? (
        <p className={styles.estado}>{erro}</p>
      ) : climaEfetivo.length === 0 ? (
        <p className={styles.estado}>Ainda não há períodos passados para analisar neste mês.</p>
      ) : (
        <div className={styles.estatisticasGrid}>
          <article className={`${styles.estatisticaCard} ${styles.estatisticaLarga}`}>
            <div className={styles.estatisticaTitulo}>
              <span>Média de venda por clima</span>
              <small>média das lojas em cada período</small>
            </div>
            <div className={styles.mediaClimaTabela}>
              <div className={styles.mediaClimaCabecalho}>
                <span>Clima</span>
                {periodos.map((periodo) => (
                  <strong key={periodo.id}>{periodo.nome}</strong>
                ))}
              </div>
              {TIPOS_CLIMA.map((tipo) => (
                <div className={styles.mediaClimaLinha} key={tipo.tipo}>
                  <span>{tipo.icone} {tipo.rotulo}</span>
                  {periodos.map((periodo) => {
                    const dado = insightsPorPeriodo[periodo.id]?.tipos?.[tipo.tipo];
                    return (
                      <div key={`${periodo.id}-${tipo.tipo}`}>
                        <strong>{dado?.mediaVenda > 0 ? dinheiro.format(dado.mediaVenda) : "—"}</strong>
                        <small>{dado?.dias || 0} período(s)</small>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </article>

          <article className={styles.estatisticaCard}>
            <div className={styles.estatisticaTitulo}>
              <span>Chuva x tempo firme</span>
              <small>diferença da média de venda</small>
            </div>
            <div className={styles.comparacaoPeriodos}>
              {periodos.map((periodo) => {
                const dado = estatisticas.comparacoes[periodo.id] || {};
                return (
                  <div className={styles.comparacaoLinha} key={periodo.id}>
                    <b>{periodo.nome}</b>
                    <strong>{percentual(dado.variacao)}</strong>
                    <small>
                      Firme {dado.mediaFirme > 0 ? dinheiro.format(dado.mediaFirme) : "—"} · Chuva {dado.mediaChuva > 0 ? dinheiro.format(dado.mediaChuva) : "—"}
                    </small>
                  </div>
                );
              })}
            </div>
          </article>

          <article className={styles.estatisticaCard}>
            <div className={styles.estatisticaTitulo}>
              <span>Impacto por loja</span>
              <small>chuva + chuva forte x tempo firme</small>
            </div>
            <div className={styles.lojasEstatisticas}>
              {estatisticas.lojasComparacao.map((item) => (
                <div key={item.loja.id}>
                  <b>{item.loja.codigo || item.loja.nome}</b>
                  <strong>{percentual(item.variacao)}</strong>
                  <small>
                    {item.mediaFirme > 0 && item.mediaChuva > 0
                      ? `${dinheiro.format(item.mediaFirme)} → ${dinheiro.format(item.mediaChuva)}`
                      : "Ainda sem base comparável"}
                  </small>
                </div>
              ))}
            </div>
          </article>

          <article className={`${styles.estatisticaCard} ${styles.estatisticaLarga}`}>
            <div className={styles.estatisticaTitulo}>
              <span>Frequência climática</span>
              <small>quantos períodos de cada condição ocorreram</small>
            </div>
            <div className={styles.frequenciaPeriodos}>
              {periodos.map((periodo) => (
                <div key={periodo.id}>
                  <b>{periodo.nome}</b>
                  <div>
                    {TIPOS_CLIMA.map((tipo) => {
                      const dado = insightsPorPeriodo[periodo.id]?.tipos?.[tipo.tipo];
                      return (
                        <span key={`${periodo.id}-${tipo.tipo}`}>
                          {tipo.icone} {dado?.dias || 0} {tipo.rotulo.toLowerCase()}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className={styles.estatisticaCard}>
            <div className={styles.estatisticaTitulo}>
              <span>Dispersão das vendas</span>
              <small>mediana, mínimo, máximo e desvio-padrão</small>
            </div>
            <div className={styles.dispersaoTabela}>
              {[
                ["Tempo firme", estatisticas.dispersaoFirme],
                ["Chuva", estatisticas.dispersaoChuva],
              ].map(([rotulo, dado]) => (
                <div key={rotulo}>
                  <b>{rotulo}</b>
                  {dado.n > 0 ? (
                    <span>
                      Mediana {dinheiro.format(dado.mediana)} · mín. {dinheiro.format(dado.minimo)} · máx. {dinheiro.format(dado.maximo)} · DP {dinheiro.format(dado.desvio)}
                    </span>
                  ) : (
                    <span>Sem observações suficientes</span>
                  )}
                </div>
              ))}
            </div>
          </article>

          <article className={styles.estatisticaCard}>
            <div className={styles.estatisticaTitulo}>
              <span>Correlação chuva × vendas</span>
              <small>precipitação em mm x venda média do período</small>
            </div>
            <div className={styles.correlacaoBox}>
              <strong>
                {Number.isFinite(estatisticas.correlacao)
                  ? `r = ${estatisticas.correlacao.toFixed(2)}`
                  : "Sem base"}
              </strong>
              <span>{interpretarCorrelacao(estatisticas.correlacao)}</span>
              <small>{estatisticas.nCorrelacao} períodos com dados comparáveis</small>
            </div>
          </article>
        </div>
      )}

      <p className={styles.notaEstatistica}>
        Os resultados mostram associação observada e não provam que o clima causou a variação das vendas.
      </p>
    </section>
  );
}
