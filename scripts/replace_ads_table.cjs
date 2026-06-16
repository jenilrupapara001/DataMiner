const fs = require('fs');

const path = 'src/pages/AdsManagerPage.jsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add columns definition right before return (
const returnIndex = code.indexOf('  return (');

const columnsCode = `
  const getAntColumns = () => {
    const cols = [
      {
        title: 'IMAGE',
        dataIndex: 'imageUrl',
        key: 'imageUrl',
        
        width: 60,
        render: (url, record) => (
          <div style={{ width: '40px', height: '40px', margin: 'auto', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => setActiveHistoryRow(record)}>
            {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Package size={16} className="text-zinc-300" />}
          </div>
        )
      },
      {
        title: (
          <div className="d-flex flex-column align-items-stretch gap-1">
            <span className="text-zinc-500 smallest fw-bold text-start" style={{ letterSpacing: '0.05em', fontSize: '9px' }}>SELLER ACCOUNT</span>
            <div style={{ width: '100%', fontWeight: 'normal' }} onClick={(e) => e.stopPropagation()}>
              <InfiniteScrollSelect
                fetchData={fetchSellerDropdownData}
                value={selectedSeller}
                onSelect={(val) => setSelectedSeller(val)}
                placeholder="All Sellers"
              />
            </div>
          </div>
        ),
        key: 'identifier',
        
        width: 185,
        render: (_, record) => {
          const isParentRow = record.isParent === true;
          return (
            <div className="d-flex align-items-center gap-2" style={{ cursor: 'pointer' }} onClick={() => setActiveHistoryRow(record)}>
              {isParentRow && (
                <div 
                  onClick={(e) => { e.stopPropagation(); toggleParentExpand(record.asin); }}
                  className="d-flex align-items-center justify-content-center bg-zinc-100 hover-bg-zinc-200 rounded text-zinc-600"
                  style={{ width: '18px', height: '18px', cursor: 'pointer', flexShrink: 0 }}
                >
                  {expandedParents.has(record.asin) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </div>
              )}
              <div className="d-flex flex-column gap-0.5">
                <span className="fw-bold text-indigo-600 font-monospace" style={{ fontSize: '10px' }}>{record.asin}</span>
                {isParentRow && <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded smallest fw-bold" style={{ width: 'fit-content', fontSize: '8.5px' }}>{record.childCount} CHILDREN</span>}
              </div>
            </div>
          );
        }
      },
      {
        title: 'SKU',
        dataIndex: 'sku',
        key: 'sku',
        width: 110,
        render: (sku, record) => record.isParent ? <span className="badge bg-zinc-100 text-zinc-600 border px-2 py-1 rounded" style={{ fontSize: '9px' }}>GROUP</span> : <span style={{ fontWeight: 600, color: '#475569' }}>{sku}</span>
      },
      {
        title: 'PRODUCT DETAILS',
        key: 'productDetails',
        width: 200,
        render: (_, record) => (
          <div className="d-flex flex-column" style={{ maxWidth: '200px' }}>
            <span className="fw-bold text-zinc-800 text-truncate" title={record.title}>{record.title}</span>
            <span className="smallest text-zinc-400 fw-semibold">{record.brand} • {record.category}</span>
          </div>
        )
      },
      {
        title: 'TARGET',
        key: 'target',
        width: 70,
        align: 'center',
        render: () => <span style={{ color: '#cbd5e1', fontSize: '9px', fontWeight: 600 }}>NOT SET</span>
      }
    ];

    const buildMetricGroup = (title, key, icon, isCurrency = false, isPercent = false) => {
      const isExpanded = expandedCols[key];
      const children = [
        {
          title: 'AVG',
          key: \`\${key}_avg\`,
          width: 80,
          align: 'right',
          render: (_, record) => {
            const val = record[key] || 0;
            return <span className="fw-bold" style={{ fontSize: '11px', color: '#334155' }}>
              {isCurrency ? \`₹\${val.toLocaleString('en-IN')}\` : isPercent ? \`\${val.toFixed(2)}%\` : val.toLocaleString()}
            </span>;
          }
        },
        {
          title: 'TRN',
          key: \`\${key}_trn\`,
          width: 60,
          align: 'center',
          render: (_, record) => {
            const val = record[key] || 0;
            if (val === 0) return <span className="text-zinc-300">-</span>;
            return <Badge status="success" />;
          }
        }
      ];

      if (isExpanded) {
        activeDates.forEach(d => {
          children.push({
            title: <div className="text-center" style={{ fontSize: '9px', lineHeight: '1.1' }}><div className="text-zinc-400">{d.month}</div><div>{d.day}</div></div>,
            key: \`\${key}_\${d.raw}\`,
            width: 70,
            align: 'right',
            render: (_, record) => {
              const hist = record.weekHistory?.find(h => h.date === d.raw);
              const val = hist ? (hist[key] || 0) : 0;
              if (val === 0) return <span className="text-zinc-300">-</span>;
              return <span className="fw-semibold" style={{ fontSize: '10px', color: '#64748b' }}>
                {isCurrency ? \`₹\${val.toLocaleString('en-IN')}\` : isPercent ? \`\${val.toFixed(2)}%\` : val.toLocaleString()}
              </span>;
            }
          });
        });
      }

      return {
        title: (
          <div className="d-flex align-items-center justify-content-center gap-1 cursor-pointer" onClick={() => toggleCol(key)}>
            {icon}
            <span style={{ fontSize: '10px', letterSpacing: '0.05em' }}>{title}</span>
            <div className="bg-white rounded ms-1 p-0.5 border" style={{ display: 'flex' }}>
              {isExpanded ? <ChevronLeft size={10} className="text-zinc-400" /> : <ChevronRight size={10} className="text-zinc-400" />}
            </div>
          </div>
        ),
        children
      };
    };

    cols.push(buildMetricGroup('TOTAL SALES', 'totalSales', <FileBarChart size={12} />, true));
    cols.push(buildMetricGroup('ORDERS', 'orders', <Layers size={12} />));
    cols.push(buildMetricGroup('SPEND', 'spend', <BarChart3 size={12} />, true));
    cols.push(buildMetricGroup('CLICKS', 'clicks', <TrendUpIcon size={12} />));
    cols.push(buildMetricGroup('IMPRESSIONS', 'impressions', <Eye size={12} />));
    cols.push(buildMetricGroup('ROAS', 'roas', <RefreshCw size={12} />));
    cols.push(buildMetricGroup('ACOS', 'acos', <Target size={12} />, false, true));
    cols.push(buildMetricGroup('AD SALES', 'sales', <FileBarChart size={12} />, true));
    cols.push(buildMetricGroup('CVR', 'cvr', <Activity size={12} />, false, true));
    cols.push(buildMetricGroup('ORGANIC', 'organicSales', <BarChart3 size={12} />, true));
    cols.push(buildMetricGroup('VIEWS', 'pageViews', <Eye size={12} />));

    return cols;
  };

`;

