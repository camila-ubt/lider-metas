"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./ClimaTurnosPreview.module.css";

const LATITUDE_UBATUBA = -23.4339;
const LONGITUDE_UBATUBA = -45.0839;

const TURNOS = [
  { id: "manha", nome: "Manhã", inicio: 9, fim: 15 },
  { id: "noite", nome: "Noite", inicio: 16, fim: 21 },
];

const formatarDia = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
});

function resumirTurno(registros) {
  if (!registros.length) return null;

  const temperaturas = registros.map((item) => item.temperatura);
  const chuva = registros.reduce((total, item) => total + item.chuva, 0);
  const chance = Math.max(...registros.map((item) => item.chance));
  const tempMin = Math.min(...temperaturas);
  const tempMax = Math.max(...temperaturas);

  let condicao = "Tempo firme";
  if (chuva >= 15) condicao = "Chuva forte";
  else if (chuva >= 3) condicao = "Chuva";
  else if (chance >= 50) condicao = "Possível chuva";

  return {
    chuva,
    chance,
    tempMin,
    tempMax,
    condicao,
  };
}

function montarDias(hourly) {
  if (!hourly?.time?.length) return [];

  const porDia = new Map();

  hourly.time.forEach((dataHora, indice) => {
    const [data, horaTexto] = dataHora.split("T");
    const hora = Number(horaTexto.slice(0, 2));

    if (!porDia.has(data)) porDia.set(data, []);
    porDia.get(data).push({
      hora,
      temperatura: Number(hourly.temperature_2m?.[indice] ?? 0),
      chuva: Number(hourly.precipitation?.[indice] ?? 0),
      chance: Number(hourly.precipitation_probability?.[indice] ?? 0),
    });
  });

  return [...porDia.entries()].map(([data, registros]) => ({
    data,
    turnos: TURNOS.map((turno) => ({
      ...turno,
      resumo: resumirTurno(
        registros.filter(
          (registro) => registro.hora >= turno.inicio && registro.hora <= turno.fim
        )
      ),
    })),
  }));
}

export default function ClimaTurnosPreview() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function carregarClima() {
      try {
        setCarregando(true);
        setErro("");

        const parametros = new URLSearchParams({
          latitude: String(LATITUDE_UBATUBA),
          longitude: String(LONGITUDE_UBATUBA),
          hourly: "temperature_2m,precipitation_probability,precipitation",
          timezone: "America/Sao_Paulo",
          forecast_days: "7",
        });

        const resposta = await fetch(
          `https://api.open-meteo.com/v1/forecast?${parametros.toString()}`,
          { signal: controller.signal }
        );

        if (!resposta.ok) throw new Error("Não foi possível carregar a previsão.");
        setDados(await resposta.json());
      } catch (error) {
        if (error.name !== "AbortError") {
          setErro("A previsão do clima está indisponível no momento.");
        }
      } finally {
        if (!controller.signal.aborted) setCarregando(false);
      }
    }

    carregarClima();
    return () => controller.abort();
  }, []);

  const dias = useMemo(() => montarDias(dados?.hourly), [dados]);

  return (
    <section className={styles.section} aria-labelledby="titulo-clima-turnos">
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Teste de inteligência climática</span>
          <h2 id="titulo-clima-turnos">Clima por período</h2>
          <p>
            Previsão horária de Ubatuba separada nos mesmos períodos das vendas.
          </p>
        </div>
        <span className={styles.badge}>Open-Meteo · 7 dias</span>
      </div>

      <div className={styles.legend}>
        <span><b>Manhã</b> 9h–15h</span>
        <span><b>Noite</b> 16h–21h</span>
        <span>Chuva = soma prevista no período</span>
      </div>

      {carregando && <div className={styles.state}>Carregando previsão...</div>}
      {erro && <div className={styles.state}>{erro}</div>}

      {!carregando && !erro && (
        <div className={styles.days}>
          {dias.map((dia) => (
            <article className={styles.dayCard} key={dia.data}>
              <div className={styles.date}>
                {formatarDia.format(new Date(`${dia.data}T12:00:00`))}
              </div>

              <div className={styles.turnos}>
                {dia.turnos.map((turno) => {
                  const resumo = turno.resumo;
                  if (!resumo) return null;

                  return (
                    <div className={styles.turno} key={turno.id}>
                      <div className={styles.turnoTop}>
                        <strong>{turno.nome}</strong>
                        <span>{resumo.condicao}</span>
                      </div>
                      <div className={styles.metrics}>
                        <span>
                          <b>{resumo.chance}%</b>
                          chance
                        </span>
                        <span>
                          <b>{resumo.chuva.toFixed(1)} mm</b>
                          chuva
                        </span>
                        <span>
                          <b>{Math.round(resumo.tempMin)}–{Math.round(resumo.tempMax)}°</b>
                          temperatura
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      )}

      <p className={styles.note}>
        Prévia visual. Depois da aprovação, o histórico climático pode ser cruzado com as vendas de manhã e noite para medir a associação entre chuva e desempenho.
      </p>
    </section>
  );
}
