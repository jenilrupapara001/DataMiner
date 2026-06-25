# RetailOps V2.1 — Complete Database Report

**Database:** `retailops` (SQL Server)  
**Server:** 31.97.62.95:1433  
**Report Date:** June 24, 2026  
**Total Tables:** 62  
**Total Indexes:** 155

---

## Tables Overview

| # | Table | Purpose |
|---|-------|---------|
| 1 | ActionHistory | Task status change audit trail |
| 2 | Actions | Tasks / optimization actions |
| 3 | AdsPerformance | Amazon Ads PPC data |
| 4 | AlertRules | Alert rule definitions |
| 5 | Alerts | Generated alerts |
| 6 | ApiKeys | API key management |
| 7 | AsinHistory | Daily ASIN price/BSR/rating history |
| 8 | Asins | Core ASIN catalog (main table) |
| 9 | AsinWeekHistory | Weekly ASIN aggregated history |
| 10 | BrandExecutionRegistry | Brand execution cycle tracking |
| 11 | CalculatorAsins | Revenue calculator ASINs |
| 12 | CallLogs | VoIP call logs |
| 13 | CategoryMaps | Keepa category mapping |
| 14 | ClosingFees | Amazon closing fee slabs |
| 15 | ConversationParticipants | Chat conversation participants |
| 16 | Conversations | Chat conversations |
| 17 | Downloads | Export/download tracking |
| 18 | Files | File management |
| 19 | GmsDailyPerformance | Daily GMS/revenue data |
| 20 | GmsTargetBreakdowns | Monthly target breakdowns |
| 21 | GmsTargets | GMS revenue targets |
| 22 | Goals | Strategic goals |
| 23 | GoalTemplates | Goal templates |
| 24 | KeyResults | OKR key results |
| 25 | MessageReactions | Chat message reactions |
| 26 | Messages | Chat messages |
| 27 | MessageStatus | Message read receipts |
| 28 | MonthlyPerformance | Monthly performance data |
| 29 | NodeMaps | Category node mapping |
| 30 | Notifications | User notifications |
| 31 | Objectives | OKR objectives |
| 32 | OctoTasks | Octoparse task tracking |
| 33 | Orders | Order data |
| 34 | OtpAuditLog | OTP verification audit trail |
| 35 | OtpVerifications | OTP codes storage |
| 36 | PasswordHistory | Password change history |
| 37 | Permissions | Permission definitions |
| 38 | PredefinedTags | Predefined tag templates |
| 39 | ReferralFees | Amazon referral fee slabs |
| 40 | RefundFees | Refund fee slabs |
| 41 | RevenueCalculators | P&L calculator results |
| 42 | RolePermissions | Role-permission mapping |
| 43 | Roles | User roles |
| 44 | RulesetExecutionLogs | Ruleset execution audit |
| 45 | Rulesets | Automation rulesets |
| 46 | ScheduledRuns | Scheduled run history |
| 47 | Sellers | Marketplace seller accounts |
| 48 | SetupWizardProgress | First-login wizard progress |
| 49 | ShippingFees | FBA shipping fee slabs |
| 50 | StorageFees | FBA storage fee rates |
| 51 | SubBsrHistory | Sub-BSR rank history |
| 52 | SystemLogs | System audit logs |
| 53 | SystemSettings | Application settings |
| 54 | TagsHistory | ASIN tag change history |
| 55 | Tasks | Task management |
| 56 | TaskTemplates | Task templates |
| 57 | TeamMembers | Team membership |
| 58 | Teams | Team definitions |
| 59 | TrustedDevices | OTP trusted devices |
| 60 | UserBrandManagers | User-brand manager mapping |
| 61 | Users | User accounts |
| 62 | UserSellers | User-seller assignment |
| 63 | UserSupervisors | User-supervisor hierarchy |
| 64 | WebhookLogs | Webhook delivery logs |
| 65 | Webhooks | Webhook definitions |

---

