import React, { useState, useMemo } from 'react';
import { Typography, Tag, Button, Space, Tooltip, Card } from 'antd';
import { LeftOutlined, RightOutlined, EyeOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { WORKFLOW_STATUSES, PRIORITIES } from '../constants';
import { calculateHealth, getDueDateLabel } from '../utils/taskHealth';
import dayjs from 'dayjs';

const { Text } = Typography;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function CalendarView({ instances, onView, loading }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  // Group tasks by due date
  const tasksByDate = useMemo(() => {
    const map = {};
    instances.forEach(task => {
      if (!task.DueDate) return;
      const key = dayjs(task.DueDate).format('YYYY-MM-DD');
      if (!map[key]) map[key] = [];
      map[key].push(task);
    });
    return map;
  }, [instances]);

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><Text type="secondary">Loading...</Text></div>;

  return (
    <Card size="small" style={{ borderRadius: 10 }} styles={{ body: { padding: '12px 16px' } }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Button type="text" icon={<LeftOutlined />} onClick={prevMonth} size="small" />
        <Text strong style={{ fontSize: 15 }}>{MONTHS[month]} {year}</Text>
        <Button type="text" icon={<RightOutlined />} onClick={nextMonth} size="small" />
      </div>

      {/* Weekday headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {WEEKDAYS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#94a3b8', padding: '4px 0' }}>{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {days.map((day, i) => {
          if (day === null) return <div key={i} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
          const tasks = tasksByDate[dateStr] || [];
          const overdueCount = tasks.filter(t => {
            const due = new Date(t.DueDate);
            return due < new Date() && !['APPROVED', 'CANCELLED'].includes(t.Status);
          }).length;

          return (
            <div key={i} style={{
              padding: '4px 3px', borderRadius: 6, minHeight: 60,
              background: isToday ? '#eff6ff' : '#fff',
              border: isToday ? '2px solid #2563eb' : '1px solid #f1f5f9',
              cursor: tasks.length > 0 ? 'pointer' : 'default',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <Text style={{ fontSize: 11, fontWeight: isToday ? 800 : 500, color: isToday ? '#2563eb' : '#475569' }}>{day}</Text>
                {overdueCount > 0 && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626' }} />}
              </div>
              {tasks.slice(0, 3).map(task => {
                const cfg = WORKFLOW_STATUSES[task.Status] || {};
                return (
                  <Tooltip key={task.Id} title={`${task.Title} — ${task.Status}`}>
                    <div onClick={() => onView(task)} style={{
                      padding: '2px 4px', borderRadius: 3, marginBottom: 1,
                      background: `${cfg.color || '#64748b'}12`, border: `1px solid ${cfg.color || '#64748b'}20`,
                      fontSize: 8, color: cfg.color || '#64748b', fontWeight: 600,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      cursor: 'pointer', lineHeight: '12px',
                    }}>
                      {task.Title?.substring(0, 15) || 'Task'}
                    </div>
                  </Tooltip>
                );
              })}
              {tasks.length > 3 && (
                <Text style={{ fontSize: 8, color: '#94a3b8' }}>+{tasks.length - 3} more</Text>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginTop: 8, justifyContent: 'center' }}>
        {[
          { label: 'Today', color: '#2563eb' },
          { label: 'Overdue', color: '#dc2626' },
          { label: 'Tasks', color: '#64748b' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
            <Text style={{ fontSize: 10, color: '#94a3b8' }}>{l.label}</Text>
          </div>
        ))}
      </div>
    </Card>
  );
}
