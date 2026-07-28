import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useOrders } from "../features/orders/OrdersContext";
import { useSessions } from "../features/sessions/SessionsContext";

const formatCurrency = (value: number) => `EUR ${value.toFixed(2)}`;
const TAKEAWAY_VALUE = "Takeaway";
const TAKEAWAY_LABEL = "Elvitel";
const NO_SAUCE_VALUE = "No sauce";
const NO_SIDE_VALUE = "No side";
const MODIFIER_LABELS = {
  Sauce: "SzÃ³sz",
  Side: "KÃ¶ret",
  Extras: "ExtrÃ¡k",
} as const;
const MODIFIER_VALUE_LABELS = {
  [NO_SAUCE_VALUE]: "SzÃ³sz nÃ©lkÃ¼l",
  [NO_SIDE_VALUE]: "KÃ¶ret nÃ©lkÃ¼l",
} as const;

const formatModifierGroup = (group: string) =>
  MODIFIER_LABELS[group as keyof typeof MODIFIER_LABELS] ?? group;
const formatModifierValue = (value: string) =>
  MODIFIER_VALUE_LABELS[value as keyof typeof MODIFIER_VALUE_LABELS] ?? value;
const isTakeaway = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === TAKEAWAY_VALUE.toLowerCase() ||
    normalized === TAKEAWAY_LABEL.toLowerCase()
  );
};

const formatModifierLines = (modifiers?: Record<string, string[]>) => {
  if (!modifiers) return [];
  return Object.entries(modifiers)
    .map(([group, values]) => {
      if (!values || values.length === 0) return null;
      const label = formatModifierGroup(group);
      const displayValues = values.map((value) => formatModifierValue(value));
      return `${label}: ${displayValues.join(", ")}`;
    })
    .filter(Boolean) as string[];
};

const Tables = () => {
  const { orders, isLoading, error } = useOrders();
  const { sessions, closeSession } = useSessions();
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const portalTarget = typeof document !== "undefined" ? document.body : null;

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
  const takeawayLabel = TAKEAWAY_LABEL;

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
  const takeawayGroup = tableMap.get(TAKEAWAY_VALUE) ?? tableMap.get(TAKEAWAY_LABEL) ?? null;
  const takeawayKey = takeawayGroup?.table ?? TAKEAWAY_VALUE;

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
            Asztal Ã¡ttekintÃ©s
          </p>
          <h1 className="text-3xl font-bold text-contrast sm:text-4xl">
            NÃ©zd meg, mit rendelt minden asztal.
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-contrast/75">
            AktÃ­v rendelÃ©sek asztalonkÃ©nt, Ã¶sszesÃ­tÃ©ssel Ã©s mÃ³dosÃ­tÃ³kkal.
          </p>
        </div>
        <div className="rounded-2xl border border-accent-3/60 bg-accent-2/70 px-4 py-3 text-sm text-contrast/70 shadow-sm">
          {isLoading ? "RendelÃ©sek szinkronizÃ¡lÃ¡sa..." : `${tableGroups.length} aktÃ­v asztal`}
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="rounded-3xl border border-accent-3/60 bg-accent-1/80 p-6 shadow-lg shadow-accent-4/20">
        <h2 className="text-lg font-semibold text-contrast">AsztaltÃ©rkÃ©p</h2>
        {tableGroups.length === 0 ? (
          <p className="mt-4 text-sm text-contrast/60">Jelenleg nincs aktÃ­v asztal.</p>
        ) : (
          <p className="mt-2 text-xs text-contrast/60">
            Ã‰rints meg egy asztalt az Ã¶sszegzÃ©shez.
          </p>
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
              if (!takeawayGroup) return;
              setSelectedTable(takeawayKey);
            }}
            className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
              selectedTable && isTakeaway(selectedTable)
                ? "border-brand/60 bg-brand text-white shadow-md shadow-brand/40"
                : takeawayGroup
                  ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100 hover:border-brand/50 hover:text-brand"
                  : "border-accent-3/60 bg-primary/70 text-contrast/40"
            }`}
            disabled={!takeawayGroup}
          >
            {takeawayLabel}
          </button>
        </div>
      </div>

      {selectedGroup && portalTarget
        ? createPortal(
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-primary/60 backdrop-blur-lg p-4">
          <button
            type="button"
            aria-label="BezÃ¡rÃ¡s"
            className="absolute inset-0"
            onClick={() => setSelectedTable(null)}
          />
          <div className="relative z-10 flex w-full max-w-2xl max-h-[85vh] flex-col overflow-hidden rounded-3xl border border-accent-3/60 bg-primary p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand/70">
                  Asztal rÃ©szletei
                </p>
                <h2 className="text-2xl font-semibold text-contrast">
                  {isTakeaway(selectedGroup.table)
                    ? takeawayLabel
                    : `Asztal ${selectedGroup.table}`}
                </h2>
                <p className="mt-1 text-xs text-contrast/60">
                  {selectedGroup.ordersCount} rendelÃ©s
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
                  className="rounded-full border border-amber-400/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-900 transition hover:border-amber-500 hover:text-amber-950 dark:text-amber-100 dark:hover:border-amber-300 dark:hover:text-amber-50"
                >
                  SzÃ¡mla lezÃ¡rÃ¡sa
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTable(null)}
                  className="rounded-full border border-accent-3/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-contrast/70 transition hover:border-brand/50 hover:text-brand"
                >
                  BezÃ¡rÃ¡s
                </button>
              </div>
            </div>

            <div className="mt-6 grid flex-1 min-h-0 gap-6 overflow-hidden lg:grid-cols-[1.2fr_0.8fr]">
              <section className="no-scrollbar min-h-0 space-y-3 overflow-y-auto pr-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-contrast/70">
                  RÃ©szletes tÃ©telek
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
                    <span>Ã–sszesen</span>
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
                    Ã–sszegzÃ©s
                  </h3>
                  {summaryLines.length === 0 ? (
                    <p className="text-sm text-contrast/60">Nincs tÃ©tel ezen az asztalon.</p>
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
                            KÃ³d {line.registerCode ?? "â€”"}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </div>
        </div>,
            portalTarget
          )
        : null}
    </section>
  );
};

export default Tables;
