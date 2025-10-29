import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface Transaction {
  id: string;
  processing_date: string;
  pspName: string;
  country: string;
  email: string;
  amount: number;
  currency: string;
  status: string;
  cardType?: string;
  lastFourDigits?: string;
}

interface DataTableProps {
  transactions: Transaction[];
  loading?: boolean;
}

export default function DataTable({ transactions, loading = false }: DataTableProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatNumber = (num: number) => new Intl.NumberFormat('en-US').format(num);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status.toLowerCase()) {
      case 'approved':
        return 'default';
      case 'declined':
      case 'failed':
      case 'rejected':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="relative">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Date & Time</TableHead>
              <TableHead>PSP</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Card</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((transaction) => (
                <TableRow key={transaction.id} className="border-b hover:bg-accent/50 transition-colors">
                  <TableCell className="font-mono text-xs text-slate-600 p-4">
                    {formatDate(transaction.processing_date)}
                  </TableCell>
                  <TableCell className="font-semibold text-slate-800 p-4">
                    {transaction.pspName}
                  </TableCell>
                  <TableCell className="p-4">
                    <Badge 
                      variant="outline" 
                      className="text-xs font-medium bg-slate-100/80 text-slate-700 border-slate-200/80 backdrop-blur-sm"
                    >
                      {transaction.country}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-bold text-slate-800 p-4">
                    {formatCurrency(transaction.amount)}
                  </TableCell>
                  <TableCell className="p-4">
                    <Badge 
                      variant={getStatusVariant(transaction.status)}
                      className={`font-medium backdrop-blur-sm ${
                        transaction.status === 'approved' 
                          ? 'bg-emerald-100/80 text-emerald-800 border-emerald-200/80' 
                          : 'bg-rose-100/80 text-rose-800 border-rose-200/80'
                      }`}
                    >
                      {transaction.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500 p-4 font-medium">
                    {transaction.cardType && transaction.lastFourDigits
                      ? `${transaction.cardType} ****${transaction.lastFourDigits}`
                      : '-'
                    }
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      {transactions.length > 100 && (
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100/80 backdrop-blur-sm border border-slate-200/50">
            <span className="text-sm text-slate-600">
              Showing first <span className="font-semibold text-slate-800">{formatNumber(100)}</span> of <span className="font-semibold text-slate-800">{formatNumber(transactions.length)}</span> transactions
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}