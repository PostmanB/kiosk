import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { useOrders } from "../features/orders/OrdersContext";
import { useMenu } from "../features/menu/MenuContext";
import { useSessions } from "../features/sessions/SessionsContext";
import type { MenuItem } from "../features/menu/MenuContext";

type MenuModifierGroup = {
  id: string;
  label: string;
  type: "single" | "multi";
  options: string[];
};

type CartItem = {
  id: string;
  menuItem: MenuItem;
  quantity: number;
  modifiers: Record<string, string[]>;
};

const formatCurrency = (value: number) => `EUR ${value.toFixed(2)}`;
const fallbackIconName = "ph:fork-knife";

const normalizeModifiers = (modifiers: Record<string, string[]>) => {
  const sortedEntries = Object.entries(modifiers)
    .map(([group, values]) => [group, [...values].sort()] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(sortedEntries);
};

const modifiersSignature = (modifiers: Record<string, string[]>) =>
  JSON.stringify(normalizeModifiers(modifiers));

const formatModifierLines = (modifiers?: Record<string, string[]>) => {
  if (!modifiers) return [];
  return Object.entries(modifiers)
    .map(([group, values]) => {
      if (!values || values.length === 0) return null;
      return `${group}: ${values.join(", ")}`;
    })
    .filter(Boolean) as string[];
};

const buildModifierGroups = (
  item: MenuItem | null,
  sauces: { name: string }[],
  sides: { name: string }[]
) => {
  if (!item) return [];
  const groups: MenuModifierGroup[] = [];
  if (item.allow_sauces) {
    groups.push({
      id: "Sauce",
      label: "Sauce",
      type: "single",
      options: ["No sauce", ...sauces.map((sauce) => sauce.name)],
    });
  }
  if (item.allow_sides) {
    groups.push({
      id: "Side",
      label: "Side",
      type: "single",
      options: ["No side", ...sides.map((side) => side.name)],
    });
  }
  return groups;
};

type ReviewLine = {
  name: string;
  registerCode: string | null;
  quantity: number;
};

const buildReviewLines = (items: { name: string; quantity: number; registerCode?: string | null }[]) => {
  const map = new Map<string, ReviewLine>();
  items.forEach((item) => {
    const code = item.registerCode ?? null;
    const key = `${item.name}__${code ?? "none"}`;
    const existing = map.get(key);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      map.set(key, {
        name: item.name,
        registerCode: code,
        quantity: item.quantity,
      });
    }
  });
  return Array.from(map.values());
};

