import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Plus, Search, Play, FileText, ThumbsUp, ThumbsDown } from 'lucide-react';
import ActionModal from '../components/actions/ActionModal';
import CompletionModal from '../components/actions/CompletionModal';
import ReviewModal from '../components/actions/ReviewModal';
import { useNavigate } from 'react-router-dom';
import { 
  Table, Button, Input, Select, Space, Tag, 
  Tooltip, Avatar, Spin, Card, Typography, 
  message as antdMessage 
} from 'antd';

const { Text, Title } = Typography;

const TasksOperationsPage = ({ isEmbedded = false }) => {
    const [actions, setActions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
    const [editingAction, setEditingAction] = useState(null);
    const [completingAction, setCompletingAction] = useState(null);
    const [reviewingAction, setReviewingAction] = useState(null);
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [users, setUsers] = useState([]);
    const [asins, setAsins] = useState([]);
    const navigate = useNavigate();
    const currentUser = db.getUser();

    const loadTasks = async () => {
        setLoading(true);
        try {
            const res = await db.getActions();
            const loadedActions = res?.data || (Array.isArray(res) ? res : []);
            setActions(loadedActions);

            // Fetch Users & ASINs
            const usersRes = await db.getUsers();
            if (usersRes && usersRes.success !== false) setUsers(Array.isArray(usersRes) ? usersRes : usersRes.data || []);

            const asinsRes = await db.getAsins();
            if (asinsRes && asinsRes.success !== false) setAsins(Array.isArray(asinsRes) ? asinsRes : asinsRes.asins || asinsRes.data || []);
        } catch (err) {
            console.error("Failed to load tasks:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTasks();
    }, []);

    const filteredActions = actions.filter(action => {
        const matchesStatus = filterStatus ? action.status === filterStatus : true;
        const matchesSearch = searchQuery
            ? action.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            action.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            action.sellerId?.name?.toLowerCase().includes(searchQuery.toLowerCase())
            : true;
        return matchesStatus && matchesSearch;
    });

    const handleEditAction = (action) => {
        setEditingAction(action);
        setIsActionModalOpen(true);
    };

    const handleSaveAction = async (data) => {
        try {
            if (data._id || data.id) {
                await db.updateAction(data._id || data.id, data);
                antdMessage.success('Task updated successfully');
            } else {
                await db.createAction(data);
                antdMessage.success('Task created successfully');
            }
            setIsActionModalOpen(false);
            loadTasks();
        } catch (error) {
            console.error('Failed to save action', error);
            antdMessage.error('Failed to save action');
        }
    };

    const handleStartTask = async (action) => {
        const id = action?._id || action?.id || action;
        try {
            setLoading(true);
            await db.startAction(id);
            antdMessage.success('Task started successfully');
            loadTasks();
        } catch (err) {
            console.error("Failed to start task:", err);
            antdMessage.error('Failed to start task');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitForReview = (action) => {
        setCompletingAction(action);
        setIsCompletionModalOpen(true);
    };

    const handleCompletionSubmit = async (actionId, data) => {
        try {
            setLoading(true);
            if (data.stage === 'REVIEW') {
                await db.submitActionForReview(actionId, data);
                antdMessage.success('Task submitted for review');
            } else {
                await db.completeAction(actionId, data);
                antdMessage.success('Task completed successfully');
            }
            setIsCompletionModalOpen(false);
            setCompletingAction(null);
            loadTasks();
        } catch (err) {
            console.error("Failed to process task completion:", err);
            antdMessage.error("Action failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleReviewAction = async (action, decision, comments) => {
        if (!action) return;

        try {
            setLoading(true);
            await db.reviewAction(action._id || action.id, { decision, comments });
            await loadTasks();
            antdMessage.success(`Task successfully ${decision === 'APPROVE' ? 'approved' : 'rejected'}`);
            return true;
        } catch (error) {
            console.error('Failed to review action:', error);
            antdMessage.error('Review failed. Please try again.');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const openReviewModal = (action) => {
        setReviewingAction(action);
        setIsReviewModalOpen(true);
    };

    const getStatusTag = (status) => {
        const s = String(status || 'PENDING').toUpperCase();
        if (s === 'COMPLETED') return <Tag color="success" style={{ borderRadius: '12px', fontWeight: 600 }}>COMPLETED</Tag>;
        if (s === 'IN_PROGRESS') return <Tag color="processing" style={{ borderRadius: '12px', fontWeight: 600 }}>IN PROGRESS</Tag>;
        if (s === 'REVIEW') return <Tag color="magenta" style={{ borderRadius: '12px', fontWeight: 600 }}>REVIEW</Tag>;
        if (s === 'PENDING') return <Tag color="warning" style={{ borderRadius: '12px', fontWeight: 600 }}>PENDING</Tag>;
        return <Tag color="error" style={{ borderRadius: '12px', fontWeight: 600 }}>{s}</Tag>;
    };

    const columns = [
        {
            title: 'Action',
            key: 'action',
            render: (_, record) => (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Text strong style={{ color: '#1e293b' }}>{record.title}</Text>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '300px' }}>
                        {record.description}
                    </div>
                </div>
            )
        },
        {
            title: 'Type',
            dataIndex: 'type',
            key: 'type',
            render: (type) => (
                <Tag style={{ textTransform: 'capitalize', borderRadius: '4px', background: '#f1f5f9', color: '#475569', border: 'none' }}>
                    {type?.toLowerCase().replace('_', ' ')}
                </Tag>
            )
        },
        {
            title: 'Seller',
            key: 'seller',
            render: (_, record) => (
                <div>
                    <div style={{ fontWeight: 600, color: '#334155' }}>{record.sellerId?.name || '--'}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{record.sellerId?.marketplace}</div>
                </div>
            )
        },
        {
            title: 'Linked ASINs',
            dataIndex: 'asins',
            key: 'asins',
            render: (asinsList) => {
                if (!asinsList || asinsList.length === 0) return <Text type="secondary">--</Text>;
                return (
                    <Space size={4} wrap>
                        {asinsList.slice(0, 2).map((asin, i) => (
                            <Tag key={asin._id || asin.id || i} style={{ margin: 0, fontSize: '11px', borderRadius: '4px' }}>
                                {asin.asinCode || asin.asin || asin}
                            </Tag>
                        ))}
                        {asinsList.length > 2 && (
                            <Tooltip title={asinsList.slice(2).map(a => a.asinCode || a.asin || a).join(', ')}>
                                <Tag style={{ cursor: 'help', margin: 0, fontSize: '11px', borderRadius: '4px' }}>+{asinsList.length - 2}</Tag>
                            </Tooltip>
                        )}
                    </Space>
                );
            }
        },
        {
            title: 'Assignee',
            key: 'assignee',
            render: (_, record) => {
                const firstName = record.assignedTo?.firstName;
                const lastName = record.assignedTo?.lastName;
                if (!firstName) return <Text type="secondary">Unassigned</Text>;
                return (
                    <Space size={8}>
                        <Avatar size={24} style={{ backgroundColor: '#3b82f6', fontSize: '11px' }}>
                            {firstName.charAt(0).toUpperCase()}
                        </Avatar>
                        <span>{firstName} {lastName}</span>
                    </Space>
                );
            }
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status) => getStatusTag(status)
        },
        {
            title: 'Activity',
            key: 'activity',
            align: 'right',
            render: (_, record) => {
                const isPending = record.status === 'PENDING';
                const isInProgress = record.status === 'IN_PROGRESS';
                const isReview = record.status === 'REVIEW';
                
                const canReview = ((currentUser?.role === 'admin' || currentUser?.role?.name === 'admin') ||
                    ((currentUser?.role === 'manager' || currentUser?.role?.name === 'manager') &&
                        (record.assignedTo?._id || record.assignedTo) !== currentUser?._id));

                return (
                    <Space size={8} onClick={(e) => e.stopPropagation()}>
                        {isPending && (
                            <Tooltip title="Start Task">
                                <Button 
                                    shape="circle" 
                                    icon={<Play size={12} />} 
                                    onClick={(e) => { e.stopPropagation(); handleStartTask(record); }} 
                                    type="primary" 
                                    ghost 
                                />
                            </Tooltip>
                        )}
                        {isInProgress && (
                            <Tooltip title="Submit for Review">
                                <Button 
                                    shape="circle" 
                                    icon={<FileText size={12} />} 
                                    onClick={(e) => { e.stopPropagation(); handleSubmitForReview(record); }} 
                                    type="primary"
                                />
                            </Tooltip>
                        )}
                        {isReview && canReview && (
                            <>
                                <Tooltip title="Approve">
                                    <Button 
                                        shape="circle" 
                                        icon={<ThumbsUp size={12} />} 
                                        onClick={(e) => { e.stopPropagation(); openReviewModal(record); }} 
                                        style={{ color: '#10b981', borderColor: '#10b981' }} 
                                    />
                                </Tooltip>
                                <Tooltip title="Reject">
                                    <Button 
                                        shape="circle" 
                                        icon={<ThumbsDown size={12} />} 
                                        onClick={(e) => { e.stopPropagation(); openReviewModal(record); }} 
                                        danger 
                                    />
                                </Tooltip>
                            </>
                        )}
                        <Tooltip title="Edit Details">
                            <Button 
                                shape="circle" 
                                icon={<Plus size={12} style={{ transform: 'rotate(45deg)' }} />} 
                                onClick={(e) => { e.stopPropagation(); handleEditAction(record); }} 
                            />
                        </Tooltip>
                    </Space>
                );
            }
        }
    ];

    if (loading && actions.length === 0) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', flex: 1 }}>
                <Spin size="large" description="Loading Operations..." />
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            {!isEmbedded && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', padding: '24px 24px 0 24px' }}>
                    <div>
                        <Title level={3} style={{ margin: 0, fontWeight: 700 }}>Task Operations</Title>
                        <Text type="secondary">Flat execution view for all tactical actions</Text>
                    </div>
                    <Button
                        type="primary"
                        shape="round"
                        size="large"
                        onClick={() => { setEditingAction(null); setIsActionModalOpen(true); }}
                        icon={<Plus size={16} />}
                        style={{ display: 'flex', alignItems: 'center', fontWeight: 600 }}
                    >
                        Create Task
                    </Button>
                </div>
            )}

            {/* Filtering & Controls */}
            <Card 
                styles={{ body: { padding: '16px' } }} 
                bordered={false} 
                style={{ marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', borderRadius: '12px' }}
            >
                <Space size={16} style={{ width: '100%' }}>
                    <Input
                        placeholder="Search tasks, sellers, or descriptions..."
                        prefix={<Search size={16} style={{ color: '#94a3b8' }} />}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ width: 350, borderRadius: '8px' }}
                        size="large"
                        allowClear
                    />
                    <Select
                        value={filterStatus}
                        onChange={setFilterStatus}
                        style={{ width: 200 }}
                        size="large"
                        placeholder="Filter Status"
                        options={[
                            { value: '', label: 'All Statuses' },
                            { value: 'PENDING', label: 'Pending' },
                            { value: 'IN_PROGRESS', label: 'In Progress' },
                            { value: 'REVIEW', label: 'Review' },
                            { value: 'COMPLETED', label: 'Completed' }
                        ]}
                    />
                </Space>
            </Card>

            {/* Responsive Operational Datatable */}
            <div className="card border-0 shadow-sm overflow-hidden flex-fill" style={{ borderRadius: '16px', background: '#ffffff' }}>
                <Table
                    dataSource={filteredActions}
                    columns={columns}
                    rowKey={(record) => record._id || record.id}
                    loading={loading}
                    pagination={{ pageSize: 10, showSizeChanger: true }}
                    scroll={{ x: 'max-content' }}
                    onRow={(record) => ({
                        onClick: () => handleEditAction(record),
                        style: { cursor: 'pointer' }
                    })}
                    className="antd-ops-table"
                />
            </div>

            {/* Overlays */}
            <ActionModal
                isOpen={isActionModalOpen}
                onClose={() => { setIsActionModalOpen(false); setEditingAction(null); }}
                onSave={handleSaveAction}
                action={editingAction}
                currentUser={currentUser}
                asins={asins}
                users={users}
            />

            <ReviewModal
                isOpen={isReviewModalOpen}
                action={reviewingAction}
                onClose={() => {
                    setIsReviewModalOpen(false);
                    setReviewingAction(null);
                }}
                onReview={handleReviewAction}
            />

            {isCompletionModalOpen && completingAction && (
                <CompletionModal
                    isOpen={isCompletionModalOpen}
                    action={completingAction}
                    onClose={() => { setIsCompletionModalOpen(false); setCompletingAction(null); }}
                    onComplete={handleCompletionSubmit}
                />
            )}
        </div>
    );
};

export default TasksOperationsPage;