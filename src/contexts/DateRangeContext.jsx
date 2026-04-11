import React, { useState, useRef, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { ChevronLeft, ChevronRight, ChevronDown, Calendar } from 'lucide-react';
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
    subMonths,
    addMonths,
    getYear,
    getMonth,
    eachYearOfInterval,
    eachMonthOfInterval
} from 'date-fns';
import '../components/common/DateRangePicker.css';

// Custom Header Component with Unified Navigation
const CustomHeader = ({
    date,
    changeYear,
    changeMonth,
    decreaseMonth,
    increaseMonth,
    prevMonthButtonDisabled,
    nextMonthButtonDisabled,
    isSecondMonth = false,
    mainDate,
    onMainDateChange
}) => {
    const [showYearSelect, setShowYearSelect] = useState(false);
    const [showMonthSelect, setShowMonthSelect] = useState(false);

    const years = eachYearOfInterval({
        start: subDays(new Date(), 365 * 5),
        end: addMonths(new Date(), 12)
    });

    const months = eachMonthOfInterval({
        start: new Date(getYear(date), 0, 1),
        end: new Date(getYear(date), 11, 1)
    }).map(d => format(d, 'MMMM'));

    if (isSecondMonth) {
        return <div className="sub-month-title">{format(date, 'MMMM yyyy')}</div>;
    }

    return (
        <div className="custom-calendar-header-wrapper">
            <div className="unified-nav-controls">
                <button
                    className="nav-btn-custom"
                    onClick={decreaseMonth}
                    disabled={prevMonthButtonDisabled}
                >
                    <ChevronLeft size={16} />
                </button>

                <div className="header-labels-center">
                    <div className="header-label-item">
                        <span>{format(date, 'MMMM')}</span>
                        <ChevronDown size={14} className="chevron-down-tiny" />
                    </div>
                    <div className="header-label-item">
                        <span>{format(date, 'yyyy')}</span>
                        <ChevronDown size={14} className="chevron-down-tiny" />
                    </div>
                    <div className="header-label-item">
                        <span>{format(addMonths(date, 1), 'MMMM')}</span>
                        <ChevronDown size={14} className="chevron-down-tiny" />
                    </div>
                    <div className="header-label-item">
                        <span>{format(addMonths(date, 1), 'yyyy')}</span>
                        <ChevronDown size={14} className="chevron-down-tiny" />
                    </div>
                </div>

                <button
                    className="nav-btn-custom"
                    onClick={increaseMonth}
                    disabled={nextMonthButtonDisabled}
                >
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
    );
};

// Custom Input Component
const CustomInput = React.forwardRef(({ value, onClick, isStart, isActive }, ref) => (
    <div
        className={`date-input-box ${isActive ? 'active' : ''}`}
        onClick={onClick}
        ref={ref}
    >
        <Calendar size={16} style={{ marginRight: '8px', color: '#9ca3af' }} />
        <span>{value || (isStart ? 'Start date' : 'End date')}</span>
    </div>
));

