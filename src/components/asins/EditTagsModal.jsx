import React, { useState, useEffect } from 'react';
import {
  Modal,
  Segmented,
  Select,
  Input,
  Button,
  Tag,
  Space,
  Divider,
  Form,
  Table,
  Popconfirm,
  Typography,
  message,
  Card,
  Alert,
  Avatar
} from 'antd';
import {
  Tag as TagIcon,
  Settings,
  History,
  Plus,
  Search,
  Edit3,
  Trash2,
  Check,
  X,
  Clock,
  Save,
  AlertCircle
} from 'lucide-react';
import { asinApi } from '../../services/api';
import TagsHistoryModal from '../TagsHistoryModal';

const DEFAULT_TAGS = [
  'Best Seller', 'Low Margin', 'High Margin', 'Needs Optimization', 'Suppressed',
  'A+ Content Missing', 'Low LQS', 'Title Needs Work', 'Bullet Points Missing',
  'Images Low', 'Description Short',
  'BuyBox Lost', 'BuyBox Won', 'Price Drop', 'Price Increase',
  'New Launch', 'New 30D', '30-60 Days', '60-90 Days', '90-180 Days',
  '180-365 Days', '365+ Days', 'Growth Phase', 'Established', 'Mature',
  'MAP Violation', 'Hijacker Alert', 'Inventory Low', 'Out of Stock', 'Review Alert', 'Competitor Alert',
  'Ad Active', 'No Ads',
  'High Potential', 'Trending Up', 'Trending Down', 'Seasonal', 'Clearance', 'Replenishment', 'Discontinued'
];

