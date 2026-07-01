# RetailOps Performance Execution Management System (PEMS)

# Complete Rebuild Architecture Specification

---

# 1. Project Overview

## Objective

Rebuild the existing RetailOps Tasks Module into an enterprise-grade Performance Execution Management System (PEMS) designed for operational workflow execution, SLA monitoring, SOP-driven task completion, reviewer validation, and measurable performance tracking.

The current Objective → Key Result → Action architecture must be replaced with a scalable operational execution architecture.

---

# 2. Core Vision

The new system should function as:

* Operational workflow execution engine
* SOP-driven task management platform
* Seller performance monitoring system
* Brand manager productivity tracker
* SLA monitoring system
* Reviewer approval workflow engine
* Recurring task automation platform

---

# 3. Existing Architecture Problems

## Current Issues

### Monolithic Structure

* Existing `TasksPage.jsx` contains 1900+ lines
* Mixed UI, business logic, workflow logic, filtering, and data transformation

### Incorrect Data Hierarchy

Current:
Seller → Objective → KR → Action

Required:
Seller → Task Template → Task Instance → Sub Tasks → Activities

### No Recurring Task Engine

* Current tasks are mostly one-time
* No template-based execution

### No SOP Architecture

* Tasks lack step-by-step execution guidance

### No SLA Enforcement

* Cannot monitor operational compliance

### Weak Performance Tracking

* No target vs achievement model
* No variance calculation
* No KPI aggregation

### Fake Progress Calculation

* Current progress is only status-based

---

# 4. New System Architecture

# 4.1 Core Hierarchy

Seller
└── Task Template
├── SOP Activities
├── Frequency Rules
├── SLA Rules
├── Target Logic
└── Task Instance
├── Sub Tasks
├── Activities
├── Evidence
├── Reviewer
├── Achievement
├── Variance
└── Audit Trail

---

# 5. Core Modules

# 5.1 Task Dashboard

Purpose:
Central operational command center.

Features:

* Total tasks
* Pending tasks
* In progress tasks
* Submitted tasks
* Approved tasks
* Rejected tasks
* SLA breached tasks
* Achievement %
* Variance %
* Seller performance
* Brand manager performance
* Upcoming deadlines

Widgets:

* KPI cards
* SLA charts
* Performance graphs
* Reviewer queues
* Team productivity

---

# 5.2 Task Template Module

Purpose:
Master definition system for recurring operational tasks.

Each template defines:

* SOP
* Frequency
* SLA
* TAT
* Target
* Reviewer
* Activities
* Expected outputs

Example:
Optimize Product Listings

* Frequency: Weekly
* SLA: 48 Hours
* Target: 100 Listings
* Reviewer: Listing Manager

---

# 5.3 Task Execution Module

Purpose:
Execution workspace for Brand Managers.

Capabilities:

* Start task
* Update progress
* Upload evidence
* Complete activities
* Submit task
* Add remarks

---

# 5.4 Review Module

Purpose:
Reviewer validation workflow.

Capabilities:

* Review evidence
* Validate completion
* Approve
* Reject
* Send back for rework
* Add review remarks

---

# 5.5 SOP Library

Purpose:
Centralized SOP repository.

Each SOP contains:

* Step-by-step workflow
* Expected output
* Support documents
* Validation requirements

---

# 5.6 Analytics Module

Purpose:
Operational performance reporting.

Reports:

* Achievement %
* Variance %
* SLA compliance
* Team productivity
* Seller performance
* Reviewer efficiency
* Department performance

---

# 6. Database Design

# 6.1 Task Template

```json
{
  "_id": "templateId",

  "taskCode": "TPL-001",

  "name": "Optimize Listings",

  "description": "Improve listing quality score",

  "category": "LISTING",

  "department": "CATALOG",

  "frequency": "WEEKLY",

  "slaHours": 48,

  "tatHours": 24,

  "priority": "HIGH",

  "targetType": "NUMERIC",

  "defaultTarget": 100,

  "expectedOutput": "Optimized Listings",

  "reviewerId": "userId",

  "activities": [],

  "subTasks": [],

  "isActive": true,

  "createdAt": "",

  "updatedAt": ""
}
```

---

# 6.2 Task Instance

```json
{
  "_id": "instanceId",

  "taskId": "TASK-2026-0001",

  "templateId": "templateId",

  "sellerId": "sellerId",

  "sellerName": "ABC Brand",

  "assignedTo": "brandManagerId",

  "reviewerId": "reviewerId",

  "status": "PENDING",

  "reviewStatus": "NOT_REVIEWED",

  "frequency": "WEEKLY",

  "assignedAt": "",

  "acceptedAt": "",

  "startedAt": "",

  "submittedAt": "",

  "reviewedAt": "",

  "completedAt": "",

  "dueDate": "",

  "target": 100,

  "achievement": 0,

  "variance": 0,

  "achievementPercentage": 0,

  "slaStatus": "WITHIN_SLA",

  "submissionRemarks": "",

  "reviewRemarks": "",

  "completionEvidence": [],

  "attachments": [],

  "auditLogs": []
}
```

