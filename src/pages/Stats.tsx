import { useMemo } from "react";
import { useOrders } from "../features/orders/OrdersContext";
import StatsGate from "../features/pin/StatsGate";

const formatCurrency = (value: number) => `EUR ${value.toFixed(2)}`;

const startOfWeek = (value: Date) => {
  const start = new Date(value);
  const day = start.getDay();
  const diff = (day + 6) % 7;
  start.setDate(start.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start;
};

const endOfWeek = (value: Date) => {
  const start = startOfWeek(value);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return end;
};

const addWeeks = (value: Date, weeks: number) => {
  const next = new Date(value);
  next.setDate(next.getDate() + weeks * 7);
  return next;
};

const formatShortDate = (value: Date) =>
  value.toLocaleDateString(undefined, { month: "short", day: "numeric" });

const Stats = () => {
  const { orders, isLoading, error } = useOrders();

  const {
    allTime,
    thisWeek,
    lastWeek,
    weekLabel,
    weeklySales,
    weeklyRangeLabel,
    weeklyDates,
    itemStats,
    sauceStats,
  } = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);
    const lastWeekStart = addWeeks(weekStart, -1);
    const lastWeekEnd = weekStart;

    const summarize = (subset: typeof orders) => {
      const itemsSold = subset.reduce(
        (sum, order) =>
          sum +
          order.items.reduce((itemSum, item) => itemSum + Math.max(0, item.quantity), 0),
        0
      );
      const totalSales = subset.reduce(
        (sum, order) =>
          sum +
          order.items.reduce((itemSum, item) => {
            if (typeof item.price !== "number" || Number.isNaN(item.price)) return itemSum;
            return itemSum + item.price * Math.max(0, item.quantity);
          }, 0),
        0
      );
      return { itemsSold, totalSales };
    };

    const thisWeekOrders = orders.filter((order) => {
      const createdAt = new Date(order.createdAt);
      return createdAt >= weekStart && createdAt < weekEnd;
    });
    const lastWeekOrders = orders.filter((order) => {
      const createdAt = new Date(order.createdAt);
      return createdAt >= lastWeekStart && createdAt < lastWeekEnd;
    });

    const buildItemStats = (subset: typeof orders) => {
      const map = new Map<string, number>();
      subset.forEach((order) => {
        order.items.forEach((item) => {
          const name = item.name?.trim();
          if (!name) return;
          const next = (map.get(name) ?? 0) + Math.max(0, item.quantity);
          map.set(name, next);
        });
      });
      return map;
    };

    const buildSauceStats = (subset: typeof orders) => {
      const map = new Map<string, number>();
      subset.forEach((order) => {
        order.items.forEach((item) => {
          const modifiers = item.modifiers ?? {};
          Object.entries(modifiers).forEach(([group, values]) => {
            if (!/sauce/i.test(group)) return;
            values.forEach((value) => {
              const name = value?.trim();
              if (!name || /no\s*sauce/i.test(name)) return;
              map.set(name, (map.get(name) ?? 0) + Math.max(0, item.quantity));
            });
          });
        });
      });
      return map;
    };

    const allTimeItems = buildItemStats(orders);
    const thisWeekItems = buildItemStats(thisWeekOrders);
    const lastWeekItems = buildItemStats(lastWeekOrders);
    const itemStatsList = Array.from(allTimeItems.entries())
      .map(([name, total]) => ({
        name,
        allTime: total,
        thisWeek: thisWeekItems.get(name) ?? 0,
        lastWeek: lastWeekItems.get(name) ?? 0,
      }))
      .sort((a, b) => b.allTime - a.allTime);

    const allTimeSauces = buildSauceStats(orders);
    const thisWeekSauces = buildSauceStats(thisWeekOrders);
    const lastWeekSauces = buildSauceStats(lastWeekOrders);
    const sauceStatsList = Array.from(allTimeSauces.entries())
      .map(([name, total]) => ({
        name,
        allTime: total,
        thisWeek: thisWeekSauces.get(name) ?? 0,
        lastWeek: lastWeekSauces.get(name) ?? 0,
      }))
      .sort((a, b) => b.allTime - a.allTime);

    const currentWeekStart = startOfWeek(now);
    const weeks = Array.from({ length: 52 }, (_, index) =>
      addWeeks(currentWeekStart, index - 51)
    );
    const weekKey = (date: Date) => startOfWeek(date).toISOString().slice(0, 10);
    const weekIndex = new Map(weeks.map((week, index) => [weekKey(week), index]));
    const weeklyTotals = new Array(52).fill(0);

    orders.forEach((order) => {
      const key = weekKey(new Date(order.createdAt));
      const index = weekIndex.get(key);
      if (index === undefined) return;
      const orderTotal = order.items.reduce((sum, item) => {
        if (typeof item.price !== "number" || Number.isNaN(item.price)) return sum;
        return sum + item.price * Math.max(0, item.quantity);
      }, 0);
      weeklyTotals[index] += orderTotal;
    });

    const rangeLabel = `${formatShortDate(weeks[0])} - ${formatShortDate(addWeeks(weeks[51], 1))}`;

    return {
      allTime: summarize(orders),
      thisWeek: summarize(thisWeekOrders),
      lastWeek: summarize(lastWeekOrders),
      weekLabel: `${weekStart.toLocaleDateString()} - ${new Date(
        weekEnd.getTime() - 1
      ).toLocaleDateString()}`,
      weeklySales: weeklyTotals,
      weeklyRangeLabel: rangeLabel,
      weeklyDates: weeks,
      itemStats: itemStatsList,
      sauceStats: sauceStatsList,
    };
  }, [orders]);

  const salesDelta = thisWeek.totalSales - lastWeek.totalSales;
  const itemsDelta = thisWeek.itemsSold - lastWeek.itemsSold;
  const salesDeltaMeta =
    salesDelta > 0
      ? { arrow: "▲", className: "text-emerald-500" }
      : salesDelta < 0
        ? { arrow: "▼", className: "text-rose-400" }
        : { arrow: "—", className: "text-contrast/60" };
  const itemsDeltaMeta =
    itemsDelta > 0
      ? { arrow: "▲", className: "text-emerald-500" }
      : itemsDelta < 0
        ? { arrow: "▼", className: "text-rose-400" }
        : { arrow: "—", className: "text-contrast/60" };

  const chart = useMemo(() => {
    const width = 1000;
    const height = 300;
    const paddingX = 36;
    const paddingY = 30;
    const labelYOffset = 20;
    const valueOffset = 10;
    const maxValue = Math.max(1, ...weeklySales);

    const lastIndex = Math.max(0, weeklySales.length - 1);
    const points = weeklySales.map((value, index) => {
      const x =
        paddingX +
        (index / Math.max(1, weeklySales.length - 1)) * (width - paddingX * 2);
      const y =
        paddingY +
        (1 - value / maxValue) * (height - paddingY * 2);
      const isLast = index === lastIndex;
      return {
        x,
        y,
        value,
        valueLabel: isLast
          ? formatCurrency(value)
          : Math.round(value).toLocaleString(),
        dateLabel: weeklyDates[index] ? formatShortDate(weeklyDates[index]) : "",
        showLabel: value > 0 || isLast,
      };
    });

    const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");

    return { width, height, paddingX, paddingY, labelYOffset, valueOffset, maxValue, points, polyline };
  }, [weeklySales, weeklyDates]);

  return (
    <StatsGate>
      <section className="space-y-8">
        <div className="rounded-2xl border border-accent-3/60 bg-accent-2/70 px-4 py-3 text-sm text-contrast/70 shadow-sm">
          {isLoading ? "Syncing statistics..." : "Statistics overview"}
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-accent-3/60 bg-accent-1/80 p-6 shadow-lg shadow-accent-4/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand/70">
                  All Time
                </p>
                <h2 className="text-xl font-semibold text-contrast">Total performance</h2>
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-accent-3/60 bg-primary/70 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-contrast/60">
                  Total sales
                </p>
                <p className="mt-2 text-2xl font-semibold text-contrast">
                  {formatCurrency(allTime.totalSales)}
                </p>
              </div>
              <div className="rounded-2xl border border-accent-3/60 bg-primary/70 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-contrast/60">
                  Items sold
                </p>
                <p className="mt-2 text-2xl font-semibold text-contrast">
                  {allTime.itemsSold.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-accent-3/60 bg-accent-1/80 p-6 shadow-lg shadow-accent-4/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand/70">
                  This Week
                </p>
                <h2 className="text-xl font-semibold text-contrast">{weekLabel}</h2>
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-accent-3/60 bg-primary/70 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-contrast/60">
                  Total sales
                </p>
                <p className="mt-2 text-2xl font-semibold text-contrast">
                  {formatCurrency(thisWeek.totalSales)}
                </p>
                <p
                  className={`mt-2 text-xs font-semibold uppercase tracking-wide ${salesDeltaMeta.className}`}
                >
                  {salesDeltaMeta.arrow}{" "}
                  {salesDelta === 0
                    ? "No change"
                    : `${salesDelta > 0 ? "+" : "-"}${formatCurrency(Math.abs(salesDelta))}`}{" "}
                  vs last week
                </p>
              </div>
              <div className="rounded-2xl border border-accent-3/60 bg-primary/70 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-contrast/60">
                  Items sold
                </p>
                <p className="mt-2 text-2xl font-semibold text-contrast">
                  {thisWeek.itemsSold.toLocaleString()}
                </p>
                <p
                  className={`mt-2 text-xs font-semibold uppercase tracking-wide ${itemsDeltaMeta.className}`}
                >
                  {itemsDeltaMeta.arrow}{" "}
                  {itemsDelta === 0
                    ? "No change"
                    : `${itemsDelta > 0 ? "+" : "-"}${Math.abs(itemsDelta).toLocaleString()}`}{" "}
                  vs last week
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-accent-3/60 bg-accent-1/80 p-6 shadow-lg shadow-accent-4/20">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand/70">
                Weekly Sales
              </p>
              <h2 className="text-xl font-semibold text-contrast">Last 52 weeks</h2>
            </div>
            <div className="text-xs font-semibold uppercase tracking-wide text-contrast/60">
              {weeklyRangeLabel}
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-accent-3/60 bg-primary/70 p-4">
            <svg
              viewBox={`0 0 ${chart.width} ${chart.height}`}
              className="h-72 w-full"
              role="img"
              aria-label="Weekly sales chart"
            >
              <line
                x1={chart.paddingX}
                y1={chart.height - chart.paddingY}
                x2={chart.width - chart.paddingX}
                y2={chart.height - chart.paddingY}
                stroke="currentColor"
                strokeOpacity="0.15"
              />
              <polyline
                points={chart.polyline}
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeOpacity="0.6"
              />
              {chart.points.map((point, index) => (
                <g key={`point-${index}`}>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="3"
                    fill="currentColor"
                    opacity={0.85}
                  />
                  {point.showLabel ? (
                    <>
                      <text
                        x={point.x + 8}
                        y={Math.max(chart.paddingY, point.y - chart.valueOffset)}
                        fontSize="10"
                        fill="currentColor"
                        opacity="0.7"
                      >
                        {point.valueLabel}
                      </text>
                      <text
                        x={point.x}
                        y={chart.height - chart.paddingY + chart.labelYOffset}
                        textAnchor="middle"
                        fontSize="9"
                        fill="currentColor"
                        opacity="0.55"
                        transform={`rotate(-45 ${point.x} ${
                          chart.height - chart.paddingY + chart.labelYOffset
                        })`}
                      >
                        {point.dateLabel}
                      </text>
                    </>
                  ) : null}
                </g>
              ))}
            </svg>
          </div>
        </div>

        <div className="rounded-3xl border border-accent-3/60 bg-accent-1/80 p-6 shadow-lg shadow-accent-4/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand/70">
                Items Sold
              </p>
              <h2 className="text-xl font-semibold text-contrast">All time vs this week</h2>
            </div>
            <div className="text-xs font-semibold uppercase tracking-wide text-contrast/60">
              {weekLabel}
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-accent-3/60 bg-primary/70">
            <div className="grid grid-cols-[1fr_120px_120px] gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-contrast/60">
              <span>Item</span>
              <span className="text-right">All time</span>
              <span className="text-right">This week</span>
            </div>
            <div className="max-h-[360px] overflow-y-auto">
              {itemStats.length === 0 ? (
                <div className="px-4 py-6 text-sm text-contrast/60">No items sold yet.</div>
              ) : (
                itemStats.map((item) => (
                  <div
                    key={item.name}
                    className="grid grid-cols-[1fr_120px_120px] gap-2 border-t border-accent-3/60 px-4 py-3 text-sm text-contrast"
                  >
                    <span className="font-semibold">{item.name}</span>
                    <span className="text-right">{item.allTime.toLocaleString()}</span>
                    <span className="text-right">
                      {(() => {
                        const delta = item.thisWeek - item.lastWeek;
                        const meta =
                          delta > 0
                            ? { arrow: "▲", className: "text-emerald-500" }
                            : delta < 0
                              ? { arrow: "▼", className: "text-rose-400" }
                              : { arrow: "—", className: "text-contrast/60" };
                        const deltaLabel =
                          delta === 0
                            ? "0"
                            : `${delta > 0 ? "+" : ""}${delta.toLocaleString()}`;
                        return (
                          <span className={`font-semibold ${meta.className}`}>
                            {meta.arrow} {item.thisWeek.toLocaleString()}{" "}
                            <span className="text-[11px] font-semibold opacity-80">
                              ({deltaLabel})
                            </span>
                          </span>
                        );
                      })()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-accent-3/60 bg-accent-1/80 p-6 shadow-lg shadow-accent-4/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand/70">
                Sauces Used
              </p>
              <h2 className="text-xl font-semibold text-contrast">All time vs this week</h2>
            </div>
            <div className="text-xs font-semibold uppercase tracking-wide text-contrast/60">
              {weekLabel}
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-accent-3/60 bg-primary/70">
            <div className="grid grid-cols-[1fr_120px_120px] gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-contrast/60">
              <span>Sauce</span>
              <span className="text-right">All time</span>
              <span className="text-right">This week</span>
            </div>
            <div className="max-h-[360px] overflow-y-auto">
              {sauceStats.length === 0 ? (
                <div className="px-4 py-6 text-sm text-contrast/60">No sauces used yet.</div>
              ) : (
                sauceStats.map((sauce) => (
                  <div
                    key={sauce.name}
                    className="grid grid-cols-[1fr_120px_120px] gap-2 border-t border-accent-3/60 px-4 py-3 text-sm text-contrast"
                  >
                    <span className="font-semibold">{sauce.name}</span>
                    <span className="text-right">{sauce.allTime.toLocaleString()}</span>
                    <span className="text-right">
                      {(() => {
                        const delta = sauce.thisWeek - sauce.lastWeek;
                        const meta =
                          delta > 0
                            ? { arrow: "▲", className: "text-emerald-500" }
                            : delta < 0
                              ? { arrow: "▼", className: "text-rose-400" }
                              : { arrow: "—", className: "text-contrast/60" };
                        const deltaLabel =
                          delta === 0
                            ? "0"
                            : `${delta > 0 ? "+" : ""}${delta.toLocaleString()}`;
                        return (
                          <span className={`font-semibold ${meta.className}`}>
                            {meta.arrow} {sauce.thisWeek.toLocaleString()}{" "}
                            <span className="text-[11px] font-semibold opacity-80">
                              ({deltaLabel})
                            </span>
                          </span>
                        );
                      })()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </StatsGate>
  );
};

export default Stats;
