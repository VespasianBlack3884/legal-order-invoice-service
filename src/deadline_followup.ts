export type FollowUp = {
  required: boolean;
  reason: "awaiting_signature" | "deadline_near" | "none";
};

export function decideFollowUp(
  signedAt: string | undefined,
  deadline: string,
  now: Date,
): FollowUp {
  if (!signedAt) return { required: true, reason: "awaiting_signature" };

  const hoursRemaining = (Date.parse(deadline) - now.getTime()) / 3_600_000;
  if (hoursRemaining <= 48) return { required: true, reason: "deadline_near" };

  return { required: false, reason: "none" };
}
