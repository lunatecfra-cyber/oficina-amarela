export type PortfolioSample = {
  id: string;
  title: string;
  description: string;
  specialties: string;
  previewSeconds: number;
  mediaKind: "image" | "video";
};

export const PORTFOLIO_AUTHORIZATION_STATEMENT =
  "Declaro que tenho todas as permissões necessárias para divulgar esta amostra, nesta versão, no portfólio do editor dentro da Oficina Amarela.";

export const WORK_PREFERENCE_LABELS = {
  volunteer: "Trabalhos voluntários",
  paid: "Trabalhos remunerados",
  both: "Voluntários e remunerados",
};
