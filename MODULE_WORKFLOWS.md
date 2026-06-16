# RetailOps V2.1 Module Workflows Design & Architecture

Welcome to the comprehensive workflow design and visual diagram documentation for **RetailOps V2.1** (Growth Management System). This guide maps the end-to-end journey from user login, session initialization, and dashboard rendering, down to every specific sub-system operational flow.

---

## 1. Master Flow: End-to-End User Journey

This flowchart traces the user journey from authentication, through the onboarding and router checks, into the major functional nodes of the platform.

```mermaid
graph TD
    Start([1. User Opens App])
    Login{2. Authenticated?}
    AuthPage[3. LoginPage /api/auth/login]
    VerifyAuth{4. Valid JWT?}
    SaveToken[5. Save Token & Init Contexts]
    OnboardCheck{6. Onboarding Complete?}
    OnboardWizard[7. OnboardingWizard Component]
    MarkOnboardComplete[8. Save Settings to DB]
    DashboardInit[9. Load Protected Shell]
    Router{10. User Selects Route}
    R_Dash[11. Dashboard /api/dashboard/stats]
    R_Asin[12. ASIN Tracker /api/asins]
    R_Gms[13. GMS Tracker /api/upload/gms-data]
    R_Ads[14. Ads Manager /api/ads/report]
    R_Alert[15. Alert Rules & Rulesets]
    R_Goal[16. Goals & Target Achievements]
    R_Chat[17. CometChat Messaging]
    DB[(SQL Server Database)]

    Start --> Login
    Login -- No --> AuthPage
    AuthPage --> VerifyAuth
    VerifyAuth -- No --> AuthPage
    VerifyAuth -- Yes --> SaveToken
    Login -- Yes --> SaveToken
    SaveToken --> OnboardCheck
    OnboardCheck -- No --> OnboardWizard
    OnboardWizard --> MarkOnboardComplete
    MarkOnboardComplete --> DashboardInit
    OnboardCheck -- Yes --> DashboardInit
    DashboardInit --> Router
    Router -->|Dashboard| R_Dash
    Router -->|ASIN Manager| R_Asin
    Router -->|GMS Tracker| R_Gms
    Router -->|Ads Manager| R_Ads
    Router -->|Rulesets / Alerts| R_Alert
    Router -->|Goals / OKRs| R_Goal
    Router -->|Chat & Collab| R_Chat
    R_Dash & R_Asin & R_Gms & R_Ads & R_Alert & R_Goal & R_Chat --> DB

    classDef startEnd fill:#6366F1,stroke:#4F46E5,stroke-width:2px,color:#fff;
    classDef process fill:#F3F4F6,stroke:#D1D5DB,stroke-width:1px,color:#1F2937;
    classDef decision fill:#FEF3C7,stroke:#D97706,stroke-width:1px,color:#78350F;
    classDef db fill:#ECFDF5,stroke:#10B981,stroke-width:1px,color:#065F46;

    class Start startEnd;
    class AuthPage,SaveToken,OnboardWizard,MarkOnboardComplete,DashboardInit,R_Dash,R_Asin,R_Gms,R_Ads,R_Alert,R_Goal,R_Chat process;
    class Login,VerifyAuth,OnboardCheck,Router decision;
    class DB db;
```

---

## 2. Step 1: Login, Session Initialization & RBAC Bootstrapping

This sequence detail shows the handshake between the login inputs, token signature, role extraction, client context configurations, and redirect routes.

```mermaid
sequenceDiagram
    autonumber
    actor User as Brand Manager / Admin
    participant Client as LoginPage (React)
    participant AuthContext as AuthContext Provider
    participant API as authController (Express)
    participant DB as SQL Server (Database)
    participant Shell as App Shell Router

    User->>Client: "Input credentials & submit form"
    Client->>API: "POST /api/auth/login { email, password }"
    API->>DB: "SELECT * FROM Users WHERE Email = @email"
    DB-->>API: "User Record (Hashed password, RoleId)"
    API->>API: "Verify password via bcrypt.compare()"
    
    Note over API, DB: Loading user permissions scope
    API->>DB: "SELECT PermissionName FROM RolePermissions JOIN Permissions WHERE RoleId = @roleId"
    DB-->>API: "Permission list (e.g. gms_tracker_view, asinmanager_import)"
    API->>DB: "SELECT SellerId FROM UserSellers WHERE UserId = @userId"
    DB-->>API: "List of authorized Brand/Seller IDs"
    
    API->>API: "Create signed JWT (contains role, permissions, and assigned sellers)"
    API-->>Client: "JSON Response { token, userProfile }"
    Client->>AuthContext: "Store token in state & LocalStorage"
    Client->>AuthContext: "Boot Contexts (DateRange, Sidebar, Socket, CometChat)"
    
    alt Onboarding Wizard Needed
        AuthContext->>Shell: "Redirect to /onboarding"
    else Normal Operation
        AuthContext->>Shell: "Redirect to / (Dashboard)"
    end
```

