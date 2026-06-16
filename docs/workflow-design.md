# RetailOps Workflow Design

This document describes the working modules, data flows, runtime behavior, and operational workflows for the RetailOps application. It is based on the current repository structure and code references.

## 1. Application Overview

RetailOps is a full-stack retail operations platform for seller, ASIN, advertising, revenue, target, action, alert, chat, automation, and reporting workflows.

### 1.1 Runtime stack

| Layer | Technology | Reference |
|---|---|---|
| Frontend | React 19, Vite 8, React Router 7, Ant Design, MUI, Zustand, Socket.io client | `package.json:6-78`, `src/App.jsx:1-216` |
| Backend | Express 5, Node.js, PM2, Socket.io, node-cron | `backend/package.json:5-40`, `backend/server.js:1-610` |
| Database | Microsoft SQL Server | `backend/database/db.js:1-164` |
| Auth | JWT access token and refresh token, bcrypt password hashing | `backend/controllers/authController.js:1-260`, `backend/middleware/auth.js:1-240` |
| Automation | Octoparse, Keepa, schedulers, background recovery jobs | `backend/services/marketDataSyncService.js:1-3814`, `backend/services/schedulerService.js:1-862` |
| Realtime | Socket.io for online status, chat, reactions, calls, role permission updates | `backend/server.js:223-567` |
| AI | Perplexity Sonar and NVIDIA NIM integration | `backend/services/AIService.js:1-226` |
| Messaging integration | CometChat REST/webhook flow and local chat persistence | `backend/routes/chatRoutes.js:1-37` |

### 1.2 Main runtime entry points

| Entry point | Purpose | Reference |
|---|---|---|
| `backend/server.js` | Starts Express API, applies middleware, mounts routes, initializes Socket.io, starts schedulers on primary PM2 worker | `backend/server.js:94-163`, `backend/server.js:223-239`, `backend/server.js:576-592` |
| `src/App.jsx` | Defines frontend authentication wrapper, layout, protected routes, context providers, and CometChat initialization | `src/App.jsx:121-177`, `src/App.jsx:190-209` |
| `backend/database/db.js` | Creates SQL Server pool, injects timezone-aware `dbo.GetEnvDate`, exposes retry helpers | `backend/database/db.js:30-90`, `backend/database/db.js:128-156` |
| `backend/services/schedulerService.js` | Runs scheduled enterprise pipelines, missing-data recovery, Keepa sync, Octoparse result fetch, age-tag refresh | `backend/services/schedulerService.js:39-177`, `backend/services/schedulerService.js:428-860` |
| `backend/services/recurringTaskScheduler.js` | Processes recurring actions hourly and runs Keepa seller ASIN discovery every 12 hours | `backend/services/recurringTaskScheduler.js:9-47` |
