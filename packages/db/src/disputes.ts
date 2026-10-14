import type { Role } from "@oficina/domain/roles";

export type DisputeStatus = "open" | "in_review" | "decided" | "appealed" | "closed";
export type DisputeCategory = "quality" | "deadline" | "scope" | "conduct" | "other";
export type DisputeOutcome = "upheld" | "partially_upheld" | "dismissed";

export type DisputeFailure =
  | "not_found"
  | "forbidden" // no role/capability, or tied to the case
  | "invalid" // text outside the limits or unknown value
  | "conflict" // someone got there first, or a live dispute already exists
  | "unavailable" // the current state does not allow the action
  | "unsupported";
export type DisputeResult<T> = ({ ok: true } & T) | { ok: false; reason: DisputeFailure };

export type DisputeActor = { id: number; name: string; role: Role };

export type DisputeSummary = {
  id: number;
  missionId: number;
  missionTitle: string;
  status: DisputeStatus;
  category: DisputeCategory;
  openedById: number;
  openedByName: string;
  counterpartId: number;
  counterpartName: string;
  createdAt: string;
  updatedAt: string;
};
export type DisputeAttachment = {
  id: number;
  statementId: number;
  filename: string;
  contentType: string;
  size: number;
};
export type DisputeStatementView = {
  id: number;
  authorId: number;
  authorName: string;
  authorKind: "party" | "mediator";
  body: string;
  createdAt: string;
  attachments: DisputeAttachment[];
};
export type DisputeDecisionView = {
  round: 1 | 2;
  deciderId: number;
  deciderName: string;
  outcome: DisputeOutcome;
  rationale: string;
  recommendation: string | null;
  createdAt: string;
};
export type DisputeCase = DisputeSummary & {
  claim: string;
  missionStatus: string;
  deliveryVersion: number;
  mediatorId: number | null;
  appealReviewerId: number | null;
  closeReason: string | null;
  statements: DisputeStatementView[];
  decisions: DisputeDecisionView[];
  appeal: { requestedById: number; reason: string; createdAt: string } | null;
  /** What this person can do now; the interface only shows the buttons that apply. */
  can: {
    statement: boolean;
    take: boolean;
    decide: boolean;
    appeal: boolean;
    close: boolean;
    evidence: boolean;
  };
};
export type NewDisputeAttachment = {
  objectKey: string;
  filename: string;
  contentType: string;
  size: number;
  sha256: string;
};

export interface DisputeRepository {
  open(
    actor: DisputeActor,
    input: { missionId: number; category: string; claim: string },
  ): Promise<DisputeResult<{ id: number }>>;
  list(actor: DisputeActor): Promise<DisputeResult<{ disputes: DisputeSummary[] }>>;
  get(actor: DisputeActor, id: number): Promise<DisputeResult<{ dispute: DisputeCase }>>;
  /** Authorizes before writing bytes to R2. */
  canStatement(actor: DisputeActor, id: number): Promise<DisputeResult<object>>;
  addStatement(
    actor: DisputeActor,
    id: number,
    text: string,
    attachment?: NewDisputeAttachment,
  ): Promise<DisputeResult<{ statementId: number }>>;
  take(actor: DisputeActor, id: number): Promise<DisputeResult<object>>;
  decide(
    actor: DisputeActor,
    id: number,
    input: { outcome: string; rationale: string; recommendation?: string },
  ): Promise<DisputeResult<{ round: 1 | 2 }>>;
  appeal(actor: DisputeActor, id: number, reason: string): Promise<DisputeResult<object>>;
  close(actor: DisputeActor, id: number, reason: string): Promise<DisputeResult<object>>;
  evidence(
    actor: DisputeActor,
    id: number,
  ): Promise<
    DisputeResult<{
      capturedAt: string;
      items: { kind: string; sourceId: string; payload: unknown }[];
    }>
  >;
  attachmentFor(
    actor: DisputeActor,
    id: number,
    attachmentId: number,
  ): Promise<DisputeResult<{ attachment: DisputeAttachment & { objectKey: string } }>>;
  /** Grants or removes the mediation capability. The caller was already authorized by the route. */
  setMediator(
    admin: DisputeActor,
    userId: number,
    granted: boolean,
  ): Promise<DisputeResult<object>>;
}

const unsupported = async () => ({ ok: false as const, reason: "unsupported" as const });

/** Disputes are D1 only: on PostgreSQL every operation fails closed. */
export const postgresDisputes: DisputeRepository = {
  open: unsupported,
  list: unsupported,
  get: unsupported,
  canStatement: unsupported,
  addStatement: unsupported,
  take: unsupported,
  decide: unsupported,
  appeal: unsupported,
  close: unsupported,
  evidence: unsupported,
  attachmentFor: unsupported,
  setMediator: unsupported,
};