## Detailed Table Schemas

### Users

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| Id | varchar(24) PK | NO | — |
| Email | nvarchar(255) | NO | — |
| Password | nvarchar(255) | NO | — |
| FirstName | nvarchar(100) | YES | — |
| LastName | nvarchar(100) | YES | — |
| Phone | nvarchar(20) | YES | — |
| Avatar | nvarchar(max) | YES | — |
| RoleId | varchar(24) FK | YES | — |
| IsEmailVerified | bit | NO | 0 |
| IsActive | bit | NO | 1 |
| IsOnline | bit | NO | 0 |
| LastSeen | datetime2 | YES | — |
| Preferences | nvarchar(max) | YES | — |
| RefreshToken | nvarchar(max) | YES | — |
| LoginAttempts | int | NO | 0 |
| LockUntil | datetime2 | YES | — |
| CreatedAt | datetime2 | NO | GETDATE() |
| UpdatedAt | datetime2 | NO | GETDATE() |
| CurrentTeam | varchar(24) | YES | — |
| CometChatUid | nvarchar(100) | YES | — |
| ExtraPermissions | nvarchar(max) | YES | — |
| ExcludedPermissions | nvarchar(max) | YES | — |
| PasswordChangedAt | datetime2 | NO | GETDATE() |
| PasswordExpiresAt | datetime2 | YES | — |
| LastOtpSentAt | datetime | YES | — |
| OtpSentCountToday | int | NO | 0 |
| OtpResetDate | date | NO | GETDATE() |
| IsFirstLogin | bit | NO | 1 |
| FirstLoginAt | datetime | YES | — |
| SetupCompletedAt | datetime | YES | — |
| SecurityPolicyAccepted | bit | NO | 0 |
| ForcePasswordReset | bit | NO | 0 |

### Asins (Core Catalog)

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| Id | varchar(24) PK | NO | — |
| AsinCode | varchar(50) | NO | — |
| SellerId | varchar(24) FK | NO | — |
| Status | nvarchar(50) | YES | — |
| ScrapeStatus | nvarchar(50) | YES | — |
| Category | nvarchar(255) | YES | — |
| Brand | nvarchar(255) | YES | — |
| Title | nvarchar(max) | YES | — |
| ImageUrl | nvarchar(max) | YES | — |
| CurrentPrice | decimal | YES | — |
| UploadedPrice | decimal | YES | — |
| Mrp | decimal | YES | — |
| BSR | int | YES | — |
| SubBsr | int | YES | — |
| SubBsrCategory | nvarchar(255) | YES | — |
| Rating | decimal | YES | — |
| ReviewCount | int | YES | — |
| LQS | decimal | YES | — |
| TitleScore | decimal | YES | — |
| BulletScore | decimal | YES | — |
| ImageScore | decimal | YES | — |
| DescriptionScore | decimal | YES | — |
| BuyBoxWin | bit | NO | 0 |
| SoldBy | nvarchar(255) | YES | — |
| SoldBySec | nvarchar(255) | YES | — |
| AvailabilityStatus | nvarchar(100) | YES | — |
| HasDeal | bit | NO | 0 |
| DealBadge | nvarchar(100) | YES | — |
| DealStartTime | datetime | YES | — |
| DealEndTime | datetime | YES | — |
| DealAccessType | nvarchar(50) | YES | — |
| DealPercentClaimed | nvarchar(20) | YES | — |
| Manufacturer | nvarchar(255) | YES | — |
| PriceDispute | bit | NO | 0 |
| ImagesCount | int | YES | — |
| BulletPoints | int | YES | — |
| HasAplus | bit | NO | 0 |
| Tags | nvarchar(max) | YES | — |
| AllOffers | nvarchar(max) | YES | — |
| BuyBoxes | nvarchar(max) | YES | — |
| ParentAsin | nvarchar(100) | YES | — |
| BsrTrend | nvarchar(50) | YES | — |
| RatingTrend | nvarchar(50) | YES | — |
| DiscountPercentage | decimal | YES | — |
| Ads | bit | NO | 0 |
| LastLiveSyncAt | datetime | YES | — |
| LastSyncSource | nvarchar(20) | YES | — |
| CreatedAt | datetime2 | NO | GETDATE() |
| UpdatedAt | datetime2 | NO | GETDATE() |
| **+ 30 more columns** | (Dimensions, LqsDetails, RatingBreakdown, etc.) | — | — |

