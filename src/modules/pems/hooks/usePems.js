import { useState, useCallback } from 'react';
import pemsApi from '../services/pemsApi';

export function usePems() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const wrap = useCallback(async (fn) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      setLoading(false);
      return result;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, []);

  // Templates
  const getTemplates = useCallback((params) => wrap(() => pemsApi.getTemplates(params)), [wrap]);
  const createTemplate = useCallback((data) => wrap(() => pemsApi.createTemplate(data)), [wrap]);
  const updateTemplate = useCallback((id, data) => wrap(() => pemsApi.updateTemplate(id, data)), [wrap]);
  const deleteTemplate = useCallback((id) => wrap(() => pemsApi.deleteTemplate(id)), [wrap]);

  // Instances
  const getInstances = useCallback((params) => wrap(() => pemsApi.getInstances(params)), [wrap]);
  const getInstanceById = useCallback((id) => wrap(() => pemsApi.getInstanceById(id)), [wrap]);
  const createInstance = useCallback((data) => wrap(() => pemsApi.createInstance(data)), [wrap]);
  const transitionStatus = useCallback((id, toStatus, details) => wrap(() => pemsApi.transitionStatus(id, toStatus, details)), [wrap]);
  const updateAchievement = useCallback((id, achievement) => wrap(() => pemsApi.updateAchievement(id, achievement)), [wrap]);

  // Sub Tasks & Activities
  const completeSubTask = useCallback((id) => wrap(() => pemsApi.completeSubTask(id)), [wrap]);
  const completeActivity = useCallback((id) => wrap(() => pemsApi.completeActivity(id)), [wrap]);

  // Evidence & Reviews
  const uploadEvidence = useCallback((data) => wrap(() => pemsApi.uploadEvidence(data)), [wrap]);
  const submitReview = useCallback((data) => wrap(() => pemsApi.submitReview(data)), [wrap]);

  // Dashboard
  const getDashboardKPIs = useCallback((params) => wrap(() => pemsApi.getDashboardKPIs(params)), [wrap]);
  const getSellerPerformance = useCallback((params) => wrap(() => pemsApi.getSellerPerformance(params)), [wrap]);

  return {
    loading, error,
    getTemplates, createTemplate, updateTemplate, deleteTemplate,
    getInstances, getInstanceById, createInstance, transitionStatus, updateAchievement,
    completeSubTask, completeActivity,
    uploadEvidence, submitReview,
    getDashboardKPIs, getSellerPerformance,
  };
}
