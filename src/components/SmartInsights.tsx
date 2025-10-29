import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Target, 
  Lightbulb,
  Clock,
  Globe,
  CreditCard,
  DollarSign
} from 'lucide-react';
import moment from 'moment-timezone';

interface Transaction {
  id: string;
  processing_date: string;
  pspName: string;
  country: string;
  amount: number;
  status: string;
  cardType?: string;
  declineReason?: string;
}

interface SmartInsightsProps {
  filteredTransactions: Transaction[];
}

interface Insight {
  id: string;
  type: 'success' | 'warning' | 'info' | 'danger';
  icon: React.ComponentType<any>;
  title: string;
  description: string;
  value?: string;
  trend?: 'up' | 'down' | 'stable';
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
  recommendation?: string;
}

export default function SmartInsights({ filteredTransactions }: SmartInsightsProps) {
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  const formatNumber = (num: number) => new Intl.NumberFormat('en-US').format(num);
  const insights = useMemo(() => {
    const approvedTxs = filteredTransactions.filter(tx => tx.status === 'approved');
    const declinedTxs = filteredTransactions.filter(tx => tx.status === 'declined');
    const totalAmount = approvedTxs.reduce((sum, tx) => sum + tx.amount, 0);
    
    const insights: Insight[] = [];

    // 1. Approval Rate Analysis
    const approvalRate = filteredTransactions.length > 0 
      ? (approvedTxs.length / (approvedTxs.length + declinedTxs.length)) * 100 
      : 0;
    
    if (approvalRate < 70) {
      insights.push({
        id: 'low-approval-rate',
        type: 'danger',
        icon: AlertTriangle,
        title: 'Low Approval Rate Detected',
        description: `Current approval rate is ${approvalRate.toFixed(1)}%, which is below the optimal 70% threshold.`,
        trend: 'down',
        priority: 'high',
        actionable: true,
        recommendation: 'Review declined transactions and consider optimizing PSP routing or fraud rules.'
      });
    } else if (approvalRate > 85) {
      insights.push({
        id: 'high-approval-rate',
        type: 'success',
        icon: TrendingUp,
        title: 'Excellent Approval Rate',
        description: `Outstanding approval rate of ${approvalRate.toFixed(1)}%! Your payment processing is performing well.`,
        trend: 'up',
        priority: 'low',
        actionable: false
      });
    }

    // 2. PSP Performance Analysis
    const pspStats = approvedTxs.reduce((acc, tx) => {
      if (!acc[tx.pspName]) {
        acc[tx.pspName] = { approved: 0, total: 0, amount: 0 };
      }
      acc[tx.pspName].approved++;
      acc[tx.pspName].amount += tx.amount;
      return acc;
    }, {} as Record<string, { approved: number; total: number; amount: number }>);

    // Add declined transactions to PSP stats
    declinedTxs.forEach(tx => {
      if (!pspStats[tx.pspName]) {
        pspStats[tx.pspName] = { approved: 0, total: 0, amount: 0 };
      }
      pspStats[tx.pspName].total++;
    });

    // Calculate total for each PSP
    Object.keys(pspStats).forEach(psp => {
      pspStats[psp].total += pspStats[psp].approved;
    });

    const bestPSP = Object.entries(pspStats)
      .filter(([_, stats]) => stats.total >= 5) // Only consider PSPs with significant volume
      .sort((a, b) => {
        const rateA = a[1].total > 0 ? (a[1].approved / a[1].total) : 0;
        const rateB = b[1].total > 0 ? (b[1].approved / b[1].total) : 0;
        return rateB - rateA;
      })[0];

    if (bestPSP) {
      const rate = (bestPSP[1].approved / bestPSP[1].total) * 100;
      insights.push({
        id: 'best-psp',
        type: 'success',
        icon: Target,
        title: 'Top Performing PSP',
        description: `${bestPSP[0]} has the highest approval rate at ${rate.toFixed(1)}% with ${formatCurrency(bestPSP[1].amount)} in approved transactions.`,
        priority: 'medium',
        actionable: true,
        recommendation: 'Consider routing more traffic to this PSP for better performance.'
      });
    }

    // 3. Peak Hours Analysis
    const hourlyStats = approvedTxs.reduce((acc, tx) => {
      const hour = moment(tx.processing_date).hour();
      if (!acc[hour]) acc[hour] = { count: 0, amount: 0 };
      acc[hour].count++;
      acc[hour].amount += tx.amount;
      return acc;
    }, {} as Record<number, { count: number; amount: number }>);

    const peakHour = Object.entries(hourlyStats)
      .sort((a, b) => b[1].amount - a[1].amount)[0];

    if (peakHour) {
      const hour = parseInt(peakHour[0]);
      const timeStr = `${hour}:00-${hour + 1}:00`;
      insights.push({
        id: 'peak-hour',
        type: 'info',
        icon: Clock,
        title: 'Peak Performance Hour',
        description: `${timeStr} is your highest revenue hour with ${formatCurrency(peakHour[1].amount)} in transactions.`,
        priority: 'medium',
        actionable: true,
        recommendation: 'Ensure optimal system capacity during peak hours and consider targeted promotions.'
      });
    }

    // 4. Geographic Performance
    const countryStats = approvedTxs.reduce((acc, tx) => {
      if (!acc[tx.country]) acc[tx.country] = { count: 0, amount: 0 };
      acc[tx.country].count++;
      acc[tx.country].amount += tx.amount;
      return acc;
    }, {} as Record<string, { count: number; amount: number }>);

    const topCountry = Object.entries(countryStats)
      .sort((a, b) => b[1].amount - a[1].amount)[0];

    if (topCountry && Object.keys(countryStats).length > 1) {
      const percentage = (topCountry[1].amount / totalAmount) * 100;
      insights.push({
        id: 'top-country',
        type: 'info',
        icon: Globe,
        title: 'Top Revenue Market',
        description: `${topCountry[0]} generates ${percentage.toFixed(1)}% of your revenue (${formatCurrency(topCountry[1].amount)}).`,
        priority: 'medium',
        actionable: true,
        recommendation: 'Focus marketing efforts and localized payment methods for this key market.'
      });
    }

    // 5. Decline Reason Analysis
    if (declinedTxs.length > 0) {
      const declineReasons = declinedTxs.reduce((acc, tx) => {
        const reason = tx.declineReason || 'Unknown';
        acc[reason] = (acc[reason] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const topDeclineReason = Object.entries(declineReasons)
        .sort((a, b) => b[1] - a[1])[0];

      if (topDeclineReason && topDeclineReason[1] > 5) {
        insights.push({
          id: 'top-decline-reason',
          type: 'warning',
          icon: CreditCard,
          title: 'Primary Decline Reason',
          description: `"${topDeclineReason[0]}" accounts for ${formatNumber(topDeclineReason[1])} declined transactions.`,
          priority: 'high',
          actionable: true,
          recommendation: 'Investigate and address the root cause of this decline reason to improve approval rates.'
        });
      }
    }

    // 6. Revenue Trend Analysis
    const dailyRevenue = approvedTxs.reduce((acc, tx) => {
      const date = moment(tx.processing_date).format('YYYY-MM-DD');
      if (!acc[date]) acc[date] = 0;
      acc[date] += tx.amount;
      return acc;
    }, {} as Record<string, number>);

    const dates = Object.keys(dailyRevenue).sort();
    if (dates.length >= 2) {
      const recentRevenue = dailyRevenue[dates[dates.length - 1]];
      const previousRevenue = dailyRevenue[dates[dates.length - 2]];
      const growth = ((recentRevenue - previousRevenue) / previousRevenue) * 100;

      if (Math.abs(growth) > 10) {
        insights.push({
          id: 'revenue-trend',
          type: growth > 0 ? 'success' : 'warning',
          icon: growth > 0 ? TrendingUp : TrendingDown,
          title: `Revenue ${growth > 0 ? 'Growth' : 'Decline'}`,
          description: `Daily revenue ${growth > 0 ? 'increased' : 'decreased'} by ${Math.abs(growth).toFixed(1)}% compared to the previous day.`,
          value: `${growth > 0 ? '+' : ''}${growth.toFixed(1)}%`,
          trend: growth > 0 ? 'up' : 'down',
          priority: Math.abs(growth) > 25 ? 'high' : 'medium',
          actionable: growth < 0,
          recommendation: growth < 0 ? 'Investigate the cause of revenue decline and implement recovery strategies.' : undefined
        });
      }
    }

    // 7. Average Transaction Value Analysis
    const avgTxValue = totalAmount / approvedTxs.length;
    if (avgTxValue > 100) {
      insights.push({
        id: 'high-value-transactions',
        type: 'success',
        icon: DollarSign,
        title: 'High-Value Transactions',
        description: `Average transaction value is ${formatCurrency(avgTxValue)}, indicating premium customer behavior.`,
        priority: 'low',
        actionable: true,
        recommendation: 'Consider premium services or upselling opportunities for high-value customers.'
      });
    }

    return insights.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }, [filteredTransactions]);

  const getInsightColor = (type: Insight['type']) => {
    switch (type) {
      case 'success': return 'text-green-600 bg-green-50 border-green-200';
      case 'warning': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'danger': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  const getIconColor = (type: Insight['type']) => {
    switch (type) {
      case 'success': return 'text-green-600';
      case 'warning': return 'text-orange-600';
      case 'danger': return 'text-red-600';
      default: return 'text-blue-600';
    }
  };

  if (insights.length === 0) {
    return (
      <Card className="p-8 rounded-2xl border-0 glass-card-strong">
        <div className="flex items-center gap-3 mb-4">
          <Lightbulb className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Smart Insights</h3>
        </div>
        <p className="text-muted-foreground">No significant insights available. Upload transaction data to see AI-powered recommendations.</p>
      </Card>
    );
  }

  return (
    <Card className="p-8 rounded-xl">
      <div className="flex items-center gap-3 mb-6">
        <Lightbulb className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Smart Insights</h3>
        <Badge variant="outline" className="text-xs">
          {insights.length} insights
        </Badge>
      </div>

      <div className="space-y-4">
        {insights.map((insight, index) => (
          <motion.div
            key={insight.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className={`p-4 border ${getInsightColor(insight.type)}`}>
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${getIconColor(insight.type)} bg-muted/60`}>
                  <insight.icon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium">{insight.title}</h4>
                    {insight.value && (
                      <Badge variant="outline" className="text-xs">
                        {insight.value}
                      </Badge>
                    )}
                    {insight.trend && (
                      <div className={`flex items-center ${
                        insight.trend === 'up' ? 'text-green-600' : 
                        insight.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {insight.trend === 'up' && <TrendingUp className="w-3 h-3" />}
                        {insight.trend === 'down' && <TrendingDown className="w-3 h-3" />}
                      </div>
                    )}
                    <Badge 
                      variant={insight.priority === 'high' ? 'destructive' : 
                              insight.priority === 'medium' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {insight.priority}
                    </Badge>
                  </div>
                  <p className="text-sm mb-2">{insight.description}</p>
                  {insight.recommendation && (
                    <div className="bg-muted/50 rounded-md p-3 mt-2">
                      <div className="flex items-start gap-2">
                        <Target className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm font-medium text-blue-800">
                          Recommendation: {insight.recommendation}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </Card>
  );
}
