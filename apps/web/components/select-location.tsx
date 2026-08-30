"use client";

import { useEffect, useState } from "react";

interface Props {
  stateValue?: string;
  cityValue?: string;
  onChangeState?: (uf: string) => void;
  onChangeCity?: (city: string) => void;
  stateLabel?: string;
  cityLabel?: string;
  // pt-BR aliases
  valorEstado?: string;
  valorCidade?: string;
  onChangeEstado?: (uf: string) => void;
  onChangeCidade?: (cidade: string) => void;
  labelEstado?: string;
  labelCidade?: string;
}

export function SelectLocation({
  stateValue,
  cityValue,
  onChangeState,
  onChangeCity,
  stateLabel = "Estado",
  cityLabel = "Cidade",
  valorEstado,
  valorCidade,
  onChangeEstado,
  onChangeCidade,
  labelEstado,
  labelCidade,
}: Props) {
  const currentUf = stateValue ?? valorEstado ?? "";
  const currentCity = cityValue ?? valorCidade ?? "";
  const effectiveChangeState = onChangeState ?? onChangeEstado ?? (() => {});
  const effectiveChangeCity = onChangeCity ?? onChangeCidade ?? (() => {});
  const effectiveLabelState = labelEstado ?? stateLabel;
  const effectiveLabelCity = labelCidade ?? cityLabel;

  const [cities, setCities] = useState<readonly string[]>([]);

  useEffect(() => {
    if (!currentUf) {
      setCities([]);
      return;
    }
    let cancel = false;
    import("@oficina/domain/cities").then((mod) => {
      if (cancel) return;
      const map = mod.CITIES_BY_STATE ?? (mod as any).CIDADES_POR_UF ?? {};
      setCities(map[currentUf] ?? []);
    });
    return () => {
      cancel = true;
    };
  }, [currentUf]);

  function handleStateChange(uf: string) {
    effectiveChangeState(uf);
    effectiveChangeCity("");
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label
          htmlFor="estado-uf"
          className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted"
        >
          {effectiveLabelState}
        </label>
        <select
          id="estado-uf"
          className="field-input !pl-4"
          value={currentUf}
          onChange={(e) => handleStateChange(e.target.value)}
        >
          <option value="">Selecione…</option>
          <StateOptions />
        </select>
      </div>
      <div>
        <label
          htmlFor="cidade-nome"
          className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted"
        >
          {effectiveLabelCity}
        </label>
        <select
          id="cidade-nome"
          className="field-input !pl-4"
          value={currentCity}
          onChange={(e) => effectiveChangeCity(e.target.value)}
          disabled={!currentUf}
        >
          <option value="">
            {currentUf ? "Selecione a cidade…" : "Selecione o estado primeiro"}
          </option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function StateOptions() {
  const states = [
    { uf: "AC", name: "Acre" },
    { uf: "AL", name: "Alagoas" },
    { uf: "AP", name: "Amapá" },
    { uf: "AM", name: "Amazonas" },
    { uf: "BA", name: "Bahia" },
    { uf: "CE", name: "Ceará" },
    { uf: "DF", name: "Distrito Federal" },
    { uf: "ES", name: "Espírito Santo" },
    { uf: "GO", name: "Goiás" },
    { uf: "MA", name: "Maranhão" },
    { uf: "MT", name: "Mato Grosso" },
    { uf: "MS", name: "Mato Grosso do Sul" },
    { uf: "MG", name: "Minas Gerais" },
    { uf: "PA", name: "Pará" },
    { uf: "PB", name: "Paraíba" },
    { uf: "PR", name: "Paraná" },
    { uf: "PE", name: "Pernambuco" },
    { uf: "PI", name: "Piauí" },
    { uf: "RJ", name: "Rio de Janeiro" },
    { uf: "RN", name: "Rio Grande do Norte" },
    { uf: "RS", name: "Rio Grande do Sul" },
    { uf: "RO", name: "Rondônia" },
    { uf: "RR", name: "Roraima" },
    { uf: "SC", name: "Santa Catarina" },
    { uf: "SP", name: "São Paulo" },
    { uf: "SE", name: "Sergipe" },
    { uf: "TO", name: "Tocantins" },
  ];
  return (
    <>
      {states.map((e) => (
        <option key={e.uf} value={e.uf}>
          {e.uf} — {e.name}
        </option>
      ))}
    </>
  );
}

export { SelectLocation as SelectEstadoCidade };
