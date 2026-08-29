import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { requireSession } from "@/lib/server-session";
import { ToolsList, type ToolCategory } from "@/components/tools-list";

export const metadata: Metadata = { title: "Ferramentas — Oficina Amarela" };

export const dynamic = "force-dynamic";

const CATEGORIES: ToolCategory[] = [
  {
    name: "Editor de Vídeo",
    emoji: "✂️",
    tools: [
      { name: "CapCut PC", url: "https://capcut.com/pt-br", note: "grátis, rápido" },
      { name: "DaVinci Resolve", url: "https://www.blackmagicdesign.com/pt/products/davinciresolve", note: "grátis, profissional" },
      { name: "Kdenlive", url: "https://kdenlive.org", note: "grátis, open source" },
      { name: "Shotcut", url: "https://shotcut.org", note: "grátis, open source" },
      { name: "Premiere Pro", url: "https://www.adobe.com/br/products/premiere.html", note: "pago, padrão" },
      { name: "Vegas Pro", url: "https://www.vegascreativesoftware.com/br/vegas-pro", note: "pago" },
      { name: "Filmora", url: "https://filmora.wondershare.com", note: "pago, fácil" },
      { name: "OBS Studio", url: "https://obsproject.com/pt-br", note: "grátis, gravação/stream" },
    ],
  },
  {
    name: "IA & Áudio",
    emoji: "🎙️",
    tools: [
      { name: "Adobe Podcast (Enhance)", url: "https://podcast.adobe.com/enhance", note: "voz de estúdio grátis" },
      { name: "UVR5 (Ultimate Vocal Remover)", url: "https://ultimatevocalremover.com", note: "separa voz e música" },
      { name: "Freesound", url: "https://freesound.org", note: "efeitos sonoros" },
      { name: "Mixkit Áudio", url: "https://mixkit.co/free-stock-music", note: "trilhas grátis" },
      { name: "Uppbeat", url: "https://uppbeat.io", note: "músicas p/ criadores" },
    ],
  },
  {
    name: "Baixar Vídeos & Mídias",
    emoji: "📥",
    tools: [
      { name: "yt-dlp", url: "https://github.com/yt-dlp/yt-dlp", note: "download via terminal" },
      { name: "sssInstagram", url: "https://sssinstagram.com", note: "baixar reels/post" },
      { name: "YTDown", url: "https://ytdown.to", note: "baixar YouTube" },
      { name: "X2Twitter", url: "https://x2twitter.com", note: "baixar do X/Twitter" },
      { name: "PinterestDownloader", url: "https://pinterestdownloader.com.br", note: "baixar do Pinterest" },
    ],
  },
  {
    name: "Conversores & Utilitários",
    emoji: "🧰",
    tools: [
      { name: "Shutter Encoder", url: "https://www.shutterencoder.com", note: "conversor grátis pro" },
      { name: "Handbrake", url: "https://handbrake.fr", note: "compactar vídeos" },
      { name: "123apps", url: "https://123apps.com", note: "ferramentas rápidas" },
    ],
  },
  {
    name: "PNG & Elementos sem Fundo",
    emoji: "🖼️",
    tools: [
      { name: "remove.bg", url: "https://remove.bg", note: "remover fundo com 1 clique" },
      { name: "PNGEgg", url: "https://pngegg.com", note: "recortes transparentes" },
      { name: "Flaticon", url: "https://flaticon.com", note: "ícones e vetores" },
      { name: "Freepik", url: "https://freepik.com", note: "vetores e imagens" },
      { name: "StickPNG", url: "https://stickpng.com", note: "adesivos e recortes" },
    ],
  },
  {
    name: "Imagens & Vídeos Stock",
    emoji: "📷",
    tools: [
      { name: "Pexels", url: "https://pexels.com/pt-br", note: "vídeos e fotos 4k" },
      { name: "Coverr", url: "https://coverr.co", note: "vídeos sem marca d'água" },
      { name: "Pixabay", url: "https://pixabay.com", note: "banco de estoque" },
    ],
  },
  {
    name: "IA para Corte & Edição",
    emoji: "🤖",
    tools: [
      { name: "OpusClip", url: "https://opus.pro/pt-br", note: "cortes verticais com IA" },
      { name: "javii.tools", url: "https://javii.tools", note: "utensílios p/ editores" },
    ],
  },
  {
    name: "Extensões do Chrome",
    emoji: "🔌",
    tools: [
      { name: "WhatFont", url: "https://chromewebstore.google.com/detail/whatfont/jabopgfdobjimomedpjipgjaooicahmo", note: "descobrir fonte na tela" },
      { name: "Shazam Extension", url: "https://chromewebstore.google.com/detail/shazam-descubra-o-nome-da/mfehgcgbbipciphmccedklhhgflociim", note: "identificar música" },
      { name: "Video Speed Controller", url: "https://chromewebstore.google.com/detail/video-speed-controller/nffaoalbilbmmfgbnbgppipjcbjngmee", note: "acelerar vídeos" },
      { name: "Image Downloader", url: "https://chromewebstore.google.com/detail/image-downloader/cnpniohnfphhjihaiflmkgnhnkgflgda", note: "baixar imagens da página" },
    ],
  },
  {
    name: "Pacotes Pessoais",
    emoji: "📦",
    tools: [
      { name: "Pack de Edição Oficina", url: "https://drive.google.com/drive/folders/11_jSlkDsn9XQdvbaVCxi4dxpnFdiGNIO", note: "Drive da guilda" },
    ],
  },
];

export default async function ToolsPage() {
  await requireSession();

  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-8 lg:py-12">
          <div className="mb-8">
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
              Ferramentas
            </h1>
            <p className="mt-1 text-sm text-muted">
              Tudo que você precisa pra editar, de graça e organizado.
            </p>

            <div
              className="mt-6 h-px w-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(244,206,31,0.6), rgba(244,206,31,0.9), rgba(244,206,31,0.6), transparent)",
              }}
              aria-hidden="true"
            />
          </div>

          <ToolsList categories={CATEGORIES} />
        </div>
      </main>
    </>
  );
}
