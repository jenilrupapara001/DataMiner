import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Upload, Star, Trash2, RotateCcw, Search, Grid, List,
    FolderOpen, File, FileText, FileImage, FileVideo, FileAudio,
    FileArchive, ChevronRight, ChevronLeft, MoreVertical, Download, Pencil,
    X, Check, RefreshCw, Image
} from 'lucide-react';
import api from '../services/api';
import EmptyState from '../components/common/EmptyState';

/* ── File-type helpers ────────────────────────────────────────────── */
const EXT_MAP = {
    // Images
    jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', svg: 'image', webp: 'image',
    // Video
    mp4: 'video', mov: 'video', avi: 'video', mkv: 'video',
    // Audio
    mp3: 'audio', wav: 'audio', ogg: 'audio',
    // Docs
    pdf: 'pdf', doc: 'doc', docx: 'doc', xls: 'xls', xlsx: 'xls',
    ppt: 'ppt', pptx: 'ppt', txt: 'text', md: 'text',
    // Archives
    zip: 'archive', rar: 'archive', gz: 'archive', tar: 'archive',
};

const TYPE_COLORS = {
    image: '#6366F1', video: '#EC4899', audio: '#F59E0B',
    pdf: '#EF4444', doc: '#2563EB', xls: '#16A34A', ppt: '#F97316',
    text: '#64748B', archive: '#92400E', folder: '#FBBF24', default: '#94A3B8',
};

const getFileType = (name = '') => {
    const ext = name.split('.').pop()?.toLowerCase();
    return EXT_MAP[ext] || 'default';
};

