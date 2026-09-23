// StatsView.tsx — Statistics page: period selector + three tabs
// (Médiateurs / Réservations / Visites). All computations are in
// src/domain/stats.ts; this component only renders SVG charts.

import { useMemo, useState } from 'react';
import { useData } from './DataContext';
import {
  computeMediatorStats,
  computeOfferStats,
  computeWeekdayStats,
  computeMediatorWeeklyLoad,
  computeVisitStats,
  computeWeekdayVisitCandles,
  type OfferStats,
} from '../domain/stats';

type Tab = 'mediators' | 'reservations' | 'visits';

// ---- Formatting helpers ----

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

function formatDecimal(n: number): string {
  return n.toFixed(1).replace('.', ',');
}

function formatCount(n: number, singular: string, plural: string): string {
  return n <= 1 ? `${n} ${singular}` : `${n} ${plural}`;
}

const PALETTE = [
  '#0064ff', '#e74c3c', '#2ecc71', '#9b59b6', '#f39c12',
  '#1abc9c', '#34495e', '#e67e22', '#16a085', '#d35400',
  '#8e44ad', '#c0392b', '#27ae60', '#2980b9', '#f1c40f',
];

function natureColor(natures: string[], nature: string): string {
  const idx = natures.indexOf(nature);
  return PALETTE[(idx >= 0 ? idx : 0) % PALETTE.length];
}

// ---- Period selector ----

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function PeriodSelector({
  start,
  end,
  onStart,
  onEnd,
}: {
  start: string;
  end: string;
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
}) {
  const now = new Date();
  const quick = (s: Date, e: Date) => {
    onStart(isoDate(s));
    onEnd(isoDate(e));
  };
  return (
    <div className="stats-period">
      <div className="stats-period-inputs">
        <label htmlFor="stats-start">Date début</label>
        <input
          id="stats-start"
          type="date"
          value={start}
          onChange={(e) => onStart(e.target.value)}
        />
        <label htmlFor="stats-end">Date fin</label>
        <input
          id="stats-end"
          type="date"
          value={end}
          onChange={(e) => onEnd(e.target.value)}
        />
      </div>
      <div className="stats-period-quick">
        <button className="stats-quick-btn" onClick={() => quick(startOfMonth(now), endOfMonth(now))}>
          Ce mois
        </button>
        <button
          className="stats-quick-btn"
          onClick={() => {
            const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            quick(prev, endOfMonth(prev));
          }}
        >
          Mois dernier
        </button>
        <button className="stats-quick-btn" onClick={() => quick(addDays(now, -29), now)}>
          30 derniers jours
        </button>
        <button className="stats-quick-btn" onClick={() => quick(new Date(now.getFullYear(), 0, 1), now)}>
          Année en cours
        </button>
      </div>
    </div>
  );
}

// ---- Tab Médiateurs ----

