"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import styles from "./DashboardEstavelV2.module.css";
import { obterDiaPeloIndiceGrafico } from "@/lib/selecaoHistoricoGrafico.mjs";

const dinheiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const decimal = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function percentual(valor, comSinal = false) {
  if (valor === null || valor === undefined) return "—";
  return (comSinal && valor > 0 ? "+" : "") + decimal.format(valor) + "%";
}

function pontosPercentuais(valor) {
  if (valor === null || valor === undefined) return "—";
  return decimal.format(Math.abs(valor)) + " p.p.";
}

// Desvio positivo significa maior venda necessária (piora); negativo, melhora.
function corDaVariacao(valor) {
  if (valor > 0) return styles.metaHistoricoPiora;
  if (valor < 0) return styles.metaHistoricoMelhora;
  return undefined;
}

// O ponto conhece o dia pelo próprio payload. Não depende do rótulo de hover,
// que pode corresponder ao ponto vizinho em telas estreitas.
function PontoSelecionavel({ cx, cy, payload, diaSelecionado, selecionarDia }) {
  const dia = Number(payload?.dia);
  if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isInteger(dia) || dia < 1) {
    return null;
  }

  const selecionado = dia === diaSelecionado;
  const selecionar = (evento) => {
    evento.stopPropagation();
    selecionarDia(dia);
  };

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`Selecionar dados do dia ${dia}`}
      onClick={selecionar}
      onKeyDown={(evento) => {
        if (evento.key === "Enter" || evento.key === " ") {
          evento.preventDefault();
          selecionar(evento);
        }
      }}
      style={{ cursor: "pointer" }}
    >
      <circle cx={cx} cy={cy} r={8} fill="transparent" pointerEvents="all" />
      <circle
        cx={cx}
        cy={cy}
        r={selecionado ? 4 : 2.5}
        fill="#7650a7"
        stroke={selecionado ? "#fff" : "none"}
        strokeWidth={2}
        pointerEvents="none"
      />
    </g>
  );
}

