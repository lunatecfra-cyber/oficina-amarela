---
name: "Testes Manuais Oficina Amarela"
description: "Como verificar se o código funciona neste projeto sem usar testes automatizados."
---

# Skill: Testes Manuais

Neste projeto não usamos infraestrutura de testes automatizados (Jest, Cypress, etc.). 
Para provar que o código funciona, siga este roteiro:

1. **Compilação:** Sempre rode `npm run build` para garantir que não há erros de tipagem do TypeScript ou do Next.js.
2. **Banco de Dados:** O sistema depende do Postgres. Ao testar fluxos novos, verifique se as tabelas foram criadas/atualizadas corretamente usando comandos SQL diretos no banco local.
3. **Servidor:** Inicie com `npm run dev`.
4. **Verificação de Regras Críticas:**
   - O Porta-voz nunca pode ver a missão de outro.
   - O Editor só pode pegar 1 missão por vez.
   - O arquivo do vídeo NUNCA sobe pro nosso servidor, fica no Drive.
5. **Reporte:** Ao concluir, informe sempre de forma clara (Modo Caveman) o que foi verificado e o comando usado para provar.
