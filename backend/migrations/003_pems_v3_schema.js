/**
 * PEMS V3 - Schema Enhancement Migration
 * Adds: Template enhancements, assignment rules, approval levels, weighted progress
 */
const { sql, getPool } = require('../database/db');

const migrations = [
  // 1. Template enhancements
  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PemsTaskTemplates' AND COLUMN_NAME = 'TemplateVersion')
   ALTER TABLE PemsTaskTemplates ADD TemplateVersion INT NOT NULL DEFAULT 1`,

  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PemsTaskTemplates' AND COLUMN_NAME = 'ExecutionComplexity')
   ALTER TABLE PemsTaskTemplates ADD ExecutionComplexity NVARCHAR(20) DEFAULT 'MEDIUM'`,

  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PemsTaskTemplates' AND COLUMN_NAME = 'EstimatedExecutionMinutes')
   ALTER TABLE PemsTaskTemplates ADD EstimatedExecutionMinutes INT DEFAULT 60`,

  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PemsTaskTemplates' AND COLUMN_NAME = 'AutoAssignEnabled')
   ALTER TABLE PemsTaskTemplates ADD AutoAssignEnabled BIT NOT NULL DEFAULT 0`,

  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PemsTaskTemplates' AND COLUMN_NAME = 'ReviewRequired')
   ALTER TABLE PemsTaskTemplates ADD ReviewRequired BIT NOT NULL DEFAULT 1`,

  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PemsTaskTemplates' AND COLUMN_NAME = 'EscalationHours')
   ALTER TABLE PemsTaskTemplates ADD EscalationHours INT DEFAULT 24`,

  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PemsTaskTemplates' AND COLUMN_NAME = 'CriticalityScore')
   ALTER TABLE PemsTaskTemplates ADD CriticalityScore INT DEFAULT 5`,

  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PemsTaskTemplates' AND COLUMN_NAME = 'AutomationEligible')
   ALTER TABLE PemsTaskTemplates ADD AutomationEligible BIT NOT NULL DEFAULT 0`,

  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PemsTaskTemplates' AND COLUMN_NAME = 'TemplateOwnerId')
   ALTER TABLE PemsTaskTemplates ADD TemplateOwnerId VARCHAR(50)`,

  // 2. Assignment Rules
  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PemsAssignmentRules')
   CREATE TABLE PemsAssignmentRules (
     Id VARCHAR(50) PRIMARY KEY,
     TemplateId VARCHAR(50) NOT NULL,
     AssignmentMode NVARCHAR(20) NOT NULL DEFAULT 'manual',
     AutoAssignStrategy NVARCHAR(30) DEFAULT 'lowest_workload',
     ReviewerId VARCHAR(50),
     BackupReviewerId VARCHAR(50),
     EscalationHours INT DEFAULT 24,
     EscalationReviewerId VARCHAR(50),
     ApprovalLevel NVARCHAR(20) DEFAULT 'single',
     QualityScoreRequired BIT NOT NULL DEFAULT 0,
     CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
     CONSTRAINT FK_AssignRule_Template FOREIGN KEY (TemplateId) REFERENCES PemsTaskTemplates(Id)
   )`,

  // 3. Sub Task weightage
  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PemsSubTasks' AND COLUMN_NAME = 'WeightagePct')
   ALTER TABLE PemsSubTasks ADD WeightagePct DECIMAL(5,2) DEFAULT 0`,

  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PemsSubTasks' AND COLUMN_NAME = 'IsMandatory')
   ALTER TABLE PemsSubTasks ADD IsMandatory BIT NOT NULL DEFAULT 1`,

  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PemsSubTasks' AND COLUMN_NAME = 'ReviewRequired')
   ALTER TABLE PemsSubTasks ADD ReviewRequired BIT NOT NULL DEFAULT 0`,

  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PemsSubTasks' AND COLUMN_NAME = 'OwnerType')
   ALTER TABLE PemsSubTasks ADD OwnerType NVARCHAR(50) DEFAULT 'Brand Manager'`,

  // 4. Instance approval level
  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PemsTaskInstances' AND COLUMN_NAME = 'ApprovalLevel')
   ALTER TABLE PemsTaskInstances ADD ApprovalLevel NVARCHAR(20) DEFAULT 'single'`,

  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PemsTaskInstances' AND COLUMN_NAME = 'BackupReviewerId')
   ALTER TABLE PemsTaskInstances ADD BackupReviewerId VARCHAR(50)`,

  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PemsTaskInstances' AND COLUMN_NAME = 'ApproverCount')
   ALTER TABLE PemsTaskInstances ADD ApproverCount INT DEFAULT 0`,

  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PemsTaskInstances' AND COLUMN_NAME = 'RequiredApprovals')
   ALTER TABLE PemsTaskInstances ADD RequiredApprovals INT DEFAULT 1`,

  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PemsTaskInstances' AND COLUMN_NAME = 'WeightedProgressPct')
   ALTER TABLE PemsTaskInstances ADD WeightedProgressPct DECIMAL(5,2) DEFAULT 0`,
];

async function runMigration() {
  const pool = await getPool();
  let success = 0, failed = 0;
  for (let i = 0; i < migrations.length; i++) {
    try {
      await pool.request().query(migrations[i]);
      success++;
      console.log(`  ✅ V3 Migration ${i + 1}/${migrations.length}`);
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('duplicate')) {
        success++;
        console.log(`  ⏭️  V3 Migration ${i + 1} (exists)`);
      } else {
        failed++;
        console.error(`  ❌ V3 Migration ${i + 1}: ${err.message.substring(0, 120)}`);
      }
    }
  }
  console.log(`\nPEMS V3 Migration: ${success} ok, ${failed} failed`);
}

module.exports = { runMigration, migrations };
