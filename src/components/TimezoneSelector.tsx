import { Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface TimezoneSelectorProps {
  currentTimezone: 'GMT+0' | 'GMT+6';
  onTimezoneChange: (timezone: 'GMT+0' | 'GMT+6') => void;
  hasIncompleteDay?: boolean;
  incompleteDate?: string;
}

export default function TimezoneSelector({ 
  currentTimezone, 
  onTimezoneChange, 
  hasIncompleteDay = false,
  incompleteDate 
}: TimezoneSelectorProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="flex items-center gap-2 hover-elevate bg-white/90 hover:bg-white border-slate-200 text-slate-700"
          data-testid="timezone-selector"
        >
          <Clock className="w-4 h-4" />
          <span className="text-sm font-medium">{currentTimezone}</span>
          {hasIncompleteDay && currentTimezone === 'GMT+6' && (
            <AlertTriangle className="w-3 h-3 text-orange-500" />
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Select Timezone</span>
          </div>
          
          <div className="grid grid-cols-2 gap-2 mb-3">
            <Button
              variant={currentTimezone === 'GMT+0' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onTimezoneChange('GMT+0')}
              data-testid="button-gmt0"
              className="justify-start"
            >
              <div className="text-left">
                <div className="font-medium">GMT+0</div>
                <div className="text-xs text-muted-foreground">UTC</div>
              </div>
            </Button>
            <Button
              variant={currentTimezone === 'GMT+6' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onTimezoneChange('GMT+6')}
              data-testid="button-gmt6"
              className="justify-start"
            >
              <div className="text-left">
                <div className="font-medium">GMT+6</div>
                <div className="text-xs text-muted-foreground">Asia/Dhaka</div>
              </div>
            </Button>
          </div>
          
          {hasIncompleteDay && currentTimezone === 'GMT+6' && (
            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md" data-testid="incomplete-day-warning">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                    Incomplete Day Data
                  </p>
                  <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                    {incompleteDate} doesn't have complete 24-hour transaction data in GMT+6 timezone.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="mt-3 pt-3 border-t">
            <div className="text-xs text-muted-foreground">
              <div className="flex justify-between items-center">
                <span>Current timezone:</span>
                <span className="font-medium">{currentTimezone}</span>
              </div>
              {currentTimezone === 'GMT+6' && (
                <div className="flex justify-between items-center mt-1">
                  <span>Offset:</span>
                  <span className="font-medium">+6 hours ahead of UTC</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}