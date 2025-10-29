import { useState, useMemo, useRef, useEffect } from 'react';
import moment from 'moment-timezone';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import WorldChoropleth from '@/components/WorldChoropleth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line,
  ComposedChart,
  Legend,
  Scatter,
  ScatterChart
} from 'recharts';
import { 
  BarChart3, 
  PieChart as PieChartIcon, 
  LineChart as LineChartIcon,
  Activity,
  Zap,
  Download,
  Maximize2,
  Globe
} from 'lucide-react';

interface InteractiveChartsProps {
  data: {
    pspPerformance: Array<{
      psp: string;
      approved: number;
      declined: number;
      approvedAmount: number;
      declinedAmount: number;
      approvedCount: number;
    }>;
    countryDistribution: Array<{
      country: string;
      count: number;
      amount: number;
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
    statusBreakdown: Array<{
      status: string;
      count: number;
      amount: number;
      percentage: number;
    }>;
    amountDistribution: Array<{
      range: string;
      count: number;
      totalAmount: number;
    }>;
  };
  loading: boolean;
  onCountrySelect?: (country: string) => void;
  filteredTransactions: any[];
}

// High-contrast categorical palette (20 colors) - Professional without yellow
const COLORS = [
  '#3b82f6', '#10b981', '#f97316', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#64748b', '#84cc16', '#14b8a6',
  '#6366f1', '#059669', '#dc2626', '#7c3aed', '#0891b2',
  '#1d4ed8', '#16a34a', '#ea580c', '#7c2d12', '#475569'
];
// Distinct dash patterns for rate lines
const DASH_PATTERNS = ['4 4', '6 4', '2 2', '8 4', '1 3', '10 6', '3 5', '5 3', '7 3', '9 3'];

const chartTypes = [
  { id: 'psp', label: 'PSP Performance', icon: BarChart3 },
  { id: 'countries', label: 'Countries', icon: PieChartIcon },
  { id: 'timeline', label: 'Timeline', icon: LineChartIcon },
  { id: 'status', label: 'Status', icon: Activity },
  { id: 'worldmap', label: 'World Map', icon: Globe },
  { id: 'advanced', label: 'Advanced', icon: Zap },
  { id: 'country_heatmap', label: 'Country Heatmap', icon: Activity },
  { id: 'psp_timeline', label: 'PSP Timeline', icon: LineChartIcon },
  { id: 'psp_multi', label: 'PSP Multi Timeline', icon: LineChartIcon }
];

export default function InteractiveCharts({ data, loading, onCountrySelect, filteredTransactions }: InteractiveChartsProps) {
  const [activeChart, setActiveChart] = useState('psp');
  const [chartStyle, setChartStyle] = useState<'bar' | 'line' | 'area' | 'pie'>('bar');
  const [showAnimation, setShowAnimation] = useState(true);
  const [selectedPsp, setSelectedPsp] = useState<string>('All');
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('day');
  const [topN, setTopN] = useState<number>(5);
  const [heatmapMetric, setHeatmapMetric] = useState<'amount' | 'approval'>('amount');
  const [countryTopN, setCountryTopN] = useState<number>(10);
  const fsRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Dynamic chart height: fill the viewport in fullscreen, otherwise fixed height
  const chartHeight = isFullscreen ? 'calc(100vh - 160px)' : '34rem';

  const toggleFullscreen = async () => {
    const el = fsRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (e) {
      console.error('Fullscreen toggle failed', e);
    }
  };

  useEffect(() => {
    const onChange = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      // Force Recharts to recalculate sizes when entering/exiting fullscreen
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
        setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
      });
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  // ------- Country Heatmap data prep -------
  type HeatCell = {
    country: string;
    bucket: string;
    amount: number; // approved amount
    approvalRate: number; // % with MOID dedupe
  };

  const heatmapModel = useMemo(() => {
    const bucketOf = (dateISO: string) => {
      if (!dateISO) return '';
      const d = new Date(dateISO);
      if (isNaN(d.getTime())) return '';
      const day = d.toISOString().slice(0, 10);
      if (granularity === 'day') return day;
      if (granularity === 'week') return moment(day).format('YYYY-[W]WW');
      return moment(day).format('YYYY-MM');
    };

    // Map: country -> bucket -> transactions[]
    const byCountryBucket: Record<string, Record<string, any[]>> = {};
    (filteredTransactions || []).forEach((tx: any) => {
      const country = tx.country || 'Unknown';
      const bucket = bucketOf(tx.local_date || tx.processing_date);
      if (!bucket) return;
      if (!byCountryBucket[country]) byCountryBucket[country] = {};
      if (!byCountryBucket[country][bucket]) byCountryBucket[country][bucket] = [];
      byCountryBucket[country][bucket].push(tx);
    });

    // Determine top countries by total approved amount across all buckets
    const countryTotals: Record<string, number> = {};
    Object.entries(byCountryBucket).forEach(([country, buckets]) => {
      let total = 0;
      Object.values(buckets).forEach((txs) => {
        total += txs.filter(t => t.status === 'approved').reduce((s: number, t: any) => s + (t.amount || 0), 0);
      });
      countryTotals[country] = total;
    });
    const rankedCountries = Object.entries(countryTotals)
      .sort((a,b)=>b[1]-a[1])
      .map(([c])=>c)
      .slice(0, countryTopN);

    // All buckets sorted
    const allBuckets = Array.from(new Set(
      Object.values(byCountryBucket).flatMap(b => Object.keys(b))
    )).sort((a,b)=>a.localeCompare(b));

    // Build cells and compute per bucket metrics
    const cells: HeatCell[] = [];
    rankedCountries.forEach(country => {
      allBuckets.forEach(bucket => {
        const txs = (byCountryBucket[country] && byCountryBucket[country][bucket]) || [];
        const approved = txs.filter(t => t.status === 'approved');
        const amount = approved.reduce((s: number, t: any) => s + (t.amount || 0), 0);
        // MOID-deduped approval rate within this country-bucket
        const approvedMoids = new Set<string>();
        const declinedMoids = new Set<string>();
        txs.forEach((t: any) => {
          const moid = t.merchantOrderId || t.transactionId || t.id;
          if (t.status === 'approved') { approvedMoids.add(moid); declinedMoids.delete(moid); }
          else if (t.status === 'declined') { if (!approvedMoids.has(moid)) declinedMoids.add(moid); }
        });
        const a = approvedMoids.size; const d = declinedMoids.size;
        const approvalRate = (a + d) > 0 ? (a / (a + d)) * 100 : 0;
        cells.push({ country, bucket, amount, approvalRate });
      });
    });

    // domain for colors
    const amountMax = cells.reduce((m, c) => Math.max(m, c.amount), 0);
    const rateMax = 100;

    return { cells, countries: rankedCountries, buckets: allBuckets, amountMax, rateMax };
  }, [filteredTransactions, granularity, countryTopN]);

  // (Removed continuous color interpolation; using stepped palettes below)

  // Stepped palettes and thresholds
  const AMOUNT_STEPS = ['#e0f2fe','#bae6fd','#7dd3fc','#38bdf8','#0ea5e9','#0284c7','#0369a1'];
  const RATE_STEPS = ['#ef4444','#f97316','#fb923c','#3b82f6','#84cc16','#22c55e','#16a34a'];
  const RATE_THRESHOLDS = [40, 60, 75, 85, 92, 97]; // 7 bins

  const amountThresholds = useMemo(() => {
    // Quantile thresholds from non-zero amounts
    const values = heatmapModel.cells.map(c => c.amount).filter(v => v>0).sort((a,b)=>a-b);
    if (values.length === 0) return [0,0,0,0,0,0];
    const q = (p: number) => values[Math.min(values.length-1, Math.max(0, Math.floor(p*(values.length-1))))];
    return [q(0.15), q(0.3), q(0.5), q(0.7), q(0.85), q(0.95)];
  }, [heatmapModel.cells]);

  const colorAmountStepped = (v: number) => {
    const idx = amountThresholds.findIndex(t => v <= t);
    const bin = idx === -1 ? AMOUNT_STEPS.length - 1 : Math.max(0, idx);
    return AMOUNT_STEPS[bin];
  };
  const colorRateStepped = (v: number) => {
    const idx = RATE_THRESHOLDS.findIndex(t => v <= t);
    const bin = idx === -1 ? RATE_STEPS.length - 1 : Math.max(0, idx);
    return RATE_STEPS[bin];
  };

  // Enhanced PSP data with performance metrics
  const enhancedPspData = useMemo(() => {
    return data.pspPerformance.map(psp => {
      const totalTransactions = psp.approvedCount + psp.declined;
      const approvalRate = totalTransactions > 0 ? (psp.approvedCount / totalTransactions) * 100 : 0;
      const avgTransactionValue = psp.approvedCount > 0 ? psp.approvedAmount / psp.approvedCount : 0;
      
      return {
        ...psp,
        approvalRate,
        avgTransactionValue,
        totalTransactions,
        efficiency: approvalRate * avgTransactionValue / 100 // Custom efficiency metric
      };
    });
  }, [data.pspPerformance]);

  // Advanced analytics data
  const advancedAnalytics = useMemo(() => {
    // Performance distribution
    const performanceDistribution = enhancedPspData.map(psp => ({
      name: psp.psp,
      performance: psp.efficiency,
      approvalRate: psp.approvalRate,
      volume: psp.approvedAmount,
      approvedCount: psp.approvedCount
    }));
    const leaderboard = enhancedPspData
      .map(p => ({ name: p.psp, approvalRate: p.approvalRate, volume: p.approvedAmount }))
      .sort((a, b) => b.approvalRate - a.approvalRate);

    return { performanceDistribution, leaderboard };
  }, [data.dailyTimelineData, enhancedPspData]);

  // Timeline approval rate per day (merchantOrderId-deduped)
  const timelineApprovalRateMap = useMemo(() => {
    const byDate: Record<string, { approvedMoids: Set<string>; declinedMoids: Set<string> }> = {};
    (filteredTransactions || []).forEach((tx: any) => {
      // Prefer local_date which is computed in Dashboard with the currently selected timezone
      const date = (tx.local_date && typeof tx.local_date === 'string')
        ? tx.local_date
        : (() => {
            const d = new Date(tx.processing_date);
            return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
          })();
      if (!date) return;
      const moid = tx.merchantOrderId || tx.transactionId || tx.id;
      if (!byDate[date]) byDate[date] = { approvedMoids: new Set(), declinedMoids: new Set() };
      if (tx.status === 'approved') {
        byDate[date].approvedMoids.add(moid);
        byDate[date].declinedMoids.delete(moid);
      } else if (tx.status === 'declined') {
        if (!byDate[date].approvedMoids.has(moid)) byDate[date].declinedMoids.add(moid);
      }
    });
    const map: Record<string, number> = {};
    Object.entries(byDate).forEach(([date, sets]) => {
      const a = sets.approvedMoids.size; const d = sets.declinedMoids.size;
      const total = a + d; map[date] = total > 0 ? (a / total) * 100 : 0;
    });
    return map;
  }, [filteredTransactions]);

  // KPI-style global approval: merchantOrderId-deduped, approved / (approved + declined)
  const globalKpiApproval = useMemo(() => {
    const byMoid: Record<string, { approved: boolean; declined: boolean }> = {};
    (filteredTransactions || []).forEach((tx: any) => {
      const moid = tx.merchantOrderId || tx.transactionId || tx.id;
      if (!byMoid[moid]) byMoid[moid] = { approved: false, declined: false };
      if (tx.status === 'approved') byMoid[moid].approved = true;
      if (tx.status === 'declined') byMoid[moid].declined = true;
    });
    let approvedGroups = 0, declinedGroups = 0;
    Object.values(byMoid).forEach(g => {
      if (g.approved) approvedGroups += 1; else if (g.declined) declinedGroups += 1;
    });
    const denom = approvedGroups + declinedGroups;
    return denom > 0 ? (approvedGroups / denom) * 100 : 0;
  }, [filteredTransactions]);

  // Approval rate per country (MOID-deduped), 0-100
  const approvalByCountryMap = useMemo(() => {
    const map: Record<string, { approved: Set<string>; declined: Set<string> }> = {};
    (filteredTransactions || []).forEach((tx: any) => {
      const country = tx.country_full || tx.country || 'Unknown';
      const moid = tx.merchantOrderId || tx.transactionId || tx.id;
      if (!map[country]) map[country] = { approved: new Set(), declined: new Set() };
      if (tx.status === 'approved') {
        map[country].approved.add(moid);
        map[country].declined.delete(moid);
      } else if (tx.status === 'declined') {
        if (!map[country].approved.has(moid)) map[country].declined.add(moid);
      }
    });
    const out: Record<string, number> = {};
    Object.entries(map).forEach(([country, sets]) => {
      const a = sets.approved.size; const d = sets.declined.size; const t = a + d;
      out[country] = t > 0 ? (a / t) * 100 : 0;
    });
    return out;
  }, [filteredTransactions]);

  // PSP Timeline data: for each date (local_date) compute approved amount and approval rate per PSP
  const pspOptions = useMemo(() => {
    const set = new Set<string>();
    (filteredTransactions || []).forEach((tx: any) => {
      if (tx.pspName) set.add(tx.pspName);
    });
    return ['All', ...Array.from(set).sort()];
  }, [filteredTransactions]);

  const pspTimelineData = useMemo(() => {
    const byDatePsp: Record<string, Record<string, any[]>> = {};
    (filteredTransactions || []).forEach((tx: any) => {
      const date = tx.local_date || (new Date(tx.processing_date).toISOString().slice(0, 10));
      const psp = tx.pspName || 'Unknown';
      if (!byDatePsp[date]) byDatePsp[date] = {};
      if (!byDatePsp[date][psp]) byDatePsp[date][psp] = [];
      byDatePsp[date][psp].push(tx);
    });

    const buildPoint = (date: string, txs: any[]) => {
      const approved = txs.filter(t => t.status === 'approved');
      const amount = approved.reduce((s, t) => s + (t.amount || 0), 0);
      // approval rate with MOID dedupe
      const approvedMoids = new Set<string>();
      const declinedMoids = new Set<string>();
      txs.forEach(t => {
        const moid = t.merchantOrderId || t.transactionId || t.id;
        if (t.status === 'approved') {
          approvedMoids.add(moid); declinedMoids.delete(moid);
        } else if (t.status === 'declined') {
          if (!approvedMoids.has(moid)) declinedMoids.add(moid);
        }
      });
      const a = approvedMoids.size; const d = declinedMoids.size;
      const approvalRate = (a + d) > 0 ? (a / (a + d)) * 100 : 0;
      return { date, amount, approvalRate };
    };

    const rows: { date: string; amount: number; approvalRate: number }[] = [];
    Object.keys(byDatePsp).forEach(date => {
      if (selectedPsp === 'All') {
        // aggregate across PSPs for overall trend
        const allTxs = Object.values(byDatePsp[date]).flat();
        rows.push(buildPoint(date, allTxs));
      } else if (byDatePsp[date][selectedPsp]) {
        rows.push(buildPoint(date, byDatePsp[date][selectedPsp]));
      } else {
        rows.push({ date, amount: 0, approvalRate: 0 });
      }
    });

    return rows.sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredTransactions, selectedPsp]);

  // Multi-PSP timeline dataset: rows with keys per PSP: `${psp}__amount`, `${psp}__rate`
  const multiPspTimeline = useMemo(() => {
    const byBucket: Record<string, Record<string, any[]>> = {};
    const allTx = filteredTransactions || [];

    const bucketOf = (tx: any) => {
      const d = tx.local_date || (new Date(tx.processing_date).toISOString().slice(0, 10));
      if (granularity === 'day') return d;
      if (granularity === 'week') return moment(d).format('YYYY-[W]WW');
      return moment(d).format('YYYY-MM');
    };

    allTx.forEach((tx: any) => {
      const b = bucketOf(tx);
      const p = tx.pspName || 'Unknown';
      if (!byBucket[b]) byBucket[b] = {};
      if (!byBucket[b][p]) byBucket[b][p] = [];
      byBucket[b][p].push(tx);
    });

    // determine topN PSPs by total approved amount across all buckets
    const totals: Record<string, number> = {};
    Object.values(byBucket).forEach(perPsp => {
      Object.entries(perPsp).forEach(([psp, txs]) => {
        const amt = txs.filter(t => t.status === 'approved').reduce((s, t) => s + (t.amount || 0), 0);
        totals[psp] = (totals[psp] || 0) + amt;
      });
    });
    const rankedPsps = Object.entries(totals).sort((a,b)=>b[1]-a[1]).map(([p])=>p).slice(0, topN);

    // build rows
    const buckets = Object.keys(byBucket).sort((a,b)=>a.localeCompare(b));
    const rows: any[] = buckets.map((bucket) => {
      const row: any = { bucket };
      rankedPsps.forEach(psp => {
        const txs = byBucket[bucket][psp] || [];
        const approved = txs.filter(t => t.status === 'approved');
        const amount = approved.reduce((s, t) => s + (t.amount || 0), 0);
        const approvedMoids = new Set<string>();
        const declinedMoids = new Set<string>();
        txs.forEach(t => {
          const moid = t.merchantOrderId || t.transactionId || t.id;
          if (t.status === 'approved') { approvedMoids.add(moid); declinedMoids.delete(moid); }
          else if (t.status === 'declined') { if (!approvedMoids.has(moid)) declinedMoids.add(moid); }
        });
        const a = approvedMoids.size; const d = declinedMoids.size;
        const rate = (a + d) > 0 ? (a / (a + d)) * 100 : 0;
        row[`${psp}__amount`] = amount;
        row[`${psp}__rate`] = rate;
      });
      return row;
    });

    return { rows, rankedPsps };
  }, [filteredTransactions, granularity, topN]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex space-x-1 bg-muted p-1 rounded-lg">
          {chartTypes.map((chart) => (
            <div key={chart.id} className="flex-1 h-10 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
        <Card className="p-6">
          <div className="h-96 bg-gray-200 rounded animate-pulse" />
        </Card>
      </div>
    );
  }

  const renderChart = () => {
    switch (activeChart) {
      case 'psp':
        return (
          <motion.div
            key="psp-chart"
            initial={showAnimation ? { opacity: 0, scale: 0.95 } : {}}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            style={{ height: chartHeight }}
          >
            <ResponsiveContainer width="100%" height="100%">
              {chartStyle === 'bar' ? (
                <ComposedChart data={enhancedPspData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="psp" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      name.includes('Amount') ? formatCurrency(value) : formatNumber(value),
                      name
                    ]}
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                      border: 'none', 
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="approvedAmount" name="Approved Amount" fill="#10b981" />
                  <Line yAxisId="right" type="monotone" dataKey="approvalRate" name="Approval Rate %" stroke="#3b82f6" strokeWidth={3} />
                </ComposedChart>
              ) : (
                <BarChart data={enhancedPspData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="psp" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => [formatCurrency(value), 'Approved Amount']} />
                  <Bar dataKey="approvedAmount" fill="#3b82f6" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </motion.div>
        );

      case 'worldmap':
        return (
          <motion.div
            key="world-map"
            initial={showAnimation ? { opacity: 0, scale: 0.95 } : {}}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            style={{ height: chartHeight }}
          >
            {/* World map choropleth colored by revenue with toolbar showing approval ratio & revenue */}
            <WorldChoropleth
              data={data.countryDistribution.map(c => ({ country: c.country, amount: c.amount }))}
              approvalByCountry={approvalByCountryMap}
              onCountrySelect={onCountrySelect}
              globalApprovalOverride={globalKpiApproval}
            />
          </motion.div>
        );

      case 'psp_multi':
        return (
          <motion.div
            key="psp-multi-timeline"
            initial={showAnimation ? { opacity: 0, scale: 0.95 } : {}}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            style={{ height: chartHeight }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={multiPspTimeline.rows} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bucket" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    name.includes('Approval') ? `${Number(value).toFixed(1)}%` : formatCurrency(Number(value)),
                    name
                  ]}
                />
                <Legend />
                {multiPspTimeline.rankedPsps.map((psp, idx) => (
                  <>
                    <Line
                      key={`${psp}-amt`}
                      yAxisId="left"
                      type="monotone"
                      dataKey={`${psp}__amount`}
                      name={`${psp} — Amount`}
                      stroke={COLORS[idx % COLORS.length]}
                      strokeWidth={3}
                      dot={false}
                    />
                    <Line
                      key={`${psp}-rate`}
                      yAxisId="right"
                      type="monotone"
                      dataKey={`${psp}__rate`}
                      name={`${psp} — Approval %`}
                      stroke={COLORS[idx % COLORS.length]}
                      strokeDasharray={DASH_PATTERNS[idx % DASH_PATTERNS.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  </>
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </motion.div>
        );

      case 'psp_timeline':
        return (
          <motion.div
            key="psp-timeline-chart"
            initial={showAnimation ? { opacity: 0, scale: 0.95 } : {}}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            style={{ height: chartHeight }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={pspTimelineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    name.includes('Amount') ? formatCurrency(value) : `${Number(value).toFixed(1)}%`,
                    name
                  ]}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="amount" name="Approved Amount" fill="#10b981" />
                <Line yAxisId="right" type="monotone" dataKey="approvalRate" name="Approval Rate %" stroke="#3b82f6" strokeWidth={3} />
              </ComposedChart>
            </ResponsiveContainer>
          </motion.div>
        );

      case 'countries':
        return (
          <motion.div
            key="countries-chart"
            initial={showAnimation ? { opacity: 0, scale: 0.95 } : {}}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            style={{ height: chartHeight }}
          >
            <div className="h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.countryDistribution.slice(0, 8)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ country, amount }) => `${country}: ${formatCurrency(amount)}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="amount"
                    animationBegin={0}
                    animationDuration={1000}
                  >
                    {data.countryDistribution.slice(0, 8).map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[index % COLORS.length]}
                        onClick={() => onCountrySelect?.(entry.country)}
                        style={{ cursor: 'pointer' }}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [formatCurrency(value), 'Amount']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 overflow-y-auto">
              {data.countryDistribution.slice(0, 10).map((country, index) => (
                <motion.div
                  key={country.country}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => onCountrySelect?.(country.country)}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="font-medium">{country.country}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatCurrency(country.amount)}</div>
                    <div className="text-sm text-muted-foreground">{formatNumber(country.count)} txns</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        );

      case 'timeline':
        return (
          <motion.div
            key="timeline-chart"
            initial={showAnimation ? { opacity: 0, scale: 0.95 } : {}}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            style={{ height: chartHeight }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.dailyTimelineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number, _name: string, props: any) => {
                    const date = props?.payload?.date;
                    const rate = timelineApprovalRateMap[date] ?? 0;
                    return [formatCurrency(value), `Approved Amount • Approval Rate: ${rate.toFixed(1)}%`];
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        );

      case 'status':
        return (
          <motion.div
            key="status-chart"
            initial={showAnimation ? { opacity: 0, scale: 0.95 } : {}}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            style={{ height: chartHeight }}
          >
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
                <Tooltip formatter={(value: number) => [formatNumber(value), 'Transactions']} />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>
        );

      case 'country_heatmap':
        return (
          <motion.div
            key="country-heatmap"
            initial={showAnimation ? { opacity: 0, scale: 0.95 } : {}}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            style={{ height: chartHeight }}
          >
            <ResponsiveContainer width="100%" height="100%">
              {/* Custom SVG heatmap */}
              {(
                () => {
                  const margin = { top: 40, right: 16, bottom: 60, left: 110 };
                  // Using fixed pixel dimensions inside ResponsiveContainer via viewBox
                  const width = 1200, height = 600;
                  const innerW = width - margin.left - margin.right;
                  const innerH = height - margin.top - margin.bottom;
                  const cols = Math.max(1, heatmapModel.buckets.length);
                  const rows = Math.max(1, heatmapModel.countries.length);
                  const cellW = innerW / cols;
                  const cellH = innerH / rows;

                  

                  if (heatmapModel.countries.length === 0 || heatmapModel.buckets.length === 0) {
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                        No data available for the selected filters.
                      </div>
                    );
                  }

                  const Legend = () => (
                    <g transform={`translate(${margin.left},${height - 40})`}>
                      <text x={0} y={0} fontSize={12} fill="#64748b">{heatmapMetric === 'amount' ? 'Amount' : 'Approval %'}</text>
                      {(heatmapMetric === 'amount' ? AMOUNT_STEPS : RATE_STEPS).map((c, i) => (
                        <rect key={i} x={70 + i*20} y={-10} width={18} height={10} fill={c} rx={2} ry={2} />
                      ))}
                      {heatmapMetric === 'amount' ? (
                        <>
                          <text x={70} y={12} fontSize={10} fill="#64748b">low</text>
                          <text x={70 + (AMOUNT_STEPS.length-1)*20} y={12} fontSize={10} fill="#64748b" textAnchor="end">high</text>
                        </>
                      ) : (
                        <>
                          <text x={70} y={12} fontSize={10} fill="#64748b">0%</text>
                          <text x={70 + (RATE_STEPS.length-1)*20} y={12} fontSize={10} fill="#64748b" textAnchor="end">100%</text>
                        </>
                      )}
                    </g>
                  );

                  return (
                    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" role="img">
                      {/* X axis labels (buckets) */}
                      {heatmapModel.buckets.map((b, i) => (
                        <text key={b} x={margin.left + i*cellW + cellW/2} y={margin.top - 10} textAnchor="middle" fontSize={11} fill="#334155">{b}</text>
                      ))}
                      {/* Y axis labels (countries) */}
                      {heatmapModel.countries.map((c, j) => (
                        <text key={c} x={margin.left - 8} y={margin.top + j*cellH + cellH/2 + 4} textAnchor="end" fontSize={12} fill="#334155">{c}</text>
                      ))}

                      {/* Cells */}
                      {heatmapModel.cells.map((cell) => {
                        const i = heatmapModel.buckets.indexOf(cell.bucket);
                        const j = heatmapModel.countries.indexOf(cell.country);
                        if (i < 0 || j < 0) return null;
                        const x = margin.left + i*cellW;
                        const y = margin.top + j*cellH;
                        const fill = (heatmapMetric === 'amount' ? colorAmountStepped(cell.amount) : colorRateStepped(cell.approvalRate));
                        const title = `${cell.country} • ${cell.bucket}\nAmount: ${formatCurrency(cell.amount)}\nApproval: ${cell.approvalRate.toFixed(1)}%`;
                        return (
                          <g key={`${cell.country}-${cell.bucket}`}>
                            <rect
                              x={x + 1}
                              y={y + 1}
                              width={Math.max(0, cellW - 2)}
                              height={Math.max(0, cellH - 2)}
                              rx={4}
                              ry={4}
                              fill={fill}
                              opacity={0.95}
                              stroke="#ffffff"
                              strokeOpacity={0.6}
                              style={{ cursor: 'pointer' }}
                              onClick={() => onCountrySelect?.(cell.country)}
                            />
                            <title>{title}</title>
                          </g>
                        );
                      })}

                      {/* Axes lines */}
                      <line x1={margin.left} y1={margin.top} x2={margin.left + innerW} y2={margin.top} stroke="#cbd5e1" strokeWidth={1} />
                      <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + innerH} stroke="#cbd5e1" strokeWidth={1} />

                      {/* Legend */}
                      <Legend />

                      {/* HTML tooltip overlay using foreignObject is complex; use portal div absolutely positioned */}
                    </svg>
                  );
                }
              )()}
            </ResponsiveContainer>
          </motion.div>
        );

      case 'advanced':
        return (
          <motion.div
            key="advanced-chart"
            initial={showAnimation ? { opacity: 0, scale: 0.95 } : {}}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            style={{ height: chartHeight }}
          >
            <div className="h-full">
              <h4 className="text-sm font-medium mb-2">PSP Performance Matrix</h4>
              <ResponsiveContainer width="100%" height="92%">
                <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis domain={[0, 100]} dataKey="approvalRate" name="Approval Rate %" tickFormatter={(v) => `${v}%`} />
                  <YAxis dataKey="volume" name="Approved Amount" tickFormatter={(v) => formatCurrency(v)} />
                  <Tooltip 
                    formatter={(value: number, name: string, props: any) => {
                      const p = props?.payload;
                      if (name === 'Approved Amount') return [formatCurrency(value), `${p?.name}`];
                      if (name === 'Approval Rate %' || name === 'approvalRate') return [`${Number(value).toFixed(1)}%`, `${p?.name}`];
                      return [value, `${p?.name}`];
                    }}
                    labelFormatter={() => 'PSP Performance'}
                  />
                  <Legend
                    payload={advancedAnalytics.performanceDistribution.map((d, i) => ({
                      id: d.name,
                      type: 'circle',
                      value: d.name,
                      color: COLORS[i % COLORS.length]
                    }))}
                  />
                  <Scatter data={advancedAnalytics.performanceDistribution}>
                    {advancedAnalytics.performanceDistribution.map((_, i) => (
                      <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="h-full">
              <h4 className="text-sm font-medium mb-2">PSP Approval Rate Leaderboard</h4>
              <ResponsiveContainer width="100%" height="92%">
                <BarChart data={advancedAnalytics.leaderboard} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-25} textAnchor="end" interval={0} height={60} />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, 'Approval Rate']} />
                  <Bar dataKey="approvalRate" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Chart Navigation */}
      <div className="flex flex-wrap gap-2">
        {chartTypes.map((chart) => (
          <Button
            key={chart.id}
            variant={activeChart === chart.id ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveChart(chart.id)}
            className="flex items-center gap-2"
          >
            <chart.icon className="w-4 h-4" />
            {chart.label}
          </Button>
        ))}
      </div>

      {/* Chart Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Style:</span>
          {(activeChart === 'psp' || activeChart === 'timeline') && (
            <div className="flex gap-1">
              <Button
                variant={chartStyle === 'bar' ? "default" : "outline"}
                size="sm"
                onClick={() => setChartStyle('bar')}
              >
                Bar
              </Button>
              {activeChart === 'timeline' && (
                <>
                  <Button
                    variant={chartStyle === 'line' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setChartStyle('line')}
                  >
                    Line
                  </Button>
                  <Button
                    variant={chartStyle === 'area' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setChartStyle('area')}
                  >
                    Area
                  </Button>
                </>
              )}
            </div>
          )}
          {activeChart === 'country_heatmap' && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Granularity:</span>
              <select
                className="text-sm border rounded px-2 py-1 bg-background"
                value={granularity}
                onChange={(e) => setGranularity(e.target.value as any)}
              >
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
              </select>
              <span className="text-sm font-medium">Metric:</span>
              <select
                className="text-sm border rounded px-2 py-1 bg-background"
                value={heatmapMetric}
                onChange={(e) => setHeatmapMetric(e.target.value as any)}
              >
                <option value="amount">Approved Amount</option>
                <option value="approval">Approval %</option>
              </select>
              {/* Amount Scale control removed; defaulting to quantile thresholds */}
              <span className="text-sm font-medium">Top Countries:</span>
              <select
                className="text-sm border rounded px-2 py-1 bg-background"
                value={countryTopN}
                onChange={(e) => setCountryTopN(Number(e.target.value))}
              >
                {[5,10,15,20,25,30].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          )}
          {activeChart === 'psp_timeline' && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">PSP:</span>
              <select
                className="text-sm border rounded px-2 py-1 bg-background"
                value={selectedPsp}
                onChange={(e) => setSelectedPsp(e.target.value)}
              >
                {pspOptions.map(psp => (
                  <option key={psp} value={psp}>{psp}</option>
                ))}
              </select>
            </div>
          )}
          {activeChart === 'psp_multi' && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Granularity:</span>
              <select
                className="text-sm border rounded px-2 py-1 bg-background"
                value={granularity}
                onChange={(e) => setGranularity(e.target.value as any)}
              >
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
              </select>
              <span className="text-sm font-medium">Top N PSPs:</span>
              <select
                className="text-sm border rounded px-2 py-1 bg-background"
                value={topN}
                onChange={(e) => setTopN(Number(e.target.value))}
              >
                {[3,5,10].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}>
            <Maximize2 className="w-4 h-4 mr-2" />
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </Button>
        </div>
      </div>

      {/* Chart Container */}
      <div
        ref={fsRef}
        className="rounded-lg"
        style={isFullscreen ? { width: '100vw', height: '100vh', padding: '1rem', boxSizing: 'border-box' } : undefined}
      >
      <Card className="p-6 rounded-xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">
            {chartTypes.find(c => c.id === activeChart)?.label} Analysis
          </h3>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {formatNumber(filteredTransactions.length)} transactions
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAnimation(!showAnimation)}
            >
              <Zap className={`w-4 h-4 ${showAnimation ? 'text-blue-600' : 'text-gray-400'}`} />
            </Button>
          </div>
        </div>
        
        <AnimatePresence mode="wait">
          {renderChart()}
        </AnimatePresence>
        <div className="mt-4 flex justify-end">
          <Button variant="outline" size="sm" onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}>
            <Maximize2 className="w-4 h-4 mr-2" />
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </Button>
        </div>
      </Card>
      </div>
    </div>
  );
}
