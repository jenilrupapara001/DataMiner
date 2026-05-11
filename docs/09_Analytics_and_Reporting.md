# Analytics & Reporting Engine

## Table of Contents
1. [Overview](#overview)
2. [Workflow & Charts](#workflow--charts)
3. [Key Files](#key-files)
4. [Trend Views & Reports](#trend-views--reports)
5. [Data Export Pipelines](#data-export-pipelines)

---

## Overview
The **Analytics & Reporting Engine** translates raw daily scraped snapshots into actionable business intelligence. It provides brand managers and executives with deep visibility into pricing trends, Best Seller Rank (BSR) fluctuations, ratings trends, buybox ownership rates, and competitor pricing movements.

---

## Workflow & Charts

```mermaid
graph TD
    Data[(Daily Snapshots)] --> Pivot[Aggregation & Pivot Engine]
    Pivot --> Trend[Trend Charting (ApexCharts)]
    Pivot --> Grid[Data Grid Matrix]
    Pivot --> Export[XLSX Export Service]
```

* **Aggregation**: The system pools historical snapshots dynamically, allowing users to filter by 7-day, 30-day, or custom date ranges.
* **Responsive Charting**: Employs **ApexCharts** and **Recharts** to display premium, smooth line and bar graphs representing multi-variant trends.

---

## Key Files
* **Frontend**:
  * [Dashboard.jsx](file:///Users/jenilrupapara/RetailOps_V2.1/retail-ops/src/pages/Dashboard.jsx): High-level operational executive summary metrics.
  * [SkuReport.jsx](file:///Users/jenilrupapara/RetailOps_V2.1/retail-ops/src/pages/SkuReport.jsx): Granular single-SKU multi-market comparison.
* **Backend**:
  * `backend/controllers/exportController.js`: Direct Excel generation using the `xlsx` library, bypassing memory limits by streaming datasets in lightweight batches.

---

## Trend Views & Reports
1. **Price Trends**: Highlights Buybox Price vs. Minimum Allowed Price over time to identify price erosion.
2. **BSR Fluctuations**: Tracks BSR changes to measure how price increases or stockouts affect sales velocity.
3. **Ratings & Reviews (AJIO Trend)**: Displays rating trends alongside review volume to monitor customer satisfaction.

---

## Data Export Pipelines
All dashboard analytical tables can be exported as Excel (`.xlsx`) files. The backend automatically styles headers, formats numbers (currency, percentages), and applies column-width auto-fitting to ensure exports are clean and professional.
