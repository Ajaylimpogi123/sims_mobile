import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

/**
 * Which school term a Supervisor / Coordinator / Administrator is looking at (the website's header
 * term switcher). Students never switch: the server always scopes them to their own term.
 *
 * `selectedId` null means "follow the current term" (nothing is sent; the server defaults to it).
 * Picking the current term stores null, so a later change of current term is followed automatically.
 * Kept per user on the phone, so the choice survives a restart.
 *
 * Scoped list / dashboard queries read `useTermParam()` and put it in their query keys, so switching
 * refetches. This is a view choice only: the server enforces read-only past terms.
 */

const STORAGE_KEY = 'sims.selectedTerm';

interface State {
  /** Signed-in user this choice belongs to (null = signed out). */
  userId: number | null;
  /** True for roles that may switch (2, 3, 4). */
  scoped: boolean;
  /** An archived term being viewed, or null = the current term. */
  selectedId: number | null;
  /** GET /me current_term id. */
  currentId: number | null;
}

let state: State = { userId: null, scoped: false, selectedId: null, currentId: null };
const listeners = new Set<() => void>();

function emit(next: State) {
  if (
    next.userId === state.userId &&
    next.scoped === state.scoped &&
    next.selectedId === state.selectedId &&
    next.currentId === state.currentId
  ) {
    return;
  }
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function persist(userId: number, selectedId: number | null) {
  const write =
    selectedId === null
      ? SecureStore.deleteItemAsync(STORAGE_KEY)
      : SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify({ userId, termId: selectedId }));
  // A failed write only loses the choice on the next launch.
  write.catch(() => undefined);
}

async function restore(userId: number): Promise<number | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { userId?: unknown; termId?: unknown };
    return saved.userId === userId && typeof saved.termId === 'number' ? saved.termId : null;
  } catch {
    return null;
  }
}

export const selectedTerm = {
  /** Called by <TermSync> whenever the signed-in user or /me changes. */
  sync(userId: number | null, scoped: boolean, currentId: number | null) {
    if (userId === null) {
      emit({ userId: null, scoped: false, selectedId: null, currentId: null });
      return;
    }
    const sameUser = userId === state.userId;
    const selectedId = sameUser && scoped ? state.selectedId : null;
    emit({ userId, scoped, currentId, selectedId: selectedId === currentId ? null : selectedId });
    if (!sameUser && scoped) {
      void restore(userId).then((saved) => {
        // Ignore if the user changed or picked something meanwhile.
        if (state.userId !== userId || state.selectedId !== null || saved === null) return;
        emit({ ...state, selectedId: saved === state.currentId ? null : saved });
      });
    }
  },

  /** Switch the viewed term; null or the current term's id = back to current. */
  select(termId: number | null) {
    if (state.userId === null || !state.scoped) return;
    const selectedId = termId === state.currentId ? null : termId;
    emit({ ...state, selectedId });
    persist(state.userId, selectedId);
  },

  /** The viewed term no longer exists (deleted): back to current. */
  resetIfMissing(existingIds: readonly number[]) {
    if (state.selectedId !== null && !existingIds.includes(state.selectedId)) this.select(null);
  },

  get(): State {
    return state;
  },
};

function getSnapshot() {
  return state;
}

export function useSelectedTermState(): State {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** `term_id` to send with a term-scoped GET, or null to let the server use the current term. */
export function useTermParam(): number | null {
  const { scoped, selectedId } = useSelectedTermState();
  return scoped ? selectedId : null;
}

/** Past (archived) term: read-only except for Administrators. An older server without is_past: any non-current term. */
export function isPastTerm(term: { is_current: boolean; is_past?: boolean } | null | undefined): boolean {
  if (!term) return false;
  return term.is_past ?? !term.is_current;
}

/** The term's status: "Current", "Archived" (past) or "Upcoming". */
export function termStatusLabel(term: { is_current: boolean; is_past?: boolean }): 'Current' | 'Archived' | 'Upcoming' {
  if (term.is_current) return 'Current';
  return isPastTerm(term) ? 'Archived' : 'Upcoming';
}

/** The query-key part for a term param ('current' when nothing is sent). */
export type TermKey = number | 'current';

export function termKey(termId: number | null): TermKey {
  return termId ?? 'current';
}

/** `{ term_id }` for axios params, or nothing. */
export function termParams(termId: number | null): { term_id?: number } {
  return termId === null ? {} : { term_id: termId };
}
