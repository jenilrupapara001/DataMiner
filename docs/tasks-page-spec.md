# TasksPage.jsx — Complete Architecture & Rebuild Specification

## 1. Overview

**File:** `src/pages/TasksPage.jsx` (1,929 lines)
**Purpose:** Central task management page for RetailOps — displays optimization tasks organized by objectives, sellers, and workflows. Supports CRUD, workflow transitions (start → submit → review → approve/reject), filtering, search, and auto-generation.

---

## 2. Data Model

### 2.1 Task (Action) Object
```
{
  _id / id: string,
  title / action / name: string,        // Task name (triple fallback)
  description: string,
  status: 'TODO' | 'PENDING' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED' | 'REJECTED',
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
  type / category / actionType: string,  // e.g. 'LISTING_QUALITY', 'PRICING', 'GENERAL_OPTIMIZATION'
  asins: string[],                       // ASIN codes associated
  asinCount: number,
  sellerId / SellerId: string | object,  // Linked seller
  assignedTo: user | user[],             // Assigned user(s)
  parentTaskId / parentId: string,       // Subtask parent
  GoalId / ObjectiveId / KeyResultId / keyResultId: string,  // Objective linkage
  DueDate: string,                       // Deadline (ISO)
  createdAt: string,
  timeTracking: {
    startedAt: string,
    completedAt: string,
    deadline: string,
  },
  rejections: Array<{ reason: string, date: string, reviewer: string }>,
  subtasks: Task[],                      // Populated at runtime via buildSellerHierarchy
  krTitle: string,                       // Key Result title (runtime)
  objectiveTitle: string,                // Objective title (runtime)
}
```

### 2.2 Objective Object
```
{
  _id / id: string,
  title: string,
  sellerId / SellerId / brandId: string | object,
  isStandalone: boolean,
  keyResults: Array<{
    title: string,
    actions: Task[],
  }>,
}
```

### 2.3 Seller
```
{ _id: string, name: string, sellerName: string, marketplace: string }
```

### 2.4 User
```
{ _id: string, firstName: string, lastName: string, name: string, email: string, role: { name: string } | string }
```

---

## 3. Dependencies

### 3.1 Child Components (imported)
| Component | Path | Purpose |
|-----------|------|---------|
| `ActionModal` | `components/actions/ActionModal.jsx` | Create/edit task form |
| `ObjectiveManager` | `components/actions/ObjectiveManager.jsx` | Create/edit objectives with key results |
| `StartTaskModal` | `components/actions/StartTaskModal.jsx` | Start task form (sets startedAt) |
| `SubmitTaskModal` | `components/actions/SubmitTaskModal.jsx` | Submit for review form |
| `ReviewDecisionModal` | `components/actions/ReviewDecisionModal.jsx` | Approve/reject with feedback |
| `TaskDetailDrawer` | `components/actions/TaskDetailDrawer.jsx` | Slide-out task detail view |
| `WorkflowActionButton` | `components/actions/WorkflowActionButton.jsx` | Status-aware action button per task |
| `RejectedTaskBanner` | `components/actions/RejectedTaskBanner.jsx` | Shows rejection history in expanded row |

### 3.2 Hooks
| Hook | Source | Purpose |
|------|--------|---------|
| `useWorkflow` | `hooks/useWorkflow.jsx` | Provides `handleStart`, `handleSubmitForReview`, `handleApprove`, `handleReject`, `handleForceComplete`, `handleReopen` |
| `useAuth` | `contexts/AuthContext.jsx` | `currentUser`, `isAdmin` |
| `usePageTitle` | `contexts/PageTitleContext.jsx` | Sets page title |
| `useNavigate`, `useSearchParams` | `react-router-dom` | URL-based filter/search state |

### 3.3 Services
| Service | Methods Used |
|---------|-------------|
| `db` (from `services/db.js`) | `getObjectives()`, `getActions()`, `getUsers()`, `getSellers()`, `getAsins()`, `createAction()`, `updateAction()`, `deleteAction()`, `deleteObjective()`, `generateBulkActions()`, `deleteAllObjectives()` |
| `workflowEngine` | `getDisplayStatus()`, `hasEverBeenStarted()` |

### 3.4 External Libraries
- **antd**: `Card, Table, Tag, Badge, Button, Input, Select, Space, Tooltip, Dropdown, Modal, Empty, Typography, Row, Col, Avatar, Progress, Divider, Collapse, Layout, Segmented, Spin, message`
- **@ant-design/icons**: 25+ icons
- **lucide-react**: `Zap` only
- **dayjs** + `relativeTime` plugin

---

## 4. State Architecture

