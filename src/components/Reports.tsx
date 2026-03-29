import React, { useState, useMemo } from 'react';
import { Sale, Product } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, subMonths, addMonths } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ChevronRight, ChevronLeft, TrendingUp, ShoppingCart, Package } from 'lucide-react';

interface ReportsProps {
  sales: Sale[];
  products: Product[];
}

export function Reports({ sales, products }: ReportsProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const monthlySales = useMemo(() => {
    return sales.filter(sale => {
      const saleDate = parseISO(sale.date);
      return isWithinInterval(saleDate, { start: monthStart, end: monthEnd });
    });
  }, [sales, monthStart, monthEnd]);

  const { totalSales, totalProfit } = useMemo(() => {
    let sales = 0;
    let profit = 0;
    monthlySales.forEach(sale => {
      sales += sale.totalAmount;
      sale.items.forEach(item => {
        const itemProfit = item.total - ((item.purchasePrice || 0) * item.quantity);
        profit += itemProfit;
      });
    });
    return { totalSales: sales, totalProfit: profit };
  }, [monthlySales]);

  const totalTransactions = monthlySales.length;

  const topProducts = useMemo(() => {
    const productCounts: Record<string, { name: string; quantity: number; revenue: number; profit: number }> = {};

    monthlySales.forEach(sale => {
      sale.items.forEach(item => {
        if (!productCounts[item.productId]) {
          productCounts[item.productId] = {
            name: item.productName,
            quantity: 0,
            revenue: 0,
            profit: 0
          };
        }
        productCounts[item.productId].quantity += item.quantity;
        productCounts[item.productId].revenue += item.total;
        productCounts[item.productId].profit += item.total - ((item.purchasePrice || 0) * item.quantity);
      });
    });

    return Object.values(productCounts)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5); // Top 5
  }, [monthlySales]);

  const chartData = useMemo(() => {
    return topProducts.map(p => ({
      name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
      'الكمية المباعة': p.quantity,
      'الإيرادات': p.revenue,
      'الربح': p.profit
    }));
  }, [topProducts]);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-2xl font-bold text-slate-800">التقارير الشهرية</h2>
        <div className="flex items-center gap-4">
          <button 
            onClick={handlePrevMonth}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronRight size={20} />
          </button>
          <span className="text-lg font-semibold min-w-[120px] text-center">
            {format(currentDate, 'MMMM yyyy', { locale: ar })}
          </span>
          <button 
            onClick={handleNextMonth}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <TrendingUp size={28} />
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-1">إجمالي المبيعات</p>
            <h3 className="text-3xl font-bold text-slate-800">{totalSales.toFixed(2)} درهم</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
            <TrendingUp size={28} />
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-1">صافي الربح</p>
            <h3 className="text-3xl font-bold text-slate-800">{totalProfit.toFixed(2)} درهم</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <ShoppingCart size={28} />
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-1">عدد المعاملات</p>
            <h3 className="text-3xl font-bold text-slate-800">{totalTransactions}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Package size={20} className="text-indigo-600" />
            المنتجات الأكثر مبيعاً (رسم بياني)
          </h3>
          {topProducts.length > 0 ? (
            <div className="h-80 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis yAxisId="left" orientation="left" stroke="#8b5cf6" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" stroke="#10b981" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    cursor={{ fill: '#f1f5f9' }}
                  />
                  <Bar yAxisId="left" dataKey="الكمية المباعة" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="الكمية المباعة" />
                  <Bar yAxisId="right" dataKey="الإيرادات" fill="#10b981" radius={[4, 4, 0, 0]} name="الإيرادات (درهم)" />
                  <Bar yAxisId="right" dataKey="الربح" fill="#3b82f6" radius={[4, 4, 0, 0]} name="الربح (درهم)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-80 flex items-center justify-center text-slate-400">
              لا توجد مبيعات في هذا الشهر
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <TrendingUp size={20} className="text-emerald-600" />
            تفاصيل المنتجات الأكثر مبيعاً
          </h3>
          {topProducts.length > 0 ? (
            <div className="space-y-4">
              {topProducts.map((product, index) => (
                <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-800">{product.name}</h4>
                      <p className="text-sm text-slate-500">{product.quantity} وحدة مباعة</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-emerald-600">{product.revenue.toFixed(2)} درهم</div>
                    <div className="text-sm text-indigo-600 font-medium">ربح: {product.profit.toFixed(2)} درهم</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 pb-10">
              لا توجد بيانات لعرضها
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
