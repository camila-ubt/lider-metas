"use client";

import { useMemo, useState } from "react";
import { validarProjecoesHistoricas } from "@/lib/validacaoProjecoes.mjs";
import { verificarQualidadeLancamentos } from "@/lib/qualidadeDados.mjs";
import RegistroPrevisoes from "./RegistroPrevisoes";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percentual = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const DIAS = [5, 10, 15, 20, 25];

function mostrarMoeda(valor) {
  return valor === null ? "—" : moeda.format(valor);
}

function mostrarPercentual(valor) {
  return valor === null ? "—" : percentual.format(valor) + "%";
}

export default function LaboratorioValidacao({
  historicos, lojas, ano, numeroMes, filtroLoja, filtroPeriodo,
  vendasAtuais = [], metasAtuais = [], diaLimite = 0, mesEncerrado = false,
}) {
  const [anosAtras, setAnosAtras] = useState("1");
  const anoTeste = ano - Number(anosAtras);
  const lojasTeste = useMemo(() =>
    lojas.filter((loja) => filtroLoja === "geral" || String(loja.id) === String(filtroLoja)),
    [lojas, filtroLoja],
  );
  const resultado = useMemo(() => validarProjecoesHistoricas({
    vendas: historicos,
    historicos,
    lojas: lojasTeste,
    ano: anoTeste,
    numeroMes,
    periodo: filtroPeriodo,
    diasCorte: DIAS,
  }), [historicos, lojasTeste, anoTeste, numeroMes, filtroPeriodo]);

  const qualidade = useMemo(() => verificarQualidadeLancamentos({
    vendas: vendasAtuais, metas: metasAtuais,
    lojas: lojasTeste, ano, numeroMes,
    diaConcluido: Math.max(0, diaLimite - (mesEncerrado ? 0 : 1)), filtroLoja, filtroPeriodo,
  }), [vendasAtuais, metasAtuais, lojasTeste, ano, numeroMes, diaLimite, mesEncerrado, filtroLoja, filtroPeriodo]);

  return (
    <div style={{ display: "grid", gap: 10, fontSize: 13 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span>Simular fechamento de</span>
        <select
          value={anosAtras}
          onChange={(evento) => setAnosAtras(evento.target.value)}
          aria-label="Ano para validação retrospectiva"
        >
          <option value="1">{ano - 1}</option>
          <option value="2">{ano - 2}</option>
        </select>
      </label>
      <p style={{ margin: 0 }}>
        Usa os filtros de loja e período do Comparativo histórico.
        Em cada data (5, 10, 15, 20 e 25), mostra quanto o sistema previa
        para o fechamento do mês, considerando as vendas registradas até então.
      </p>
      <small role="status" style={{ color: qualidade.status === "inconsistente" ? "#b42318" : undefined }}>
        Conferência do mês exibido {mesEncerrado ? "completo" : "até ontem"}: {qualidade.faltantes} lançamentos ausentes,{" "}
        {qualidade.duplicados} duplicados, {qualidade.invalidos} incompatíveis e{" "}
        {qualidade.metasAusentes + qualidade.metasDuplicadas + qualidade.metasInvalidas} problemas de metas.
        {qualidade.exemplos.length > 0 ? " Exemplos: " + qualidade.exemplos.join("; ") : ""}
      </small>
      {resultado.status === "base_incompleta" ? (
        <p role="status" style={{ margin: 0 }}>
          Sem avaliação: {resultado.faltantes} lançamentos ausentes,{" "}
          {resultado.duplicados} duplicados e {resultado.invalidos} inválidos.
          Dias sem registro não são considerados vendas de R$ 0.
        </p>
      ) : resultado.status !== "ok" ? (
        <p role="status" style={{ margin: 0 }}>Selecione uma loja e período válidos.</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <span><b>Realizado:</b> {mostrarMoeda(resultado.totalRealizado)}</span>
            <span><b>MAPE:</b> {mostrarPercentual(resultado.metricas.mape)}</span>
            <span><b>MAE:</b> {mostrarMoeda(resultado.metricas.mae)}</span>
            <span><b>Viés:</b> {mostrarMoeda(resultado.metricas.vies)}</span>
          </div>
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 470, borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  {["Dia", "Previsão", "Fechamento real", "Erro (R$)", "Erro (%)"].map((nome) => (
                    <th key={nome} scope="col" style={{ textAlign: "right", padding: "6px 4px", borderBottom: "1px solid #ddd" }}>{nome}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resultado.previsoes.map((item) => (
                  <tr key={item.diaCorte}>
                    <td style={{ textAlign: "right", padding: "6px 4px" }}>{item.diaCorte}</td>
                    <td style={{ textAlign: "right", padding: "6px 4px" }}>{mostrarMoeda(item.previsto)}</td>
                    <td style={{ textAlign: "right", padding: "6px 4px" }}>{mostrarMoeda(item.realizado)}</td>
                    <td style={{ textAlign: "right", padding: "6px 4px" }}>{mostrarMoeda(item.erro)}</td>
                    <td style={{ textAlign: "right", padding: "6px 4px" }}>{mostrarPercentual(item.erroPercentual)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <small>
            MAE: erro absoluto médio em reais. MAPE: erro percentual absoluto médio.
            Viés positivo indica previsão acima do realizado; negativo, abaixo.
            Cada comparação usa o mesmo fechamento do mês e não representa uma amostra independente.
          </small>
        </>
      )}
      <hr style={{ border: 0, borderTop: "1px solid var(--border, #ddd)", width: "100%" }} />
      <RegistroPrevisoes lojas={lojasTeste} ano={ano} numeroMes={numeroMes}
        filtroLoja={filtroLoja} filtroPeriodo={filtroPeriodo} />
    </div>
  );
}
