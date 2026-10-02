/**
 * Lets the API client tell the AuthProvider "the server ended this session"
 * (401, or 403 role_not_allowed / account_inactive) without importing React code.
 */
type SessionEndedHandler = (message: string) => void;

let handler: SessionEndedHandler | null = null;

export function setSessionEndedHandler(next: SessionEndedHandler | null): () => void {
  handler = next;
  return () => {
    if (handler === next) handler = null;
  };
}

export function notifySessionEnded(message: string): void {
  handler?.(message);
}
