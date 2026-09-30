"use client";

import { useRef, useState } from "react";
import styles from "@/app/pa-vendedoras/PAVendedoras.module.css";

function formatarData(data) {
  if (!data) return "";
  return data.split("-").reverse().join("/");
}

function quantidadeDias(inicio, fim) {
  if (!inicio || !fim || fim < inicio) return 0;
  const [ai, mi, di] = inicio.split("-").map(Number);
  const [af, mf, df] = fim.split("-").map(Number);
  const primeiro = Date.UTC(ai, mi - 1, di);
  const ultimo = Date.UTC(af, mf - 1, df);
  return Math.floor((ultimo - primeiro) / 86400000) + 1;
}

export default function RegistrarFeriasPA({ vendedora, supabase, onSalvou }) {
  const [aberto, setAberto] = useState(false);
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const enviando = useRef(false);

  function abrir() {
    setInicio("");
    setFim("");
    setErro("");
    setAberto(true);
  }

  async function salvar(evento) {
    evento.preventDefault();
    if (enviando.current) return;

    const dias = quantidadeDias(inicio, fim);
    if (!inicio || !fim || dias <= 0) {
      setErro("Confira as datas de início e fim das férias.");
      return;
    }

    if (dias > 62) {
      setErro("Registre no máximo 62 dias por vez.");
      return;
    }

    const confirmou = window.confirm(
      `Registrar férias de ${formatarData(inicio)} a ${formatarData(fim)} para ${vendedora.nome || "a vendedora"}? Se houver lançamentos nesse período, eles serão removidos do PA.`,
    );
    if (!confirmou) return;

    enviando.current = true;
    setSalvando(true);
    setErro("");

    try {
      const { data, error } = await supabase.rpc("registrar_ferias_pa_gestao", {
        p_usuario_id: vendedora.usuario_id,
        p_inicio: inicio,
        p_fim: fim,
      });

      if (error) throw error;

      setAberto(false);
      onSalvou({
        inicio,
        fim,
        dias: Number(data?.dias || dias),
        lancamentosRemovidos: Number(data?.lancamentos_removidos || 0),
      });
    } catch (error) {
      setErro(error.code === "PGRST202"
        ? "O registro de férias pela gestão ainda precisa ser habilitado no banco."
        : error.message || "Não foi possível registrar as férias. Tente novamente.");
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
        disabled={salvando}
        aria-expanded={aberto}
      >
        Registrar férias
      </button>

      {aberto && (
        <form className={styles.correctionForm} onSubmit={salvar} aria-label="Registrar férias da vendedora">
          <p><strong>Período de férias · {vendedora.nome || "Vendedora"}</strong></p>

          <div className={styles.vacationFields}>
            <label>
              Início
              <input
                type="date"
                required
                value={inicio}
                disabled={salvando}
                onChange={(e) => setInicio(e.target.value)}
              />
            </label>

            <label>
              Fim
              <input
                type="date"
                required
                min={inicio || undefined}
                value={fim}
                disabled={salvando}
                onChange={(e) => setFim(e.target.value)}
              />
            </label>
          </div>

          <p className={styles.muted}>
            Os dias do intervalo serão marcados como férias e não contarão como dias trabalhados. Se houver vendas lançadas nessas datas, elas serão removidas após a confirmação.
          </p>

          {erro && <p className={styles.approvalWarning} role="alert">{erro}</p>}

          <div className={styles.correctionActions}>
            <button type="button" className={styles.textButton} disabled={salvando} onClick={() => setAberto(false)}>
              Cancelar
            </button>
            <button type="submit" className={styles.saveCorrection} disabled={salvando}>
              {salvando ? "Salvando..." : "Registrar férias"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
