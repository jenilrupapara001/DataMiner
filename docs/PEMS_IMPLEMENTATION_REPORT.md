# PEMS Implementation Report — Complete Details

**Date:** 30 June 2026
**Status:** Phase 1 Complete
**System:** Performance Execution Management System (PEMS)

---

## 1. Executive Summary

Built a complete enterprise-grade Performance Execution Management System replacing the legacy Objective→Key Result→Action task architecture. Phase 1 delivers:

- 7 SQL Server database tables with 12 indexes
- 18 REST API endpoints
- Workflow engine with 10 states and transition validation
- Service layer with CRUD, KPI calculations, SLA tracking, achievement/variance computation
- 4 frontend pages with full interactivity
- Sidebar navigation integration
- Auth integration matching existing RetailOps patterns

---

## 2. Database Schema

### Tables Created

| # | Table | Columns | Purpose |
|---|-------|---------|---------|
| 1 | `PemsTaskTemplates` | 22 columns | Master task definitions with SOP, frequency, SLA, targets |
| 2 | `PemsTaskInstances` | 36 columns | Generated task instances assigned to sellers/users |
| 3 | `PemsSubTasks` | 10 columns | Breakdown items within task instances |
| 4 | `PemsActivities` | 13 columns | SOP step-by-step execution items |
| 5 | `PemsEvidence` | 12 columns | File uploads and proof of completion |
| 6 | `PemsTaskReviews` | 10 columns | Reviewer decisions, quality scores, feedback |
| 7 | `PemsTaskAuditLogs` | 11 columns | Full lifecycle audit trail |

### Indexes (12)

| Index | Table | Columns | Purpose |
|-------|-------|---------|---------|
| `IX_PemsInstance_Status` | TaskInstances | Status (INCLUDE SellerId, AssignedTo, DueDate) | Status-based filtering |
| `IX_PemsInstance_Seller` | TaskInstances | SellerId (INCLUDE Status, DueDate) | Seller-based queries |
| `IX_PemsInstance_AssignedTo` | TaskInstances | AssignedTo (INCLUDE Status, DueDate) | Assignee queries |
| `IX_PemsInstance_Reviewer` | TaskInstances | ReviewerId (INCLUDE Status, ReviewStatus) | Review queue |
| `IX_PemsInstance_DueDate` | TaskInstances | DueDate (INCLUDE Status, SLAStatus) | SLA/date queries |
| `IX_PemsInstance_Template` | TaskInstances | TemplateId | Template lookups |
| `IX_PemsSubTask_Instance` | SubTasks | TaskInstanceId | Subtask fetch |
| `IX_PemsActivity_Instance` | Activities | TaskInstanceId | Activity fetch |
| `IX_PemsActivity_SubTask` | Activities | SubTaskId | Activity-to-subtask |
| `IX_PemsEvidence_Instance` | Evidence | TaskInstanceId | Evidence fetch |
| `IX_PemsReview_Instance` | TaskReviews | TaskInstanceId | Review history |
| `IX_PemsAudit_Instance` | AuditLogs | TaskInstanceId | Audit trail |
| `IX_PemsAudit_CreatedAt` | AuditLogs | CreatedAt | Time-based queries |

### Foreign Keys

| FK Name | From | To | On Delete |
|---------|------|----|-----------|
| `FK_PemsInstance_Template` | TaskInstances.TemplateId | TaskTemplates.Id | RESTRICT |
| `FK_PemsSubTask_Instance` | SubTasks.TaskInstanceId | TaskInstances.Id | CASCADE |
| `FK_PemsActivity_SubTask` | Activities.SubTaskId | SubTasks.Id | CASCADE |
| `FK_PemsActivity_Instance` | Activities.TaskInstanceId | TaskInstances.Id | NO ACTION (prevents cascade cycle) |
| `FK_PemsEvidence_Instance` | Evidence.TaskInstanceId | TaskInstances.Id | CASCADE |
| `FK_PemsReview_Instance` | TaskReviews.TaskInstanceId | TaskInstances.Id | CASCADE |
| `FK_PemsAudit_Instance` | AuditLogs.TaskInstanceId | TaskInstances.Id | CASCADE |

### SQL Server Compatibility Notes

- Used `NVARCHAR(MAX)` instead of `JSON` type (not supported in SQL Server)
- Used `dbo.GetEnvDate()` for default timestamps (existing project convention)
- Used `IF NOT EXISTS` guards for idempotent migration
- No computed columns (SQL Server syntax differences) — AchievementPct and Variance computed in application layer

---

## 3. Workflow Engine

