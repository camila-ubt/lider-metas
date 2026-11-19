"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import styles from "./DashboardEstavelV2.module.css";

const dinheiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

function valorOuTraco(valor) {
  return valor === null || valor === undefined ? "—" : dinheiro.format(valor);
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
  const anterior = historico.find((item) => item.dia === selecionado.dia - 1);
  const variacao = anterior
    && anterior.nivel === selecionado.nivel
    && anterior.necessario !== null && anterior.necessario > 0
    && selecionado.necessario !== null
    ? ((selecionado.necessario / anterior.necessario) - 1) * 100
    : null;
  const diaTexto = String(selecionado.dia).padStart(2, "0") + "/" + numeroMes;
  const diaParcial = mesAtual && selecionado.dia === historico[historico.length - 1].dia;

  return (
    <div className={styles.metaHistoricoConteudo}>
      <div className={styles.metaHistoricoCabecalho}>
        <div>
          <h3>Evolução por loja/dia</h3>
          <small>Necessário para atingir a próxima etapa × meta fixa da etapa</small>
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
      <div className={styles.metaHistoricoGrafico} role="group" aria-label="Gráfico da evolução diária da meta necessária">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={historico}
            margin={{ top: 12, right: 12, left: -8, bottom: 2 }}
            onClick={(estado) => {
              const dia = Number(estado?.activeLabel);
              if (Number.isInteger(dia) && dia > 0) setDiaSelecionado(dia);
            }}
          >
            <CartesianGrid stroke="#eee8f2" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="dia" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#786f81" }} minTickGap={16} />
            <YAxis
              width={57}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: "#786f81" }}
              tickFormatter={(valor) => compacto.format(valor)}
              domain={[0, "auto"]}
            />
            <Tooltip
              formatter={(valor, nome) => [valorOuTraco(valor), nome]}
              labelFormatter={(dia) => "Dia " + String(dia).padStart(2, "0") + "/" + numeroMes}
              contentStyle={{ borderRadius: 12, border: "1px solid #e7ddef", fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey="fixa"
              name="Meta fixa"
              stroke="#a7a0ae"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="necessario"
              name="Meta necessária"
              stroke="#7650a7"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 6 }}
              isAnimationActive={false}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className={styles.metaHistoricoLegenda}>
        <span><i className={styles.metaHistoricoLinhaNecessaria} /> Meta necessária</span>
        <span><i className={styles.metaHistoricoLinhaFixa} /> Meta fixa</span>
      </div>
      <div className={styles.metaHistoricoDetalhe} aria-live="polite">
        <div className={styles.metaHistoricoDetalheTopo}>
          <strong>{diaTexto}{diaParcial ? " · Em andamento" : ""}</strong>
          <span>{selecionado.nivel}</span>
        </div>
        <div className={styles.metaHistoricoValores}>
          <div><small>Necessário por loja/dia</small><strong>{valorOuTraco(selecionado.necessario)}</strong></div>
          <div><small>Meta fixa da etapa</small><strong>{valorOuTraco(selecionado.fixa)}</strong></div>
        </div>
        <small>
          {selecionado.diasRestantes} {selecionado.diasRestantes === 1 ? "dia restante" : "dias restantes"}
          {" · "}Vendido acumulado: {dinheiro.format(selecionado.acumulado)}
        </small>
        {selecionado.concluida && <small>Todas as etapas conquistadas.</small>}
        {!selecionado.concluida && selecionado.necessario === null && <small>Não restavam dias para recuperar o saldo.</small>}
        {variacao !== null && (
          <small className={styles.metaHistoricoVariacao}>
            {variacao > 0 ? "↑" : variacao < 0 ? "↓" : "→"} {Math.abs(variacao).toFixed(1).replace(".", ",")}% em relação ao dia anterior
          </small>
        )}
      </div>
      <small className={styles.metaHistoricoNota}>
        Dias anteriores: saldo após o fechamento do dia. Hoje: valor atualizado com as vendas lançadas.
        A linha fixa acompanha a etapa (Meta, Supermeta ou Megameta).
      </small>
    </div>
  );
}
