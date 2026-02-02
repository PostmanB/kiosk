import { useMemo, useState } from "react";
import { useOrders } from "../features/orders/OrdersContext";

const statusStyles: Record<"new" | "served", string> = {
  new: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
  served: "border-slate-500/30 bg-slate-500/15 text-slate-300",
};

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const formatModifiers = (modifiers?: Record<string, string[]>) => {
  if (!modifiers) return "";
  const entries = Object.entries(modifiers)
    .map(([group, values]) => {
      if (!values || values.length === 0) return null;
      return `${group}: ${values.join(", ")}`;
    })
    .filter(Boolean);
  return entries.length ? entries.join(" | ") : "";
};

const Kitchen = () => {
  const { orders, updateStatus, removeOrder, clearServed, isLoading, error } = useOrders();
  const [showServed, setShowServed] = useState(false);

  const groupedOrders = useMemo(
    () => ({
      new: orders.filter((order) => order.status !== "served"),
      served: orders.filter((order) => order.status === "served"),
    }),
    [orders]
  );

  return (
    <section className="space-y-10">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand/70">
            Kitchen Display
          </p>
          <h1 className="text-3xl font-bold text-contrast sm:text-4xl">Track every ticket in one glance.</h1>
          <p className="mt-2 max-w-2xl text-sm text-contrast/75">
            Update statuses as meals move through the line. Orders stay visible until they are marked
            served.
          </p>
        </div>
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
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
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
              groupedOrders.new.map((order) => (
                <article
                  key={order.id}
                  className="rounded-2xl border border-accent-3/60 bg-primary/70 p-4 text-sm text-contrast"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-base font-semibold">Table {order.table}</p>
                      <p className="text-xs text-contrast/60">Placed {formatTime(order.createdAt)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateStatus(order.id, "served")}
                      className="rounded-full bg-brand px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow shadow-brand/40 transition hover:-translate-y-0.5"
                    >
                      Mark served
                    </button>
                  </div>
                  <ul className="mt-3 space-y-1 text-xs text-contrast/80">
                    {order.items.map((item, index) => {
                      const modifiers = formatModifiers(item.modifiers);
                      return (
                        <li key={`${order.id}-${index}`} className="space-y-1">
                          <div>
                            {item.quantity} x {item.name}
                          </div>
                          {modifiers ? (
                            <div className="text-[11px] text-contrast/60">{modifiers}</div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                  {order.notes ? (
                    <p className="mt-3 rounded-xl border border-accent-3/60 bg-accent-2/70 p-3 text-xs text-contrast/70">
                      {order.notes}
                    </p>
                  ) : null}
                </article>
              ))
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
                groupedOrders.served.map((order) => (
                  <article
                    key={order.id}
                    className="rounded-2xl border border-accent-3/60 bg-primary/70 p-4 text-sm text-contrast"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-base font-semibold">Table {order.table}</p>
                        <p className="text-xs text-contrast/60">
                          Served {formatTime(order.createdAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeOrder(order.id)}
                        className="rounded-full border border-rose-500/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-300 transition hover:bg-rose-500/10"
                      >
                        Remove
                      </button>
                    </div>
                    <ul className="mt-3 space-y-1 text-xs text-contrast/80">
                      {order.items.map((item, index) => {
                        const modifiers = formatModifiers(item.modifiers);
                        return (
                          <li key={`${order.id}-${index}`} className="space-y-1">
                            <div>
                              {item.quantity} x {item.name}
                            </div>
                            {modifiers ? (
                              <div className="text-[11px] text-contrast/60">{modifiers}</div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                    {order.notes ? (
                      <p className="mt-3 rounded-xl border border-accent-3/60 bg-accent-2/70 p-3 text-xs text-contrast/70">
                        {order.notes}
                      </p>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
};

export default Kitchen;
