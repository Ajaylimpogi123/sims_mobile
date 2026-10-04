import { useCallback, useRef, useState } from 'react';

import { isRuleRefusal, useDecideApproval, type DecisionInput } from '@/api/approvals';
import { toApiError } from '@/api/errors';
import type { ApprovalItem, AttendanceLeg } from '@/api/types';

export interface Notice {
  tone: 'success' | 'error';
  message: string;
}

const GONE_MESSAGE = 'This attendance record is no longer available. The list has been refreshed.';

/**
 * Approve (one tap, like the website) / Reject (reason sheet) for Pending Approvals, shared by the
 * list and the evidence screen. One decision at a time: a second tap while one is in flight is
 * ignored, so nothing is ever submitted twice.
 */
export function useApprovalActions(onDecided?: (fresh: ApprovalItem, message: string) => void) {
  const decide = useDecideApproval();
  const inFlight = useRef(false);
  const [busy, setBusy] = useState<DecisionInput | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [rejecting, setRejecting] = useState<{ item: ApprovalItem; leg: AttendanceLeg } | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [sheetFieldError, setSheetFieldError] = useState<string | null>(null);

  const run = useCallback(
    async (input: DecisionInput, fromSheet: boolean) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(input);
      setNotice(null);
      setSheetError(null);
      setSheetFieldError(null);
      try {
        const response = await decide.mutateAsync(input);
        setRejecting(null);
        setNotice({ tone: 'success', message: response.message });
        onDecided?.(response.attendance, response.message);
      } catch (error) {
        const apiError = toApiError(error);
        if (fromSheet && apiError.fieldErrors.reason) {
          // 422 on the reason: keep the sheet open with the message under the field.
          setSheetFieldError(apiError.fieldErrors.reason);
        } else if (isRuleRefusal(error) || apiError.kind === 'not_found') {
          // Already decided (e.g. on the website) or gone: the caches were refreshed by the mutation.
          setRejecting(null);
          setNotice({ tone: 'error', message: apiError.kind === 'not_found' ? GONE_MESSAGE : apiError.message });
        } else if (fromSheet && !apiError.endsSession) {
          // Offline / server error: keep the typed reason so it can be sent again.
          setSheetError(apiError.message);
        } else {
          setRejecting(null);
          setNotice({ tone: 'error', message: apiError.message });
        }
      } finally {
        inFlight.current = false;
        setBusy(null);
      }
    },
    [decide, onDecided],
  );

  const approve = useCallback((item: ApprovalItem, leg: AttendanceLeg) => void run({ id: item.id, leg, decision: 'approve' }, false), [run]);

  const openReject = useCallback((item: ApprovalItem, leg: AttendanceLeg) => {
    if (inFlight.current) return;
    setSheetError(null);
    setSheetFieldError(null);
    setRejecting({ item, leg });
  }, []);

  const submitReject = useCallback(
    (reason: string) => {
      if (!rejecting) return;
      void run({ id: rejecting.item.id, leg: rejecting.leg, decision: 'reject', reason }, true);
    },
    [rejecting, run],
  );

  const closeReject = useCallback(() => setRejecting(null), []);

  return {
    /** The decision being sent, if any (its button shows a spinner; every other one is disabled). */
    busy,
    notice,
    dismissNotice: useCallback(() => setNotice(null), []),
    /** Shows a message in the same place, e.g. the flash from the evidence screen. */
    showNotice: setNotice,
    approve,
    openReject,
    rejecting,
    submitReject,
    closeReject,
    sheetError,
    sheetFieldError,
  };
}

export type ApprovalActions = ReturnType<typeof useApprovalActions>;
