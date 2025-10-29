import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, LabelList } from 'recharts';
import * as XLSX from 'xlsx';

interface ChartsProps {
  data: {
    pspPerformance: Array<{
      psp: string;
      approved: number; // approved amount
      declined: number; // deduped declined count
      approvedAmount: number;
      declinedAmount: number;
      approvedCount: number;
      approvalRate?: number;
    }>;
    midAliasPerformance?: Array<{
      midAlias: string;
      approvedCount: number;
      declinedCount: number;
      approvedAmount: number;
      approvalRate?: number;
    }>;
    countryDistribution: Array<{
      country: string;
      count: number; // approved tx count
      amount: number; // approved amount
      approvedCount?: number;
      declinedCount?: number;
      approvalRate?: number;
    }>;
    timelineData: Array<{
      hour: number;
      transactions: number;
      amount: number;
    }>;
    dailyTimelineData: Array<{
      date: string;
      transactions: number;
      amount: number;
    }>;
    weeklyTimelineData: Array<{
      week: string;
      transactions: number;
      amount: number;
    }>;
    monthlyTimelineData: Array<{
      month: string;
      transactions: number;
      amount: number;
    }>;
    statusBreakdown: Array<{
      status: string;
      count: number;
      amount: number;
      percentage: number;
    }>;
  };
  loading: boolean;
  onCountrySelect?: (country: string) => void;
  dateRangeFilter: { start: string; end: string };
}

// Modern vibrant color palette inspired by Stripe/Linear
const COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald  
  '#f97316', // Orange
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#6366f1'  // Indigo
];

// Helper: rate color by threshold
const rateColor = (rate?: number) => {
  if (rate === undefined || isNaN(rate)) return '#64748b';
  if (rate >= 75) return '#059669'; // green
  if (rate >= 60) return '#3b82f6'; // blue
  return '#b91c1c'; // red
};

const badgeTone = (rate?: number) => {
  if (rate === undefined || isNaN(rate)) return 'bg-slate-100 text-slate-700 border-slate-200';
  if (rate >= 75) return 'bg-green-100 text-green-800 border-green-200';
  if (rate >= 60) return 'bg-blue-100 text-blue-800 border-blue-200';
  return 'bg-red-100 text-red-800 border-red-200';
};

const ApprovalRateLabel = (props: any) => {
  const { x, y, width, payload } = props;
  const rate = payload?.approvalRate as number | undefined;
  if (rate === undefined || isNaN(rate)) return null;
  const labelX = x + width / 2;
  const labelY = (y || 0) - 10;
  const fill = rateColor(rate);
  return (
    <text x={labelX} y={labelY} textAnchor="middle" fill={fill} fontSize={12}>
      {`${rate.toFixed(1)}%`}
    </text>
  );
};