const EditTagsModal = ({ isOpen, onClose, asin, onUpdate }) => {
  const [tags, setTags] = useState([]);
  const [originalTags, setOriginalTags] = useState([]);
  const [predefinedTags, setPredefinedTags] = useState([]);
  const [assignSearch, setAssignSearch] = useState('');
  const [manageSearch, setManageSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Tag management states (viewMode: 'assign' | 'manage')
  const [viewMode, setViewMode] = useState('assign');
  const [newTagName, setNewTagName] = useState('');
  const [newTagCategory, setNewTagCategory] = useState('General');
  const [editingTagId, setEditingTagId] = useState(null);
  const [editingTagName, setEditingTagName] = useState('');
  const [editingTagCategory, setEditingTagCategory] = useState('');
  const [submittingTag, setSubmittingTag] = useState(false);

  const CATEGORIES = ['Performance', 'Content', 'BuyBox', 'Lifecycle', 'Risk', 'Ads', 'Opportunity', 'General'];

  // Load predefined tags from database
  const fetchPredefinedTags = async () => {
    try {
      const res = await asinApi.getPredefinedTags();
      if (res.success) {
        setPredefinedTags(res.data);
      }
    } catch (err) {
      console.error('Failed to load predefined tags:', err);
      // Fallback
      setPredefinedTags(
        DEFAULT_TAGS.map((name, idx) => ({ id: `static-${idx}`, name, category: 'General' }))
      );
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPredefinedTags();
      setAssignSearch('');
      setManageSearch('');
      setActiveCategory('All');
    }
  }, [isOpen]);

  // Load current tags and summary
  useEffect(() => {
    if (asin) {
      let currentTags = [];
      try {
        if (asin.tags && Array.isArray(asin.tags)) {
          currentTags = asin.tags;
        } else if (asin.Tags && typeof asin.Tags === 'string') {
          currentTags = JSON.parse(asin.Tags);
        } else if (asin.Tags && Array.isArray(asin.Tags)) {
          currentTags = asin.Tags;
        }
      } catch (e) {
        currentTags = [];
      }
      setTags(currentTags);
      setOriginalTags([...currentTags]);

      const fetchSummary = async () => {
        setLoadingSummary(true);
        try {
          const res = await asinApi.getTagsSummary(asin._id || asin.id);
          if (res.success) {
            setSummary(res.data);
            if (res.data.currentTags && JSON.stringify([...res.data.currentTags].sort()) !== JSON.stringify([...currentTags].sort())) {
              setTags(res.data.currentTags);
              setOriginalTags([...res.data.currentTags]);
            }
          }
        } catch (err) {
          console.error('Failed to fetch tags summary:', err);
        }
        setLoadingSummary(false);
      };
      fetchSummary();
    }
  }, [asin]);

  const getTagCategory = (tagName) => {
    const found = predefinedTags.find(t => t.name === tagName);
    return found ? found.category : 'Custom';
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'Performance': return 'green';
      case 'Content': return 'blue';
      case 'BuyBox': return 'orange';
      case 'Lifecycle': return 'purple';
      case 'Risk': return 'red';
      case 'Ads': return 'cyan';
      case 'Opportunity': return 'gold';
      case 'General': return 'geekblue';
      case 'Assigned': return 'magenta';
      case 'Custom': return 'volcano';
      default: return 'default';
    }
  };

  const getCategoryHexColor = (category) => {
    switch (category) {
      case 'Performance': return '#52c41a'; // Green
      case 'Content': return '#1890ff'; // Blue
      case 'BuyBox': return '#fa8c16'; // Orange
      case 'Lifecycle': return '#722ed1'; // Purple
      case 'Risk': return '#f5222d'; // Red
      case 'Ads': return '#13c2c2'; // Cyan
      case 'Opportunity': return '#faad14'; // Gold
      case 'General': return '#2f54eb'; // Geekblue
      case 'Assigned': return '#eb2f96'; // Magenta
      case 'Custom': return '#fa541c'; // Volcano
      default: return '#8c8c8c'; // Gray
    }
  };

  // Group predefined tags by category dynamically
  const dynamicCategories = { 'All': [], 'Assigned': [...tags] };

  predefinedTags.forEach(tag => {
    dynamicCategories['All'].push(tag.name);
    if (!dynamicCategories[tag.category]) {
      dynamicCategories[tag.category] = [];
    }
    dynamicCategories[tag.category].push(tag.name);
  });

  tags.forEach(t => {
    if (!dynamicCategories['All'].includes(t)) {
      dynamicCategories['All'].push(t);
    }
  });

  // Filter tags by search and category
  const filteredTags = (() => {
    let pool = activeCategory === 'All'
      ? dynamicCategories['All']
      : (dynamicCategories[activeCategory] || []);
    if (assignSearch.trim()) {
      pool = pool.filter(t => t.toLowerCase().includes(assignSearch.toLowerCase()));
    }
    return pool;
  })();

  const filteredPredefinedTags = manageSearch.trim()
    ? predefinedTags.filter(t => t.name.toLowerCase().includes(manageSearch.toLowerCase()) || t.category.toLowerCase().includes(manageSearch.toLowerCase()))
    : predefinedTags;

  const toggleTag = (tag) => {
    setTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSave = async () => {
    const currentSorted = [...tags].sort().join(',');
    const originalSorted = [...originalTags].sort().join(',');

    if (currentSorted === originalSorted) {
      message.info('No changes made');
      return;
    }

    setSaving(true);

    try {
      const response = await asinApi.updateTags(asin._id || asin.id, tags);
      if (response.success) {
        setOriginalTags([...tags]);
        message.success('Tags updated successfully!');
        if (onUpdate) onUpdate(asin._id || asin.id, tags);
        setTimeout(() => onClose(), 800);
      }
    } catch (err) {
      message.error(err.message || 'Failed to save tags');
    }
    setSaving(false);
  };

  // Predefined tags CRUD Handlers
  const handleAddPredefinedTag = async (e) => {
    e.preventDefault();
    const name = newTagName.trim();
    if (!name) return;

    setSubmittingTag(true);

    try {
      const res = await asinApi.addPredefinedTag({ name, category: newTagCategory });
      if (res.success) {
        message.success(`Tag "${name}" added to predefined list`);
        setNewTagName('');
        setNewTagCategory('General');
        await fetchPredefinedTags();
      }
    } catch (err) {
      message.error(err.message || 'Failed to create predefined tag');
    }
    setSubmittingTag(false);
  };

  const handleStartEdit = (tag) => {
    setEditingTagId(tag.id);
    setEditingTagName(tag.name);
    setEditingTagCategory(tag.category);
  };

  const handleCancelEdit = () => {
    setEditingTagId(null);
    setEditingTagName('');
    setEditingTagCategory('');
  };

  const handleSaveEdit = async (id) => {
    const name = editingTagName.trim();
    if (!name) return;

    setSubmittingTag(true);

    try {
      const res = await asinApi.updatePredefinedTag(id, { name, category: editingTagCategory });
      if (res.success) {
        message.success('Predefined tag updated');
        setEditingTagId(null);
        await fetchPredefinedTags();
      }
    } catch (err) {
      message.error(err.message || 'Failed to update tag');
    }
    setSubmittingTag(false);
  };

  const handleDeletePredefinedTag = async (id, name) => {
    setSubmittingTag(true);

    try {
      const res = await asinApi.deletePredefinedTag(id);
      if (res.success) {
        message.success(`Tag "${name}" removed from predefined list`);
        await fetchPredefinedTags();
      }
    } catch (err) {
      message.error(err.message || 'Failed to delete tag');
    }
    setSubmittingTag(false);
  };

  const hasChanges = [...tags].sort().join(',') !== [...originalTags].sort().join(',');

  // Columns configuration for predefined tags management table
  const columns = [
    {
      title: 'Tag Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => {
        if (editingTagId === record.id) {
          return (
            <Input
              value={editingTagName}
              onChange={e => setEditingTagName(e.target.value)}
              size="small"
            />
          );
        }
        return <Typography.Text strong>{text}</Typography.Text>;
      }
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (text, record) => {
        if (editingTagId === record.id) {
          return (
            <Select
              value={editingTagCategory}
              onChange={setEditingTagCategory}
              size="small"
              style={{ width: '120px' }}
            >
              {CATEGORIES.map(cat => (
                <Select.Option key={cat} value={cat}>{cat}</Select.Option>
              ))}
            </Select>
          );
        }
        return <Tag color={getCategoryColor(text)}>{text}</Tag>;
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'right',
      render: (_, record) => {
        if (editingTagId === record.id) {
          return (
            <Space size="small">
              <Button
                type="primary"
                shape="circle"
                icon={<Check size={14} />}
                size="small"
                onClick={() => handleSaveEdit(record.id)}
                loading={submittingTag}
              />
              <Button
                shape="circle"
                icon={<X size={14} />}
                size="small"
                onClick={handleCancelEdit}
                disabled={submittingTag}
              />
            </Space>
          );
        }
        return (
          <Space size="small">
            <Button
              type="text"
              icon={<Edit3 size={14} />}
              size="small"
              onClick={() => handleStartEdit(record)}
              disabled={submittingTag}
            />
            <Popconfirm
              title="Delete predefined tag?"
              description="Are you sure you want to delete this predefined tag? This won't affect ASINs already having this tag."
              onConfirm={() => handleDeletePredefinedTag(record.id, record.name)}
              okText="Yes"
              cancelText="No"
            >
              <Button
                type="text"
                danger
                icon={<Trash2 size={14} />}
                size="small"
                disabled={submittingTag}
              />
            </Popconfirm>
          </Space>
        );
      }
    }
  ];

  return (
    <>
      <Modal
        title={
          <Space>
            <TagIcon size={18} className="text-indigo-600" />
            <Typography.Text strong style={{ fontSize: '16px' }}>
              {viewMode === 'assign' ? 'Edit ASIN Tags' : 'Manage Predefined Tags'}
            </Typography.Text>
          </Space>
        }
        open={isOpen}
        onCancel={onClose}
        width={720}
        footer={
          viewMode === 'assign' ? [
            <Button key="cancel" onClick={onClose} disabled={saving}>
              Cancel
            </Button>,
            <Button
              key="save"
              type="primary"
              onClick={handleSave}
              loading={saving}
              disabled={!hasChanges}
              icon={<Save size={14} />}
            >
              Save Tags
            </Button>
          ] : [
            <Button key="back" type="primary" onClick={() => setViewMode('assign')}>
              Back to Assign Tags
            </Button>
          ]
        }
        destroyOnHidden
      >
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          {/* Subheader Metadata */}
          <div className="d-flex justify-content-between align-items-center bg-light p-2 rounded">
            <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
              ASIN Code: <Typography.Text strong>{asin.asinCode}</Typography.Text>
            </Typography.Text>

            <Space>
              {loadingSummary ? (
                <Typography.Text type="secondary" style={{ fontSize: '11px' }}>Loading summary...</Typography.Text>
              ) : summary?.recentChanges?.[0] ? (
                <Typography.Text type="secondary" style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={10} style={{ display: 'inline', verticalAlign: 'middle' }} />
                  <span>Last modified by:</span>
                  {summary.recentChanges[0].user?.avatar ? (
                    <Avatar src={summary.recentChanges[0].user.avatar} size={16} />
                  ) : (
                    <Avatar size={16} style={{ backgroundColor: '#f0f5ff', color: '#2f54eb', fontSize: '8px', fontWeight: 'bold' }}>
                      {(summary.recentChanges[0].user?.firstName || summary.recentChanges[0].userName || 'U')[0].toUpperCase()}
                    </Avatar>
                  )}
                  <Typography.Text strong>
                    {summary.recentChanges[0].user
                      ? `${summary.recentChanges[0].user.firstName || ''} ${summary.recentChanges[0].user.lastName || ''}`.trim()
                      : summary.recentChanges[0].userName}
                  </Typography.Text>
                  <span>on {new Date(summary.recentChanges[0].createdAt).toLocaleDateString()}</span>
                </Typography.Text>
              ) : null}

              <Button
                type="text"
                size="small"
                icon={<History size={14} />}
                onClick={() => setShowHistory(true)}
              >
                Audit Log
              </Button>
            </Space>
          </div>

          {/* Mode Switcher */}
          <Segmented
            block
            value={viewMode}
            onChange={setViewMode}
            options={[
              { label: 'Assign Tags to ASIN', value: 'assign', icon: <TagIcon size={14} className="me-2" /> },
              { label: 'Manage Predefined Tags', value: 'manage', icon: <Settings size={14} className="me-2" /> }
            ]}
          />

          {viewMode === 'assign' ? (
            <>
              {/* Select component supporting tags mode */}
              <div style={{ width: '100%' }}>
                <Typography.Paragraph strong style={{ marginBottom: '6px', fontSize: '12px' }}>
                  Selected ASIN Tags (Select existing or type and press Enter to create custom):
                </Typography.Paragraph>
                <Select
                  mode="tags"
                  style={{ width: '100%' }}
                  placeholder="Type to create or select tags..."
                  value={tags}
                  onChange={setTags}
                  tokenSeparators={[',']}
                  allowClear
                  optionFilterProp="value"
                  optionLabelProp="value"
                  options={Array.from(new Set([...predefinedTags.map(t => t.name), ...tags])).map(tagName => {
                    const category = getTagCategory(tagName);
                    return {
                      value: tagName,
                      label: (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                          <span>{tagName}</span>
                          <span style={{ fontSize: '10px', color: '#8c8c8c', background: '#f5f5f5', padding: '2px 6px', borderRadius: '4px' }}>
                            {category}
                          </span>
                        </div>
                      )
                    };
                  })}
                />
              </div>

              <Divider style={{ margin: '12px 0' }} />

              {/* Category Pills & Predefined Checkable Tags */}
              <div>
                <Typography.Paragraph strong style={{ marginBottom: '8px', fontSize: '12px' }}>
                  Select Predefined Tags:
                </Typography.Paragraph>

                {/* Category selectors */}
                <Space size="small" wrap style={{ marginBottom: '12px' }}>
                  {Object.keys(dynamicCategories).map(cat => {
                    const isCatSelected = activeCategory === cat;
                    const colorHex = getCategoryHexColor(cat);
                    return (
                      <Tag.CheckableTag
                        key={cat}
                        checked={isCatSelected}
                        onChange={() => setActiveCategory(cat)}
                        style={{
                          border: isCatSelected ? `1px solid ${colorHex}` : '1px solid #d9d9d9',
                          borderRadius: '12px',
                          padding: '2px 10px',
                          fontSize: '11px',
                          backgroundColor: isCatSelected ? `${colorHex}15` : '#ffffff',
                          color: isCatSelected ? colorHex : '#595959',
                          transition: 'all 0.2s'
                        }}
                      >
                        {cat}
                      </Tag.CheckableTag>
                    );
                  })}
                </Space>

                {/* Filter tags search input */}
                <Input
                  prefix={<Search size={14} className="text-zinc-400" />}
                  placeholder="Filter tags..."
                  value={assignSearch}
                  onChange={e => setAssignSearch(e.target.value)}
                  style={{ marginBottom: '12px' }}
                  allowClear
                />

                {/* Tags Grid */}
                <Card size="small" style={{ background: '#fcfcfc', maxHeight: '250px', overflowY: 'auto' }}>
                  <div className="d-flex flex-wrap gap-2">
                    {filteredTags.map(tagName => {
                      const isSelected = tags.includes(tagName);
                      const category = getTagCategory(tagName);
                      const colorHex = getCategoryHexColor(category);
                      return (
                        <Tag.CheckableTag
                          key={tagName}
                          checked={isSelected}
                          onChange={() => toggleTag(tagName)}
                          style={{
                            border: isSelected ? `1px solid ${colorHex}` : '1px solid #d9d9d9',
                            padding: '4px 10px',
                            fontSize: '12px',
                            backgroundColor: isSelected ? `${colorHex}15` : '#ffffff',
                            color: isSelected ? colorHex : '#434343',
                            borderRadius: '6px',
                            userSelect: 'none',
                            transition: 'all 0.2s',
                            cursor: 'pointer'
                          }}
                        >
                          {isSelected ? '✓ ' : '+ '}
                          {tagName}
                        </Tag.CheckableTag>
                      );
                    })}
                    {filteredTags.length === 0 && (
                      <div className="text-center w-100 py-3 text-muted">
                        No predefined tags match the filter.
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </>
          ) : (
            /* Manage Predefined Tags View */
            <>
              {/* Form to create predefined tag */}
              <Card size="small" title="Create Predefined Tag" style={{ background: '#fafafa' }}>
                <Form layout="inline" onSubmitCapture={handleAddPredefinedTag}>
                  <Form.Item style={{ flex: 1, marginRight: '8px' }}>
                    <Input
                      placeholder="Tag Name (e.g. Clearance)"
                      value={newTagName}
                      onChange={e => setNewTagName(e.target.value)}
                      required
                    />
                  </Form.Item>
                  <Form.Item style={{ width: '150px', marginRight: '8px' }}>
                    <Select
                      value={newTagCategory}
                      onChange={setNewTagCategory}
                    >
                      {CATEGORIES.map(cat => (
                        <Select.Option key={cat} value={cat}>{cat}</Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      disabled={!newTagName.trim() || submittingTag}
                      icon={<Plus size={14} />}
                    >
                      Add
                    </Button>
                  </Form.Item>
                </Form>
              </Card>

              {/* Predefined Tags Listing with Search Filter */}
              <div style={{ marginTop: '8px' }}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <Typography.Text type="secondary" strong style={{ fontSize: '12px' }}>
                    Tags List ({filteredPredefinedTags.length})
                  </Typography.Text>
                  <div style={{ width: '220px' }}>
                    <Input
                      placeholder="Search predefined tags..."
                      prefix={<Search size={12} className="text-zinc-400" />}
                      value={manageSearch}
                      onChange={e => setManageSearch(e.target.value)}
                      size="small"
                      allowClear
                    />
                  </div>
                </div>

                <Table
                  dataSource={filteredPredefinedTags}
                  columns={columns}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  scroll={{ y: 280 }}
                  bordered
                />
              </div>
            </>
          )}
        </Space>
      </Modal>

      {/* Tags History Modal */}
      <TagsHistoryModal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        asinId={asin._id || asin.id}
        asinCode={asin.asinCode}
      />
    </>
  );
};

export default EditTagsModal;