---

## 3. Step 2: Dashboard Rendering & Multi-Tenant Scoping

Once authenticated, this flow explains how user privileges filter raw metrics to render KPIs.

```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant Page as DashboardPage (React)
    participant API as dashboardController (Express)
    participant DB as SQL Server (Database)
    
    User->>Page: "Navigates to Dashboard"
    Page->>API: "GET /api/dashboard/stats (Bearer Token in Header)"
    Note over API: Middleware parses JWT & retrieves req.user.assignedSellers
    
    alt User is Brand Manager (Restricted Seller Scope)
        API->>DB: "SELECT SUM(OrderedRevenue) FROM GmsDailyPerformance WHERE SellerId IN (@assignedSellers)"
        DB-->>API: "Filtered GMS sum"
    else User is Admin / Operational Manager (Global Scope)
        API->>DB: "SELECT SUM(OrderedRevenue) FROM GmsDailyPerformance"
        DB-->>API: "Total platform GMS sum"
    end
    
    API-->>Page: "JSON Response { gmsTotal, activeAsins, buyBoxPct, acos }"
    Page->>Page: "Render KPIs & ApexCharts (Spend vs Revenue trends)"
```

---

## 4. Step 3: ASIN Tracking, History & Price Disputes

This workflow details catalog listing lookups, detail graphing, and price variance triggers.

```mermaid
graph TD
    Start[User Opens ASIN Tracker]
    Query[GET /api/asins]
    QueryDB[SELECT * FROM Asins JOIN Sellers]
    CheckDispute{UploadedPrice > 0 AND CurrentPrice != UploadedPrice?}
    DealCheck{Has active DealBadge?}
    MarkDispute[Set priceDispute = 1]
    MarkOK[Set priceDispute = 0]
    Response[Return JSON with dispute flags]
    UI[Render list with red warning tags on price disputes]
    ClickRow[User Clicks Product Detail]
    HistQuery[GET /api/asins/:id/history]
    ReadHist[SELECT * FROM AsinHistory WHERE AsinId = @id]
    ApexCharts[Plot Price, BSR, and Rating trends on ApexCharts]

    Start --> Query
    Query --> QueryDB
    QueryDB --> CheckDispute
    CheckDispute -- Yes --> DealCheck
    DealCheck -- No --> MarkDispute
    DealCheck -- Yes --> MarkOK
    CheckDispute -- No --> MarkOK
    MarkDispute --> Response
    MarkOK --> Response
    Response --> UI
    UI --> ClickRow
    ClickRow --> HistQuery
    HistQuery --> ReadHist
    ReadHist --> ApexCharts

    classDef action fill:#EEF2F6,stroke:#94A3B8,stroke-width:1px;
    classDef decision fill:#FEF3C7,stroke:#D97706,stroke-width:1px;
    classDef db fill:#ECFDF5,stroke:#10B981,stroke-width:1px;

    class Start,Query,MarkDispute,MarkOK,Response,UI,ClickRow,HistQuery,ApexCharts action;
    class CheckDispute,DealCheck decision;
    class QueryDB,ReadHist db;
```

---

## 5. Step 4: GMS Day-over-Day Tracker Ingestion & Trend Matrix

Explains how spreadsheets are processed, verified, and mapped onto a calendar trend grid.

```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant Page as GmsTrackerPage (React)
    participant API as uploadController (Express)
    participant DB as SQL Server (Database)

    User->>Page: "Upload GMS sheet (Select Date: e.g. June 3)"
    Page->>API: "POST /api/upload/upload-gms { file, date }"
    Note over API: Check if user owns the ASINs in the file
    API->>DB: "SELECT AsinCode FROM Asins WHERE SellerId IN (@assignedSellers)"
    DB-->>API: "Allowed ASIN codes set"
    
    API->>API: "Filter file rows. Skip ASINs not in allowed set."
    API->>DB: "CREATE TABLE ##TempGms_... (Create dynamic scratch table)"
    API->>DB: "BULK INSERT file rows into ##TempGms_..."
    
    Note over API, DB: Atomic MERGE/UPSERT to prevent duplicates
    API->>DB: "MERGE GmsDailyPerformance AS T USING ##TempGms AS S ON (T.Asin = S.Asin AND T.Date = S.Date) MATCHED: UPDATE, NOT MATCHED: INSERT"
    DB-->>API: "Merge count (processed, skipped)"
    API->>DB: "DROP TABLE ##TempGms_..."
    API-->>Page: "JSON Response { success: true, processedCount }"
    
    Page->>API: "GET /api/upload/gms-data (Request grid records)"
    API-->>Page: "Returns daily sales lines"
    
    Note over Page: Dynamic Datatable Construction
    Page->>Page: "Map date headers: June 1 | June 2 | June 3"
    Page->>Page: "Calculate column trends: Trend (Jun 2 vs Jun 1), Trend (Jun 3 vs Jun 2)"
    Page->>Page: "Interleave Trend Columns into the Table structure"
    Page->>User: "Display grid with Trend percentage metrics and Sparklines"
```