### 4.1 Data State
| State | Type | Source | Purpose |
|-------|------|--------|---------|
| `objectives` | `Objective[]` | `db.getObjectives()` | All objectives with nested key results |
| `allActions` | `Task[]` | Computed from objectives + direct actions | Flat list of all tasks (union of objective tasks + standalone) |
| `sellers` | `Seller[]` | `db.getSellers()` | Seller list for hierarchy display |
| `users` | `User[]` | `db.getUsers()` | User list for assignment display |
| `asins` | `ASIN[]` | `db.getAsins()` | ASIN list for ActionModal |
| `loading` | `boolean` | — | Page loading state |

### 4.2 UI State
| State | Type | Default | Purpose |
|-------|------|---------|---------|
| `viewMode` | `'ALL_TASKS' \| 'BY_SELLER'` | `'ALL_TASKS'` | Toggle between flat table and seller-grouped view |
| `activeFilter` | `string` | URL `?filter=` or `'ALL'` | Filter pill selection |
| `searchQuery` | `string` | URL `?q=` or `''` | Text search |
| `statusFilter` | `string \| null` | `null` | Status dropdown filter |
| `priorityFilter` | `string \| null` | `null` | Priority dropdown filter |

### 4.3 Modal State
| State | Type | Controls |
|-------|------|----------|
| `startingTask` | `Task \| null` | Task being started |
| `submittingTask` | `Task \| null` | Task being submitted |
| `reviewingTask` | `Task \| null` | Task being reviewed |
| `viewingTask` | `Task \| null` | Task detail drawer |
| `editingAction` | `Task \| null` | Action being edited (null = create new) |
| `editingObjective` | `Objective \| null` | Objective being edited |
| `completingAction` | `Task \| null` | *(declared but unused)* |
| `selectedKeyResultId` | `string \| null` | Key Result to attach new task to |
| `expandedRowKeys` | `string[]` | *(declared but unused — antd manages internally)* |
| `rejectionForms` | `Record<taskId, { open: boolean }>` | Inline rejection form state per task |

### 4.4 Auto-Generate State
| State | Type | Purpose |
|-------|------|---------|
| `isAutoGenModalOpen` | `boolean` | Auto-generate modal visibility |
| `autoGenerating` | `boolean` | Loading state for generation |

---

## 5. Data Loading Flow

```
loadData() → Promise.allSettled([
  db.getObjectives(),
  db.getActions(),
  db.getUsers(),
  db.getSellers(),
  db.getAsins()
])
  ↓
computeAllActions(objectives, directActions) → flat combined list → setAllActions
  ↓
calculateKPIs(combined) → setKpis (todo, overdue, tomorrow, upcoming, status counts)
```

**Critical:** `computeAllActions` deduplicates — tasks inside objective.keyResults.actions are merged with direct actions from `db.getActions()`. IDs are checked to prevent doubles.

**Reload trigger:** Every workflow action (`handleStart`, `handleSubmit`, `handleApprove`, `handleReject`) calls `loadData` via `onSuccess: loadData`.

---

## 6. Computed Data

### 6.1 `sellerGroups` (memoized)
Built by `buildSellerHierarchy(objectives, allActions, sellers)`:
- Groups tasks under their seller
- Nested: Seller → Objective → KeyResult → Actions → Subtasks
- Standalone tasks (not linked to any objective) go into `directTasks`
- Returns sorted by `sellerName.localeCompare`

### 6.2 `filteredActions` (memoized)
Filters `allActions` by:
1. `statusFilter` — exact status match
2. `priorityFilter` — exact priority match
3. `activeFilter` — via `matchesFilter()` (see §7.1)
4. `searchQuery` — via `matchesSearch()` (see §7.2)

### 6.3 `kpis` (computed on load)
- `all` — total tasks
- `todo` — non-completed tasks
- `overdue` — deadline < now AND not completed
- `tomorrow` — deadline is tomorrow
- `upcoming` — deadline >= day after tomorrow
- `status.pending` / `inProgress` / `review` / `completed` / `rejected`

### 6.4 `reviewCount`
Count of tasks with `status === 'REVIEW'`.

---

## 7. Filter Logic

### 7.1 `matchesFilter(action, filter)`
| Filter | Logic |
|--------|-------|
| `ALL` | Always true |
| `TODO` | status ≠ COMPLETED AND ≠ REJECTED |
| `OVERDUE` | deadline < now AND status ≠ COMPLETED |
| `TOMORROW` | deadline falls within tomorrow |
| `UPCOMING` | deadline >= day after tomorrow |
| `PENDING` | status === PENDING |
| `IN_PROGRESS` | status === IN_PROGRESS |
| `REVIEW` | status === REVIEW |
| `REJECTED` | status === REJECTED |
| `COMPLETED` | status === COMPLETED |

