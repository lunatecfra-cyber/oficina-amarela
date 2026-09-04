"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  STYLES,
  HEADLINES,
  MAX_STYLES,
  MAX_HEADLINES,
  NICHES,
  EDITING_LEVELS,
  PC_SETUPS,
  SOFTWARES,
  type OptionWithPhrase,
} from "@/lib/profile";
import { initials, DEFAULT_TINT } from "@/lib/candidates";
import type { EditorOnboarding } from "@/lib/profile-db";
import { SelectLocation } from "@/components/select-location";
import { WhatsappField, onlyDigits } from "@/components/whatsapp-field";
import { compressPhoto } from "@/lib/compress-photo";
import { mensagemDeErro } from "@/lib/api-errors";

function parseLocation(value: string): { state: string; city: string } {
  if (!value) return { state: "", city: "" };
  const match = value.match(/^(.+?)[/,]\s*([A-Z]{2})$/);
  if (match) return { state: match[2], city: match[1].trim() };
  return { state: "", city: "" };
}

type Tab = "identity" | "desk" | "portfolio";

const TABS: { key: Tab; label: string }[] = [
  { key: "identity", label: "Identidade" },
  { key: "desk", label: "A Bancada" },
  { key: "portfolio", label: "Portfólio" },
];

function chip(active: boolean, disabled = false) {
  return `rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
    disabled ? "cursor-not-allowed opacity-40" : ""
  } ${
    active
      ? "border-gold-lo bg-gold/10 text-gold-hi"
      : "border-line bg-surface text-muted hover:border-gold/30 hover:text-text"
  }`;
}

function cardClass(active: boolean) {
  return `w-full rounded-xl border p-3 text-left transition-colors ${
    active
      ? "border-gold-lo bg-gold/10"
      : "border-line bg-surface hover:border-gold/30"
  }`;
}

function CardSelector({
  options,
  value,
  onSelect,
}: {
  options: OptionWithPhrase[];
  value: string;
  onSelect: (label: string) => void;
}) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      {options.map((o) => {
        const label = o.label ?? (o as any).rotulo;
        const phrase = o.phrase ?? (o as any).frase;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onSelect(label)}
            aria-pressed={value === label}
            className={cardClass(value === label)}
          >
            <p className="text-sm font-medium text-text">{label}</p>
            <p className="mt-0.5 text-xs text-muted">{phrase}</p>
          </button>
        );
      })}
    </div>
  );
}