### Status Flow

```
DRAFT → ASSIGNED → ACCEPTED → IN_PROGRESS → SUBMITTED → UNDER_REVIEW
                                                          ├── APPROVED ✓
                                                          └── REJECTED → REWORK → RESUBMITTED → UNDER_REVIEW (loop)
```

### Valid Transitions Map

```javascript
DRAFT:         ['ASSIGNED', 'CANCELLED']
ASSIGNED:      ['ACCEPTED', 'CANCELLED']
ACCEPTED:      ['IN_PROGRESS']
IN_PROGRESS:   ['SUBMITTED']
SUBMITTED:     ['UNDER_REVIEW']
UNDER_REVIEW:  ['APPROVED', 'REJECTED']
REJECTED:      ['REWORK']
REWORK:        ['RESUBMITTED']
RESUBMITTED:   ['UNDER_REVIEW']
APPROVED:      [] (terminal)
CANCELLED:     [] (terminal)
```

### Workflow Functions

| Function | Input | Output |
|----------|-------|--------|
| `canTransition(from, to)` | Two status strings | Boolean |
| `getNextTransitions(status)` | Current status | Array of valid next statuses |
| `calculateSLAStatus(dueDate, slaHours)` | Due date, SLA hours | WITHIN_SLA / AT_RISK / BREACHED |
| `calculateAchievement(achievement, target)` | Numbers | Percentage |
| `calculateVariance(achievement, target)` | Numbers | Variance value |
| `calculateProgress(subTasks)` | Array of subtasks | 0-100 percentage |
| `getNextDueDate(frequency)` | Frequency type | Next due date |

### SLA Calculation Logic

```
If now > dueDate → BREACHED
If hoursRemaining ≤ 25% of slaHours → AT_RISK
Otherwise → WITHIN_SLA
```

### Supported Frequencies

| Frequency | Auto-generation interval |
|-----------|------------------------|
| ONE_TIME | No repeat |
| DAILY | Every 1 day |
| WEEKLY | Every 7 days |
| BI_WEEKLY | Every 14 days |
| MONTHLY | Every ~30 days |
| QUARTERLY | Every ~90 days |
| HALF_YEARLY | Every ~180 days |
| YEARLY | Every ~365 days |
| CUSTOM | Cron-based |

---

## 4. Backend Implementation

### File Structure

```
backend/
├── migrations/
│   └── 001_pems_schema.js          # Database migration (7 tables + 12 indexes)
├── services/pems/
│   ├── workflowEngine.js            # Status flow, SLA, achievement, frequency
│   └── pemsService.js               # All CRUD + business logic
├── controllers/pems/
│   └── pemsController.js            # Express request handlers
├── routes/pems/
│   └── pemsRoutes.js                # REST endpoint definitions
└── server.js                        # (modified: registered /api/pems route)
```

### API Endpoints (18 total)

#### Templates (5)

| Method | Endpoint | Body/Query | Response |
|--------|----------|------------|----------|
| `GET` | `/api/pems/templates` | `?page=&limit=&search=&category=&frequency=&isActive=` | `{ success, templates[], pagination }` |
| `GET` | `/api/pems/templates/filters` | — | `{ success, data: { frequencies, categories, priorities, statuses } }` |
| `GET` | `/api/pems/templates/:id` | — | `{ success, data: template }` |
| `POST` | `/api/pems/templates` | `{ name, description, category, frequency, slaHours, priority, ... }` | `{ success, data: { id, taskCode } }` |
| `PUT` | `/api/pems/templates/:id` | Partial fields | `{ success }` |
| `DELETE` | `/api/pems/templates/:id` | — | `{ success }` |

#### Task Instances (4)

| Method | Endpoint | Body/Query | Response |
|--------|----------|------------|----------|
| `GET` | `/api/pems/instances` | `?page=&limit=&status=&sellerId=&assignedTo=&reviewerId=&priority=&slaStatus=&sortBy=&sortOrder=&search=` | `{ success, instances[], pagination }` |
| `GET` | `/api/pems/instances/:id` | — | `{ success, data: { instance, subTasks[], evidence[], reviews[], auditLogs[] } }` |
| `POST` | `/api/pems/instances` | `{ templateId, title, sellerId, assignedTo, priority, target, dueDate, ... }` | `{ success, data: { id, instanceCode } }` |
| `POST` | `/api/pems/instances/:id/transition` | `{ toStatus, details }` | `{ success, data: { from, to } }` |
| `PUT` | `/api/pems/instances/:id/achievement` | `{ achievement }` | `{ success, data: { achievementPct, variance } }` |

