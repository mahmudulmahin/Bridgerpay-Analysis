import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Globe, Users, ArrowUpRight, ArrowDownRight, Target, Activity } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

interface KPIData {
  totalTransactions: number;
  approvalRate: number;
  totalAmount: number;
  avgAmount: number;
  avgAmountLabel: string;
  uniqueCountries: number;
  uniqueEmails: number;
}

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  format?: (value: number) => string;
}

function AnimatedCounter({ value, duration = 2000, format = (v) => v.toString() }: AnimatedCounterProps) {
  const [ref, inView] = useInView({ triggerOnce: true });
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (inView) {
      const startTime = Date.now();
      const startValue = 0;
      
      const animate = () => {
        const now = Date.now();
        const progress = Math.min((now - startTime) / duration, 1);
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentValue = startValue + (value - startValue) * easeOutQuart;
        
        setDisplayValue(currentValue);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setDisplayValue(value);
        }
      };
      
      animate();
    }
  }, [inView, value, duration]);

  return <span ref={ref}>{format(displayValue)}</span>;
}

interface KPICardsProps {
  data: KPIData;
}

export default function KPICards({ data }: KPICardsProps) {
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

  const kpiCards = [
    {
      id: 'transactions',
      title: 'Approved Transactions',
      value: data.totalTransactions,
      format: formatNumber,
      icon: Activity,
      gradient: 'from-blue-500 to-blue-600',
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-600',
      glowColor: 'shadow-blue-500/25',
      trend: null,
      description: 'Successfully processed'
    },
    {
      id: 'approval-rate',
      title: 'Approval Rate',
      value: data.approvalRate,
      format: (v: number) => `${v.toFixed(1)}%`,
      icon: Target,
      gradient: data.approvalRate >= 70 ? 'from-emerald-500 to-green-600' : 'from-rose-500 to-red-600',
      iconBg: data.approvalRate >= 70 ? 'bg-emerald-500/10' : 'bg-rose-500/10',
      iconColor: data.approvalRate >= 70 ? 'text-emerald-600' : 'text-rose-600',
      glowColor: data.approvalRate >= 70 ? 'shadow-emerald-500/25' : 'shadow-rose-500/25',
      trend: data.approvalRate >= 70 ? 'up' : 'down',
      badge: data.approvalRate >= 70 ? 'Excellent' : data.approvalRate >= 60 ? 'Good' : 'Needs Attention',
      badgeColor: data.approvalRate >= 70 ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 
                  data.approvalRate >= 60 ? 'bg-blue-100 text-blue-800 border-blue-200' : 
                  'bg-rose-100 text-rose-800 border-rose-200',
      description: 'Transaction success rate'
    },
    {
      id: 'total-amount',
      title: 'Total Revenue',
      value: data.totalAmount,
      format: formatCurrency,
      icon: DollarSign,
      gradient: 'from-emerald-500 to-teal-600',
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-600',
      glowColor: 'shadow-emerald-500/25',
      trend: 'up',
      description: 'Approved transactions only'
    },
    {
      id: 'avg-amount',
      title: 'Average Transaction',
      value: data.avgAmount,
      format: formatCurrency,
      icon: TrendingUp,
      gradient: 'from-violet-500 to-purple-600',
      iconBg: 'bg-violet-500/10',
      iconColor: 'text-violet-600',
      glowColor: 'shadow-violet-500/25',
      subtitle: data.avgAmountLabel,
      trend: 'up',
      description: `Per ${data.avgAmountLabel.replace('per ', '')}`
    },
    {
      id: 'countries',
      title: 'Global Reach',
      value: data.uniqueCountries,
      format: formatNumber,
      icon: Globe,
      gradient: 'from-cyan-500 to-blue-600',
      iconBg: 'bg-cyan-500/10',
      iconColor: 'text-cyan-600',
      glowColor: 'shadow-cyan-500/25',
      description: 'Countries with approved transactions'
    },
    {
      id: 'customers',
      title: 'Active Customers',
      value: data.uniqueEmails,
      format: formatNumber,
      icon: Users,
      gradient: 'from-orange-500 to-amber-600',
      iconBg: 'bg-orange-500/10',
      iconColor: 'text-orange-600',
      glowColor: 'shadow-orange-500/25',
      description: 'Unique customer emails'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {kpiCards.map((card, index) => (
        <motion.div
          key={card.id}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1, duration: 0.6, ease: "easeOut" }}
          whileHover={{ 
            y: -8, 
            transition: { duration: 0.3, ease: "easeOut" } 
          }}
          className="group"
        >
          <Card className={`
            relative overflow-hidden border-0 rounded-2xl p-6
            bg-gradient-to-br ${card.gradient} 
            hover:shadow-2xl ${card.glowColor}
            transition-all duration-500 ease-out
            backdrop-blur-sm
          `}>
            {/* Glassmorphism overlay */}
            <div className="absolute inset-0 bg-white/10 backdrop-blur-sm" />
            
            {/* Animated background pattern */}
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -translate-y-16 translate-x-16 group-hover:scale-150 transition-transform duration-700" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12 group-hover:scale-125 transition-transform duration-500" />
            </div>

            <div className="relative z-10 text-white">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-white/90 mb-1 tracking-wide uppercase">
                    {card.title}
                  </h3>
                  <p className="text-xs text-white/70">
                    {card.description}
                  </p>
                </div>
                <div className={`
                  p-3 rounded-xl ${card.iconBg} backdrop-blur-sm
                  group-hover:scale-110 group-hover:rotate-6
                  transition-all duration-300 ease-out
                  border border-white/20
                `}>
                  <card.icon className="h-6 w-6 text-white" />
                </div>
              </div>

              {/* Main Value */}
              <div className="mb-3">
                <div className="flex items-end gap-3 mb-2">
                  <span className="text-3xl font-bold text-white tracking-tight">
                    <AnimatedCounter value={card.value} format={card.format} />
                  </span>
                  {card.trend && (
                    <div className="flex items-center text-white/90 mb-1">
                      {card.trend === 'up' ? (
                        <ArrowUpRight className="w-5 h-5" />
                      ) : (
                        <ArrowDownRight className="w-5 h-5" />
                      )}
                    </div>
                  )}
                </div>
                
                {/* Badge and Subtitle */}
                <div className="flex items-center gap-2">
                  {card.badge && (
                    <span className={`
                      px-3 py-1 text-xs font-medium rounded-full border
                      ${card.badgeColor} backdrop-blur-sm
                      shadow-sm
                    `}>
                      {card.badge}
                    </span>
                  )}
                  {card.subtitle && (
                    <span className="text-xs text-white/80 font-medium">
                      {card.subtitle}
                    </span>
                  )}
                </div>
              </div>

              {/* Progress bar for approval rate */}
              {card.id === 'approval-rate' && (
                <div className="mt-4">
                  <div className="w-full bg-white/20 rounded-full h-2 backdrop-blur-sm">
                    <motion.div 
                      className="bg-white rounded-full h-2 shadow-sm"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(card.value, 100)}%` }}
                      transition={{ delay: 0.5 + index * 0.1, duration: 1, ease: "easeOut" }}
                    />
                  </div>
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}