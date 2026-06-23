/**
 * WorkflowEngine — Single source of truth for ALL task status transitions.
 * Every status change in the entire application must go through this engine.
 * No component should call db.updateAction directly for status changes.
 */

import { db } from './db';
import dayjs from 'dayjs';

// ─── STATE MACHINE ────────────────────────────────────────────────────────────
//
// PENDING ──────► IN_PROGRESS ──────► REVIEW ──────► COMPLETED
//                     ▲                  │
//                     └──────────────────┘  (REJECT loops back)
//
// ─────────────────────────────────────────────────────────────────────────────

export const WORKFLOW_TRANSITIONS = {
  START:          { from: ['PENDING', 'TODO'],  to: 'IN_PROGRESS' },
  SUBMIT_REVIEW:  { from: ['IN_PROGRESS'],       to: 'REVIEW'      },
  APPROVE:        { from: ['REVIEW'],            to: 'COMPLETED'   },
  REJECT:         { from: ['REVIEW'],            to: 'IN_PROGRESS' },
  FORCE_COMPLETE: { from: ['IN_PROGRESS'],       to: 'COMPLETED'   },
  FORCE_REJECT:   { from: ['*'],                 to: 'REJECTED'    },
  REOPEN:         { from: ['COMPLETED'],         to: 'IN_PROGRESS' },
};

export const hasEverBeenStarted = (task) => {
  return !!(
    task?.timeTracking?.startedAt ||
    task?.startedAt ||
    ['IN_PROGRESS', 'REVIEW', 'COMPLETED', 'REJECTED'].includes(
      (task?.status || '').toUpperCase()
    )
  );
};

// ─── RBAC CHECK ───────────────────────────────────────────────────────────────

export const canDoTransition = (currentUser, task, transitionKey) => {
  const role = (
    currentUser?.role?.name || currentUser?.role || ''
  ).toLowerCase();

  const userId =
    currentUser?._id || currentUser?.id || currentUser?.userId;

  const isAdmin =
    ['admin', 'superadmin', 'super_admin', 'super admin', 'supert admin'].includes(role) ||
    role.includes('super') ||
    role.includes('supert');

  const isManager =
    ['admin', 'superadmin', 'super_admin', 'super admin', 'supert admin', 'manager'].includes(role) ||
    role.includes('super') ||
    role.includes('supert');

  const assignedToList = task?.assignedTo
    ? Array.isArray(task.assignedTo)
      ? task.assignedTo
      : [task.assignedTo]
    : [];

  const isAssignee = assignedToList.some(
    (u) => (u?._id || u?.id || u) === userId
  );

  const reviewerId =
    task?.reviewer?._id ||
    task?.reviewer?.id ||
    task?.reviewer;

  const isReviewer = reviewerId && reviewerId === userId;

  const current = (task?.status || 'PENDING').toUpperCase();
  const { from } = WORKFLOW_TRANSITIONS[transitionKey] || {};

  // Check if current status is a valid source for this transition
  const validSource =
    from?.includes('*') || from?.includes(current);

  if (!validSource) return false;

  switch (transitionKey) {
    case 'START':
      // CRITICAL: Never allow start if task has ever been started before
      if (hasEverBeenStarted(task)) return false;
      return isAssignee || isAdmin;

    case 'SUBMIT_REVIEW':
      return isAssignee || isAdmin;

    case 'APPROVE':
      return isReviewer || isAdmin;

    case 'REJECT':
      return isReviewer || isAdmin;

    case 'FORCE_COMPLETE':
      // Only when there is no reviewer assigned
      return isAdmin && !task?.reviewer;

    case 'FORCE_REJECT':
      return isAdmin;

    case 'REOPEN':
      return isAdmin;

    default:
      return isAdmin;
  }
};

// ─── TIMESTAMP BUILDER ────────────────────────────────────────────────────────

const buildTimestampUpdate = (transitionKey, existingTimeTracking = {}) => {
  const now = new Date().toISOString();

  switch (transitionKey) {
    case 'START':
      return {
        timeTracking: {
          ...existingTimeTracking,
          startedAt: existingTimeTracking.startedAt || now,
        },
      };

    case 'SUBMIT_REVIEW':
      return {
        timeTracking: {
          ...existingTimeTracking,
          submittedAt: now,
        },
      };

    case 'APPROVE':
      return {
        timeTracking: {
          ...existingTimeTracking,
          completedAt: now,
          approvedAt: now,
        },
      };

    case 'REJECT':
      return {
        timeTracking: {
          ...existingTimeTracking,
          rejectedAt: now,
          // Reset submittedAt so next submission is clean
          submittedAt: null,
        },
      };

    case 'FORCE_COMPLETE':
      return {
        timeTracking: {
          ...existingTimeTracking,
          completedAt: now,
        },
      };

    case 'FORCE_REJECT':
      return {
        timeTracking: {
          ...existingTimeTracking,
          rejectedAt: now,
        },
      };

    case 'REOPEN':
      return {
        timeTracking: {
          ...existingTimeTracking,
          reopenedAt: now,
          // Clear completion timestamps
          completedAt: null,
          approvedAt: null,
        },
      };

    default:
      return {};
  }
};

// ─── REJECTION HISTORY BUILDER ────────────────────────────────────────────────

