// Reexporta @oficina/db enquanto os importadores ainda usam "@/lib/db".
// ponytail: shim temporário; sai quando os call sites apontarem para o pacote.
export * from "@oficina/db/client";
