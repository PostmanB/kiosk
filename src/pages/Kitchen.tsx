import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import { useOrders } from "../features/orders/OrdersContext";
import useLockBodyScroll from "../hooks/useLockBodyScroll";

const statusStyles = {
  new: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
} as const;

const formatCurrency = (value: number) => `EUR ${value.toFixed(2)}`;

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const TAKEAWAY_VALUE = "Takeaway";
const TAKEAWAY_LABEL = "Elvitel";
const NO_SAUCE_VALUE = "No sauce";
const NO_SIDE_VALUE = "No side";
const MODIFIER_LABELS = {
  Sauce: "Szósz",
  Side: "Köret",
  Extras: "Extrák",
} as const;
const MODIFIER_VALUE_LABELS = {
  [NO_SAUCE_VALUE]: "Szósz nélkül",
  [NO_SIDE_VALUE]: "Köret nélkül",
} as const;

const formatModifierGroup = (group: string) =>
  MODIFIER_LABELS[group as keyof typeof MODIFIER_LABELS] ?? group;
const formatModifierValue = (value: string) =>
  MODIFIER_VALUE_LABELS[value as keyof typeof MODIFIER_VALUE_LABELS] ?? value;
const isExtraGroup = (group: string) => /extra|extrá/i.test(group);
const isTakeaway = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === TAKEAWAY_VALUE.toLowerCase() ||
    normalized === TAKEAWAY_LABEL.toLowerCase()
  );
};

const formatBillLabel = (value: string) =>
  isTakeaway(value) ? TAKEAWAY_LABEL : `Számla ${value}`;
const formatTakeawayNumber = (value: number) => `#${String(value).padStart(3, "0")}`;

type ModifierLine = {
  text: string;
  isExtra: boolean;
};

const formatModifierLines = (modifiers?: Record<string, string[]>) => {
  if (!modifiers) return [];
  return Object.entries(modifiers)
    .flatMap(([group, values]) => {
      if (!values || values.length === 0) return [];
      const label = formatModifierGroup(group);
      const displayValues = values.map((value) => formatModifierValue(value));
      return [
        {
          text: `${label}: ${displayValues.join(", ")}`,
          isExtra: isExtraGroup(group),
        },
      ];
    })
    .filter(Boolean) as ModifierLine[];
};

