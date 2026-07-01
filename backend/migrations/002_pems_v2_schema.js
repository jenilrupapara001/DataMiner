/**
 * PEMS V2 - Schema Migration
 * Adds: Department, escalation rules, notifications, enhanced instance fields
 */
const { sql, getPool } = require('../database/db');

const migrations = [
  // 1. Add Department to TaskTemplates
  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PemsTaskTemplates' AND COLUMN_NAME = 'Department')
   ALTER TABLE PemsTaskTemplates ADD Department NVARCHAR(50) NOT NULL DEFAULT 'Operations'`,

  // 2. Add Department to TaskInstances + enhanced fields
  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PemsTaskInstances' AND COLUMN_NAME = 'Department')
   ALTER TABLE PemsTaskInstances ADD Department NVARCHAR(50) NOT NULL DEFAULT 'Operations'`,

  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PemsTaskInstances' AND COLUMN_NAME = 'SubTaskCount')
   ALTER TABLE PemsTaskInstances ADD SubTaskCount INT DEFAULT 0`,

  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PemsTaskInstances' AND COLUMN_NAME = 'ActivityCount')
   ALTER TABLE PemsTaskInstances ADD ActivityCount INT DEFAULT 0`,

  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PemsTaskInstances' AND COLUMN_NAME = 'CompletedSubTasks')
   ALTER TABLE PemsTaskInstances ADD CompletedSubTasks INT DEFAULT 0`,

  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PemsTaskInstances' AND COLUMN_NAME = 'ProgressPct')
   ALTER TABLE PemsTaskInstances ADD ProgressPct DECIMAL(5,2) DEFAULT 0`,

  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PemsTaskInstances' AND COLUMN_NAME = 'AssigneeName')
   ALTER TABLE PemsTaskInstances ADD AssigneeName NVARCHAR(200) DEFAULT ''`,

  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PemsTaskInstances' AND COLUMN_NAME = 'ReviewerName')
   ALTER TABLE PemsTaskInstances ADD ReviewerName NVARCHAR(200) DEFAULT ''`,

  // 3. Escalation Rules table
  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PemsEscalationRules')
   CREATE TABLE PemsEscalationRules (
     Id VARCHAR(50) PRIMARY KEY,
     Name NVARCHAR(200) NOT NULL,
     TriggerHoursBefore INT NOT NULL DEFAULT 24,
     NotifyRole NVARCHAR(50) NOT NULL DEFAULT 'assignee',
     Channel NVARCHAR(20) NOT NULL DEFAULT 'in_app',
     IsActive BIT NOT NULL DEFAULT 1,
     CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
   )`,

  // 4. Notifications table
  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PemsNotifications')
   CREATE TABLE PemsNotifications (
     Id VARCHAR(50) PRIMARY KEY,
     TaskInstanceId VARCHAR(50),
     UserId VARCHAR(50) NOT NULL,
     Type NVARCHAR(50) NOT NULL,
     Title NVARCHAR(300) NOT NULL,
     Message NVARCHAR(MAX),
     IsRead BIT NOT NULL DEFAULT 0,
     ActionUrl NVARCHAR(500),
     CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
     CONSTRAINT FK_PemsNotif_Instance FOREIGN KEY (TaskInstanceId) REFERENCES PemsTaskInstances(Id)
   )`,

  `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PemsNotif_User' AND object_id = OBJECT_ID('PemsNotifications'))
   CREATE NONCLUSTERED INDEX IX_PemsNotif_User ON PemsNotifications(UserId, IsRead, CreatedAt DESC)`,

  // 5. Scorecards table
  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PemsScorecards')
   CREATE TABLE PemsScorecards (
     Id VARCHAR(50) PRIMARY KEY,
     EntityType NVARCHAR(20) NOT NULL,
     EntityId VARCHAR(50) NOT NULL,
     EntityName NVARCHAR(200),
     Period NVARCHAR(20) NOT NULL,
     TotalTasks INT DEFAULT 0,
     CompletedTasks INT DEFAULT 0,
     RejectedTasks INT DEFAULT 0,
     AvgAchievementPct DECIMAL(7,2) DEFAULT 0,
     AvgVariance DECIMAL(18,2) DEFAULT 0,
     SLACompliancePct DECIMAL(5,2) DEFAULT 0,
     AvgQualityScore DECIMAL(3,2) DEFAULT 0,
     CompletionRatePct DECIMAL(5,2) DEFAULT 0,
     CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
     UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
   )`,

  `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PemsScorecard_Entity' AND object_id = OBJECT_ID('PemsScorecards'))
   CREATE NONCLUSTERED INDEX IX_PemsScorecard_Entity ON PemsScorecards(EntityType, EntityId, Period)`,

  // 6. Indexes for new columns
  `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PemsInstance_Department' AND object_id = OBJECT_ID('PemsTaskInstances'))
   CREATE NONCLUSTERED INDEX IX_PemsInstance_Department ON PemsTaskInstances(Department) INCLUDE (Status, DueDate)`,
];

async function runMigration() {
  const pool = await getPool();
  let success = 0, failed = 0;
  for (let i = 0; i < migrations.length; i++) {
    try {
      await pool.request().query(migrations[i]);
      success++;
      console.log(`  ✅ V2 Migration ${i + 1}/${migrations.length}`);
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('duplicate')) {
        success++;
        console.log(`  ⏭️  V2 Migration ${i + 1} (exists)`);
      } else {
        failed++;
        console.error(`  ❌ V2 Migration ${i + 1}: ${err.message.substring(0, 120)}`);
      }
    }
  }
  console.log(`\nPEMS V2 Migration: ${success} ok, ${failed} failed`);
}

module.exports = { runMigration, migrations };