### 7.2 `matchesSearch(action, query)`
Searches across: `action.title`, `description` (case-insensitive substring match).

### 7.3 URL Sync
- `activeFilter` syncs to `?filter=` param
- `searchQuery` syncs to `?q=` param
- Read from URL on initial load

---

## 8. Workflow Engine Integration

### 8.1 Status Flow
```
TODO/PENDING → [Start] → IN_PROGRESS → [Submit] → REVIEW → [Approve] → COMPLETED
                                                         → [Reject] → REJECTED → [Reopen] → IN_PROGRESS
```

### 8.2 `useWorkflow` Hook
Returns: `{ handleStart, handleSubmitForReview, handleApprove, handleReject, handleForceComplete, handleReopen, isLoading, loadingTaskId }`

Each handler takes a task object + data payload. All call `onSuccess: loadData` on completion.

### 8.3 `WorkflowActionButton`
Renders different buttons based on task status:
- PENDING → "Start" button
- IN_PROGRESS → "Submit for Review" button
- REVIEW → "Approve" / "Reject" buttons
- COMPLETED → "Completed" badge
- REJECTED → "Reopen" button

---

## 9. View Modes

### 9.1 ALL_TASKS View
- Flat `<Table>` with pagination (20/page, configurable)
- Columns: #, Task Name, Category, Progress, Assigned, Priority, Status/Review, Timeline, Actions
- Expandable rows for subtasks + rejection forms
- Uses `filteredActions` as data source

### 9.2 BY_SELLER View
- Seller-grouped cards, each with:
  - Seller avatar, name, task counts, progress bar
  - Nested `<Collapse>` with objective groups
  - Each objective: OBJ tag, title, progress, expandable task table
  - "Direct Tasks" section for standalone tasks
- Uses `sellerGroups` → filter each group → render

---

## 10. Table Columns (shared between views)

| Column | Width | Data | Notes |
|--------|-------|------|-------|
| `#` | 48 | Row index | — |
| `Task Name` | 280 | `title/action/name` + ASIN count tag | — |
| `Category` | 120 | `type/category/actionType` | Plain tag |
| `Progress` | 100 | Status-based: 0/50/100% | `ProgressCell` component |
| `Assigned` | 130 | `assignedTo` user(s) | `UserChip` component, max 2 shown |
| `Priority` | 100 | `priority` | `PriorityTag` component |
| `Status / Review` | 200 | `WorkflowActionButton` | Context-aware action buttons |
| `Timeline` | 160 | created/started/completed timestamps | `TimelineCell` component with tooltip |
| Actions | 60 | Dropdown menu | View, Start, Submit, Review, Edit, Delete |

---

## 11. Sub-Components (defined inline)

### `StatusTag({ status, size })`
Rounded tag with icon, color from `STATUS_META`. Used in seller view subtask rows.

### `PriorityTag({ priority })`
Rounded tag with icon, color from `PRIORITY_META`.

### `UserChip({ user })`
Avatar + first name. Role-based color. Tooltip shows full name + role.

### `TimelineCell({ createdAt, startedAt, completedAt, status })`
Shows last 2 timeline events (created/started/done) with relative timestamps. Duration tag if started. Full timeline in tooltip.

### `ProgressCell({ pct })`
Progress bar + percentage text. Color based on `getProgressColor()`.

### `RejectionForm({ onSubmit, onCancel })`
Inline card with TextArea for rejection reason + submit/cancel buttons. Conditionally rendered inside expanded rows.

---

## 12. KPI Strip

5 cards in a row:
1. **Total Tasks** — `kpis.all` — Blue
2. **In Progress** — `kpis.status.inProgress` — Blue (spinning icon)
3. **Pending Review** — `kpis.status.review` — Purple
4. **Overdue** — `kpis.overdue` — Red
5. **Completed** — `kpis.status.completed` — Green

Below: **Overall Progress Bar** — `completed/total` percentage.

---

## 13. Filter Pills

Horizontal row of clickable pills:
- All, To Do, Overdue, Tomorrow, Upcoming | Pending, In Progress, Review, Rejected, Completed
- Each shows count badge
- Active pill highlighted with colored border + background
- "Clear" button when any filter is active

---

## 14. Modals

