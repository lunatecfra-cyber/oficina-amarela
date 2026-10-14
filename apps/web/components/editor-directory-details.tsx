import { WORK_PREFERENCE_LABELS } from "@oficina/domain/portfolio";
export type DirectoryDetails = {
  verified: number;
  workPreference: keyof typeof WORK_PREFERENCE_LABELS | null;
  completedCount: number;
  onTimeCount: number;
  onTimeKnownCount: number;
  available: number;
};
export function EditorDirectoryDetails({ editor }: { editor: DirectoryDetails }) {
  return (
    <div className="mt-3 space-y-2 text-sm text-muted">
      {Boolean(editor.verified) && (
        <p className="inline-block rounded-md border border-gold/40 px-2 py-1 text-xs text-gold-hi">
          Verificado pela Oficina
        </p>
      )}
      <p>
        {editor.workPreference
          ? WORK_PREFERENCE_LABELS[editor.workPreference]
          : "Preferência de trabalho não informada"}
      </p>
      <p>
        {editor.completedCount} trabalhos concluídos ·{" "}
        {editor.available
          ? "Disponível para receber convite"
          : "Sem disponibilidade para nova oferta agora"}
      </p>
      <p>
        {editor.onTimeKnownCount
          ? `${editor.onTimeCount} de ${editor.onTimeKnownCount} entregas no prazo`
          : "Entregas no prazo: sem dados suficientes"}
        {editor.completedCount > editor.onTimeKnownCount
          ? ` · ${editor.completedCount - editor.onTimeKnownCount} sem dados de prazo`
          : ""}
      </p>
      <p className="text-xs text-muted-2">
        Prazo: primeira entrega registrada até o dia solicitado, no horário de Brasília. O selo é
        uma habilitação administrativa, separada das avaliações.
      </p>
    </div>
  );
}
