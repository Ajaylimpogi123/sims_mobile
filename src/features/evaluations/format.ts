import type { EvaluationStatus } from '@/api/types';

/** Same labels as the StatusBadge (website: capitalized status). */
export const STATUS_LABEL: Record<EvaluationStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  locked: 'Locked',
};

/** "Rating 4" style 422 for one criterion: errors["responses.3.rating"] -> criterion id via what we sent. */
export function responseErrorsByCriterion(
  fieldErrors: Record<string, string>,
  sent: { evaluation_criteria_id: number }[],
): Record<number, string> {
  const result: Record<number, string> = {};
  for (const [key, message] of Object.entries(fieldErrors)) {
    const match = /^responses\.(\d+)\./.exec(key);
    if (!match) continue;
    const criterionId = sent[Number(match[1])]?.evaluation_criteria_id;
    if (criterionId !== undefined && !result[criterionId]) result[criterionId] = message;
  }
  return result;
}
