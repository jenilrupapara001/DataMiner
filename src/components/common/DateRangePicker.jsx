import React, { useMemo } from 'react';
import { DatePicker } from 'antd';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const DateRangePicker = ({
    // Legacy/Context-specific props
    startDate,
    endDate,
    onDateChange,

    // Standard React controlled props
    value,
    onChange,

    placeholder = ['Start date', 'End date'],
    style,
    className,
    ...rest
}) => {
    // Map value/dates to dayjs objects
    const activeValue = useMemo(() => {
        const toDayjs = (val) => {
            if (!val) return null;
            const d = dayjs(val);
            return d.isValid() ? d : null;
        };

        if (value !== undefined && Array.isArray(value)) {
            return [toDayjs(value[0]), toDayjs(value[1])];
        }
        const s = toDayjs(startDate);
        const e = toDayjs(endDate);
        return s && e ? [s, e] : null;
    }, [value, startDate, endDate]);

    const handleDateChange = (dates) => {
        if (onChange) {
            onChange(dates);
        }
        if (onDateChange) {
            if (dates && dates[0] && dates[1]) {
                onDateChange('custom', dates[0].toDate(), dates[1].toDate());
            } else {
                onDateChange('custom', null, null);
            }
        }
    };

    return (
        <RangePicker
            value={activeValue}
            onChange={handleDateChange}
            format="DD MMM YYYY"
            allowClear
            placeholder={Array.isArray(placeholder) ? placeholder : [placeholder, '']}
            style={{
                borderRadius: 6,
                width: 260,
                ...style
            }}
            className={className}
            {...rest}
        />
    );
};

export default DateRangePicker;