const FileIcon = ({ name, size = 40, url, mime }) => {
    const type = getFileType(name);
    const color = TYPE_COLORS[type] || TYPE_COLORS.default;
    const isImage = type === 'image';

    if (isImage && url) {
        return (
            <img src={url} alt={name}
                style={{ width: size, height: size, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                onError={e => { e.target.style.display = 'none'; }}
            />
        );
    }

    const icons = {
        image: FileImage, video: FileVideo, audio: FileAudio,
        archive: FileArchive, text: FileText, folder: FolderOpen,
    };
    const Icon = icons[type] || File;
    return <Icon size={size * 0.6} color={color} style={{ flexShrink: 0 }} />;
};

/* ── Storage bar ──────────────────────────────────────────────────── */
const StorageBar = ({ storage }) => {
    if (!storage) return null;
    return (
        <div style={{ padding: '1rem' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Storage</div>
            <div style={{ height: 6, background: '#E2E8F0', borderRadius: 99, overflow: 'hidden', marginBottom: 4 }}>
                <div style={{
                    height: '100%', borderRadius: 99,
                    width: `${Math.min(storage.percent, 100)}%`,
                    background: storage.percent > 80 ? '#EF4444' : '#18181B',
                    transition: 'width 400ms',
                }} />
            </div>
            <div style={{ fontSize: 11, color: '#64748B' }}>
                {storage.usedLabel} of {storage.limitLabel} used
            </div>
        </div>
    );
};

/* ── Rename modal ─────────────────────────────────────────────────── */
const RenameModal = ({ file, onClose, onSave }) => {
    const [name, setName] = useState(file.originalName);
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
            <div style={{ background: '#fff', borderRadius: 14, padding: '1.5rem', width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>Rename File</span>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}><X size={18} /></button>
                </div>
                <input
                    autoFocus value={name} onChange={e => setName(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.55rem 0.8rem', borderRadius: 8, border: '1.5px solid #E4E4E7', fontSize: 14, color: '#18181B', outline: 'none' }}
                    onFocus={e => e.target.style.borderColor = '#18181B'}
                    onBlur={e => e.target.style.borderColor = '#E4E4E7'}
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <button onClick={onClose} style={{ padding: '0.5rem 1rem', borderRadius: 8, border: '1.5px solid #E4E4E7', background: '#F8FAFC', fontWeight: 600, fontSize: 13, cursor: 'pointer', color: '#71717A' }}>Cancel</button>
                    <button onClick={() => name.trim() && onSave(name.trim())} disabled={!name.trim()}
                        style={{ padding: '0.5rem 1.1rem', borderRadius: 8, border: 'none', background: '#18181B', fontWeight: 600, fontSize: 13, cursor: 'pointer', color: '#fff', opacity: name.trim() ? 1 : 0.5 }}>
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ── Context menu ─────────────────────────────────────────────────── */
const ContextMenu = ({ file, pos, onClose, actions }) => (
    <div style={{
        position: 'fixed', top: pos.y, left: pos.x, zIndex: 1500,
        background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0',
        boxShadow: '0 8px 32px rgba(0,0,0,0.15)', minWidth: 160, overflow: 'hidden',
    }}>
        {actions.map(a => (
            <button key={a.label} onClick={() => { a.fn(file); onClose(); }}
                style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '0.6rem 1rem', border: 'none',
                    background: 'none', cursor: 'pointer', fontSize: 13,
                    color: a.danger ? '#EF4444' : '#1e293b', textAlign: 'left',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
                {a.icon} {a.label}
            </button>
        ))}
    </div>
);

/* ── Main Page ────────────────────────────────────────────────────── */
const FileManagerPage = () => {
    const [files, setFiles] = useState([]);
    const [storage, setStorage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('grid');           // 'grid' | 'list'
    const [section, setSection] = useState('all');     // 'all' | 'starred' | 'trash' | 'asin-folders'
    const [currentAsin, setCurrentAsin] = useState(null); // drilling into ASIN folder
    const [search, setSearch] = useState('');
    const [uploading, setUploading] = useState(false);
    const [renameFile, setRenameFile] = useState(null);
    const [ctxFile, setCtxFile] = useState(null);
    const [ctxPos, setCtxPos] = useState({ x: 0, y: 0 });
    const fileInputRef = useRef();

    const fetchFiles = useCallback(async () => {
        setLoading(true);
        try {
            if (section === 'asin-folders') {
                if (currentAsin) {
                    const data = await api.get(`/files/asin-folders/${currentAsin}`);
                    setFiles(data.files || []);
                } else {
                    const data = await api.get('/files/asin-folders');
                    setFiles(data.folders || []);
                }
                setStorage(null); // No storage limit for ASIN assets yet
            } else {
                const params = {};
                if (section === 'starred') params.starred = 'true';
                if (section === 'trash') params.trashed = 'true';
                const data = await api.get('/files', params);
                setFiles(data.files || []);
                setStorage(data.storage || null);
            }
        } catch (e) {
            console.error('fetchFiles error:', e);
            setFiles([]);
        } finally {
            setLoading(false);
        }
    }, [section, currentAsin]);

    useEffect(() => { fetchFiles(); }, [fetchFiles]);

    /* close context menu on outside click */
    useEffect(() => {
        const handler = () => setCtxFile(null);
        window.addEventListener('click', handler);
        return () => window.removeEventListener('click', handler);
    }, []);

    const handleUpload = async (e) => {
        const selectedFiles = Array.from(e.target.files);
        if (!selectedFiles.length) return;
        setUploading(true);
        try {
            const form = new FormData();
            selectedFiles.forEach(f => form.append('files', f));
            // Use raw fetch — api.post forces JSON which breaks multipart
            const token = localStorage.getItem('authToken');
            const res = await fetch(
                `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/files/upload`,
                { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form }
            );
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || res.statusText);
            }
            await fetchFiles();
        } catch (err) {
            alert('Upload failed: ' + err.message);
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const toggleStar = async (file) => {
        await api.patch(`/files/${file._id}/star`);
        fetchFiles();
    };
    const trashFile = async (file) => {
        await api.patch(`/files/${file._id}/trash`);
        fetchFiles();
    };
    const restoreFile = async (file) => {
        await api.patch(`/files/${file._id}/trash`);
        fetchFiles();
    };
    const deleteFile = async (file) => {
        if (!window.confirm('Permanently delete this file? This cannot be undone.')) return;
        await api.delete(`/files/${file._id}`);
        fetchFiles();
    };
    const renameFileSave = async (name) => {
        await api.patch(`/files/${renameFile._id}/rename`, { name });
        setRenameFile(null);
        fetchFiles();
    };

    const openCtx = (e, file) => {
        e.preventDefault();
        e.stopPropagation();
        setCtxFile(file);
        setCtxPos({ x: e.clientX, y: e.clientY });
    };

    /* Filter */
    const filtered = files.filter(f =>
        f.originalName.toLowerCase().includes(search.toLowerCase())
    );

    /* Context menu actions */
    const ctxActions = section !== 'trash' ? [
        { label: 'Rename', icon: <Pencil size={14} />, fn: (f) => setRenameFile(f) },
        { label: f => f.starred ? 'Unstar' : 'Star', icon: <Star size={14} />, fn: toggleStar },
        { label: 'Download', icon: <Download size={14} />, fn: (f) => window.open(f.url) },
        { label: 'Move to Trash', icon: <Trash2 size={14} />, fn: trashFile, danger: true },
    ] : [
        { label: 'Restore', icon: <RotateCcw size={14} />, fn: restoreFile },
        { label: 'Delete forever', icon: <Trash2 size={14} />, fn: deleteFile, danger: true },
    ];

    const resolvedCtxActions = ctxFile ? ctxActions.map(a => ({
        ...a, label: typeof a.label === 'function' ? a.label(ctxFile) : a.label
    })) : [];

    /* Nav items */
    const navItems = [
        { id: 'all', label: 'All Files', icon: <FolderOpen size={16} /> },
        { id: 'asin-folders', label: 'Marketplace', icon: <Image size={16} /> },
        { id: 'starred', label: 'Starred', icon: <Star size={16} /> },
        { id: 'trash', label: 'Trash', icon: <Trash2 size={16} /> },
    ];

    return (
        <div style={{ display: 'flex', height: 'calc(100vh - 73px)', overflow: 'hidden', margin: '-1.5rem -2rem', background: '#FFFFFF' }}>

            {/* ── Left sidebar ─────────────────────────────────────── */}
            <div style={{
                width: 200, flexShrink: 0, background: '#fff',
                borderRight: '1px solid #E2E8F0',
                display: 'flex', flexDirection: 'column', padding: '1.25rem 0 0',
            }}>
                <div style={{ padding: '0 1rem 1rem', fontWeight: 800, fontSize: '1rem', color: '#0f172a', letterSpacing: '-0.02em' }}>
                    File Manager
                </div>

                {/* Upload button */}
                <div style={{ padding: '0 1rem 1rem' }}>
                    <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleUpload} />
                    <button onClick={() => fileInputRef.current.click()} disabled={uploading}
                        style={{
                            width: '100%', padding: '0.65rem', borderRadius: 9,
                            background: '#18181B', color: '#fff', border: 'none',
                            fontWeight: 700, fontSize: 13, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            opacity: uploading ? 0.7 : 1,
                            transition: 'all 200ms'
                        }}>
                        <Upload size={14} /> {uploading ? 'Uploading…' : 'Upload'}
                    </button>
                </div>

                {/* Nav */}
                <nav style={{ flex: 1, padding: '0 0.5rem' }}>
                    {navItems.map(item => (
                        <button key={item.id} onClick={() => { setSection(item.id); setCurrentAsin(null); }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                width: '100%', padding: '0.6rem 0.75rem', borderRadius: 8,
                                border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 600,
                                background: section === item.id ? '#F4F4F5' : 'none',
                                color: section === item.id ? '#18181B' : '#71717A',
                                transition: 'background 150ms',
                            }}
                            onMouseEnter={e => { if (section !== item.id) e.currentTarget.style.background = '#FAFAFA'; }}
                            onMouseLeave={e => { if (section !== item.id) e.currentTarget.style.background = 'none'; }}
                        >
                            {item.icon} {item.label}
                        </button>
                    ))}
                </nav>

                <StorageBar storage={storage} />
            </div>

            {/* ── Main area ────────────────────────────────────────── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* Toolbar */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '0.85rem 1.5rem', background: '#fff',
                    borderBottom: '1px solid #E4E4E7',
                }}>
                    {/* Breadcrumb */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#71717A' }}>
                        {currentAsin && (
                            <button onClick={() => setCurrentAsin(null)} 
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#18181B', display: 'flex', alignItems: 'center' }}>
                                <ChevronLeft size={16} />
                            </button>
                        )}
                        <span style={{ fontWeight: 700, color: '#18181B' }}>
                            {navItems.find(n => n.id === section)?.label}
                        </span>
                        {currentAsin && (
                            <>
                                <ChevronRight size={14} />
                                <span style={{ fontWeight: 600 }}>{currentAsin}</span>
                            </>
                        )}
                    </div>

                    <div style={{ flex: 1 }} />

                    {/* Search */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: '#F4F4F5', borderRadius: 9, padding: '0.45rem 0.9rem',
                        border: '1px solid #E4E4E7'
                    }}>
                        <Search size={14} color="#A1A1AA" />
                        <input
                            value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search…"
                            style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: '#18181B', width: 180 }}
                        />
                    </div>

                    {/* Refresh */}
                    <button onClick={fetchFiles} title="Refresh"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4, borderRadius: 6, display: 'flex' }}>
                        <RefreshCw size={16} />
                    </button>

                    {/* View toggle */}
                    <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 8, overflow: 'hidden' }}>
                        {[{ id: 'grid', icon: <Grid size={15} /> }, { id: 'list', icon: <List size={15} /> }].map(v => (
                            <button key={v.id} onClick={() => setView(v.id)}
                                style={{
                                    padding: '0.45rem 0.8rem', border: 'none', cursor: 'pointer',
                                    background: view === v.id ? '#18181B' : 'transparent',
                                    color: view === v.id ? '#fff' : '#71717A',
                                    transition: 'all 200ms',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                {v.icon}
                            </button>
                        ))}
                    </div>
                </div>

                {/* File area */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', paddingTop: '4rem', color: '#94A3B8', fontSize: 14 }}>Loading files…</div>
                    ) : filtered.length === 0 ? (
                        section === 'trash' ? (
                            <EmptyState
                                icon={Trash2}
                                title="Trash is empty"
                                description="Files you delete will appear here for 30 days before permanent removal."
                                action={null}
                            />
                        ) : (
                            <div style={{ textAlign: 'center', paddingTop: '5rem' }}>
                                <FolderOpen size={48} color="#CBD5E1" style={{ marginBottom: 12 }} />
                                <div style={{ color: '#94A3B8', fontSize: 14, fontWeight: 600 }}>
                                    {search ? 'No files match your search' : 'No files yet — upload to get started'}
                                </div>
                            </div>
                        )
                    ) : view === 'grid' ? (
                        /* ── Grid view */
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
                            {filtered.map(file => (
                                <div key={file._id}
                                    onContextMenu={e => openCtx(e, file)}
                                    style={{
                                        background: '#fff', borderRadius: 12,
                                        border: '1.5px solid #E2E8F0',
                                        padding: '1rem 0.85rem 0.75rem',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                                        cursor: 'default', position: 'relative',
                                        transition: 'box-shadow 150ms, border-color 150ms',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(79,70,229,0.1)'; e.currentTarget.style.borderColor = '#C7D2FE'; }}
                                    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#E2E8F0'; }}
                                >
                                    {/* Star */}
                                    {section !== 'trash' && (
                                        <button onClick={() => toggleStar(file)}
                                            style={{ position: 'absolute', top: 8, left: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: file.starred ? '#FBBF24' : '#CBD5E1' }}>
                                            <Star size={13} fill={file.starred ? '#FBBF24' : 'none'} />
                                        </button>
                                    )}
                                    {/* Menu */}
                                    <button onClick={e => openCtx(e, file)}
                                        style={{ position: 'absolute', top: 6, right: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 2 }}>
                                        <MoreVertical size={13} />
                                    </button>

                                    <div style={{
                                        width: 52, height: 52, borderRadius: 12,
                                        background: file.type === 'folder' ? '#F4F4F5' : `${TYPE_COLORS[getFileType(file.originalName)]}18`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        overflow: 'hidden'
                                    }}>
                                        {file.type === 'folder' ? (
                                            file.thumbnail ? (
                                                <img src={file.thumbnail} alt={file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : <FolderOpen size={24} color="#71717A" />
                                        ) : (
                                            <FileIcon name={file.originalName} url={file.url} size={52} />
                                        )}
                                    </div>

                                    <div 
                                        onClick={() => file.type === 'folder' && setCurrentAsin(file.id)}
                                        style={{ fontSize: 12, fontWeight: 600, color: '#18181B', textAlign: 'center', wordBreak: 'break-word', lineHeight: 1.3, cursor: file.type === 'folder' ? 'pointer' : 'default' }}>
                                        {file.type === 'folder' ? file.name : (file.originalName.length > 22 ? file.originalName.slice(0, 20) + '…' : file.originalName)}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#A1A1AA' }}>{file.type === 'folder' ? `${file.count} images` : file.sizeLabel}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* ── List view */
                        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E4E4E7', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #F4F4F5' }}>
                                        {['Name', 'Size', 'Uploaded', 'Actions'].map(h => (
                                            <th key={h} style={{ padding: '0.65rem 1rem', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((file, idx) => (
                                        <tr key={file._id || file.id}
                                            style={{ borderBottom: idx < filtered.length - 1 ? '1px solid #F4F4F5' : 'none' }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <td style={{ padding: '0.7rem 1rem' }}>
                                                <div 
                                                    onClick={() => file.type === 'folder' && setCurrentAsin(file.id)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: file.type === 'folder' ? 'pointer' : 'default' }}>
                                                    <div style={{
                                                        width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                                                        background: file.type === 'folder' ? '#F4F4F5' : `${TYPE_COLORS[getFileType(file.originalName)]}18`,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        overflow: 'hidden'
                                                    }}>
                                                        {file.type === 'folder' ? (
                                                            file.thumbnail ? (
                                                                <img src={file.thumbnail} alt={file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            ) : <FolderOpen size={16} color="#71717A" />
                                                        ) : (
                                                            <FileIcon name={file.originalName} url={file.url} size={34} />
                                                        )}
                                                    </div>
                                                    <span style={{ fontSize: 13, fontWeight: 600, color: '#18181B' }}>{file.type === 'folder' ? file.name : file.originalName}</span>
                                                    {file.starred && <Star size={12} color="#FBBF24" fill="#FBBF24" />}
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.7rem 1rem', fontSize: 12, color: '#71717A' }}>{file.type === 'folder' ? '--' : file.sizeLabel}</td>
                                            <td style={{ padding: '0.7rem 1rem', fontSize: 12, color: '#71717A', whiteSpace: 'nowrap' }}>
                                                {file.type === 'folder' ? '--' : new Date(file.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td style={{ padding: '0.7rem 1rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    {section !== 'trash' ? (
                                                        <>
                                                            <button onClick={() => toggleStar(file)} title={file.starred ? 'Unstar' : 'Star'}
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: file.starred ? '#FBBF24' : '#CBD5E1', padding: 4, borderRadius: 6 }}>
                                                                <Star size={14} fill={file.starred ? '#FBBF24' : 'none'} />
                                                            </button>
                                                            <button onClick={() => window.open(file.url)} title="Download"
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4, borderRadius: 6 }}
                                                                onMouseEnter={e => e.currentTarget.style.color = '#4F46E5'} onMouseLeave={e => e.currentTarget.style.color = '#94A3B8'}>
                                                                <Download size={14} />
                                                            </button>
                                                            <button onClick={() => setRenameFile(file)} title="Rename"
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4, borderRadius: 6 }}
                                                                onMouseEnter={e => e.currentTarget.style.color = '#4F46E5'} onMouseLeave={e => e.currentTarget.style.color = '#94A3B8'}>
                                                                <Pencil size={14} />
                                                            </button>
                                                            <button onClick={() => trashFile(file)} title="Move to Trash"
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4, borderRadius: 6 }}
                                                                onMouseEnter={e => e.currentTarget.style.color = '#EF4444'} onMouseLeave={e => e.currentTarget.style.color = '#94A3B8'}>
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button onClick={() => restoreFile(file)} title="Restore"
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16A34A', padding: 4, borderRadius: 6 }}>
                                                                <RotateCcw size={14} />
                                                            </button>
                                                            <button onClick={() => deleteFile(file)} title="Delete Forever"
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 4, borderRadius: 6 }}>
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Context menu */}
            {ctxFile && (
                <ContextMenu
                    file={ctxFile} pos={ctxPos}
                    onClose={() => setCtxFile(null)}
                    actions={resolvedCtxActions}
                />
            )}

            {/* Rename modal */}
            {renameFile && (
                <RenameModal
                    file={renameFile}
                    onClose={() => setRenameFile(null)}
                    onSave={renameFileSave}
                />
            )}
        </div>
    );
};

export default FileManagerPage;
