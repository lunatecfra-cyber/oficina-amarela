"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import { CampaignIdentity } from "@/components/campaign-identity";
import { WhatsappField, onlyDigits } from "@/components/whatsapp-field";
import { validateCampaignIdentity } from "@/lib/campaign-identity";
import { LegalNotice } from "@/components/legal-notice";

function parseLocation(value: string): { state: string; city: string } {
  if (!value) return { state: "", city: "" };
  const match = value.match(/^(.+?)[/,]\s*([A-Z]{2})$/);
  if (match) return { state: match[2], city: match[1].trim() };
  return { state: "", city: "" };
}

type Tab = "objective" | "style" | "channels";

const TABS: { key: Tab; label: string }[] = [
  { key: "objective", label: "Objetivo e Temas" },
  { key: "style", label: "Estilo e Bio" },
  { key: "channels", label: "Canais e Visual" },
];

function chip(active: boolean) {
  return `rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
    active
      ? "border-gold-lo bg-gold/10 text-gold-hi"
      : "border-line bg-surface text-muted hover:border-gold/30 hover:text-text"
  }`;
}

export function CreateCandidateProfileForm({
  initial,
  inicial,
}: {
  initial?: CandidateOnboarding;
  inicial?: CandidateOnboarding;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const autoBioAttempted = useRef(false);

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
    candidateNumber: "",
    numeroEleitoral: "",
    voterId: "",
    tituloEleitor: "",
    socialLinks: {},
    redes: {},
  };

  const [activeTab, setActiveTab] = useState<Tab>("objective");

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
  const [whatsapp, setWhatsapp] = useState(onlyDigits((data as any).whatsapp ?? ""));
  // número de urna (13, 22...). Diferente do título de eleitor acima.
  const [candidateNumber, setCandidateNumber] = useState(
    data.candidateNumber ?? data.numeroEleitoral ?? "",
  );

  const [socialLinks, setSocialLinks] = useState<SocialLinks>(data.socialLinks ?? (data as any).redes ?? {});

  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function openTab(a: Tab) {
    setActiveTab(a);
    if (a === "style" && !autoBioAttempted.current && !bio.trim()) {
      autoBioAttempted.current = true;
      const suggestion = generateSuggestedBio({
        role,
        runningFor,
        location: cityName ? `${cityName}/${stateUf}` : "",
        causes,
        tone,
      });
      if (suggestion) setBio(suggestion);
    }
  }

  function advanceTo(a: Tab) {
    if (activeTab === "objective") {
      if (!name.trim()) {
        setError("Precisa do seu nome pra continuar.");
        return;
      }
      if (!role) {
        setError("Escolhe o cargo pra continuar.");
        return;
      }
      if (!cityName.trim()) {
        setError("Conta mais ou menos onde você fica.");
        return;
      }
    }
    setError("");
    openTab(a);
  }

  async function onChoosePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingPhoto(true);
    setPhotoError("");
    const r = await compressPhoto(file);
    setIsProcessingPhoto(false);

    if (!r.ok) {
      setPhotoError(r.error ?? r.erro ?? "Erro ao comprimir foto");
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

  async function handleFinish() {
    if (!name.trim()) {
      setError("Precisa do seu nome pra continuar.");
      setActiveTab("objective");
      return;
    }
    if (!role) {
      setError("Escolhe o cargo pra continuar.");
      setActiveTab("objective");
      return;
    }
    if (!cityName.trim()) {
      setError("Conta mais ou menos onde você fica.");
      setActiveTab("objective");
      return;
    }
    // Identificação de campanha é obrigatória. A regra é a de
    // `lib/campaign-identity.ts` — a mesma que a prévia da tarja usa.
    const identidade = validateCampaignIdentity({
      officialName: name,
      candidateNumber,
      campaignTaxId,
    });
    if (!identidade.ok) {
      setError(identidade.error);
      setActiveTab("channels");
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
        candidateNumber,
        whatsapp,
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
        numeroEleitoral: candidateNumber,
        tituloEleitor: voterId,
      }),
    });
    setIsSaving(false);

    if (!resp.ok) {
      const respData = await resp.json().catch(() => null);
      setError(respData?.error ?? respData?.erro ?? "Não deu pra salvar. Tenta de novo.");
      return;
    }

    router.push("/porta-voz");
    router.refresh();
  }

  const stepIndex = TABS.findIndex((a) => a.key === activeTab);
  const stepNumber = stepIndex + 1;
  const progress = Math.round((stepNumber / TABS.length) * 100);

  return (
    <div className="w-full max-w-2xl">
      <div className="mb-2 flex items-center justify-between text-xs text-muted-2">
        <span>
          Perfil do candidato · etapa {stepNumber} de {TABS.length}
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
            onClick={() => openTab(a.key)}
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

      {activeTab === "objective" && (
        <section className="reveal flex flex-col gap-9">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-text">
              Quem é você
            </h2>
            <p className="mt-1 text-sm text-muted">
              Nome e foto — é o que editores e o público vão ver primeiro. A foto é
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
          </div>

          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-text">
              Dados da candidatura
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="cargo"
                  className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted"
                >
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
                <label
                  htmlFor="disputaPor"
                  className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted"
                >
                  Onde disputa
                </label>
                <select
                  id="disputaPor"
                  className="field-input !pl-4"
                  value={runningFor}
                  onChange={(e) => setRunningFor(e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {BRAZILIAN_STATES.map((e) => (
                    <option key={e.uf} value={e.nome}>
                      {e.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="ano"
                  className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted"
                >
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

            <div className="mt-4">
              <SelectLocation
                stateValue={stateUf}
                cityValue={cityName}
                onChangeState={setStateUf}
                onChangeCity={setCityName}
                stateLabel="Onde você mora"
                cityLabel="Região"
              />
            </div>
          </div>

          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-text">
              Bandeiras sugeridas
            </h2>
            <p className="mt-1 text-sm text-muted">Os temas que mais representam sua atuação.</p>
            <div className="mt-3 flex flex-wrap gap-2">
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
          </div>

          <button
            type="button"
            className="btn-gold self-start"
            onClick={() => advanceTo("style")}
          >
            Avançar →
          </button>
        </section>
      )}

      {activeTab === "style" && (
        <section className="reveal flex flex-col gap-9">
          <button
            type="button"
            onClick={() => openTab("objective")}
            className="-mt-2 self-start text-xs font-medium text-muted hover:text-gold-hi"
          >
            ← Voltar (objetivo e temas)
          </button>
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-text">
              Como você se comunica
            </h2>
            <p className="mt-1 text-sm text-muted">
              Ajuda a Oficina Amarela a te indicar editores com o tom certo.
            </p>
            <div className="mt-4 flex flex-col gap-2.5">
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
                    className={`block text-sm font-medium ${tone === t ? "text-gold-hi" : "text-muted group-hover:text-text"}`}
                  >
                    {t}
                  </span>
                  <span className="mt-1 block text-xs italic leading-snug text-muted-2">
                    &quot;{TONE_EXAMPLES[t]}&quot;
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-text">
              Palavras-chave
            </h2>
            <p className="mt-1 text-sm text-muted">
              Escolha ou digite até 3 palavras que definem sua postura.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
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
            {keywords.length >= 3 && (
              <p className="mt-2 text-xs text-muted-2">Máximo de 3 palavras.</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-text">
                Sua biografia
              </h2>
              <button
                type="button"
                onClick={handleGenerateBio}
                className="text-xs font-medium text-gold-hi hover:underline"
              >
                ✨ Gerar sugestão
              </button>
            </div>
            <p className="mt-1 text-sm text-muted">
              Já vem com uma sugestão pronta — edite à vontade.
            </p>
            <textarea
              className="field-input !pl-4 mt-3"
              rows={5}
              placeholder="Fale um pouquinho sobre você…"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="btn-gold self-start"
            onClick={() => advanceTo("channels")}
          >
            Avançar →
          </button>
        </section>
      )}

      {activeTab === "channels" && (
        <section className="reveal flex flex-col gap-9">
          <button
            type="button"
            onClick={() => openTab("style")}
            className="-mt-2 self-start text-xs font-medium text-muted hover:text-gold-hi"
          >
            ← Voltar (estilo e bio)
          </button>
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-text">
              Contato e redes
            </h2>
            <p className="mt-1 text-sm text-muted">
              O WhatsApp destrava a conversa direta com o editor. Só o @ ou o
              link das redes já ajuda — o editor precisa saber onde o vídeo vai
              ao ar pra editar no formato certo.
            </p>

            <div className="mt-4">
              <WhatsappField
                value={whatsapp}
                onChange={(v) => {
                  setWhatsapp(v);
                  setError("");
                }}
                hint="Com DDD. Fica visível pro editor que pegar sua missão."
              />
            </div>

            <div className="mt-4 flex flex-col gap-3">
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
          </div>

          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-text">
              Identificação de campanha
            </h2>
            <p className="mt-1 text-sm text-muted">
              Obrigatório. Vai automático em toda missão, pro editor colocar no
              vídeo — e monta a tarja que ele encaixa na lateral.
            </p>

            <div className="mt-4">
              <LegalNotice />
            </div>

            <div className="mt-5">
              <CampaignIdentity
                name={name}
                onNameChange={(v) => {
                  setName(v);
                  setError("");
                }}
                candidateNumber={candidateNumber}
                onCandidateNumberChange={(v) => {
                  setCandidateNumber(v);
                  setError("");
                }}
                campaignTaxId={campaignTaxId}
                onCampaignTaxIdChange={(v) => {
                  setCampaignTaxId(v);
                  setError("");
                }}
              />
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="marcaDagua" className="mb-2 block text-xs font-medium uppercase tracking-[0.1em] text-muted">
                  Marca d&apos;água <span className="text-muted-2">(opcional)</span>
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
                {/* Não confundir com o número eleitoral acima: este é o título
                    de eleitor, que segue indo pro briefing das missões. */}
                <label htmlFor="tituloEleitor" className="mb-2 block text-xs font-medium uppercase tracking-[0.1em] text-muted">
                  Título de eleitor <span className="text-muted-2">(opcional)</span>
                </label>
                <input
                  id="tituloEleitor"
                  className="field-input !pl-4"
                  placeholder="0000 0000 0000"
                  inputMode="numeric"
                  value={voterId}
                  onChange={(e) => {
                    setVoterId(e.target.value);
                    setError("");
                  }}
                />
              </div>
            </div>
          </div>

          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-text">
              Confere como ficou
            </h2>
            <p className="mt-1 text-sm text-muted">É assim que vão te ver na Oficina Amarela.</p>

            <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface/60">
              <div
                className="h-16"
                style={{
                  background:
                    "radial-gradient(120% 160% at 15% 0%, rgba(244,206,31,0.22), transparent 55%), linear-gradient(120deg,#17140a,#0e0e12 60%,#0a0a0b)",
                }}
              />
              <div className="px-5 pb-5">
                <div className="-mt-9">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo}
                      alt={name || (data.name ?? (data as any).nome ?? "")}
                      className="h-16 w-16 rounded-xl object-cover"
                      style={{ boxShadow: "0 0 0 3px var(--color-ink), 0 0 0 4px rgba(244,206,31,0.55)" }}
                    />
                  ) : (
                    <span
                      className="grid h-16 w-16 place-items-center rounded-xl font-[family-name:var(--font-display)] text-xl font-semibold text-black/80"
                      style={{
                        background: DEFAULT_TINT,
                        boxShadow: "0 0 0 3px var(--color-ink), 0 0 0 4px rgba(244,206,31,0.55)",
                      }}
                    >
                      {initials(name || (data.name ?? (data as any).nome ?? ""))}
                    </span>
                  )}
                </div>
                <p className="mt-3 font-[family-name:var(--font-display)] text-lg font-semibold text-text">
                  {name || (data.name ?? (data as any).nome ?? "")}
                </p>
                <p className="text-sm text-gold-hi">
                  {role || "—"}
                  {runningFor && <span className="text-muted-2"> — {runningFor}</span>}
                  {electionYear && <span className="text-muted-2"> · {electionYear}</span>}
                </p>
                <p className="mt-0.5 text-xs text-muted-2">{cityName ? `${cityName}/${stateUf}` : "—"}</p>

                {(socialLinks.instagram || socialLinks.youtube || socialLinks.tiktok || socialLinks.x) && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-2">
                    {socialLinks.instagram && (
                      <span className="inline-flex items-center gap-1">
                        <IconInstagram className="h-3.5 w-3.5" />
                        {socialLinks.instagram}
                      </span>
                    )}
                    {socialLinks.youtube && (
                      <span className="inline-flex items-center gap-1">
                        <IconYoutube className="h-3.5 w-3.5" />
                        {socialLinks.youtube}
                      </span>
                    )}
                    {socialLinks.tiktok && (
                      <span className="inline-flex items-center gap-1">
                        <IconTiktok className="h-3.5 w-3.5" />
                        {socialLinks.tiktok}
                      </span>
                    )}
                    {socialLinks.x && (
                      <span className="inline-flex items-center gap-1">
                        <IconX className="h-3.5 w-3.5" />
                        {socialLinks.x}
                      </span>
                    )}
                  </div>
                )}

                {bio && <p className="mt-3 text-sm leading-relaxed text-muted">{bio}</p>}

                {(tone || causes.length > 0) && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {tone && (
                      <span className="inline-block rounded-full border border-gold-lo/40 bg-gold/[0.07] px-2.5 py-0.5 text-[11px] text-gold-hi">
                        tom: {tone}
                      </span>
                    )}
                    {causes.map((b) => (
                      <span
                        key={b}
                        className="inline-block rounded-full border border-gold-lo/30 bg-gold/10 px-2.5 py-0.5 text-[11px] text-gold-hi"
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                )}

                {keywords.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {keywords.map((p) => (
                      <span
                        key={p}
                        className="inline-block rounded-full border border-line px-2.5 py-0.5 text-[11px] italic text-muted-2"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <button type="button" className="btn-gold" onClick={handleFinish} disabled={isSaving}>
            {isSaving ? "Salvando…" : "Concluir e ver minhas missões"}
          </button>
        </section>
      )}
    </div>
  );
}

export { CreateCandidateProfileForm as CriarPerfilCandidatoForm };