code = code.substring(0, returnIndex) + columnsCode + code.substring(returnIndex);

const tableStartString = '{/* MAIN TABLE CONTAINER */}';
const tableEndString = '        {/* Table Footer / Meta Status & PAGINATION */}';

const startIdx = code.indexOf(tableStartString);
const endIdx = code.indexOf(tableEndString);

if (startIdx === -1 || endIdx === -1) {
  console.error("Could not find table boundaries");
  process.exit(1);
}

const tableReplacement = `      {/* MAIN TABLE CONTAINER */}
      <div className="flex-grow-1 overflow-hidden d-flex flex-column bg-white">
        <Table
          columns={getAntColumns()}
          dataSource={paginatedData}
          rowKey={(record) => record.id || record.asin}
          loading={loading}
          pagination={false}
          scroll={{ x: 'max-content', y: 'calc(100vh - 250px)' }}
          size="small"
          bordered
          rowClassName={(record, index) => index % 2 === 1 ? 'table-row-alt' : 'table-row-light'}
          expandable={{
            expandedRowRender: record => null,
            rowExpandable: record => record.isParent,
            expandedRowKeys: Array.from(expandedParents),
            expandIcon: () => null
          }}
        />
      </div>

`;

// Just replace everything from startIdx up to endIdx
code = code.substring(0, startIdx) + tableReplacement + code.substring(endIdx);

fs.writeFileSync(path, code);
console.log("Replaced successfully!");
