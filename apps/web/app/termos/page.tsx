import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Termos de Uso — Oficina Amarela" };

export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 lg:px-8 lg:py-14">
      <Link href="/" className="flex items-center gap-3">
        <Logo size="normal" />
        <span className="font-[family-name:var(--font-display)] text-sm font-semibold tracking-[0.24em] text-gold">
          OFICINA AMARELA
        </span>
      </Link>

      <h1 className="mt-8 font-[family-name:var(--font-display)] text-3xl font-semibold text-text">
        Termos de Uso
      </h1>

      <div className="mt-3 rounded-xl border border-gold-lo/40 bg-gold/[0.06] p-4 text-sm text-muted">
        ⚠️ Rascunho gerado em 27/07/2026. Revisar com um advogado antes de publicar de verdade — isso
        aqui não é aconselhamento jurídico.
      </div>

      <div className="mt-8 flex flex-col gap-6 text-[15px] leading-relaxed text-muted">
        <section>
          <h2 className="mb-2 font-[family-name:var(--font-display)] text-xl font-semibold text-text">
            1. Quem pode usar
          </h2>
          <p>
            A Oficina Amarela tem três papéis: <b className="text-text">porta-voz</b> (sobe o bruto
            e descreve o que quer), <b className="text-text">editor</b> (pega a missão da fila,
            edita e entrega) e <b className="text-text">controle de qualidade</b> (aprova a entrega
            ou pede reedição).
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-[family-name:var(--font-display)] text-xl font-semibold text-text">
            2. Regras da fila
          </h2>
          <ul className="list-disc pl-5">
            <li>Cada editor reserva apenas 1 missão por vez</li>
            <li>
              Ao reservar, o acesso ao vídeo bruto é liberado automaticamente para o e-mail do
              editor
            </li>
            <li>Se o prazo vencer sem entrega, a missão volta pra fila e o acesso é revogado</li>
            <li>
              Ao entregar, aprovar ou o editor cancelar, o acesso ao arquivo também é revogado
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-[family-name:var(--font-display)] text-xl font-semibold text-text">
            3. Propriedade do conteúdo
          </h2>
          <p>
            O vídeo bruto e o material editado continuam sendo de propriedade do porta-voz que o
            enviou. A Oficina Amarela não reivindica nenhum direito sobre esse conteúdo — apenas
            intermedia a conexão entre porta-voz e editor.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-[family-name:var(--font-display)] text-xl font-semibold text-text">
            4. Conduta esperada
          </h2>
          <ul className="list-disc pl-5">
            <li>
              Não usar a plataforma para conteúdo ilegal, difamatório ou que viole direitos de
              terceiros
            </li>
            <li>Respeitar os prazos de reserva assumidos</li>
            <li>Tratar os demais membros da guilda com respeito</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-[family-name:var(--font-display)] text-xl font-semibold text-text">
            5. Suspensão de conta
          </h2>
          <p>
            Contas que violarem repetidamente essas regras (ex.: não entregar missões reservadas,
            conteúdo impróprio) podem ser suspensas.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-[family-name:var(--font-display)] text-xl font-semibold text-text">
            6. Isenção de responsabilidade
          </h2>
          <p>
            A Oficina Amarela não é responsável pelo conteúdo enviado pelos porta-vozes nem pelo
            material editado pelos editores — a responsabilidade sobre o que é publicado é de quem
            publica.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-[family-name:var(--font-display)] text-xl font-semibold text-text">
            7. Alterações
          </h2>
          <p>
            Esses termos podem ser atualizados. Mudanças relevantes serão avisadas na plataforma.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-[family-name:var(--font-display)] text-xl font-semibold text-text">
            8. Contato
          </h2>
          <p>
            Dúvidas:{" "}
            <a href="mailto:lunatecfra@gmail.com" className="text-gold-hi hover:underline">
              lunatecfra@gmail.com
            </a>
            . Veja também a{" "}
            <Link href="/privacidade" className="font-medium text-gold-hi hover:underline">
              Política de Privacidade
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
