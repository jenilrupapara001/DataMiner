export const ACTIONS_BY_TYPE = {
  ASIN: [
    { value: 'create_task', label: 'Create Task', hasValue: false, group: 'Tasks', icon: 'CheckSquare', description: 'Auto-create an actionable task for this ASIN' },
    { value: 'create_task_high', label: 'Create Urgent Task', hasValue: false, group: 'Tasks', icon: 'AlertTriangle', description: 'Create a high-priority urgent task' },

    { value: 'send_notification', label: 'Send Notification', hasValue: false, group: 'Alerts', icon: 'Bell', description: 'In-app notification to team members' },
    { value: 'send_email', label: 'Send Email Alert', hasValue: false, group: 'Alerts', icon: 'Mail', description: 'Email alert to configured recipients' },

    { value: 'add_tag', label: 'Add Tag', hasValue: true, unit: 'tag name', group: 'Labels', icon: 'Tag', description: 'Add a descriptive tag to the ASIN' },
    { value: 'remove_tag', label: 'Remove Tag', hasValue: true, unit: 'tag name', group: 'Labels', icon: 'TagOff', description: 'Remove a specific tag from the ASIN' },

    { value: 'flag_review', label: 'Flag for Review', hasValue: false, group: 'Listing', icon: 'Eye', description: 'Mark ASIN for manual review by team' },
  ],
};

export const TASK_PRIORITIES = [
  { value: 'High', label: 'High', color: '#C62828' },
  { value: 'Medium', label: 'Medium', color: '#ED6C02' },
  { value: 'Low', label: 'Low', color: '#6b7280' },
];

export const TASK_DEADLINES = [
  { value: '1 day', label: 'Tomorrow' },
  { value: '3 days', label: 'In 3 days' },
  { value: '7 days', label: 'In 1 week' },
  { value: '14 days', label: 'In 2 weeks' },
  { value: '30 days', label: 'In 1 month' },
];

export default {
  ACTIONS_BY_TYPE,
  TASK_PRIORITIES,
  TASK_DEADLINES
};