| Modal | Trigger | Component |
|-------|---------|-----------|
| Objective Manager | "New Project" button or edit | `ObjectiveManager` (full-width) |
| Action Modal | "Quick Task" / "New Task" / edit | `ActionModal` |
| Start Task Modal | "Start Task" action | `StartTaskModal` |
| Submit Task Modal | "Submit for Review" action | `SubmitTaskModal` |
| Review Decision Modal | "Review Submission" action | `ReviewDecisionModal` |
| Task Detail Drawer | "View Details" action | `TaskDetailDrawer` (Drawer, not Modal) |
| Auto-Generate Modal | "Auto-Generate" button | Custom modal (inline JSX) |

---

## 15. Workflow Action Menu (per task)

Dropdown items based on current status:
1. **View Details** — always shown
2. **Start Task** — if PENDING and never started
3. **Submit for Review** — if IN_PROGRESS
4. **Review Submission** — if REVIEW
5. **Edit Task** — always shown
6. **Delete** — always shown (danger)

---

## 16. Design System

### Colors (Status)
- TODO: `#64748b` / `#f1f5f9`
- PENDING: `#E65100` / `#fef3c7`
- IN_PROGRESS: `#1976D2` / `#eef2ff`
- REVIEW: `#9C27B0` / `#f5f3ff`
- COMPLETED: `#2E7D32` / `#ecfdf5`
- REJECTED: `#e11d48` / `#fff1f2`
- OVERDUE: `#C62828` / `#fef2f2`

### Colors (Priority)
- CRITICAL: `#b91c1c` / `#fee2e2`
- HIGH: `#c2410c` / `#ffedd5`
- MEDIUM: `#b45309` / `#fef3c7`
- LOW: `#475569` / `#f1f5f9`

### Seller Palette
`['#1976D2', '#9C27B0', '#9C27B0', '#f43f5e', '#ED6C02', '#eab308', '#22c55e', '#14b8a6', '#0288D1', '#0288D1']`
Color chosen by name hash modulo palette length.

### Typography
- Table headers: 11px, uppercase, `#94a3b8`, weight 700
- Body text: 12-13px, `#1e293b` or `#334155`
- Tags: 10-11px, rounded pills

### Spacing
- Page padding: `16px 24px 0`
- Card border-radius: 10-12px
- Table cell padding: `10px 12px`

---

## 17. CRUD Operations

| Operation | Service Call | After |
|-----------|-------------|-------|
| Create Task | `db.createAction(data)` | `loadData()` |
| Edit Task | `db.updateAction(id, data)` | `loadData()` |
| Delete Task | `db.deleteAction(id)` | `loadData()` |
| Create Objective | `ObjectiveManager` → internal | `loadData()` via callback |
| Delete Objective | `db.deleteObjective(id)` | `loadData()` |
| Auto-Generate | `db.generateBulkActions()` | `loadData()` |
| Delete All | `db.deleteAllObjectives()` | `loadData()` (admin only) |

---

## 18. URL Parameters

| Param | Type | Default | Purpose |
|-------|------|---------|---------|
| `?filter=` | string | `'ALL'` | Active filter pill |
| `?q=` | string | `''` | Search query |

---

## 19. Known Issues & Tech Debt

1. **Unused state**: `completingAction`, `expandedRowKeys` declared but never meaningfully used
2. **1,929 lines in single file**: All sub-components, helpers, KPI logic, and two full view modes in one component
3. **No pagination in seller view**: Each seller's task table uses `pagination={false}`
4. **`allActions` computed via side effect** inside `computeAllActions` — sets state during computation, not pure
5. **`eslint-disable-next-line`** on `loadData` useEffect — deps intentionally omitted
6. **Duplicate filter logic**: `matchesFilter` + `matchesSearch` applied in both `filteredActions` memo AND manually in `renderSellerView` per group
7. **No error boundaries**: `try/catch` with silent console.error only
8. **Admin delete-all** uses `db.deleteAllObjectives()` — doesn't delete standalone actions
9. **Progress is fake**: 0/50/100 based on status enum, not actual subtask completion percentage
10. **`SELLER_PALETTE` has duplicate colors** at indices 2 and 8

---

## 20. Rebuild Recommendations

### Architecture
- Split into: `TasksPage` (shell), `AllTasksView`, `SellerTasksView`, `TaskKpiStrip`, `TaskFilterBar`
- Extract `useTaskData` hook for all data loading/computation
- Move `buildSellerHierarchy` to a utility file
- Move `STATUS_META`, `PRIORITY_META`, `matchesFilter`, `matchesSearch` to constants/utilities

### Improvements
- Real progress calculation from subtask completion ratios
- Server-side pagination + filtering for large datasets
- Loading skeletons instead of spinner
- Optimistic updates for workflow transitions
- Drag-and-drop Kanban view (unused components exist: `TaskBoard.jsx`, `BrandTaskCard.jsx`)
- Tag/task-type filtering (tags exist in data model but aren't filterable)
