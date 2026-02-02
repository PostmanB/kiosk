import { useMemo, useState } from "react";
import { useOrders } from "../features/orders/OrdersContext";
import { useSessions } from "../features/sessions/SessionsContext";

const formatCurrency = (value: number) => `EUR ${value.toFixed(2)}`;

const formatModifierLines = (modifiers?: Record<string, string[]>) => {
  if (!modifiers) return [];
  return Object.entries(modifiers)
    .map(([group, values]) => {
      if (!values || values.length === 0) return null;
      return `${group}: ${values.join(", ")}`;
    })
    .filter(Boolean) as string[];
};

const Tables = () => {
  const { orders, isLoading, error } = useOrders();
  const { sessions, closeSession } = useSessions();
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const tableLayout = useMemo(
    () => [
      { id: "1", x: 44, y: 4, w: 12, h: 20 },
      { id: "2", x: 6, y: 30, w: 12, h: 12 },
      { id: "3", x: 22, y: 28, w: 24, h: 14 },
      { id: "4", x: 6, y: 48, w: 12, h: 12 },
      { id: "5", x: 22, y: 48, w: 24, h: 14 },
      { id: "6", x: 58, y: 28, w: 26, h: 10 },
      { id: "7", x: 58, y: 40, w: 26, h: 10 },
      { id: "8", x: 58, y: 52, w: 26, h: 10 },
      { id: "9", x: 64, y: 68, w: 18, h: 10 },
      { id: "10", x: 64, y: 80, w: 18, h: 14 },
    ],
    []
  );
  const takeawayLabel = "Takeaway";

  const tableGroups = useMemo(() => {
    const openSessions = sessions.filter((session) => session.status === "open");
    return openSessions
      .map((session) => {
        const sessionOrders = orders.filter(
          (order) =>
            order.sessionId === session.id ||
            (order.sessionId == null && order.table === session.table)
        );
        const items = sessionOrders.flatMap((order) => order.items);
        return {
          table: session.table,
          sessionId: session.id,
          items,
          ordersCount: sessionOrders.length,
          latest: session.openedAt,
        };
      })
      .sort((a, b) => a.table.localeCompare(b.table));
  }, [orders, sessions]);

  const tableMap = useMemo(() => {
    const map = new Map<string, (typeof tableGroups)[number]>();
    tableGroups.forEach((group) => map.set(group.table, group));
    return map;
  }, [tableGroups]);

  const selectedGroup = selectedTable ? tableMap.get(selectedTable) : null;
  const summaryLines = useMemo(() => {
    if (!selectedGroup) return [];
    const map = new Map<
      string,
      { name: string; registerCode: string | null; quantity: number }
    >();
    selectedGroup.items.forEach((item) => {
      const code = item.registerCode ?? null;
      const key = `${item.name}__${code ?? "none"}`;
      const existing = map.get(key);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        map.set(key, { name: item.name, registerCode: code, quantity: item.quantity });
      }
    });
    return Array.from(map.values());
  }, [selectedGroup]);

  return (
    <section className="space-y-10">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand/70">
            Table Overview
          </p>
          <h1 className="text-3xl font-bold text-contrast sm:text-4xl">
            See what each table ordered.
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-contrast/75">
            Active orders grouped by table with totals and modifiers.
          </p>
        </div>
        <div className="rounded-2xl border border-accent-3/60 bg-accent-2/70 px-4 py-3 text-sm text-contrast/70 shadow-sm">
          {isLoading ? "Syncing orders..." : `${tableGroups.length} tables active`}
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="rounded-3xl border border-accent-3/60 bg-accent-1/80 p-6 shadow-lg shadow-accent-4/20">
        <h2 className="text-lg font-semibold text-contrast">Table map</h2>
        {tableGroups.length === 0 ? (
          <p className="mt-4 text-sm text-contrast/60">No active tables right now.</p>
        ) : (
          <p className="mt-2 text-xs text-contrast/60">Tap a table to view its order summary.</p>
        )}
        <div className="mt-4 rounded-3xl border border-accent-3/60 bg-primary/70 p-4">
          <div className="relative h-[320px] w-full max-w-2xl">
            {tableLayout.map((entry) => {
              const group = tableMap.get(entry.id);
              const isActive = Boolean(group);
              const isSelected = selectedTable === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    if (!isActive) return;
                    setSelectedTable(entry.id);
                  }}
                  className={`absolute flex items-center justify-center rounded-xl border text-sm font-semibold transition ${
                    isSelected
                      ? "border-brand/60 bg-brand text-white shadow-md shadow-brand/40"
                      : isActive
                        ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100 hover:border-brand/50 hover:text-brand"
                        : "border-accent-3/60 bg-primary/80 text-contrast/40"
                  }`}
                  style={{
                    left: `${entry.x}%`,
                    top: `${entry.y}%`,
                    width: `${entry.w}%`,
                    height: `${entry.h}%`,
                  }}
                  aria-pressed={isSelected}
                  disabled={!isActive}
                >
                  {entry.id}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              if (!tableMap.get(takeawayLabel)) return;
              setSelectedTable(takeawayLabel);
            }}
            className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
              selectedTable === takeawayLabel
                ? "border-brand/60 bg-brand text-white shadow-md shadow-brand/40"
                : tableMap.get(takeawayLabel)
                  ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100 hover:border-brand/50 hover:text-brand"
                  : "border-accent-3/60 bg-primary/70 text-contrast/40"
            }`}
            disabled={!tableMap.get(takeawayLabel)}
          >
            {takeawayLabel}
          </button>
        </div>
      </div>

      {selectedGroup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/70 backdrop-blur p-4">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0"
            onClick={() => setSelectedTable(null)}
          />
          <div className="relative z-10 flex w-full max-w-2xl max-h-[85vh] flex-col overflow-hidden rounded-3xl border border-accent-3/60 bg-primary p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand/70">
                  Table details
                </p>
                <h2 className="text-2xl font-semibold text-contrast">
                  {selectedGroup.table === takeawayLabel
                    ? takeawayLabel
                    : `Table ${selectedGroup.table}`}
                </h2>
                <p className="mt-1 text-xs text-contrast/60">
                  {selectedGroup.ordersCount} order
                  {selectedGroup.ordersCount === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!selectedGroup?.sessionId) return;
                    await closeSession(selectedGroup.sessionId);
                    setSelectedTable(null);
                  }}
                  className="rounded-full border border-amber-400/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-100 transition hover:border-amber-300 hover:text-amber-50"
                >
                  Close bill
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTable(null)}
                  className="rounded-full border border-accent-3/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-contrast/70 transition hover:border-brand/50 hover:text-brand"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="mt-6 grid flex-1 min-h-0 gap-6 overflow-hidden lg:grid-cols-[1.2fr_0.8fr]">
              <section className="no-scrollbar min-h-0 space-y-3 overflow-y-auto pr-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-contrast/70">
                  Detailed items
                </h3>
                <div className="space-y-3">
                  {selectedGroup.items.map((item, index) => {
                    const modifierLines = formatModifierLines(item.modifiers);
                    return (
                      <div
                        key={`${selectedGroup.table}-${index}`}
                        className="rounded-2xl border border-accent-3/60 bg-accent-1/80 p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold">
                            {item.quantity} x {item.name}
                          </span>
                          {typeof item.price === "number" ? (
                            <span className="text-[11px] text-contrast/60">
                              {formatCurrency(item.price * item.quantity)}
                            </span>
                          ) : null}
                        </div>
                        {modifierLines.length ? (
                          <div className="mt-1 space-y-1 text-[11px] text-contrast/60">
                            {modifierLines.map((line) => (
                              <div key={line}>{line}</div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>

              <aside className="no-scrollbar min-h-0 space-y-4 overflow-y-auto pr-2">
                <div className="rounded-2xl border border-accent-3/60 bg-primary/70 px-4 py-3 text-sm text-contrast/70">
                  <div className="flex items-center justify-between">
                    <span>Total</span>
                    <span className="text-base font-semibold text-contrast">
                      {formatCurrency(
                        selectedGroup.items.reduce(
                          (sum, item) => sum + (item.price ?? 0) * item.quantity,
                          0
                        )
                      )}
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-contrast/70">
                    Summary
                  </h3>
                  {summaryLines.length === 0 ? (
                    <p className="text-sm text-contrast/60">No items in this table.</p>
                  ) : (
                    <div className="space-y-2">
                      {summaryLines.map((line) => (
                        <div
                          key={`${line.name}-${line.registerCode ?? "none"}`}
                          className="rounded-2xl border border-accent-3/60 bg-primary/70 px-4 py-3 text-sm text-contrast"
                        >
                          <p className="font-semibold">
                            {line.quantity}x {line.name}
                          </p>
                          <p className="text-xs text-contrast/60">
                            Code {line.registerCode ?? "—"}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default Tables;
