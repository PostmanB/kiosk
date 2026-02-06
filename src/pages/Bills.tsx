import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import { useOrders } from "../features/orders/OrdersContext";
import { useSessions } from "../features/sessions/SessionsContext";
import useLockBodyScroll from "../hooks/useLockBodyScroll";
import { isAndroidPrinterAvailable, printBill } from "../lib/printing";

type SummaryLine = {
  name: string;
  registerCode: string | null;
  quantity: number;
};

const formatCurrency = (value: number) => `EUR ${value.toFixed(2)}`;
const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

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

const buildSummaryLines = (
  items: { name: string; quantity: number; registerCode?: string | null }[]
): SummaryLine[] => {
  const map = new Map<string, SummaryLine>();
  items.forEach((item) => {
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
};

const formatBillLabel = (value: string) => (value === "Takeaway" ? "Takeaway" : `Bill ${value}`);

const Bills = () => {
  const { orders, isLoading, error } = useOrders();
  const { sessions, closeSession } = useSessions();
  const [selectedBill, setSelectedBill] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const portalTarget = typeof document !== "undefined" ? document.body : null;
  const canPrint = isAndroidPrinterAvailable();

  const billGroups = useMemo(() => {
    const openSessions = sessions.filter((session) => session.status === "open");
    return openSessions
      .map((session) => {
        const sessionOrders = orders.filter((order) => order.sessionId === session.id);
        const items = sessionOrders.flatMap((order) => order.items);
        const total = items.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0);
        const showTotal = items.some(
          (item) => typeof item.price === "number" && !Number.isNaN(item.price)
        );
        const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
        return {
          bill: session.table,
          sessionId: session.id,
          items,
          ordersCount: sessionOrders.length,
          openedAt: session.openedAt,
          total,
          showTotal,
          itemCount,
        };
      })
      .filter((group) => group.ordersCount > 0)
      .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  }, [orders, sessions]);

  const billMap = useMemo(() => {
    const map = new Map<string, (typeof billGroups)[number]>();
    billGroups.forEach((group) => map.set(group.bill, group));
    return map;
  }, [billGroups]);

  const selectedGroup = selectedBill ? billMap.get(selectedBill) : null;
  useLockBodyScroll(Boolean(selectedGroup));
  const summaryLines = useMemo(() => {
    if (!selectedGroup) return [];
    return buildSummaryLines(
      selectedGroup.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        registerCode: item.registerCode ?? null,
      }))
    );
  }, [selectedGroup]);

  useEffect(() => {
    setConfirmClose(false);
  }, [selectedGroup?.sessionId]);

  const handlePrintBill = () => {
    if (!selectedGroup) return;
    const printResult = printBill({
      type: "bill",
      table: selectedGroup.bill,
      openedAt: selectedGroup.openedAt,
      items: selectedGroup.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: typeof item.price === "number" ? item.price : undefined,
        modifiers: item.modifiers,
        registerCode: item.registerCode ?? null,
      })),
      total: selectedGroup.showTotal ? selectedGroup.total : undefined,
      currency: "EUR",
      paperWidthMm: 58,
    });
    if (printResult.supported && !printResult.ok) {
      toast("Bill printer not responding. Check Bluetooth.", { type: "error" });
    }
  };

  return (
    <section className="space-y-10">
      <div className="rounded-2xl border border-accent-3/60 bg-accent-2/70 px-4 py-3 text-sm text-contrast/70 shadow-sm">
        {isLoading ? "Syncing bills..." : `${billGroups.length} open bills`}
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {billGroups.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-accent-3/60 bg-accent-1/80 p-8 text-sm text-contrast/60">
          No open bills right now.
        </div>
      ) : (
        <div className="rounded-3xl border border-accent-3/60 bg-accent-1/80 p-6 shadow-lg shadow-accent-4/20">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-contrast">Open Bills</h2>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-300">
              {billGroups.length} bills
            </span>
          </div>
          <div className="mt-4">
            <div className="flex gap-4 overflow-x-auto pb-4">
              {billGroups.map((group) => {
                const previewLines = buildSummaryLines(
                  group.items.map((item) => ({
                    name: item.name,
                    quantity: item.quantity,
                    registerCode: item.registerCode ?? null,
                  }))
                ).slice(0, 4);

                return (
                  <button
                    key={group.bill}
                    type="button"
                    onClick={() => setSelectedBill(group.bill)}
                    className="flex w-[320px] flex-shrink-0 flex-col gap-4 rounded-3xl border-2 border-dashed border-accent-3/60 bg-primary/80 p-5 text-left text-sm text-contrast shadow-lg shadow-accent-4/20 transition hover:-translate-y-0.5 hover:border-brand/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold">{formatBillLabel(group.bill)}</p>
                        <p className="text-xs text-contrast/60">
                          Opened {formatTime(group.openedAt)} ? {group.itemCount} items
                        </p>
                      </div>
                      {group.showTotal ? (
                        <span className="rounded-full border border-brand/40 bg-brand/10 px-2 py-1 text-xs font-semibold text-brand">
                          {formatCurrency(group.total)}
                        </span>
                      ) : null}
                    </div>
                    <ul className="space-y-2 text-xs text-contrast/80">
                      {previewLines.length === 0 ? (
                        <li className="text-[11px] text-contrast/60">No items yet.</li>
                      ) : (
                        previewLines.map((line) => (
                          <li key={`${group.bill}-${line.name}-${line.registerCode ?? "none"}`}>
                            {line.quantity}x {line.name}
                          </li>
                        ))
                      )}
                    </ul>
                    <div className="mt-auto flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-brand/70">
                        View details
                      </span>
                      {group.ordersCount > 1 ? (
                        <span className="text-[10px] uppercase tracking-wide text-contrast/60">
                          {group.ordersCount} orders
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {selectedGroup && portalTarget
        ? createPortal(
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-primary/60 backdrop-blur-lg p-4">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0"
            onClick={() => setSelectedBill(null)}
          />
          <div className="relative z-10 flex w-full max-w-3xl max-h-[85vh] flex-col overflow-hidden rounded-3xl border border-accent-3/60 bg-primary p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand/70">
                  Bill details
                </p>
                <h2 className="text-2xl font-semibold text-contrast">
                  {formatBillLabel(selectedGroup.bill)}
                </h2>
                <p className="mt-1 text-xs text-contrast/60">
                  {selectedGroup.ordersCount} order
                  {selectedGroup.ordersCount === 1 ? "" : "s"} ? Opened{" "}
                  {formatTime(selectedGroup.openedAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canPrint ? (
                  <button
                    type="button"
                    onClick={handlePrintBill}
                    className="rounded-full bg-brand px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-md shadow-brand/40 transition hover:-translate-y-0.5"
                  >
                    Print bill
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setSelectedBill(null)}
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
                        key={`${selectedGroup.bill}-${index}`}
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
                          <div className="mt-1 space-y-1 text-[11px]">
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
                      </div>
                    );
                  })}
                </div>
              </section>

              <aside className="no-scrollbar min-h-0 space-y-4 overflow-y-auto pr-2">
                {selectedGroup.showTotal ? (
                  <div className="rounded-2xl border border-accent-3/60 bg-primary/70 px-4 py-3 text-sm text-contrast/70">
                    <div className="flex items-center justify-between">
                      <span>Total</span>
                      <span className="text-base font-semibold text-contrast">
                        {formatCurrency(selectedGroup.total)}
                      </span>
                    </div>
                  </div>
                ) : null}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-contrast/70">
                    Summary
                  </h3>
                  {summaryLines.length === 0 ? (
                    <p className="text-sm text-contrast/60">No items in this bill.</p>
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
                            Code {line.registerCode ?? "-"}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </aside>
            </div>

            <div className="mt-6 flex flex-col gap-3 border-t border-accent-3/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-contrast/70">
                <p className="font-semibold text-contrast">Ready to close this bill?</p>
                <p className="text-xs text-contrast/60">
                  This will mark the bill as closed and remove it from open bills.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => setSelectedBill(null)}
                  className="rounded-full border border-accent-3/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-contrast/70 transition hover:border-brand/50 hover:text-brand"
                >
                  Keep open
                </button>
                {confirmClose ? (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!selectedGroup?.sessionId) return;
                      const result = await closeSession(selectedGroup.sessionId);
                      if (!result.ok) {
                        toast(result.error ?? "Unable to close bill.", { type: "error" });
                        return;
                      }
                      toast("Bill closed.", { type: "success" });
                      setConfirmClose(false);
                      setSelectedBill(null);
                    }}
                    className="rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-md shadow-amber-500/30 transition hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    Confirm close
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClose(true)}
                    className="rounded-full border border-amber-500/70 bg-amber-200/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-amber-900 transition hover:border-amber-600/70 hover:text-amber-900 dark:border-amber-400/60 dark:bg-amber-400/15 dark:text-amber-100 dark:hover:border-amber-300 dark:hover:text-amber-50"
                  >
                    Close bill
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>,
            portalTarget
          )
        : null}
    </section>
  );
};

export default Bills;
