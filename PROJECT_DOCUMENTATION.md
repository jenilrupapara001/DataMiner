# GMS Dashboard - Comprehensive Project Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Database Models](#database-models)
5. [Backend Controllers](#backend-controllers)
6. [Frontend Pages](#frontend-pages)
7. [Key Features](#key-features)
8. [API Endpoints](#api-endpoints)
9. [Services & Integrations](#services--integrations)
10. [Configuration](#configuration)

---

## Project Overview

**GMS Dashboard** (Growth Management System) is an enterprise-grade E-commerce Intelligence Platform tailored for high-volume Amazon India operations. The platform provides comprehensive tracking, analytics, and automation for Amazon seller operations.

### Core Capabilities
- ASIN Management & Tracking
- Advertising Performance Analytics
- Revenue & Profit/Loss Calculation
- Task Automation & Goal Tracking
- AI-Powered Image Generation
- Real-time Market Data Sync

---

## Technology Stack

### Frontend
- **Framework**: React 19
- **Styling**: CSS, Tailwind-like custom styles
- **Charts**: ApexCharts
- **Icons**: Lucide React
- **State Management**: React Context API
- **HTTP Client**: Fetch API

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose ODM)
- **Authentication**: Clerk Auth + Custom JWT
- **File Upload**: Multer

### External Services
- **Web Scraping**: Octoparse API
- **AI Image Generation**: NVIDIA NIM (SD3 Medium)
- **AI Analysis**: Perplexity API

---

## Project Structure

```
gms-dashboard/
├── backend/                    # Node.js Express Server
│   ├── config/                 # Database & App Configuration
│   │   └── db.js              # MongoDB Connection
│   ├── controllers/           # Business Logic (30+ Controllers)
│   ├── cron/                  # Scheduled Tasks
│   ├── middleware/            # Auth, RBAC, Upload
│   ├── models/                # Mongoose Schemas (33 Models)
│   ├── routes/                # REST API Routes
│   ├── services/              # External API Wrappers
│   ├── uploads/               # Local Asset Storage
│   ├── utils/                 # Helpers & Validators
│   └── server.js             # Entry Point
│
├── src/                       # React Frontend
│   ├── components/            # UI Components
│   │   ├── actions/          # Action-related components
│   │   ├── common/           # Shared components
│   │   └── ...              # Other components
│   ├── contexts/             # React Contexts
│   ├── hooks/                # Custom Hooks
│   ├── pages/                # Page Components (30+)
│   ├── services/             # API Service Layer
│   ├── styles/               # CSS & Design Tokens
│   └── utils/                # Frontend Helpers
│
├── public/                    # Static Assets
└── package.json              # Dependencies
```

---

## Database Models

### Core Models

| Model | Purpose |
|-------|---------|
| **Asin** | Amazon product tracking with 110+ data points |
| **Seller** | Seller account information |
| **AdsPerformance** | Advertising metrics tracking |
| **User** | User accounts & authentication |
| **Role** | Role-based access control |
| **Action** | Task/action tracking |
| **Goal** | Business objectives |
| **Objective** | OKR objectives |
| **KeyResult** | OKR key results |
| **Notification** | System notifications |
| **Alert** | Alert rules & triggers |
| **File** | Uploaded file metadata |
| **Team** | Team management |
| **ApiKey** | API key management |
| **Message** | Chat messages |
| **Conversation** | Chat conversations |

### Asin Model Schema (Key Fields)
```javascript
{
  asinCode: String,           // Amazon ASIN
  sku: String,                // Seller SKU
  seller: ObjectId,           // Reference to Seller
  title: String,              // Product title
  imageUrl: String,           // Product image
  currentPrice: Number,       // Live price
  uploadedPrice: Number,     // Target price
  bsr: Number,                // Best Seller Rank
  subBSRs: [String],         // Sub-category BSRs
  rating: Number,            // Product rating
  reviewCount: Number,       // Number of reviews
  ratingBreakdown: Object,   // Star rating distribution
  history: [Object],          // Daily snapshots
  weekHistory: [Object],     // Weekly snapshots
  lqs: Number,                // Listing Quality Score
  buyBoxWin: Boolean,         // Buy Box ownership
  hasAplus: Boolean,          // A+ Content status
  imagesCount: Number,        // Image count
  descLength: Number,         // Description length
  status: String,             // Active/Scraping/Inactive
  lastScraped: Date,         // Last scrape timestamp
  category: String,           // Product category
  brand: String,              // Brand name
}
```

---

## Backend Controllers

### Core Business Controllers

| Controller | Purpose |
|------------|---------|
| **asinController** | ASIN CRUD, stats, bulk operations |
| **sellerController** | Seller management |
| **adsController** | Advertising data management |
| **dashboardController** | Dashboard aggregations |
| **marketDataSyncController** | Octoparse sync orchestration |
| **uploadController** | CSV/Excel file uploads |
| **authController** | Authentication |
| **userController** | User management |
| **roleController** | RBAC management |
| **actionController** | Action/Task management |
| **goalController** | Goal tracking |
| **objectiveController** | OKR objectives |
| **aiController** | AI-powered features |
| **exportController** | Data export |

### Administrative Controllers

| Controller | Purpose |
|------------|---------|
| **teamController** | Team management |
| **notificationController** | Notification management |
| **alertController** | Alert management |
| **apiKeyController** | API key management |
| **systemSettingController** | System configuration |
| **systemLogController** | Audit logging |
| **fileController** | File management |

---

## Frontend Pages

### Main Pages

| Page | Path | Description |
|------|------|-------------|
| **Dashboard** | `/` | Main dashboard with KPIs |
| **AsinManagerPage** | `/asin-manager` | ASIN tracking & management |
| **SellersPage** | `/sellers` | Seller management |
| **AdsReport** | `/ads-report` | Advertising analytics |
| **SkuReport** | `/sku-report` | SKU performance |
| **ParentAsinReport** | `/parent-asin-report` | Parent ASIN grouping |
| **MonthWiseReport** | `/month-wise-report` | Monthly trends |
| **ActionsPage** | `/actions` | Task/Action management |
| **GoalsPage** | `/goals` | Goal tracking |
| **RevenueCalculator** | `/revenue-calculator` | FBA fee calculator |
| **InventoryPage** | `/inventory` | Inventory management |
| **ProfitLossPage** | `/profit-loss` | P&L analysis |

### Admin Pages

| Page | Path | Description |
|------|------|-------------|
| **UsersPage** | `/users` | User management |
| **RolesPage** | `/roles` | Role & permissions |
| **TeamManagementPage** | `/teams` | Team management |
| **ApiKeysPage** | `/api-keys` | API key management |
| **AlertsPage** | `/alerts` | Alert configuration |
| **SettingsPage** | `/settings` | System settings |
| **ActivityLog** | `/activity` | Audit logs |

### Utility Pages

| Page | Path | Description |
|------|------|-------------|
| **LoginPage** | `/login` | User login |
| **RegisterPage** | `/register` | User registration |
| **UploadExport** | `/upload-export` | Data import/export |
| **FileManagerPage** | `/files` | File management |
| **ScrapeTasksPage** | `/scrape-tasks` | Scraping tasks |
| **AlertRulesPage** | `/alert-rules` | Alert rules |
| **TemplateManagerPage** | `/templates` | Task templates |

---

## Key Features

### 1. ASIN Manager Pro
- Horizontal product intelligence layout
- Triple-stack ApexCharts visualization
  - Price History (area chart)
  - BSR Trend (line chart with reversed Y-axis)
  - Rating Progression (line chart)
- Smart filtering (7D, 30D, 90D, All)
- Day-wise modal views with pagination

### 2. Advertising Analytics
- Campaign performance tracking
- ROAS, ACoS, CTR calculations
- Month-wise report generation
- SKU-level attribution

### 3. Automation Services
- **Octoparse Sync**: Web scraping automation
- **Auto-Scrape**: Scheduled data refresh
- **Self-Healing Sync**: Automatic retry on data deviation

### 4. AI Features
- **NVIDIA NIM Image Generation**: SD3 lifestyle images
- **Perplexity AI**: Goal decomposition into tasks

### 5. Data Management
- CSV/Excel import with header mapping
- Bulk ASIN operations
- Custom date range filters

---

## API Endpoints

### ASIN Endpoints
```
GET    /api/asins              - List ASINs (paginated)
GET    /api/asins/all          - Get all ASINs (no pagination)
GET    /api/asins/:id          - Get single ASIN
POST   /api/asins              - Create ASIN
PUT    /api/asins/:id          - Update ASIN
DELETE /api/asins/:id          - Delete ASIN
POST   /api/asins/bulk         - Bulk create ASINs
POST   /api/asins/sync         - Trigger sync
GET    /api/asins/stats        - Get ASIN statistics
POST   /api/asins/import-csv   - Import from CSV
```

### Seller Endpoints
```
GET    /api/sellers            - List sellers
GET    /api/sellers/:id        - Get seller details
POST   /api/sellers           - Create seller
PUT    /api/sellers/:id        - Update seller
DELETE /api/sellers/:id       - Delete seller
```

### Ads Endpoints
```
GET    /api/ads                - List ads data
POST   /api/ads/import         - Import ads data
GET    /api/ads/report         - Generate report
```

### User Endpoints
```
POST   /api/auth/login         - User login
POST   /api/auth/register      - User registration
GET    /api/users              - List users
GET    /api/users/me           - Current user
PUT    /api/users/:id          - Update user
```

---

## Services & Integrations

### External Services

| Service | Purpose | Integration |
|---------|---------|-------------|
| **Octoparse** | Web scraping | REST API |
| **NVIDIA NIM** | Image generation | SDK (SD3 Medium) |
| **Perplexity** | AI analysis | REST API |
| **Clerk** | Authentication | JWT tokens |
| **MongoDB** | Database | Mongoose ODM |

### Internal Services

| Service | Purpose |
|---------|---------|
| **marketDataSyncService** | Sync orchestration |
| **octoparseAutomationService** | Scraping automation |
| **imageGenerationService** | AI image generation |
| **revenueCalculatorService** | FBA fee calculation |
| **asinTableService** | ASIN table data |

---

## Configuration

### Environment Variables (Backend)
```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/gms
JWT_SECRET=your-secret-key
CLERK_SECRET_KEY=sk_live_xxx
OCTOPARSE_API_KEY=xxx
NIM_API_KEY=xxx
PERPLEXITY_API_KEY=xxx
```

### Key Configuration Files
- `backend/config/db.js` - Database connection
- `backend/middleware/auth.js` - Authentication middleware
- `backend/middleware/rbac.js` - Role-based access control
- `src/services/api.js` - Frontend API client

---

## Development Commands

```bash
# Backend
npm run dev          # Start development server
npm start           # Start production server

# Frontend
npm run dev         # Start Vite dev server
npm run build       # Build for production
npm run lint        # Run linting
```

---

## License
© 2026 Easysell Projects. All Rights Reserved.