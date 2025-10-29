import { useState, useMemo, useTransition, useEffect } from 'react';
import moment from 'moment-timezone';
import FileUpload from './FileUpload';
import TimezoneSelector from './TimezoneSelector';
import FilterPanel, { FilterState } from './FilterPanel';
import KPICards from './KPICards';
import DataTable from './DataTable';
import Charts from './ChartsEnhanced';
import InteractiveCharts from './InteractiveCharts';
import SmartInsights from './SmartInsights';
import ThemeToggle from './ThemeToggle';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
// Using custom dialog components
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { AlertTriangle, FileText, X, Brain, BarChart3, Eye } from 'lucide-react';

interface Transaction {
  id: string;
  processing_date: string;
  processing_ts?: number;
  local_date?: string;
  pspName: string;
  country: string;
  country_full?: string;
  email: string;
  amount: number;
  currency: string;
  status: string;
  cardType?: string;
  lastFourDigits?: string;
  declineReason?: string;
  midAlias?: string;
  type?: string;
  transactionId?: string;
  pspOrderId?: string;
  merchantOrderId?: string;
  bin?: string;
  paymentMethod?: string;
}

export default function Dashboard() {
  const [rawData, setRawData] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [timezone, setTimezone] = useState<'GMT+0' | 'GMT+6'>('GMT+0');
  const [selectedCountryDetails, setSelectedCountryDetails] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'analytics' | 'insights'>('overview');
  const [, startTransition] = useTransition();
  const [filters, setFilters] = useState<FilterState>({
    dateRange: { start: '', end: '' },
    psp: [],
    country: [],
    status: [],
    cardType: [],
    midAlias: [],
    type: [],
    method: []
  });

  // Deferred state updates to keep UI responsive during heavy recomputations
  const setTimezoneDeferred = (tz: 'GMT+0' | 'GMT+6') => {
    startTransition(() => setTimezone(tz));
  };
  const setFiltersDeferred = (next: FilterState) => {
    startTransition(() => setFilters(next));
  };

  // Handle country selection for detailed analysis
  const handleCountrySelect = (country: string) => {
    setSelectedCountryDetails(country);
  };

  // Convert raw data to transactions with timezone handling
  const transactions = useMemo(() => {
    const toFullCountryName = (value: string) => {
      if (!value) return '';
      const v = String(value).trim();
      if (v.length === 2 && /^[A-Za-z]{2}$/.test(v)) {
        try {
          const dn = new (Intl as any).DisplayNames(['en'], { type: 'region' });
          const name = dn.of(v.toUpperCase());
          if (name && typeof name === 'string') return name as string;
        } catch {}
      }
      return v.replace(/\b([a-z])(\w*)/gi, (_: any, a: string, b: string) => a.toUpperCase() + b.toLowerCase());
    };
    return rawData.map((row, index) => {
      const originalDate = row.processing_date;
      // Normalize to UTC instant (do NOT shift the instant). We will only change grouping/labels per selected TZ.
      const processingTs = moment.utc(originalDate).valueOf();
      const convertedDate = moment.utc(originalDate).toISOString();
      const tz = timezone === 'GMT+6' ? 'Asia/Dhaka' : 'UTC';
      const localDate = moment.tz(processingTs, tz).format('YYYY-MM-DD');
      
      const countryRaw = row.country || '';
      const country_full = toFullCountryName(countryRaw);
      return {
        id: row.id || `tx_${index}`,
        processing_date: convertedDate,
        processing_ts: processingTs,
        local_date: localDate,
        pspName: row.pspName || '',
        country: countryRaw,
        country_full,
        email: row.email || '',
        amount: parseFloat(row.amount) || 0,
        currency: row.currency || 'USD',
        status: row.status || '',
        cardType: row.cardType || '',
        lastFourDigits: row.lastFourDigits || '',
        declineReason: row.declineReason || '',
        midAlias: row.midAlias || '',
        type: row.type || '',
        transactionId: row.transactionId || '',
        pspOrderId: row.pspOrderId || '',
        merchantOrderId: row.merchantOrderId || row.id || `tx_${index}`,
        bin: row.bin || '',
        paymentMethod: row.paymentMethod || ''
      };
    });
  }, [rawData, timezone]);

  // Check for incomplete day data
  const { hasIncompleteDay, incompleteDate } = useMemo(() => {
    if (timezone === 'GMT+0' || transactions.length === 0) {
      return { hasIncompleteDay: false, incompleteDate: '' };
    }

    // Group transactions by date in GMT+6 timezone based on the UTC instant
    const tz = 'Asia/Dhaka';
    const dateGroups = transactions.reduce((acc, tx) => {
      const date = moment.tz(tx.processing_ts ?? moment.utc(tx.processing_date).valueOf(), tz).format('YYYY-MM-DD');
      if (!acc[date]) acc[date] = [];
      acc[date].push(tx);
      return acc;
    }, {} as Record<string, Transaction[]>);

    // Check if any date has less than expected hourly coverage
    for (const [date, txs] of Object.entries(dateGroups)) {
      const hours = new Set(txs.map(tx => moment.tz(tx.processing_ts ?? moment.utc(tx.processing_date).valueOf(), tz).hour()));
      if (hours.size < 12) { // If less than 12 hours of data, consider incomplete
        return { hasIncompleteDay: true, incompleteDate: date };
      }
    }

    return { hasIncompleteDay: false, incompleteDate: '' };
  }, [transactions, timezone]);

  // Apply filters to transactions
  const filteredTransactions = useMemo(() => {
    const t0 = performance.now();
    // Precompute inclusive day boundaries in the selected timezone
    const startBoundary = filters.dateRange.start
      ? (timezone === 'GMT+6'
          ? moment.tz(filters.dateRange.start, 'Asia/Dhaka').startOf('day').valueOf()
          : moment.utc(filters.dateRange.start).startOf('day').valueOf())
      : undefined;
    const endBoundary = filters.dateRange.end
      ? (timezone === 'GMT+6'
          ? moment.tz(filters.dateRange.end, 'Asia/Dhaka').endOf('day').valueOf()
          : moment.utc(filters.dateRange.end).endOf('day').valueOf())
      : undefined;

    // Convert array filters to Sets for O(1) lookups
    const pspSet = filters.psp.length ? new Set(filters.psp) : null;
    const countrySet = filters.country.length ? new Set(filters.country) : null;
    const statusSet = filters.status.length ? new Set(filters.status) : null;
    const cardTypeSet = filters.cardType.length ? new Set(filters.cardType) : null;
    const midAliasSet = filters.midAlias.length ? new Set(filters.midAlias) : null;

    // Map PSP -> Method category
    const pspToMethod = (psp: string): 'Card' | 'Crypto' | 'P2P' => {
      const name = (psp || '').toLowerCase();
      if (name === 'confirmo') return 'Crypto';
      if (name === 'paypal') return 'P2P';
      return 'Card'; // everything else considered Card
    };
    const methodSet = (filters.method && filters.method.length) ? new Set(filters.method) : null;

    const filtered = transactions.filter(tx => {
      // Date range filter
      if (filters.dateRange.start || filters.dateRange.end) {
        const ts = tx.processing_ts ?? moment.utc(tx.processing_date).valueOf();
        if (startBoundary !== undefined && ts < startBoundary) return false;
        if (endBoundary !== undefined && ts > endBoundary) return false;
      }

      // PSP filter
      if (pspSet && !pspSet.has(tx.pspName)) return false;

      // Country filter (match against normalized full name)
      if (countrySet && !countrySet.has(tx.country_full as string)) return false;

      // Status filter
      if (statusSet && !statusSet.has(tx.status)) return false;

      // Card type filter
      if (cardTypeSet && !cardTypeSet.has(tx.cardType as string)) return false;

      // MID Alias filter
      if (midAliasSet && !midAliasSet.has(tx.midAlias as string)) return false;

      // Method filter (based on PSP mapping)
      if (methodSet) {
        const derived = pspToMethod(tx.pspName);
        if (!methodSet.has(derived)) return false;
      }

      return true;
    });
    
    // Debug logging for filter results
    if (transactions.length > 0) {
      const t1 = performance.now();
      console.log(`Filter Results (${timezone}) in ${(t1 - t0).toFixed(2)}ms`, {
        totalTransactions: transactions.length,
        filteredTransactions: filtered.length,
        dateRange: filters.dateRange,
        timezone: timezone
      });
    }
    
    return filtered;
  }, [transactions, filters]);

  // Get available filter options from current data
  const availableOptions = useMemo(() => {
    const unique = (arr: string[]) => Array.from(new Set(arr)).filter(Boolean).sort();
    
    return {
      psps: unique(transactions.map(tx => tx.pspName)),
      countries: unique(transactions.map(tx => tx.country_full)),
      statuses: unique(transactions.map(tx => tx.status)),
      cardTypes: unique(transactions.map(tx => tx.cardType)),
      midAliases: unique(transactions.map(tx => tx.midAlias)),
      types: unique(transactions.map(tx => tx.type))
    };
  }, [transactions]);

  // Calculate KPI data
  const kpiData = useMemo(() => {
    // Sophisticated approval ratio based on merchantOrderId
    // Collapse multiple declines for the same merchantOrderId to one declined
    // If any PSP approves a merchantOrderId, count it as approved overall and do not count as declined
    const moidGroups = filteredTransactions.reduce((acc, tx) => {
      const key = tx.merchantOrderId || tx.transactionId || tx.id;
      if (!acc[key]) acc[key] = [] as Transaction[];
      acc[key].push(tx as any);
      return acc;
    }, {} as Record<string, Transaction[]>);

    let approvedOverall = 0;
    let declinedOverall = 0;
    const approvedTransactions: Transaction[] = [];

    Object.values(moidGroups).forEach(group => {
      const hasApprovedAnywhere = group.some(t => t.status === 'approved');
      if (hasApprovedAnywhere) {
        approvedOverall += 1;
        // For amount and contextual metrics, consider the first approved row
        const firstApproved = group.find(t => t.status === 'approved');
        if (firstApproved) approvedTransactions.push(firstApproved);
      } else if (group.some(t => t.status === 'declined')) {
        declinedOverall += 1;
      }
    });

    const totalRelevantTransactions = approvedOverall + declinedOverall;
    
    // Total amount and unique counts should be based on APPROVED transactions only
    const totalAmount = approvedTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const uniqueCountries = Array.from(new Set(approvedTransactions.map(tx => tx.country_full))).length;
    const uniqueEmails = Array.from(new Set(approvedTransactions.map(tx => tx.email))).length;
    
    // Calculate approval rate (only metric that uses both approved and declined)
    const approvalRate = totalRelevantTransactions > 0 
      ? (approvedTransactions.length / totalRelevantTransactions) * 100 
      : 0;
    
    // Average daily revenue metric (approved only):
    // Default: total approved amount / number of active days (days with at least one approved txn) => label 'per day'
    // If a single active day is selected: total approved amount / number of active hours (hours with at least one approved txn) => label 'per hour'
    let avgAmount = 0;
    let avgLabel = 'per day';

    const tz = timezone === 'GMT+6' ? 'Asia/Dhaka' : 'UTC';
    // Group approved transactions by local date
    const dateGroups = approvedTransactions.reduce((acc, tx) => {
      const date = moment.tz(tx.processing_ts ?? moment.utc(tx.processing_date).valueOf(), tz).format('YYYY-MM-DD');
      if (!acc[date]) acc[date] = [] as Transaction[];
      acc[date].push(tx);
      return acc;
    }, {} as Record<string, Transaction[]>);

    const activeDays = Object.keys(dateGroups).length;

    if (activeDays === 1) {
      // Per-hour average for the single active day
      const onlyDay = Object.values(dateGroups)[0] ?? [];
      const hourSet = new Set<number>();
      onlyDay.forEach(tx => {
        const hour = moment.tz(tx.processing_ts ?? moment.utc(tx.processing_date).valueOf(), tz).hour();
        hourSet.add(hour);
      });
      const activeHours = hourSet.size;
      avgAmount = activeHours > 0 ? totalAmount / activeHours : 0;
      avgLabel = 'per hour';
    } else {
      avgAmount = activeDays > 0 ? totalAmount / activeDays : 0;
      avgLabel = 'per day';
    }

    return {
      totalTransactions: approvedOverall, // approved by merchantOrderId
      approvalRate,
      totalAmount, // Only approved amounts
      avgAmount, // Only approved amounts
      avgAmountLabel: avgLabel,
      uniqueCountries, // Based on approved transactions only
      uniqueEmails // Based on approved transactions only
    };
  }, [filteredTransactions, filters]);

  // Prepare chart data
  const chartData = useMemo(() => {
    const t0 = performance.now();
    // Build merchantOrderId groups once
    const byMoid = filteredTransactions.reduce((acc, tx) => {
      const moid = tx.merchantOrderId || tx.transactionId || tx.id;
      if (!acc[moid]) acc[moid] = [] as Transaction[];
      acc[moid].push(tx as any);
      return acc;
    }, {} as Record<string, Transaction[]>);

    // Aggregates computed in a single pass over MOID groups
    const pspAgg: Record<string, { approvedCount: number; declinedCount: number; approvedAmount: number }> = {};
    const midAgg: Record<string, { approvedCount: number; declinedCount: number; approvedAmount: number }> = {};
    const countryAgg: Record<string, { approvedCount: number; declinedCount: number; approvedAmount: number; approvedTxs: number }> = {};

    Object.values(byMoid).forEach(rows => {
      // Unique dimension values within this MOID group
      const psps = Array.from(new Set(rows.map(r => r.pspName).filter(Boolean)));
      const mids = Array.from(new Set(rows.map(r => (r as any).midAlias).filter(Boolean)));
      const countries = Array.from(new Set(rows.map(r => (r as any).country_full).filter(Boolean)));

      // Status per dimension subset
      const handleSubset = (subset: Transaction[], onApproved: (approvedRow: Transaction) => void, onDeclined: () => void) => {
        const hasApproved = subset.some(r => r.status === 'approved');
        const hasDeclined = subset.some(r => r.status === 'declined');
        if (hasApproved) {
          const approvedRow = subset.find(r => r.status === 'approved');
          if (approvedRow) onApproved(approvedRow);
        } else if (hasDeclined) {
          onDeclined();
        }
      };

      psps.forEach(val => {
        const subset = rows.filter(r => r.pspName === val);
        if (!pspAgg[val]) pspAgg[val] = { approvedCount: 0, declinedCount: 0, approvedAmount: 0 };
        handleSubset(subset, (approvedRow) => { pspAgg[val].approvedCount += 1; pspAgg[val].approvedAmount += approvedRow.amount; }, () => { pspAgg[val].declinedCount += 1; });
      });

      mids.forEach(val => {
        const subset = rows.filter(r => (r as any).midAlias === val);
        if (!midAgg[val]) midAgg[val] = { approvedCount: 0, declinedCount: 0, approvedAmount: 0 };
        handleSubset(subset, (approvedRow) => { midAgg[val].approvedCount += 1; midAgg[val].approvedAmount += approvedRow.amount; }, () => { midAgg[val].declinedCount += 1; });
      });

      countries.forEach(country => {
        const subset = rows.filter(r => (r as any).country_full === country);
        if (!countryAgg[country]) countryAgg[country] = { approvedCount: 0, declinedCount: 0, approvedAmount: 0, approvedTxs: 0 };
        handleSubset(subset, (approvedRow) => { countryAgg[country].approvedCount += 1; countryAgg[country].approvedTxs += 1; countryAgg[country].approvedAmount += approvedRow.amount; }, () => { countryAgg[country].declinedCount += 1; });
        // approvedTxs already incremented when approved
      });
    });

    const pspStats = Object.entries(pspAgg).map(([psp, g]) => ({
      psp,
      approved: g.approvedAmount,
      approvedCount: g.approvedCount,
      declined: g.declinedCount,
      approvedAmount: g.approvedAmount,
      declinedAmount: 0,
      approvalRate: (g.approvedCount + g.declinedCount) > 0 ? (g.approvedCount / (g.approvedCount + g.declinedCount)) * 100 : 0
    })).filter(stat => stat.approved > 0 || stat.declined > 0);

    const midAliasStats = Object.entries(midAgg).map(([midAlias, g]) => ({
      midAlias,
      approvedCount: g.approvedCount,
      declinedCount: g.declinedCount,
      approvedAmount: g.approvedAmount,
      approvalRate: (g.approvedCount + g.declinedCount) > 0 ? (g.approvedCount / (g.approvedCount + g.declinedCount)) * 100 : 0
    })).filter(stat => (stat.approvedCount + stat.declinedCount) > 0);

    const countryStats = Object.entries(countryAgg)
      .map(([country, g]) => ({
        country,
        count: g.approvedTxs,
        amount: g.approvedAmount,
        approvedCount: g.approvedCount,
        declinedCount: g.declinedCount,
        approvalRate: (g.approvedCount + g.declinedCount) > 0 ? (g.approvedCount / (g.approvedCount + g.declinedCount)) * 100 : 0
      }))
      .filter(stat => stat.count > 0 || stat.declinedCount > 0)
      .sort((a, b) => b.amount - a.amount);

    // Timeline Data (24 hours) — build in a single pass
    const tz = timezone === 'GMT+6' ? 'Asia/Dhaka' : 'UTC';
    const timelineBuckets = Array.from({ length: 24 }, (_, hour) => ({ hour, transactions: 0, amount: 0 }));
    for (const tx of filteredTransactions) {
      if (tx.status !== 'approved') continue;
      const hour = moment.tz(tx.processing_ts ?? moment.utc(tx.processing_date).valueOf(), tz).hour();
      const b = timelineBuckets[hour];
      b.transactions += 1;
      b.amount += tx.amount;
    }
    const timelineStats = timelineBuckets;

    // Daily Timeline Data - Focus on approved transactions only
    const dailyTimelineStats = (() => {
      const dateGroups = filteredTransactions.reduce((acc, tx) => {
        const date = tx.local_date || moment(tx.processing_date).format('YYYY-MM-DD');
        if (!acc[date]) acc[date] = [];
        acc[date].push(tx);
        return acc;
      }, {} as Record<string, Transaction[]>);

      return Object.entries(dateGroups)
        .map(([date, dayTxs]) => {
          const approvedTxs = dayTxs.filter(tx => tx.status === 'approved');
          return {
            date,
            transactions: approvedTxs.length,
            amount: approvedTxs.reduce((sum, tx) => sum + tx.amount, 0)
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date));
    })();

    // Weekly Timeline Data - Focus on approved transactions only
    const weeklyTimelineStats = (() => {
      const weekGroups = filteredTransactions.reduce((acc, tx) => {
        const week = moment.tz(tx.processing_ts ?? moment.utc(tx.processing_date).valueOf(), tz).format('YYYY-[W]WW');
        if (!acc[week]) acc[week] = [];
        acc[week].push(tx);
        return acc;
      }, {} as Record<string, Transaction[]>);

      return Object.entries(weekGroups)
        .map(([week, weekTxs]) => {
          const approvedTxs = weekTxs.filter(tx => tx.status === 'approved');
          return {
            week,
            transactions: approvedTxs.length,
            amount: approvedTxs.reduce((sum, tx) => sum + tx.amount, 0)
          };
        })
        .sort((a, b) => a.week.localeCompare(b.week));
    })();

    // Monthly Timeline Data - Focus on approved transactions only
    const monthlyTimelineStats = (() => {
      const monthGroups = filteredTransactions.reduce((acc, tx) => {
        const month = moment.tz(tx.processing_ts ?? moment.utc(tx.processing_date).valueOf(), tz).format('YYYY-MM');
        if (!acc[month]) acc[month] = [];
        acc[month].push(tx);
        return acc;
      }, {} as Record<string, Transaction[]>);

      return Object.entries(monthGroups)
        .map(([month, monthTxs]) => {
          const approvedTxs = monthTxs.filter(tx => tx.status === 'approved');
          return {
            month,
            transactions: approvedTxs.length,
            amount: approvedTxs.reduce((sum, tx) => sum + tx.amount, 0)
          };
        })
        .sort((a, b) => a.month.localeCompare(b.month));
    })();

    // Status Breakdown (approved vs declined) using merchantOrderId-deduped counts
    let approvedCountOverall = 0;
    let declinedCountOverall = 0;
    Object.values(byMoid).forEach(rows => {
      const hasApproved = rows.some(r => r.status === 'approved');
      if (hasApproved) approvedCountOverall += 1; else if (rows.some(r => r.status === 'declined')) declinedCountOverall += 1;
    });

    const totalForPie = approvedCountOverall + declinedCountOverall;
    const statusStats = [
      {
        status: 'approved',
        count: approvedCountOverall,
        amount: 0,
        percentage: totalForPie > 0 ? (approvedCountOverall / totalForPie) * 100 : 0
      },
      {
        status: 'declined',
        count: declinedCountOverall,
        amount: 0,
        percentage: totalForPie > 0 ? (declinedCountOverall / totalForPie) * 100 : 0
      }
    ];

    // Amount Distribution (approved transactions only for both count and amount)
    const ranges = [
      { range: '$0-50', min: 0, max: 50 },
      { range: '$50-100', min: 50, max: 100 },
      { range: '$100-200', min: 100, max: 200 },
      { range: '$200-500', min: 200, max: 500 },
      { range: '$500+', min: 500, max: Infinity }
    ];

    const amountStats = ranges.map(({ range, min, max }) => {
      const approvedTxsInRange = filteredTransactions.filter(tx => 
        tx.status === 'approved' && tx.amount >= min && tx.amount < max
      );
      return {
        range,
        count: approvedTxsInRange.length,
        totalAmount: approvedTxsInRange.reduce((sum, tx) => sum + tx.amount, 0)
      };
    });

    const result = {
      pspPerformance: pspStats,
      midAliasPerformance: midAliasStats,
      countryDistribution: countryStats,
      timelineData: timelineStats,
      dailyTimelineData: dailyTimelineStats,
      weeklyTimelineData: weeklyTimelineStats,
      monthlyTimelineData: monthlyTimelineStats,
      statusBreakdown: statusStats,
      amountDistribution: amountStats
    };

    const t1 = performance.now();
    if (filteredTransactions.length > 0) {
      console.log(`chartData computed in ${(t1 - t0).toFixed(2)}ms for ${filteredTransactions.length} rows`);
    }
    return result;
  }, [filteredTransactions, availableOptions, timezone]);

  // Calculate detailed country analysis
  const countryDetailData = useMemo(() => {
    if (!selectedCountryDetails) return null;
    
    const countryTxs = filteredTransactions.filter(tx => (tx as any).country_full === selectedCountryDetails);
    
    // PSP performance for this country - Focus on approved transactions
    const pspStats = availableOptions.psps.map(psp => {
      const pspCountryTxs = countryTxs.filter(tx => tx.pspName === psp);
      const approved = pspCountryTxs.filter(tx => tx.status === 'approved');
      const declined = pspCountryTxs.filter(tx => tx.status === 'declined');
      
      return {
        psp,
        transactions: approved.length, // Show only approved transaction count
        approved: approved.length,
        declined: declined.length,
        approvalRate: (approved.length + declined.length) > 0 ? (approved.length / (approved.length + declined.length)) * 100 : 0,
        totalAmount: approved.reduce((sum, tx) => sum + tx.amount, 0), // approved amounts only
        avgAmount: approved.length > 0 ? approved.reduce((sum, tx) => sum + tx.amount, 0) / approved.length : 0
      };
    }).filter(stat => stat.transactions > 0); // Show PSPs with approved transactions
    
    // Daily breakdown
    const tz = timezone === 'GMT+6' ? 'Asia/Dhaka' : 'UTC';
    const dateGroups = countryTxs.reduce((acc, tx) => {
      const date = moment.tz(tx.processing_ts ?? moment.utc(tx.processing_date).valueOf(), tz).format('YYYY-MM-DD');
      if (!acc[date]) acc[date] = [];
      acc[date].push(tx);
      return acc;
    }, {} as Record<string, Transaction[]>);
    
    const dailyStats = Object.entries(dateGroups).map(([date, dayTxs]) => {
      const approvedTxs = dayTxs.filter(tx => tx.status === 'approved');
      const declinedTxs = dayTxs.filter(tx => tx.status === 'declined');
      const approvedDeclinedCount = approvedTxs.length + declinedTxs.length;
      
      return {
        date,
        transactions: approvedTxs.length, // Show only approved transaction count
        approved: approvedTxs.length,
        declined: declinedTxs.length,
        totalAmount: approvedTxs.reduce((sum, tx) => sum + tx.amount, 0), // approved amounts only
        approvalRate: approvedDeclinedCount > 0 ? (approvedTxs.length / approvedDeclinedCount) * 100 : 0
      };
    }).sort((a, b) => a.date.localeCompare(b.date));
    
    const approvedCountryTxs = countryTxs.filter(tx => tx.status === 'approved');
    const declinedCountryTxs = countryTxs.filter(tx => tx.status === 'declined');
    const approvedDeclinedCount = approvedCountryTxs.length + declinedCountryTxs.length;
    
    return {
      country: selectedCountryDetails,
      totalTransactions: approvedCountryTxs.length, // Show only approved transaction count
      approvedTransactions: approvedCountryTxs.length, // approved count only (for average calculation)
      totalAmount: approvedCountryTxs.reduce((sum, tx) => sum + tx.amount, 0), // approved amounts only
      approvalRate: approvedDeclinedCount > 0 ? (approvedCountryTxs.length / approvedDeclinedCount) * 100 : 0,
      pspBreakdown: pspStats,
      dailyBreakdown: dailyStats
    };
  }, [selectedCountryDetails, filteredTransactions, availableOptions.psps]);

  // Format currency helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const handleDataLoaded = (data: any[], name: string) => {
    setRawData(data);
    setFileName(name);
    console.log('Dashboard: Data loaded -', data.length, 'rows from', name);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-popover/90 backdrop-blur supports-[backdrop-filter]:bg-popover/80">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 shadow-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                  Revenue Analytics
                </h1>
                <p className="text-sm text-slate-600 font-medium">Transaction Analysis Dashboard</p>
              </div>
              {fileName && (
                <Badge 
                  variant="outline" 
                  className="text-xs font-medium bg-blue-50/80 text-blue-700 border-blue-200/80 backdrop-blur-sm" 
                  data-testid="current-file"
                >
                  📊 {fileName}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3">
              <TimezoneSelector
                currentTimezone={timezone}
                onTimezoneChange={setTimezoneDeferred}
                hasIncompleteDay={hasIncompleteDay}
                incompleteDate={incompleteDate}
              />
              <ThemeToggle />
            </div>
          </div>
          
          {/* View Mode Navigation */}
          {rawData.length > 0 && (
            <div className="mt-6 border-t border-white/20 pt-6">
              <div className="flex space-x-2 rounded-xl border bg-popover p-2 text-popover-foreground max-w-lg">
                <button 
                  className={`flex-1 px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${
                    viewMode === 'overview' 
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25 transform scale-105' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-accent'
                  }`}
                  onClick={() => setViewMode('overview')}
                >
                  <Eye className="w-4 h-4" />
                  <span className="hidden sm:inline">Overview</span>
                </button>
                <button 
                  className={`flex-1 px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${
                    viewMode === 'analytics' 
                      ? 'bg-gradient-to-r from-violet-500 to-violet-600 text-white shadow-lg shadow-violet-500/25 transform scale-105' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-accent'
                  }`}
                  onClick={() => setViewMode('analytics')}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span className="hidden sm:inline">Analytics</span>
                </button>
                <button 
                  className={`flex-1 px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${
                    viewMode === 'insights' 
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25 transform scale-105' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-accent'
                  }`}
                  onClick={() => setViewMode('insights')}
                >
                  <Brain className="w-4 h-4" />
                  <span className="hidden sm:inline">Insights</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {rawData.length === 0 ? (
          // Enhanced File Upload State
          <div className="max-w-4xl mx-auto mt-16">
            <div className="text-center mb-12">
              <div className="inline-flex p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 to-violet-500/10 border border-blue-200/50 backdrop-blur-sm mb-6">
                <FileText className="w-12 h-12 text-blue-600" />
              </div>
              <h2 className="text-3xl font-bold text-slate-800 mb-4">
                Welcome to Revenue Analytics
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Upload your transaction data to unlock powerful insights and analytics
              </p>
            </div>
            
            <FileUpload onDataLoaded={handleDataLoaded} />
            
            <div className="mt-12 text-center">
              <h3 className="text-xl font-semibold text-slate-800 mb-6">Powerful Analytics at Your Fingertips</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { icon: '📊', title: 'PSP Performance', desc: 'Analyze payment provider efficiency' },
                  { icon: '🌍', title: 'Country Patterns', desc: 'Geographic transaction insights' },
                  { icon: '📈', title: 'Time Analysis', desc: 'Temporal trends and patterns' },
                  { icon: '✅', title: 'Status Breakdown', desc: 'Success and failure rates' },
                  { icon: '🏷️', title: 'MID Analysis', desc: 'Merchant identifier performance' },
                  { icon: '💰', title: 'Amount Distribution', desc: 'Revenue and transaction sizes' },
                  { icon: '💳', title: 'Card Type Analysis', desc: 'Payment method insights' },
                  { icon: '🧠', title: 'Smart Insights', desc: 'AI-powered recommendations' }
                ].map((item, index) => (
                  <div key={index} className="p-4 rounded-xl border bg-card transition-all duration-300 hover:shadow-md">
                    <div className="text-2xl mb-2">{item.icon}</div>
                    <h4 className="font-semibold text-slate-800 text-sm mb-1">{item.title}</h4>
                    <p className="text-xs text-slate-600">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // Enhanced Main Dashboard
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Enhanced Filters Sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-8">
                <FilterPanel
                  filters={filters}
                  onFiltersChange={setFiltersDeferred}
                  availableOptions={availableOptions}
                />
              </div>
            </div>

            {/* Enhanced Main Content */}
            <div className="lg:col-span-3 space-y-8">
              {/* Enhanced Incomplete Day Warning */}
              {hasIncompleteDay && (
                <Card className="p-6 rounded-xl border bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-800/40 border border-orange-200 dark:border-orange-700">
                      <AlertTriangle className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-orange-800 dark:text-orange-200 text-lg mb-2">
                        ⚠️ Incomplete Day Data Detected
                      </h3>
                      <p className="text-sm text-orange-700 dark:text-orange-300 leading-relaxed">
                        <strong>{incompleteDate}</strong> doesn't have complete 24-hour transaction data in GMT+6 timezone. 
                        Analysis results may not reflect the full day's activity.
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Enhanced KPI Cards */}
              <div className="animate-fade-in">
                <KPICards data={kpiData} />
              </div>

              {/* Enhanced Charts & Analysis by View Mode */}
              <div className="animate-slide-up">
                {viewMode === 'overview' && (
                  <Charts 
                    data={chartData} 
                    loading={!rawData.length}
                    onCountrySelect={handleCountrySelect}
                    dateRangeFilter={filters.dateRange}
                  />
                )}

                {viewMode === 'analytics' && (
                  <InteractiveCharts 
                    data={chartData as any}
                    loading={!rawData.length}
                    onCountrySelect={handleCountrySelect}
                    filteredTransactions={filteredTransactions}
                  />
                )}

                {viewMode === 'insights' && (
                  <SmartInsights 
                    filteredTransactions={filteredTransactions as any}
                  />
                )}
              </div>

              {/* Enhanced Data Table */}
              <div className="animate-fade-in">
                <DataTable transactions={filteredTransactions.slice(0, 50)} />
              </div>
            </div>
          </div>
        )}

        {/* Country Details Modal */}
        <Dialog open={!!selectedCountryDetails} onOpenChange={() => setSelectedCountryDetails(null)}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                <div className="flex items-center justify-between">
                <span>Country Analysis: {selectedCountryDetails}</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setSelectedCountryDetails(null)}
                  data-testid="button-close-country-details"
                >
                  <X className="h-4 w-4" />
                </Button>
                </div>
              </DialogTitle>
              <DialogDescription>
                Detailed breakdown of transaction performance for {selectedCountryDetails}
              </DialogDescription>
            </DialogHeader>
            
            {countryDetailData && (
              <div className="space-y-6">
                {/* Country Summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground">Approved Transactions</div>
                    <div className="text-2xl font-bold">{countryDetailData.totalTransactions}</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground">Total Approved Amount</div>
                    <div className="text-2xl font-bold">{formatCurrency(countryDetailData.totalAmount)}</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground">Approval Rate</div>
                    <div className="text-2xl font-bold">{countryDetailData.approvalRate.toFixed(1)}%</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground">Avg per Transaction</div>
                    <div className="text-2xl font-bold">{formatCurrency(countryDetailData.approvedTransactions > 0 ? countryDetailData.totalAmount / countryDetailData.approvedTransactions : 0)}</div>
                  </Card>
                </div>

                {/* PSP Breakdown */}
                <Card className="p-4">
                  <h3 className="text-lg font-medium mb-4">PSP Performance</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>PSP</TableHead>
                        <TableHead>Approved Transactions</TableHead>
                        <TableHead>Approved</TableHead>
                        <TableHead>Declined</TableHead>
                        <TableHead>Approval Rate</TableHead>
                        <TableHead>Total Approved Amount</TableHead>
                        <TableHead>Avg Approved Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {countryDetailData.pspBreakdown.map((psp) => (
                        <TableRow key={psp.psp}>
                          <TableCell className="font-medium">{psp.psp}</TableCell>
                          <TableCell>{psp.transactions}</TableCell>
                          <TableCell className="text-green-600">{psp.approved}</TableCell>
                          <TableCell className="text-red-600">{psp.declined}</TableCell>
                          <TableCell>
                            <Badge variant={psp.approvalRate >= 70 ? "default" : "destructive"}>
                              {psp.approvalRate.toFixed(1)}%
                            </Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(psp.totalAmount)}</TableCell>
                          <TableCell>{formatCurrency(psp.avgAmount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>

                {/* Daily Breakdown */}
                <Card className="p-4">
                  <h3 className="text-lg font-medium mb-4">Daily Performance</h3>
                  <div className="max-h-64 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Approved Transactions</TableHead>
                          <TableHead>Approved</TableHead>
                          <TableHead>Declined</TableHead>
                          <TableHead>Approval Rate</TableHead>
                          <TableHead>Total Approved Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {countryDetailData.dailyBreakdown.map((day) => (
                          <TableRow key={day.date}>
                            <TableCell className="font-medium">{day.date}</TableCell>
                            <TableCell>{day.transactions}</TableCell>
                            <TableCell className="text-green-600">{day.approved}</TableCell>
                            <TableCell className="text-red-600">{day.declined}</TableCell>
                            <TableCell>
                              <Badge variant={day.approvalRate >= 70 ? "default" : "destructive"}>
                                {day.approvalRate.toFixed(1)}%
                              </Badge>
                            </TableCell>
                            <TableCell>{formatCurrency(day.totalAmount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}