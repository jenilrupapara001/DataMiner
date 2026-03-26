import React, { useState, useEffect, useMemo } from 'react';
import Filters from '../components/Filters';
import DataTable from '../components/DataTable';
import KPICard from '../components/KPICard';
import { asinApi, sellerApi } from '../services/api';

const ProfitLossPage = () => {
  const [data, setData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ 
    dateRange: 'month',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
    searchTerm: '' 
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
        const totalSellers = sellers.length || 1;

        const avgPrice = asins.length > 0
          ? asins.reduce((sum, a) => sum + (a.currentPrice || 50), 0) / asins.length
          : 50;

        const productSales = totalAsins * avgPrice * 30 * 12;
        const shippingRevenue = productSales * 0.06;
        const adRefunds = productSales * 0.01;
        const totalSales = productSales + shippingRevenue + adRefunds;

        const cogs = productSales * 0.42;
        const fbaFees = productSales * 0.09;
        const adCosts = productSales * 0.18;
        const shippingCosts = productSales * 0.07;
        const returns = productSales * 0.03;
        const storageFees = productSales * 0.02;
        const otherExpenses = productSales * 0.01;
        const totalExpenses = cogs + fbaFees + adCosts + shippingCosts + returns + storageFees + otherExpenses;
        const grossProfit = totalSales - cogs - fbaFees - shippingCosts - returns;
        const netProfit = grossProfit - adCosts - storageFees - otherExpenses;
        const profitMargin = (netProfit / totalSales) * 100;

        const plData = [
          { category: 'Product Sales', amount: Math.round(productSales), type: 'income' },
          { category: 'Shipping Revenue', amount: Math.round(shippingRevenue), type: 'income' },
          { category: 'Advertising Refunds', amount: Math.round(adRefunds), type: 'income' },
          { category: 'Total Sales', amount: Math.round(totalSales), type: 'total' },
          { category: 'Cost of Goods Sold', amount: Math.round(cogs), type: 'expense' },
          { category: 'Amazon FBA Fees', amount: Math.round(fbaFees), type: 'expense' },
          { category: 'Advertising Costs', amount: Math.round(adCosts), type: 'expense' },
          { category: 'Shipping Costs', amount: Math.round(shippingCosts), type: 'expense' },
          { category: 'Returns & Refunds', amount: Math.round(returns), type: 'expense' },
          { category: 'Storage Fees', amount: Math.round(storageFees), type: 'expense' },
          { category: 'Other Expenses', amount: Math.round(otherExpenses), type: 'expense' },
          { category: 'Total Expenses', amount: Math.round(totalExpenses), type: 'total' },
          { category: 'Gross Profit', amount: Math.round(grossProfit), type: 'profit' },
          { category: 'Net Profit', amount: Math.round(netProfit), type: 'profit' },
          { category: 'Profit Margin', amount: parseFloat(profitMargin.toFixed(1)), type: 'margin' },
        ];

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthlyPL = monthNames.map((month, idx) => {
          const seasonalFactor = 0.7 + (idx / 11) * 0.6;
          const revenue = Math.round((totalSales / 12) * seasonalFactor);
          const profit = Math.round(revenue * (profitMargin / 100) * (0.9 + Math.random() * 0.2));
          return { month, revenue, profit, margin: profitMargin.toFixed(1) };
        });

        setData(plData);
        setMonthlyData(monthlyPL);
      } catch (error) {
        console.error('Failed to load P&L data:', error);
        setData([]);
        setMonthlyData([]);
      }
      setLoading(false);
    };
    loadData();
  }, [filters.startDate, filters.endDate]);

  const kpis = useMemo(() => {
    const totalIncome = data.find(d => d.category === 'Total Sales')?.amount || 0;
    const totalExpenses = data.find(d => d.category === 'Total Expenses')?.amount || 0;
    const netProfit = data.find(d => d.category === 'Net Profit')?.amount || 0;
    const profitMargin = data.find(d => d.category === 'Profit Margin')?.amount || 0;

    return [
      { title: 'Total Revenue', value: '₹' + totalIncome.toLocaleString(), icon: 'bi-currency-rupee', trend: 12.5, trendType: 'positive' },
      { title: 'Total Expenses', value: '₹' + totalExpenses.toLocaleString(), icon: 'bi-wallet2', trend: 8.2, trendType: 'negative' },
      { title: 'Net Profit', value: '₹' + netProfit.toLocaleString(), icon: 'bi-graph-up', trend: 15.7, trendType: 'positive' },
      { title: 'Profit Margin', value: profitMargin + '%', icon: 'bi-percent', trend: 3.2, trendType: 'positive' },
    ];
  }, [data]);

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  if (loading) {
    return (
      <>
        <div className="page-header">
          <h1 className="page-title"><i className="bi bi-currency-dollar"></i>Profit & Loss</h1>
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
        <h1 className="page-title"><i className="bi bi-currency-dollar"></i>Profit & Loss</h1>
      </div>
      <div className="page-content">
        <Filters filters={filters} onFilterChange={handleFilterChange} showDateRange={true} showSearch={true} />

        <div className="kpi-grid mb-4">
          {kpis.map((kpi, idx) => (
            <KPICard key={idx} title={kpi.title} value={kpi.value} icon={kpi.icon} trend={kpi.trend} trendType={kpi.trendType} />
          ))}
        </div>

        <DataTable
          title="Profit & Loss Statement"
          data={data}
          columns={['category', 'amount']}
          searchable={true}
          sortable={true}
        />
      </div>
    </>
  );
};

export default ProfitLossPage;
