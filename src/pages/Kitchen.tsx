import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useOrders } from "../features/orders/OrdersContext";

const statusStyles: Record<"new" | "served", string> = {
  new: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
  served: "border-slate-500/30 bg-slate-500/15 text-slate-300",
};

const formatCurrency = (value: number) => `EUR ${value.toFixed(2)}`;

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const formatBillLabel = (value: string) => (value === "Takeaway" ? "Takeaway" : `Bill ${value}`);

type ModifierLine = {
  text: string;
  isExtra: boolean;
};

const formatModifierLines = (modifiers?: Record<string, string[]>) => {
  if (!modifiers) return [];
  return Object.entries(modifiers)
    .flatMap(([group, values]) => {
      if (!values || values.length === 0) return [];
      return [
        {
          text: `${group}: ${values.join(", ")}`,
          isExtra: /extra/i.test(group),
        },
      ];
    })
    .filter(Boolean) as ModifierLine[];
};

const Kitchen = () => {
  const { orders, updateStatus, updateItemDone, removeOrder, clearServed, isLoading, error } =
    useOrders();
  const [showServed, setShowServed] = useState(false);

  const groupedOrders = useMemo(
    () => ({
      new: orders.filter((order) => order.status !== "served").slice().reverse(),
      served: orders.filter((order) => order.status === "served").slice().reverse(),
    }),
    [orders]
  );

  const handleMarkServed = async (orderId: string) => {
    await updateStatus(orderId, "served");
    toast("Marked as served.", { type: "success" });
  };

  return (
    <section className="space-y-10">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setShowServed((prev) => !prev)}
          className="inline-flex items-center justify-center rounded-full border border-accent-3/60 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-contrast/70 transition hover:border-brand/50 hover:text-brand"
        >
          {showServed ? "Hide served" : `Show served (${groupedOrders.served.length})`}
        </button>
        {showServed ? (
          <button
            type="button"
            onClick={clearServed}
            disabled={isLoading || groupedOrders.served.length === 0}
            className="inline-flex items-center justify-center rounded-full border border-accent-3/60 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-contrast/70 transition hover:border-brand/50 hover:text-brand disabled:cursor-not-allowed disabled:opacity-60"
          >
            Clear served
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="space-y-8">
        <section className="rounded-3xl border border-accent-3/60 bg-accent-1/80 p-6 shadow-lg shadow-accent-4/20">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-contrast">New Orders</h2>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                statusStyles.new
              }`}
            >
              {groupedOrders.new.length} orders
            </span>
          </div>
          <div className="mt-4 space-y-4">
            {groupedOrders.new.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-accent-3/60 bg-primary/70 p-4 text-sm text-contrast/60">
                No new orders right now.
              </p>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {groupedOrders.new.map((order) => {
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
                      className="flex w-[320px] flex-shrink-0 flex-col gap-4 rounded-3xl border-2 border-dashed border-accent-3/60 bg-primary/80 p-5 text-sm text-contrast shadow-lg shadow-accent-4/20"
                    >
                      <button
                        type="button"
                        onClick={() => handleMarkServed(order.id)}
                        className="w-full rounded-full bg-brand px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow shadow-brand/40 transition hover:-translate-y-0.5"
                      >
                        Mark served
                      </button>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold">{formatBillLabel(order.table)}</p>
                          <p className="text-xs text-contrast/60">
                            Placed {formatTime(order.createdAt)} • {doneCount}/{itemCount} done
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
                            No kitchen items for this order.
                          </li>
                        ) : (
                          displayItems.map(({ item, index }) => {
                            const modifierLines = formatModifierLines(item.modifiers);
                            return (
                              <li key={`${order.id}-${index}`} className="space-y-1">
                                <div className="flex items-center justify-between gap-3">
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
                                    <span
                                      className={item.done ? "text-contrast/50 line-through" : ""}
                                    >
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

        {showServed ? (
          <section className="rounded-3xl border border-accent-3/60 bg-accent-1/80 p-6 shadow-lg shadow-accent-4/20">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-contrast">Served</h2>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                  statusStyles.served
                }`}
              >
                {groupedOrders.served.length} orders
              </span>
            </div>
            <div className="mt-4 space-y-4">
              {groupedOrders.served.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-accent-3/60 bg-primary/70 p-4 text-sm text-contrast/60">
                  No served orders right now.
                </p>
              ) : (
                <div className="flex gap-4 overflow-x-auto pb-4">
                  {groupedOrders.served.map((order) => {
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
                        className="flex w-[320px] flex-shrink-0 flex-col gap-4 rounded-3xl border border-accent-3/60 bg-primary/70 p-5 text-sm text-contrast"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                          <p className="text-lg font-semibold">{formatBillLabel(order.table)}</p>
                          <p className="text-xs text-contrast/60">
                            Served {formatTime(order.createdAt)} • {doneCount}/{itemCount} done
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
                              No kitchen items for this order.
                            </li>
                          ) : (
                            displayItems.map(({ item, index }) => {
                              const modifierLines = formatModifierLines(item.modifiers);
                              return (
                                <li key={`${order.id}-${index}`} className="space-y-1">
                                  <div className="flex items-center justify-between gap-3">
                                    <span
                                      className={
                                        item.done ? "text-contrast/50 line-through" : ""
                                      }
                                    >
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
                        <button
                          type="button"
                          onClick={() => removeOrder(order.id)}
                          className="mt-auto rounded-full border border-rose-500/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-rose-300 transition hover:bg-rose-500/10"
                        >
                          Remove
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
};

export default Kitchen;
