import { redirect } from "next/navigation";
import { requireSession } from "@/lib/server-session";
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (session.role !== "admin") redirect("/inspetor");
  return children;
}