export default function HistoricoMetaLojaDia({ historico, mes, mesAtual }) {
  const [diaSelecionado, setDiaSelecionado] = useState(null);
  const numeroMes = mes.split("-")[1];

  useEffect(() => {
    setDiaSelecionado(null);
  }, [mes]);

  if (!historico.length) {
    return (
      <p className={styles.metaHistoricoVazio}>
        O histórico ficará disponível após o início do mês e o cadastro da meta.
      </p>
    );
  }

  const selecionado = historico.find((item) => item.dia === diaSelecionado)
    || historico[historico.length - 1];
  const diaTexto = String(selecionado.dia).padStart(2, "0") + "/" + numeroMes;
  const diaParcial = mesAtual && selecionado.dia === historico[historico.length - 1].dia;
  const dadosGrafico = historico.map((item) => ({
    ...item,
    meta: item.nivel === "Meta" ? item.desvioPercentual : null,
    super: item.nivel === "Supermeta" ? item.desvioPercentual : null,
    mega: item.nivel === "Megameta" ? item.desvioPercentual : null,
  }));
  const variacao = selecionado.variacaoPp;
  const textoMudanca = variacao === null
    ? "—"
    : variacao > 0
      ? "↑ Subiu " + pontosPercentuais(variacao)
      : variacao < 0
        ? "↓ Caiu " + pontosPercentuais(variacao)
        : "→ Sem mudança";

  return (
    <div className={styles.metaHistoricoConteudo}>
      <div className={styles.metaHistoricoCabecalho}>
        <div>
          <h3>Evolução da meta necessária</h3>
          <small>Diferença percentual em relação à meta fixa de cada etapa</small>
        </div>
        <select
          aria-label="Escolher um dia do histórico"
          value={selecionado.dia}
          onChange={(evento) => setDiaSelecionado(Number(evento.target.value))}
          className={styles.metaHistoricoSelect}
        >
          {historico.map((item) => (
            <option key={item.dia} value={item.dia}>
              {String(item.dia).padStart(2, "0") + "/" + numeroMes}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.metaHistoricoGrafico} role="group" aria-label="Evolução do desvio percentual da meta diária em relação à meta fixa">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={dadosGrafico}
            margin={{ top: 12, right: 12, left: -8, bottom: 2 }}
            onClick={(estado) => {
              // Para cliques no espaço entre pontos, usa a posição no conjunto
              // completo de dados, não activeLabel (rótulo sujeito a defasagem).
              const dia = obterDiaPeloIndiceGrafico(estado, dadosGrafico);
              if (dia !== null) setDiaSelecionado(dia);
            }}
          >
            <CartesianGrid stroke="#eee8f2" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="dia" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#786f81" }} minTickGap={16} />
            <YAxis
              width={52}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: "#786f81" }}
              tickFormatter={(valor) => percentual(valor)}
              domain={[
                (minimo) => Math.min(0, Math.floor(minimo)),
                (maximo) => Math.max(0, Math.ceil(maximo)),
              ]}
            />
            <Tooltip
              formatter={(valor, nome) => [percentual(valor, true), "Diferença · " + nome]}
              labelFormatter={(dia) => "Dia " + String(dia).padStart(2, "0") + "/" + numeroMes}
              contentStyle={{ borderRadius: 12, border: "1px solid #e7ddef", fontSize: 12 }}
            />
            <ReferenceLine y={0} stroke="#a7a0ae" strokeWidth={2} strokeDasharray="5 4" />
            {[
              { campo: "meta", nome: "Meta" },
              { campo: "super", nome: "Supermeta" },
              { campo: "mega", nome: "Megameta" },
            ].map((serie) => (
              <Line
                key={serie.campo}
                type="monotone"
                dataKey={serie.campo}
                name={serie.nome}
                stroke="#7650a7"
                strokeWidth={3}
                dot={(ponto) => (
                  <PontoSelecionavel
                    {...ponto}
                    diaSelecionado={selecionado.dia}
                    selecionarDia={setDiaSelecionado}
                  />
                )}
                activeDot={false}
                isAnimationActive={false}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className={styles.metaHistoricoLegenda}>
        <span><i className={styles.metaHistoricoLinhaNecessaria} /> Desvio da meta fixa</span>
        <span><i className={styles.metaHistoricoLinhaFixa} /> 0% = meta fixa</span>
      </div>
      <div className={styles.metaHistoricoDetalhe} aria-live="polite">
        <div className={styles.metaHistoricoDetalheTopo}>
          <strong>{diaTexto}{diaParcial ? " · Em andamento" : ""}</strong>
          <span>{selecionado.nivel}</span>
        </div>
        <div className={styles.metaHistoricoValores}>
          <div>
            <small>Em relação à meta fixa</small>
            <strong className={corDaVariacao(selecionado.desvioPercentual)}>{percentual(selecionado.desvioPercentual, true)}</strong>
          </div>
          <div>
            <small>Mudança em relação ao dia anterior</small>
            <strong className={corDaVariacao(variacao)}>{textoMudanca}</strong>
          </div>
        </div>
        {variacao === null && (
          <small className={styles.metaHistoricoVariacao}>
            {selecionado.mudouNivel
              ? "Mudou a etapa da meta; a comparação começa novamente."
              : "Ainda não há dia anterior para comparar."}
          </small>
        )}
        <small>
          {selecionado.diasRestantes} {selecionado.diasRestantes === 1 ? "dia restante" : "dias restantes"}
          {" · "}Vendido acumulado: {dinheiro.format(selecionado.acumulado)}
        </small>
        {selecionado.concluida && <small>Todas as etapas conquistadas.</small>}
        {!selecionado.concluida && selecionado.necessario === null && (
          <small>Não restavam dias para recuperar o saldo.</small>
        )}
      </div>
      <small className={styles.metaHistoricoNota}>
        Acima de 0%, precisa vender mais que a meta fixa; abaixo de 0%, menos.
        A mudança é em pontos percentuais (p.p.): cair significa precisar vender menos por dia.
        Ao mudar de etapa, a comparação recomeça.
      </small>
    </div>
  );
}
