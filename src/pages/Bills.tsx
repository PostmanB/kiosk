import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import type { OrderItem } from "../features/orders/OrdersContext";
import useLockBodyScroll from "../hooks/useLockBodyScroll";
import { isAndroidPrinterAvailable, printBill } from "../lib/printing";
import { supabase } from "../lib/supabaseClient";

type SummaryLine = {
  name: string;
  registerCode: string | null;
  quantity: number;
};

type BillGroup = {
  sessionId: string;
  bill: string;
  items: OrderItem[];
  ordersCount: number;
  openedAt: string;
  closedAt: string | null;
  total: number;
  showTotal: boolean;
  itemCount: number;
  takeawayNumber: number | null;
  isClosed: boolean;
};

type SessionRow = {
  id: string;
  table_number: string;
  status: "open" | "closed" | string | null;
  opened_at: string;
  closed_at: string | null;
};

type OrderRow = {
  id: string;
  session_id: string | null;
  items: OrderItem[] | null;
  created_at: string;
};

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

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toDayRangeIso = (dateInput: string) => {
  const [year, month, day] = dateInput.split("-").map((part) => Number(part));
  const start = new Date(year, (month || 1) - 1, day || 1, 0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
};

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

const formatTakeawayNumber = (value: number) => `#${String(value).padStart(3, "0")}`;
const formatBillLabel = (value: string) =>
  isTakeaway(value) ? TAKEAWAY_LABEL : `Számla ${value}`;

const buildBillGroups = (sessions: SessionRow[], orders: OrderRow[], isClosed: boolean): BillGroup[] => {
  const ordersBySession = new Map<string, OrderRow[]>();
  orders.forEach((order) => {
    if (!order.session_id) return;
    const current = ordersBySession.get(order.session_id) ?? [];
    current.push(order);
    ordersBySession.set(order.session_id, current);
  });

  const groups = sessions
    .map((session) => {
      const sessionOrders = (ordersBySession.get(session.id) ?? [])
        .slice()
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
      const items = sessionOrders.flatMap((order) => (Array.isArray(order.items) ? order.items : []));
      const total = items.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0);
      const showTotal = items.some(
        (item) => typeof item.price === "number" && !Number.isNaN(item.price)
      );
      const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
      const firstOrderCreatedAt = sessionOrders[0]?.created_at ?? session.opened_at;
      return {
        sessionId: session.id,
        bill: session.table_number,
        items,
        ordersCount: sessionOrders.length,
        openedAt: session.opened_at,
        closedAt: session.closed_at,
        total,
        showTotal,
        itemCount,
        takeawayNumber: null,
        isClosed,
        firstOrderCreatedAt,
      };
    })
    .filter((group) => group.ordersCount > 0);

  if (!isClosed) {
    return groups.sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  }

  const numbered = groups
    .slice()
    .sort((a, b) => a.firstOrderCreatedAt.localeCompare(b.firstOrderCreatedAt))
    .map((group, index) => ({ sessionId: group.sessionId, number: index + 1 }));
  const takeawayBySession = new Map(numbered.map((entry) => [entry.sessionId, entry.number]));

  return groups
    .map((group) => ({
      ...group,
      takeawayNumber: takeawayBySession.get(group.sessionId) ?? null,
    }))
    .sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? ""));
};

