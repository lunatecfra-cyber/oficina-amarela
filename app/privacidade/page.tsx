import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Política de Privacidade — Oficina Amarela" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 lg:px-8 lg:py-14">
      <Link href="/" className="flex items-center gap-3">
        <Logo size="normal" />
        <span className="font-[family-name:var(--font-display)] text-sm font-semibold tracking-[0.24em] text-gold">
          OFICINA AMARELA
        </span>
      </Link>

      <h1 className="mt-8 font-[family-name:var(--font-display)] text-3xl font-semibold text-text">
        Política de Privacidade
      </h1>

      <div className="mt-3 rounded-xl border border-gold-lo/40 bg-gold/[0.06] p-4 text-sm text-muted">
        ⚠️ Rascunho gerado em 27/07/2026, baseado no que a plataforma realmente coleta hoje. Revisar
        com um advogado antes de publicar de verdade — isso aqui não é aconselhamento jurídico.
      </div>

      <div className="prose-conf mt-8 flex flex-col gap-6 text-[15px] leading-relaxed text-muted">
        <section>
          <h2 className="mb-2 font-[family-name:var(--font-display)] text-xl font-semibold text-text">
            1. O que é a Oficina Amarela
          </h2>
          <p>
            A Oficina Amarela é uma plataforma que conecta porta-vozes (quem tem o vídeo bruto) a
            editores (quem edita), com um controle de qualidade garantindo o padrão antes da entrega
            final.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-[family-name:var(--font-display)] text-xl font-semibold text-text">
            2. Quais dados coletamos
          </h2>
          <ul className="list-disc pl-5">
            <li>Nome, apelido e e-mail (via cadastro ou login com Google)</li>
            <li>Sua senha, guardada apenas como hash — nunca em texto legível</li>
            <li>
              O que você preenche no perfil: foto, cidade/estado, bio e as etiquetas que escolhe
              (especialidades, softwares, temas, tom)
            </li>
            <li>
              Papel na plataforma (porta-voz, editor ou controle de qualidade), nível e reputação
            </li>
            <li>
              O conteúdo das missões: título, briefing e os{" "}
              <b className="text-text">links do Google Drive que você mesmo cola</b>
            </li>
            <li>
              <b className="text-text">Só para editores:</b> sua grade de disponibilidade e o
              horário do seu último acesso — é o que decide se uma missão pode ser oferecida a você
              agora
            </li>
            <li>
              Seu endereço de IP, guardado temporariamente para limitar tentativas de login e
              criação de contas em massa
            </li>
          </ul>
          <p className="mt-3">
            <b className="text-text">O que não coletamos:</b> não pedimos nem guardamos autorização
            de acesso ao seu Google Drive. O login com Google serve só para identificar você (nome,
            e-mail e foto). Os vídeos ficam no seu Drive; nós guardamos apenas o link que você cola.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-[family-name:var(--font-display)] text-xl font-semibold text-text">
            3. Para que usamos
          </h2>
          <ul className="list-disc pl-5">
            <li>Autenticar você e identificar seu papel na plataforma</li>
            <li>Calcular nível e reputação a partir do seu histórico de missões</li>
            <li>
              Decidir a qual editor oferecer cada missão, cruzando a grade de disponibilidade, o
              histórico de entregas e quem está online
            </li>
            <li>
              Mostrar seu perfil a quem participa da mesma missão — o porta-voz vê quem está
              editando, o editor vê de quem é o material
            </li>
            <li>Proteger as contas contra tentativa de invasão e cadastro em massa</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-[family-name:var(--font-display)] text-xl font-semibold text-text">
            4. Com quem compartilhamos
          </h2>
          <p>
            Não vendemos seus dados. Dentro da plataforma, seu perfil público (nome, foto, cidade e
            etiquetas) é visível para quem participa da mesma missão que você.
          </p>
          <p className="mt-2">
            <b className="text-text">Importante sobre o Google Drive:</b> quem libera o acesso ao
            arquivo bruto é você, no seu próprio Drive. A plataforma guarda o link, mas não concede
            nem revoga permissão nenhuma por você — quem controla quem enxerga o arquivo, e por
            quanto tempo, continua sendo você.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-[family-name:var(--font-display)] text-xl font-semibold text-text">
            5. Por quanto tempo guardamos
          </h2>
          <p>
            Enquanto sua conta existir. Ao excluir a conta, apagamos seu perfil, suas missões, seu
            portfólio e seu histórico — é imediato e não dá para desfazer.
          </p>
          <p className="mt-2">
            Os arquivos no seu Google Drive não são tocados: eles nunca estiveram conosco. Se você
            compartilhou uma pasta com algum editor, precisa remover esse acesso no próprio Drive.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-[family-name:var(--font-display)] text-xl font-semibold text-text">
            6. Seus direitos (LGPD)
          </h2>
          <p>Você pode, a qualquer momento:</p>
          <ul className="list-disc pl-5">
            <li>
              <b className="text-text">Apagar sua conta sozinho</b>, na tela de editar perfil — vai
              embora tudo, na hora
            </li>
            <li>Corrigir seus dados na mesma tela de editar perfil</li>
            <li>Pedir acesso a uma cópia dos seus dados, pelo e-mail abaixo</li>
            <li>
              Desfazer o compartilhamento de qualquer pasta do Google Drive direto no seu Drive —
              esse acesso nunca passou por nós
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-[family-name:var(--font-display)] text-xl font-semibold text-text">
            7. Segurança
          </h2>
          <ul className="list-disc pl-5">
            <li>Senhas guardadas como hash (bcrypt), nunca em texto legível</li>
            <li>Sessão em cookie assinado, inacessível a scripts da página</li>
            <li>
              Trocar a senha derruba as sessões abertas em outros aparelhos, e o link de recuperação
              vale uma vez só
            </li>
            <li>Todo o tráfego é por HTTPS</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-[family-name:var(--font-display)] text-xl font-semibold text-text">
            8. Contato
          </h2>
          <p>
            Dúvidas sobre privacidade, pedido de exclusão de conta ou qualquer direito previsto na
            LGPD:{" "}
            <a href="mailto:lunatecfra@gmail.com" className="text-gold-hi hover:underline">
              lunatecfra@gmail.com
            </a>
            .
          </p>
          <p className="mt-2">
            Você também pode apagar sua conta sozinho, a qualquer momento, na tela de editar perfil
            — a exclusão é imediata e não passa por nós.
          </p>
        </section>
      </div>
    </div>
  );
}