const Kitchen = () => {
  const { orders, updateStatus, updateItemDone, removeOrder, error } = useOrders();
  const [showServed, setShowServed] = useState(false);
  const [exitingOrders, setExitingOrders] = useState<Record<string, boolean>>({});
  const portalTarget = typeof document !== "undefined" ? document.body : null;
  useLockBodyScroll(showServed);
  const exitDurationMs = 220;

  const servedToday = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return orders
      .filter((order) => {
        if (order.status !== "served") return false;
        const createdAt = new Date(order.createdAt);
        return createdAt >= start && createdAt < end;
      })
      .slice()
      .reverse();
  }, [orders]);

  const groupedOrders = useMemo(
    () => ({
      new: orders.filter((order) => order.status !== "served").slice().reverse(),
    }),
    [orders]
  );

  const takeawayNumberByOrderId = useMemo(() => {
    const countersByDay = new Map<string, number>();
    const map = new Map<string, number>();

    orders
      .filter((order) => isTakeaway(order.table))
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .forEach((order) => {
        const created = new Date(order.createdAt);
        const dayKey = `${created.getFullYear()}-${created.getMonth()}-${created.getDate()}`;
        const next = (countersByDay.get(dayKey) ?? 0) + 1;
        countersByDay.set(dayKey, next);
        map.set(order.id, next);
      });

    return map;
  }, [orders]);

  const markOrderExiting = (orderId: string) => {
    setExitingOrders((prev) => ({ ...prev, [orderId]: true }));
  };

  const clearOrderExiting = (orderId: string) => {
    setExitingOrders((prev) => {
      if (!prev[orderId]) return prev;
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleMarkServed = async (orderId: string) => {
    if (exitingOrders[orderId]) return;
    markOrderExiting(orderId);
    await sleep(exitDurationMs);
    await updateStatus(orderId, "served");
    clearOrderExiting(orderId);
    toast("Kiszolgáltnak jelölve.", { type: "success" });
  };

  const handleRemoveOrder = async (orderId: string) => {
    if (exitingOrders[orderId]) return;
    markOrderExiting(orderId);
    await sleep(exitDurationMs);
    await removeOrder(orderId);
    clearOrderExiting(orderId);
  };

  return (
    <section className="space-y-10">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setShowServed((prev) => !prev)}
          className="inline-flex items-center justify-center rounded-full border border-accent-3/60 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-contrast/70 transition hover:border-brand/50 hover:text-brand"
        >
          {showServed
            ? "Kiszolgáltak elrejtése"
            : `Kiszolgáltak megjelenítése (${servedToday.length})`}
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="space-y-8">
        <section className="rounded-3xl border border-accent-3/60 bg-accent-1/80 p-6 shadow-lg shadow-accent-4/20">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-contrast">Új rendelések</h2>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                statusStyles.new
              }`}
            >
              {groupedOrders.new.length} rendelés
            </span>
          </div>
          <div className="mt-4 space-y-4">
            {groupedOrders.new.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-accent-3/60 bg-primary/70 p-4 text-sm text-contrast/60">
                Jelenleg nincs új rendelés.
              </p>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {groupedOrders.new.map((order, index) => {
                  const isExiting = Boolean(exitingOrders[order.id]);
                  const animationClass = isExiting ? "animate-fly-out" : "animate-fly-in";
                  const flyStyle = {
                    "--fly-delay": `${index * 60}ms`,
                  } as CSSProperties;
                  const displayItems = order.items
                    .map((item, index) => ({ item, index }))
                    .filter(({ item }) => item.showInKitchen !== false);
                  const itemCount = displayItems.reduce(
                    (sum, entry) => sum + entry.item.quantity,
                    0
                  );
                  const doneCount = displayItems.reduce(
                    (sum, entry) => sum + (entry.item.done ? entry.item.quantity : 0),
                    0
                  );
                  const orderTotal = order.items.reduce(
                    (sum, item) => sum + (item.price ?? 0) * item.quantity,
                    0
                  );
                  const showTotal = order.items.some(
                    (item) => typeof item.price === "number" && !Number.isNaN(item.price)
                  );

                  return (
                    <article
                      key={order.id}
                      style={flyStyle}
                      className={`flex w-[320px] flex-shrink-0 flex-col gap-4 rounded-3xl border-2 border-dashed border-accent-3/60 bg-primary/80 p-5 text-sm text-contrast shadow-lg shadow-accent-4/20 ${animationClass} ${
                        isExiting ? "pointer-events-none" : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleMarkServed(order.id)}
                        disabled={isExiting}
                        className="w-full rounded-full bg-brand px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow shadow-brand/40 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        Kiszolgáltnak jelölés
                      </button>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold">
                            {isTakeaway(order.table)
                              ? `Elvitel ${formatTakeawayNumber(takeawayNumberByOrderId.get(order.id) ?? 1)}`
                              : formatBillLabel(order.table)}
                          </p>
                          <p className="text-xs text-contrast/60">
                            Feladva {formatTime(order.createdAt)} • {doneCount}/{itemCount} kész
                          </p>
                        </div>
                        {showTotal ? (
                          <span className="rounded-full border border-accent-3/60 px-2 py-1 text-xs font-semibold text-contrast/70">
                            {formatCurrency(orderTotal)}
                          </span>
                        ) : null}
                      </div>
                      <ul className="space-y-2 text-xs text-contrast/80">
                        {displayItems.length === 0 ? (
                          <li className="text-[11px] text-contrast/60">
                            Ehhez a rendeléshez nincs konyhai tétel.
                          </li>
                        ) : (
                          displayItems.map(({ item, index }) => {
                            const modifierLines = formatModifierLines(item.modifiers);
                            return (
                              <li key={`${order.id}-${index}`} className="space-y-1">
                                <div
                                  className={`relative flex items-center justify-between gap-3 ${
                                    item.done
                                      ? "text-contrast/50 after:content-[''] after:absolute after:left-8 after:right-0 after:top-1/2 after:border-t after:border-2 after:border-contrast/50"
                                      : ""
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => updateItemDone(order.id, index, !item.done)}
                                      className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold transition ${
                                        item.done
                                          ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-200"
                                          : "border-accent-3/60 text-contrast/60 hover:border-brand/50 hover:text-brand"
                                      }`}
                                      aria-pressed={item.done}
                                    >
                                      {item.done ? "✓" : ""}
                                    </button>
                                    <span>
                                      {item.quantity} x {item.name}
                                    </span>
                                  </div>
                                  {typeof item.price === "number" ? (
                                    <span className="text-[11px] text-contrast/60">
                                      {formatCurrency(item.price * item.quantity)}
                                    </span>
                                  ) : null}
                                </div>
                                {modifierLines.length ? (
                                  <div className="space-y-1 text-[11px]">
                                    {modifierLines.map((line) => (
                                      <div
                                        key={line.text}
                                        className={line.isExtra ? "text-rose-300" : "text-contrast/60"}
                                      >
                                        {line.text}
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </li>
                            );
                          })
                        )}
                      </ul>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {showServed && portalTarget
        ? createPortal(
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-primary/60 backdrop-blur-lg p-4">
              <button
                type="button"
                aria-label="Kiszolgált rendelések bezárása"
                className="absolute inset-0"
                onClick={() => setShowServed(false)}
              />
              <div className="relative z-10 flex w-full max-w-5xl max-h-[85vh] flex-col overflow-hidden rounded-3xl border border-accent-3/60 bg-primary p-6 shadow-2xl">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand/70">
                      Mai kiszolgáltak
                    </p>
                    <h2 className="text-2xl font-semibold text-contrast">Kiszolgált rendelések</h2>
                    <p className="mt-1 text-xs text-contrast/60">
                      {servedToday.length} rendelés kiszolgálva ma.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setShowServed(false)}
                      className="rounded-full border border-accent-3/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-contrast/70 transition hover:border-brand/50 hover:text-brand"
                    >
                      Bezárás
                    </button>
                  </div>
                </div>

                <div className="mt-6 flex-1 min-h-0">
                  {servedToday.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-accent-3/60 bg-primary/70 p-4 text-sm text-contrast/60">
                      Ma még nincs kiszolgált rendelés.
                    </p>
                  ) : (
                    <div className="flex gap-4 overflow-x-auto pb-4">
                      {servedToday.map((order, index) => {
                        const isExiting = Boolean(exitingOrders[order.id]);
                        const animationClass = isExiting ? "animate-fly-out" : "animate-fly-in";
                        const flyStyle = {
                          "--fly-delay": `${index * 60}ms`,
                        } as CSSProperties;
                        const displayItems = order.items
                          .map((item, index) => ({ item, index }))
                          .filter(({ item }) => item.showInKitchen !== false);
                        const itemCount = displayItems.reduce(
                          (sum, entry) => sum + entry.item.quantity,
                          0
                        );
                        const doneCount = displayItems.reduce(
                          (sum, entry) => sum + (entry.item.done ? entry.item.quantity : 0),
                          0
                        );
                        const orderTotal = order.items.reduce(
                          (sum, item) => sum + (item.price ?? 0) * item.quantity,
                          0
                        );
                        const showTotal = order.items.some(
                          (item) => typeof item.price === "number" && !Number.isNaN(item.price)
                        );

                        return (
                          <article
                            key={order.id}
                            style={flyStyle}
                            className={`flex w-[320px] flex-shrink-0 flex-col gap-4 rounded-3xl border border-accent-3/60 bg-primary/70 p-5 text-sm text-contrast ${animationClass} ${
                              isExiting ? "pointer-events-none" : ""
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-lg font-semibold">
                                  {isTakeaway(order.table)
                                    ? `Elvitel ${formatTakeawayNumber(takeawayNumberByOrderId.get(order.id) ?? 1)}`
                                    : formatBillLabel(order.table)}
                                </p>
                                <p className="text-xs text-contrast/60">
                                  Kiszolgálva {formatTime(order.createdAt)} • {doneCount}/{itemCount} kész
                                </p>
                              </div>
                              {showTotal ? (
                                <span className="rounded-full border border-accent-3/60 px-2 py-1 text-xs font-semibold text-contrast/70">
                                  {formatCurrency(orderTotal)}
                                </span>
                              ) : null}
                            </div>
                            <ul className="space-y-2 text-xs text-contrast/80">
                              {displayItems.length === 0 ? (
                                <li className="text-[11px] text-contrast/60">
                                  Ehhez a rendeléshez nincs konyhai tétel.
                                </li>
                              ) : (
                                displayItems.map(({ item, index }) => {
                                  const modifierLines = formatModifierLines(item.modifiers);
                                  return (
                                    <li key={`${order.id}-${index}`} className="space-y-1">
                                      <div
                                        className={`relative flex items-center justify-between gap-3 ${
                                          item.done
                                            ? "text-contrast/50 after:content-[''] after:absolute after:left-0 after:right-0 after:top-1/2 after:border-t after:border-2 after:border-contrast/50"
                                            : ""
                                        }`}
                                      >
                                        <span>
                                          {item.quantity} x {item.name}
                                        </span>
                                        {typeof item.price === "number" ? (
                                          <span className="text-[11px] text-contrast/60">
                                            {formatCurrency(item.price * item.quantity)}
                                          </span>
                                        ) : null}
                                      </div>
                                      {modifierLines.length ? (
                                        <div className="space-y-1 text-[11px]">
                                          {modifierLines.map((line) => (
                                            <div
                                              key={line.text}
                                              className={
                                                line.isExtra ? "text-rose-300" : "text-contrast/60"
                                              }
                                            >
                                              {line.text}
                                            </div>
                                          ))}
                                        </div>
                                      ) : null}
                                    </li>
                                  );
                                })
                              )}
                            </ul>
                            <button
                              type="button"
                              onClick={() => handleRemoveOrder(order.id)}
                              disabled={isExiting}
                              className="mt-auto rounded-full border border-rose-500/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-rose-300 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              Eltávolítás
                            </button>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>,
            portalTarget
          )
        : null}
    </section>
  );
};

export default Kitchen;
