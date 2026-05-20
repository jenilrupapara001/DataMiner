export function getAchievementTier(pct) {
    if (pct >= 100) return { label: 'Elite (100%+)', color: '#059669', bg: '#d1fae5' };
    if (pct >= 80)  return { label: 'High (80%+)',   color: '#2563eb', bg: '#dbeafe' };
    if (pct >= 50)  return { label: 'Track (50%+)',  color: '#d97706', bg: '#fef3c7' };
    return { label: 'Low (<50%)', color: '#ef4444', bg: '#fee2e2' };
}