export default function ChartsEnhanced({ data, loading, onCountrySelect, dateRangeFilter }: ChartsProps) {
  const [activeTab, setActiveTab] = useState<'psp' | 'countries' | 'timeline' | 'status' | 'mid'>('psp');
  const [countryQuery, setCountryQuery] = useState('');
  const [countrySort, setCountrySort] = useState<{ field: 'weighted' | 'approvalRate' | 'declined' | 'txCount' | 'revenue'; dir: 'asc' | 'desc' }>({ field: 'weighted', dir: 'desc' });
  
  // Helper to expand country code to display name (define before use)
  const regionDisplay = useMemo(() => {
    try {
      // @ts-ignore
      return new Intl.DisplayNames(['en'], { type: 'region' });
    } catch {
      return null;
    }
  }, []);
  const fullCountryName = (code: string) => {
    const up = (code || '').toUpperCase();
    if (regionDisplay && up.length === 2) {
      const name = (regionDisplay as any).of(up);
      return name || code;
    }
    return code;
  };

  const filteredCountries = useMemo(() => {
    return data.countryDistribution
      .map((c) => ({ ...c, display: fullCountryName(c.country) }))
      .filter((c) => c.display.toLowerCase().includes(countryQuery.toLowerCase()));
  }, [data.countryDistribution, countryQuery]);

  // Compute weighted score and apply sorting based on user-selected metric
  const sortedCountries = useMemo(() => {
    const list = filteredCountries.map((c) => {
      const rate = typeof c.approvalRate === 'number' ? c.approvalRate : 0;
      const txCount = c.count ?? 0; // use approved transaction count per spec
      const weighted = rate * Math.log10((txCount as number) + 1);
      return { ...c, weighted } as typeof c & { weighted: number };
    });

    const dir = countrySort.dir === 'asc' ? 1 : -1;
    const getKey = (row: any) => {
      switch (countrySort.field) {
        case 'weighted':
          return row.weighted ?? 0;
        case 'approvalRate':
          return typeof row.approvalRate === 'number' ? row.approvalRate : 0;
        case 'declined':
          return row.declinedCount ?? 0;
        case 'txCount':
          return (row.approvedCount ?? row.count ?? 0);
        case 'revenue':
          return row.amount ?? 0;
        default:
          return 0;
      }
    };

    return list.sort((a, b) => {
      const ka = getKey(a);
      const kb = getKey(b);
      if (ka === kb) return 0;
      return ka > kb ? dir : -dir;
    });
  }, [filteredCountries, countrySort]);

  const handleExportCountries = () => {
    const headers = ['country_code','country_name','approved_amount','approved_tx_count','approved_count_moid','declined_count_moid','approval_rate'];
    const rows = filteredCountries.map(c => [
      c.country,
      (c as any).display || fullCountryName(c.country),
      c.amount,
      c.count,
      c.approvedCount ?? '',
      c.declinedCount ?? '',
      typeof c.approvalRate === 'number' ? c.approvalRate.toFixed(2) : ''
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'country_approval_ratio.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCountriesXLSX = () => {
    const rows = filteredCountries.map((c, i) => ({
      index: i + 1,
      country_code: c.country,
      country_name: (c as any).display || fullCountryName(c.country),
      approved_amount: c.amount,
      approved_tx_count: c.count,
      approved_count_moid: c.approvedCount ?? '',
      declined_count_moid: c.declinedCount ?? '',
      approval_rate: typeof c.approvalRate === 'number' ? Number(c.approvalRate.toFixed(2)) : ''
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Countries');
    XLSX.writeFile(wb, 'country_approval_ratio.xlsx');
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-6">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  // Determine which timeline view to show based on date range
  const getTimelineView = () => {
    if (!dateRangeFilter.start || !dateRangeFilter.end) return 'hourly';
    const startDate = new Date(dateRangeFilter.start);
    const endDate = new Date(dateRangeFilter.end);
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff <= 1) return 'hourly';
    if (daysDiff <= 30) return 'daily';
    if (daysDiff <= 90) return 'weekly';
    return 'monthly';
  };
  const timelineView = getTimelineView();

  // (moved regionDisplay/fullCountryName higher to avoid temporal dead zone)

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  const formatNumber = (num: number) => new Intl.NumberFormat('en-US').format(num);

  return (
    <div className="space-y-8">
      {/* Tab Navigation */}
      <div className="flex space-x-2 rounded-xl border bg-popover p-2 text-popover-foreground">
        {[
          { id: 'psp', label: 'PSP Performance', icon: '📊' },
          { id: 'countries', label: 'Countries', icon: '🌍' },
          { id: 'timeline', label: 'Timeline', icon: '📈' },
          { id: 'status', label: 'Status', icon: '✅' },
          { id: 'mid', label: 'MID Aliases', icon: '🏷️' },
        ].map((t) => (
          <button
            key={t.id}
            className={`
              flex-1 px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-300 ease-out
              flex items-center justify-center gap-2
              ${activeTab === (t.id as any) 
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25 transform scale-105' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 hover:shadow-md'
              }
            `}
            onClick={() => setActiveTab(t.id as any)}
          >
            <span className="text-base">{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* PSP Performance Chart */}
      {activeTab === 'psp' && (
        <Card className="p-8 rounded-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-slate-800 mb-2">PSP Performance</h3>
              <p className="text-slate-600 text-sm">Approved amounts with approval ratios</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600"></div>
              <span className="text-xs text-slate-600 font-medium">Approved</span>
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-500 to-red-600 ml-4"></div>
              <span className="text-xs text-slate-600 font-medium">Declined</span>
            </div>
          </div>
          <div className="h-96 rounded-xl p-4 bg-card">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.pspPerformance} margin={{ top: 30, right: 30, left: 20, bottom: 5 }}>
                <defs>
                  <linearGradient id="approvedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.7} />
                  </linearGradient>
                  <linearGradient id="declinedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#dc2626" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.6} />
                <XAxis 
                  dataKey="psp" 
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
                    backdropFilter: 'blur(8px)',
                    fontSize: '14px'
                  }}
                  formatter={(value: number, _name: string, props: any) => {
                    const item: any = props?.payload;
                    const count = item?.approvedCount ?? 0;
                    const rate = item?.approvalRate as number | undefined;
                    return [
                      formatCurrency(value),
                      rate !== undefined ? `Approved Amount (Count: ${new Intl.NumberFormat('en-US').format(count)} • ${rate.toFixed(1)}%)` : `Approved Amount (Count: ${new Intl.NumberFormat('en-US').format(count)})`,
                    ];
                  }}
                />
                <Bar 
                  dataKey="approved" 
                  name="Approved Amount" 
                  fill="url(#approvedGradient)"
                  radius={[4, 4, 0, 0]}
                >
                  <LabelList content={<ApprovalRateLabel />} />
                </Bar>
                <Bar 
                  dataKey="declined" 
                  fill="url(#declinedGradient)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Countries Tab (Searchable Table + Export) */}
      {activeTab === 'countries' && (
        <Card className="p-8 rounded-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-slate-800 mb-2">Countries Analysis</h3>
              <p className="text-slate-600 text-sm">Approval ratios and performance by country</p>
            </div>
            <div className="flex gap-3 items-center">
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600">Sort by</label>
                <select
                  value={countrySort.field}
                  onChange={(e) => setCountrySort((s) => ({ ...s, field: e.target.value as any }))}
                  className="px-3 py-2 rounded-lg border bg-background text-sm"
                >
                  <option value="weighted">Weighted Score</option>
                  <option value="approvalRate">Approval Rate</option>
                  <option value="declined">Declined MOIDs</option>
                  <option value="txCount">Transaction Volume</option>
                  <option value="revenue">Revenue</option>
                </select>
                <select
                  value={countrySort.dir}
                  onChange={(e) => setCountrySort((s) => ({ ...s, dir: e.target.value as any }))}
                  className="px-3 py-2 rounded-lg border bg-background text-sm"
                >
                  <option value="desc">Desc</option>
                  <option value="asc">Asc</option>
                </select>
              </div>
              <button 
                onClick={handleExportCountries} 
                className="px-4 py-2 text-sm font-medium rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5"
              >
                📊 Export CSV
              </button>
              <button 
                onClick={handleExportCountriesXLSX} 
                className="px-4 py-2 text-sm font-medium rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 transition-all duration-200 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5"
              >
                📈 Export XLSX
              </button>
            </div>
          </div>
          
          <div className="mb-6">
            <input
              type="text"
              placeholder="🔍 Search country..."
              value={countryQuery}
              onChange={(e) => setCountryQuery(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-background border placeholder:text-muted-foreground text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          
          <div className="overflow-hidden rounded-xl bg-card">
            <div className="overflow-auto custom-scrollbar max-h-96">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-semibold text-slate-700">#</th>
                    <th className="text-left p-4 font-semibold text-slate-700">Country</th>
                    <th className="text-left p-4 font-semibold text-slate-700">Approval Rate</th>
                    <th className="text-right p-4 font-semibold text-slate-700">Approved Amount</th>
                    <th className="text-right p-4 font-semibold text-slate-700">Approved Tx Count</th>
                    <th className="text-right p-4 font-semibold text-slate-700">Approved MOIDs</th>
                    <th className="text-right p-4 font-semibold text-slate-700">Declined MOIDs</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCountries.map((row, idx) => (
                    <tr 
                      key={row.country} 
                      className="border-b border-slate-200/50 last:border-b-0 hover:bg-white/60 cursor-pointer transition-all duration-200 hover:shadow-sm" 
                      onClick={() => onCountrySelect?.(row.country)}
                    >
                      <td className="p-4 align-middle text-slate-600 font-medium">{idx + 1}</td>
                      <td className="p-4 align-middle font-semibold text-slate-800">{row.display}</td>
                      <td className="p-4 align-middle">
                        {typeof row.approvalRate === 'number' && (
                          <span className={`text-xs px-3 py-1.5 rounded-full font-medium border backdrop-blur-sm ${badgeTone(row.approvalRate)}`}>
                            {row.approvalRate.toFixed(1)}%
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right align-middle font-semibold text-slate-800">{formatCurrency(row.amount)}</td>
                      <td className="p-4 text-right align-middle text-slate-600">{formatNumber(row.count)}</td>
                      <td className="p-4 text-right align-middle text-slate-600">{row.approvedCount !== undefined ? formatNumber(row.approvedCount) : '-'}</td>
                      <td className="p-4 text-right align-middle text-slate-600">{row.declinedCount !== undefined ? formatNumber(row.declinedCount) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* Timeline Tab */}
      {activeTab === 'timeline' && (
        <div className="space-y-6">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {timelineView === 'hourly' && '24-Hour Approved Transaction Timeline'}
                {timelineView === 'daily' && 'Daily Approved Transaction Timeline'}
                {timelineView === 'weekly' && 'Weekly Approved Transaction Timeline'}
                {timelineView === 'monthly' && 'Monthly Approved Transaction Timeline'}
              </h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>View:</span>
                <Badge variant="outline">{timelineView === 'hourly' ? 'Hourly' : timelineView === 'daily' ? 'Daily' : timelineView === 'weekly' ? 'Weekly' : 'Monthly'}</Badge>
              </div>
            </div>

            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                {timelineView === 'hourly' ? (
                  <BarChart data={data.timelineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" tickFormatter={(hour) => `${hour}:00`} />
                    <YAxis />
                    <Tooltip labelFormatter={(hour) => `${hour}:00 - ${hour + 1}:00`} formatter={(value: number) => [formatCurrency(value), 'Approved Amount']} />
                    <Bar dataKey="amount" name="Approved Amount" fill="#3b82f6" />
                  </BarChart>
                ) : timelineView === 'daily' ? (
                  <LineChart data={data.dailyTimelineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(date) => new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      formatter={(value: number, _name: string, props: any) => {
                        const item: any = props?.payload;
                        const count = item?.transactions ?? 0;
                        return [formatCurrency(value), `Approved Amount (Count: ${new Intl.NumberFormat('en-US').format(count)})`];
                      }}
                    />
                    <Line type="monotone" dataKey="amount" name="Approved Amount" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
                  </LineChart>
                ) : timelineView === 'weekly' ? (
                  <LineChart data={data.weeklyTimelineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip
                      formatter={(value: number, _name: string, props: any) => {
                        const item: any = props?.payload;
                        const count = item?.transactions ?? 0;
                        return [formatCurrency(value), `Approved Amount (Count: ${new Intl.NumberFormat('en-US').format(count)})`];
                      }}
                    />
                    <Line type="monotone" dataKey="amount" name="Approved Amount" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
                  </LineChart>
                ) : (
                  <LineChart data={data.monthlyTimelineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip
                      formatter={(value: number, _name: string, props: any) => {
                        const item: any = props?.payload;
                        const count = item?.transactions ?? 0;
                        return [formatCurrency(value), `Approved Amount (Count: ${new Intl.NumberFormat('en-US').format(count)})`];
                      }}
                    />
                    <Line type="monotone" dataKey="amount" name="Approved Amount" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {/* MID Alias Tab */}
      {activeTab === 'mid' && (
        <div className="space-y-6">
          {/* PSP Approval Ratio */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">PSP Approval Ratio</h3>
              <div className="text-sm text-muted-foreground">Higher is better</div>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.pspPerformance} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                  <defs>
                    <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#60a5fa" stopOpacity={1} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis dataKey="psp" angle={-20} textAnchor="end" height={50} />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(_value: number, _name: string, props: any) => {
                    const item: any = props?.payload;
                    return [`${(item.approvalRate ?? 0).toFixed(1)}%`, 'Approval Rate'];
                  }} />
                  <Bar dataKey="approvalRate" name="Approval Rate" fill="url(#gradBlue)">
                    <LabelList content={<ApprovalRateLabel />} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* MID Alias Approval Ratio */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">MID Alias Approval Ratio</h3>
            </div>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.midAliasPerformance || []} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                  <defs>
                    <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={1} />
                      <stop offset="100%" stopColor="#059669" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis dataKey="midAlias" angle={-35} textAnchor="end" interval={0} height={70} />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    formatter={(_value: number, _name: string, props: any) => {
                      const item: any = props?.payload;
                      const countA = item?.approvedCount ?? 0;
                      const countD = item?.declinedCount ?? 0;
                      const rate = item?.approvalRate ?? 0;
                      return [`${rate.toFixed(1)}%`, `A:${countA} D:${countD}`];
                    }}
                  />
                  <Bar dataKey="approvalRate" name="Approval Rate" fill="url(#gradGreen)">
                    <LabelList content={<ApprovalRateLabel />} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {/* Status Tab */}
      {activeTab === 'status' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Status Distribution</h3>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.statusBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ status, percentage }) => `${status} (${percentage.toFixed(1)}%)`}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {data.statusBreakdown.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [new Intl.NumberFormat('en-US').format(value as number), 'Transactions']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Amount Tab removed as requested */}
    </div>
  );
}