### Roles

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| Id | varchar(24) PK | NO | — |
| Name | nvarchar(100) | NO | — |
| DisplayName | nvarchar(255) | YES | — |
| Description | nvarchar(500) | YES | — |
| Level | int | NO | 0 |
| Color | varchar(20) | NO | #4F46E5 |
| IsSystem | bit | NO | 0 |
| IsActive | bit | NO | 1 |
| CreatedAt | datetime2 | NO | GETDATE() |
| UpdatedAt | datetime2 | NO | GETDATE() |

### Sellers

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| Id | varchar(24) PK | NO | — |
| Name | nvarchar(255) | NO | — |
| Marketplace | nvarchar(100) | YES | — |
| SellerId | nvarchar(100) | YES | — |
| IsActive | bit | NO | 1 |
| Plan | nvarchar(50) | NO | Starter |
| ScrapeLimit | int | NO | 100 |
| IsPriority | bit | NO | 0 |
| LiveSyncClientId | nvarchar(255) | YES | — |
| LiveSyncClientSecret | nvarchar(500) | YES | — |
| PartnerTag | nvarchar(100) | YES | — |
| LiveSyncEnabled | bit | NO | 0 |
| CreatedAt | datetime2 | NO | GETDATE() |

### Actions (Tasks)

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| Id | varchar(24) PK | NO | — |
| Title | nvarchar(255) | NO | — |
| Description | nvarchar(max) | YES | — |
| Status | nvarchar(50) | YES | — |
| Priority | nvarchar(50) | YES | — |
| Type | nvarchar(50) | YES | — |
| CreatedBy | varchar(24) FK | YES | — |
| AssignedTo | varchar(24) FK | YES | — |
| SellerId | varchar(24) FK | YES | — |
| ObjectiveId | varchar(24) FK | YES | — |
| KeyResultId | varchar(24) FK | YES | — |
| DueDate | datetime2 | YES | — |
| Asins | nvarchar(max) | YES | — |
| Stage | nvarchar(max) | YES | — |
| TimeTracking | nvarchar(max) | YES | — |
| Submission | nvarchar(max) | YES | — |
| CreatedAt | datetime2 | NO | GETDATE() |

### GmsDailyPerformance

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| Id | varchar(24) PK | NO | — |
| Asin | varchar(50) | NO | — |
| Date | date | NO | — |
| Brand | nvarchar(255) | YES | — |
| StoreCode | nvarchar(50) | YES | — |
| OrderedRevenue | decimal | NO | 0 |
| OrderedUnits | int | NO | 0 |
| ShippedRevenue | decimal | NO | 0 |
| ShippedCOGS | decimal | NO | 0 |
| ShippedUnits | int | NO | 0 |
| CustomerReturns | int | NO | 0 |

### AdsPerformance

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| Id | bigint PK | NO | — |
| Asin | varchar(50) | NO | — |
| Date | date | YES | — |
| Month | date | YES | — |
| ReportType | varchar(20) | NO | — |
| AdSpend | decimal | NO | 0 |
| AdSales | decimal | NO | 0 |
| Impressions | int | NO | 0 |
| Clicks | int | NO | 0 |
| Orders | int | NO | 0 |
| ACoS | decimal | NO | 0 |
| Sessions | int | NO | 0 |
| **+ 15 more columns** | (CTR, CPC, ConvRate, etc.) | — | — |