const Cashier = () => {
  const { orders, addOrder, isLoading: ordersLoading, error: ordersError } = useOrders();
  const {
    categories,
    items,
    sauces,
    sides,
    isLoading: menuLoading,
    error: menuError,
  } = useMenu();
  const { sessions, createSession, closeSession } = useSessions();

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [table, setTable] = useState("");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [billTable, setBillTable] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({});
  const [selectedQty, setSelectedQty] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [orderStep, setOrderStep] = useState<1 | 2 | 3>(1);
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

  const detailGroups = useMemo(
    () => buildModifierGroups(selectedItem, sauces, sides),
    [selectedItem, sauces, sides]
  );

  const itemsForCategory = useMemo(() => {
    if (!activeCategoryId) return [];
    return items.filter((item) => item.category_id === activeCategoryId);
  }, [items, activeCategoryId]);

  const cartTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity * item.menuItem.price, 0),
    [cartItems]
  );

  const activeSessionOrders = useMemo(
    () => orders.filter((order) => (activeSessionId ? order.sessionId === activeSessionId : false)),
    [orders, activeSessionId]
  );

  const existingItems = useMemo(
    () => activeSessionOrders.flatMap((order) => order.items),
    [activeSessionOrders]
  );

  const reviewLines = useMemo<ReviewLine[]>(() => {
    const existing = existingItems.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      registerCode: item.registerCode ?? null,
    }));
    const newItems = cartItems.map((item) => ({
      name: item.menuItem.name,
      quantity: item.quantity,
      registerCode: item.menuItem.register_code ?? null,
    }));
    return buildReviewLines([...existing, ...newItems]);
  }, [cartItems, existingItems]);

  const existingTotal = useMemo(
    () => existingItems.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0),
    [existingItems]
  );
  const combinedTotal = existingTotal + cartTotal;

  const openSessions = useMemo(
    () => sessions.filter((session) => session.status === "open"),
    [sessions]
  );

  const tableGroups = useMemo(() => {
    return openSessions
      .map((session) => {
        const sessionOrders = orders.filter((order) => order.sessionId === session.id);
        const items = sessionOrders.flatMap((order) => order.items);
        return {
          table: session.table,
          sessionId: session.id,
          items,
          ordersCount: sessionOrders.length,
        };
      })
      .filter((group) => group.ordersCount > 0)
      .sort((a, b) => a.table.localeCompare(b.table));
  }, [orders, openSessions]);

  const tableGroupMap = useMemo(() => {
    const map = new Map<string, (typeof tableGroups)[number]>();
    tableGroups.forEach((group) => map.set(group.table, group));
    return map;
  }, [tableGroups]);

  const billGroup = billTable ? tableGroupMap.get(billTable) : null;
  const billSummaryLines = useMemo(() => {
    if (!billGroup) return [];
    return buildReviewLines(
      billGroup.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        registerCode: item.registerCode ?? null,
      }))
    );
  }, [billGroup]);

  const sessionByTable = useMemo(() => {
    const map = new Map<string, (typeof openSessions)[number]>();
    openSessions.forEach((session) => map.set(session.table, session));
    return map;
  }, [openSessions]);

  useEffect(() => {
    if (!table) {
      setActiveSessionId(null);
      return;
    }
    const existing = sessionByTable.get(table);
    setActiveSessionId(existing?.id ?? null);
  }, [table, sessionByTable]);

  useEffect(() => {
    if (!activeCategoryId && categories.length > 0) {
      setActiveCategoryId(categories[0].id);
    }
  }, [activeCategoryId, categories]);

  const resetDetailPanel = () => {
    setSelectedItem(null);
    setSelectedModifiers({});
    setSelectedQty(1);
  };

  const openDetailPanel = (item: MenuItem) => {
    const groups = buildModifierGroups(item, sauces, sides);
    const defaults: Record<string, string[]> = {};
    groups.forEach((group) => {
      if (group.type === "single") {
        defaults[group.label] = [group.options[0]];
      } else {
        defaults[group.label] = [];
      }
    });
    setSelectedItem(item);
    setSelectedModifiers(defaults);
    setSelectedQty(1);
  };

  const toggleModifier = (group: MenuModifierGroup, option: string) => {
    setSelectedModifiers((prev) => {
      const existing = prev[group.label] ?? [];
      if (group.type === "single") {
        return { ...prev, [group.label]: [option] };
      }
      const next = existing.includes(option)
        ? existing.filter((value) => value !== option)
        : [...existing, option];
      return { ...prev, [group.label]: next };
    });
  };

  const handleAddToCart = () => {
    if (!selectedItem) return;
    const normalized = normalizeModifiers(selectedModifiers);
    const key = `${selectedItem.id}:${modifiersSignature(normalized)}`;

    setCartItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === key);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + selectedQty,
        };
        return updated;
      }
      return [
        ...prev,
        {
          id: key,
          menuItem: selectedItem,
          quantity: selectedQty,
          modifiers: normalized,
        },
      ];
    });
    setFeedback(null);
    resetDetailPanel();
  };

  const updateCartQuantity = (id: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) =>
          item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeCartItem = (id: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSubmit = async () => {
    if (!table.trim()) {
      setFeedback("Enter a table number to create the order.");
      return;
    }
    if (cartItems.length === 0) {
      setFeedback("Select at least one menu item before submitting.");
      return;
    }

    let sessionId = activeSessionId;
    if (!sessionId) {
      const created = await createSession(table);
      if (!created.ok || !created.session) {
        setFeedback(created.error ?? "Unable to open a session.");
        return;
      }
      sessionId = created.session.id;
      setActiveSessionId(sessionId);
    }

    const result = await addOrder({
      table,
      sessionId,
      items: cartItems.map((item) => ({
        name: item.menuItem.name,
        quantity: item.quantity,
        modifiers: item.modifiers,
        price: item.menuItem.price,
        registerCode: item.menuItem.register_code ?? undefined,
        showInKitchen: item.menuItem.show_in_kitchen,
      })),
    });

    if (!result.ok) {
      setFeedback(result.error ?? "Unable to send order right now.");
      return;
    }

    setTable("");
    setCartItems([]);
    setFeedback("Order sent to the kitchen.");
    setOrderStep(1);
    setActiveSessionId(null);
  };

  const sendPendingItems = async (sessionId: string) => {
    if (cartItems.length === 0) {
      return { ok: true, skipped: true };
    }
    const result = await addOrder({
      table,
      sessionId,
      items: cartItems.map((item) => ({
        name: item.menuItem.name,
        quantity: item.quantity,
        modifiers: item.modifiers,
        price: item.menuItem.price,
        registerCode: item.menuItem.register_code ?? undefined,
        showInKitchen: item.menuItem.show_in_kitchen,
      })),
    });
    return { ok: result.ok, error: result.error };
  };

  return (
    <section className="space-y-10">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand/70">
            Cashier Console
          </p>
          <h1 className="text-3xl font-bold text-contrast sm:text-4xl">
            Build orders from the menu cards.
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-contrast/75">
            Tap a card to customize sauces and sides, then send the order straight to the kitchen.
            The menu and orders stay synced through Supabase.
          </p>
        </div>
        <div className="rounded-2xl border border-accent-3/60 bg-accent-2/70 px-4 py-3 text-sm text-contrast/70 shadow-sm">
          {ordersLoading || menuLoading ? "Syncing..." : `${orders.length} active orders`}
        </div>
      </header>

      {menuError ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {menuError}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 rounded-3xl border border-accent-3/60 bg-accent-1/70 p-4 text-xs font-semibold uppercase tracking-[0.2em] text-contrast/70">
        <span className={orderStep === 1 ? "text-brand" : ""}>1. Table</span>
        <span className={orderStep === 2 ? "text-brand" : ""}>2. Items</span>
        <span className={orderStep === 3 ? "text-brand" : ""}>3. Send</span>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
        <section className="space-y-6">
          {orderStep === 2 ? (
            <>
              <div className="flex flex-wrap gap-3">
                {categories.length === 0 ? (
                  <span className="text-sm text-contrast/60">
                    No menu categories yet. Add them in Admin.
                  </span>
                ) : (
                  categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setActiveCategoryId(category.id)}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold uppercase tracking-wide transition ${
                        activeCategoryId === category.id
                          ? "border-brand/50 bg-brand/15 text-brand"
                          : "border-accent-3/60 text-contrast/70 hover:border-brand/40 hover:text-brand"
                      }`}
                    >
                      {category.name}
                    </button>
                  ))
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {itemsForCategory.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-accent-3/60 bg-accent-1/80 p-6 text-sm text-contrast/60">
                    No items in this category yet.
                  </div>
                ) : (
                  itemsForCategory.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openDetailPanel(item)}
                      className="group rounded-3xl border border-accent-3/60 bg-accent-1/80 p-5 text-left shadow-lg shadow-accent-4/20 transition hover:-translate-y-1 hover:border-brand/50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-accent-3/60 bg-primary/60">
                            <Icon
                              icon={item.icon_name || fallbackIconName}
                              className="h-6 w-6 text-brand"
                            />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-contrast">{item.name}</h3>
                            {item.description ? (
                              <p className="mt-1 text-xs text-contrast/70">{item.description}</p>
                            ) : null}
                          </div>
                        </div>
                        <span className="rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
                          {formatCurrency(item.price)}
                        </span>
                      </div>
                      <div className="mt-4 flex items-center justify-between text-xs text-contrast/60">
                        <span>
                          {item.allow_sauces || item.allow_sides ? "Customize" : "Quick add"}
                        </span>
                        <span className="text-brand/70 transition group-hover:text-brand">
                          Tap to add
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="rounded-3xl border border-accent-3/60 bg-accent-1/80 p-8 text-sm text-contrast/70">
              {orderStep === 1 ? (
                <>
                  <h2 className="text-xl font-semibold text-contrast">Step 1: Choose table</h2>
                  <p className="mt-2">
                    Select a table number or takeaway to start a new order.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-semibold text-contrast">Step 3: Review & send</h2>
                  <p className="mt-2">
                    Review the register codes and total quantities before sending.
                  </p>
                  <div className="mt-6 space-y-3">
                    {reviewLines.length === 0 ? (
                      <p className="text-sm text-contrast/60">No items in the order.</p>
                    ) : (
                      reviewLines.map((line) => (
                        <div
                          key={`${line.name}-${line.registerCode ?? "none"}`}
                          className="flex items-center justify-between rounded-2xl border border-accent-3/60 bg-primary/70 px-4 py-3 text-sm text-contrast"
                        >
                          <div>
                            <p className="font-semibold">{line.quantity}x {line.name}</p>
                            <p className="text-xs text-contrast/60">
                              Code {line.registerCode ?? "—"}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </section>

        <aside className="space-y-6 rounded-3xl border border-accent-3/60 bg-accent-2/70 p-6 shadow-lg shadow-accent-4/20">
          {orderStep === 1 ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-contrast/80" htmlFor="table">
                  Table map
                </label>
                <div className="mt-4 rounded-3xl border border-accent-3/60 bg-primary/70 p-4">
                  <div className="relative h-[300px] w-full max-w-md">
                    {tableLayout.map((entry) => {
                      const isSelected = table === entry.id;
                      const hasBill = tableGroupMap.has(entry.id);
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => {
                            if (hasBill && !isSelected) {
                              setBillTable(entry.id);
                              return;
                            }
                            setTable(isSelected ? "" : entry.id);
                          }}
                          className={`absolute flex items-center justify-center rounded-xl border text-sm font-semibold transition ${
                            isSelected
                              ? "border-brand/60 bg-brand text-white shadow-md shadow-brand/40"
                              : hasBill
                                ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100 hover:border-brand/50 hover:text-brand"
                                : "border-accent-3/60 bg-primary/80 text-contrast/70 hover:border-brand/50 hover:text-brand"
                          }`}
                          style={{
                            left: `${entry.x}%`,
                            top: `${entry.y}%`,
                            width: `${entry.w}%`,
                            height: `${entry.h}%`,
                          }}
                          aria-pressed={isSelected}
                        >
                          {entry.id}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (table === takeawayLabel) {
                        setTable("");
                        return;
                      }
                      if (tableGroupMap.has(takeawayLabel)) {
                        setBillTable(takeawayLabel);
                        return;
                      }
                      setTable(takeawayLabel);
                    }}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                      table === takeawayLabel
                        ? "border-brand/60 bg-brand text-white shadow-md shadow-brand/40"
                        : tableGroupMap.has(takeawayLabel)
                          ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100 hover:border-brand/50 hover:text-brand"
                          : "border-accent-3/60 bg-primary/70 text-contrast/70 hover:border-brand/50 hover:text-brand"
                    }`}
                  >
                    {takeawayLabel}
                  </button>
                </div>
                <p className="mt-2 text-xs text-contrast/60">
                  {table
                    ? "Tap the selected table to deselect."
                    : "Select a table. Green tables have open bills."}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (!table.trim()) {
                    setFeedback("Select a table or takeaway to continue.");
                    return;
                  }
                  setFeedback(null);
                  if (!activeSessionId) {
                    const created = await createSession(table);
                    if (!created.ok || !created.session) {
                      setFeedback(created.error ?? "Unable to open a session.");
                      return;
                    }
                    setActiveSessionId(created.session.id);
                  }
                  setOrderStep(2);
                }}
                className="w-full rounded-full bg-brand px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-md shadow-brand/40 transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!table.trim()}
              >
                Continue to items
              </button>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-accent-3/60 bg-primary/70 px-4 py-3 text-sm text-contrast/70">
                <div className="flex items-center justify-between">
                  <span>Service</span>
                  <span className="text-base font-semibold text-contrast">
                    {table || "Not selected"}
                  </span>
                </div>
              </div>
              {activeSessionId ? (
                <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
                  Open bill active
                </div>
              ) : null}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-contrast/80">
                    Current order
                  </h3>
                  <span className="text-xs text-contrast/60">{cartItems.length} items</span>
                </div>
                {existingItems.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-contrast/60">
                      Existing items
                    </p>
                    {existingItems.map((item, index) => {
                      const modifierLines = Object.entries(item.modifiers ?? {})
                        .filter(([, values]) => values.length > 0)
                        .map(([group, values]) => `${group}: ${values.join(", ")}`);
                      return (
                        <div
                          key={`existing-${index}`}
                          className="rounded-2xl border border-accent-3/60 bg-accent-1/80 p-3 text-sm text-contrast"
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
                            <div className="mt-1 text-[11px] text-contrast/60">
                              {modifierLines.join(" | ")}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {cartItems.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-accent-3/60 bg-primary/70 p-4 text-sm text-contrast/60">
                    Choose items from the menu cards to start the order.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {existingItems.length > 0 ? (
                      <p className="text-xs font-semibold uppercase tracking-wide text-contrast/60">
                        New items
                      </p>
                    ) : null}
                    {cartItems.map((item) => {
                      const modifierLines = Object.entries(item.modifiers)
                        .filter(([, values]) => values.length > 0)
                        .map(([group, values]) => `${group}: ${values.join(", ")}`);
                      return (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-accent-3/60 bg-primary/70 p-4 text-sm text-contrast"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold">{item.menuItem.name}</p>
                              {modifierLines.length ? (
                                <div className="mt-1 text-[11px] text-contrast/60">
                                  {modifierLines.join(" | ")}
                                </div>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeCartItem(item.id)}
                              className="text-[11px] font-semibold uppercase tracking-wide text-rose-300 transition hover:text-rose-200"
                            >
                              Remove
                            </button>
                          </div>
                          <div className="mt-3 flex items-center justify-between text-xs text-contrast/70">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => updateCartQuantity(item.id, -1)}
                                className="h-7 w-7 rounded-full border border-accent-3/60 text-base text-contrast/70 transition hover:border-brand/50 hover:text-brand"
                              >
                                -
                              </button>
                              <span className="min-w-[24px] text-center text-sm font-semibold">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateCartQuantity(item.id, 1)}
                                className="h-7 w-7 rounded-full border border-accent-3/60 text-base text-contrast/70 transition hover:border-brand/50 hover:text-brand"
                              >
                                +
                              </button>
                            </div>
                            <span>{formatCurrency(item.menuItem.price * item.quantity)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-accent-3/60 bg-primary/70 px-4 py-3 text-sm text-contrast/70">
                <div className="flex items-center justify-between">
                  <span>Total</span>
                  <span className="text-base font-semibold text-contrast">
                    {formatCurrency(combinedTotal)}
                  </span>
                </div>
                {existingItems.length > 0 ? (
                  <p className="mt-1 text-[11px] text-contrast/60">
                    Includes {formatCurrency(existingTotal)} from existing items.
                  </p>
                ) : null}
              </div>

              {feedback ? <p className="text-sm text-contrast/70">{feedback}</p> : null}
              {ordersError ? <p className="text-sm text-rose-300">{ordersError}</p> : null}

              <div className="flex flex-col gap-3">
                {orderStep === 2 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        if (cartItems.length === 0) {
                          setFeedback("Add at least one item to continue.");
                          return;
                        }
                        setFeedback(null);
                        setOrderStep(3);
                      }}
                      className="inline-flex items-center justify-center rounded-full bg-brand px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-md shadow-brand/40 transition hover:-translate-y-0.5 hover:shadow-lg"
                    >
                      Review order
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderStep(1)}
                      className="inline-flex items-center justify-center rounded-full border border-accent-3/60 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-contrast/70 transition hover:border-brand/50 hover:text-brand"
                    >
                      Back to table
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      className="inline-flex items-center justify-center rounded-full bg-brand px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-md shadow-brand/40 transition hover:-translate-y-0.5 hover:shadow-lg"
                    >
                      Send to kitchen
                    </button>
                    {activeSessionId ? (
                      <button
                        type="button"
                        onClick={async () => {
                          const sendResult = await sendPendingItems(activeSessionId);
                          if (!sendResult.ok) {
                            setFeedback(sendResult.error ?? "Unable to send items.");
                            return;
                          }
                          const closeResult = await closeSession(activeSessionId);
                          if (!closeResult.ok) {
                            setFeedback(closeResult.error ?? "Unable to close bill.");
                            return;
                          }
                          setTable("");
                          setCartItems([]);
                          setFeedback(
                            sendResult.skipped ? "Bill closed." : "Order sent and bill closed."
                          );
                          setOrderStep(1);
                          setActiveSessionId(null);
                        }}
                        className="inline-flex items-center justify-center rounded-full border border-amber-400/40 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-amber-100 transition hover:border-amber-300 hover:text-amber-50"
                      >
                        Close bill
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setOrderStep(2)}
                      className="inline-flex items-center justify-center rounded-full border border-accent-3/60 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-contrast/70 transition hover:border-brand/50 hover:text-brand"
                    >
                      Back to items
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setTable("");
                    setCartItems([]);
                    setFeedback(null);
                    setOrderStep(1);
                    setActiveSessionId(null);
                  }}
                  className="inline-flex items-center justify-center rounded-full border border-accent-3/60 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-contrast/70 transition hover:border-brand/50 hover:text-brand"
                >
                  Clear order
                </button>
              </div>
            </>
          )}
        </aside>
      </div>

      {selectedItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/70 backdrop-blur p-4">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0"
            onClick={resetDetailPanel}
          />
          <div className="relative z-10 w-full max-w-xl rounded-3xl border border-accent-3/60 bg-primary p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-accent-3/60 bg-primary/60">
                  <Icon
                    icon={selectedItem.icon_name || fallbackIconName}
                    className="h-6 w-6 text-brand"
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand/70">
                    Customize
                  </p>
                  <h2 className="text-2xl font-semibold text-contrast">{selectedItem.name}</h2>
                  {selectedItem.description ? (
                    <p className="mt-2 text-sm text-contrast/70">{selectedItem.description}</p>
                  ) : null}
                </div>
              </div>
              <span className="rounded-full border border-brand/40 bg-brand/10 px-4 py-2 text-sm font-semibold text-brand">
                {formatCurrency(selectedItem.price)}
              </span>
            </div>

            {detailGroups.length ? (
              <div className="mt-6 space-y-5">
                {detailGroups.map((group) => (
                  <div key={group.id} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-contrast">{group.label}</h3>
                      <span className="text-xs text-contrast/60">
                        {group.type === "single" ? "Choose one" : "Choose any"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {group.options.map((option) => {
                        const isSelected = (selectedModifiers[group.label] ?? []).includes(option);
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => toggleModifier(group, option)}
                            className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                              isSelected
                                ? "border-brand/50 bg-brand/15 text-brand"
                                : "border-accent-3/60 text-contrast/70 hover:border-brand/40 hover:text-brand"
                            }`}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-6 text-sm text-contrast/70">
                No customizations for this item. Add it straight to the order.
              </p>
            )}

            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedQty((prev) => Math.max(1, prev - 1))}
                  className="h-10 w-10 rounded-full border border-accent-3/60 text-lg text-contrast/70 transition hover:border-brand/50 hover:text-brand"
                >
                  -
                </button>
                <span className="min-w-[32px] text-center text-lg font-semibold">
                  {selectedQty}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedQty((prev) => prev + 1)}
                  className="h-10 w-10 rounded-full border border-accent-3/60 text-lg text-contrast/70 transition hover:border-brand/50 hover:text-brand"
                >
                  +
                </button>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={resetDetailPanel}
                  className="rounded-full border border-accent-3/60 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-contrast/70 transition hover:border-brand/50 hover:text-brand"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="rounded-full bg-brand px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-md shadow-brand/40 transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  Add to order
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {billGroup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/70 backdrop-blur p-4">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0"
            onClick={() => setBillTable(null)}
          />
          <div className="relative z-10 flex w-full max-w-2xl max-h-[85vh] flex-col overflow-hidden rounded-3xl border border-accent-3/60 bg-primary p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand/70">
                  Open bill
                </p>
                <h2 className="text-2xl font-semibold text-contrast">
                  {billGroup.table === takeawayLabel ? takeawayLabel : `Table ${billGroup.table}`}
                </h2>
                <p className="mt-1 text-xs text-contrast/60">
                  {billGroup.ordersCount} order{billGroup.ordersCount === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const result = await closeSession(billGroup.sessionId);
                    if (!result.ok) {
                      setFeedback(result.error ?? "Unable to close bill.");
                      return;
                    }
                    setBillTable(null);
                  }}
                  className="rounded-full border border-amber-400/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-100 transition hover:border-amber-300 hover:text-amber-50"
                >
                  Close bill
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTable(billGroup.table);
                    setActiveSessionId(billGroup.sessionId);
                    setOrderStep(2);
                    setBillTable(null);
                  }}
                  className="rounded-full bg-brand px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-md shadow-brand/40 transition hover:-translate-y-0.5"
                >
                  Add items
                </button>
                <button
                  type="button"
                  onClick={() => setBillTable(null)}
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
                  {billGroup.items.map((item, index) => {
                    const modifierLines = formatModifierLines(item.modifiers);
                    return (
                      <div
                        key={`${billGroup.table}-${index}`}
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
                        billGroup.items.reduce(
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
                  {billSummaryLines.length === 0 ? (
                    <p className="text-sm text-contrast/60">No items in this bill.</p>
                  ) : (
                    <div className="space-y-2">
                      {billSummaryLines.map((line) => (
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

export default Cashier;
