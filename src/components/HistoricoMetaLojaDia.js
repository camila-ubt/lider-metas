"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import styles from "./DashboardEstavelV2.module.css";

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
  const mensagemVariacao = variacao === null
    ? selecionado.mudouNivel
      ? "Mudança de etapa: a comparação com o dia anterior foi reiniciada."
      : "Sem comparação com o dia anterior."
    : variacao > 0
      ? "↑ Subiu " + pontosPercentuais(variacao) + " desde o dia anterior"
      : variacao < 0
        ? "↓ Caiu " + pontosPercentuais(variacao) + " desde o dia anterior"
        : "→ Sem alteração em relação ao dia anterior";

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
              const dia = Number(estado?.activeLabel);
              if (Number.isInteger(dia) && dia > 0) setDiaSelecionado(dia);
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
                dot={{ r: 2 }}
                activeDot={{ r: 6 }}
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
            <strong>{percentual(selecionado.desvioPercentual, true)}</strong>
          </div>
          <div>
            <small>Variação diária</small>
            <strong>{variacao === null ? "—" : (variacao > 0 ? "+" : variacao < 0 ? "−" : "") + pontosPercentuais(variacao)}</strong>
          </div>
        </div>
        <small className={styles.metaHistoricoVariacao}>
          {mensagemVariacao}
        </small>
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
        A mudança diária aparece em pontos percentuais (p.p.).
        Na mudança de etapa, a linha e a comparação são reiniciadas.
      </small>
    </div>
  );
}
