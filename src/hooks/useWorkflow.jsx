/**
 * useWorkflow — React hook that wraps workflowEngine for use in components.
 * Handles loading states, toast messages, and data refresh automatically.
 * Components only call hook methods — never the engine directly.
 */

import React, { useState, useCallback } from 'react';
import { notification, message } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  PlayCircleOutlined,
  SendOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import {
  startTask,
  submitTaskForReview,
  approveTask,
  rejectTask,
  forceCompleteTask,
  forceRejectTask,
  reopenTask,
  canDoTransition,
} from '../services/workflowEngine';

const TRANSITION_MESSAGES = {
  START: {
    success: {
      message:     'Task Started',
      description: 'The task has moved to In Progress.',
      icon:        <PlayCircleOutlined style={{ color: '#1976D2' }} />,
    },
    error: { message: 'Could not start task' },
  },
  SUBMIT_REVIEW: {
    success: {
      message:     'Submitted for Review',
      description: 'The reviewer has been notified.',
      icon:        <SendOutlined style={{ color: '#9C27B0' }} />,
    },
    error: { message: 'Submission failed' },
  },
  APPROVE: {
    success: {
      message:     'Task Approved',
      description: 'The task has been marked as complete.',
      icon:        <CheckCircleOutlined style={{ color: '#2E7D32' }} />,
    },
    error: { message: 'Approval failed' },
  },
  REJECT: {
    success: {
      message:     'Task Rejected',
      description: 'The task has been returned to In Progress.',
      icon:        <CloseCircleOutlined style={{ color: '#D32F2F' }} />,
    },
    error: { message: 'Rejection failed' },
  },
  FORCE_COMPLETE: {
    success: {
      message:     'Task Completed',
      description: 'Task marked complete without review.',
      icon:        <CheckCircleOutlined style={{ color: '#2E7D32' }} />,
    },
    error: { message: 'Could not complete task' },
  },
  FORCE_REJECT: {
    success: {
      message:     'Task Force Rejected',
      description: 'Task has been rejected by admin.',
      icon:        <ExclamationCircleOutlined style={{ color: '#D32F2F' }} />,
    },
    error: { message: 'Force rejection failed' },
  },
  REOPEN: {
    success: {
      message:     'Task Reopened',
      description: 'Task has been moved back to In Progress.',
      icon:        <PlayCircleOutlined style={{ color: '#1976D2' }} />,
    },
    error: { message: 'Could not reopen task' },
  },
};

export const useWorkflow = ({ currentUser, onSuccess }) => {
  const [loadingTaskId, setLoadingTaskId] = useState(null);
  const [loadingAction, setLoadingAction] = useState(null);

  const isLoading = (taskId, action) =>
    loadingTaskId === (taskId) && loadingAction === action;

  const execute = useCallback(
    async (transitionFn, transitionKey, task, extraPayload) => {
      const taskId = task._id || task.id;
      setLoadingTaskId(taskId);
      setLoadingAction(transitionKey);

      try {
        const result = await transitionFn(task, currentUser, extraPayload);

        if (result.success) {
          const msgs = TRANSITION_MESSAGES[transitionKey]?.success;
          notification.open({
            message:     msgs?.message     || 'Success',
            description: msgs?.description || '',
            icon:        msgs?.icon,
            placement:   'topRight',
            duration:    4,
          });
          if (typeof onSuccess === 'function') {
            await onSuccess();
          }
        } else {
          message.error(
            result.error ||
              TRANSITION_MESSAGES[transitionKey]?.error?.message ||
              'Action failed'
          );
        }

        return result;
      } catch (err) {
        console.error('useWorkflow.execute error:', err);
        message.error('An unexpected error occurred');
        return { success: false, error: err?.message };
      } finally {
        setLoadingTaskId(null);
        setLoadingAction(null);
      }
    },
    [currentUser, onSuccess]
  );

  // ─── Public methods ───────────────────────────────────────────────────────

  const handleStart = useCallback(
    (task, payload = {}) =>
      execute(startTask, 'START', task, payload),
    [execute]
  );

  const handleSubmitForReview = useCallback(
    (task, submissionData) =>
      execute(submitTaskForReview, 'SUBMIT_REVIEW', task, submissionData),
    [execute]
  );

  const handleApprove = useCallback(
    (task, decisionData = {}) =>
      execute(approveTask, 'APPROVE', task, decisionData),
    [execute]
  );

  const handleReject = useCallback(
    (task, rejectionData) =>
      execute(rejectTask, 'REJECT', task, rejectionData),
    [execute]
  );

  const handleForceComplete = useCallback(
    (task) =>
      execute(forceCompleteTask, 'FORCE_COMPLETE', task),
    [execute]
  );

  const handleForceReject = useCallback(
    (task, reason) =>
      execute(forceRejectTask, 'FORCE_REJECT', task, { adminRejectionReason: reason }),
    [execute]
  );

  const handleReopen = useCallback(
    (task) =>
      execute(reopenTask, 'REOPEN', task),
    [execute]
  );

  const checkCan = useCallback(
    (task, transitionKey) =>
      canDoTransition(currentUser, task, transitionKey),
    [currentUser]
  );

  return {
    // Action handlers
    handleStart,
    handleSubmitForReview,
    handleApprove,
    handleReject,
    handleForceComplete,
    handleForceReject,
    handleReopen,

    // RBAC check
    checkCan,

    // Loading state helpers
    isLoading,
    loadingTaskId,
    loadingAction,
  };
};