---

## 6. Step 5: Ads Performance & Campaign Analytics

How campaign metrics are parsed and rendered with sticky navigation columns to prevent layout overlapping.

```mermaid
graph TD
    Start[User uploads ads report]
    Parse[Parse Excel file rows]
    DBInsert[BULK INSERT into AdsPerformance Table]
    ClientReq[User opens Ads Manager Page]
    Agg[Fetch Ads metrics joined with ASIN catalog info]
    Math[Calculate ACoS, ROAS, and TACoS ratios]
    Render[Render Table Container]
    Sticky[Apply sticky position style to ASIN/SKU columns]
    Scroll[Horizontal scroll enabled for metric columns without overlap]

    Start --> Parse
    Parse --> DBInsert
    DBInsert --> ClientReq
    ClientReq --> Agg
    Agg --> Math
    Math --> Render
    Render --> Sticky
    Sticky --> Scroll

    classDef action fill:#EEF2F6,stroke:#94A3B8,stroke-width:1px;
    classDef process fill:#F8FAFC,stroke:#E2E8F0,stroke-width:1px;
    classDef db fill:#ECFDF5,stroke:#10B981,stroke-width:1px;

    class Start,ClientReq,Agg,Render,Scroll action;
    class Parse,Math,Sticky process;
    class DBInsert db;
```

---

## 7. Step 6: Octoparse Scraper Automation & Data Sync Pipeline

This diagram shows the scraping loop, from URL file injection, cloud scraper execution, quad-hourly polling, and memory-safe regex DOM parsing.

```mermaid
sequenceDiagram
    autonumber
    participant Cron as Scheduler (Cron Engine)
    participant Sync as marketDataSyncService (Node.js)
    participant Octo as Octoparse OpenAPI Server
    participant DB as SQL Server (Database)

    Cron->>Sync: "Trigger Daily Automation (Midnight Run)"
    Sync->>Sync: "Validate settings & API credentials"
    Sync->>Octo: "POST /token (Get OAuth Token)"
    Octo-->>Sync: "Return Bearer Token (Cached for 1 hour)"
    
    Sync->>DB: "SELECT AsinCode, SellerId FROM Asins WHERE Status = 'Active'"
    DB-->>Sync: "Active ASIN list"
    
    Note over Sync, Octo: Injecting ASIN list via V3 File Upload
    Sync->>Sync: "Construct text payload (one ASIN URL per line)"
    Sync->>Octo: "POST /task/urls:file { taskId, fileBlob }"
    Octo-->>Sync: "Status: Ingested & FileProcessing complete"
    
    Sync->>Octo: "POST /cloudextraction/start { taskId }"
    Octo-->>Sync: "Extraction Started (lotNo generated)"
    
    Loop Every 4 Hours (Polling Loop)
        Sync->>Octo: "GET /data/markexported?taskId=@taskId"
        Octo-->>Sync: "JSON array of raw scraped HTML pages"
        
        Note over Sync: Memory-Safe Parser Queue
        Sync->>Sync: "Push pages to Queue (Max 50 items/batch)"
        Loop For each page in Batch
            Sync->>Sync: "DOM Parse content using JSDOM"
            Sync->>Sync: "Extract Category, Brand, Star Ratings"
            Sync->>Sync: "Regex match SubBSRs: /#\s*([\d,]+)/"
            Sync->>Sync: "Evaluate Listing Quality Score (LQS)"
            Sync->>DB: "Update Asins & Insert into AsinHistory"
        End
        
        Sync->>Octo: "POST /data/remove (Clear exported data from cloud queues)"
    End
```

---

## 8. Step 7: Goal Management, OKRs & Perplexity AI Decomposition

The workflow details OKR tracking and how high-level goals decompose into action checklists using AI prompts.

```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant Page as GoalsPage (React)
    participant Ctrl as goalController (Express)
    participant AI as aiGoalService (Perplexity Integration)
    participant DB as SQL Server (Database)

    User->>Page: "Type goal: 'Increase Brand GMS by 20% in 30 days'"
    Page->>Ctrl: "POST /api/goals/decompose { goalText }"
    Ctrl->>AI: "Trigger Perplexity analysis with goal mapping prompt"
    Note over AI: Resolves goal objectives into metrics, sub-tasks & milestones
    AI-->>Ctrl: "Returns structured JSON checklist"
    Ctrl->>DB: "INSERT into Goals & Objectives (Create parent records)"
    Ctrl->>DB: "INSERT into Actions (Bulk create sub-task records)"
    DB-->>Ctrl: "OK"
    Ctrl-->>Page: "JSON Response { goalId, tasksCreatedCount }"
    Page->>User: "Render OKR Tree layout with automated sub-tasks"
```