const Bills = () => {
  const [openBills, setOpenBills] = useState<BillGroup[]>([]);
  const [closedTakeawayBills, setClosedTakeawayBills] = useState<BillGroup[]>([]);
  const [selectedBillSessionId, setSelectedBillSessionId] = useState<string | null>(null);
  const [selectedClosedDate, setSelectedClosedDate] = useState(() => toDateInputValue(new Date()));
  const [confirmClose, setConfirmClose] = useState(false);
  const [exitingBills, setExitingBills] = useState<Record<string, boolean>>({});
  const [isModalClosing, setIsModalClosing] = useState(false);
  const [isLoadingOpen, setIsLoadingOpen] = useState(true);
  const [isLoadingClosed, setIsLoadingClosed] = useState(true);
  const [queryError, setQueryError] = useState<string | null>(null);
  const portalTarget = typeof document !== "undefined" ? document.body : null;
  const canPrint = isAndroidPrinterAvailable();
  const exitDurationMs = 220;
  const modalExitDurationMs = 220;
  const todayDate = toDateInputValue(new Date());

  const fetchOpenBills = useCallback(async () => {
    setIsLoadingOpen(true);

    const { data: sessionRows, error: sessionsError } = await supabase
      .from("kiosk_sessions")
      .select("id, table_number, status, opened_at, closed_at")
      .eq("status", "open")
      .order("opened_at", { ascending: false });

    if (sessionsError) {
      setQueryError(sessionsError.message);
      setIsLoadingOpen(false);
      return;
    }

    const sessionIds = (sessionRows ?? []).map((session) => session.id);
    if (sessionIds.length === 0) {
      setOpenBills([]);
      setIsLoadingOpen(false);
      setQueryError(null);
      return;
    }

    const { data: orderRows, error: ordersError } = await supabase
      .from("kiosk_orders")
      .select("id, session_id, items, created_at")
      .in("session_id", sessionIds)
      .order("created_at", { ascending: true });

    if (ordersError) {
      setQueryError(ordersError.message);
      setIsLoadingOpen(false);
      return;
    }

    const groups = buildBillGroups(
      (sessionRows ?? []) as SessionRow[],
      (orderRows ?? []) as OrderRow[],
      false
    );
    setOpenBills(groups);
    setIsLoadingOpen(false);
    setQueryError(null);
  }, []);

  const fetchClosedTakeawayBills = useCallback(async (dateInput: string) => {
    setIsLoadingClosed(true);
    const { startIso, endIso } = toDayRangeIso(dateInput);

    const { data: sessionRows, error: sessionsError } = await supabase
      .from("kiosk_sessions")
      .select("id, table_number, status, opened_at, closed_at")
      .eq("status", "closed")
      .gte("closed_at", startIso)
      .lt("closed_at", endIso)
      .order("closed_at", { ascending: true });

    if (sessionsError) {
      setQueryError(sessionsError.message);
      setIsLoadingClosed(false);
      return;
    }

    const takeawaySessions = (sessionRows ?? []).filter((session) => isTakeaway(session.table_number));
    const sessionIds = takeawaySessions.map((session) => session.id);
    if (sessionIds.length === 0) {
      setClosedTakeawayBills([]);
      setIsLoadingClosed(false);
      setQueryError(null);
      return;
    }

    const { data: orderRows, error: ordersError } = await supabase
      .from("kiosk_orders")
      .select("id, session_id, items, created_at")
      .in("session_id", sessionIds)
      .order("created_at", { ascending: true });

    if (ordersError) {
      setQueryError(ordersError.message);
      setIsLoadingClosed(false);
      return;
    }

    const groups = buildBillGroups(
      takeawaySessions as SessionRow[],
      (orderRows ?? []) as OrderRow[],
      true
    );
    setClosedTakeawayBills(groups);
    setIsLoadingClosed(false);
    setQueryError(null);
  }, []);

  const billMap = useMemo(() => {
    const map = new Map<string, BillGroup>();
    openBills.forEach((group) => map.set(group.sessionId, group));
    closedTakeawayBills.forEach((group) => map.set(group.sessionId, group));
    return map;
  }, [openBills, closedTakeawayBills]);

  const selectedGroup = selectedBillSessionId ? billMap.get(selectedBillSessionId) ?? null : null;
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
    void fetchOpenBills();
  }, [fetchOpenBills]);

  useEffect(() => {
    void fetchClosedTakeawayBills(selectedClosedDate);
  }, [fetchClosedTakeawayBills, selectedClosedDate]);

  useEffect(() => {
    setConfirmClose(false);
    setIsModalClosing(false);
  }, [selectedGroup?.sessionId]);

  const markBillExiting = (sessionId: string) => {
    setExitingBills((prev) => ({ ...prev, [sessionId]: true }));
  };

  const clearBillExiting = (sessionId: string) => {
    setExitingBills((prev) => {
      if (!prev[sessionId]) return prev;
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const closeModal = async () => {
    if (isModalClosing) return;
    setIsModalClosing(true);
    await sleep(modalExitDurationMs);
    setSelectedBillSessionId(null);
    setIsModalClosing(false);
  };

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
      takeawayNumber: selectedGroup.takeawayNumber ?? undefined,
      total: selectedGroup.showTotal ? selectedGroup.total : undefined,
      currency: "EUR",
      paperWidthMm: 58,
    });
    if (printResult.supported && !printResult.ok) {
      toast("A számlanyomtató nem válaszol. Ellenőrizd a Bluetooth-t.", { type: "error" });
    }
  };

  return (
    <section className="space-y-10">
      <div className="rounded-2xl border border-accent-3/60 bg-accent-2/70 px-4 py-3 text-sm text-contrast/70 shadow-sm">
        {isLoadingOpen
          ? "Számlák szinkronizálása..."
          : `${openBills.length} nyitott számla • ${closedTakeawayBills.length} lezárt elvitel (${selectedClosedDate})`}
      </div>

      {queryError ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {queryError}
        </div>
      ) : null}

      {isLoadingOpen ? (
        <div className="rounded-3xl border border-dashed border-accent-3/60 bg-accent-1/80 p-8 text-sm text-contrast/60">
          Nyitott számlák betöltése...
        </div>
      ) : openBills.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-accent-3/60 bg-accent-1/80 p-8 text-sm text-contrast/60">
          Jelenleg nincs nyitott számla.
        </div>
      ) : (
        <div className="rounded-3xl border border-accent-3/60 bg-accent-1/80 p-6 shadow-lg shadow-accent-4/20">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-contrast">Nyitott számlák</h2>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-300">
              {openBills.length} számla
            </span>
          </div>
          <div className="mt-4">
            <div className="flex gap-4 overflow-x-auto pb-4">
              {openBills.map((group, index) => {
                const isExiting = Boolean(exitingBills[group.sessionId]);
                const animationClass = isExiting ? "animate-fly-out" : "animate-fly-in";
                const flyStyle = {
                  "--fly-delay": `${index * 60}ms`,
                } as CSSProperties;
                const previewLines = buildSummaryLines(
                  group.items.map((item) => ({
                    name: item.name,
                    quantity: item.quantity,
                    registerCode: item.registerCode ?? null,
                  }))
                ).slice(0, 4);

                return (
                  <button
                    key={group.sessionId}
                    type="button"
                    onClick={() => setSelectedBillSessionId(group.sessionId)}
                    style={flyStyle}
                    className={`flex w-[320px] flex-shrink-0 flex-col gap-4 rounded-3xl border-2 border-dashed border-accent-3/60 bg-primary/80 p-5 text-left text-sm text-contrast shadow-lg shadow-accent-4/20 transition hover:-translate-y-0.5 hover:border-brand/50 ${animationClass} ${
                      isExiting ? "pointer-events-none" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold">{formatBillLabel(group.bill)}</p>
                        <p className="text-xs text-contrast/60">
                          Megnyitva {formatTime(group.openedAt)} • {group.itemCount} tétel
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
                        <li className="text-[11px] text-contrast/60">Még nincsenek tételek.</li>
                      ) : (
                        previewLines.map((line) => (
                          <li key={`${group.sessionId}-${line.name}-${line.registerCode ?? "none"}`}>
                            {line.quantity}x {line.name}
                          </li>
                        ))
                      )}
                    </ul>
                    <div className="mt-auto flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-brand/70">
                        Részletek
                      </span>
                      {group.ordersCount > 1 ? (
                        <span className="text-[10px] uppercase tracking-wide text-contrast/60">
                          {group.ordersCount} rendelés
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

      <div className="rounded-3xl border border-accent-3/60 bg-accent-1/80 p-6 shadow-lg shadow-accent-4/20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-contrast">Lezárt elviteles számlák</h2>
            <p className="text-xs text-contrast/60">A számozás naponta újraindul.</p>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-contrast/70">
            Dátum
            <input
              type="date"
              value={selectedClosedDate}
              max={todayDate}
              onChange={(event) => setSelectedClosedDate(event.target.value)}
              onClick={(event) => {
                (event.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
              }}
              onFocus={(event) => {
                (event.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
              }}
              className="rounded-xl border border-accent-3/60 bg-primary/70 px-3 py-2 text-sm text-contrast outline-none transition focus:border-brand/60"
            />
          </label>
        </div>

        <div className="mt-4">
          {isLoadingClosed ? (
            <div className="rounded-2xl border border-dashed border-accent-3/60 bg-primary/70 p-4 text-sm text-contrast/60">
              Lezárt számlák betöltése...
            </div>
          ) : closedTakeawayBills.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-accent-3/60 bg-primary/70 p-4 text-sm text-contrast/60">
              Ezen a napon nincs lezárt elviteles számla.
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {closedTakeawayBills.map((group, index) => {
                const flyStyle = {
                  "--fly-delay": `${index * 40}ms`,
                } as CSSProperties;
                const previewLines = buildSummaryLines(
                  group.items.map((item) => ({
                    name: item.name,
                    quantity: item.quantity,
                    registerCode: item.registerCode ?? null,
                  }))
                ).slice(0, 4);

                return (
                  <button
                    key={group.sessionId}
                    type="button"
                    onClick={() => setSelectedBillSessionId(group.sessionId)}
                    style={flyStyle}
                    className="flex w-[320px] flex-shrink-0 flex-col gap-4 rounded-3xl border border-amber-400/40 bg-primary/80 p-5 text-left text-sm text-contrast shadow-lg shadow-accent-4/20 transition hover:-translate-y-0.5 hover:border-amber-300/70 animate-fly-in"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold">
                          Elvitel {formatTakeawayNumber(group.takeawayNumber ?? index + 1)}
                        </p>
                        <p className="text-xs text-contrast/60">
                          Lezárva {group.closedAt ? formatTime(group.closedAt) : "-"} • {group.itemCount} tétel
                        </p>
                      </div>
                      {group.showTotal ? (
                        <span className="rounded-full border border-amber-400/40 bg-amber-200/60 px-2 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                          {formatCurrency(group.total)}
                        </span>
                      ) : null}
                    </div>
                    <ul className="space-y-2 text-xs text-contrast/80">
                      {previewLines.length === 0 ? (
                        <li className="text-[11px] text-contrast/60">Nincs tétel.</li>
                      ) : (
                        previewLines.map((line) => (
                          <li key={`${group.sessionId}-${line.name}-${line.registerCode ?? "none"}`}>
                            {line.quantity}x {line.name}
                          </li>
                        ))
                      )}
                    </ul>
                    <div className="mt-auto flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200/90">
                        Részletek
                      </span>
                      {group.ordersCount > 1 ? (
                        <span className="text-[10px] uppercase tracking-wide text-contrast/60">
                          {group.ordersCount} rendelés
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedGroup && portalTarget
        ? createPortal(
            <div
              className={`fixed inset-0 z-[80] flex items-center justify-center bg-primary/60 backdrop-blur-lg p-4 ${isModalClosing ? "animate-fade-out" : "animate-fade-in"}`}
            >
              <button
                type="button"
                aria-label="Bezárás"
                className="absolute inset-0"
                onClick={() => void closeModal()}
              />
              <div
                className={`relative z-10 flex w-full max-w-3xl max-h-[85vh] flex-col overflow-hidden rounded-3xl border border-accent-3/60 bg-primary p-6 shadow-2xl ${isModalClosing ? "animate-fly-out" : "animate-fly-in"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand/70">
                      Számla részletei
                    </p>
                    <h2 className="text-2xl font-semibold text-contrast">
                      {selectedGroup.isClosed
                        ? `Elvitel ${formatTakeawayNumber(selectedGroup.takeawayNumber ?? 1)}`
                        : formatBillLabel(selectedGroup.bill)}
                    </h2>
                    <p className="mt-1 text-xs text-contrast/60">
                      {selectedGroup.ordersCount} rendelés • Megnyitva {formatTime(selectedGroup.openedAt)}
                      {selectedGroup.isClosed && selectedGroup.closedAt
                        ? ` • Lezárva ${formatTime(selectedGroup.closedAt)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canPrint ? (
                      <button
                        type="button"
                        onClick={handlePrintBill}
                        className="rounded-full bg-brand px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-md shadow-brand/40 transition hover:-translate-y-0.5"
                      >
                        Számla nyomtatása
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void closeModal()}
                      className="rounded-full border border-accent-3/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-contrast/70 transition hover:border-brand/50 hover:text-brand"
                    >
                      Bezárás
                    </button>
                  </div>
                </div>

                <div className="mt-6 grid flex-1 min-h-0 gap-6 overflow-hidden lg:grid-cols-[1.2fr_0.8fr]">
                  <section className="no-scrollbar min-h-0 space-y-3 overflow-y-auto pr-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-contrast/70">
                      Részletes tételek
                    </h3>
                    <div className="space-y-3">
                      {selectedGroup.items.map((item, index) => {
                        const modifierLines = formatModifierLines(item.modifiers);
                        return (
                          <div
                            key={`${selectedGroup.sessionId}-${index}`}
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
                          <span>Összesen</span>
                          <span className="text-base font-semibold text-contrast">
                            {formatCurrency(selectedGroup.total)}
                          </span>
                        </div>
                      </div>
                    ) : null}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-contrast/70">
                        Összegzés
                      </h3>
                      {summaryLines.length === 0 ? (
                        <p className="text-sm text-contrast/60">Nincs tétel ezen a számlán.</p>
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
                              <p className="text-xs text-contrast/60">Kód {line.registerCode ?? "-"}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </aside>
                </div>

                {!selectedGroup.isClosed ? (
                  <div className="mt-6 flex flex-col gap-3 border-t border-accent-3/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-contrast/70">
                      <p className="font-semibold text-contrast">Készen állsz a számla lezárására?</p>
                      <p className="text-xs text-contrast/60">
                        Ez lezárja a számlát és áthelyezi a lezárt elvitelek közé.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <button
                        type="button"
                        onClick={() => void closeModal()}
                        className="rounded-full border border-accent-3/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-contrast/70 transition hover:border-brand/50 hover:text-brand"
                      >
                        Nyitva hagyás
                      </button>
                      {confirmClose ? (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!selectedGroup?.sessionId) return;
                            const group = selectedGroup;
                            const billKey = group.sessionId;
                            setConfirmClose(false);
                            await closeModal();
                            markBillExiting(billKey);
                            await sleep(exitDurationMs);

                            const { error: closeError } = await supabase
                              .from("kiosk_sessions")
                              .update({ status: "closed", closed_at: new Date().toISOString() })
                              .eq("id", group.sessionId);

                            if (closeError) {
                              toast(closeError.message, { type: "error" });
                              clearBillExiting(billKey);
                              return;
                            }

                            toast("Számla lezárva.", { type: "success" });
                            clearBillExiting(billKey);
                            await fetchOpenBills();
                            if (selectedClosedDate === todayDate) {
                              await fetchClosedTakeawayBills(selectedClosedDate);
                            }
                          }}
                          className="rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-md shadow-amber-500/30 transition hover:-translate-y-0.5 hover:shadow-lg"
                        >
                          Lezárás megerősítése
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmClose(true)}
                          className="rounded-full border border-amber-500/70 bg-amber-200/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-amber-900 transition hover:border-amber-600/70 hover:text-amber-900 dark:border-amber-400/60 dark:bg-amber-400/15 dark:text-amber-100 dark:hover:border-amber-300 dark:hover:text-amber-50"
                        >
                          Számla lezárása
                        </button>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>,
            portalTarget
          )
        : null}
    </section>
  );
};

export default Bills;