const buildRejectionHistory = (task, feedback, reviewedBy) => {
  const existing = Array.isArray(task.rejections) ? task.rejections : [];
  return [
    ...existing,
    {
      count:      existing.length + 1,
      reason:     feedback,
      rejectedBy: reviewedBy,
      rejectedAt: new Date().toISOString(),
    },
  ];
};

// ─── MAIN TRANSITION EXECUTOR ─────────────────────────────────────────────────
//
// This is the ONE function everything calls.
// It validates, builds the payload, and calls the API.
//
// Returns: { success: boolean, newStatus: string, error?: string }

export const executeTransition = async ({
  task,
  transitionKey,
  currentUser,
  payload = {},
}) => {
  // 1. Validate the transition is allowed for this user
  if (!canDoTransition(currentUser, task, transitionKey)) {
    return {
      success: false,
      error: 'You do not have permission to perform this action.',
    };
  }

  const { to: newStatus } = WORKFLOW_TRANSITIONS[transitionKey];
  const taskId = task._id || task.id;

  // 2. Build the complete update payload
  const timestampUpdate = buildTimestampUpdate(
    transitionKey,
    task.timeTracking || {}
  );

  let updatePayload = {
    status: newStatus,
    ...timestampUpdate,
  };

  // 3. Handle start note / estimated completion
  if (transitionKey === 'START') {
    updatePayload.timeTracking = {
      ...updatePayload.timeTracking,
      startNote: payload.startNote || '',
      estimatedCompletion: payload.estimatedCompletion || null,
    };
  }

  // 4. Handle submission
  if (transitionKey === 'SUBMIT_REVIEW') {
    updatePayload.submission = payload.submission || payload || null;
  }

  // 5. Handle rejection — append to rejection history
  if (transitionKey === 'REJECT') {
    updatePayload.rejections = buildRejectionHistory(
      task,
      payload.feedback || payload.rejectionReason || payload.reason || '',
      currentUser._id || currentUser.id
    );
    // Unset submission data so worker must re-submit fresh
    updatePayload.submission = null;
  }

  // 6. Handle approve — store reviewer decision
  if (transitionKey === 'APPROVE') {
    updatePayload.reviewDecision = {
      decision:    'APPROVED',
      feedback:    payload.feedback || payload.reason || '',
      reviewedBy:  currentUser._id || currentUser.id,
      reviewedAt:  new Date().toISOString(),
    };
  }

  // 5. Execute the API call
  try {
    await db.updateAction(taskId, updatePayload);
    return { success: true, newStatus };
  } catch (err) {
    console.error('WorkflowEngine.executeTransition error:', err);
    return {
      success: false,
      error: err?.message || 'Status update failed. Please try again.',
    };
  }
};

// ─── CONVENIENCE WRAPPERS ─────────────────────────────────────────────────────
// These are the functions components actually call.
// Each one calls executeTransition internally.

export const startTask = (task, currentUser, extraPayload = {}) =>
  executeTransition({
    task,
    transitionKey: 'START',
    currentUser,
    payload: extraPayload,
  });

export const submitTaskForReview = (task, currentUser, submissionData) =>
  executeTransition({
    task,
    transitionKey: 'SUBMIT_REVIEW',
    currentUser,
    payload: { submission: submissionData },
  });

export const approveTask = (task, currentUser, decisionData) =>
  executeTransition({
    task,
    transitionKey: 'APPROVE',
    currentUser,
    payload: decisionData,
  });

export const rejectTask = (task, currentUser, rejectionData) =>
  executeTransition({
    task,
    transitionKey: 'REJECT',
    currentUser,
    payload: rejectionData,
  });

export const forceCompleteTask = (task, currentUser) =>
  executeTransition({
    task,
    transitionKey: 'FORCE_COMPLETE',
    currentUser,
  });

export const forceRejectTask = (task, currentUser, reason) =>
  executeTransition({
    task,
    transitionKey: 'FORCE_REJECT',
    currentUser,
    payload: { adminRejectionReason: reason },
  });

export const reopenTask = (task, currentUser) =>
  executeTransition({
    task,
    transitionKey: 'REOPEN',
    currentUser,
  });

// ─── COMPUTED STATUS HELPERS ──────────────────────────────────────────────────

export const isOverdue = (task) => {
  const deadline = task?.timeTracking?.deadline || task?.DueDate;
  if (!deadline) return false;
  const s = (task.status || '').toUpperCase();
  if (['COMPLETED', 'REJECTED'].includes(s)) return false;
  return new Date(deadline) < new Date();
};

export const getDisplayStatus = (task) => {
  if (isOverdue(task)) return 'OVERDUE';
  return (task.status || 'PENDING').toUpperCase();
};

export const getDurationLabel = (task) => {
  const start = task?.timeTracking?.startedAt;
  const end   = task?.timeTracking?.completedAt;
  if (!start) return null;
  const s = dayjs(start);
  const e = end ? dayjs(end) : dayjs();
  const h = e.diff(s, 'hour');
  const m = e.diff(s, 'minute') % 60;
  if (h > 24) return `${e.diff(s, 'day')}d`;
  if (h > 0)  return `${h}h ${m}m`;
  return `${m}m`;
};

export const getRejectionCount = (task) =>
  Array.isArray(task?.rejections) ? task.rejections.length : 0;

export const getLastRejection = (task) => {
  const rejections = task?.rejections;
  if (!Array.isArray(rejections) || rejections.length === 0) return null;
  return rejections[rejections.length - 1];
};
