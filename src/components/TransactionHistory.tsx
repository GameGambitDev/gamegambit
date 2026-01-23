import { motion } from 'framer-motion';
import { ExternalLink, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  useWagerTransactions, 
  useMyTransactions, 
  WagerTransaction,
  getTransactionTypeInfo,
  getTransactionStatusInfo 
} from '@/hooks/useTransactions';
import { getExplorerUrl } from '@/lib/solana-config';
import { formatDistanceToNow } from 'date-fns';

interface TransactionHistoryProps {
  wagerId?: string;
  showAll?: boolean;
  maxHeight?: string;
}

export function TransactionHistory({ wagerId, showAll = false, maxHeight = '400px' }: TransactionHistoryProps) {
  const wagerTxQuery = useWagerTransactions(wagerId || null);
  const myTxQuery = useMyTransactions(50);
  
  const { data: transactions, isLoading } = showAll ? myTxQuery : wagerTxQuery;

  if (isLoading) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No transactions yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Transaction History
          <Badge variant="secondary" className="ml-auto text-xs">
            {transactions.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea style={{ maxHeight }} className="px-4 pb-4">
          <div className="space-y-2">
            {transactions.map((tx, index) => (
              <TransactionRow key={tx.id} tx={tx} index={index} />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function TransactionRow({ tx, index }: { tx: WagerTransaction; index: number }) {
  const typeInfo = getTransactionTypeInfo(tx.tx_type);
  const statusInfo = getTransactionStatusInfo(tx.status);
  const amountSOL = tx.amount_lamports / 1e9;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/30 hover:border-border/60 transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className="text-lg">{typeInfo.icon}</span>
        <div>
          <p className={`text-sm font-medium ${typeInfo.color}`}>
            {typeInfo.label}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className={`text-sm font-semibold ${
            tx.tx_type === 'winner_payout' || tx.tx_type === 'draw_refund' 
              ? 'text-success' 
              : tx.tx_type === 'escrow_deposit' 
                ? 'text-warning' 
                : 'text-foreground'
          }`}>
            {tx.tx_type === 'winner_payout' || tx.tx_type === 'draw_refund' ? '+' : '-'}
            {amountSOL.toFixed(4)} SOL
          </p>
          <div className="flex items-center gap-1 justify-end">
            {tx.status === 'confirmed' && <CheckCircle className="h-3 w-3 text-success" />}
            {tx.status === 'pending' && <Loader2 className="h-3 w-3 text-warning animate-spin" />}
            {tx.status === 'failed' && <XCircle className="h-3 w-3 text-destructive" />}
            <span className={`text-xs ${statusInfo.color}`}>{statusInfo.label}</span>
          </div>
        </div>
        
        {tx.tx_signature && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => window.open(getExplorerUrl('tx', tx.tx_signature!), '_blank')}
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}

export default TransactionHistory;