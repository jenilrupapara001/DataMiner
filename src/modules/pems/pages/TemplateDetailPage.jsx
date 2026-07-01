import React, { useState, useEffect, useMemo } from 'react';
import { Card, Row, Col, Descriptions, Tag, Typography, Space, Spin, Button, Progress, Statistic, Timeline, Tabs, Empty, Badge, Divider, Table } from 'antd';
import { ArrowLeftOutlined, EditOutlined, CopyOutlined, CheckCircleOutlined, ClockCircleOutlined, TrophyOutlined, AimOutlined, BarChartOutlined, OrderedListOutlined, UserOutlined, SettingOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import pemsApi from '../services/pemsApi';
import { FREQUENCIES, CATEGORIES, PRIORITIES, DEPARTMENTS, SLA_STATUSES } from '../constants';

const { Text, Title } = Typography;

export default function TemplateDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [template, setTemplate] = useState(null);
  const [analytics, setAnalytics] = useState({});
  const [assignmentRules, setAssignmentRules] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await pemsApi.getTemplateDetail(id);
        if (res.success) {
          setTemplate(res.data);
          setAnalytics(res.data.analytics || {});
          setAssignmentRules(res.data.assignmentRules);
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, [id]);

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;
  if (!template) return <Empty description="Template not found" />;

  const subTasks = template.SubTaskDefinitions || [];
  const totalActivities = subTasks.reduce((s, st) => s + (st.activities?.length || 0), 0);
  const totalEstMinutes = subTasks.reduce((s, st) => s + (st.activities?.reduce((a, act) => a + (act.estimatedMinutes || 0), 0) || 0), 0);

  const tabItems = [
    {
      key: 'summary',
      label: <Space><AimOutlined /> Summary</Space>,
      children: (
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="Template Name" span={2}>{template.Name}</Descriptions.Item>
          <Descriptions.Item label="Description" span={2}>{template.Description || '-'}</Descriptions.Item>
          <Descriptions.Item label="Department">
            <Tag color="blue" style={{ borderRadius: 10 }}>{template.Department || 'Operations'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Category">{template.Category}</Descriptions.Item>
          <Descriptions.Item label="Frequency">{FREQUENCIES.find(f => f.value === template.Frequency)?.label || template.Frequency}</Descriptions.Item>
          <Descriptions.Item label="Priority">
            {(() => { const c = PRIORITIES[template.Priority] || PRIORITIES.MEDIUM; return <Tag style={{ background: c.bg, color: c.color, borderRadius: 10 }}>{c.label}</Tag>; })()}
          </Descriptions.Item>
          <Descriptions.Item label="SLA">{template.SLAHours}h</Descriptions.Item>
          <Descriptions.Item label="TAT">{template.TATHours}h</Descriptions.Item>
          <Descriptions.Item label="Target Type">{template.TargetType}</Descriptions.Item>
          <Descriptions.Item label="Default Target">{template.DefaultTarget}</Descriptions.Item>
          <Descriptions.Item label="Expected Output">{template.ExpectedOutput || '-'}</Descriptions.Item>
          <Descriptions.Item label="Complexity">{template.ExecutionComplexity || 'MEDIUM'}</Descriptions.Item>
          <Descriptions.Item label="Est. Time">{template.EstimatedExecutionMinutes || 0} min</Descriptions.Item>
          <Descriptions.Item label="Version">v{template.TemplateVersion || 1}</Descriptions.Item>
          <Descriptions.Item label="Review Required">{template.ReviewRequired ? 'Yes' : 'No'}</Descriptions.Item>
          <Descriptions.Item label="Auto Assign">{template.AutoAssignEnabled ? 'Yes' : 'No'}</Descriptions.Item>
          <Descriptions.Item label="Criticality">{template.CriticalityScore || 5}/10</Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={template.IsActive ? 'success' : 'default'}>{template.IsActive ? 'Active' : 'Inactive'}</Tag>
          </Descriptions.Item>
        </Descriptions>
      ),
    },
    {
      key: 'sop',
      label: <Space><OrderedListOutlined /> SOP ({subTasks.length} Phases, {totalActivities} Activities)</Space>,
      children: subTasks.length === 0 ? <Empty description="No SOP defined" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {subTasks.map((st, stIdx) => (
            <Card key={stIdx} size="small" title={
              <Space><Tag style={{ fontWeight: 700, fontFamily: 'monospace', background: '#f0fdfa', color: '#0d9488', border: '1px solid #99f6e4', borderRadius: 4 }}>Phase {stIdx + 1}</Tag>{st.title || st.name}</Space>
            } style={{ borderRadius: 8 }}>
              {(st.activities || []).map((act, actIdx) => (
                <div key={actIdx} style={{ padding: '8px 12px', borderBottom: actIdx < st.activities.length - 1 ? '1px solid #f1f5f9' : 'none', display: 'flex', gap: 10 }}>
                  <Tag style={{ fontSize: 9, fontWeight: 700, fontFamily: 'monospace', background: '#eef2ff', color: '#1976D2', borderRadius: 4, height: 20, alignSelf: 'flex-start' }}>Step {actIdx + 1}</Tag>
                  <div style={{ flex: 1 }}>
                    <Text strong style={{ fontSize: 12 }}>{act.title}</Text>
                    {act.instructions && <Text style={{ fontSize: 11, color: '#64748b', display: 'block', marginTop: 2 }}>{act.instructions}</Text>}
                    <Space style={{ marginTop: 4 }} size={8}>
                      {act.expectedOutput && <Tag style={{ fontSize: 9, background: '#ecfdf5', color: '#16a34a', borderRadius: 4 }}>Output: {act.expectedOutput}</Tag>}
                      {act.validationRules && <Tag style={{ fontSize: 9, background: '#fff7ed', color: '#E65100', borderRadius: 4 }}>Validation: {act.validationRules}</Tag>}
                      {act.estimatedMinutes && <Tag style={{ fontSize: 9, background: '#f8fafc', color: '#64748b', borderRadius: 4 }}>{act.estimatedMinutes}m</Tag>}
                    </Space>
                  </div>
                </div>
              ))}
            </Card>
          ))}
        </div>
      ),
    },
    {
      key: 'analytics',
      label: <Space><BarChartOutlined /> Analytics</Space>,
      children: (
        <Row gutter={[12, 12]}>
          <Col xs={12} sm={6}>
            <Card size="small" styles={{ body: { padding: '10px 14px' } }} style={{ borderRadius: 8, borderLeft: '3px solid #2563eb' }}>
              <Statistic title="Total Instances" value={analytics.totalInstances || 0} valueStyle={{ fontSize: 20, fontWeight: 800 }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small" styles={{ body: { padding: '10px 14px' } }} style={{ borderRadius: 8, borderLeft: '3px solid #16a34a' }}>
              <Statistic title="Completed" value={analytics.completedInstances || 0} valueStyle={{ fontSize: 20, fontWeight: 800, color: '#16a34a' }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small" styles={{ body: { padding: '10px 14px' } }} style={{ borderRadius: 8, borderLeft: '3px solid #2563eb' }}>
              <Statistic title="Completion Rate" value={`${analytics.completionRate || 0}%`} valueStyle={{ fontSize: 20, fontWeight: 800 }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small" styles={{ body: { padding: '10px 14px' } }} style={{ borderRadius: 8, borderLeft: '3px solid #f59e0b' }}>
              <Statistic title="Avg Achievement" value={`${analytics.avgAchievementPct || 0}%`} valueStyle={{ fontSize: 20, fontWeight: 800, color: '#f59e0b' }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small" styles={{ body: { padding: '10px 14px' } }} style={{ borderRadius: 8, borderLeft: '3px solid #16a34a' }}>
              <Statistic title="SLA Compliance" value={`${analytics.slaCompliance || 0}%`} valueStyle={{ fontSize: 20, fontWeight: 800, color: '#16a34a' }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small" styles={{ body: { padding: '10px 14px' } }} style={{ borderRadius: 8, borderLeft: '3px solid #9333ea' }}>
              <Statistic title="Avg Progress" value={`${analytics.avgProgress || 0}%`} valueStyle={{ fontSize: 20, fontWeight: 800, color: '#9333ea' }} />
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: 'assignment',
      label: <Space><UserOutlined /> Assignment Rules</Space>,
      children: assignmentRules ? (
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="Assignment Mode"><Tag color="blue">{assignmentRules.AssignmentMode}</Tag></Descriptions.Item>
          <Descriptions.Item label="Auto Strategy">{assignmentRules.AutoAssignStrategy || '-'}</Descriptions.Item>
          <Descriptions.Item label="Reviewer">{assignmentRules.ReviewerId || 'Not assigned'}</Descriptions.Item>
          <Descriptions.Item label="Backup Reviewer">{assignmentRules.BackupReviewerId || 'None'}</Descriptions.Item>
          <Descriptions.Item label="Escalation Hours">{assignmentRules.EscalationHours || 24}h</Descriptions.Item>
          <Descriptions.Item label="Approval Level"><Tag>{assignmentRules.ApprovalLevel || 'single'}</Tag></Descriptions.Item>
          <Descriptions.Item label="Quality Score Required">{assignmentRules.QualityScoreRequired ? 'Yes' : 'No'}</Descriptions.Item>
        </Descriptions>
      ) : <Empty description="No assignment rules configured" />,
    },
  ];

  return (
    <div style={{ background: '#f8fafc', minHeight: '100%', padding: '0 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/pems/templates')} size="small" />
          <Space>
            <Text code style={{ fontSize: 11 }}>{template.TaskCode}</Text>
            <Text strong style={{ fontSize: 16 }}>{template.Name}</Text>
          </Space>
          <Tag color={template.IsActive ? 'success' : 'default'} style={{ borderRadius: 10 }}>{template.IsActive ? 'Active' : 'Inactive'}</Tag>
          <Tag style={{ borderRadius: 10 }}>v{template.TemplateVersion || 1}</Tag>
        </Space>
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => navigate('/pems/templates')}>Edit</Button>
          <Button icon={<CopyOutlined />} size="small" onClick={() => navigate('/pems/templates')}>Clone</Button>
        </Space>
      </div>

      <Card size="small" style={{ borderRadius: 8 }} styles={{ body: { padding: '0 12px' } }}>
        <Tabs items={tabItems} />
      </Card>
    </div>
  );
}
