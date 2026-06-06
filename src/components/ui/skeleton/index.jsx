/**
 * src/components/ui/skeleton/index.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Pre-built compound skeleton layouts.  All are composed from the base
 * <Skeleton> primitive and the CSS in Skeleton.css.
 *
 * Named exports:
 *   Skeleton           — base element
 *   CardSkeleton       — image card with body text
 *   StatCardSkeleton   — KPI / metric card (matches Dashboard stat cards)
 *   TableSkeleton      — Ant Design table look-alike
 *   UserListSkeleton   — list of avatar + name rows
 *   DashboardSkeleton  — full page: stats row + chart area + table
 *   FormSkeleton       — labelled input fields + submit button
 *   ProfileSkeleton    — avatar + name/bio block
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from 'react';
import Skeleton from './Skeleton.jsx';
import './Skeleton.css';

// ─── StatCardSkeleton ────────────────────────────────────────────────────────
export function StatCardSkeleton({ className = '' }) {
  return (
    <div className={`sk-stat-card ${className}`}>
      <Skeleton variant="rectangular" className="sk-stat-card__icon" animation="wave" />
      <Skeleton variant="text" width="55%" height="13px" animation="wave" />
      <Skeleton variant="text" width="70px" height="28px" animation="wave" />
      <Skeleton variant="text" width="45%" height="12px" animation="wave" />
    </div>
  );
}

// ─── CardSkeleton ────────────────────────────────────────────────────────────
export function CardSkeleton({ className = '' }) {
  return (
    <div className={`sk-card ${className}`}>
      <Skeleton variant="rectangular" height="180px" animation="wave" style={{ borderRadius: 0 }} />
      <div className="sk-card__body">
        <Skeleton variant="text" width="60%" height="20px" animation="wave" />
        <Skeleton variant="text" count={3} height="14px" animation="wave" />
        <div className="sk-card__footer">
          <Skeleton variant="circular" width={32} height={32} animation="wave" />
          <Skeleton variant="text" width="90px" height="14px" animation="wave" />
        </div>
      </div>
    </div>
  );
}

// ─── TableSkeleton ───────────────────────────────────────────────────────────
// `columns` array of widths lets callers hint realistic column proportions.
export function TableSkeleton({
  rows = 6,
  columns = 5,
  colWidths,      // optional string[] of widths, e.g. ['40%','20%','15%','15%','10%']
  className = '',
}) {
  const widths = colWidths ?? Array.from({ length: columns }, (_, i) =>
    i === 0 ? '35%' : `${Math.floor(55 / (columns - 1))}%`
  );

  const gridStyle = { gridTemplateColumns: widths.map(() => '1fr').join(' ') };

  return (
    <div className={`sk-table ${className}`}>
      {/* Header row */}
      <div className="sk-table__head" style={gridStyle}>
        {widths.map((w, i) => (
          <Skeleton key={i} variant="text" width={w} height="14px" animation="wave" />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }, (_, row) => (
        <div
          key={row}
          className="sk-table__row"
          style={{ ...gridStyle, animationDelay: `${row * 0.04}s` }}
        >
          {widths.map((w, col) => (
            <Skeleton
              key={col}
              variant="text"
              width={col === 0 ? w : `${parseInt(w) * (0.6 + Math.random() * 0.4)}%`}
              height="13px"
              animation="wave"
              style={{ animationDelay: `${(row * columns + col) * 0.02}s` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── UserListSkeleton ────────────────────────────────────────────────────────
export function UserListSkeleton({ count = 5, className = '' }) {
  return (
    <div className={`sk-user-list ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="sk-user-item" style={{ animationDelay: `${i * 0.08}s` }}>
          <Skeleton variant="circular" width={44} height={44} animation="wave" />
          <div className="sk-user-info">
            <Skeleton variant="text" width="140px" height="15px" animation="wave" />
            <Skeleton variant="text" width="200px" height="13px" animation="wave" />
          </div>
          <Skeleton variant="rectangular" width="76px" height="30px" borderRadius="15px" animation="wave" />
        </div>
      ))}
    </div>
  );
}

// ─── DashboardSkeleton ───────────────────────────────────────────────────────
export function DashboardSkeleton({ statsCount = 4, tableRows = 6, className = '' }) {
  return (
    <div className={`sk-dashboard ${className}`}>
      {/* KPI stat cards */}
      <div className="sk-stats-row">
        {Array.from({ length: statsCount }, (_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Chart area */}
      <div className="sk-chart-area">
        <div className="sk-chart-box">
          <Skeleton variant="text" width="180px" height="20px" animation="wave" />
          <Skeleton variant="rectangular" height="280px" borderRadius="8px" animation="wave" />
        </div>
        <div className="sk-chart-box sk-chart-side">
          <Skeleton variant="text" width="140px" height="20px" animation="wave" />
          <Skeleton variant="circular" width={180} height={180} animation="wave" />
        </div>
      </div>

      {/* Table section */}
      <div className="sk-section">
        <Skeleton variant="text" width="160px" height="20px" animation="wave" />
        <TableSkeleton rows={tableRows} columns={5} />
      </div>
    </div>
  );
}

// ─── FormSkeleton ────────────────────────────────────────────────────────────
export function FormSkeleton({ fields = 4, className = '' }) {
  return (
    <div className={`sk-form ${className}`}>
      <Skeleton variant="text" width="200px" height="26px" animation="wave" style={{ marginBottom: 8 }} />
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="sk-form__field">
          <Skeleton variant="text" width="110px" height="13px" animation="wave" />
          <Skeleton variant="rectangular" height="38px" borderRadius="6px" animation="wave" />
        </div>
      ))}
      <Skeleton variant="rectangular" width="120px" height="40px" borderRadius="6px" animation="wave" />
    </div>
  );
}

// ─── ProfileSkeleton ─────────────────────────────────────────────────────────
export function ProfileSkeleton({ className = '' }) {
  return (
    <div className={`sk-profile ${className}`}>
      <div className="sk-profile__header">
        <Skeleton variant="circular" width={96} height={96} animation="wave" />
        <div className="sk-profile__info">
          <Skeleton variant="text" width="180px" height="24px" animation="wave" />
          <Skeleton variant="text" width="130px" height="16px" animation="wave" />
          <Skeleton variant="text" width="220px" height="14px" animation="wave" />
        </div>
      </div>
      <Skeleton variant="text" count={5} height="14px" animation="wave" />
    </div>
  );
}

// ─── Re-export base Skeleton ─────────────────────────────────────────────────
export { default as Skeleton } from './Skeleton.jsx';
export { default } from './Skeleton.jsx';
