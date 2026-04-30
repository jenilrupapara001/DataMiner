import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, ChevronDown, Check, Loader2, X } from 'lucide-react';

/**
 * InfiniteScrollSelect - A premium custom dropdown with lazy loading and search.
 * 
 * @param {Function} fetchData - Callback (page, search) => Promise({ data: [], hasMore: boolean })
 * @param {Function} onSelect - Callback when an item is selected
 * @param {string} value - Current selected value (ID)
 * @param {string} placeholder - Placeholder text
 * @param {string} labelKey - The key to display as label (default: 'name')
 * @param {string} valueKey - The key to use as value (default: '_id')
 */
const InfiniteScrollSelect = ({
    fetchData,
    onSelect,
    value,
    placeholder = "Select an option...",
    labelKey = 'name',
    valueKey = '_id',
    disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedLabel, setSelectedLabel] = useState('');

    const dropdownRef = useRef(null);
    const observerTarget = useRef(null);
    const searchTimeout = useRef(null);

    // Initial load and Search load
    const loadOptions = useCallback(async (pageNum, searchQuery, append = false) => {
        if (loading) return;
        setLoading(true);
        try {
            const result = await fetchData(pageNum, searchQuery);
            const newOptions = result?.data || [];
            setOptions(prev => append ? [...prev, ...newOptions] : newOptions);
            setHasMore(result?.hasMore || false);
            
            // Sync selected label if it exists
            if (value) {
                const combined = append ? [...options, ...newOptions] : newOptions;
                const selected = combined.find(opt => opt[valueKey] === value);
                if (selected) setSelectedLabel(selected[labelKey]);
            }
        } catch (err) {
            console.error('Error fetching options:', err);
        } finally {
            setLoading(false);
        }
    }, [fetchData, value, valueKey, labelKey, options, loading]);

    // Handle Page changes
    useEffect(() => {
        if (page > 1 && isOpen) {
            loadOptions(page, search, true);
        }
    }, [page, isOpen, loadOptions]);

    // Handle initial selection sync if options aren't loaded yet
    useEffect(() => {
        if (value && !selectedLabel) {
            // Find in current options
            const selected = options.find(opt => opt[valueKey] === value);
            if (selected) {
                setSelectedLabel(selected[labelKey]);
            } else if (!isOpen) {
                // If closed and has value but no label, maybe fetch details or just show value
                // For simplicity, we assume labels are eventually matched
            }
        } else if (!value) {
            setSelectedLabel('');
        }
    }, [value, options, valueKey, labelKey, isOpen, selectedLabel]);

    // Intersection Observer for Infinite Scroll
    useEffect(() => {
        if (!isOpen || !hasMore || loading) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !loading) {
                    setPage(prev => prev + 1);
                }
            },
            { threshold: 0.1 }
        );

        const target = observerTarget.current;
        if (target) {
            observer.observe(target);
        }

        return () => {
            if (target) observer.unobserve(target);
            observer.disconnect();
        };
    }, [isOpen, hasMore, loading]);

    // Handle Search Debounce
    useEffect(() => {
        if (!isOpen) return;
        
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        
        searchTimeout.current = setTimeout(() => {
            setPage(1);
            loadOptions(1, search, false);
        }, 400);

        return () => clearTimeout(searchTimeout.current);
    }, [search, isOpen, loadOptions]);

    // Toggle Dropdown
    const handleToggle = () => {
        if (disabled) return;
        setIsOpen(!isOpen);
        if (!isOpen && options.length === 0) {
            loadOptions(1, '', false);
        }
    };

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleItemClick = (item) => {
        onSelect(item[valueKey]);
        setSelectedLabel(item[labelKey]);
        setIsOpen(false);
    };

    const handleClear = (e) => {
        e.stopPropagation(); // prevent opening dropdown
        onSelect('');
        setSelectedLabel('');
    };

    return (
        <div ref={dropdownRef} className="infinite-select-container" style={{ position: 'relative', width: '100%' }}>
            {/* Display / Trigger */}
            <div 
                className={`infinite-select-trigger ${isOpen ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
                onClick={handleToggle}
            >
                <span className={`selected-value ${!selectedLabel ? 'select-placeholder' : ''}`}>
                    {selectedLabel || placeholder}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {selectedLabel && (
                        <div 
                            onClick={handleClear} 
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px', cursor: 'pointer', borderRadius: '50%' }}
                            className="clear-icon-wrapper"
                        >
                            <X size={12} className="clear-icon" />
                        </div>
                    )}
                    <ChevronDown size={14} className={`chevron ${isOpen ? 'rotate' : ''}`} />
                </div>
            </div>

            {/* Dropdown Content */}
            {isOpen && (
                <div className="infinite-select-dropdown">
                    {/* Search Area */}
                    <div className="search-wrapper">
                        <Search size={12} className="search-icon" />
                        <input 
                            autoFocus
                            type="text" 
                            className="search-input" 
                            placeholder="Search..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Options List */}
                    <div className="options-list">
                        {loading && options.length === 0 ? (
                            <div className="initial-loader" style={{ padding: '30px', textAlign: 'center' }}>
                                <Loader2 size={20} className="spin text-zinc-400 mx-auto" />
                                <div style={{ fontSize: '11px', color: '#a1a1aa', marginTop: '8px' }}>Fetching sellers...</div>
                            </div>
                        ) : (
                            <>
                                {options.map((item, index) => (
                                    <div 
                                        key={`${item[valueKey]}-${index}`}
                                        className={`option-item ${value === item[valueKey] ? 'selected' : ''}`}
                                        onClick={() => handleItemClick(item)}
                                    >
                                        <span className="option-label">{item[labelKey]}</span>
                                        {value === item[valueKey] && <Check size={12} className="check-icon" />}
                                    </div>
                                ))}
                                
                                {/* Scroll Sentinel for Load More */}
                                {hasMore && (
                                    <div ref={observerTarget} className="sentinel" style={{ height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {loading ? (
                                            <Loader2 size={12} className="spin text-zinc-400" />
                                        ) : (
                                            <div style={{ height: '1px' }} />
                                        )}
                                    </div>
                                )}

                                {!loading && options.length === 0 && (
                                    <div className="no-results" style={{ padding: '20px', textAlign: 'center', fontSize: '11px', color: '#a1a1aa' }}>
                                        No results found
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{ __html: `
                .infinite-select-container {
                    font-family: inherit;
                }
                .infinite-select-trigger {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    height: 28px;
                    padding: 0 10px;
                    background: #fff;
                    border: 1px solid #e4e4e7;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    user-select: none;
                }
                .infinite-select-trigger:hover:not(.disabled) {
                    border-color: #d1d1d6;
                }
                .infinite-select-trigger.active {
                    border-color: #18181b;
                    box-shadow: 0 0 0 2px rgba(24, 24, 27, 0.05);
                }
                .infinite-select-trigger.disabled {
                    background: #f4f4f5;
                    cursor: not-allowed;
                    opacity: 0.7;
                }
                .selected-value {
                    font-size: 11px;
                    font-weight: 600;
                    color: #18181b;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .selected-value.select-placeholder {
                    color: #71717a;
                    font-weight: 400;
                }
                .chevron {
                    color: #71717a;
                    transition: transform 0.2s ease;
                }
                .chevron.rotate {
                    transform: rotate(180deg);
                }
                .clear-icon {
                    color: #a1a1aa;
                    transition: color 0.1s;
                }
                .clear-icon-wrapper:hover .clear-icon {
                    color: #ef4444;
                }
                .infinite-select-dropdown {
                    position: absolute;
                    top: calc(100% + 4px);
                    left: 0;
                    right: 0;
                    background: #fff;
                    border: 1px solid #e4e4e7;
                    border-radius: 8px;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                    z-index: 999;
                    overflow: hidden;
                }
                .search-wrapper {
                    display: flex;
                    align-items: center;
                    padding: 8px;
                    border-bottom: 1px solid #f4f4f5;
                    background: #fafafa;
                }
                .search-icon {
                    color: #a1a1aa;
                    margin-right: 8px;
                }
                .search-input {
                    border: none;
                    background: transparent;
                    font-size: 11px;
                    width: 100%;
                    outline: none;
                    color: #18181b;
                }
                .options-list {
                    max-height: 200px;
                    overflow-y: auto;
                    padding: 4px;
                }
                .option-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 6px 8px;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.1s ease;
                }
                .option-item:hover {
                    background: #f4f4f5;
                }
                .option-item.selected {
                    background: #f4f4f5;
                    color: #18181b;
                    font-weight: 600;
                }
                .option-label {
                    font-size: 11px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .check-icon {
                    color: #18181b;
                    flex-shrink: 0;
                }
                .sentinel {
                    padding: 8px;
                    text-align: center;
                    font-size: 10px;
                    color: #a1a1aa;
                }
                .loading-spinner-small {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                }
                .spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .no-more, .no-results {
                    padding: 4px 0;
                }
            ` }} />
        </div>
    );
};

export default InfiniteScrollSelect;
