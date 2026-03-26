import React from 'react';
import Card from '../common/Card';
import { CheckCircle2, Clock, PlayCircle, MoreVertical, LayoutGrid } from 'lucide-react';

const TaskBoard = ({ tasks, loading }) => {
  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED': return <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill smallest">COMPLETED</span>;
      case 'IN_PROGRESS': return <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill smallest">IN PROGRESS</span>;
      case 'REVIEW': return <span className="badge bg-info-subtle text-info border border-info-subtle rounded-pill smallest">REVIEW</span>;
      default: return <span className="badge bg-light text-muted border rounded-pill smallest">PENDING</span>;
    }
  };

  return (
    <Card 
      title="Growth Execution Registry" 
      icon={LayoutGrid}
      extra={<button className="btn btn-sm btn-zinc-900 border-0 shadow-sm smallest px-3" style={{ borderRadius: 'var(--radius-full)', backgroundColor: '#18181B', color: '#fff' }}>VIEW ALL</button>}
    >
      <div className="table-responsive" style={{ minHeight: '400px' }}>
        <table className="table table-hover align-middle mb-0" style={{ fontSize: '13px' }}>
          <thead className="table-light text-muted text-uppercase" style={{ fontSize: '10px', letterSpacing: '0.05em' }}>
            <tr>
              <th className="ps-0 border-0">Action Item</th>
              <th className="border-0">Scope</th>
              <th className="border-0">Priority</th>
              <th className="border-0">Status</th>
              <th className="text-end pe-0 border-0"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="placeholder-glow">
                  <td colSpan="5"><div className="placeholder col-12 rounded" style={{ height: '30px' }}></div></td>
                </tr>
              ))
            ) : tasks && tasks.length > 0 ? (
              tasks.map((task) => (
                <tr key={task.id || task._id}>
                  <td className="ps-0 py-3">
                    <div className="fw-semibold text-dark">{task.title}</div>
                    <div className="smallest text-muted text-truncate" style={{ maxWidth: '300px' }}>{task.description}</div>
                  </td>
                  <td>
                    <span className="badge bg-light text-dark border-0 smallest">{task.scopeType}</span>
                  </td>
                  <td>
                    <div className="d-flex align-items-center gap-1">
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: task.priority === 'HIGH' ? '#ef4444' : task.priority === 'MEDIUM' ? '#f59e0b' : '#10b981' }}></div>
                      <span className="smallest fw-bold">{task.priority}</span>
                    </div>
                  </td>
                  <td>{getStatusBadge(task.status)}</td>
                  <td className="text-end pe-0">
                    <button className="btn btn-sm btn-icon btn-light rounded-circle">
                      <MoreVertical size={14} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="text-center py-5 text-muted small">No active growth tasks found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default TaskBoard;
