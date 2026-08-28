import { redirect } from "next/navigation";
import { AppHeaderInspetor } from "@/components/app-header-inspetor";
import { exigirSessao } from "@/lib/sessao-servidor";

export default async function InspetorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessao = await exigirSessao();

  if (sessao.papel !== "admin") {
    redirect("/login");
  }

  return (
    <>
      <AppHeaderInspetor />
      <main className="flex-1">{children}</main>
    </>
  );
}