export function CreateEditorProfileForm({
  initial,
  inicial,
}: {
  initial?: EditorOnboarding;
  inicial?: EditorOnboarding;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const data = initial ?? inicial ?? {
    name: "",
    nome: "",
    headline: [],
    location: "",
    localizacao: "",
    bio: "",
    editingLevel: "",
    nivelEdicao: "",
    pcSetup: "",
    setupPc: "",
    softwares: [],
    styles: [],
    estilos: [],
    portfolioLink: "",
    niche: [],
    nicho: [],
  };

  const [activeTab, setActiveTab] = useState<Tab>("identity");
  const [name, setName] = useState(data.name ?? (data as any).nome ?? "");
  const [photo, setPhoto] = useState<string | undefined>(data.photoUrl ?? (data as any).avatarUrl ?? (data as any).fotoUrl);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const parsed = parseLocation(data.location ?? (data as any).localizacao ?? "");
  const [stateUf, setStateUf] = useState(parsed.state);
  const [cityName, setCityName] = useState(parsed.city);
  const [headline, setHeadline] = useState<string[]>(data.headline ?? []);
  const [bio, setBio] = useState(data.bio ?? "");

  const [editingLevel, setEditingLevel] = useState(data.editingLevel ?? (data as any).nivelEdicao ?? "");
  const [pcSetup, setPcSetup] = useState(data.pcSetup ?? (data as any).setupPc ?? "");
  const [softwares, setSoftwares] = useState<string[]>(data.softwares ?? []);
  const [styles, setStyles] = useState<string[]>(data.styles ?? (data as any).estilos ?? []);

  const [portfolioLink, setPortfolioLink] = useState(data.portfolioLink ?? "");
  const [whatsapp, setWhatsapp] = useState(onlyDigits((data as any).whatsapp ?? ""));
  const [niche, setNiche] = useState<string[]>(data.niche ?? (data as any).nicho ?? []);

  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function onChoosePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingPhoto(true);
    setPhotoError("");

    const r = await compressPhoto(file);
    if (!r.ok) {
      setPhotoError(r.error ?? (r as any).erro ?? "Erro ao comprimir foto");
      setIsProcessingPhoto(false);
      return;
    }
    setPhoto(r.dataUrl);
    setIsProcessingPhoto(false);
  }

  function toggleSoftware(s: string) {
    setSoftwares((a) => (a.includes(s) ? a.filter((x) => x !== s) : [...a, s]));
  }

  function toggleStyle(s: string) {
    setStyles((a) => {
      if (a.includes(s)) return a.filter((x) => x !== s);
      if (a.length >= MAX_STYLES) return a;
      return [...a, s];
    });
  }

  function toggleNiche(n: string) {
    setNiche((a) => (a.includes(n) ? a.filter((x) => x !== n) : [...a, n]));
  }

  function toggleHeadline(h: string) {
    setHeadline((a) => {
      if (a.includes(h)) return a.filter((x) => x !== h);
      if (a.length >= MAX_HEADLINES) return a;
      return [...a, h];
    });
  }

  const stepIndex = TABS.findIndex((a) => a.key === activeTab);
  const stepNumber = stepIndex + 1;
  const progress = Math.round((stepNumber / TABS.length) * 100);

  function advanceTo(t: Tab) {
    if (activeTab === "identity" && !name.trim()) {
      setError("Precisa do seu nome pra continuar.");
      return;
    }
    setError("");
    setActiveTab(t);
  }

  async function handleFinish() {
    if (!name.trim()) {
      setError("Precisa do seu nome pra continuar.");
      setActiveTab("identity");
      return;
    }
    setError("");
    setIsSaving(true);

    const locationStr = cityName ? `${cityName}/${stateUf}` : "";

    const resp = await fetch("/api/editor/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        photoUrl: photo,
        location: locationStr,
        headline,
        bio,
        editingLevel,
        pcSetup,
        softwares,
        styles,
        portfolioLink,
        whatsapp,
        niche,
        // compatibility aliases
        nome: name,
        localizacao: locationStr,
        nivelEdicao: editingLevel,
        setupPc: pcSetup,
        estilos: styles,
        nicho: niche,
      }),
    });
    setIsSaving(false);

    if (!resp.ok) {
      setError(mensagemDeErro(resp.status, "Não deu pra salvar. Tenta de novo."));
      return;
    }

    router.push("/editor");
    router.refresh();
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="mb-2 flex items-center justify-between text-xs text-muted-2">
        <span>
          Perfil do editor · etapa {stepNumber} de {TABS.length}
        </span>
        <span>{progress}%</span>
      </div>
      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold-lo to-gold-hi transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mb-6 flex items-center gap-1 rounded-xl border border-line bg-surface-2 p-1">
        {TABS.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => setActiveTab(a.key)}
            className={`min-h-11 flex-1 rounded-lg px-1.5 py-2 text-xs font-medium leading-tight transition-colors sm:px-3 sm:text-sm ${
              activeTab === a.key ? "bg-gold/10 text-gold-hi" : "text-muted hover:text-text"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mb-5 text-sm text-danger">
          {error}
        </p>
      )}

      {activeTab === "identity" && (
        <section className="reveal flex flex-col gap-8">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-text">
              Quem é você
            </h2>
            <p className="mt-1 text-sm text-muted">
              É o que o porta-voz vê antes de escolher quem edita. A foto é
              opcional: sem ela, usamos suas iniciais.
            </p>

            <div className="mt-5 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="group relative grid h-28 w-28 place-items-center overflow-hidden rounded-2xl border border-dashed border-line bg-surface transition-colors hover:border-gold/50"
                >
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="Sua foto" className="h-full w-full object-cover" />
                  ) : (
                    <span
                      className="grid h-full w-full place-items-center font-[family-name:var(--font-display)] text-3xl font-semibold text-black/80"
                      style={{ background: DEFAULT_TINT }}
                    >
                      {initials(name || (data.name ?? (data as any).nome ?? ""))}
                    </span>
                  )}
                  <span className="absolute inset-0 hidden items-center justify-center bg-ink/60 text-xs font-medium text-silver-hi group-hover:flex">
                    {photo ? "Trocar" : "Enviar foto"}
                  </span>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onChoosePhoto}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={isProcessingPhoto}
                  className="mt-2 text-xs font-medium text-gold-hi hover:underline disabled:opacity-60"
                >
                  {isProcessingPhoto
                    ? "Preparando…"
                    : photo
                      ? "Escolher outra"
                      : "Escolher da galeria"}
                </button>

                {photoError && (
                  <p role="alert" className="mt-2 max-w-[11rem] text-center text-[11px] text-danger">
                    {photoError}
                  </p>
                )}
                {photo && (
                  <button
                    type="button"
                    onClick={() => setPhoto(undefined)}
                    className="mt-1 text-[11px] text-muted-2 hover:text-muted"
                  >
                    Pular por agora (usar iniciais)
                  </button>
                )}
              </div>

              <div className="w-full flex-1">
                <label
                  htmlFor="name"
                  className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted"
                >
                  Nome
                </label>
                <input
                  id="name"
                  className="field-input !pl-4"
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError("");
                  }}
                />
              </div>
            </div>

            <div className="mt-4">
              <SelectLocation
                stateValue={stateUf}
                cityValue={cityName}
                onChangeState={setStateUf}
                onChangeCity={setCityName}
              />
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
                Especialidades
              </label>
              <p className="mb-2 text-xs text-muted-2">
                Até {MAX_HEADLINES}. É o que casa você com o porta-voz na hora do match.
              </p>
              <div className="flex flex-col gap-3">
                {HEADLINES.map((group) => {
                  const category = group.category ?? (group as any).categoria;
                  return (
                    <div key={category}>
                      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-2">
                        {category}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {group.tags.map((h) => {
                          const active = headline.includes(h);
                          const blocked = !active && headline.length >= MAX_HEADLINES;
                          return (
                            <button
                              key={h}
                              type="button"
                              onClick={() => {
                                toggleHeadline(h);
                                setError("");
                              }}
                              disabled={blocked}
                              aria-pressed={active}
                              className={chip(active, blocked)}
                            >
                              {h}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              {headline.length >= MAX_HEADLINES && (
                <p className="mt-2 text-xs text-muted-2">Máximo de {MAX_HEADLINES} especialidades.</p>
              )}
            </div>

            <div className="mt-4">
              <label
                htmlFor="bio"
                className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted"
              >
                Bio curta
              </label>
              <textarea
                id="bio"
                rows={3}
                className="field-input !pl-4 resize-none"
                placeholder="Breve descrição da sua experiência ou estilo."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>
          </div>

          <button
            type="button"
            className="btn-gold self-start"
            onClick={() => advanceTo("desk")}
          >
            Avançar →
          </button>
        </section>
      )}

      {activeTab === "desk" && (
        <section className="reveal flex flex-col gap-8">
          <button
            type="button"
            onClick={() => setActiveTab("identity")}
            className="-mt-2 self-start text-xs font-medium text-muted hover:text-gold-hi"
          >
            ← Voltar (identidade)
          </button>
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-text">
              Nível de edição
            </h2>
            <p className="mt-1 text-sm text-muted">Sem julgamento — é só pra calibrar sua fila.</p>
            <CardSelector options={EDITING_LEVELS} value={editingLevel} onSelect={setEditingLevel} />
          </div>

          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-text">
              Poder de processamento
            </h2>
            <p className="mt-1 text-sm text-muted">O setup que você usa pra editar.</p>
            <CardSelector options={PC_SETUPS} value={pcSetup} onSelect={setPcSetup} />
          </div>

          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-text">
              Ferramentas
            </h2>
            <p className="mt-1 text-sm text-muted">Onde você edita. Pode marcar mais de um.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SOFTWARES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSoftware(s)}
                  aria-pressed={softwares.includes(s)}
                  className={chip(softwares.includes(s))}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-text">
              Seu estilo
            </h2>
            <p className="mt-1 text-sm text-muted">
              Até {MAX_STYLES}. É o que casa você com o tom da pauta na hora do match.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {STYLES.map((e: string) => {
                const active = styles.includes(e);
                const blocked = !active && styles.length >= MAX_STYLES;
                return (
                  <button
                    key={e}
                    type="button"
                    onClick={() => toggleStyle(e)}
                    disabled={blocked}
                    aria-pressed={active}
                    className={chip(active, blocked)}
                  >
                    {e}
                  </button>
                );
              })}
            </div>
            {styles.length >= MAX_STYLES && (
              <p className="mt-2 text-xs text-muted-2">Máximo de {MAX_STYLES} estilos.</p>
            )}
          </div>

          <button
            type="button"
            className="btn-gold self-start"
            onClick={() => advanceTo("portfolio")}
          >
            Avançar →
          </button>
        </section>
      )}

      {activeTab === "portfolio" && (
        <section className="reveal flex flex-col gap-8">
          <button
            type="button"
            onClick={() => setActiveTab("desk")}
            className="-mt-2 self-start text-xs font-medium text-muted hover:text-gold-hi"
          >
            ← Voltar (a bancada)
          </button>
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-text">
              Portfólio
            </h2>
            <p className="mt-1 text-sm text-muted">
              Um link com trabalho seu (YouTube, Vimeo, Drive) — de 2 a 2:30 min.
            </p>
            <input
              id="portfolio"
              className="field-input !pl-4 mt-3"
              placeholder="https://…"
              value={portfolioLink}
              onChange={(e) => setPortfolioLink(e.target.value)}
            />
            <p className="mt-2 text-xs text-muted-2">
              Depois da primeira entrega aprovada, seu portfólio aqui dentro se preenche sozinho.
            </p>

            <div className="mt-6">
              <WhatsappField
                value={whatsapp}
                onChange={(v) => {
                  setWhatsapp(v);
                  setError("");
                }}
                hint="Com DDD. Fica visível pro porta-voz da missão que você pegar."
              />
            </div>
          </div>

          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-text">
              Nicho de atuação
            </h2>
            <p className="mt-1 text-sm text-muted">Pode marcar os dois, se editar nos dois formatos.</p>
            <div className="mt-3 flex flex-col gap-2">
              {NICHES.map((n) => {
                const label = n.label ?? (n as any).rotulo;
                const phrase = n.phrase ?? (n as any).frase;
                const active = niche.includes(label);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleNiche(label)}
                    aria-pressed={active}
                    className={cardClass(active)}
                  >
                    <p className="text-sm font-medium text-text">{label}</p>
                    <p className="mt-0.5 text-xs text-muted">{phrase}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <button type="button" className="btn-gold" onClick={handleFinish} disabled={isSaving}>
            {isSaving ? "Salvando…" : "Concluir e ver a fila"}
          </button>
        </section>
      )}
    </div>
  );
}

export { CreateEditorProfileForm as CriarPerfilEditorForm };