### Notifications

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| Id | varchar(24) PK | NO | — |
| RecipientId | varchar(24) FK | NO | — |
| Type | nvarchar(50) | NO | — |
| ReferenceModel | nvarchar(100) | YES | — |
| ReferenceId | varchar(24) | YES | — |
| Message | nvarchar(max) | NO | — |
| IsRead | bit | NO | 0 |
| CreatedAt | datetime2 | NO | GETDATE() |

### OtpVerifications

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| Id | int PK | NO | — |
| UserId | nvarchar(50) | NO | — |
| Email | nvarchar(255) | NO | — |
| OtpHash | nvarchar(255) | NO | — |
| Purpose | nvarchar(50) | NO | — |
| IpAddress | nvarchar(45) | YES | — |
| UserAgent | nvarchar(500) | YES | — |
| Attempts | int | NO | 0 |
| MaxAttempts | int | NO | 3 |
| IsUsed | bit | NO | 0 |
| ExpiresAt | datetime | NO | — |
| CreatedAt | datetime | NO | GETDATE() |

### OtpAuditLog

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| Id | bigint PK | NO | — |
| UserId | nvarchar(50) | YES | — |
| Email | nvarchar(255) | NO | — |
| Action | nvarchar(50) | NO | — |
| Status | nvarchar(20) | NO | — |
| Reason | nvarchar(255) | YES | — |
| IpAddress | nvarchar(45) | YES | — |
| UserAgent | nvarchar(500) | YES | — |
| CreatedAt | datetime | NO | GETDATE() |

### PasswordHistory

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| Id | varchar(24) PK | NO | — |
| UserId | varchar(24) | NO | — |
| PasswordHash | nvarchar(255) | NO | — |
| ChangedAt | datetime2 | NO | GETDATE() |

### TrustedDevices

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| Id | int PK | NO | — |
| UserId | nvarchar(50) | NO | — |
| DeviceFingerprint | nvarchar(255) | NO | — |
| DeviceName | nvarchar(100) | YES | — |
| IpAddress | nvarchar(45) | YES | — |
| LastUsedAt | datetime | NO | GETDATE() |
| ExpiresAt | datetime | NO | — |
| CreatedAt | datetime | NO | GETDATE() |
| IsRevoked | bit | NO | 0 |

### SetupWizardProgress

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| Id | int PK | NO | — |
| UserId | nvarchar(50) | NO | — |
| StepName | nvarchar(50) | NO | — |
| Status | nvarchar(20) | NO | — |
| StepData | nvarchar(max) | YES | — |
| StartedAt | datetime | NO | GETDATE() |
| CompletedAt | datetime | YES | — |

### Rulesets

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| Id | varchar(24) PK | NO | — |
| Name | nvarchar(255) | NO | — |
| Description | nvarchar(max) | YES | — |
| Rules | nvarchar(max) | YES | — |
| Type | varchar(50) | NO | ASIN |
| IsActive | bit | NO | 1 |
| CreatedBy | varchar(24) FK | YES | — |
| UsingDataFrom | varchar(100) | NO | Last 14 days |
| ExcludeDays | varchar(100) | NO | Latest day |
| IsAutomated | bit | NO | 0 |
| RunFrequency | varchar(50) | NO | Daily |
| RunTime | varchar(50) | NO | 08 AM |
| LastRunAt | datetime2 | YES | — |
| TotalRunCount | int | NO | 0 |
| LastRunSummary | nvarchar(max) | YES | — |

### SystemLogs

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| Id | varchar(24) PK | NO | — |
| Type | nvarchar(50) | YES | — |
| EntityType | nvarchar(100) | YES | — |
| EntityId | varchar(24) | YES | — |
| EntityTitle | nvarchar(255) | YES | — |
| UserId | varchar(24) FK | YES | — |
| Description | nvarchar(max) | YES | — |
| Metadata | nvarchar(max) | YES | — |
| CreatedAt | datetime2 | NO | GETDATE() |

---

## Indexes Summary

### High-Performance Indexes (Most Queried)

