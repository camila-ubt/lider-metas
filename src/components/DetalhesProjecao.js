"use client";

import { useMemo, useState } from "react";
import { contextoDoMes, fraseSemBase } from "@/lib/contextoMes";
import { analisarIndicadoresGerenciais } from "@/lib/indicadoresGerenciais.mjs";
import { minutosDoHorario } from "@/lib/horariosPeriodos";
import ProbabilidadesMetas from "./ProbabilidadesMetas";
import RegistroPrevisoes from "./RegistroPrevisoes";
import styles from "./DetalhesProjecao.module.css";

const dinheiro = new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL",
});
const percentual = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
});

// Painel aberto pelo cartão de projeção no topo, sem duplicar o laboratório.
export default function DetalhesProjecao({
  mes, vendas, metas, lojas, historicos, minutosAgora, horarios,
}) {
  const [filtroLoja, setFiltroLoja] = useState("geral");
  const [filtroPeriodo, setFiltroPeriodo] = useState("todos");
  const contexto = useMemo(() => contextoDoMes(mes), [mes]);
  const analise = useMemo(() => analisarIndicadoresGerenciais({
    vendas, metas, lojas, historicos, contexto, minutosAgora,
    fimManha: minutosDoHorario(horarios.manhaFim),
    fimNoite: minutosDoHorario(horarios.noiteFim),
    filtroLoja, filtroPeriodo,
  }), [vendas, metas, lojas, historicos, contexto, minutosAgora,
    horarios.manhaFim, horarios.noiteFim, filtroLoja, filtroPeriodo]);

  const encerrado = contexto.tipo === "encerrado";
  const futuro = contexto.tipo === "futuro";
  const dadosDisponiveis = analise.temMeta && analise.temVendas;
  const lojaSelecionada = filtroLoja === "geral" ||
    lojas.some((loja) => String(loja.id) === String(filtroLoja));
  const escopoLoja = lojaSelecionada ? filtroLoja : "geral";

  return (
    <div className={styles.conteudo}>
      <div className={styles.filtros}>
        <label>
          <span>Loja</span>
          <select aria-label="Loja da projeção e das previsões diárias"
            value={escopoLoja} onChange={(evento) => setFiltroLoja(evento.target.value)}>
            <option value="geral">Todas as lojas</option>
            {lojas.map((loja) => (
              <option value={loja.id} key={loja.id}>{loja.codigo || loja.nome}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Período</span>
          <select aria-label="Período da projeção e das previsões diárias"
            value={filtroPeriodo} onChange={(evento) => setFiltroPeriodo(evento.target.value)}>
            <option value="todos">Manhã e noite</option>
            <option value="manha">Manhã</option>
            <option value="noite">Noite</option>
          </select>
        </label>
      </div>

      <section className={styles.bloco} aria-label={encerrado ? "Resultado final do mês" : "Projeção do mês"}>
        <h3>{encerrado ? "Resultado final do mês" : "Projeção do mês"}</h3>
        {futuro || !dadosDisponiveis ? (
          <p className={styles.semDados}>
            {fraseSemBase(contexto.tipo, analise.temMeta, analise.temVendas)}
          </p>
        ) : (
          <div className={styles.resultado}>
            <span>{encerrado ? "Vendido no mês" : "Fechamento estimado do mês"}</span>
            <strong>{dinheiro.format(
              encerrado ? analise.totalVendido : analise.projecaoOperacional ?? 0
            )}</strong>
            {encerrado ? (
              <small>{percentual.format(
                analise.totalMeta > 0 ? analise.totalVendido / analise.totalMeta * 100 : 0
              )}% da meta do escopo selecionado.</small>
            ) : (
              <>
                <ProbabilidadesMetas
                  ano={contexto.ano} numeroMes={contexto.numeroMes}
                  diaLimite={contexto.diaCorte} tipo={contexto.tipo}
                  lojas={lojas} vendas={vendas} metas={metas}
                  projecaoMensal={analise.projecaoOperacional}
                  filtroLoja={escopoLoja} filtroPeriodo={filtroPeriodo}
                />
                {analise.pendentes > 0 && (
                  <small>{analise.pendentes} lançamentos encerrados ainda pendentes no recorte.</small>
                )}
              </>
            )}
          </div>
        )}
      </section>

      <section className={styles.bloco} aria-label="Previsões diárias registradas">
        <RegistroPrevisoes
          lojas={lojas} ano={contexto.ano} numeroMes={contexto.numeroMes}
          filtroLoja={escopoLoja} filtroPeriodo={filtroPeriodo}
        />
      </section>
    </div>
  );
}
