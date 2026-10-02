"use client";

import { useEffect, useMemo, useState } from "react";
import {
  calcularMetasDiariasLoja,
  formatarMesAno,
} from "@/lib/metasImpressao.mjs";
import styles from "./MetasImpressao.module.css";

const dinheiroInteiro = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function codigoLoja(loja) {
  return String(loja?.codigo || loja?.nome || "LOJA").toUpperCase();
}

export default function MetasImpressao({ mes, metas, lojas }) {
  const [aberto, setAberto] = useState(false);

  const impressos = useMemo(() => {
    const [ano, numeroMes] = String(mes).split("-").map(Number);
    const totalDias = ano && numeroMes ? new Date(ano, numeroMes, 0).getDate() : 0;

    return (lojas || []).map((loja) => ({
      loja,
      linhas: calcularMetasDiariasLoja({
        metas,
        lojaId: loja.id,
        totalDias,
      }),
    }));
  }, [lojas, metas, mes]);

  useEffect(() => {
    function limparModoImpressao() {
      document.body.classList.remove("metas-print-active");
      document.getElementById("metas-print-sheet")?.remove();
    }

    window.addEventListener("afterprint", limparModoImpressao);
    return () => {
      window.removeEventListener("afterprint", limparModoImpressao);
      limparModoImpressao();
    };
  }, []);

  function imprimir() {
    document.getElementById("metas-print-sheet")?.remove();

    const origem = document.getElementById("metas-print-root");
    if (!origem) return;

    const folha = origem.cloneNode(true);
    folha.id = "metas-print-sheet";
    document.body.appendChild(folha);
    document.body.classList.add("metas-print-active");

    window.requestAnimationFrame(() => window.print());
  }

  if (!impressos.length) return null;

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: 80mm 297mm;
            margin: 0;
          }

          body.metas-print-active {
            width: 80mm !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            background: #fff !important;
          }

          body.metas-print-active > *:not(#metas-print-sheet) {
            display: none !important;
          }

          body.metas-print-active #metas-print-sheet {
            display: block !important;
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 80mm !important;
            margin: 0 !important;
            padding: 3mm 2mm 0 !important;
            box-sizing: border-box !important;
            background: #fff !important;
            color: #000 !important;
            font-family: Arial, Helvetica, sans-serif !important;
          }

          body.metas-print-active #metas-print-sheet .meta-ticket {
            width: 76mm !important;
            margin: 0 0 5mm !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            color: #000 !important;
          }

          body.metas-print-active #metas-print-sheet .meta-ticket-title {
            margin: 0 0 1.5mm !important;
            text-align: center !important;
            font-size: 12pt !important;
            font-weight: 700 !important;
            line-height: 1.1 !important;
          }

          body.metas-print-active #metas-print-sheet .meta-ticket table {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
            font-size: 8.5pt !important;
          }

          body.metas-print-active #metas-print-sheet .meta-ticket th,
          body.metas-print-active #metas-print-sheet .meta-ticket td {
            border: 0.35mm solid #000 !important;
            padding: 1mm 0.35mm !important;
            text-align: center !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
            color: #000 !important;
            background: #fff !important;
          }

          body.metas-print-active #metas-print-sheet .meta-ticket th:first-child,
          body.metas-print-active #metas-print-sheet .meta-ticket td:first-child {
            width: 7mm !important;
            font-weight: 700 !important;
          }

          body.metas-print-active #metas-print-sheet .meta-ticket thead th {
            font-weight: 700 !important;
          }

          body.metas-print-active #metas-print-sheet .meta-ticket-separator {
            margin-top: 2mm !important;
            border-bottom: 0.3mm dashed #000 !important;
          }
        }
      `}</style>

      <button
        type="button"
        className="secondary-button"
        onClick={() => setAberto(true)}
      >
        Imprimir metas
      </button>

      {aberto && (
        <div className={styles.backdrop}>
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-impressao-metas"
          >
            <div className={styles.header}>
              <div>
                <p>Metas diárias</p>
                <h2 id="titulo-impressao-metas">{formatarMesAno(mes)}</h2>
              </div>
              <button
                type="button"
                className={styles.close}
                onClick={() => setAberto(false)}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <p className={styles.hint}>
              A impressão usa a bobina de 80 mm e gera um quadro para cada loja.
            </p>

            <div id="metas-print-root" className={styles.printArea}>
              {impressos.map(({ loja, linhas }) => (
                <article className={`meta-ticket ${styles.ticket}`} key={loja.id}>
                  <div className={`meta-ticket-title ${styles.ticketTitle}`}>
                    {formatarMesAno(mes)}
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>{codigoLoja(loja)}</th>
                        <th>Meta Dia</th>
                        <th>Super Dia</th>
                        <th>Mega Dia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map((linha) => (
                        <tr key={linha.sigla}>
                          <th>{linha.sigla}</th>
                          <td>{dinheiroInteiro.format(linha.meta)}</td>
                          <td>{dinheiroInteiro.format(linha.super)}</td>
                          <td>{dinheiroInteiro.format(linha.mega)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className={`meta-ticket-separator ${styles.separator}`} />
                </article>
              ))}
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setAberto(false)}
              >
                Fechar
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={imprimir}
              >
                Imprimir as lojas
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
