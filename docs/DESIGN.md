# Design e proporção

Regras curtas, todas nascidas de coisa medida no navegador — não de gosto.
Quem cria tela nova confere isto antes de dizer que terminou.

## Celular vem primeiro na conferência

O PC é o alvo do projeto, mas o celular é onde os erros aparecem. Toda tela
nova se mede em **390px de largura, com toque emulado**, antes de subir.

```js
// no DevTools, com a página aberta
[...document.querySelectorAll('a,button,input,select,textarea')]
  .map(el => ({ t: (el.textContent||el.placeholder||el.type).trim().slice(0,24),
                h: Math.round(el.getBoundingClientRect().height),
                f: Math.round(parseFloat(getComputedStyle(el).fontSize)) }))
  .filter(x => x.h > 0 && x.h < 44)
```

O que sair nessa lista é alvo que o dedo erra.

## 1. Campo de texto: 16px, nunca menos

`font-size: 16px` cravado em tudo que recebe digitação.

Abaixo disso o Safari do iPhone **dá zoom sozinho** quando o campo recebe foco:
a tela salta, o resto do formulário sai de vista, e a pessoa precisa voltar com
o dedo. 16px é o limite exato em que ele deixa quieto.

Já está no `.field-input` do `globals.css`. Campo novo usa essa classe em vez
de inventar tamanho.

> Aconteceu: todos os campos do sistema estavam em `0.95rem` (15px). Cadastro,
> login, nova missão, perfil — tudo dava o pulo.

## 2. Alvo de toque: 44px de altura

É o menor alvo que a mão acerta de primeira. Vale para botão, link clicável,
aba, ícone que faz alguma coisa.

`.btn-gold`, `.btn-ghost` e `.field-input` já garantem por `min-height`. O que
precisa de atenção é o resto:

**Link dentro de frase** (Termos, Entrar, Esqueci a senha) nasce com a altura da
linha — 15 a 20px. Resolve com `inline-block` + padding vertical:

```tsx
<Link href="/termos" className="inline-block py-2">Termos de uso</Link>
```

O padding não muda o desenho, só aumenta a área que responde.

**Checkbox e radio** nascem com ~13px e não crescem bem. Em vez de esticar o
quadrado, dá área ao `<label>` que o envolve — quem toca é a frase inteira:

```tsx
<label className="flex min-h-11 items-center gap-2 px-1">
  <input type="checkbox" className="h-4 w-4 accent-gold" />
  Manter conectado
</label>
```

**Ícone que age** (mostrar senha, fechar) precisa de `h-11 w-11`, mesmo que o
desenho dentro seja menor.

Quando o padding empurrar o alinhamento, compensa com margem negativa
(`-mr-1`): a área cresce e a borda continua onde estava.

## 3. Texto: 12px é o piso

Abaixo disso não se lê no celular. `text-xs` do Tailwind é 12px — é o limite,
não o padrão. Texto de apoio usa `text-xs`; texto que a pessoa precisa ler de
verdade usa `text-sm` (14px) pra cima.

## 4. Largura de linha

Texto corrido não passa de ~70 caracteres por linha. No PC isso significa
segurar a largura (`max-w-lg`, `max-w-xl`), não deixar esticar até a borda.

## 5. Nada rola pra o lado

`document.documentElement.scrollWidth` não pode passar da largura da tela.
Conferir em **345, 390 e 414px**. Conteúdo largo — tabela, bloco de código,
imagem — vai dentro de um container com `overflow-x: auto`, e não empurrando a
página.

## 6. A identidade não se discute

Já está travada, e mudar exige decisão do Vitor:

| | |
|---|---|
| Ouro | `#f4ce1f` — o `--color-gold` |
| Prata | secundária, nunca compete com o ouro |
| Fundo | preto texturizado |
| Display | Cinzel — títulos, nome da marca |
| Corpo | Sora — todo o resto |
| Símbolo | onça-pintada dentro da casa |

As duas fontes moram em `public/fontes/` e são carregadas com `next/font/local`.
**Não trocar por `next/font/google`**: o build passa a baixar do Google a cada
execução, e o CI fica vermelho quando o Google demora.

## 7. Palavra na tela

Na tela é **missão**. No código é `pauta`. Na tela é **candidato** ou
**candidata** — nunca "vereador" nem "pré-candidato".