function MediatorsTab({ data, start, end }: { data: import('../domain/types').AppData; start: string; end: string }) {
  const { mediators: stats, unassignedCount } = useMemo(
    () => computeMediatorStats(data, start, end),
    [data, start, end]
  );
  const weeklyLoad = useMemo(() => computeMediatorWeeklyLoad(data, start, end), [data, start, end]);

  const allWeeks = useMemo(() => {
    const weeks = new Set<number>();
    for (const list of weeklyLoad.values()) list.forEach(w => weeks.add(w.week));
    return [...weeks].sort((a, b) => a - b);
  }, [weeklyLoad]);

  return (
    <div className="stats-tab-content">
      <h3 className="stats-section-title">Par médiateur</h3>
      <table className="stats-table">
        <thead>
          <tr>
            <th>Médiateur</th>
            <th>Animations</th>
            <th>Temps cumulé</th>
            <th>Absences</th>
            <th>Offres réalisées</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {stats.map(m => (
            <tr key={m.mediatorId} className={m.active ? '' : 'stats-inactive'}>
              <td>
                {m.name}
                {!m.active && <span className="stats-inactive-badge"> (inactif)</span>}
              </td>
              <td>{m.slotCount}</td>
              <td>{formatHours(m.totalMinutes)}</td>
              <td>
                {m.absenceCount === 0
                  ? '—'
                  : `${m.absenceCount} (${formatDecimal(m.absenceDays).replace(',0', '')} j)`}
              </td>
              <td>
                {m.offers.length === 0
                  ? '—'
                  : m.offers.map(o => (
                      <span key={o.offerId} className="stats-offer-chip">
                        {o.name} × {o.count}
                      </span>
                    ))}
              </td>
              <td className="stats-total-cell">{m.slotCount}</td>
            </tr>
          ))}
          <tr className="stats-total-row">
            <td>Total (dont {unassignedCount} non affectée{unassignedCount > 1 ? 's' : ''})</td>
            <td>{stats.reduce((sum, m) => sum + m.slotCount, 0)}</td>
            <td>
              {formatHours(stats.reduce((sum, m) => sum + m.totalMinutes, 0))}
            </td>
            <td>
              {(() => {
                const n = stats.reduce((sum, m) => sum + m.absenceCount, 0);
                const days = stats.reduce((sum, m) => sum + m.absenceDays, 0);
                return n === 0 ? '—' : `${n} (${formatDecimal(days).replace(',0', '')} j)`;
              })()}
            </td>
            <td>—</td>
            <td className="stats-total-cell">
              {stats.reduce((sum, m) => sum + m.slotCount, 0) + unassignedCount}
            </td>
          </tr>
        </tbody>
      </table>

      <h3 className="stats-section-title">Charge hebdomadaire par médiateur</h3>
      {allWeeks.length === 0 ? (
        <p className="stats-empty">Aucune réservation sur la période.</p>
      ) : (
        <table className="stats-table stats-load-table">
          <thead>
            <tr>
              <th>Médiateur</th>
              {allWeeks.map(w => (
                <th key={w}>S{w}</th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {stats
              .filter(m => weeklyLoad.has(m.mediatorId))
              .map(m => {
                const load = weeklyLoad.get(m.mediatorId) || [];
                const maxMin = Math.max(1, ...load.map(w => w.minutes));
                const total = load.reduce((sum, w) => sum + w.minutes, 0);
                return (
                  <tr key={m.mediatorId}>
                    <td className="stats-load-name" title={m.name}>
                      {m.name.replace(/ (\S)\S*$/, ' $1.')}
                    </td>
                    {allWeeks.map(week => {
                      const w = load.find(x => x.week === week);
                      const minutes = w ? w.minutes : 0;
                      const pct = Math.round((minutes / maxMin) * 100);
                      return (
                        <td key={week} className="stats-load-cell">
                          {minutes > 0 && (
                            <span
                              className="stats-load-bar"
                              style={{ width: `${pct}%` }}
                              title={`S${week} : ${formatHours(minutes)}`}
                            />
                          )}
                          <span className="stats-load-value">
                            {minutes > 0 ? formatHours(minutes) : ''}
                          </span>
                        </td>
                      );
                    })}
                    <td className="stats-load-total">{formatHours(total)}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---- Tab Réservations: three aligned charts ----

interface OfferColumn {
  offer: OfferStats;
  x: number; // left of the column
  width: number;
}

function useOfferColumns(offers: OfferStats[], chartWidth: number, labelWidth: number): OfferColumn[] {
  return useMemo(() => {
    const plot = Math.max(1, chartWidth - labelWidth);
    const colWidth = plot / Math.max(1, offers.length);
    return offers.map((offer, i) => ({
      offer,
      x: labelWidth + i * colWidth + colWidth * 0.15,
      width: colWidth * 0.7,
    }));
  }, [offers, chartWidth, labelWidth]);
}

function ReservationsTab({ data, start, end }: { data: import('../domain/types').AppData; start: string; end: string }) {
  const result = useMemo(() => computeOfferStats(data, start, end), [data, start, end]);
  const weekday = useMemo(() => computeWeekdayStats(data, start, end), [data, start, end]);
  const natureTotals = useMemo(() => computeVisitStats(data, start, end).natureTotals, [data, start, end]);
  const [hoveredOfferId, setHoveredOfferId] = useState<string | null>(null);

  const maxWeekday = Math.max(1, ...weekday.map(w => w.count));
  const natures = useMemo(() => natureTotals.map(n => n.nature), [natureTotals]);
  const NATURE_CHART_W = 900;
  const NATURE_MARGIN = { left: 10, right: 20, top: 10, bottom: 10 };
  const maxNatureTotal = Math.max(1, ...natureTotals.map(n => n.totalParticipants));

  const CHART_W = 900;
  const CHART_H = 160;
  const LABEL_W = 40;

  const columns = useOfferColumns(result.offers, CHART_W, LABEL_W);
  const maxCount = Math.max(1, ...result.offers.map(o => o.count));
  const maxMinutes = Math.max(1, ...result.offers.map(o => o.totalMinutes));
  const maxParticipants = Math.max(1, ...result.offers.map(o => o.participants.max));

  const dim = (offerId: string): number =>
    hoveredOfferId && hoveredOfferId !== offerId ? 0.35 : 1;

  const hovered = result.offers.find(o => o.offerId === hoveredOfferId);

  if (result.offers.length === 0) {
    return <p className="stats-empty">Aucune réservation sur la période.</p>;
  }

  return (
    <div className="stats-tab-content">
      <p className="stats-summary">
        Taux d'affectation : {Math.round(result.assignmentRate * 100)} %
      </p>
      <p className="stats-tooltip-line" role="status">
        {hovered
          ? `${hovered.name} — ${formatCount(hovered.count, 'réservation', 'réservations')}, ${formatHours(hovered.totalMinutes)}, effectifs ${hovered.participants.min}–${hovered.participants.max} (méd. ${formatDecimal(hovered.participants.median)})`
          : 'Survolez une barre pour voir le détail de l\u2019offre.'}
      </p>

      <h3 className="stats-section-title">Nombre de réservations</h3>
      <svg
        className="stats-bar-chart"
        data-chart="count"
        viewBox={`0 0 ${CHART_W} ${CHART_H + 40}`}
        role="img"
        aria-label="Nombre de réservations par offre"
      >
        {columns.map(({ offer, x, width }) => {
          const barH = (offer.count / maxCount) * CHART_H;
          return (
            <g key={offer.offerId} data-offer-id={offer.offerId} opacity={dim(offer.offerId)}>
              <rect
                x={x}
                y={CHART_H - barH}
                width={width}
                height={barH}
                className="stats-bar stats-bar-count"
              >
                <title>{`${offer.name} : ${offer.count}`}</title>
              </rect>
              <text x={x + width / 2} y={CHART_H - barH - 6} textAnchor="middle" className="stats-bar-value">
                {offer.count}
              </text>
            </g>
          );
        })}
      </svg>

      <h3 className="stats-section-title">Durée cumulée</h3>
      <svg
        className="stats-bar-chart"
        data-chart="duration"
        viewBox={`0 0 ${CHART_W} ${CHART_H + 40}`}
        role="img"
        aria-label="Durée cumulée par offre"
      >
        {columns.map(({ offer, x, width }) => {
          const barH = (offer.totalMinutes / maxMinutes) * CHART_H;
          return (
            <g
              key={offer.offerId}
              data-offer-id={offer.offerId}
              opacity={dim(offer.offerId)}
            >
              <rect
                x={x}
                y={CHART_H - barH}
                width={width}
                height={barH}
                className="stats-bar stats-bar-duration"
              >
                <title>{`${offer.name} : ${formatHours(offer.totalMinutes)}`}</title>
              </rect>
              <text x={x + width / 2} y={CHART_H - barH - 6} textAnchor="middle" className="stats-bar-value">
                {formatHours(offer.totalMinutes)}
              </text>
            </g>
          );
        })}
      </svg>

      <h3 className="stats-section-title">Effectifs</h3>
      <svg
        className="stats-candle-chart"
        viewBox={`0 0 ${CHART_W} ${CHART_H + 110}`}
        role="img"
        aria-label="Effectifs par offre : min, max, médiane, moyenne"
      >
        {columns.map(({ offer, x, width }) => {
          const p = offer.participants;
          const yMax = CHART_H - (p.max / maxParticipants) * CHART_H;
          const yMin = CHART_H - (p.min / maxParticipants) * CHART_H;
          const yMed = CHART_H - (p.median / maxParticipants) * CHART_H;
          const yAvg = CHART_H - (p.avg / maxParticipants) * CHART_H;
          const cx = x + width / 2;
          return (
            <g key={offer.offerId} data-offer-id={offer.offerId} opacity={dim(offer.offerId)}>
              {/* whisker */}
              <line x1={cx} y1={yMax} x2={cx} y2={yMin} className="stats-candle-whisker" />
              {/* min/max caps */}
              <line x1={cx - 6} y1={yMax} x2={cx + 6} y2={yMax} className="stats-candle-cap" />
              <line x1={cx - 6} y1={yMin} x2={cx + 6} y2={yMin} className="stats-candle-cap" />
              {/* median body */}
              <rect x={x} y={yMed - 4} width={width} height={8} className="stats-candle-body">
                <title>{`${offer.name} : min ${p.min}, médiane ${formatDecimal(p.median)}, moyenne ${formatDecimal(p.avg)}, max ${p.max}`}</title>
              </rect>
              {/* average marker */}
              <circle cx={cx} cy={yAvg} r={3} className="stats-candle-avg" />
              {/* offer label INSIDE the SVG, same X as the bars */}
              <text
                x={cx}
                y={CHART_H + 18}
                textAnchor="start"
                className={`stats-axis-label${hoveredOfferId === offer.offerId ? ' stats-label-highlight' : ''}`}
                transform={`rotate(30 ${cx} ${CHART_H + 18})`}
              >
                {offer.name.length > 18 ? `${offer.name.slice(0, 17)}…` : offer.name}
                <title>{offer.name}</title>
              </text>
            </g>
          );
        })}
      </svg>

      {/* Shared hover zones for cross-chart highlight, aligned on the same X axis */}
      <svg className="stats-hover-zones" viewBox={`0 0 ${CHART_W} 1`} preserveAspectRatio="none">
        {columns.map(({ offer, x, width }) => (
          <rect
            key={offer.offerId}
            x={x - width * 0.2}
            y={0}
            width={width * 1.4}
            height={1}
            fill="transparent"
            onMouseEnter={() => setHoveredOfferId(offer.offerId)}
            onMouseLeave={() => setHoveredOfferId(null)}
          />
        ))}
      </svg>

      {/* Offer labels live INSIDE the candle chart SVG now */}
      <h3 className="stats-section-title">Réservations par jour de la semaine</h3>
      <div className="stats-weekday-chart">
        {weekday.map(w => (
          <div key={w.weekday} className="stats-weekday-col" title={`${w.label} : ${w.count} réservation${w.count > 1 ? 's' : ''}`}>
            <span className="stats-weekday-count">{w.count}</span>
            <div
              className="stats-weekday-bar"
              style={{ height: `${Math.round((w.count / maxWeekday) * 80)}px` }}
            />
            <span className="stats-weekday-label">{w.label.slice(0, 3)}</span>
          </div>
        ))}
      </div>

      <h3 className="stats-section-title">Total visiteurs par nature</h3>
      {natureTotals.length === 0 ? (
        <p className="stats-empty">Aucune réservation sur la période.</p>
      ) : (
        (() => {
          const NATURE_W = 200; // left column for nature names
          const rowH = 26;
          const height = natureTotals.length * rowH + NATURE_MARGIN.top + NATURE_MARGIN.bottom;
          return (
            <svg
              viewBox={`0 0 ${NATURE_CHART_W} ${height}`}
              className="stats-bar-chart"
              data-chart="nature-totals"
              role="img"
              aria-label="Total du nombre de visiteurs par nature de groupe (survolez pour le détail)"
            >
              {natureTotals.map((n, i) => {
                const y = NATURE_MARGIN.top + i * rowH;
                const barW = (n.totalParticipants / maxNatureTotal) * (NATURE_CHART_W - NATURE_W - 70);
                return (
                  <g key={n.nature}>
                    <text
                      x={NATURE_W - 8}
                      y={y + rowH / 2 + 4}
                      textAnchor="end"
                      className="stats-axis-label"
                    >
                      {n.nature.length > 24 ? `${n.nature.slice(0, 23)}…` : n.nature}
                      <title>{n.nature}</title>
                    </text>
                    <rect
                      x={NATURE_W}
                      y={y + 3}
                      width={Math.max(1, barW)}
                      height={rowH - 8}
                      className="stats-bar"
                      fill={natureColor(natures, n.nature)}
                      rx={3}
                    >
                      <title>{`${n.nature} : ${n.totalParticipants} visiteurs (${n.slotCount} réservation${n.slotCount > 1 ? 's' : ''})`}</title>
                    </rect>
                    <text
                      x={NATURE_W + Math.max(1, barW) + 6}
                      y={y + rowH / 2 + 4}
                      className="stats-bar-value"
                    >
                      {n.totalParticipants}
                    </text>
                  </g>
                );
              })}
            </svg>
          );
        })()
      )}
    </div>
  );
}

// ---- Tab Visites ----

function VisitsTab({ data, start, end }: { data: import('../domain/types').AppData; start: string; end: string }) {
  const stats = useMemo(() => computeVisitStats(data, start, end), [data, start, end]);
  const weekdayCandles = useMemo(() => computeWeekdayVisitCandles(data, start, end), [data, start, end]);
  const maxWeekdayVisits = Math.max(1, ...weekdayCandles.map(c => c.max));

  const totalVisits = stats.free.totalParticipants + stats.accompanied.totalParticipants;
  const natures = useMemo(
    () => stats.natureCandles.map(c => c.nature),
    [stats.natureCandles]
  );

  // Pie
  const PIE_R = 70;
  const pieSlices =
    totalVisits === 0
      ? []
      : [
          { label: 'Visites libres', value: stats.free.totalParticipants, color: PALETTE[0] },
          { label: 'Visites accompagnées', value: stats.accompanied.totalParticipants, color: PALETTE[2] },
        ];

  // Shared chart geometry: margins guarantee nothing overflows the viewBox
  const CHART_W = 900;
  const MARGIN = { left: 40, right: 20, top: 10, bottom: 30 };
  const PLOT_W = CHART_W - MARGIN.left - MARGIN.right;
  const LINE_H = 180;
  const maxCumulative = Math.max(1, ...stats.cumulative.map(p => p.cumulative));

  const STACK_H = 180;
  const maxBucketTotal = Math.max(1, ...stats.byNature.map(p => p.total));

  const CANDLE_H = 160;
  const maxCandle = Math.max(1, ...stats.natureCandles.map(c => c.max));

  return (
    <div className="stats-tab-content">
      <h3 className="stats-section-title">Visites libres vs accompagnées</h3>
      <div className="stats-pie-row">
        <svg viewBox="0 0 200 200" className="stats-pie" role="img" aria-label="Visites libres vs accompagnées (survolez pour le détail)">
          {(() => {
            let angle = 0;
            return pieSlices.map(slice => {
              const frac = slice.value / totalVisits;
              const x1 = 100 + PIE_R * Math.cos(angle);
              const y1 = 100 + PIE_R * Math.sin(angle);
              angle += frac * 2 * Math.PI;
              const x2 = 100 + PIE_R * Math.cos(angle);
              const y2 = 100 + PIE_R * Math.sin(angle);
              const largeArc = frac > 0.5 ? 1 : 0;
              const full = frac >= 0.999;
              return (
                <path
                  key={slice.label}
                  d={
                    full
                      ? `M 100 30 A 70 70 0 1 1 99.9 30 Z`
                      : `M 100,100 L ${x1},${y1} A ${PIE_R},${PIE_R} 0 ${largeArc} 1 ${x2},${y2} Z`
                  }
                  fill={slice.color}
                  stroke="white"
                  strokeWidth="1"
                >
                  <title>{`${slice.label} : ${slice.value} participants (${
                    slice.label === 'Visites libres' ? stats.free.slotCount : stats.accompanied.slotCount
                  } réservations)`}</title>
                </path>
              );
            });
          })()}
        </svg>
        <div className="stats-pie-summary">
          <p><strong>{stats.accompanied.slotCount + stats.free.slotCount}</strong> réservations — <strong>{totalVisits}</strong> participants sur la période</p>
          <p className="stats-tooltip-line">Survolez une part pour le détail.</p>
        </div>
      </div>

      <h3 className="stats-section-title">Effectifs cumulés</h3>
      <svg
        viewBox={`0 0 ${CHART_W} ${LINE_H + MARGIN.top + MARGIN.bottom}`}
        className="stats-line-chart"
        role="img"
        aria-label="Effectifs cumulés au cours de la période"
      >
        {(() => {
          const pts = stats.cumulative;
          if (pts.length === 0) return null;
          const step = pts.length > 1 ? PLOT_W / (pts.length - 1) : 0;
          const toXY = (i: number, v: number) => [
            MARGIN.left + i * step,
            MARGIN.top + LINE_H - (v / maxCumulative) * LINE_H,
          ];
          const path = pts
            .map((p, i) => {
              const [x, y] = toXY(i, p.cumulative);
              return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
            })
            .join(' ');
          return (
            <>
              <path d={path} className="stats-line" />
              {pts.map((p, i) => {
                const [x, y] = toXY(i, p.cumulative);
                return (
                  <circle key={p.date} cx={x} cy={y} r={2} className="stats-line-dot">
                    <title>{`${p.date} : ${p.cumulative} participants (cumulés)`}</title>
                  </circle>
                );
              })}
            </>
          );
        })()}
        <text x={MARGIN.left} y={LINE_H + MARGIN.top + 18} className="stats-axis-label">
          {stats.cumulative[0]?.date}
        </text>
        <text
          x={MARGIN.left + PLOT_W}
          y={LINE_H + MARGIN.top + 18}
          textAnchor="end"
          className="stats-axis-label"
        >
          {stats.cumulative[stats.cumulative.length - 1]?.date}
        </text>
      </svg>

      <h3 className="stats-section-title">Effectifs par nature de groupe</h3>
      {stats.byNature.length === 0 ? (
        <p className="stats-empty">Aucune réservation sur la période.</p>
      ) : (
        <svg
          viewBox={`0 0 ${CHART_W} ${STACK_H + MARGIN.top + MARGIN.bottom}`}
          className="stats-stacked-chart"
          role="img"
          aria-label="Effectifs par nature de groupe au cours du temps (survolez une barre pour le détail)"
        >
          {(() => {
            const n = stats.byNature.length;
            const colW = Math.max(2, PLOT_W / Math.max(1, n) - 2);
            return stats.byNature.map((point, i) => {
              let y = MARGIN.top + STACK_H;
              const x = MARGIN.left + i * (PLOT_W / Math.max(1, n));
              const partsSummary = point.parts
                .map(p => `${p.nature} : ${p.participants}`)
                .join(', ');
              return (
                <g key={`${point.date}-${i}`}>
                  {point.parts.map(part => {
                    // Clamp to the plot area: never exceed STACK_H
                    const h = Math.min(
                      STACK_H,
                      (part.participants / maxBucketTotal) * STACK_H
                    );
                    const yy = y - h;
                    y = yy;
                    return (
                      <rect
                        key={part.nature}
                        x={x}
                        y={yy}
                        width={colW}
                        height={h}
                        fill={natureColor(natures, part.nature)}
                      >
                        <title>{`${point.label} — ${part.nature} : ${part.participants} participants`}</title>
                      </rect>
                    );
                  })}
                  {/* Full-bar hover target summarizing the bucket */}
                  <rect
                    x={x}
                    y={MARGIN.top}
                    width={colW}
                    height={STACK_H}
                    fill="transparent"
                  >
                    <title>{`${point.label} — total ${point.total} participants\n${partsSummary}`}</title>
                  </rect>
                </g>
              );
            });
          })()}
          <text x={MARGIN.left} y={MARGIN.top + STACK_H + 20} className="stats-axis-label">
            {stats.byNature[0]?.label}
          </text>
          <text
            x={MARGIN.left + PLOT_W}
            y={MARGIN.top + STACK_H + 20}
            textAnchor="end"
            className="stats-axis-label"
          >
            {stats.byNature[stats.byNature.length - 1]?.label}
          </text>
        </svg>
      )}

      <h3 className="stats-section-title">Effectifs par nature</h3>
      <svg
        viewBox={`0 0 ${CHART_W} ${CANDLE_H + MARGIN.top + MARGIN.bottom + 20}`}
        className="stats-candle-chart"
        role="img"
        aria-label="Effectifs par nature de groupe : min, max, médiane, moyenne (survolez pour le détail)"
      >
        {(() => {
          const n = stats.natureCandles.length;
          const colW = PLOT_W / Math.max(1, n);
          return stats.natureCandles.map((c, i) => {
            const x = MARGIN.left + i * colW + colW * 0.15;
            const w = colW * 0.7;
            const cx = x + w / 2;
            const yMax = MARGIN.top + CANDLE_H - (c.max / maxCandle) * CANDLE_H;
            const yMin = MARGIN.top + CANDLE_H - (c.min / maxCandle) * CANDLE_H;
            const yMed = MARGIN.top + CANDLE_H - (c.median / maxCandle) * CANDLE_H;
            const yAvg = MARGIN.top + CANDLE_H - (c.avg / maxCandle) * CANDLE_H;
            return (
              <g key={c.nature}>
                <line x1={cx} y1={yMax} x2={cx} y2={yMin} className="stats-candle-whisker" />
                <line x1={cx - 6} y1={yMax} x2={cx + 6} y2={yMax} className="stats-candle-cap" />
                <line x1={cx - 6} y1={yMin} x2={cx + 6} y2={yMin} className="stats-candle-cap" />
                <rect x={x} y={yMed - 4} width={w} height={8} className="stats-candle-body">
                  <title>{`${c.nature} : min ${c.min}, médiane ${formatDecimal(c.median)}, moyenne ${formatDecimal(c.avg)}, max ${c.max} (${c.count} réservations)`}</title>
                </rect>
                <circle cx={cx} cy={yAvg} r={3} className="stats-candle-avg" />
                <text
                  x={cx}
                  y={MARGIN.top + CANDLE_H + 20}
                  textAnchor="middle"
                  className="stats-axis-label"
                >
                  {c.nature.length > 16 ? `${c.nature.slice(0, 15)}…` : c.nature}
                </text>
              </g>
            );
          });
        })()}
      </svg>
      <h3 className="stats-section-title">Visites par jour de la semaine</h3>
      <svg
        viewBox={`0 0 ${CHART_W} ${CANDLE_H + MARGIN.top + MARGIN.bottom + 20}`}
        className="stats-candle-chart"
        role="img"
        aria-label="Nombre de visites par jour de la semaine : min, max, médiane, moyenne (survolez pour le détail)"
      >
        {(() => {
          const n = weekdayCandles.length || 7;
          const colW = PLOT_W / n;
          return weekdayCandles.map((c, i) => {
            const x = MARGIN.left + i * colW + colW * 0.15;
            const w = colW * 0.7;
            const cx = x + w / 2;
            const yMax = MARGIN.top + CANDLE_H - (c.max / maxWeekdayVisits) * CANDLE_H;
            const yMin = MARGIN.top + CANDLE_H - (c.min / maxWeekdayVisits) * CANDLE_H;
            const yMed = MARGIN.top + CANDLE_H - (c.median / maxWeekdayVisits) * CANDLE_H;
            const yAvg = MARGIN.top + CANDLE_H - (c.avg / maxWeekdayVisits) * CANDLE_H;
            return (
              <g key={c.weekday}>
                <line x1={cx} y1={yMax} x2={cx} y2={yMin} className="stats-candle-whisker" />
                <line x1={cx - 6} y1={yMax} x2={cx + 6} y2={yMax} className="stats-candle-cap" />
                <line x1={cx - 6} y1={yMin} x2={cx + 6} y2={yMin} className="stats-candle-cap" />
                <rect x={x} y={yMed - 4} width={w} height={8} className="stats-candle-body">
                  <title>{`${c.label} : min ${c.min}, médiane ${formatDecimal(c.median)}, moyenne ${formatDecimal(c.avg)}, max ${c.max} visites/jour (sur ${c.days} ${c.days > 1 ? 'jours' : 'jour'})`}</title>
                </rect>
                <circle cx={cx} cy={yAvg} r={3} className="stats-candle-avg" />
                <text
                  x={cx}
                  y={MARGIN.top + CANDLE_H + 20}
                  textAnchor="middle"
                  className="stats-axis-label"
                >
                  {c.label}
                </text>
              </g>
            );
          });
        })()}
      </svg>
    </div>
  );
}

// ---- Main component ----

export default function StatsView() {
  const { state } = useData();
  const data = state.data;

  // Default period: current month
  const now = new Date();
  const [start, setStart] = useState(() => isoDate(startOfMonth(now)));
  const [end, setEnd] = useState(() => isoDate(endOfMonth(now)));
  const [tab, setTab] = useState<Tab>('mediators');

  return (
    <div className="stats-view">
      <div className="stats-header">
        <h2>Statistiques</h2>
        <PeriodSelector
          start={start}
          end={end}
          onStart={setStart}
          onEnd={setEnd}
        />
      </div>
      <div className="stats-tabs" role="tablist">
        <button
          className={`stats-tab${tab === 'mediators' ? ' active' : ''}`}
          onClick={() => setTab('mediators')}
        >
          Médiateurs
        </button>
        <button
          className={`stats-tab${tab === 'reservations' ? ' active' : ''}`}
          onClick={() => setTab('reservations')}
        >
          Réservations
        </button>
        <button
          className={`stats-tab${tab === 'visits' ? ' active' : ''}`}
          onClick={() => setTab('visits')}
        >
          Visites
        </button>
      </div>
      {start > end ? (
        <p className="stats-empty">
          La date de début doit être antérieure ou égale à la date de fin.
        </p>
      ) : (
        <>
          {tab === 'mediators' && <MediatorsTab data={data} start={start} end={end} />}
          {tab === 'reservations' && <ReservationsTab data={data} start={start} end={end} />}
          {tab === 'visits' && <VisitsTab data={data} start={start} end={end} />}
        </>
      )}
    </div>
  );
}
