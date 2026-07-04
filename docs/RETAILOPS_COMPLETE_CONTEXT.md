# RetailOps Complete System Context
## For ChatGPT / AI Assistant Reference

---

## 1. System Overview

**RetailOps** is a comprehensive retail operations management platform for Amazon aggregators managing multiple brands/sellers across Amazon.in, Ajio, and Myntra.

### Tech Stack
| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 + Vite 8, Ant Design, ApexCharts, Socket.io |
| **Mobile** | React Native + Expo SDK 54, TypeScript, Expo Router |
| **Backend** | Express 5, Node.js, SQL Server, Socket.io |
| **Auth** | JWT + OTP (Gmail SMTP), Redis blacklist |
| **Scraping** | Octoparse (cloud), Amazon Creators API (live), Keepa |
| **AI** | OpenAI, Perplexity, NVIDIA NIM |
| **Chat** | CometChat integration |
| **Deploy** | PM2 (fork mode), VPS: 31.97.62.95, Port 3001 |

### Repository Structure
```
retail-ops/
├── backend/          # Express API (port 3001)
│   ├── controllers/  # Route handlers
│   ├── services/     # Business logic
│   ├── routes/       # Express routes
│   ├── database/     # SQL Server connection
│   ├── middleware/    # Auth, RBAC
│   └── migrations/    # DB schema migrations
├── src/              # React frontend
│   ├── pages/        # Route pages
│   ├── components/   # Reusable components
│   ├── services/     # API client, auth, etc.
│   ├── contexts/     # React contexts
│   ├── hooks/        # Custom hooks
│   └── modules/pems/ # PEMS module (new)
├── mobile/           # React Native app
│   ├── app/          # Expo Router pages
│   ├── services/     # API client
│   └── components/   # UI components
└── docs/             # Documentation
```

---

## 2. Core Modules

### 2.1 ASIN Manager
- 173K+ ASINs across all sellers
- Server-side pagination + filtering
- Live sync (Amazon Creators API), Octoparse scraping, Keepa
- Tags, LQS, BSR, pricing, BuyBox, deals, A+ content
- Dynamic seller/user fetching from DB
- Bulk operations, CSV import, AI listing analysis

### 2.2 GMS Tracker
- Daily performance matrix (Ordered Revenue, Shipped, Returns)
- ASIN-level and seller-level views
- Collapsible month/week/day columns
- 3-series area chart (Revenue + Orders + Returns)
- Export to XLSX/CSV with data granularity (Daily/Weekly/Monthly)
- Brand/seller filtering in export

### 2.3 PEMS (Performance Execution Management System)
- **Location**: `src/modules/pems/`
- **10 DB tables**: Templates, Instances, SubTasks, Activities, Evidence, Reviews, AuditLogs, Notifications, AssignmentRules, Scorecards
- **33+ API endpoints**
- **10-state workflow**: DRAFT → ASSIGNED → ACCEPTED → IN_PROGRESS → SUBMITTED → UNDER_REVIEW → APPROVED/REJECTED → REWORK → RESUBMITTED
- **13 permissions**, **8 roles** (RBAC)
- Email notifications on task events
- Dynamic dispute calculation
- Calendar view, export, notifications

### 2.4 Live Sync Tracker
- `/live-sync-tracker` — shows which brands completed sync
- 241 active sellers, 130K live-synced ASINs

### 2.5 Dashboard
- Operations Command Center with KPIs, pipeline, departments, top performers, risk panel
- 3 consolidated API endpoints (not 10+)

### 2.6 Targets & Achievements
- Seller/brand/department targets
- Achievement tracking with variance calculation
- Import/export achievements

### 2.7 Chat System
- CometChat integration
- Seller-scoped conversations
- File upload, polls, pinning, forwarding

### 2.8 Alerts & Rules
- Automated alert rules
- Ruleset execution engine
- Email + in-app notifications

---

## 3. Database (SQL Server)

### Key Tables
| Table | Rows | Purpose |
|-------|------|---------|
| Asins | 200K+ | ASIN data with BSR, pricing, tags, BuyBox |
| Sellers | 241 | Brand/seller master |
| Users | 24 | User accounts with roles |
| UserSellers | 257 | User-seller assignments |
| GmsDailyPerformance | 469K | Daily GMS metrics |
| PemsTaskTemplates | 9+ | Task template definitions |
| PemsTaskInstances | 24+ | Task instances with workflow |
| PemsSubTasks | 18+ | Subtask breakdown |
| PemsActivities | 46+ | SOP activity steps |
| PemsTaskAuditLogs | 0+ | Audit trail |
| Notifications | 15K+ | Notification records |
| Rulesets | — | Automation rules |
| Objectives | — | OKR objectives |

### SQL Server Notes
- No `JSON` type → use `NVARCHAR(MAX)`
- Bit columns (PriceDispute, Ads, HasAplus) are BIT, not string
- `RowCount` is reserved keyword → use `[RowCount]`
- Sellers table uses `IsActive` not `Status`
- `dbo.GetEnvDate()` for default timestamps

