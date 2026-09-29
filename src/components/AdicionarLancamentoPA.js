"use client";

import { useRef, useState } from "react";
import styles from "@/app/pa-vendedoras/PAVendedoras.module.css";

function inicioMes(mes) {
  return `${mes}-01`;
}

function fimMes(mes) {
  const [ano, numeroMes] = mes.split("-").map(Number);
  return `${ano}-${String(numeroMes).padStart(2, "0")}-${String(new Date(ano, numeroMes, 0).getDate()).padStart(2, "0")}`;
}

export default function AdicionarLancamentoPA({ vendedora, mes, lojas, supabase, onSalvou }) {
  const [aberto, setAberto] = useState(false);
  const [lojaId, setLojaId] = useState("");
  const [data, setData] = useState("");
  const [vendas, setVendas] = useState("");
  const [pecas, setPecas] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const enviando = useRef(false);

  function abrir() {
    setLojaId(lojas[0]?.id ? String(lojas[0].id) : "");
    setData("");
    setVendas("");
    setPecas("");
    setErro("");
    setAberto(true);
  }

  async function salvar(evento) {
    evento.preventDefault();
    if (enviando.current) return;

    const idLoja = Number(lojaId);
    const v = Number(vendas);
    const p = Number(pecas);

    if (!idLoja || !lojas.some((item) => Number(item.id) === idLoja)) {
      setErro("Escolha uma loja.");
      return;
    }

    if (!data || data < inicioMes(mes) || data > fimMes(mes)) {
      setErro("Escolha uma data dentro do mês selecionado.");
      return;
    }

    if (!vendas.trim() || !pecas.trim() || !Number.isInteger(v) || !Number.isInteger(p)
      || v < 0 || p < v || p > 999 || v > 999) {
      setErro("Informe números inteiros de 0 a 999. Peças devem ser iguais ou maiores que vendas.");
      return;
    }

    enviando.current = true;
    setSalvando(true);
    setErro("");

    try {
      const { error } = await supabase.rpc("adicionar_lancamento_pa_gestao", {
        p_usuario_id: vendedora.usuario_id,
        p_data: data,
        p_loja_id: idLoja,
        p_vendas: v,
        p_pecas: p,
      });

      if (error) throw error;

      const loja = lojas.find((item) => Number(item.id) === idLoja);
      setAberto(false);
      onSalvou({ data, loja: loja?.codigo || loja?.nome || "loja" });
    } catch (error) {
      setErro(error.code === "PGRST202"
        ? "A inclusão de lançamentos pela gestão ainda precisa ser habilitada no banco."
        : error.message || "Não foi possível salvar. Confira sua conexão e tente novamente.");
    } finally {
      enviando.current = false;
      setSalvando(false);
    }
  }

  return (
    <div className={styles.addEntry}>
      <button
        type="button"
        className={styles.addEntryButton}
        onClick={abrir}
        disabled={salvando || lojas.length === 0}
        aria-expanded={aberto}
      >
        + Adicionar lançamento
      </button>

      {aberto && (
        <form className={styles.correctionForm} onSubmit={salvar} aria-label="Adicionar lançamento para vendedora">
          <p><strong>Novo lançamento · {vendedora.nome || "Vendedora"}</strong></p>

          <div className={styles.addEntryFields}>
            <label>
              Loja
              <select required value={lojaId} disabled={salvando} onChange={(e) => setLojaId(e.target.value)}>
                <option value="">Selecione</option>
                {lojas.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.codigo} — {item.nome}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Data
              <input type="date" required min={inicioMes(mes)} max={fimMes(mes)}
                value={data} disabled={salvando} onChange={(e) => setData(e.target.value)} />
            </label>

            <label>
              Vendas
              <input type="number" min="0" max="999" step="1" required value={vendas}
                disabled={salvando} onChange={(e) => setVendas(e.target.value)} />
            </label>

            <label>
              Peças
              <input type="number" min="0" max="999" step="1" required value={pecas}
                disabled={salvando} onChange={(e) => setPecas(e.target.value)} />
            </label>
          </div>

          <p className={styles.muted}>
            O lançamento será gravado no PA da vendedora. Se já existir um registro para essa loja e data, use Corrigir.
          </p>

          {erro && <p className={styles.approvalWarning} role="alert">{erro}</p>}

          <div className={styles.correctionActions}>
            <button type="button" className={styles.textButton} disabled={salvando} onClick={() => setAberto(false)}>
              Cancelar
            </button>
            <button type="submit" className={styles.saveCorrection} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar lançamento"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
