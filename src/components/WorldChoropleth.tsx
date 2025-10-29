import { useMemo, useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import worldLocal from '@/assets/world-geo.json';
import * as d3 from 'd3';

interface CountryDatum {
  country: string; // display name from app
  amount: number; // approved amount
}

interface WorldChoroplethProps {
  data: CountryDatum[];
  approvalByCountry: Record<string, number>; // 0-100
  onCountrySelect?: (country: string) => void;
  globalApprovalOverride?: number; // KPI-style global approval override
}

// Basic alias map to align data.country names to geo properties
const NAME_ALIASES: Record<string, string> = {
  'United States': 'United States',
  'United States of America': 'United States',
  'USA': 'United States',
  'UK': 'United Kingdom',
  'U.K.': 'United Kingdom',
  'South Korea': 'Korea, Republic of',
  'North Korea': "Korea, Democratic People's Republic of",
  'Russia': 'Russia',
  'Russian Federation': 'Russia',
  'Viet Nam': 'Vietnam',
  'Congo, Democratic Republic of the': 'Democratic Republic of the Congo',
  'Congo, Republic of the': 'Republic of the Congo',
  'Congo (Kinshasa)': 'Democratic Republic of the Congo',
  'Congo (Brazzaville)': 'Republic of the Congo',
  'Ivory Coast': 
    "Côte d'Ivoire",
  "Cote d'Ivoire": 
    "Côte d'Ivoire",
  'Syria': 'Syrian Arab Republic',
  'Iran': 'Iran, Islamic Republic of',
  'Laos': "Lao People's Democratic Republic",
  'Moldova': 'Moldova, Republic of',
  'Bolivia': 'Bolivia, Plurinational State of',
  'Tanzania': 'Tanzania, United Republic of',
  'Venezuela': 'Venezuela, Bolivarian Republic of',
  'Palestine': 'Palestine, State of',
  'Cape Verde': 'Cabo Verde',
  'Swaziland': 'Eswatini',
  'Burma': 'Myanmar',
  'Myanmar (Burma)': 'Myanmar',
  'Macedonia': 'North Macedonia',
  'Türkiye': 'Turkey',
  'United Arab Emirates': 'United Arab Emirates',
  'Czech Republic': 'Czechia'
};

// Common ISO2 -> canonical name fallback
const ISO2_TO_NAME: Record<string, string> = {
  US: 'United States',
  GB: 'United Kingdom',
  UK: 'United Kingdom',
  CA: 'Canada',
  AU: 'Australia',
  IN: 'India',
  CN: 'China',
  RU: 'Russia',
  BR: 'Brazil',
  MX: 'Mexico',
  DE: 'Germany',
  FR: 'France',
  ES: 'Spain',
  IT: 'Italy',
  NL: 'Netherlands',
  AE: 'United Arab Emirates',
  SA: 'Saudi Arabia',
  SG: 'Singapore',
  ZA: 'South Africa',
  JP: 'Japan',
  KR: 'Korea, Republic of',
  SE: 'Sweden',
  NO: 'Norway',
  DK: 'Denmark',
  IE: 'Ireland',
  CH: 'Switzerland'
};

function normalizeName(n: string) {
  return NAME_ALIASES[n] || n;
}

function keyize(n: string) {
  // Remove diacritics, then strip non-letters, lowercase
  return (n || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

export default function WorldChoropleth({ data, approvalByCountry, onCountrySelect, globalApprovalOverride }: WorldChoroplethProps) {
  const [features, setFeatures] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch reliable world GeoJSON once (countries)
  // Source: https://github.com/johan/world.geo.json
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json', { cache: 'force-cache' });
        const gj = await res.json();
        if (!cancelled) {
          const feats = Array.isArray(gj.features) ? gj.features : [];
          setFeatures(feats);
        }
      } catch (e) {
        console.error('Failed to load world GeoJSON', e);
        // Fallback to bundled lightweight geojson
        try {
          const feats = (worldLocal as any).features || [];
          if (!cancelled) setFeatures(feats);
        } catch {
          if (!cancelled) setFeatures([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // Build feature token map once features load
  const featureKeyMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (!features) return map;
    features.forEach((f: any) => {
      const rawName: string = f.properties?.name || f.properties?.NAME || f.id;
      const canonicalName = normalizeName(rawName);
      const iso3: string | undefined = f.id || f.properties?.iso_a3 || f.properties?.ISO_A3;
      const iso2: string | undefined = f.properties?.iso_a2 || f.properties?.ISO_A2;
      const tokens = [rawName, canonicalName, iso3, iso2]
        .filter(Boolean)
        .map((t: any) => keyize(String(t)));
      tokens.forEach(t => { if (t) map[t] = canonicalName; });
    });
    // Common extras
    map[keyize('United States of America')] = 'United States';
    map[keyize('United States')] = 'United States';
    map[keyize('US')] = 'United States';
    map[keyize('USA')] = 'United States';
    map[keyize('UK')] = 'United Kingdom';
    map[keyize('UAE')] = 'United Arab Emirates';
    // ISO2 fallbacks
    Object.entries(ISO2_TO_NAME).forEach(([k,v]) => { map[keyize(k)] = v; });
    return map;
  }, [features]);

  // Resolve amounts to canonical feature names
  const amountByCanonical = useMemo(() => {
    const m: Record<string, number> = {};
    const fallback = (n: string) => normalizeName(n);
    data.forEach(d => {
      const token = keyize(d.country);
      const iso2 = (d.country || '').toString().toUpperCase();
      const canonical = featureKeyMap[token] || ISO2_TO_NAME[iso2] || fallback(d.country);
      m[canonical] = (m[canonical] || 0) + (d.amount || 0);
    });
    // Debug missing mappings in dev
    if (process.env.NODE_ENV !== 'production') {
      data.forEach(d => {
        const token = keyize(d.country);
        const iso2 = (d.country || '').toString().toUpperCase();
        const canonical = featureKeyMap[token] || ISO2_TO_NAME[iso2] || fallback(d.country);
        if (m[canonical] === undefined) {
          // eslint-disable-next-line no-console
          console.warn('Choropleth: unresolved country', d.country);
        }
      });
    }
    return m;
  }, [data, featureKeyMap]);

  const [hoverName, setHoverName] = useState<string | null>(null);

  // Determine color scale domain
  // Indigo stepped palette (no yellow)
  const PALETTE = ['#EEF2FF','#E0E7FF','#C7D2FE','#A5B4FC','#818CF8','#6366F1','#4F46E5'];
  const thresholds = useMemo(() => {
    const vals = Object.values(amountByCanonical).filter((v:number)=>v>0).sort((a:number,b:number)=>a-b);
    if (vals.length === 0) return [0,0,0,0,0,0];
    const max = vals[vals.length - 1];
    // For very small samples, create proportional thresholds so the max value maps to darkest bin
    if (vals.length <= 2) {
      return [0.05, 0.12, 0.25, 0.45, 0.7, 0.9].map(r => r * max);
    }
    const q = (p:number)=> vals[Math.min(vals.length-1, Math.floor(p*(vals.length-1)))];
    return [q(0.15), q(0.3), q(0.5), q(0.7), q(0.85), q(0.95)];
  }, [amountByCanonical]);

  const colorFor = (v: number) => {
    if (!v || v <= 0) return '#F1F5F9'; // slate-100 for zero
    const idx = thresholds.findIndex(t => v <= t);
    const bin = idx === -1 ? (PALETTE.length - 1) : Math.max(0, idx);
    return PALETTE[bin];
  };

  // Totals and approval mapping by canonical name
  const totalAmount = useMemo(() => Object.values(amountByCanonical).reduce((s:number,v:number)=>s+v,0), [amountByCanonical]);

  const approvalByCanonical = useMemo(() => {
    const out: Record<string, number> = {};
    Object.entries(approvalByCountry).forEach(([name, rate]) => {
      const token = keyize(name);
      const iso2 = name.toString().toUpperCase();
      const canonical = featureKeyMap[token] || ISO2_TO_NAME[iso2] || normalizeName(name);
      out[canonical] = rate as number;
    });
    return out;
  }, [approvalByCountry, featureKeyMap]);

  // Derive global metrics and current metrics
  const globalApproval = useMemo(() => {
    const vals = Object.values(approvalByCanonical);
    if (!vals.length) return 0;
    // Weighted by amount for more meaningful global ratio
    let wSum = 0, aSum = 0;
    Object.entries(approvalByCanonical).forEach(([name, rate]) => {
      const token = keyize(name);
      const canonical = featureKeyMap[token] || normalizeName(name);
      const amt = amountByCanonical[canonical] || 0;
      wSum += amt; aSum += (rate as number) * amt;
    });
    const weighted = wSum > 0 ? aSum / wSum : (d3.mean(vals as number[]) || 0);
    return (typeof globalApprovalOverride === 'number' && !isNaN(globalApprovalOverride)) ? globalApprovalOverride : weighted;
  }, [approvalByCanonical, amountByCanonical, featureKeyMap, globalApprovalOverride]);

  const currentName = hoverName || 'All Countries';
  const currentAmount = hoverName ? (amountByCanonical[hoverName] || 0) : totalAmount;
  const currentApproval = hoverName ? (approvalByCanonical[hoverName] || 0) : globalApproval;
  const width = 1024, height = 520;
  const projection = useMemo(() => d3.geoEquirectangular(), []);
  const path = useMemo(() => d3.geoPath(projection), [projection]);
  const fitToFeatures = (fs: any[]) => {
    try {
      const fc = { type: 'FeatureCollection', features: fs } as any;
      (projection as any).fitSize([width, height], fc);
    } catch (e) {
      // fallback scale/translate
      (projection as any).scale(170).translate([width/2, height/2]);
    }
  };

  // Fit projection whenever features load
  useEffect(() => {
    if (features && features.length > 0) {
      fitToFeatures(features);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features]);

  return (
    <Card className="p-4 rounded-xl h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{currentName}</Badge>
          <Badge variant="outline" className="text-xs">Approval: {currentApproval.toFixed(1)}%</Badge>
          <Badge variant="outline" className="text-xs">Revenue: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(currentAmount)}</Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Revenue intensity</span>
          <div className="flex items-center gap-1">
            {PALETTE.map((c, i) => (
              <div key={i} className="w-5 h-2 rounded" style={{ background: c }} />
            ))}
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 overflow-hidden rounded-lg bg-card min-h-[420px]">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">Loading world map…</div>
        ) : (!features || features.length === 0) ? (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">Map unavailable</div>
        ) : (
          <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" role="img">
            <g>
              {features.map((f: any) => {
                const name: string = f.properties?.name || f.id;
                const token = keyize(name);
                const canonical = featureKeyMap[token] || normalizeName(name);
                const amount = amountByCanonical[canonical] || 0;
                const fill = colorFor(amount);
                return (
                  <path
                    key={canonical}
                    d={path(f) || ''}
                    fill={fill}
                    stroke="rgba(100,116,139,0.5)"
                    strokeWidth={0.6}
                    onMouseEnter={() => setHoverName(canonical)}
                    onMouseLeave={() => setHoverName(null)}
                    onClick={() => onCountrySelect?.(canonical)}
                    style={{ cursor: 'pointer', transition: 'opacity 120ms ease' }}
                  />
                );
              })}
            </g>
          </svg>
        )}
      </div>
    </Card>
  );
}
