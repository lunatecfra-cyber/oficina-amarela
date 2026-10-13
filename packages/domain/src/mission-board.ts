export type BoardMission = {
  id: number;
  title: string;
  format: string;
  status: string;
  spokesperson: string;
  desiredDeadline: string | null;
  motivation: string | null;
  extras: string | null;
  tone: string | null;
  refs: string | null;
  interested: number;
  offerStatus: string | null;
  assignedToMe: number;
};
export type BoardEditor = {
  id: number;
  handle: string;
  name: string;
  headline: string | null;
  portfolioLink: string | null;
  styles: string | null;
  niches: string | null;
  availability: string | null;
  rating: number | null;
  ratingCount: number;
  interested: number;
  eligible: number;
  offerStatus: string | null;
};
export type MissionSelection = {
  status: string;
  candidates: BoardEditor[];
  selected: { editorId: number; name: string; status: string; expiresAt: string } | null;
};
