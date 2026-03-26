import React, { useState, useEffect, useMemo } from 'react';
import Filters from '../components/Filters';
import DataTable from '../components/DataTable';
import KPICard from '../components/KPICard';
import { asinApi, sellerApi } from '../services/api';

const InventoryPage = () => {
  const [data, setData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ 
    dateRange: 'month',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
    searchTerm: '', 
    status: 'all' 
  });

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const asinResponse = await asinApi.getAll({ limit: 500 });
        const sellerResponse = await sellerApi.getAll({ limit: 100 });

        const asins = asinResponse.asins || [];
        const sellers = sellerResponse.sellers || [];
        const totalAsins = asins.length || 10;

        // Generate inventory data based on ASINs from database
        const productNames = [
          'Wireless Bluetooth Headphones', 'USB-C Charging Cable', 'Smart Watch Pro',
          'Laptop Stand Aluminum', 'Mechanical Keyboard RGB', 'Wireless Mouse Ergonomic',
          'Monitor Light Bar', 'Webcam HD 1080p', 'Desk Organizer Premium', 'Phone Stand Adjustable'
        ];

        const inventoryData = asins.length > 0 ? asins.map((asin, idx) => {
          const quantity = Math.floor(Math.random() * 500);
          const reserved = Math.floor(quantity * 0.15);
          const available = quantity - reserved;
          const reorderPoint = Math.floor(Math.random() * 150) + 50;
          const status = quantity === 0 ? 'Out of Stock' : quantity < reorderPoint ? 'Low Stock' : 'In Stock';

          return {
            sku: `SKU-${String(idx + 1).padStart(3, '0')}`,
            productName: asin.title || productNames[idx % productNames.length],
            asin: asin.asin || `B08ABC${String(idx).padStart(3, '0')}`,
            quantity,
            reserved,
            available,
            reorderPoint,
            status,
            turnoverRate: parseFloat((2 + Math.random() * 7).toFixed(1)),
          };
        }) : productNames.map((name, idx) => {
          const quantity = Math.floor(Math.random() * 500);
          const reserved = Math.floor(quantity * 0.15);
          const available = quantity - reserved;
          const reorderPoint = Math.floor(Math.random() * 150) + 50;
          const status = quantity === 0 ? 'Out of Stock' : quantity < reorderPoint ? 'Low Stock' : 'In Stock';

          return {
            sku: `SKU-${String(idx + 1).padStart(3, '0')}`,
            productName: name,
            asin: `B08ABC${String(idx).padStart(3, '0')}`,
            quantity,
            reserved,
            available,
            reorderPoint,
            status,
            turnoverRate: parseFloat((2 + Math.random() * 7).toFixed(1)),
          };
        });

        // Generate monthly stock data
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const totalUnits = inventoryData.reduce((sum, item) => sum + item.quantity, 0);
        const monthlyStock = monthNames.map((month, idx) => {
          const baseStock = totalUnits || 30000;
          const seasonalGrowth = 1 + (idx / 11) * 0.3;
          const inflow = Math.round((baseStock / 12) * 1.1 * seasonalGrowth);
          const outflow = Math.round((baseStock / 12) * 0.95 * seasonalGrowth);
          const stock = Math.round(baseStock * seasonalGrowth * (0.9 + Math.random() * 0.2));
          return { month, inflow, outflow, stock };
        });

        setData(inventoryData);
        setMonthlyData(monthlyStock);
      } catch (error) {
        console.error('Failed to load inventory data:', error);
        setData([]);
        setMonthlyData([]);
      }
      setLoading(false);
    };
    loadData();
  }, [filters.startDate, filters.endDate]);

  const kpis = useMemo(() => {
    const totalUnits = data.reduce((sum, item) => sum + item.quantity, 0);
    const availableUnits = data.reduce((sum, item) => sum + item.available, 0);
    const lowStockCount = data.filter(item => item.status === 'Low Stock').length;
    const outOfStockCount = data.filter(item => item.status === 'Out of Stock').length;

    return [
      { title: 'Total Units', value: totalUnits.toLocaleString(), icon: 'bi-box-seam', trend: 5.2, trendType: 'positive' },
      { title: 'Available Units', value: availableUnits.toLocaleString(), icon: 'bi-box', trend: 4.8, trendType: 'positive' },
      { title: 'Low Stock Items', value: lowStockCount.toString(), icon: 'bi-exclamation-triangle', trend: 2, trendType: 'negative' },
      { title: 'Out of Stock', value: outOfStockCount.toString(), icon: 'bi-x-circle', trend: 1, trendType: 'negative' },
    ];
  }, [data]);

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const getStatusBadge = (item) => {
    const status = item.status;
    const statusMap = {
      'In Stock': { class: 'badge-success', label: 'In Stock' },
      'Low Stock': { class: 'badge-warning', label: 'Low Stock' },
      'Out of Stock': { class: 'badge-danger', label: 'Out of Stock' },
    };
    const { class: className, label } = statusMap[status] || { class: 'badge-secondary', label: String(status || '') };
    return <span className={`badge ${className}`}>{label}</span>;
  };

  if (loading) {
    return (
      <>
        <div className="page-header">
          <h1 className="page-title"><i className="bi bi-box-seam"></i>Inventory</h1>
        </div>
        <div className="page-content">
          <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
            <div className="loading-spinner"></div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title"><i className="bi bi-box-seam"></i>Inventory</h1>
      </div>
      <div className="page-content">
        <Filters filters={filters} onFilterChange={handleFilterChange} showDateRange={true} showSearch={true} />

        <div className="kpi-grid mb-4">
          {kpis.map((kpi, idx) => (
            <KPICard key={idx} title={kpi.title} value={kpi.value} icon={kpi.icon} trend={kpi.trend} trendType={kpi.trendType} />
          ))}
        </div>

        <DataTable
          title="Inventory Details"
          data={data}
          columns={['sku', 'productName', 'quantity', 'reserved', 'available', 'reorderPoint', 'status', 'turnoverRate']}
          searchable={true}
          sortable={true}
          customRenderers={{
            status: getStatusBadge,
          }}
        />
      </div>
    </>
  );
};

export default InventoryPage;
