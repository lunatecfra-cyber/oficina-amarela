import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { exigirSessao } from "@/lib/sessao-servidor";
import { ListaFerramentas, type Categoria } from "@/components/lista-ferramentas";

export const metadata: Metadata = { title: "Ferramentas — Oficina Amarela" };

export const dynamic = "force-dynamic";

const CATEGORIAS: Categoria[] = [
  {
    nome: "Editor de Vídeo",
    emoji: "✂️",
    ferramentas: [
      { nome: "CapCut PC", url: "https://capcut.com/pt-br", nota: "grátis, rápido" },
      { nome: "DaVinci Resolve", url: "https://www.blackmagicdesign.com/pt/products/davinciresolve", nota: "grátis, profissional" },
      { nome: "Kdenlive", url: "https://kdenlive.org", nota: "grátis, open source" },
      { nome: "Shotcut", url: "https://shotcut.org", nota: "grátis, open source" },
      { nome: "Premiere Pro", url: "https://www.adobe.com/br/products/premiere.html", nota: "pago, padrão" },
      { nome: "Vegas Pro", url: "https://www.vegascreativesoftware.com/br/vegas-pro", nota: "pago" },
      { nome: "Filmora", url: "https://filmora.wondershare.com", nota: "pago, fácil" },
      { nome: "OBS Studio", url: "https://obsproject.com/pt-br", nota: "grátis, gravação/stream" },
    ],
  },
  {
    nome: "IA & Áudio",
    emoji: "🎙️",
    ferramentas: [
      { nome: "Adobe Podcast (Enhance)", url: "https://podcast.adobe.com/enhance", nota: "voz de estúdio grátis" },
      { nome: "UVR5 (Ultimate Vocal Remover)", url: "https://ultimatevocalremover.com", nota: "separa voz e música" },
      { nome: "Freesound", url: "https://freesound.org", nota: "efeitos sonoros" },
      { nome: "Mixkit Áudio", url: "https://mixkit.co/free-stock-music", nota: "trilhas grátis" },
      { nome: "Uppbeat", url: "https://uppbeat.io", nota: "músicas p/ criadores" },
    ],
  },
  {
    nome: "Baixar Vídeos & Mídias",
    emoji: "📥",
    ferramentas: [
      { nome: "yt-dlp", url: "https://github.com/yt-dlp/yt-dlp", nota: "download via terminal" },
      { nome: "sssInstagram", url: "https://sssinstagram.com", nota: "baixar reels/post" },
      { nome: "YTDown", url: "https://ytdown.to", nota: "baixar YouTube" },
      { nome: "X2Twitter", url: "https://x2twitter.com", nota: "baixar do X/Twitter" },
      { nome: "PinterestDownloader", url: "https://pinterestdownloader.com.br", nota: "baixar do Pinterest" },
    ],
  },
  {
    nome: "Conversores & Utilitários",
    emoji: "🧰",
    ferramentas: [
      { nome: "Shutter Encoder", url: "https://www.shutterencoder.com", nota: "conversor grátis pro" },
      { nome: "Handbrake", url: "https://handbrake.fr", nota: "compactar vídeos" },
      { nome: "123apps", url: "https://123apps.com", nota: "ferramentas rápidas" },
    ],
  },
  {
    nome: "PNG & Elementos sem Fundo",
    emoji: "🖼️",
    ferramentas: [
      { nome: "remove.bg", url: "https://remove.bg", nota: "remover fundo com 1 clique" },
      { nome: "PNGEgg", url: "https://pngegg.com", nota: "recortes transparentes" },
      { nome: "Flaticon", url: "https://flaticon.com", nota: "ícones e vetores" },
      { nome: "Freepik", url: "https://freepik.com", nota: "vetores e imagens" },
      { nome: "StickPNG", url: "https://stickpng.com", nota: "adesivos e recortes" },
    ],
  },
  {
    nome: "Imagens & Vídeos Stock",
    emoji: "📷",
    ferramentas: [
      { nome: "Pexels", url: "https://pexels.com/pt-br", nota: "vídeos e fotos 4k" },
      { nome: "Coverr", url: "https://coverr.co", nota: "vídeos sem marca d'água" },
      { nome: "Pixabay", url: "https://pixabay.com", nota: "banco de estoque" },
    ],
  },
  {
    nome: "IA para Corte & Edição",
    emoji: "🤖",
    ferramentas: [
      { nome: "OpusClip", url: "https://opus.pro/pt-br", nota: "cortes verticais com IA" },
      { nome: "javii.tools", url: "https://javii.tools", nota: "utensílios p/ editores" },
    ],
  },
  {
    nome: "Extensões do Chrome",
    emoji: "🔌",
    ferramentas: [
      { nome: "WhatFont", url: "https://chromewebstore.google.com/detail/whatfont/jabopgfdobjimomedpjipgjaooicahmo", nota: "descobrir fonte na tela" },
      { nome: "Shazam Extension", url: "https://chromewebstore.google.com/detail/shazam-descubra-o-nome-da/mfehgcgbbipciphmccedklhhgflociim", nota: "identificar música" },
      { nome: "Video Speed Controller", url: "https://chromewebstore.google.com/detail/video-speed-controller/nffaoalbilbmmfgbnbgppipjcbjngmee", nota: "acelerar vídeos" },
      { nome: "Image Downloader", url: "https://chromewebstore.google.com/detail/image-downloader/cnpniohnfphhjihaiflmkgnhnkgflgda", nota: "baixar imagens da página" },
    ],
  },
  {
    nome: "Pacotes Pessoais",
    emoji: "📦",
    ferramentas: [
      { nome: "Pack de Edição Oficina", url: "https://drive.google.com/drive/folders/11_jSlkDsn9XQdvbaVCxi4dxpnFdiGNIO", nota: "Drive da guilda" },
    ],
  },
];

export default async function FerramentasPage() {
  await exigirSessao();

  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-8 lg:py-12">
          {/* header */}
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

          <ListaFerramentas categorias={CATEGORIAS} />
        </div>
      </main>
    </>
  );
}
