import React, { useState, useEffect, useRef } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Calendar as CalendarIcon, X, ChevronRight } from 'lucide-react';
import { 
    format, 
    subDays, 
    startOfDay, 
    endOfDay, 
    startOfWeek, 
    endOfWeek, 
    subWeeks, 
    startOfMonth, 
    endOfMonth, 
    subMonths 
} from 'date-fns';
import './DateRangePicker.css';

const PRESETS = [
    { label: 'Today', value: 'today' },
    { label: 'Yesterday', value: 'yesterday' },
    { label: 'This Week', value: 'thisWeek' },
    { label: 'Last Week', value: 'lastWeek' },
    { label: 'This Month', value: 'thisMonth' },
    { label: 'Last Month', value: 'lastMonth' },
    { label: 'Last 7 Days', value: 'last7' },
    { label: 'Last 30 Days', value: 'last30' },
];

const DateRangePicker = ({
    startDate,
    endDate,
    onDateChange,
    placeholder = 'Select date range'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [tempRange, setTempRange] = useState([startDate || null, endDate || null]);
    const [activePreset, setActivePreset] = useState(null);
    const [daysUpToToday, setDaysUpToToday] = useState(30);
    const [latestDaysExcluded, setLatestDaysExcluded] = useState(0);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const containerRef = useRef(null);

    // Track window width for responsiveness
    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Effect for custom relative ranges (X days up to today, excluding Y)
    useEffect(() => {
        const now = new Date();
        const end = subDays(endOfDay(now), latestDaysExcluded);
        const start = subDays(startOfDay(end), daysUpToToday - 1);
        
        if (activePreset === 'custom-relative') {
            setTempRange([start, end]);
        }
    }, [daysUpToToday, latestDaysExcluded, activePreset]);

    // Sync temp range with props when opening
    useEffect(() => {
        if (isOpen) {
            setTempRange([startDate, endDate]);
        }
    }, [isOpen, startDate, endDate]);

    // Handle clicks outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handlePresetClick = (type) => {
        setActivePreset(type);
        const now = new Date();
        let start, end;

        switch (type) {
            case 'today':
                start = startOfDay(now);
                end = endOfDay(now);
                break;
            case 'yesterday':
                start = startOfDay(subDays(now, 1));
                end = endOfDay(subDays(now, 1));
                break;
            case 'thisWeek':
                start = startOfWeek(now, { weekStartsOn: 1 });
                end = endOfDay(now);
                break;
            case 'lastWeek':
                const prevWeek = subWeeks(now, 1);
                start = startOfWeek(prevWeek, { weekStartsOn: 1 });
                end = endOfWeek(prevWeek, { weekStartsOn: 1 });
                break;
            case 'thisMonth':
                start = startOfMonth(now);
                end = endOfDay(now);
                break;
            case 'lastMonth':
                const prevMonth = subMonths(now, 1);
                start = startOfMonth(prevMonth);
                end = endOfMonth(prevMonth);
                break;
            case 'last7':
                start = subDays(startOfDay(now), 7);
                end = endOfDay(now);
                break;
            case 'last30':
                start = subDays(startOfDay(now), 30);
                end = endOfDay(now);
                break;
            default:
                start = startDate;
                end = endDate;
        }
        setTempRange([start, end]);
    };

    const handleCustomChange = (update) => {
        // Auto-select end date with 7 days period when start date is selected
        if (update[0] && !update[1]) {
            const startDate = new Date(update[0]);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6); // 7 days total (start + 6 more days)
            setTempRange([update[0], endDate]);
        } else {
            setTempRange(update);
        }
        setActivePreset(null);
    };

    const handleSave = () => {
        if (tempRange[0] && tempRange[1]) {
            onDateChange(activePreset || 'custom', tempRange[0], tempRange[1]);
            setIsOpen(false);
        }
    };

    const formatDateDisplay = () => {
        if (startDate && endDate) {
            return `${format(startDate, 'MMM dd, yyyy')} - ${format(endDate, 'MMM dd, yyyy')}`;
        }
        return placeholder;
    };

    return (
        <div className="position-relative" ref={containerRef}>
            {/* Trigger Button */}
            <div
                className="d-flex align-items-center gap-2 px-3 py-1 border rounded-3 cursor-pointer hover-bg-light transition-all"
                style={{
                    backgroundColor: '#f8fafc',
                    borderColor: '#e2e8f0',
                    height: '32px',
                    minWidth: '220px'
                }}
                onClick={() => setIsOpen(!isOpen)}
            >
                <CalendarIcon size={14} className="text-zinc-500" />
                <span className="flex-grow-1 smallest fw-semibold text-zinc-700">
                    {formatDateDisplay()}
                </span>
                <ChevronRight size={14} className={`text-zinc-400 transition-all ${isOpen ? 'rotate-90' : ''}`} />
            </div>

            {/* Advanced Popover */}
            {isOpen && (
                <div className="position-absolute advanced-picker-popover mt-2 shadow-xl" style={{ right: 0, top: '100%' }}>
                    <div className="advanced-picker-container">
                        {/* Sidebar */}
                        <aside className="picker-sidebar">
                            <div className="flex-grow-1">
                                {PRESETS.map((p) => (
                                    <div
                                        key={p.value}
                                        className={`preset-item ${activePreset === p.value ? 'active' : ''}`}
                                        onClick={() => handlePresetClick(p.value)}
                                    >
                                        {p.label}
                                    </div>
                                ))}
                            </div>

                            {/* Custom Exclusion Logic */}
                            <div className="custom-range-inputs">
                                <div className="custom-input-group">
                                    <label>Range Length</label>
                                    <div className="custom-input-wrapper">
                                        <input 
                                            type="number" 
                                            className="custom-input-field" 
                                            value={daysUpToToday} 
                                            onChange={(e) => {
                                                setDaysUpToToday(parseInt(e.target.value) || 0);
                                                setActivePreset('custom-relative');
                                            }}
                                        />
                                        <span className="custom-input-text">days up to today</span>
                                    </div>
                                </div>
                                <div className="custom-input-group">
                                    <label>Exclusion</label>
                                    <div className="custom-input-wrapper">
                                        <input 
                                            type="number" 
                                            className="custom-input-field" 
                                            value={latestDaysExcluded} 
                                            onChange={(e) => {
                                                setLatestDaysExcluded(parseInt(e.target.value) || 0);
                                                setActivePreset('custom-relative');
                                            }}
                                        />
                                        <span className="custom-input-text">latest days excluded</span>
                                    </div>
                                </div>
                            </div>
                        </aside>

                        {/* Main calendar area */}
                        <main className="picker-main">
                            <div className="picker-inputs-row">
                                <div className={`date-input-box ${!tempRange[1] ? 'active' : ''}`}>
                                    {tempRange[0] ? format(tempRange[0], 'MMM dd, yyyy') : 'Start Date'}
                                </div>
                                <span className="text-zinc-400">—</span>
                                <div className={`date-input-box ${tempRange[1] ? 'active' : ''}`}>
                                    {tempRange[1] ? format(tempRange[1], 'MMM dd, yyyy') : 'End Date'}
                                </div>
                            </div>

                            <DatePicker
                                selectsRange
                                startDate={tempRange[0]}
                                endDate={tempRange[1]}
                                onChange={handleCustomChange}
                                selectsEnd={!!tempRange[0]}
                                selectsStart={!tempRange[0]}
                                monthsShown={windowWidth > 1024 ? 2 : 1}
                                inline
                                renderCustomHeader={({
                                    monthDate,
                                    customHeaderCount,
                                    decreaseMonth,
                                    increaseMonth,
                                }) => (
                                    <div className="custom-calendar-header-wrapper">
                                        {/* Main Navigation Bar (Shows only once on top of split) */}
                                        {customHeaderCount === 0 && (
                                            <div className="unified-nav-controls">
                                                <button
                                                    aria-label="Previous Month"
                                                    className="nav-btn-custom"
                                                    onClick={decreaseMonth}
                                                    type="button"
                                                >
                                                    <span className="nav-arrow-left"></span>
                                                </button>
                                                
                                                <div className="header-labels-center">
                                                    <div className="header-label-item">
                                                        {format(monthDate, 'MMMM')} <span className="chevron-down-tiny"></span>
                                                    </div>
                                                    <div className="header-label-item">
                                                        {format(monthDate, 'yyyy')} <span className="chevron-down-tiny"></span>
                                                    </div>
                                                </div>

                                                <button
                                                    aria-label="Next Month"
                                                    className="nav-btn-custom"
                                                    onClick={increaseMonth}
                                                    type="button"
                                                >
                                                    <span className="nav-arrow-right"></span>
                                                </button>
                                            </div>
                                        )}

                                        {/* Sub-month label ("Mar 2026") */}
                                        <div className="sub-month-title">
                                            {format(monthDate, 'MMM yyyy')}
                                        </div>
                                    </div>
                                )}
                            />
                        </main>
                    </div>

                    {/* Footer */}
                    <div className="picker-footer">
                        <button className="btn-picker btn-picker-cancel" onClick={() => setIsOpen(false)}>Cancel</button>
                        <button className="btn-picker btn-picker-save" onClick={handleSave}>Save</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DateRangePicker;