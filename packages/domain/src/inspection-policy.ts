export function inspectionPolicy(input: {
  deliveries: number;
  experiencedInvitedByAdmin?: boolean;
  critical?: boolean;
  riskRequiresInspection?: boolean;
  sampled?: boolean;
  stagingMandatory?: boolean;
}): { required: boolean | null; reason: string } {
  if (input.critical) return { required: true, reason: "critical" };
  if (input.riskRequiresInspection) return { required: true, reason: "risk" };
  if (input.experiencedInvitedByAdmin && input.deliveries < 1)
    return { required: true, reason: "invited_first_delivery" };
  if (!input.experiencedInvitedByAdmin && input.deliveries < 3)
    return { required: true, reason: "first_three_deliveries" };
  if (input.stagingMandatory) return { required: true, reason: "staging_mandatory" };
  if (
    input.critical === undefined ||
    input.riskRequiresInspection === undefined ||
    input.sampled === undefined
  )
    return { required: null, reason: "parameters_pending" };
  return { required: input.sampled, reason: "sampling" };
}