---

## 9. Step 8: Ruleset Engine & Alert Dispatcher

This diagram maps rule evaluation pipelines to create notifications, logs, and outgoing webhooks.

```mermaid
sequenceDiagram
    autonumber
    participant Cron as Automation Cron
    participant Engine as rulesetEngineService
    participant DB as SQL Server (Database)
    participant Webhook as webhookController (Express)

    Cron->>Engine: "Run active rulesets"
    Engine->>DB: "SELECT * FROM Rulesets WHERE IsActive = 1"
    DB-->>Engine: "Rulesets List"
    
    Loop For each Ruleset
        Engine->>DB: "GetEntityData() - Fetch target ASIN performance metrics"
        DB-->>Engine: "ASIN performance lines"
        
        Loop For each ASIN
            Engine->>Engine: "Evaluate ruleset boolean logic (AND/OR groups)"
            
            alt Conditions met (e.g. Buy Box Lost)
                Engine->>DB: "INSERT INTO Alerts (Generate warning alert)"
                Engine->>DB: "INSERT INTO Actions (Generate auto-optimization task)"
                Engine->>DB: "INSERT INTO Notifications (For user dashboard alert)"
                
                alt Webhook endpoint configured
                    Engine->>Webhook: "Trigger outgoing hook"
                    Webhook->>Webhook: "Fetch webhook signature keys"
                    Webhook->>ExternalEndpoint: "POST webhook payload { event: 'ALERT_TRIGGERED', details }"
                    ExternalEndpoint-->>Webhook: "Response 200 OK"
                    Webhook->>DB: "INSERT INTO WebhookLogs (Audit log)"
                end
            end
        End
        
        Engine->>DB: "INSERT INTO RulesetExecutionLogs (Audit log ruleset run)"
        Engine->>DB: "UPDATE Rulesets (Set LastRunAt, increment RunCount)"
    End
```

---

## 10. Step 9: margins Calculator & FBA Fees

How parameters map to calculate profit margins.

```mermaid
graph LR
    In_Price[Current Price]
    In_COGS[Shipped COGS]
    In_Specs[Weight & dimensions]
    Calc[Payout Calculation Engine]
    DB_Ref[ReferralFees Table]
    DB_Close[ClosingFees Table]
    DB_Ship[ShippingFees Table]
    DB_Store[StorageFees Table]
    Results[Output calculations]
    Payout[Net Seller Payout]
    Profit[Net Profit margin %]

    In_Price --> Calc
    In_COGS --> Calc
    In_Specs --> Calc
    
    Calc -->|Lookup Referral Rate| DB_Ref
    Calc -->|Lookup Closing Bracket| DB_Close
    Calc -->|Lookup Shipping Costs| DB_Ship
    Calc -->|Lookup Storage Bracket| DB_Store
    
    DB_Ref & DB_Close & DB_Ship & DB_Store --> Results
    Results --> Payout
    Results --> Profit

    classDef input fill:#F8FAFC,stroke:#E2E8F0,stroke-width:1px;
    classDef process fill:#F1F5F9,stroke:#CBD5E1,stroke-width:1px;
    classDef db fill:#ECFDF5,stroke:#10B981,stroke-width:1px;

    class In_Price,In_COGS,In_Specs,Payout,Profit input;
    class Calc,Results process;
    class DB_Ref,DB_Close,DB_Ship,DB_Store db;
```

---

## 11. Step 10: Collaboration Chat & Channels

Shows real-time workspace chat room messaging loops.

```mermaid
sequenceDiagram
    autonumber
    actor UserA as User A (Listing Manager)
    actor UserB as User B (Brand Manager)
    participant Client as ChatContainer (React)
    participant SDK as CometChat SDK (JS Client)
    participant Webhook as chatWebhookController (Express)
    participant DB as SQL Server (Database)

    UserA->>Client: "Open Chat Page & Type Message"
    Client->>SDK: "sendMessage(messageText, roomId)"
    SDK-->>UserB: "Deliver Message in Real-Time (WebSockets)"
    SDK->>Webhook: "POST chat webhook (Message event)"
    Note over Webhook: "Syncing chat status to local DB"
    Webhook->>DB: "INSERT INTO Messages (Save chat history)"
    Webhook->>DB: "INSERT INTO MessageStatus (Unread indicators)"
    DB-->>Webhook: "Saved"
    Webhook-->>SDK: "Ack 200"
```

---
*Document Version: 2.1.0*  
*Last Updated: 2026-06-16*
