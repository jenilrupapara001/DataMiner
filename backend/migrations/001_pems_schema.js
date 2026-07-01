/**
 * PEMS Phase 1 - Database Schema Migration (SQL Server compatible)
 */
const { sql, getPool } = require('../database/db');

const migrations = [
  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PemsTaskTemplates')
  CREATE TABLE PemsTaskTemplates (
    Id VARCHAR(50) PRIMARY KEY,
    TaskCode VARCHAR(20) UNIQUE NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX),
    Category NVARCHAR(50) NOT NULL DEFAULT 'GENERAL',
    Department NVARCHAR(50) DEFAULT 'OPERATIONS',
    Frequency NVARCHAR(20) NOT NULL DEFAULT 'ONE_TIME',
    CustomCron NVARCHAR(100),
    SLAHours INT DEFAULT 48,
    TATHours INT DEFAULT 24,
    Priority NVARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    TargetType NVARCHAR(20) NOT NULL DEFAULT 'NUMERIC',
    DefaultTarget DECIMAL(18,2) DEFAULT 0,
    ExpectedOutput NVARCHAR(500),
    ReviewerId VARCHAR(50),
    AssigneeRole NVARCHAR(50) DEFAULT 'brand_manager',
    Activities NVARCHAR(MAX),
    SubTaskDefinitions NVARCHAR(MAX),
    Tags NVARCHAR(MAX),
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedBy VARCHAR(50),
    CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
  )`,

  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PemsTaskInstances')
  CREATE TABLE PemsTaskInstances (
    Id VARCHAR(50) PRIMARY KEY,
    InstanceCode VARCHAR(30) UNIQUE NOT NULL,
    TemplateId VARCHAR(50) NOT NULL,
    SellerId VARCHAR(50),
    SellerName NVARCHAR(200),
    AssignedTo VARCHAR(50),
    AssigneeName NVARCHAR(200),
    ReviewerId VARCHAR(50),
    ReviewerName NVARCHAR(200),
    Status NVARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    ReviewStatus NVARCHAR(30) NOT NULL DEFAULT 'NOT_REVIEWED',
    Frequency NVARCHAR(20) NOT NULL DEFAULT 'ONE_TIME',
    Title NVARCHAR(500),
    Description NVARCHAR(MAX),
    Priority NVARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    Target DECIMAL(18,2) DEFAULT 0,
    Achievement DECIMAL(18,2) DEFAULT 0,
    AchievementPct DECIMAL(7,2) DEFAULT 0,
    Variance DECIMAL(18,2) DEFAULT 0,
    SLAStatus NVARCHAR(20) NOT NULL DEFAULT 'WITHIN_SLA',
    SLAHours INT DEFAULT 48,
    DueDate DATETIME2,
    AssignedAt DATETIME2,
    AcceptedAt DATETIME2,
    StartedAt DATETIME2,
    SubmittedAt DATETIME2,
    ReviewedAt DATETIME2,
    CompletedAt DATETIME2,
    ReworkCount INT DEFAULT 0,
    SubmissionRemarks NVARCHAR(MAX),
    ReviewRemarks NVARCHAR(MAX),
    Tags NVARCHAR(MAX),
    Attachments NVARCHAR(MAX),
    CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
    CONSTRAINT FK_PemsInstance_Template FOREIGN KEY (TemplateId) REFERENCES PemsTaskTemplates(Id)
  )`,

  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PemsSubTasks')
  CREATE TABLE PemsSubTasks (
    Id VARCHAR(50) PRIMARY KEY,
    TaskInstanceId VARCHAR(50) NOT NULL,
    SubTaskCode VARCHAR(30) NOT NULL,
    Title NVARCHAR(300) NOT NULL,
    Description NVARCHAR(MAX),
    Status NVARCHAR(30) NOT NULL DEFAULT 'PENDING',
    ExpectedOutput NVARCHAR(500),
    SortOrder INT DEFAULT 0,
    IsCompleted BIT NOT NULL DEFAULT 0,
    CompletedAt DATETIME2,
    CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
    CONSTRAINT FK_PemsSubTask_Instance FOREIGN KEY (TaskInstanceId) REFERENCES PemsTaskInstances(Id) ON DELETE CASCADE
  )`,

  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PemsActivities')
  CREATE TABLE PemsActivities (
    Id VARCHAR(50) PRIMARY KEY,
    SubTaskId VARCHAR(50) NOT NULL,
    TaskInstanceId VARCHAR(50) NOT NULL,
    StepNo INT NOT NULL DEFAULT 1,
    Title NVARCHAR(300) NOT NULL,
    Instructions NVARCHAR(MAX),
    ExpectedOutput NVARCHAR(500),
    SupportDocuments NVARCHAR(MAX),
    IsMandatory BIT NOT NULL DEFAULT 1,
    IsCompleted BIT NOT NULL DEFAULT 0,
    CompletedAt DATETIME2,
    CompletedBy VARCHAR(50),
    CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
    CONSTRAINT FK_PemsActivity_SubTask FOREIGN KEY (SubTaskId) REFERENCES PemsSubTasks(Id) ON DELETE CASCADE,
    CONSTRAINT FK_PemsActivity_Instance FOREIGN KEY (TaskInstanceId) REFERENCES PemsTaskInstances(Id) ON DELETE CASCADE
  )`,

  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PemsEvidence')
  CREATE TABLE PemsEvidence (
    Id VARCHAR(50) PRIMARY KEY,
    TaskInstanceId VARCHAR(50) NOT NULL,
    SubTaskId VARCHAR(50),
    ActivityId VARCHAR(50),
    FileName NVARCHAR(500) NOT NULL,
    FileUrl NVARCHAR(1000) NOT NULL,
    FileType NVARCHAR(20) NOT NULL DEFAULT 'FILE',
    FileSize BIGINT DEFAULT 0,
    MimeType NVARCHAR(100),
    Remarks NVARCHAR(MAX),
    UploadedBy VARCHAR(50) NOT NULL,
    UploadedByName NVARCHAR(200),
    UploadedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
    CONSTRAINT FK_PemsEvidence_Instance FOREIGN KEY (TaskInstanceId) REFERENCES PemsTaskInstances(Id) ON DELETE CASCADE
  )`,

  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PemsTaskReviews')
  CREATE TABLE PemsTaskReviews (
    Id VARCHAR(50) PRIMARY KEY,
    TaskInstanceId VARCHAR(50) NOT NULL,
    ReviewerId VARCHAR(50) NOT NULL,
    ReviewerName NVARCHAR(200),
    Decision NVARCHAR(20) NOT NULL,
    QualityScore INT,
    Feedback NVARCHAR(MAX),
    ReviewChecklist NVARCHAR(MAX),
    ReviewDurationMinutes INT,
    CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
    CONSTRAINT FK_PemsReview_Instance FOREIGN KEY (TaskInstanceId) REFERENCES PemsTaskInstances(Id) ON DELETE CASCADE
  )`,

  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PemsTaskAuditLogs')
  CREATE TABLE PemsTaskAuditLogs (
    Id VARCHAR(50) PRIMARY KEY,
    TaskInstanceId VARCHAR(50) NOT NULL,
    Action NVARCHAR(50) NOT NULL,
    FromStatus NVARCHAR(30),
    ToStatus NVARCHAR(30),
    ActorId VARCHAR(50),
    ActorName NVARCHAR(200),
    ActorRole NVARCHAR(50),
    Details NVARCHAR(MAX),
    Metadata NVARCHAR(MAX),
    CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
    CONSTRAINT FK_PemsAudit_Instance FOREIGN KEY (TaskInstanceId) REFERENCES PemsTaskInstances(Id) ON DELETE CASCADE
  )`,

  // Indexes
  `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PemsInstance_Status' AND object_id = OBJECT_ID('PemsTaskInstances'))
   CREATE NONCLUSTERED INDEX IX_PemsInstance_Status ON PemsTaskInstances(Status) INCLUDE (SellerId, AssignedTo, DueDate)`,
  `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PemsInstance_Seller' AND object_id = OBJECT_ID('PemsTaskInstances'))
   CREATE NONCLUSTERED INDEX IX_PemsInstance_Seller ON PemsTaskInstances(SellerId) INCLUDE (Status, DueDate)`,
  `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PemsInstance_AssignedTo' AND object_id = OBJECT_ID('PemsTaskInstances'))
   CREATE NONCLUSTERED INDEX IX_PemsInstance_AssignedTo ON PemsTaskInstances(AssignedTo) INCLUDE (Status, DueDate)`,
  `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PemsInstance_Reviewer' AND object_id = OBJECT_ID('PemsTaskInstances'))
   CREATE NONCLUSTERED INDEX IX_PemsInstance_Reviewer ON PemsTaskInstances(ReviewerId) INCLUDE (Status, ReviewStatus)`,
  `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PemsInstance_DueDate' AND object_id = OBJECT_ID('PemsTaskInstances'))
   CREATE NONCLUSTERED INDEX IX_PemsInstance_DueDate ON PemsTaskInstances(DueDate) INCLUDE (Status, SLAStatus)`,
  `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PemsInstance_Template' AND object_id = OBJECT_ID('PemsTaskInstances'))
   CREATE NONCLUSTERED INDEX IX_PemsInstance_Template ON PemsTaskInstances(TemplateId)`,
  `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PemsSubTask_Instance' AND object_id = OBJECT_ID('PemsSubTasks'))
   CREATE NONCLUSTERED INDEX IX_PemsSubTask_Instance ON PemsSubTasks(TaskInstanceId)`,
  `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PemsActivity_Instance' AND object_id = OBJECT_ID('PemsActivities'))
   CREATE NONCLUSTERED INDEX IX_PemsActivity_Instance ON PemsActivities(TaskInstanceId)`,
  `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PemsEvidence_Instance' AND object_id = OBJECT_ID('PemsEvidence'))
   CREATE NONCLUSTERED INDEX IX_PemsEvidence_Instance ON PemsEvidence(TaskInstanceId)`,
  `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PemsReview_Instance' AND object_id = OBJECT_ID('PemsTaskReviews'))
   CREATE NONCLUSTERED INDEX IX_PemsReview_Instance ON PemsTaskReviews(TaskInstanceId)`,
  `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PemsAudit_Instance' AND object_id = OBJECT_ID('PemsTaskAuditLogs'))
   CREATE NONCLUSTERED INDEX IX_PemsAudit_Instance ON PemsTaskAuditLogs(TaskInstanceId)`,
  `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PemsAudit_CreatedAt' AND object_id = OBJECT_ID('PemsTaskAuditLogs'))
   CREATE NONCLUSTERED INDEX IX_PemsAudit_CreatedAt ON PemsTaskAuditLogs(CreatedAt)`,
];

async function runMigration() {
  const pool = await getPool();
  let success = 0, failed = 0;
  for (let i = 0; i < migrations.length; i++) {
    try {
      await pool.request().query(migrations[i]);
      success++;
      console.log(`  ✅ Migration ${i + 1}/${migrations.length}`);
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('There is already') || err.message.includes('duplicate')) {
        success++;
        console.log(`  ⏭️  Migration ${i + 1}/${migrations.length} (exists)`);
      } else {
        failed++;
        console.error(`  ❌ Migration ${i + 1}: ${err.message.substring(0, 120)}`);
      }
    }
  }
  console.log(`\nPEMS Migration: ${success} ok, ${failed} failed`);
}

module.exports = { runMigration, migrations };
