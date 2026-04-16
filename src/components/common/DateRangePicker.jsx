import React from 'react';
import { DateRangePicker as RSuiteDateRangePicker } from 'rsuite';
import { FaCalendar } from 'react-icons/fa';
import { subDays, startOfMonth, subMonths, endOfMonth } from 'date-fns';
import 'rsuite/dist/rsuite-no-reset.min.css';
import '../../styles/rsuite-overrides.css';

const DateRangePicker = ({
    startDate,
    endDate,
    onDateChange,
    placeholder = 'Select date range',
    compact = false
}) => {
    // Custom ranges for rsuite
    const rangePresets = [
        {
            label: 'Today',
            value: [new Date(), new Date()],
            closeOverlay: true
        },
        {
            label: 'Yesterday',
            value: [subDays(new Date(), 1), subDays(new Date(), 1)],
            closeOverlay: true
        },
        {
            label: 'Last 7 Days',
            value: [subDays(new Date(), 6), new Date()],
            closeOverlay: true
        },
        {
            label: 'Last 30 Days',
            value: [subDays(new Date(), 29), new Date()],
            closeOverlay: true
        },
        {
            label: 'This Month',
            value: [startOfMonth(new Date()), new Date()],
            closeOverlay: true
        },
        {
            label: 'Last Month',
            value: [startOfMonth(subMonths(new Date(), 1)), endOfMonth(subMonths(new Date(), 1))],
            closeOverlay: true
        }
    ];

    const handleDateChange = (value) => {
        if (value && value[0] && value[1]) {
            // Map back to the expected (rangeType, start, end) signature if needed, 
            // or just (start, end) if the consumer handles it.
            // Based on original component, it was onDateChange(activePreset || 'custom', start, end)
            onDateChange('custom', value[0], value[1]);
        }
    };

    return (
        <RSuiteDateRangePicker
            className={`header-datepicker ${compact ? 'compact' : ''}`}
            format="dd/MM/yyyy"
            character=" – "
            ranges={rangePresets}
            value={startDate && endDate ? [startDate, endDate] : null}
            onChange={handleDateChange}
            placeholder={placeholder}
            cleanable={false}
            placement="bottomEnd"
            caretAs={FaCalendar}
            style={{ width: compact ? 'auto' : 240 }}
        />
    );
};

export default DateRangePicker;