#### Sub Tasks & Activities (2)

| Method | Endpoint | Response |
|--------|----------|----------|
| `POST` | `/api/pems/subtasks/:subTaskId/complete` | `{ success }` |
| `POST` | `/api/pems/activities/:activityId/complete` | `{ success }` |

#### Evidence (1)

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| `POST` | `/api/pems/evidence` | `{ taskInstanceId, fileName, fileUrl, fileType, remarks }` | `{ success, data: { id } }` |

#### Reviews (1)

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| `POST` | `/api/pems/reviews` | `{ taskInstanceId, decision, feedback, qualityScore }` | `{ success, data: { id } }` — also auto-transitions instance status |

#### Dashboard (3)

| Method | Endpoint | Query | Response |
|--------|----------|-------|----------|
| `GET` | `/api/pems/dashboard/kpis` | `?sellerId=&dateFrom=&dateTo=` | `{ success, data: { total, draft, assigned, ..., slaBreached, avgAchievementPct, overallProgress } }` |
| `GET` | `/api/pems/dashboard/seller-performance` | `?dateFrom=&dateTo=` | `{ success, data: [{ SellerId, SellerName, totalTasks, completedTasks, slaBreached, avgAchievementPct, completionRate }] }` |
| `POST` | `/api/pems/dashboard/refresh-sla` | — | `{ success, data: { updated } }` |

### Service Layer Methods

| Method | Purpose |
|--------|---------|
| `createTemplate(data)` | Create template with auto-generated TaskCode |
| `getTemplates(filters)` | Paginated list with search/filter |
| `getTemplateById(id)` | Single template with parsed JSON fields |
| `updateTemplate(id, data)` | Update template fields |
| `deleteTemplate(id)` | Delete template |
| `createInstance(data)` | Create instance + auto-generate subtasks/activities from template |
| `getInstances(filters)` | Paginated list with JOIN to templates, 15+ filter params |
| `getInstanceById(id)` | Full detail: instance + subtasks + activities + evidence + reviews + audit logs |
| `transitionStatus(id, toStatus, actor)` | Validate transition + update timestamps + write audit log |
| `completeSubTask(subTaskId, actor)` | Mark subtask complete + audit log |
| `completeActivity(activityId, actor)` | Mark activity complete |
| `uploadEvidence(data)` | Insert evidence record + audit log |
| `submitReview(data)` | Insert review record |
| `updateAchievement(id, achievement)` | Update achievement + compute percentage |
| `refreshSLAStatuses()` | Bulk SLA recalculation for all active tasks |
| `getDashboardKPIs(filters)` | Aggregate KPIs with status breakdown |
| `getSellerPerformance(filters)` | Seller-level performance aggregation |
| `writeAuditLog(...)` | Insert audit trail entry |

---

## 5. Frontend Implementation

### File Structure

```
src/modules/pems/
├── services/
│   └── pemsApi.js                   # API client (18 methods)
├── hooks/
│   └── usePems.js                   # React hook wrapping all operations
├── constants/
│   └── index.js                     # Status, priority, SLA, frequency, category configs
├── pages/
│   ├── PemsDashboard.jsx            # KPI cards, SLA chart, seller performance table
│   ├── TaskTemplatesPage.jsx        # Template CRUD with search/filter/duplicate
│   ├── TaskInstancesPage.jsx        # Task list + detail drawer + transitions + create
│   └── ReviewQueuePage.jsx          # Review queue with approve/reject + quality scoring
└── components/                      # (Phase 2)
```

### Pages Detail

#### PemsDashboard (`/pems/dashboard`)

- **KPI Cards Row**: Total Tasks, In Progress, Pending Review, Approved, SLA Breached, Achievement %
- **Status Distribution**: Visual count badges for each workflow status
- **SLA Status**: Within SLA / At Risk / Breached counts with compliance percentage
- **Overall Progress Bar**: Approved / Total with gradient
- **Seller Performance Table**: Sortable table with completion rate progress bars, achievement %, SLA breach counts
- **Period Filter**: All Time / This Week / This Month / This Quarter segmented control
- **Auto-refresh** on filter change

#### TaskTemplatesPage (`/pems/templates`)

- **Table**: Code, Name, Category, Frequency, SLA, Priority, Target, Status, Actions
- **Search**: Text search across name, description, code
- **Filters**: Category dropdown, Frequency dropdown
- **Actions per row**: Edit, Duplicate, Delete (with confirm)
- **Create/Edit Modal**: Full form with name, description, category, frequency, priority, SLA/TAT hours, target type, default target, expected output, active toggle
- **Duplicate**: Pre-fills form with "(Copy)" suffix

