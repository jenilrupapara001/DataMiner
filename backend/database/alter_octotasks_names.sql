-- Alter OctoTasks to include TaskName and GroupName
IF COL_LENGTH('dbo.OctoTasks', 'TaskName') IS NULL
ALTER TABLE OctoTasks ADD TaskName NVARCHAR(255);

IF COL_LENGTH('dbo.OctoTasks', 'GroupName') IS NULL
ALTER TABLE OctoTasks ADD GroupName NVARCHAR(255);
