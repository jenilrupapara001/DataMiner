const File = require('../models/File');
const path = require('path');
const fs = require('fs');

/* helper — pretty file size */
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
        const userId = req.userId;

        const docs = req.files.map(f => ({
            owner: userId,
            originalName: f.originalname,
            storedName: f.filename,
            mimeType: f.mimetype,
            size: f.size,
            path: `uploads/files/${userId}/${f.filename}`,
            folder,
        }));

        const saved = await File.insertMany(docs);
        return res.status(201).json({ success: true, files: saved });
    } catch (err) {
        console.error('uploadFiles error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/* ── List user's files ───────────────────────────────────────────── */
exports.listFiles = async (req, res) => {
    try {
        const userId = req.userId;
        const { folder = '', starred, trashed = 'false' } = req.query;

        const filter = { owner: userId, trashed: trashed === 'true' };
        if (folder) filter.folder = folder;
        if (starred === 'true') filter.starred = true;

        const files = await File.find(filter).sort({ createdAt: -1 }).lean();

        // Compute storage usage
        const usage = await File.aggregate([
            { $match: { owner: userId, trashed: false } },
            { $group: { _id: null, total: { $sum: '$size' } } },
        ]);
        const usedBytes = usage[0]?.total || 0;

        return res.json({
            success: true,
            files: files.map(f => ({
                ...f,
                sizeLabel: fmtSize(f.size),
                url: `${req.protocol}://${req.get('host')}/${f.path}`,
            })),
            storage: {
                usedBytes,
                usedLabel: fmtSize(usedBytes),
                limitBytes: 5 * 1024 * 1024 * 1024, // 5 GB per user
                limitLabel: '5 GB',
                percent: Math.round((usedBytes / (5 * 1024 * 1024 * 1024)) * 100),
            },
        });
    } catch (err) {
        console.error('listFiles error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/* ── Toggle star ─────────────────────────────────────────────────── */
exports.toggleStar = async (req, res) => {
    try {
        const file = await File.findOne({ _id: req.params.id, owner: req.userId });
        if (!file) return res.status(404).json({ success: false, message: 'File not found' });
        file.starred = !file.starred;
        await file.save();
        return res.json({ success: true, starred: file.starred });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/* ── Move to / restore from trash ───────────────────────────────── */
exports.trashFile = async (req, res) => {
    try {
        const file = await File.findOne({ _id: req.params.id, owner: req.userId });
        if (!file) return res.status(404).json({ success: false, message: 'File not found' });
        file.trashed = !file.trashed;
        file.trashedAt = file.trashed ? new Date() : undefined;
        await file.save();
        return res.json({ success: true, trashed: file.trashed });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/* ── Permanent delete ────────────────────────────────────────────── */
exports.deleteFile = async (req, res) => {
    try {
        const file = await File.findOne({ _id: req.params.id, owner: req.userId });
        if (!file) return res.status(404).json({ success: false, message: 'File not found' });

        // Remove from disk
        const diskPath = path.join(__dirname, '..', file.path);
        if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);

        await file.deleteOne();
        return res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/* ── Rename ──────────────────────────────────────────────────────── */
exports.renameFile = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Name required' });
        const file = await File.findOneAndUpdate(
            { _id: req.params.id, owner: req.userId },
            { originalName: name },
            { new: true }
        );
        if (!file) return res.status(404).json({ success: false, message: 'File not found' });
        return res.json({ success: true, file });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/* ── List ASIN folders ─────────────────────────────────────────── */
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
                    // Use first image as thumbnail if available
                    thumbnail: files.length > 0 ? `${req.protocol}://${req.get('host')}/uploads/asin_images/${item.name}/${files[0]}` : null
                };
            });

        return res.json({ success: true, folders });
    } catch (err) {
        console.error('listAsinFolders error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/* ── List files in a specific ASIN folder ──────────────────────── */
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
                    mimeType: 'image/png', // Mostly PNGs from SD3
                    url: `${req.protocol}://${req.get('host')}/uploads/asin_images/${asin}/${f}`,
                    createdAt: stats.birthtime,
                    type: 'image'
                };
            });

        return res.json({ success: true, files });
    } catch (err) {
        console.error('getAsinFiles error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};
