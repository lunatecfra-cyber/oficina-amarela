/**
 * Traduz a resposta de erro de uma API numa frase que a pessoa entende.
 *
 * Existe por dois motivos concretos:
 *
 * 1. As rotas respondem em INGLÊS ("Only spokespersons may dispatch
 *    missions.", "File exceeds max 2 GB limit.") e vários componentes
 *    repassavam esse texto direto pra tela de um app todo em português.
 *
 * 2. Um 403 e um 500 viravam a mesma frase: "Não deu pra concluir. Tenta de
 *    novo." Quem perdeu acesso ficava tentando de novo pra sempre, porque a
 *    tela nunca disse que insistir não ia adiantar.
 *
 * O código HTTP é a fonte: ele não muda de idioma nem de redação.
 */
export function mensagemDeErro(status: number, fallback?: string): string {
  switch (status) {
    case 401:
      return "Sua sessão expirou. Entre de novo pra continuar.";
    case 403:
      return "Você não tem acesso a essa ação. Se acha que deveria ter, fale com o inspetor.";
    case 404:
      return "Isso não existe mais — pode ter sido removido enquanto você olhava.";
    case 409:
      return "Alguém mexeu nisso antes de você. Atualize a página e confira como ficou.";
    case 413:
      return "Arquivo grande demais. Comprima antes e tente de novo.";
    case 429:
      return "Você fez isso muitas vezes seguidas. Espere um pouco e tente de novo.";
    default:
      if (status >= 500) return "O servidor falhou. Não é você — tente de novo em alguns minutos.";
      return fallback ?? "Não deu pra concluir. Tente de novo.";
  }
}

/**
 * Insistir resolve? Serve pra decidir se a tela oferece "tentar de novo".
 * Em 403 e 404 o botão só gera frustração.
 */
export function valeTentarDeNovo(status: number): boolean {
  return status === 429 || status >= 500 || status === 409;
}
