import { useMemo, useState } from 'react';
import { Filter, X, Calendar, MapPin, CreditCard, Building, Workflow, Hash } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export interface FilterState {
  dateRange: { start: string; end: string };
  psp: string[];
  country: string[];
  status: string[];
  cardType: string[];
  midAlias: string[];
  type: string[];
  method?: string[]; // Added: Card, Crypto, P2P
}

interface FilterPanelProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  availableOptions: {
    psps: string[];
    countries: string[];
    statuses: string[];
    cardTypes: string[];
    midAliases: string[];
    types: string[];
  };
}

export default function FilterPanel({ filters, onFiltersChange, availableOptions }: FilterPanelProps) {
  const [expandedSections, setExpandedSections] = useState({
    date: true,
    psp: true,
    country: true,
    status: true,
    method: true,
    card: false,
    mid: true,
    type: false
  });

  // Country search query for dropdown
  const [countryQuery, setCountryQuery] = useState('');

  // Convert a value to ISO full country name when possible
  const toFullCountryName = (value: string) => {
    if (!value) return value;
    const v = value.trim();
    // Attempt ISO-3166 alpha-2
    if (v.length === 2 && /^[A-Za-z]{2}$/.test(v)) {
      try {
        const dn = new (Intl as any).DisplayNames(['en'], { type: 'region' });
        const name = dn.of(v.toUpperCase());
        if (name && typeof name === 'string') return name;
      } catch {}
    }
    // Already a name; just Title Case first letter of each word for consistency
    return v.replace(/\b([a-z])(\w*)/g, (_, a: string, b: string) => a.toUpperCase() + b);
  };

  // Build full-name, unique, sorted country list
  const countryOptionsFull = useMemo(() => {
    const names = (availableOptions.countries || []).map(toFullCountryName);
    const uniq = Array.from(new Set(names));
    return uniq.sort((a, b) => a.localeCompare(b));
  }, [availableOptions.countries]);

  const filteredCountryOptions = useMemo(() => {
    if (!countryQuery) return countryOptionsFull;
    const q = countryQuery.toLowerCase();
    return countryOptionsFull.filter(n => n.toLowerCase().includes(q));
  }, [countryQuery, countryOptionsFull]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const updateFilter = (key: keyof FilterState, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const addToArrayFilter = (key: keyof FilterState, value: string) => {
    const currentArray = filters[key] as string[];
    if (!currentArray.includes(value)) {
      updateFilter(key, [...currentArray, value]);
    }
  };

  const removeFromArrayFilter = (key: keyof FilterState, value: string) => {
    const currentArray = filters[key] as string[];
    updateFilter(key, currentArray.filter(item => item !== value));
  };

  const clearAllFilters = () => {
    onFiltersChange({
      dateRange: { start: '', end: '' },
      psp: [],
      country: [],
      status: [],
      cardType: [],
      midAlias: [],
      type: [],
      method: []
    });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.dateRange.start || filters.dateRange.end) count++;
    if (filters.psp.length > 0) count++;
    if (filters.country.length > 0) count++;
    if (filters.status.length > 0) count++;
    if (filters.cardType.length > 0) count++;
    if (filters.midAlias.length > 0) count++;
    if (filters.type.length > 0) count++;
    if ((filters.method?.length || 0) > 0) count++;
    return count;
  };

  return (
    <Card className="p-6 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" />
          <span className="font-medium">Filters</span>
          {getActiveFilterCount() > 0 && (
            <Badge variant="secondary" className="text-xs" data-testid="active-filter-count">
              {getActiveFilterCount()}
            </Badge>
          )}
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={clearAllFilters}
          data-testid="button-clear-filters"
        >
          Clear All
        </Button>
      </div>

      <div className="space-y-3">
        {/* Date Range */}
        <Collapsible open={expandedSections.date} onOpenChange={() => toggleSection('date')}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-2 h-auto" data-testid="toggle-date-filter">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">Date Range</span>
              </div>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 mt-2">
            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Start Date</label>
                <Input
                  type="date"
                  value={filters.dateRange.start}
                  onChange={(e) => {
                    console.log('FilterPanel: Start date changed to:', e.target.value);
                    updateFilter('dateRange', { ...filters.dateRange, start: e.target.value });
                  }}
                  className="w-full"
                  data-testid="input-date-start"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">End Date</label>
                <Input
                  type="date"
                  value={filters.dateRange.end}
                  onChange={(e) => {
                    console.log('FilterPanel: End date changed to:', e.target.value);
                    updateFilter('dateRange', { ...filters.dateRange, end: e.target.value });
                  }}
                  className="w-full"
                  data-testid="input-date-end"
                />
              </div>
              {(filters.dateRange.start || filters.dateRange.end) && (
                <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded">
                  {filters.dateRange.start && filters.dateRange.end 
                    ? `Filtering from ${filters.dateRange.start} to ${filters.dateRange.end}`
                    : filters.dateRange.start 
                      ? `Filtering from ${filters.dateRange.start} onwards`
                      : `Filtering up to ${filters.dateRange.end}`
                  }
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Method Filter */}
        <Collapsible open={expandedSections.method} onOpenChange={() => toggleSection('method')}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-2 h-auto" data-testid="toggle-method-filter">
              <div className="flex items-center gap-2">
                <Workflow className="w-4 h-4" />
                <span className="text-sm">Method ({(filters.method?.length || 0)})</span>
              </div>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 mt-2">
            <Select onValueChange={(value) => addToArrayFilter('method', value)}>
              <SelectTrigger data-testid="select-method">
                <SelectValue placeholder="Select Method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Card">Card</SelectItem>
                <SelectItem value="Crypto">Crypto</SelectItem>
                <SelectItem value="P2P">P2P</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-1">
              {(filters.method || []).map(method => (
                <Badge key={method} variant="secondary" className="text-xs" data-testid={`method-filter-${method}`}>
                  {method}
                  <X className="w-3 h-3 ml-1 cursor-pointer" onClick={() => removeFromArrayFilter('method', method)} />
                </Badge>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* PSP Filter */}
        <Collapsible open={expandedSections.psp} onOpenChange={() => toggleSection('psp')}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-2 h-auto" data-testid="toggle-psp-filter">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4" />
                <span className="text-sm">PSP ({filters.psp.length})</span>
              </div>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 mt-2">
            <Select onValueChange={(value) => addToArrayFilter('psp', value)}>
              <SelectTrigger data-testid="select-psp">
                <SelectValue placeholder="Select PSP" />
              </SelectTrigger>
              <SelectContent>
                <div className="w-64">
                  <div className="max-h-72 overflow-y-auto overscroll-contain" onWheel={(e) => e.stopPropagation()}>
                    {availableOptions.psps.map(psp => (
                      <SelectItem key={psp} value={psp}>{psp}</SelectItem>
                    ))}
                  </div>
                </div>
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-1">
              {filters.psp.map(psp => (
                <Badge key={psp} variant="secondary" className="text-xs" data-testid={`psp-filter-${psp}`}>
                  {psp}
                  <X className="w-3 h-3 ml-1 cursor-pointer" onClick={() => removeFromArrayFilter('psp', psp)} />
                </Badge>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Country Filter */}
        <Collapsible open={expandedSections.country} onOpenChange={() => toggleSection('country')}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-2 h-auto" data-testid="toggle-country-filter">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">Country ({filters.country.length})</span>
              </div>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 mt-2">
            <Select onValueChange={(value) => addToArrayFilter('country', value)}>
              <SelectTrigger data-testid="select-country">
                <SelectValue placeholder="Select Country" />
              </SelectTrigger>
              <SelectContent>
                <div className="w-72">
                  {/* Search bar pinned at top */}
                  <div className="p-2 sticky top-0 bg-popover z-10 border-b">
                    <Input
                      placeholder="Search country..."
                      value={countryQuery}
                      onChange={(e) => setCountryQuery(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  {/* Scrollable list to avoid page scroll */}
                  <div className="max-h-72 overflow-y-scroll" onWheel={(e) => e.stopPropagation()}>
                    {filteredCountryOptions.map(country => (
                      <SelectItem key={country} value={country}>{country}</SelectItem>
                    ))}
                  </div>
                </div>
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-1">
              {filters.country.map(country => (
                <Badge key={country} variant="secondary" className="text-xs" data-testid={`country-filter-${country}`}>
                  {country}
                  <X className="w-3 h-3 ml-1 cursor-pointer" onClick={() => removeFromArrayFilter('country', country)} />
                </Badge>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Status Filter */}
        <Collapsible open={expandedSections.status} onOpenChange={() => toggleSection('status')}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-2 h-auto" data-testid="toggle-status-filter">
              <div className="flex items-center gap-2">
                <Workflow className="w-4 h-4" />
                <span className="text-sm">Status ({filters.status.length})</span>
              </div>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 mt-2">
            <Select onValueChange={(value) => addToArrayFilter('status', value)}>
              <SelectTrigger data-testid="select-status">
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent>
                {availableOptions.statuses.map(status => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-1">
              {filters.status.map(status => (
                <Badge key={status} variant="secondary" className="text-xs" data-testid={`status-filter-${status}`}>
                  {status}
                  <X className="w-3 h-3 ml-1 cursor-pointer" onClick={() => removeFromArrayFilter('status', status)} />
                </Badge>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* MID Alias Filter */}
        <Collapsible open={expandedSections.mid} onOpenChange={() => toggleSection('mid')}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-2 h-auto" data-testid="toggle-mid-filter">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4" />
                <span className="text-sm">MID Alias ({filters.midAlias.length})</span>
              </div>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 mt-2">
            <Select onValueChange={(value) => addToArrayFilter('midAlias', value)}>
              <SelectTrigger data-testid="select-mid-alias">
                <SelectValue placeholder="Select MID Alias" />
              </SelectTrigger>
              <SelectContent>
                <div className="w-72">
                  <div className="max-h-72 overflow-y-auto overscroll-contain" onWheel={(e) => e.stopPropagation()}>
                    {availableOptions.midAliases.map(midAlias => (
                      <SelectItem key={midAlias} value={midAlias}>{midAlias}</SelectItem>
                    ))}
                  </div>
                </div>
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-1">
              {filters.midAlias.map(midAlias => (
                <Badge key={midAlias} variant="secondary" className="text-xs" data-testid={`mid-filter-${midAlias}`}>
                  {midAlias}
                  <X className="w-3 h-3 ml-1 cursor-pointer" onClick={() => removeFromArrayFilter('midAlias', midAlias)} />
                </Badge>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Card Type Filter */}
        <Collapsible open={expandedSections.card} onOpenChange={() => toggleSection('card')}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-2 h-auto" data-testid="toggle-card-filter">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                <span className="text-sm">Card Type ({filters.cardType.length})</span>
              </div>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 mt-2">
            <Select onValueChange={(value) => addToArrayFilter('cardType', value)}>
              <SelectTrigger data-testid="select-card-type">
                <SelectValue placeholder="Select Card Type" />
              </SelectTrigger>
              <SelectContent>
                {availableOptions.cardTypes.map(cardType => (
                  <SelectItem key={cardType} value={cardType}>{cardType}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-1">
              {filters.cardType.map(cardType => (
                <Badge key={cardType} variant="secondary" className="text-xs" data-testid={`card-filter-${cardType}`}>
                  {cardType}
                  <X className="w-3 h-3 ml-1 cursor-pointer" onClick={() => removeFromArrayFilter('cardType', cardType)} />
                </Badge>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </Card>
  );
}