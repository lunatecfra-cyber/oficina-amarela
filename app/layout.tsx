import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// As duas fontes moram no repositório, não no Google.
//
// Com `next/font/google`, todo build baixa os arquivos na hora — e quando o
// Google demora, o build falha. Aconteceu no CI: ficou vermelho sem nada errado
// no código, e o mesmo commit passou ao rodar de novo sem mudar uma linha. CI
// que falha à toa treina todo mundo a ignorar o vermelho, que é pior do que não
// ter CI nenhum.
//
// São arquivos variáveis: um só cobre toda a faixa de peso, por isso `weight` é
// um intervalo em vez de uma lista. Cinzel e Sora são licenciadas em OFL, que
// permite redistribuir junto com o projeto.
const cinzel = localFont({
  src: "../public/fontes/cinzel.woff2",
  variable: "--font-cinzel",
  weight: "400 900",
  display: "swap",
});

const sora = localFont({
  src: "../public/fontes/sora.woff2",
  variable: "--font-sora",
  weight: "100 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Oficina Amarela",
  description: "A guilda de editores. Pegue missões, entregue, suba de nível.",
  icons: { icon: "/emblema.png", apple: "/emblema.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${cinzel.variable} ${sora.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="texture" aria-hidden="true" />
        <div className="relative z-10 flex min-h-full flex-1 flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
