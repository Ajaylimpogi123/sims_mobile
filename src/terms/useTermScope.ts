import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useTerms } from '@/api/terms';
import { ROLE_ADMIN, ROLE_COORDINATOR, ROLE_SUPERVISOR, type Term } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';

import { isPastTerm, selectedTerm, useSelectedTermState } from './selected-term';

export interface TermScope {
  /** Supervisor / Coordinator / Administrator: may switch terms. */
  enabled: boolean;
  /** Every term, newest first ([] while loading or for students). */
  terms: Term[];
  termsLoading: boolean;
  current: Term | null;
  /** The term being viewed (null while an archived pick is still loading). */
  selected: Term | null;
  /** Viewing a past term (an upcoming one is fully open, so it isn't archived). */
  archived: boolean;
  /** Administrator: may still change archived records. */
  isAdmin: boolean;
  /** Archived and not an Administrator: write actions are hidden (the server refuses them anyway). */
  readOnly: boolean;
  select: (termId: number | null) => void;
}

/** The viewed term for term-scoped screens (picker, archived banner, read-only checks). */
export function useTermScope(): TermScope {
  const { me } = useAuth();
  const state = useSelectedTermState();
  const termsQuery = useTerms(state.scoped);
  const terms = termsQuery.data?.data ?? [];

  const current = terms.find((term) => term.id === state.currentId) ?? me?.current_term ?? null;
  const other = state.scoped && state.selectedId !== null;
  const selected = other ? (terms.find((term) => term.id === state.selectedId) ?? null) : current;
  // Unknown until the list loads; then only a past term is archived.
  const archived = other && isPastTerm(selected);
  const isAdmin = me?.user.role_id === ROLE_ADMIN;

  return {
    enabled: state.scoped,
    terms,
    termsLoading: termsQuery.isPending && state.scoped,
    current,
    selected,
    archived,
    isAdmin,
    readOnly: archived && !isAdmin,
    select: (termId) => selectedTerm.select(termId),
  };
}

const SCOPED_ROLES: number[] = [ROLE_SUPERVISOR, ROLE_COORDINATOR, ROLE_ADMIN];

/**
 * Keeps the selected-term store in step with the session: who is signed in, whether they may
 * switch, and which term is current (GET /terms when loaded, else /me). Mounted once under
 * <AuthProvider>. When the current term changes, every query is refetched (counts move with it);
 * a viewed term that was deleted falls back to current.
 */
export function TermSync() {
  const { me, status } = useAuth();
  const queryClient = useQueryClient();
  const userId = status === 'signedIn' && me ? me.user.id : null;
  const scoped = !!me && SCOPED_ROLES.includes(me.user.role_id);
  const terms = useTerms(userId !== null && scoped);
  const currentId = (terms.data ? terms.data.current_term_id : me?.current_term?.id) ?? null;
  const lastCurrent = useRef<{ userId: number | null; currentId: number | null }>({ userId: null, currentId: null });

  useEffect(() => {
    selectedTerm.sync(userId, scoped, currentId);
    const last = lastCurrent.current;
    if (userId !== null && last.userId === userId && last.currentId !== null && last.currentId !== currentId) {
      void queryClient.invalidateQueries();
    }
    lastCurrent.current = { userId, currentId };
  }, [userId, scoped, currentId, queryClient]);

  useEffect(() => {
    if (terms.data) selectedTerm.resetIfMissing(terms.data.data.map((term) => term.id));
  }, [terms.data]);

  return null;
}