| Table | Index | Columns | Type |
|-------|-------|---------|------|
| Asins | IX_Asins_SellerId_Status | SellerId, Status | NONCLUSTERED |
| Asins | UC_Asin_Seller | AsinCode, SellerId | UNIQUE |
| Asins | IX_Asins_Brand | Brand | NONCLUSTERED |
| Asins | IX_Asins_BSR | BSR | NONCLUSTERED |
| Asins | IX_Asins_Category | Category | NONCLUSTERED |
| Asins | IX_Asins_CurrentPrice | CurrentPrice | NONCLUSTERED |
| Asins | IX_Asins_Sku | Sku | NONCLUSTERED |
| AdsPerformance | IX_AdsPerf_Asin_Date | Asin, Date | NONCLUSTERED |
| GmsDailyPerformance | UC_GmsDaily_Asin_Date | Asin, Date | UNIQUE |
| GmsDailyPerformance | IX_GmsDaily_Asin_Date | Asin, Date | NONCLUSTERED |
| Users | IX_Users_Email | Email | UNIQUE |
| Users | IX_Users_RoleId | RoleId | NONCLUSTERED |
| Users | IX_Users_IsActive | IsActive | NONCLUSTERED |
| Actions | IX_Actions_Status | Status | NONCLUSTERED |
| Actions | IX_Actions_SellerId | SellerId | NONCLUSTERED |
| Notifications | IX_Notif_RecipientId | RecipientId | NONCLUSTERED |
| Notifications | IX_Notif_IsRead | IsRead | NONCLUSTERED |
| SystemLogs | IX_SystemLogs_CreatedAt | CreatedAt | NONCLUSTERED |
| OtpVerifications | PK | Id | CLUSTERED |
| PasswordHistory | IX_PW_UserId | UserId | NONCLUSTERED |
| TrustedDevices | PK | Id | CLUSTERED |

### Security Table Indexes

| Table | Index | Columns | Type |
|-------|-------|---------|------|
| OtpAuditLog | PK | Id | CLUSTERED |
| OtpVerifications | PK | Id | CLUSTERED |
| PasswordHistory | IX_PW_UserId | UserId | NONCLUSTERED |
| TrustedDevices | PK | Id | CLUSTERED |
| SetupWizardProgress | PK | Id | CLUSTERED |

---

## Key Relationships

```
Users ──FK──> Roles (via RoleId)
Users ──M:N──> Sellers (via UserSellers)
Users ──M:N──> Users (via UserSupervisors)
Users ──M:N──> Sellers (via UserBrandManagers)
Asins ──FK──> Sellers (via SellerId)
Actions ──FK──> Users (via CreatedBy, AssignedTo)
Actions ──FK──> Sellers (via SellerId)
Actions ──FK──> Objectives (via ObjectiveId)
Objectives ──FK──> Goals (via GoalId)
KeyResults ──FK──> Objectives (via ObjectiveId)
Rulesets ──FK──> Users (via CreatedBy)
RulesetExecutionLogs ──FK──> Rulesets (via RulesetId)
Notifications ──FK──> Users (via RecipientId)
Permissions ──M:N──> Roles (via RolePermissions)
GmsDailyPerformance ──FK──> Asins (via Asin=AsinCode)
AdsPerformance ──FK──> Asins (via Asin=AsinCode)
Messages ──FK──> Conversations (via ConversationId)
OtpVerifications ──FK──> Users (via UserId)
PasswordHistory ──FK──> Users (via UserId)
TrustedDevices ──FK──> Users (via UserId)
SetupWizardProgress ──FK──> Users (via UserId)
```

---

## Statistics

| Metric | Value |
|--------|-------|
| Total Tables | 62 |
| Total Indexes | 155 |
| Unique Constraints | 18 |
| Clustered Indexes | 62 (one per table PK) |
| Largest Table | Asins (120+ columns) |
| Most Indexed Table | Asins (8 non-clustered indexes) |