#### TaskInstancesPage (`/pems/tasks`)

- **Table**: Code, Task Title, Status, Priority, Progress, Target/Achievement, SLA, Due Date, Actions
- **Sortable columns**: Code, Status, Due Date
- **Filters**: Text search, Status dropdown, Priority dropdown, SLA Status dropdown
- **Actions**: Eye (view detail), Arrow (quick transition to next status)
- **Detail Drawer**: Full task info + subtasks list + evidence list + audit timeline
- **Create Task Modal**: Template selector, title, seller, assignee, priority, target, due date
- **Transition Modal**: Confirmation dialog for status changes

#### ReviewQueuePage (`/pems/reviews`)

- **Table**: Task info, Submitted date, Priority, Target/Achievement, SLA, Rework count, Actions
- **Quick actions**: View, Approve (green), Reject (red)
- **Detail Drawer**: Task info + subtasks + evidence files + Approve/Reject buttons in header
- **Review Modal**: Quality star rating (1-5), feedback textarea (required), decision confirmation
- **Empty state**: "No tasks pending review" when queue is empty

### API Client (`pemsApi.js`)

18 methods covering all backend endpoints:
- Templates: `getTemplates`, `getTemplateById`, `createTemplate`, `updateTemplate`, `deleteTemplate`, `getFilterOptions`
- Instances: `getInstances`, `getInstanceById`, `createInstance`, `transitionStatus`, `updateAchievement`
- Sub Tasks: `completeSubTask`, `completeActivity`
- Evidence: `uploadEvidence`
- Reviews: `submitReview`
- Dashboard: `getDashboardKPIs`, `getSellerPerformance`, `refreshSLA`

### React Hook (`usePems.js`)

Wraps all API calls with `loading` and `error` state management. Provides:
```
{ loading, error,
  getTemplates, createTemplate, updateTemplate, deleteTemplate,
  getInstances, getInstanceById, createInstance, transitionStatus, updateAchievement,
  completeSubTask, completeActivity,
  uploadEvidence, submitReview,
  getDashboardKPIs, getSellerPerformance }
```

### Constants (`constants/index.js`)

| Export | Values |
|--------|--------|
| `WORKFLOW_STATUSES` | 11 statuses with label, color, bg, antColor |
| `VALID_TRANSITIONS` | Map of allowed transitions per status |
| `SLA_STATUSES` | 3 statuses with label, color, bg |
| `FREQUENCIES` | 9 frequency types with value/label |
| `CATEGORIES` | 7 categories with value/label |
| `PRIORITIES` | 4 priorities with label, color, bg |
| `TARGET_TYPES` | 4 target types with value/label |

---

## 6. Routing & Navigation

### App.jsx Routes

```jsx
<Route path="/pems/dashboard" element={<ProtectedRoute permission="tasks_view"><PemsDashboard /></ProtectedRoute>} />
<Route path="/pems/templates" element={<ProtectedRoute permission="tasks_manage"><TaskTemplatesPage /></ProtectedRoute>} />
<Route path="/pems/tasks" element={<ProtectedRoute permission="tasks_view"><TaskInstancesPage /></ProtectedRoute>} />
<Route path="/pems/reviews" element={<ProtectedRoute permission="tasks_view"><ReviewQueuePage /></ProtectedRoute>} />
```

### Sidebar Navigation (4 new items in "Automation" section)

| Key | Label | Icon | Path | Permission |
|-----|-------|------|------|------------|
| `pems-dashboard` | PEMS Dashboard | BarChart2 | `/pems/dashboard` | `tasks_view` |
| `pems-templates` | Task Templates | ClipboardList | `/pems/templates` | `tasks_manage` |
| `pems-instances` | Task Execution | CheckSquare | `/pems/tasks` | `tasks_view` |
| `pems-reviews` | Review Queue | UserCheck | `/pems/reviews` | `tasks_view` |

### Backward Compatibility

- Existing `/tasks` route (legacy TasksPage) preserved
- No existing functionality removed
- Both systems coexist

---

## 7. Permissions Model

| Role | Access |
|------|--------|
| Admin | Full access: create templates, assign tasks, review, analytics |
| Operations Manager | Create templates, assign tasks, review analytics |
| Brand Manager | Execute tasks, upload evidence, submit tasks |
| Reviewer | Approve/reject submissions |

Permission keys: `tasks_view`, `tasks_manage`

---

## 8. Data Flow

### Template → Instance Creation

