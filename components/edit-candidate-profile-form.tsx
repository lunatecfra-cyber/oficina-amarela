"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ELECTION_YEARS,
  THEME_FLAGS,
  POLITICAL_ROLES,
  BRAZILIAN_STATES,
  TONE_EXAMPLES,
  SUGGESTED_KEYWORDS,
  DEFAULT_TINT,
  COMMUNICATION_TONES,
  generateSuggestedBio,
  initials,
  type SocialLinks,
  type RedesSociais,
} from "@/lib/candidates";
import type { CandidateOnboarding, OnboardingCandidato } from "@/lib/candidate-db";
import { IconInstagram, IconTiktok, IconX, IconYoutube } from "@/components/social-icons";
import { SelectLocation } from "@/components/select-location";
import { compressPhoto } from "@/lib/compress-photo";
import { LegalNotice } from "@/components/legal-notice";

function parseLocation(value: string): { state: string; city: string } {
  if (!value) return { state: "", city: "" };
  const match = value.match(/^(.+?)[/,]\s*([A-Z]{2})$/);
  if (match) return { state: match[2], city: match[1].trim() };
  return { state: "", city: "" };
}

function chip(active: boolean) {
  return `rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
    active
      ? "border-gold-lo bg-gold/10 text-gold-hi"
      : "border-line bg-surface text-muted hover:border-gold/30 hover:text-text"
  }`;
}

const sectionTitle = "font-[family-name:var(--font-display)] text-xl font-semibold text-text";
const fieldLabel = "mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted";