---

# 6.3 Sub Task

```json
{
  "_id": "subTaskId",

  "taskInstanceId": "instanceId",

  "subTaskCode": "ST-001",

  "title": "Keyword Research",

  "description": "Perform keyword research",

  "status": "PENDING",

  "expectedOutput": "Keyword Sheet",

  "completionEvidence": [],

  "createdAt": ""
}
```

---

# 6.4 Activities

```json
{
  "_id": "activityId",

  "subTaskId": "subTaskId",

  "stepNo": 1,

  "title": "Download Search Query Report",

  "instructions": "Download last 30 days SQR report",

  "expectedOutput": "Excel Report",

  "supportDocuments": [],

  "mandatory": true,

  "completed": false
}
```

---

# 6.5 Evidence

```json
{
  "_id": "evidenceId",

  "taskInstanceId": "instanceId",

  "fileUrl": "",

  "fileType": "IMAGE",

  "remarks": "",

  "uploadedBy": "userId",

  "uploadedAt": ""
}
```

---

# 7. Workflow Engine

# 7.1 Status Flow

DRAFT
↓
ASSIGNED
↓
ACCEPTED
↓
IN_PROGRESS
↓
SUBMITTED
↓
UNDER_REVIEW
├── APPROVED
└── REJECTED
↓
REWORK
↓
RESUBMITTED

---

# 7.2 Workflow Rules

## ASSIGNED → ACCEPTED

Brand Manager accepts task.

## ACCEPTED → IN_PROGRESS

Work execution begins.

## IN_PROGRESS → SUBMITTED

Task submitted with evidence.

## SUBMITTED → UNDER_REVIEW

Reviewer queue entry created.

## UNDER_REVIEW → APPROVED

Reviewer validates completion.

## UNDER_REVIEW → REJECTED

Reviewer sends back for correction.

## REJECTED → REWORK

Brand Manager performs corrections.

## REWORK → RESUBMITTED

Updated submission sent again.

---

# 8. KPI Engine

# 8.1 Achievement Formula

```js
achievementPercentage =
(achievement / target) * 100;
```

---

# 8.2 Variance Formula

```js
variance =
achievement - target;
```

---

# 8.3 SLA Formula

```js
slaStatus =
completedAt <= dueDate
  ? "WITHIN_SLA"
  : "BREACHED";
```

---

# 9. Frequency Engine

Supported Frequencies:

* One Time
* Daily
* Weekly
* Bi Weekly
* Monthly
* Quarterly
* Half Yearly
* Yearly
* Custom Cron

Example:
Every Monday at 10 AM

Task Flow:
Task Template
↓
Auto Generated Task Instance
↓
Assigned to Brand Manager

---

# 10. UI Architecture

# 10.1 Main Pages

/pages/tasks
/pages/task-templates
/pages/task-review
/pages/task-analytics
/pages/task-dashboard
/pages/task-sop-library

---

# 10.2 Component Structure

/modules/tasks
├── components
├── hooks
├── services
├── store
├── utils
├── constants
├── pages
└── workflows

---

# 11. Required Features

## Core Features

* Task Templates
* Recurring Task Engine
* Task Instances
* SOP Activities
* Evidence Upload
* Reviewer Workflow
* SLA Tracking
* KPI Engine
* Analytics Dashboard

## Advanced Features

* Escalation Rules
* Notifications
* Audit Logs
* Activity Tracking
* Team Performance
* Role Permissions

---

# 12. Permissions

## Admin

* Full access

## Operations Manager

* Create templates
* Assign tasks
* Review analytics

## Brand Manager

* Execute tasks
* Upload evidence
* Submit tasks

## Reviewer

* Approve/reject submissions

---

# 13. Notifications

Triggers:

* Task assigned
* SLA nearing
* Task overdue
* Review pending
* Rejected task
* Approved task

Channels:

* In-app
* Email
* WhatsApp (future)

---

# 14. Performance Considerations

Must support:

* 100K+ task instances
* Server-side pagination
* Lazy loading
* Virtualized tables
* Indexed queries
* Background cron generation

---

# 15. Recommended Tech Stack

Frontend:

* React
* Ant Design
* Zustand
* React Query

Backend:

* Node.js
* Express
* MongoDB

Storage:

* S3 / Cloudinary

Scheduling:

* BullMQ / Cron Jobs

---

# 16. Development Phases

# Phase 1

* Task templates
* Task instances
* Workflow engine
* Evidence upload
* Dashboard KPIs

# Phase 2

* SOP library
* Frequency automation
* Analytics
* Notifications

# Phase 3

* AI integrations
* Smart recommendations
* Auto escalations
* AI SOP generation

---

# 17. Final Goal

The rebuilt RetailOps Tasks Module must function as a complete enterprise operational execution and performance management platform rather than a simple task management system.
