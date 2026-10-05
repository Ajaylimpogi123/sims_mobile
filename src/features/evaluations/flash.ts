/**
 * One-shot success messages, like the website's flash after a redirect ("Evaluation draft saved.",
 * "Evaluation criterion added."). A form sets one before closing; the screen underneath takes it
 * on focus.
 */
let evaluationsPending: string | null = null;
let criteriaPending: string | null = null;

export function setEvaluationsFlash(message: string) {
  evaluationsPending = message;
}

export function takeEvaluationsFlash(): string | null {
  const message = evaluationsPending;
  evaluationsPending = null;
  return message;
}

export function setCriteriaFlash(message: string) {
  criteriaPending = message;
}

export function takeCriteriaFlash(): string | null {
  const message = criteriaPending;
  criteriaPending = null;
  return message;
}
