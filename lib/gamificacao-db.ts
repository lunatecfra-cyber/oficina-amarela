import { sql } from "@/lib/db";

export type TipoEventoGamificacao = "entrada_diaria" | "missao_entregue";

export type DesafioDoDia = {
  id: TipoEventoGamificacao;
  titulo: string;
  descricao: string;
  xp: number;
  cumprido: boolean;
};

const REGRAS: Record<TipoEventoGamificacao, Omit<DesafioDoDia, "cumprido">> = {
  entrada_diaria: {
    id: "entrada_diaria",
    titulo: "Entrou no site",
    descricao: "Acesse a Oficina Amarela hoje.",
    xp: 10,
  },
  missao_entregue: {
    id: "missao_entregue",
    titulo: "Entregue uma missão hoje",
    descricao: "Envie uma edição válida para revisão.",
    xp: 40,
  },
};

function dataDeBrasilia(data = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(data);
}

export async function registrarEventoGamificacao(
  userId: number,
  regraId: TipoEventoGamificacao,
  referencia: string,
): Promise<{ registrado: boolean; xp: number }> {
  const regra = REGRAS[regraId];
  // Inserção e XP são uma única instrução: se uma falhar, a outra não fica
  // pela metade. A chave única deixa chamadas repetidas sem efeito.
  const [evento] = await sql`
    WITH novo_evento AS (
      INSERT INTO gamificacao_eventos (user_id, regra_id, referencia, xp)
      VALUES (${userId}, ${regraId}, ${referencia}, ${regra.xp})
      ON CONFLICT (user_id, regra_id, referencia) DO NOTHING
      RETURNING xp
    )
    UPDATE users
    SET reputacao = users.reputacao + novo_evento.xp
    FROM novo_evento
    WHERE users.id = ${userId}
    RETURNING novo_evento.xp
  `;

  return evento ? { registrado: true, xp: Number(evento.xp) } : { registrado: false, xp: 0 };
}

export async function registrarEntradaDiaria(userId: number) {
  return registrarEventoGamificacao(userId, "entrada_diaria", dataDeBrasilia());
}

export async function listarDesafiosDoDia(userId: number): Promise<DesafioDoDia[]> {
  const hoje = dataDeBrasilia();
  let linhas: { regra_id: unknown }[] = [];
  try {
    linhas = (await sql`
      SELECT regra_id
      FROM gamificacao_eventos
      WHERE user_id = ${userId}
        AND ((regra_id = 'entrada_diaria' AND referencia = ${hoje})
          OR (regra_id = 'missao_entregue' AND criado_em AT TIME ZONE 'America/Sao_Paulo' >= ${hoje}::date))
    `) as unknown as { regra_id: unknown }[];
  } catch {
    // A tela continua legível durante a janela entre deploy e migration.
  }
  const feitos = new Set(linhas.map((linha) => String(linha.regra_id)));
  return Object.values(REGRAS).map((regra) => ({
    ...regra,
    cumprido: feitos.has(regra.id),
  }));
}
