import React, { useMemo } from 'react';
import { DateRangePicker as RSuiteDateRangePicker } from 'rsuite';
import { Calendar as CalendarIcon } from 'lucide-react';
import {
    subDays,
    startOfMonth,
    subMonths,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    startOfYear,
    endOfYear,
    startOfQuarter,
    endOfQuarter
} from 'date-fns';
import 'rsuite/dist/rsuite-no-reset.min.css';
import '../../styles/rsuite-overrides.css';

const DateRangePicker = ({
    // Legacy/Context-specific props
    startDate,
    endDate,
    onDateChange,

    // Standard React controlled props
    value,
    onChange,

    placeholder = 'Select date range',
    compact = false,
    showQuarters = false,
    cleanable = false,
    showOneCalendar = false,
    isoWeek = true,
    placement = 'bottomEnd',
    format = 'dd MMM yyyy',
    character = ' → ',
    style,
    className,
    ranges,
    ...rest
}) => {
    // ═══════════════════════════════════════════════════════════════
    // PREMIUM PRESET RANGES
    // ═══════════════════════════════════════════════════════════════
    const rangePresets = useMemo(() => {
        const today = new Date();
        const basePresets = [
            {
                label: 'Today',
                value: [today, today],
                closeOverlay: true
            },
            {
                label: 'Yesterday',
                value: [subDays(today, 1), subDays(today, 1)],
                closeOverlay: true
            },
            {
                label: 'Last 7 Days',
                value: [subDays(today, 6), today],
                closeOverlay: true
            },
            {
                label: 'Last 14 Days',
                value: [subDays(today, 13), today],
                closeOverlay: true
            },
            {
                label: 'Last 30 Days',
                value: [subDays(today, 29), today],
                closeOverlay: true
            },
            {
                label: 'This Week',
                value: [startOfWeek(today, { weekStartsOn: 1 }), endOfWeek(today, { weekStartsOn: 1 })],
                closeOverlay: true
            },
            {
                label: 'This Month',
                value: [startOfMonth(today), today],
                closeOverlay: true
            },
            {
                label: 'Last Month',
                value: [
                    startOfMonth(subMonths(today, 1)),
                    endOfMonth(subMonths(today, 1))
                ],
                closeOverlay: true
            }
        ];

        if (showQuarters) {
            basePresets.push(
                {
                    label: 'This Quarter',
                    value: [startOfQuarter(today), endOfQuarter(today)],
                    closeOverlay: true
                },
                {
                    label: 'Last Quarter',
                    value: [
                        startOfQuarter(subMonths(today, 3)),
                        endOfQuarter(subMonths(today, 3))
                    ],
                    closeOverlay: true
                }
            );
        }

        basePresets.push(
            {
                label: 'Year to Date',
                value: [startOfYear(today), today],
                closeOverlay: true
            },
            {
                label: 'Last Year',
                value: [
                    startOfYear(subMonths(today, 12)),
                    endOfYear(subMonths(today, 12))
                ],
                closeOverlay: true
            }
        );

        return basePresets;
    }, [showQuarters]);

    const activeValue = useMemo(() => {
        const toDate = (val) => {
            if (!val) return null;
            if (val instanceof Date) return val;
            const parsed = new Date(val);
            return isNaN(parsed.getTime()) ? null : parsed;
        };

        if (value !== undefined) {
            if (Array.isArray(value)) {
                return [toDate(value[0]), toDate(value[1])];
            }
            return null;
        }
        const s = toDate(startDate);
        const e = toDate(endDate);
        return s && e ? [s, e] : null;
    }, [value, startDate, endDate]);

    const handleDateChange = (val, event) => {
        if (onChange) {
            onChange(val, event);
        }
        if (onDateChange) {
            if (val && val[0] && val[1]) {
                onDateChange('custom', val[0], val[1]);
            } else {
                onDateChange('custom', null, null);
            }
        }
    };

    // Custom calendar icon component
    const CustomCaret = () => (
        <CalendarIcon
            size={13}
            strokeWidth={2.5}
            style={{
                color: '#6366f1',
                transition: 'color 0.2s'
            }}
        />
    );

    const activeRanges = ranges || rangePresets;

    return (
        <RSuiteDateRangePicker
            className={`header-datepicker ${compact ? 'compact' : ''} ${className || ''}`}
            format={format}
            character={character}
            ranges={activeRanges}
            placeholder={placeholder}
            cleanable={cleanable}
            placement={placement}
            preventOverflow={true}
            container={() => document.body}
            caretAs={CustomCaret}
            showOneCalendar={showOneCalendar}
            isoWeek={isoWeek}
            style={{
                width: compact ? 'auto' : 260,
                minWidth: compact ? 200 : 260,
                ...style
            }}
            {...rest}
            value={activeValue}
            onChange={handleDateChange}
        />
    );
};

export default DateRangePicker;