import { AppHeaderSpokesperson } from "@/components/app-header-spokesperson";
import { requireSession } from "@/lib/server-session";

export default async function SpokespersonLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();

  return (
    <>
      <AppHeaderSpokesperson />
      <main className="flex-1">{children}</main>
    </>
  );
}
