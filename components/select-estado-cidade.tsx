"use client";

import { useEffect, useState } from "react";

interface Props {
  valorEstado: string;
  valorCidade: string;
  onChangeEstado: (uf: string) => void;
  onChangeCidade: (cidade: string) => void;
  labelEstado?: string;
  labelCidade?: string;
}

export function SelectEstadoCidade({
  valorEstado,
  valorCidade,
  onChangeEstado,
  onChangeCidade,
  labelEstado = "Estado",
  labelCidade = "Cidade",
}: Props) {
  const [cidades, setCidades] = useState<readonly string[]>([]);

  // carrega as cidades do estado selecionado via dynamic import
  useEffect(() => {
    if (!valorEstado) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCidades([]);
      return;
    }
    let cancel = false;
    import("@/lib/cidades-br").then((mod) => {
      if (cancel) return;
      setCidades(mod.CIDADES_POR_UF[valorEstado] ?? []);
    });
    return () => {
      cancel = true;
    };
  }, [valorEstado]);

  function handleEstadoChange(uf: string) {
    onChangeEstado(uf);
    onChangeCidade("");
  }

  return (
    // Empilha no celular. Lado a lado em 390px sobra menos de 170px por campo,
    // e o texto era cortado no meio — "Selecione o es…". Da largura do tablet
    // em diante voltam a dividir a linha.
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label
          htmlFor="estado-uf"
          className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted"
        >
          {labelEstado}
        </label>
        <select
          id="estado-uf"
          className="field-input !pl-4"
          value={valorEstado}
          onChange={(e) => handleEstadoChange(e.target.value)}
        >
          <option value="">Selecione…</option>
          <EstadoOptions />
        </select>
      </div>
      <div>
        <label
          htmlFor="cidade-nome"
          className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted"
        >
          {labelCidade}
        </label>
        <select
          id="cidade-nome"
          className="field-input !pl-4"
          value={valorCidade}
          onChange={(e) => onChangeCidade(e.target.value)}
          disabled={!valorEstado}
        >
          <option value="">
            {valorEstado ? "Selecione a cidade…" : "Selecione o estado primeiro"}
          </option>
          {cidades.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// componente separado pra renderizar as opções de estado sem carregar o bundle de cidades
function EstadoOptions() {
  // lazy: os nomes dos estados são poucos (27), então é seguro importar direto
  const estados = [
    { uf: "AC", nome: "Acre" },
    { uf: "AL", nome: "Alagoas" },
    { uf: "AP", nome: "Amapá" },
    { uf: "AM", nome: "Amazonas" },
    { uf: "BA", nome: "Bahia" },
    { uf: "CE", nome: "Ceará" },
    { uf: "DF", nome: "Distrito Federal" },
    { uf: "ES", nome: "Espírito Santo" },
    { uf: "GO", nome: "Goiás" },
    { uf: "MA", nome: "Maranhão" },
    { uf: "MT", nome: "Mato Grosso" },
    { uf: "MS", nome: "Mato Grosso do Sul" },
    { uf: "MG", nome: "Minas Gerais" },
    { uf: "PA", nome: "Pará" },
    { uf: "PB", nome: "Paraíba" },
    { uf: "PR", nome: "Paraná" },
    { uf: "PE", nome: "Pernambuco" },
    { uf: "PI", nome: "Piauí" },
    { uf: "RJ", nome: "Rio de Janeiro" },
    { uf: "RN", nome: "Rio Grande do Norte" },
    { uf: "RS", nome: "Rio Grande do Sul" },
    { uf: "RO", nome: "Rondônia" },
    { uf: "RR", nome: "Roraima" },
    { uf: "SC", nome: "Santa Catarina" },
    { uf: "SP", nome: "São Paulo" },
    { uf: "SE", nome: "Sergipe" },
    { uf: "TO", nome: "Tocantins" },
  ];
  return (
    <>
      {estados.map((e) => (
        <option key={e.uf} value={e.uf}>
          {e.uf} — {e.nome}
        </option>
      ))}
    </>
  );
}