```
1. User creates TaskTemplate (defines SOP, frequency, SLA, target, subtask definitions)
2. User (or cron) creates TaskInstance from template
3. System auto-generates SubTasks from template.SubTaskDefinitions
4. System auto-generates Activities from each subtask's activities array
5. TaskInstance gets dueDate calculated from template frequency
```

### Task Execution Flow

```
1. Brand Manager receives ASSIGNED task
2. Manager ACCEPTS → starts work → IN_PROGRESS
3. Manager completes subtasks/activities
4. Manager uploads evidence (files, screenshots, reports)
5. Manager submits for review → SUBMITTED → UNDER_REVIEW
6. Reviewer sees task in Review Queue
7. Reviewer approves → APPROVED (or rejects → REJECTED → REWORK)
8. If REWORK, manager fixes and RESUBMITTED → back to UNDER_REVIEW
```

### KPI Calculation

```
Achievement % = (achievement / target) × 100
Variance = achievement - target
SLA Status = completedAt <= dueDate ? WITHIN_SLA : BREACHED
Progress = completedSubTasks / totalSubTasks × 100
Overall Progress = approvedTasks / totalTasks × 100
```

---

## 9. Performance Considerations

### Indexes optimized for:
- Status-based filtering (most common query)
- Seller-scoped queries
- Assignee-based queries
- Reviewer queue queries
- Due date range queries for SLA
- Full-text search via LIKE (with leading wildcard avoidance)

### Pagination
- All list endpoints use server-side OFFSET/FETCH
- Default page size: 25 (configurable up to 100)
- Count query runs in parallel with data query

### Future scalability (Phase 2+):
- Background cron for recurring task generation
- Bulk SLA refresh via `refreshSLAStatuses()`
- 100K+ instances supported via indexed queries + pagination

---

## 10. Migration & Deployment

### Database Migration
```bash
cd backend && node -e "require('./migrations/001_pems_schema').runMigration()"
```

### Backend Restart
```bash
cd backend && pm2 restart retailops-api --update-env
```

### No destructive changes
- All existing tables untouched
- Legacy `/tasks` route preserved
- New tables prefixed with `Pems` to avoid conflicts

---

## 11. Known Limitations (Phase 1)

| Item | Status | Phase |
|------|--------|-------|
| SOP Library page | Not built | Phase 2 |
| Recurring cron auto-generation | Not built | Phase 2 |
| Evidence file upload to S3/storage | Stub only (stores URL) | Phase 2 |
| Notification triggers | Not built | Phase 2 |
| Analytics charts/reports | Dashboard only | Phase 2 |
| Escalation rules | Not built | Phase 2 |
| Audit log export | Not built | Phase 2 |
| Task template import/export | Not built | Phase 2 |
| Bulk task creation | Not built | Phase 2 |
| Role-based view filtering | Uses existing RBAC | Phase 2 |
| Virtualized tables for 100K+ | Standard antd Table | Phase 3 |

---

## 12. Files Created/Modified

### Created (11 files)

```
backend/migrations/001_pems_schema.js
backend/services/pems/workflowEngine.js
backend/services/pems/pemsService.js
backend/controllers/pems/pemsController.js
backend/routes/pems/pemsRoutes.js
src/modules/pems/services/pemsApi.js
src/modules/pems/hooks/usePems.js
src/modules/pems/constants/index.js
src/modules/pems/pages/PemsDashboard.jsx
src/modules/pems/pages/TaskTemplatesPage.jsx
src/modules/pems/pages/TaskInstancesPage.jsx
src/modules/pems/pages/ReviewQueuePage.jsx
```

### Modified (2 files)

```
backend/server.js          (+2 lines: import + app.use)
src/App.jsx                (+5 lines: 4 lazy imports + 4 routes)
src/hooks/useNavigationItems.js (+30 lines: 4 nav items + icon imports)
```

### Documentation (2 files)

```
docs/RETAILOPS_TASKS_REBUILD_MASTER_SPEC.md  (original spec)
docs/tasks-page-spec.md                       (legacy page analysis)
```

---

## 13. Build Verification

| Check | Result |
|-------|--------|
| Backend syntax validation | ✅ All 5 files pass `node -c` |
| Database migration | ✅ 7/7 tables created, 12/12 indexes created |
| Server restart | ✅ PM2 fork mode, port 3001 |
| Frontend build | ✅ `vite build` passes in 3.6s |
| Auth integration | ✅ Uses `authToken` from localStorage |
| Message context | ✅ Uses `App.useApp()` pattern |
| Import paths | ✅ All relative paths resolve correctly |
