import { AppHeaderPortaVoz } from "@/components/app-header-porta-voz";
import { exigirSessao } from "@/lib/sessao-servidor";

export default async function PortaVozLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // cobre todas as telas de /porta-voz/* — derruba sessão revogada
  await exigirSessao();

  return (
    <>
      <AppHeaderPortaVoz />
      <main className="flex-1">{children}</main>
    </>
  );
}
