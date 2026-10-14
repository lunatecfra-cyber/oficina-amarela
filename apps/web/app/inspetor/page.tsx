import type { Metadata } from "next";
import { InspectorQueue } from "@/components/inspector-queue";
export const metadata: Metadata = { title: "Fila de inspeção — Oficina Amarela" };
export default function InspectorPage() {
  return <InspectorQueue />;
}
