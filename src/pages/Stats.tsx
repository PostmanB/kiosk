import { useMemo, useState } from "react";
import useOrderHistory from "../features/orders/useOrderHistory";
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

type ChartView = "daily" | "weekly" | "monthly" | "yearly";
type ChartMetric = "sales" | "orders";

const chartViewOptions: Array<{ value: ChartView; label: string }> = [
  { value: "daily", label: "Napi" },
  { value: "weekly", label: "Heti" },
  { value: "monthly", label: "Havi" },
  { value: "yearly", label: "Eves" },
];

const chartMetricOptions: Array<{ value: ChartMetric; label: string }> = [
  { value: "sales", label: "EUR" },
  { value: "orders", label: "Rendelesek" },
];

const formatChartValue = (value: number, metric: ChartMetric, averaged = false) => {
  if (metric === "sales") return formatCurrency(value);
  const formatted = averaged ? value.toFixed(2) : Math.round(value).toLocaleString();
  return `${formatted} rendeles`;
};

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toDayRange = (dateInput: string) => {
  const [year, month, day] = dateInput.split("-").map((part) => Number(part));
  const start = new Date(year, (month || 1) - 1, day || 1, 0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

const toWeekInputValue = (dateInput: string) => {
  const { start } = toDayRange(dateInput);
  const target = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const weekYear = target.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${weekYear}-W${String(week).padStart(2, "0")}`;
};

const fromWeekInputValue = (weekInput: string) => {
  const [yearPart, weekPart] = weekInput.split("-W");
  const year = Number(yearPart);
  const week = Number(weekPart);
  if (!Number.isFinite(year) || !Number.isFinite(week)) return "";
  const firstWeekMonday = startOfWeek(new Date(year, 0, 4));
  firstWeekMonday.setDate(firstWeekMonday.getDate() + (week - 1) * 7);
  return toDateInputValue(firstWeekMonday);
};

type ChartPeriodPickerProps = {
  maxDate: string;
  onChange: (value: string) => void;
  value: string;
  view: ChartView;
};

const ChartPeriodPicker = ({ maxDate, onChange, value, view }: ChartPeriodPickerProps) => {
  const anchorDate = toDayRange(value).start;
  const inputClassName =
    "rounded-xl border border-accent-3/70 bg-primary/80 px-3 py-2 text-sm font-medium text-contrast";

  if (view === "daily") {
    return (
      <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-contrast/60">
        Nap
        <input
          type="date"
          value={value}
          max={maxDate}
          onChange={(event) => onChange(event.target.value || maxDate)}
          className={inputClassName}
        />
      </label>
    );
  }

  if (view === "weekly") {
    return (
      <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-contrast/60">
        Het
        <input
          type="week"
          value={toWeekInputValue(value)}
          max={toWeekInputValue(maxDate)}
          onChange={(event) => onChange(fromWeekInputValue(event.target.value) || maxDate)}
          className={inputClassName}
        />
      </label>
    );
  }

  if (view === "monthly") {
    return (
      <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-contrast/60">
        Honap
        <input
          type="month"
          value={value.slice(0, 7)}
          max={maxDate.slice(0, 7)}
          onChange={(event) => onChange(event.target.value ? `${event.target.value}-01` : maxDate)}
          className={inputClassName}
        />
      </label>
    );
  }

  return (
    <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-contrast/60">
      Ev
      <input
        type="number"
        min="2000"
        max={toDayRange(maxDate).start.getFullYear()}
        value={anchorDate.getFullYear()}
        onChange={(event) => {
          const year = Number(event.target.value);
          if (Number.isFinite(year)) onChange(`${year}-01-01`);
        }}
        className={`${inputClassName} w-28`}
      />
    </label>
  );
};

const Stats = () => {
  const { orders, isLoading, error } = useOrderHistory();
  const [selectedDate, setSelectedDate] = useState(() => toDateInputValue(new Date()));
  const [chartView, setChartView] = useState<ChartView>("daily");
  const [chartMetric, setChartMetric] = useState<ChartMetric>("sales");
  const [hourlyChartView, setHourlyChartView] = useState<ChartView>("daily");
  const [hourlyChartMetric, setHourlyChartMetric] = useState<ChartMetric>("sales");
  const todayDate = useMemo(() => toDateInputValue(new Date()), []);
  const [chartDate, setChartDate] = useState(todayDate);
  const [hourlyChartDate, setHourlyChartDate] = useState(todayDate);

  const {
    allTime,
    thisWeek,
    lastWeek,
    selectedDay,
    selectedDayLabel,
    weekLabel,
    itemStats,
    sauceStats,
  } = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);
    const lastWeekStart = addWeeks(weekStart, -1);
    const lastWeekEnd = weekStart;
    const { start: selectedDayStart, end: selectedDayEnd } = toDayRange(selectedDate);

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
    const selectedDayOrders = orders.filter((order) => {
      const createdAt = new Date(order.createdAt);
      return createdAt >= selectedDayStart && createdAt < selectedDayEnd;
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
    const selectedDayItems = buildItemStats(selectedDayOrders);
    const itemStatsList = Array.from(allTimeItems.entries())
      .map(([name, total]) => ({
        name,
        allTime: total,
        thisWeek: thisWeekItems.get(name) ?? 0,
        lastWeek: lastWeekItems.get(name) ?? 0,
        selectedDay: selectedDayItems.get(name) ?? 0,
      }))
      .sort((a, b) => b.allTime - a.allTime);

    const allTimeSauces = buildSauceStats(orders);
    const thisWeekSauces = buildSauceStats(thisWeekOrders);
    const lastWeekSauces = buildSauceStats(lastWeekOrders);
    const selectedDaySauces = buildSauceStats(selectedDayOrders);
    const sauceStatsList = Array.from(allTimeSauces.entries())
      .map(([name, total]) => ({
        name,
        allTime: total,
        thisWeek: thisWeekSauces.get(name) ?? 0,
        lastWeek: lastWeekSauces.get(name) ?? 0,
        selectedDay: selectedDaySauces.get(name) ?? 0,
      }))
      .sort((a, b) => b.allTime - a.allTime);

    return {
      allTime: summarize(orders),
      thisWeek: summarize(thisWeekOrders),
      lastWeek: summarize(lastWeekOrders),
      selectedDay: summarize(selectedDayOrders),
      selectedDayLabel: selectedDayStart.toLocaleDateString(),
      weekLabel: `${weekStart.toLocaleDateString()} - ${new Date(weekEnd.getTime() - 1).toLocaleDateString()}`,
      itemStats: itemStatsList,
      sauceStats: sauceStatsList,
    };
  }, [orders, selectedDate]);

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

  const salesChart = useMemo(() => {
    const { start: selectedDayStart } = toDayRange(chartDate);
    let rangeStart = new Date(selectedDayStart);
    let rangeEnd = new Date(selectedDayStart);
    let title = chartMetric === "sales" ? "Orankenti ertekesites" : "Orankenti rendelesek";
    let rangeLabel = selectedDayStart.toLocaleDateString();
    let labelEvery = 3;
    let buckets: Array<{ label: string; value: number }> = [];
    let bucketIndex: (date: Date) => number = () => -1;

    if (chartView === "daily") {
      rangeEnd.setDate(rangeEnd.getDate() + 1);
      buckets = Array.from({ length: 17 }, (_, index) => ({
        label: `${String(index + 7).padStart(2, "0")}:00`,
        value: 0,
      }));
      bucketIndex = (date) => date.getHours() - 7;
    } else if (chartView === "weekly") {
      rangeStart = startOfWeek(selectedDayStart);
      rangeEnd = endOfWeek(selectedDayStart);
      title = chartMetric === "sales" ? "Napi ertekesites" : "Napi rendelesek";
      rangeLabel = `${rangeStart.toLocaleDateString()} - ${new Date(rangeEnd.getTime() - 1).toLocaleDateString()}`;
      labelEvery = 1;
      buckets = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(rangeStart);
        date.setDate(date.getDate() + index);
        return {
          label: date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
          value: 0,
        };
      });
      bucketIndex = (date) => (date.getDay() + 6) % 7;
    } else if (chartView === "monthly") {
      rangeStart = new Date(selectedDayStart.getFullYear(), selectedDayStart.getMonth(), 1);
      rangeEnd = new Date(selectedDayStart.getFullYear(), selectedDayStart.getMonth() + 1, 1);
      const daysInMonth = new Date(
        selectedDayStart.getFullYear(),
        selectedDayStart.getMonth() + 1,
        0
      ).getDate();
      title = chartMetric === "sales" ? "Napi ertekesites" : "Napi rendelesek";
      rangeLabel = selectedDayStart.toLocaleDateString(undefined, { month: "long", year: "numeric" });
      labelEvery = 5;
      buckets = Array.from({ length: daysInMonth }, (_, index) => ({
        label: String(index + 1),
        value: 0,
      }));
      bucketIndex = (date) => date.getDate() - 1;
    } else {
      rangeStart = new Date(selectedDayStart.getFullYear(), 0, 1);
      rangeEnd = new Date(selectedDayStart.getFullYear() + 1, 0, 1);
      title = chartMetric === "sales" ? "Havi ertekesites" : "Havi rendelesek";
      rangeLabel = String(selectedDayStart.getFullYear());
      labelEvery = 1;
      buckets = Array.from({ length: 12 }, (_, month) => ({
        label: new Date(selectedDayStart.getFullYear(), month, 1).toLocaleDateString(undefined, {
          month: "short",
        }),
        value: 0,
      }));
      bucketIndex = (date) => date.getMonth();
    }

    orders.forEach((order) => {
      const createdAt = new Date(order.createdAt);
      if (createdAt < rangeStart || createdAt >= rangeEnd) return;
      const index = bucketIndex(createdAt);
      if (!buckets[index]) return;
      if (chartMetric === "orders") {
        buckets[index].value += 1;
      } else {
        buckets[index].value += order.items.reduce((sum, item) => {
          if (typeof item.price !== "number" || Number.isNaN(item.price)) return sum;
          return sum + item.price * Math.max(0, item.quantity);
        }, 0);
      }
    });

    return { buckets, labelEvery, metric: chartMetric, rangeLabel, title };
  }, [chartDate, chartMetric, chartView, orders]);

  const chart = useMemo(() => {
    const width = 1000;
    const height = 300;
    const paddingX = 36;
    const paddingY = 30;
    const labelYOffset = 20;
    const valueOffset = 10;
    const maxValue = Math.max(1, ...salesChart.buckets.map((bucket) => bucket.value));

    const lastIndex = Math.max(0, salesChart.buckets.length - 1);
    const points = salesChart.buckets.map((bucket, index) => {
      const x = paddingX + (index / Math.max(1, lastIndex)) * (width - paddingX * 2);
      const value = bucket.value;
      const y = paddingY + (1 - value / maxValue) * (height - paddingY * 2);
      const showDateLabel =
        index === 0 || index === lastIndex || index % salesChart.labelEvery === 0;
      return {
        x,
        y,
        value,
        valueLabel: formatChartValue(value, salesChart.metric),
        dateLabel: bucket.label,
        showValueLabel: value > 0 && (salesChart.buckets.length <= 24 || showDateLabel),
        showDateLabel,
      };
    });

    const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");

    return { width, height, paddingX, paddingY, labelYOffset, valueOffset, points, polyline };
  }, [salesChart]);

  const hourlyAverageSales = useMemo(() => {
    const { start: selectedDayStart, end: selectedDayEnd } = toDayRange(hourlyChartDate);
    let rangeStart = selectedDayStart;
    let rangeEnd = selectedDayEnd;
    let rangeLabel = selectedDayStart.toLocaleDateString();

    if (hourlyChartView === "weekly") {
      rangeStart = startOfWeek(selectedDayStart);
      rangeEnd = endOfWeek(selectedDayStart);
      rangeLabel = `${rangeStart.toLocaleDateString()} - ${new Date(rangeEnd.getTime() - 1).toLocaleDateString()}`;
    } else if (hourlyChartView === "monthly") {
      rangeStart = new Date(selectedDayStart.getFullYear(), selectedDayStart.getMonth(), 1);
      rangeEnd = new Date(selectedDayStart.getFullYear(), selectedDayStart.getMonth() + 1, 1);
      rangeLabel = selectedDayStart.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      });
    } else if (hourlyChartView === "yearly") {
      rangeStart = new Date(selectedDayStart.getFullYear(), 0, 1);
      rangeEnd = new Date(selectedDayStart.getFullYear() + 1, 0, 1);
      rangeLabel = String(selectedDayStart.getFullYear());
    }

    const hourlyTotals = new Array(17).fill(0);
    const activeDays = new Set<string>();

    orders.forEach((order) => {
      const createdAt = new Date(order.createdAt);
      if (createdAt < rangeStart || createdAt >= rangeEnd) return;
      activeDays.add(toDateInputValue(createdAt));
      const hourIndex = createdAt.getHours() - 7;
      if (hourIndex < 0 || hourIndex >= hourlyTotals.length) return;
      if (hourlyChartMetric === "orders") {
        hourlyTotals[hourIndex] += 1;
      } else {
        hourlyTotals[hourIndex] += order.items.reduce((sum, item) => {
          if (typeof item.price !== "number" || Number.isNaN(item.price)) return sum;
          return sum + item.price * Math.max(0, item.quantity);
        }, 0);
      }
    });

    const averagingDays = hourlyChartView === "daily" ? 1 : Math.max(1, activeDays.size);
    const buckets = hourlyTotals.map((total, index) => ({
      label: `${String(index + 7).padStart(2, "0")}:00`,
      value: total / averagingDays,
    }));

    return {
      averagingDays,
      buckets,
      metric: hourlyChartMetric,
      rangeLabel,
      subtitle:
        hourlyChartView === "daily"
          ? "Kivalasztott nap"
          : `${averagingDays.toLocaleString()} aktiv nap atlaga`,
    };
  }, [hourlyChartDate, hourlyChartMetric, hourlyChartView, orders]);

  const hourlyBarChart = useMemo(() => {
    const width = 1000;
    const height = 320;
    const paddingX = 42;
    const paddingTop = 42;
    const paddingBottom = 48;
    const baseline = height - paddingBottom;
    const chartHeight = baseline - paddingTop;
    const slotWidth = (width - paddingX * 2) / hourlyAverageSales.buckets.length;
    const barWidth = slotWidth * 0.62;
    const maxValue = Math.max(1, ...hourlyAverageSales.buckets.map((bucket) => bucket.value));
    const bars = hourlyAverageSales.buckets.map((bucket, index) => {
      const barHeight = (bucket.value / maxValue) * chartHeight;
      return {
        ...bucket,
        barHeight,
        labelX: paddingX + slotWidth * index + slotWidth / 2,
        x: paddingX + slotWidth * index + (slotWidth - barWidth) / 2,
        y: baseline - barHeight,
      };
    });

    return { bars, barWidth, baseline, height, paddingX, width };
  }, [hourlyAverageSales]);

  return (
    <StatsGate>
      <section className="space-y-8">
        <div className="rounded-2xl border border-accent-3/60 bg-accent-2/70 px-4 py-3 text-sm text-contrast/70 shadow-sm">
          {isLoading ? "Statisztika szinkronizalasa..." : "Statisztika attekintes"}
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="rounded-3xl border border-accent-3/60 bg-accent-1/80 p-6 shadow-lg shadow-accent-4/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand/70">Osszesen</p>
                <h2 className="text-xl font-semibold text-contrast">Osszesitett teljesitmeny</h2>
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-accent-3/60 bg-primary/70 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-contrast/60">
                  Osszes ertekesites
                </p>
                <p className="mt-2 text-2xl font-semibold text-contrast">
                  {formatCurrency(allTime.totalSales)}
                </p>
              </div>
              <div className="rounded-2xl border border-accent-3/60 bg-primary/70 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-contrast/60">
                  Eladott tetelek
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
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand/70">Ezen a heten</p>
                <h2 className="text-xl font-semibold text-contrast">{weekLabel}</h2>
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-accent-3/60 bg-primary/70 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-contrast/60">
                  Osszes ertekesites
                </p>
                <p className="mt-2 text-2xl font-semibold text-contrast">
                  {formatCurrency(thisWeek.totalSales)}
                </p>
                <p
                  className={`mt-2 text-xs font-semibold uppercase tracking-wide ${salesDeltaMeta.className}`}
                >
                  {salesDeltaMeta.arrow}{" "}
                  {salesDelta === 0
                    ? "Nincs valtozas"
                    : `${salesDelta > 0 ? "+" : "-"}${formatCurrency(Math.abs(salesDelta))}`}{" "}
                  az elozo hethez kepest
                </p>
              </div>
              <div className="rounded-2xl border border-accent-3/60 bg-primary/70 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-contrast/60">
                  Eladott tetelek
                </p>
                <p className="mt-2 text-2xl font-semibold text-contrast">
                  {thisWeek.itemsSold.toLocaleString()}
                </p>
                <p
                  className={`mt-2 text-xs font-semibold uppercase tracking-wide ${itemsDeltaMeta.className}`}
                >
                  {itemsDeltaMeta.arrow}{" "}
                  {itemsDelta === 0
                    ? "Nincs valtozas"
                    : `${itemsDelta > 0 ? "+" : "-"}${Math.abs(itemsDelta).toLocaleString()}`}{" "}
                  az elozo hethez kepest
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-accent-3/60 bg-accent-1/80 p-6 shadow-lg shadow-accent-4/20">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand/70">
                  Kivalasztott nap
                </p>
                <h2 className="text-xl font-semibold text-contrast">{selectedDayLabel}</h2>
              </div>
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-contrast/60">
                Nap
                <input
                  type="date"
                  value={selectedDate}
                  max={todayDate}
                  onChange={(event) => setSelectedDate(event.target.value || todayDate)}
                  className="rounded-xl border border-accent-3/70 bg-primary/80 px-3 py-2 text-sm font-medium text-contrast"
                />
              </label>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-accent-3/60 bg-primary/70 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-contrast/60">
                  Osszes ertekesites
                </p>
                <p className="mt-2 text-2xl font-semibold text-contrast">
                  {formatCurrency(selectedDay.totalSales)}
                </p>
              </div>
              <div className="rounded-2xl border border-accent-3/60 bg-primary/70 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-contrast/60">
                  Eladott tetelek
                </p>
                <p className="mt-2 text-2xl font-semibold text-contrast">
                  {selectedDay.itemsSold.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-accent-3/60 bg-accent-1/80 p-6 shadow-lg shadow-accent-4/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand/70">
                Ertekesitesi bontas
              </p>
              <h2 className="text-xl font-semibold text-contrast">{salesChart.title}</h2>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-contrast/60">
                {salesChart.rangeLabel}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <ChartPeriodPicker
                view={chartView}
                value={chartDate}
                maxDate={todayDate}
                onChange={setChartDate}
              />
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Diagram idoszak"
              >
                {chartViewOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={chartView === option.value}
                    onClick={() => setChartView(option.value)}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                      chartView === option.value
                        ? "border-brand bg-brand text-white shadow-md shadow-brand/30"
                        : "border-accent-3/70 bg-primary/70 text-contrast/70 hover:border-brand/50 hover:text-brand"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Diagram mertekegyseg"
              >
                {chartMetricOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={chartMetric === option.value}
                    onClick={() => setChartMetric(option.value)}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                      chartMetric === option.value
                        ? "border-brand bg-brand text-white shadow-md shadow-brand/30"
                        : "border-accent-3/70 bg-primary/70 text-contrast/70 hover:border-brand/50 hover:text-brand"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-accent-3/60 bg-primary/70 p-4">
            <svg
              viewBox={`0 0 ${chart.width} ${chart.height}`}
              className="h-72 w-full"
              role="img"
              aria-label={`${salesChart.title} grafikon`}
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
                  <circle cx={point.x} cy={point.y} r="3" fill="currentColor" opacity={0.85}>
                    <title>{`${point.dateLabel}: ${point.valueLabel}`}</title>
                  </circle>
                  {point.showValueLabel ? (
                    <text
                      x={point.x + 8}
                      y={Math.max(chart.paddingY, point.y - chart.valueOffset)}
                      fontSize="10"
                      fill="currentColor"
                      opacity="0.7"
                    >
                      {point.valueLabel}
                    </text>
                  ) : null}
                  {point.showDateLabel ? (
                    <text
                      x={point.x}
                      y={chart.height - chart.paddingY + chart.labelYOffset}
                      textAnchor="middle"
                      fontSize="9"
                      fill="currentColor"
                      opacity="0.55"
                      transform={`rotate(-45 ${point.x} ${chart.height - chart.paddingY + chart.labelYOffset})`}
                    >
                      {point.dateLabel}
                    </text>
                  ) : null}
                </g>
              ))}
            </svg>
          </div>
        </div>

        <div className="rounded-3xl border border-accent-3/60 bg-accent-1/80 p-6 shadow-lg shadow-accent-4/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand/70">
                Orankenti atlag
              </p>
              <h2 className="text-xl font-semibold text-contrast">
                {hourlyAverageSales.metric === "sales"
                  ? "Atlagos orankenti ertekesites"
                  : "Atlagos orankenti rendelesek"}
              </h2>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-contrast/60">
                {hourlyAverageSales.rangeLabel} · {hourlyAverageSales.subtitle}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <ChartPeriodPicker
                view={hourlyChartView}
                value={hourlyChartDate}
                maxDate={todayDate}
                onChange={setHourlyChartDate}
              />
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Orankenti atlag idoszak"
              >
                {chartViewOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={hourlyChartView === option.value}
                    onClick={() => setHourlyChartView(option.value)}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                      hourlyChartView === option.value
                        ? "border-brand bg-brand text-white shadow-md shadow-brand/30"
                        : "border-accent-3/70 bg-primary/70 text-contrast/70 hover:border-brand/50 hover:text-brand"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Orankenti atlag mertekegyseg"
              >
                {chartMetricOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={hourlyChartMetric === option.value}
                    onClick={() => setHourlyChartMetric(option.value)}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                      hourlyChartMetric === option.value
                        ? "border-brand bg-brand text-white shadow-md shadow-brand/30"
                        : "border-accent-3/70 bg-primary/70 text-contrast/70 hover:border-brand/50 hover:text-brand"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-accent-3/60 bg-primary/70 p-4">
            <svg
              viewBox={`0 0 ${hourlyBarChart.width} ${hourlyBarChart.height}`}
              className="h-80 min-w-[760px] w-full"
              role="img"
              aria-label={`Atlagos orankenti ${
                hourlyAverageSales.metric === "sales" ? "ertekesites" : "rendelesek"
              } oszlopdiagram`}
            >
              <line
                x1={hourlyBarChart.paddingX}
                y1={hourlyBarChart.baseline}
                x2={hourlyBarChart.width - hourlyBarChart.paddingX}
                y2={hourlyBarChart.baseline}
                stroke="currentColor"
                strokeOpacity="0.18"
              />
              <g className="text-brand">
                {hourlyBarChart.bars.map((bar) => {
                  const renderedHeight = Math.max(1, bar.barHeight);
                  const renderedY = hourlyBarChart.baseline - renderedHeight;
                  return (
                    <g key={bar.label}>
                      <rect
                        x={bar.x}
                        y={renderedY}
                        width={hourlyBarChart.barWidth}
                        height={renderedHeight}
                        rx="6"
                        fill="currentColor"
                        opacity={bar.value > 0 ? 0.78 : 0.18}
                      >
                        <title>{`${bar.label}: ${formatChartValue(
                          bar.value,
                          hourlyAverageSales.metric,
                          true
                        )}`}</title>
                      </rect>
                      {bar.value > 0 ? (
                        <text
                          x={bar.labelX}
                          y={Math.max(18, renderedY - 8)}
                          textAnchor="middle"
                          fontSize="9"
                          fill="currentColor"
                        >
                          {bar.value.toFixed(2)}
                        </text>
                      ) : null}
                      <text
                        x={bar.labelX}
                        y={hourlyBarChart.baseline + 22}
                        textAnchor="middle"
                        fontSize="10"
                        fill="currentColor"
                        opacity="0.65"
                      >
                        {bar.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
        </div>

        <div className="rounded-3xl border border-accent-3/60 bg-accent-1/80 p-6 shadow-lg shadow-accent-4/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand/70">Eladott tetelek</p>
              <h2 className="text-xl font-semibold text-contrast">Osszesen, heti, napi nezet</h2>
            </div>
            <div className="text-xs font-semibold uppercase tracking-wide text-contrast/60">
              {selectedDayLabel}
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-accent-3/60 bg-primary/70">
            <div className="grid grid-cols-[1fr_110px_110px_110px] gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-contrast/60">
              <span>Tetel</span>
              <span className="text-right">Osszesen</span>
              <span className="text-right">Het</span>
              <span className="text-right">Nap</span>
            </div>
            <div className="max-h-[360px] overflow-y-auto">
              {itemStats.length === 0 ? (
                <div className="px-4 py-6 text-sm text-contrast/60">Meg nincs eladott tetel.</div>
              ) : (
                itemStats.map((item) => {
                  const delta = item.thisWeek - item.lastWeek;
                  const meta =
                    delta > 0
                      ? { arrow: "▲", className: "text-emerald-500" }
                      : delta < 0
                        ? { arrow: "▼", className: "text-rose-400" }
                        : { arrow: "—", className: "text-contrast/60" };
                  const deltaLabel =
                    delta === 0 ? "0" : `${delta > 0 ? "+" : ""}${delta.toLocaleString()}`;

                  return (
                    <div
                      key={item.name}
                      className="grid grid-cols-[1fr_110px_110px_110px] gap-2 border-t border-accent-3/60 px-4 py-3 text-sm text-contrast"
                    >
                      <span className="font-semibold">{item.name}</span>
                      <span className="text-right">{item.allTime.toLocaleString()}</span>
                      <span className={`text-right font-semibold ${meta.className}`}>
                        {meta.arrow} {item.thisWeek.toLocaleString()}{" "}
                        <span className="text-[11px] opacity-80">({deltaLabel})</span>
                      </span>
                      <span className="text-right font-semibold">{item.selectedDay.toLocaleString()}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-accent-3/60 bg-accent-1/80 p-6 shadow-lg shadow-accent-4/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand/70">Felhasznalt szoszok</p>
              <h2 className="text-xl font-semibold text-contrast">Osszesen, heti, napi nezet</h2>
            </div>
            <div className="text-xs font-semibold uppercase tracking-wide text-contrast/60">
              {selectedDayLabel}
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-accent-3/60 bg-primary/70">
            <div className="grid grid-cols-[1fr_110px_110px_110px] gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-contrast/60">
              <span>Szosz</span>
              <span className="text-right">Osszesen</span>
              <span className="text-right">Het</span>
              <span className="text-right">Nap</span>
            </div>
            <div className="max-h-[360px] overflow-y-auto">
              {sauceStats.length === 0 ? (
                <div className="px-4 py-6 text-sm text-contrast/60">Meg nincs felhasznalt szosz.</div>
              ) : (
                sauceStats.map((sauce) => {
                  const delta = sauce.thisWeek - sauce.lastWeek;
                  const meta =
                    delta > 0
                      ? { arrow: "▲", className: "text-emerald-500" }
                      : delta < 0
                        ? { arrow: "▼", className: "text-rose-400" }
                        : { arrow: "—", className: "text-contrast/60" };
                  const deltaLabel =
                    delta === 0 ? "0" : `${delta > 0 ? "+" : ""}${delta.toLocaleString()}`;

                  return (
                    <div
                      key={sauce.name}
                      className="grid grid-cols-[1fr_110px_110px_110px] gap-2 border-t border-accent-3/60 px-4 py-3 text-sm text-contrast"
                    >
                      <span className="font-semibold">{sauce.name}</span>
                      <span className="text-right">{sauce.allTime.toLocaleString()}</span>
                      <span className={`text-right font-semibold ${meta.className}`}>
                        {meta.arrow} {sauce.thisWeek.toLocaleString()}{" "}
                        <span className="text-[11px] opacity-80">({deltaLabel})</span>
                      </span>
                      <span className="text-right font-semibold">{sauce.selectedDay.toLocaleString()}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>
    </StatsGate>
  );
};

export default Stats;

