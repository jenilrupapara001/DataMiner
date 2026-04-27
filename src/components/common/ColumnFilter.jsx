import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Filter } from 'lucide-react';

const ColumnFilter = ({ column, options = [], value, onChange, type = 'select' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = search ? options.filter(o => o.toLowerCase().includes(search.toLowerCase())) : options;

    return (
        <div ref={ref} className="position-relative d-inline-block">
            <button onClick={() => setIsOpen(!isOpen)} className={`btn btn-ghost p-0 border-0 ${value ? 'text-indigo-600' : 'text-zinc-400'}`} style={{ fontSize: '9px' }} title={`Filter ${column}`}>
                <Filter size={10} />
            </button>
            {isOpen && (
                <div className="position-absolute bg-white border rounded-2 shadow-lg p-2" style={{ zIndex: 100, minWidth: '140px', top: '100%', left: 0 }}>
                    {options.length > 10 && (
                        <div className="position-relative mb-1">
                            <Search size={10} className="position-absolute top-50 start-0 translate-middle-y ms-1 text-zinc-300" />
                            <input className="form-control form-control-xs ps-4" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ fontSize: '9px', height: '20px' }} />
                        </div>
                    )}
                    <div style={{ maxHeight: '120px', overflow: 'auto' }}>
                        <div className={`px-2 py-1 rounded-1 cursor-pointer ${!value ? 'bg-zinc-100 fw-bold' : ''}`} onClick={() => { onChange(''); setIsOpen(false); }} style={{ fontSize: '10px' }}>All</div>
                        {filteredOptions.map(opt => (
                            <div key={opt} className={`px-2 py-1 rounded-1 cursor-pointer ${value === opt ? 'bg-zinc-100 fw-bold' : ''}`} onClick={() => { onChange(opt); setIsOpen(false); }} style={{ fontSize: '10px' }}>{opt}</div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ColumnFilter;