---

## 4. Authentication & Security

### Auth Flow
- OTP-based login (no password-only)
- JWT tokens stored in `localStorage.authToken`
- Redis token blacklist with TTL
- Trusted device support
- Password policy: zxcvbn, 12-char min, complexity

### RBAC
- Roles: super_admin, admin, operational_manager, brand_manager, reviewer, developer
- Permissions: `asinmanager_view`, `tasks_view`, `tasks_manage`, `marketplace_amazon`, etc.
- Seller-scoped data access via UserSellers table

---

## 5. Key Fixes Applied This Session

| Issue | Fix |
|-------|-----|
| GMS upload blank page | Use `startDate/endDate` from context, not hardcoded |
| ASIN Manager filters | BuyBox JSON fallback, VideoCount NULL, availability LIKE |
| ERR_HTTP_HEADERS_SENT | Added `if (res.headersSent) return` guards |
| Price dispute dynamic | Computed at render time, not from DB |
| Deal badge display | Only shows when deal is active (dates exist) |
| Seller email field | Added to DB, create/update controllers, frontend form |
| GMS export stuck | Replaced ExcelJS with xlsx library, 5-min timeout |
| GMS export filters | Re-added brand/seller filtering (was removed during rewrite) |
| Orders column showing 0 | Added orderedUnits aggregation to row objects |
| Weeks collapsed by default | Changed expandedWeeks default to false |
| Cursor on expand buttons | Added `cursor: pointer` inline |
| Chart: bar → area | 3-series area chart (Revenue + Orders + Returns) |
| Email notifications | 6 templates, triggered on workflow transitions |
| Live sync tracker | Simple brand-level sync status page |

---

## 6. Mobile App

- **Location**: `/mobile/` (Expo SDK 54)
- **Auth**: Same JWT/OTP system
- **API Client**: `apiClient.ts` with auto-refresh
- **Existing pages**: Login, OTP, Dashboard, Explore, Reports, Tickets, Profile
- **Design system**: `mobile/design-system/` with tokens, components

---

## 7. Deployment

### Local Development
- Frontend: `npm run dev` (Vite, port 5173)
- Backend: `pm2 start ecosystem.config.js` (fork mode, port 3001)
- DB: SQL Server at 31.97.62.95:1433

### Production
- Backend: PM2 on VPS (31.97.62.95)
- Frontend: Build → deploy to VPS
- Database: SQL Server on VPS

---

## 8. Design System

### Colors
- Primary: `#1976D2` (Operations)
- Success: `#2E7D32`
- Error: `#D32F2F`
- Warning: `#ED6C02`
- Info: `#0288D1`

### PEMS Colors
- Primary: `#2563EB`
- Success: `#16A34A`
- Warning: `#F59E0B`
- Danger: `#DC2626`
- Purple: `#9333EA`

### Marketplace Badges
- Amazon.in: `{ label: 'AMZ', color: '#FF6200', bg: '#FFFFFF' }`
- Ajio: `{ label: 'AJIO', color: '#2C2C2C', bg: '#FAF5E8' }`
- Myntra: `{ label: 'MYNTRA', color: '#FF356E', bg: '#FFFFFF' }`

---

## 9. API Endpoints Summary (~398 total)

### Critical Seller-Facing APIs
| Module | Count | Key Endpoints |
|--------|-------|---------------|
| ASINs | 36 | GET /api/asins, /stats, /filters, /:id/trends |
| GMS | 3 | /upload/gms-data, /gms-asins, /upload-gms |
| Targets | 7 | GET /api/targets, PUT /achievements |
| Tasks | 5 | GET/POST /api/tasks, /generate |
| PEMS | 33+ | Templates, instances, reviews, dashboard |
| Chat | 23 | Messages, groups, polls, media |
| Exports | 7 | /start, /start-gms, /start-ads, /download/:id |
| Alerts | 13 | /alerts, /alert-rules, /execute-all-rules |
| Seller Tracker | 11 | /inventory/sync, /tasks, /activities |

---

## 10. File Locations Summary

### Frontend (React)
```
src/pages/               — AsinManagerPage, GmsTrackerPage, TasksPage, etc.
src/pages/LiveSyncTrackerPage.jsx — Live sync tracker
src/modules/pems/        — PEMS module (pages, components, services, utils)
src/services/api.js      — Main API client
src/components/          — Shared components (Header, Sidebar, etc.)
src/contexts/            — Auth, Socket, DateRange, PageTitle, etc.
```

### Backend (Express)
```
backend/controllers/     — Route handlers
backend/services/        — Business logic (liveDataSync, email, OTP, etc.)
backend/routes/          — Express route definitions
backend/database/        — SQL Server connection pool
backend/migrations/      — DB schema migrations (3 files)
```

### Mobile (React Native)
```
mobile/app/             — Expo Router pages
mobile/services/        — apiClient, authService
mobile/components/      — UI components
mobile/design-system/   — Tokens, colors, typography
```