export function EditCandidateProfileForm({
  initial,
  inicial,
}: {
  initial?: CandidateOnboarding;
  inicial?: CandidateOnboarding;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const data = initial ?? inicial ?? {
    name: "",
    nome: "",
    role: "",
    cargo: "",
    runningFor: "",
    disputaPor: "",
    electionYear: "2026",
    anoEleicao: "2026",
    location: "",
    localizacao: "",
    causes: [],
    bandeiras: [],
    communicationTone: "",
    tomComunicacao: "",
    keywords: [],
    palavrasChave: [],
    bio: "",
    watermark: "",
    marcaDagua: "",
    campaignTaxId: "",
    cnpjCampanha: "",
    voterId: "",
    tituloEleitor: "",
    socialLinks: {},
    redes: {},
  };

  const [name, setName] = useState(data.name ?? (data as any).nome ?? "");
  const [photo, setPhoto] = useState<string | undefined>(data.photoUrl ?? (data as any).avatarUrl ?? (data as any).fotoUrl);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [role, setRole] = useState(data.role ?? (data as any).cargo ?? "");
  const [runningFor, setRunningFor] = useState(data.runningFor ?? (data as any).disputaPor ?? "");
  const [electionYear, setElectionYear] = useState(data.electionYear ?? (data as any).anoEleicao ?? "2026");
  const parsed = parseLocation(data.location ?? (data as any).localizacao ?? "");
  const [stateUf, setStateUf] = useState(parsed.state);
  const [cityName, setCityName] = useState(parsed.city);
  const [causes, setCauses] = useState<string[]>(data.causes ?? (data as any).bandeiras ?? []);

  const [tone, setTone] = useState(data.communicationTone ?? (data as any).tomComunicacao ?? "");
  const [keywords, setKeywords] = useState<string[]>(data.keywords ?? (data as any).palavrasChave ?? []);
  const [newKeyword, setNewKeyword] = useState("");
  const [bio, setBio] = useState(data.bio ?? "");
  const [watermark, setWatermark] = useState(data.watermark ?? (data as any).marcaDagua ?? "");
  const [campaignTaxId, setCampaignTaxId] = useState(data.campaignTaxId ?? (data as any).cnpjCampanha ?? "");
  const [voterId, setVoterId] = useState(data.voterId ?? (data as any).tituloEleitor ?? "");

  const [socialLinks, setSocialLinks] = useState<SocialLinks>(data.socialLinks ?? (data as any).redes ?? {});

  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function onChoosePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingPhoto(true);
    setPhotoError("");
    const r = await compressPhoto(file);
    setIsProcessingPhoto(false);

    if (!r.ok) {
      setPhotoError(r.error ?? (r as any).erro ?? "Erro ao comprimir foto");
      return;
    }
    setPhoto(r.dataUrl);
  }

  function toggleCause(b: string) {
    setCauses((curr) => (curr.includes(b) ? curr.filter((x) => x !== b) : [...curr, b]));
  }

  function toggleKeyword(p: string) {
    setKeywords((curr) => {
      if (curr.includes(p)) return curr.filter((x) => x !== p);
      if (curr.length >= 3) return curr;
      return [...curr, p];
    });
  }

  function addTypedKeyword() {
    const p = newKeyword.trim();
    if (!p || keywords.length >= 3 || keywords.includes(p)) return;
    setKeywords((curr) => [...curr, p]);
    setNewKeyword("");
  }

  function handleGenerateBio() {
    const suggestion = generateSuggestedBio({
      role,
      runningFor,
      location: cityName ? `${cityName}/${stateUf}` : "",
      causes,
      tone,
    });
    if (suggestion) setBio(suggestion);
  }

  function updateSocialLink(field: keyof SocialLinks, val: string) {
    setSocialLinks((curr) => ({ ...curr, [field]: val.trim() || undefined }));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Precisa do seu nome.");
      return;
    }
    if (!role) {
      setError("Escolha o cargo.");
      return;
    }
    if (!cityName.trim()) {
      setError("Informe sua região.");
      return;
    }
    setError("");
    setIsSaving(true);

    const locationStr = cityName ? `${cityName}/${stateUf}` : "";

    const resp = await fetch("/api/spokesperson/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        photoUrl: photo,
        role,
        runningFor,
        electionYear,
        location: locationStr,
        causes,
        communicationTone: tone,
        keywords,
        socialLinks,
        bio,
        watermark,
        campaignTaxId,
        voterId,
        // compatibility aliases
        nome: name,
        cargo: role,
        disputaPor: runningFor,
        anoEleicao: electionYear,
        localizacao: locationStr,
        bandeiras: causes,
        tomComunicacao: tone,
        palavrasChave: keywords,
        redes: socialLinks,
        marcaDagua: watermark,
        cnpjCampanha: campaignTaxId,
        tituloEleitor: voterId,
      }),
    });
    setIsSaving(false);

    if (!resp.ok) {
      const respData = await resp.json().catch(() => null);
      setError(respData?.error ?? respData?.erro ?? "Não deu pra salvar. Tenta de novo.");
      return;
    }

    router.push("/porta-voz/perfil");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-2xl flex-col gap-9" noValidate>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <section className="reveal flex flex-col gap-5">
        <h2 className={sectionTitle}>Identidade</h2>
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
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

            {isProcessingPhoto && (
              <p className="mt-2 text-[11px] text-muted">Preparando a foto…</p>
            )}
            {photoError && (
              <p role="alert" className="mt-2 max-w-[11rem] text-center text-[11px] text-danger">
                {photoError}
              </p>
            )}

            {photo && (
              <button
                type="button"
                onClick={() => setPhoto(undefined)}
                className="mt-2 text-[11px] text-muted-2 hover:text-muted"
              >
                Remover foto (usar iniciais)
              </button>
            )}
          </div>

          <div className="w-full flex-1">
            <label htmlFor="name" className={fieldLabel}>
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
      </section>

      <section className="reveal flex flex-col gap-4">
        <h2 className={sectionTitle}>Candidatura</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="cargo" className={fieldLabel}>
              Cargo
            </label>
            <select
              id="cargo"
              className="field-input !pl-4"
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setError("");
              }}
            >
              <option value="" disabled>
                Selecione…
              </option>
              {POLITICAL_ROLES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="disputaPor" className={fieldLabel}>
              Onde disputa
            </label>
            <select
              id="disputaPor"
              className="field-input !pl-4"
              value={runningFor}
              onChange={(e) => setRunningFor(e.target.value)}
            >
              <option value="">Selecione…</option>
              {BRAZILIAN_STATES.map((e: { uf: string; nome: string }) => (
                <option key={e.uf} value={e.nome}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ano" className={fieldLabel}>
              Ano da eleição
            </label>
            <select
              id="ano"
              className="field-input !pl-4"
              value={electionYear}
              onChange={(e) => setElectionYear(e.target.value)}
            >
              {ELECTION_YEARS.map((ano) => (
                <option key={ano} value={ano}>
                  {ano}
                </option>
              ))}
            </select>
          </div>
        </div>

        <SelectLocation
          stateValue={stateUf}
          cityValue={cityName}
          onChangeState={setStateUf}
          onChangeCity={setCityName}
          stateLabel="Onde você mora"
          cityLabel="Região"
        />
      </section>

      <section className="reveal flex flex-col gap-3">
        <div>
          <h2 className={sectionTitle}>Bandeiras</h2>
          <p className="mt-1 text-sm text-muted">Os temas que mais representam sua atuação.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {THEME_FLAGS.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => toggleCause(b)}
              aria-pressed={causes.includes(b)}
              className={chip(causes.includes(b))}
            >
              {b}
            </button>
          ))}
        </div>
      </section>

      <section className="reveal flex flex-col gap-5">
        <div>
          <h2 className={sectionTitle}>Estilo</h2>
          <p className="mt-1 text-sm text-muted">
            Ajuda a Oficina Amarela a te indicar editores com o tom certo.
          </p>
        </div>
        <div className="flex flex-col gap-2.5">
          {COMMUNICATION_TONES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTone(t)}
              aria-pressed={tone === t}
              className={`group rounded-xl border px-4 py-3 text-left transition-colors ${
                tone === t
                  ? "border-gold-lo bg-gold/10"
                  : "border-line bg-surface hover:border-gold/30"
              }`}
            >
              <span
                className={`block text-sm font-medium ${
                  tone === t ? "text-gold-hi" : "text-muted group-hover:text-text"
                }`}
              >
                {t}
              </span>
              <span className="mt-1 block text-xs italic leading-snug text-muted-2">
                &ldquo;{TONE_EXAMPLES[t]}&rdquo;
              </span>
            </button>
          ))}
        </div>

        <div>
          <p className={`${fieldLabel} !mb-1`}>Palavras-chave</p>
          <p className="mb-3 text-xs text-muted-2">Até 3 que definem sua postura.</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_KEYWORDS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => toggleKeyword(p)}
                disabled={keywords.length >= 3 && !keywords.includes(p)}
                aria-pressed={keywords.includes(p)}
                className={chip(keywords.includes(p))}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              className="field-input !pl-4"
              placeholder="Ou digite a sua…"
              value={newKeyword}
              disabled={keywords.length >= 3}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTypedKeyword();
                }
              }}
            />
            <button
              type="button"
              className="btn-ghost w-auto px-4"
              disabled={keywords.length >= 3 || !newKeyword.trim()}
              onClick={addTypedKeyword}
            >
              Adicionar
            </button>
          </div>
          {keywords.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {keywords.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gold-lo bg-gold/10 py-1 pl-3 pr-2 text-xs font-medium text-gold-hi"
                >
                  {p}
                  <button
                    type="button"
                    aria-label={`Remover ${p}`}
                    onClick={() => toggleKeyword(p)}
                    className="grid h-4 w-4 place-items-center rounded-full text-gold-hi/70 hover:text-gold-hi"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="reveal flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className={sectionTitle}>Biografia</h2>
          <button
            type="button"
            onClick={handleGenerateBio}
            className="text-xs font-medium text-gold-hi hover:underline"
          >
            ✨ Gerar sugestão
          </button>
        </div>
        <textarea
          className="field-input !pl-4"
          rows={5}
          placeholder="Fale um pouquinho sobre você…"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
      </section>

      <section className="reveal flex flex-col gap-3">
        <div>
          <h2 className={sectionTitle}>Regras Eleitorais (TSE)</h2>
          <p className="mt-1 text-sm text-muted">
            Essas informações serão preenchidas automaticamente nas suas missões para que o editor inclua nos vídeos.
          </p>
        </div>
        
        <LegalNotice />

        <div className="grid gap-4 sm:grid-cols-2 mt-2">
          <div>
            <label htmlFor="marcaDagua" className={fieldLabel}>
              Marca d&apos;água
            </label>
            <input
              id="marcaDagua"
              className="field-input !pl-4"
              placeholder="ex.: Candidato Oficial - #12345"
              value={watermark}
              onChange={(e) => {
                setWatermark(e.target.value);
                setError("");
              }}
            />
          </div>
          <div>
            <label htmlFor="cnpjCampanha" className={fieldLabel}>
              CNPJ da Campanha
            </label>
            <input
              id="cnpjCampanha"
              className="field-input !pl-4"
              placeholder="00.000.000/0000-00"
              value={campaignTaxId}
              onChange={(e) => {
                setCampaignTaxId(e.target.value);
                setError("");
              }}
            />
          </div>
        </div>
        <div>
          <label htmlFor="tituloEleitor" className={fieldLabel}>
            Título de Eleitor
          </label>
          <input
            id="tituloEleitor"
            className="field-input !pl-4"
            placeholder="0000 0000 0000"
            value={voterId}
            onChange={(e) => {
              setVoterId(e.target.value);
              setError("");
            }}
          />
        </div>
      </section>

      <section className="reveal flex flex-col gap-3">
        <div>
          <h2 className={sectionTitle}>Redes</h2>
          <p className="mt-1 text-sm text-muted">
            Só o @ ou o link já ajuda. O editor precisa saber onde o vídeo vai ao ar.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <div className="relative flex items-center">
            <IconInstagram className="pointer-events-none absolute left-4 h-[17px] w-[17px] text-muted-2" />
            <input
              className="field-input"
              placeholder="Instagram — @seuperfil"
              value={socialLinks.instagram ?? ""}
              onChange={(e) => updateSocialLink("instagram", e.target.value)}
            />
          </div>
          <div className="relative flex items-center">
            <IconYoutube className="pointer-events-none absolute left-4 h-[17px] w-[17px] text-muted-2" />
            <input
              className="field-input"
              placeholder="YouTube — nome do canal"
              value={socialLinks.youtube ?? ""}
              onChange={(e) => updateSocialLink("youtube", e.target.value)}
            />
          </div>
          <div className="relative flex items-center">
            <IconTiktok className="pointer-events-none absolute left-4 h-[17px] w-[17px] text-muted-2" />
            <input
              className="field-input"
              placeholder="TikTok — @seuperfil"
              value={socialLinks.tiktok ?? ""}
              onChange={(e) => updateSocialLink("tiktok", e.target.value)}
            />
          </div>
          <div className="relative flex items-center">
            <IconX className="pointer-events-none absolute left-4 h-[17px] w-[17px] text-muted-2" />
            <input
              className="field-input"
              placeholder="X — @seuperfil"
              value={socialLinks.x ?? ""}
              onChange={(e) => updateSocialLink("x", e.target.value)}
            />
          </div>
        </div>
      </section>

      <div className="flex gap-3">
        <Link href="/porta-voz/perfil" className="btn-ghost grid w-32 place-items-center">
          Cancelar
        </Link>
        <button type="submit" className="btn-gold flex-1" disabled={isSaving}>
          {isSaving ? "Salvando…" : "Salvar perfil"}
        </button>
      </div>
    </form>
  );
}

export { EditCandidateProfileForm as EditarPerfilCandidatoForm };
