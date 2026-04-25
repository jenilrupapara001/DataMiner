const { sql, getPool, generateId } = require('../database/db');
const path = require('path');
const fs = require('fs');

/* helper – pretty file size */
const fmtSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/* ── Upload one or more files ────────────────────────────────────── */
exports.uploadFiles = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: 'No files uploaded' });
        }
        const folder = (req.body.folder || '').trim();
        const userId = req.user.Id || req.user._id;
        const baseUploadDir = path.join(__dirname, '..', 'uploads');

        const pool = await getPool();
        const savedFiles = [];

        for (const f of req.files) {
            const fileId = generateId();
            const userDir = path.join('uploads', 'files', userId);
            const fullPath = path.join(baseUploadDir, userDir, f.filename);

            // Ensure directory exists
            await fs.promises.mkdir(path.join(baseUploadDir, userDir), { recursive: true });

            await pool.request()
                .input('Id', sql.VarChar, fileId)
                .input('FileName', sql.NVarChar, f.filename)
                .input('OriginalName', sql.NVarChar, f.originalname)
                .input('FilePath', sql.NVarChar, path.join(userDir, f.filename))
                .input('FileSize', sql.Int, f.size)
                .input('MimeType', sql.NVarChar, f.mimetype)
                .input('UploadedBy', sql.VarChar, userId)
                .input('Folder', sql.NVarChar, folder || null)
                .input('Starred', sql.Bit, 0)
                .input('Trashed', sql.Bit, 0)
                .input('StorageProvider', sql.NVarChar, 'local')
                .query(`
                    INSERT INTO Files (Id, FileName, OriginalName, FilePath, FileSize, MimeType, UploadedBy, Folder, Starred, Trashed, StorageProvider, CreatedAt)
                    VALUES (@Id, @FileName, @OriginalName, @FilePath, @FileSize, @MimeType, @UploadedBy, @Folder, @Starred, @Trashed, @StorageProvider, GETDATE())
                `);

            savedFiles.push({
                _id: fileId,
                owner: userId,
                originalName: f.originalname,
                storedName: f.filename,
                mimeType: f.mimetype,
                size: f.size,
                path: path.join(userDir, f.filename),
                folder,
                starred: false,
                trashed: false,
                createdAt: new Date()
            });
        }

        res.status(201).json({ success: true, files: savedFiles });
    } catch (error) {
        console.error('uploadFiles error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/* ── List user's files ───────────────────────────────────────────── */
exports.listFiles = async (req, res) => {
    try {
        const userId = req.user.Id || req.user._id;
        const { folder = '', starred, trashed = 'false' } = req.query;
        const pool = await getPool();

        let whereClause = "WHERE UploadedBy = @userId AND Trashed = @trashed";
        const request = pool.request()
            .input('userId', sql.VarChar, userId)
            .input('trashed', sql.Bit, trashed === 'true' ? 1 : 0);

        if (folder) {
            whereClause += " AND Folder = @folder";
            request.input('folder', sql.NVarChar, folder);
        }
        if (starred === 'true') {
            whereClause += " AND Starred = 1";
        }

        const filesResult = await request.query(`
            SELECT * FROM Files ${whereClause} ORDER BY CreatedAt DESC
        `);

        const files = filesResult.recordset.map(f => ({
            ...f,
            url: `${req.protocol}://${req.get('host')}/${f.FilePath}`,
            sizeLabel: fmtSize(f.FileSize || 0)
        }));

        // Storage usage
        const usageResult = await pool.request()
            .input('userId', sql.VarChar, userId)
            .input('trashed', sql.Bit, 0)
            .query(`
                SELECT SUM(FileSize) as usedBytes FROM Files
                WHERE UploadedBy = @userId AND Trashed = @trashed
            `);
        const usedBytes = usageResult.recordset[0]?.usedBytes || 0;

        res.json({
            success: true,
            files,
            storage: {
                usedBytes,
                usedLabel: fmtSize(usedBytes),
                limitBytes: 5 * 1024 * 1024 * 1024,
                limitLabel: '5 GB',
                percent: Math.round((usedBytes / (5 * 1024 * 1024 * 1024)) * 100),
            },
        });
    } catch (error) {
        console.error('listFiles error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/* ── Toggle star ─────────────────────────────────────────────────── */
exports.toggleStar = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.Id || req.user._id;
        const pool = await getPool();

        const result = await pool.request()
            .input('id', sql.VarChar, id)
            .input('userId', sql.VarChar, userId)
            .query(`
                UPDATE Files SET Starred = ~Starred WHERE Id = @id AND UploadedBy = @userId;
                SELECT * FROM Files WHERE Id = @id;
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'File not found' });
        }

        const file = result.recordset[0];
        res.json({ success: true, starred: Boolean(file.Starred) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/* ── Move to / restore from trash ───────────────────────────────── */
exports.trashFile = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.Id || req.user._id;
        const pool = await getPool();

        const result = await pool.request()
            .input('id', sql.VarChar, id)
            .input('userId', sql.VarChar, userId)
            .query(`
                UPDATE Files 
                SET Trashed = ~Trashed, 
                    TrashedAt = CASE WHEN Trashed = 1 THEN NULL ELSE GETDATE() END
                WHERE Id = @id AND UploadedBy = @userId;
                SELECT * FROM Files WHERE Id = @id;
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'File not found' });
        }

        const file = result.recordset[0];
        res.json({ success: true, trashed: Boolean(file.Trashed) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/* ── Permanent delete ────────────────────────────────────────────── */
exports.deleteFile = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.Id || req.user._id;
        const pool = await getPool();

        // First get file info
        const fileResult = await pool.request()
            .input('id', sql.VarChar, id)
            .input('userId', sql.VarChar, userId)
            .query("SELECT * FROM Files WHERE Id = @id AND UploadedBy = @userId");

        if (fileResult.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'File not found' });
        }

        const file = fileResult.recordset[0];

        // Delete from disk
        const diskPath = path.join(__dirname, '..', file.FilePath);
        if (fs.existsSync(diskPath)) {
            fs.unlinkSync(diskPath);
        }

        // Delete from DB
        await pool.request()
            .input('id', sql.VarChar, id)
            .query("DELETE FROM Files WHERE Id = @id");

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/* ── Rename ──────────────────────────────────────────────────────── */
exports.renameFile = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Name required' });

        const userId = req.user.Id || req.user._id;
        const pool = await getPool();

        const result = await pool.request()
            .input('id', sql.VarChar, id)
            .input('userId', sql.VarChar, userId)
            .input('name', sql.NVarChar, name)
            .query(`
                UPDATE Files 
                SET OriginalName = @name 
                WHERE Id = @id AND UploadedBy = @userId;
                SELECT * FROM Files WHERE Id = @id;
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'File not found' });
        }

        res.json({ success: true, file: result.recordset[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/* ── ASIN Folders (filesystem-based - unchanged) ─────────────────── */
exports.listAsinFolders = async (req, res) => {
    try {
        const baseDir = path.join(__dirname, '..', 'uploads', 'asin_images');
        if (!fs.existsSync(baseDir)) {
            return res.json({ success: true, folders: [] });
        }

        const items = fs.readdirSync(baseDir, { withFileTypes: true });
        const folders = items
            .filter(item => item.isDirectory())
            .map(item => {
                const folderPath = path.join(baseDir, item.name);
                const files = fs.readdirSync(folderPath).filter(f => !f.startsWith('.'));
                return {
                    id: item.name,
                    name: item.name,
                    type: 'folder',
                    count: files.length,
                    thumbnail: files.length > 0 ? `${req.protocol}://${req.get('host')}/uploads/asin_images/${item.name}/${files[0]}` : null
                };
            });

        res.json({ success: true, folders });
    } catch (error) {
        console.error('listAsinFolders error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/* ── Files in ASIN folder ───────────────────────────────────────── */
exports.getAsinFiles = async (req, res) => {
    try {
        const { asin } = req.params;
        const baseDir = path.join(__dirname, '..', 'uploads', 'asin_images', asin);

        if (!fs.existsSync(baseDir)) {
            return res.status(404).json({ success: false, message: 'ASIN folder not found' });
        }

        const files = fs.readdirSync(baseDir)
            .filter(f => !f.startsWith('.'))
            .map(f => {
                const stats = fs.statSync(path.join(baseDir, f));
                return {
                    _id: `${asin}_${f}`,
                    originalName: f,
                    size: stats.size,
                    sizeLabel: fmtSize(stats.size),
                    mimeType: 'image/png',
                    url: `${req.protocol}://${req.get('host')}/uploads/asin_images/${asin}/${f}`,
                    createdAt: stats.birthtime,
                    type: 'image'
                };
            });

        res.json({ success: true, files });
    } catch (error) {
        console.error('getAsinFiles error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
