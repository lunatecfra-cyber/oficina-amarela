import Link from "next/link";
import Image from "next/image";
import styles from "./preview.module.css";

export default function HomePreview() {
  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>
        <Image src="/emblema.png" alt="" width={48} height={48} />
        Oficina Amarela
      </Link>
      <nav aria-label="Navegação principal"><a href="#como-funciona">Como funciona</a><Link href="/parceiros">A comunidade</Link><Link href="/login">Entrar</Link></nav>
    </header>
    <section className={styles.hero}>
      <Image className={styles.emblem} src="/emblema.png" alt="Emblema da Oficina Amarela" width={180} height={180} priority />
      <p className={styles.eyebrow}>Uma comunidade que coloca a mão na edição</p>
      <h1>Oficina<br />Amarela<span>.</span></h1>
      <p className={styles.intro}>Você traz a ideia. A gente trabalha junto para transformar o vídeo bruto em uma história pronta para compartilhar.</p>
      <div className={styles.actions}><Link className={styles.primary} href="/criar-conta">Quero editar vídeos <span aria-hidden="true">↗</span></Link><a href="#porta-voz">Sou porta-voz <span aria-hidden="true">↓</span></a></div>
      <p className={styles.caption}>Aprenda na prática. Uma missão por vez.</p>
    </section>
    <section className={styles.workflow} id="como-funciona">
      <div className={styles.sectionHeading}><p>DO BRUTO AO PRONTO</p><h2>Um bom vídeo é<br />um trabalho em equipe.</h2></div>
      <ol className={styles.steps}>
        <li><span>01 / MATERIAL</span><h3>A história começa com você.</h3><p>O porta-voz envia vídeos, fotos ou um link com o material e conta o que precisa.</p></li>
        <li><span>02 / EDIÇÃO</span><h3>Uma missão. Um editor.</h3><p>O editor recebe a missão, organiza os cortes e prepara a entrega. A conversa acontece no projeto.</p></li>
        <li><span>03 / ENTREGA</span><h3>Revisado. Aprovado. Pronto.</h3><p>O vídeo passa pela revisão. O porta-voz aprova ou pede um ajuste antes de compartilhar.</p></li>
      </ol>
    </section>
    <section className={styles.join} id="porta-voz"><div><p>PARA QUEM TEM UMA HISTÓRIA</p><h2>Seu material merece<br />uma boa edição.</h2></div><div><p>A entrada de porta-voz acontece por convite especial do inspetor, vinculado ao seu e-mail.</p><Link href="/login">Já tenho uma conta <span aria-hidden="true">↗</span></Link><p className={styles.caption}>Recebeu um convite? Abra o link enviado pelo inspetor para concluir seu cadastro.</p></div></section>
    <section className={styles.resources}><h2>Faça parte. E aprenda fazendo.</h2><div><Link href="/aulas"><strong>Pequenas aulas</strong><span>O básico que ajuda na próxima edição. ↗</span></Link><Link href="/ferramentas"><strong>Ferramentas úteis</strong><span>Recursos para tirar sua ideia do papel. ↗</span></Link><Link href="/parceiros"><strong>Quem faz a Oficina</strong><span>Conheça a comunidade. ↗</span></Link></div></section>
    <footer className={styles.footer}><span>Oficina Amarela</span><div><Link href="/termos">Termos</Link><Link href="/privacidade">Privacidade</Link><Link href="/login">Entrar</Link></div></footer>
  </main>;
}
