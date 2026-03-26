const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');
const fileController = require('../controllers/fileController');

/* ── Per-user upload directory ────────────────────────────────────── */
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', 'uploads', 'files', String(req.userId));
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
        const ext = path.extname(file.originalname);
        cb(null, `${unique}${ext}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB per file
});

/* ── Routes ─────────────────────────────────────────────────────── */
router.post('/upload', authenticate, upload.array('files', 20), fileController.uploadFiles);
router.get('/', authenticate, fileController.listFiles);
router.get('/asin-folders', authenticate, fileController.listAsinFolders);
router.get('/asin-folders/:asin', authenticate, fileController.getAsinFiles);
router.patch('/:id/star', authenticate, fileController.toggleStar);
router.patch('/:id/trash', authenticate, fileController.trashFile);
router.patch('/:id/rename', authenticate, fileController.renameFile);
router.delete('/:id', authenticate, fileController.deleteFile);

module.exports = router;