// Main DateRangePicker Component
const AdvancedDateRangePicker = ({
    isOpen,
    onClose,
    onApply,
    initialStartDate,
    initialEndDate,
    initialRangeType = 'last30'
}) => {
    const [startDate, setStartDate] = useState(initialStartDate || subDays(new Date(), 30));
    const [endDate, setEndDate] = useState(initialEndDate || new Date());
    const [activeInput, setActiveInput] = useState(null);
    const [currentMonth, setCurrentMonth] = useState(startDate);
    const [rangeType, setRangeType] = useState(initialRangeType);

    const [fromInput, setFromInput] = useState({
        day: initialStartDate ? format(initialStartDate, 'dd') : '',
        month: initialStartDate ? format(initialStartDate, 'MM') : '',
        year: initialStartDate ? format(initialStartDate, 'yyyy') : ''
    });
    const [toInput, setToInput] = useState({
        day: initialEndDate ? format(initialEndDate, 'dd') : '',
        month: initialEndDate ? format(initialEndDate, 'MM') : '',
        year: initialEndDate ? format(initialEndDate, 'yyyy') : ''
    });

    const pickerRef = useRef(null);
    const datePickerRef = useRef(null);

    useEffect(() => {
        if (startDate) {
            setFromInput({
                day: format(startDate, 'dd'),
                month: format(startDate, 'MM'),
                year: format(startDate, 'yyyy')
            });
        }
        if (endDate) {
            setToInput({
                day: format(endDate, 'dd'),
                month: format(endDate, 'MM'),
                year: format(endDate, 'yyyy')
            });
        }
    }, [startDate, endDate]);

    const handleManualInputChange = (type, field, value) => {
        if (value && !/^\d+$/.test(value)) return;

        const setter = type === 'from' ? setFromInput : setToInput;
        setter(prev => {
            const newState = { ...prev, [field]: value };

            const { day, month, year } = newState;
            if (day.length === 2 && month.length === 2 && year.length === 4) {
                const newDate = new Date(`${year}-${month}-${day}`);
                if (!isNaN(newDate.getTime())) {
                    if (type === 'from') {
                        setStartDate(newDate);
                        if (endDate && newDate > endDate) setEndDate(null);
                    } else {
                        setEndDate(newDate);
                        if (startDate && newDate < startDate) setStartDate(null);
                    }
                    setRangeType('custom');
                }
            }
            return newState;
        });
    };

    const presets = [
        { label: 'Today', value: 'today' },
        { label: 'Yesterday', value: 'yesterday' },
        { label: 'This Week', value: 'thisWeek' },
        { label: 'Last Week', value: 'lastWeek' },
        { label: 'This Month', value: 'thisMonth' },
        { label: 'Last Month', value: 'lastMonth' },
        { label: 'Last 7 Days', value: 'last7' },
        { label: 'Last 30 Days', value: 'last30' },
        { label: 'Last 90 Days', value: 'last90' },
    ];

    const handlePresetClick = (presetValue) => {
        setRangeType(presetValue);
        const now = new Date();
        let newStart, newEnd;

        switch (presetValue) {
            case 'today':
                newStart = startOfDay(now);
                newEnd = endOfDay(now);
                break;
            case 'yesterday':
                newStart = startOfDay(subDays(now, 1));
                newEnd = endOfDay(subDays(now, 1));
                break;
            case 'thisWeek':
                newStart = startOfWeek(now, { weekStartsOn: 1 });
                newEnd = endOfDay(now);
                break;
            case 'lastWeek':
                const prevWeek = subWeeks(now, 1);
                newStart = startOfWeek(prevWeek, { weekStartsOn: 1 });
                newEnd = endOfWeek(prevWeek, { weekStartsOn: 1 });
                break;
            case 'thisMonth':
                newStart = startOfMonth(now);
                newEnd = endOfDay(now);
                break;
            case 'lastMonth':
                const prevMonth = subMonths(now, 1);
                newStart = startOfMonth(prevMonth);
                newEnd = endOfMonth(prevMonth);
                break;
            case 'last7':
                newStart = subDays(startOfDay(now), 7);
                newEnd = endOfDay(now);
                break;
            case 'last30':
                newStart = subDays(startOfDay(now), 30);
                newEnd = endOfDay(now);
                break;
            case 'last90':
                newStart = subDays(startOfDay(now), 90);
                newEnd = endOfDay(now);
                break;
            default:
                return;
        }

        setStartDate(newStart);
        setEndDate(newEnd);
        setCurrentMonth(newStart);
    };

    const handleDateChange = (dates) => {
        const [start, end] = dates;

        if (start && !end) {
            const endDateCalc = new Date(start);
            endDateCalc.setDate(endDateCalc.getDate() + 6);
            setStartDate(start);
            setEndDate(endDateCalc);
        } else {
            setStartDate(start);
            setEndDate(end);
        }
        setRangeType('custom');

        if (start && !end) {
            setActiveInput('end');
        } else if (start && end) {
            setActiveInput(null);
        }
    };

    const handleApply = () => {
        if (startDate && endDate) {
            onApply({
                startDate,
                endDate,
                rangeType
            });
            onClose();
        }
    };

    const handleCancel = () => {
        setStartDate(initialStartDate || subDays(new Date(), 30));
        setEndDate(initialEndDate || new Date());
        setRangeType(initialRangeType);
        onClose();
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="picker-backdrop" onClick={handleCancel}>
            <div className="advanced-picker-popover" ref={pickerRef} onClick={e => e.stopPropagation()}>
                <div className="advanced-picker-container">
                    <div className="picker-sidebar">
                        <div className="sidebar-preset-header" style={{ 
                            padding: '12px 20px', 
                            fontSize: '12px', 
                            fontWeight: '600', 
                            color: '#9ca3af', 
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            borderBottom: '1px solid #f9fafb'
                        }}>
                            Previous Period
                        </div>
                        {presets.map((preset) => (
                            <div
                                key={preset.value}
                                className={`preset-item ${rangeType === preset.value ? 'active' : ''}`}
                                onClick={() => handlePresetClick(preset.value)}
                            >
                                {preset.label}
                            </div>
                        ))}
                    </div>

                    <div className="custom-range-inputs">
                        <div className="custom-input-group">
                            <label>From</label>
                            <div className="custom-input-wrapper">
                                <input
                                    type="text"
                                    className="custom-input-field"
                                    placeholder="DD"
                                    maxLength="2"
                                    value={fromInput.day}
                                    onChange={(e) => handleManualInputChange('from', 'day', e.target.value)}
                                />
                                <span className="custom-input-text">/</span>
                                <input
                                    type="text"
                                    className="custom-input-field"
                                    placeholder="MM"
                                    maxLength="2"
                                    value={fromInput.month}
                                    onChange={(e) => handleManualInputChange('from', 'month', e.target.value)}
                                />
                                <span className="custom-input-text">/</span>
                                <input
                                    type="text"
                                    className="custom-input-field"
                                    placeholder="YYYY"
                                    maxLength="4"
                                    value={fromInput.year}
                                    onChange={(e) => handleManualInputChange('from', 'year', e.target.value)}
                                />
                            </div>
                        </div>
  
                        <div className="custom-input-group">
                            <label>To</label>
                            <div className="custom-input-wrapper">
                                <input
                                    type="text"
                                    className="custom-input-field"
                                    placeholder="DD"
                                    maxLength="2"
                                    value={toInput.day}
                                    onChange={(e) => handleManualInputChange('to', 'day', e.target.value)}
                                />
                                <span className="custom-input-text">/</span>
                                <input
                                    type="text"
                                    className="custom-input-field"
                                    placeholder="MM"
                                    maxLength="2"
                                    value={toInput.month}
                                    onChange={(e) => handleManualInputChange('to', 'month', e.target.value)}
                                />
                                <span className="custom-input-text">/</span>
                                <input
                                    type="text"
                                    className="custom-input-field"
                                    placeholder="YYYY"
                                    maxLength="4"
                                    value={toInput.year}
                                    onChange={(e) => handleManualInputChange('to', 'year', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                <div className="picker-main">
                    <div className="picker-inputs-row">
                        <CustomInput
                            value={startDate ? format(startDate, 'MMM dd, yyyy') : ''}
                            onClick={() => setActiveInput('start')}
                            isStart={true}
                            isActive={activeInput === 'start'}
                        />
                        <span style={{ color: '#9ca3af' }}>—</span>
                        <CustomInput
                            value={endDate ? format(endDate, 'MMM dd, yyyy') : ''}
                            onClick={() => setActiveInput('end')}
                            isStart={false}
                            isActive={activeInput === 'end'}
                        />
                    </div>

                    <DatePicker
                        ref={datePickerRef}
                        selected={startDate}
                        onChange={handleDateChange}
                        startDate={startDate}
                        endDate={endDate}
                        selectsRange={true}
                        monthsShown={2}
                        inline
                        calendarStartDay={1}
                        renderCustomHeader={(props) => (
                            <CustomHeader
                                {...props}
                                isSecondMonth={false}
                            />
                        )}
                        formatWeekDay={name => name.substr(0, 1)}
                    />
                </div>
            </div>

            <div className="picker-footer">
                <button className="btn-picker btn-picker-cancel" onClick={handleCancel}>
                    Cancel
                </button>
                <button className="btn-picker btn-picker-save" onClick={handleApply}>
                    Apply
                </button>
            </div>
            </div>
        </div>
    );
};

// Context Provider Component
const DateRangeContext = React.createContext();

export const DateRangeProvider = ({ children }) => {
    const [rangeType, setRangeType] = useState('last30');
    const [startDate, setStartDate] = useState(subDays(startOfDay(new Date()), 30));
    const [endDate, setEndDate] = useState(endOfDay(new Date()));
    const [isPickerOpen, setIsPickerOpen] = useState(false);

    const updateDateRange = ({ startDate: newStart, endDate: newEnd, rangeType: newType }) => {
        setStartDate(newStart);
        setEndDate(newEnd);
        setRangeType(newType);
    };

    const getBackendPeriod = () => {
        return rangeType;
    };

    const openPicker = () => setIsPickerOpen(true);
    const closePicker = () => setIsPickerOpen(false);

    return (
        <DateRangeContext.Provider value={{
            startDate,
            endDate,
            rangeType,
            updateDateRange,
            getBackendPeriod,
            isPickerOpen,
            openPicker,
            closePicker
        }}>
            {children}
            <AdvancedDateRangePicker
                isOpen={isPickerOpen}
                onClose={closePicker}
                onApply={updateDateRange}
                initialStartDate={startDate}
                initialEndDate={endDate}
                initialRangeType={rangeType}
            />
        </DateRangeContext.Provider>
    );
};

export const useDateRange = () => {
    const context = React.useContext(DateRangeContext);
    if (!context) {
        throw new Error('useDateRange must be used within a DateRangeProvider');
    }
    return context;
};

export default AdvancedDateRangePicker;