import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { DevToolbar } from "@/components/dev-toolbar";

const cinzel = localFont({
  src: "../public/fonts/cinzel.woff2",
  variable: "--font-cinzel",
  weight: "400 900",
  display: "swap",
});

const sora = localFont({
  src: "../public/fonts/sora.woff2",
  variable: "--font-sora",
  weight: "100 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Oficina Amarela",
    template: "%s",
  },
  description:
    "A guilda de quem edita. Porta-vozes mandam o vídeo bruto, editores recebem uma missão por vez e todo mundo evolui junto.",
  icons: { icon: "/emblema.png", apple: "/emblema.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${cinzel.variable} ${sora.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <div className="texture" aria-hidden="true" />
        <div className="relative z-10 flex min-h-full flex-1 flex-col">
          {children}
          <DevToolbar />
        </div>
      </body>
    </html>
  );
}
