import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { useOrders } from "../features/orders/OrdersContext";
import { useMenu } from "../features/menu/MenuContext";
import { useSessions } from "../features/sessions/SessionsContext";
import type { MenuItem } from "../features/menu/MenuContext";
import { toast } from "react-toastify";

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
const COMMON_EXTRAS = [
  "No onion",
  "No veggies",
  "No tomato",
  "No lettuce",
  "No pickles",
  "No cheese",
  "Extra sauce",
];

const normalizeModifiers = (modifiers: Record<string, string[]>) => {
  const sortedEntries = Object.entries(modifiers)
    .map(([group, values]) => [group, [...values].sort()] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(sortedEntries);
};

const modifiersSignature = (modifiers: Record<string, string[]>) =>
  JSON.stringify(normalizeModifiers(modifiers));

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

const buildModifierGroups = (
  item: MenuItem | null,
  sauces: { name: string }[],
  sideOptions: string[],
  isSideItem: boolean,
  isDrinkItem: boolean
) => {
  if (!item) return [];
  const groups: MenuModifierGroup[] = [];
  if (item.allow_sauces && !isDrinkItem) {
    groups.push({
      id: "Sauce",
      label: "Sauce",
      type: "single",
      options: ["No sauce", ...sauces.map((sauce) => sauce.name)],
    });
  }
  if (item.allow_sides && !isSideItem) {
    groups.push({
      id: "Side",
      label: "Side",
      type: "single",
      options: ["No side", ...sideOptions],
    });
  }
  if (!isSideItem && !isDrinkItem && COMMON_EXTRAS.length > 0) {
    groups.push({
      id: "Extras",
      label: "Extras",
      type: "multi",
      options: COMMON_EXTRAS,
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
    isLoading: menuLoading,
    error: menuError,
  } = useMenu();
  const { sessions, createSession, closeSession } = useSessions();
  const takeawayLabel = "Takeaway";

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [table, setTable] = useState(takeawayLabel);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [billTable, setBillTable] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({});
  const [selectedQty, setSelectedQty] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [orderStep, setOrderStep] = useState<1 | 2 | 3>(1);
  const resolvedTable = table.trim() || takeawayLabel;
  const billInputValue = table === takeawayLabel ? "" : table;

  const notify = (message: string, tone: "info" | "success" | "error" = "info") => {
    setFeedback(message);
    toast(message, { type: tone });
  };

  const sideCategory = useMemo(
    () => categories.find((category) => category.name.trim().toLowerCase() === "sides"),
    [categories]
  );
  const drinksCategory = useMemo(
    () => categories.find((category) => category.name.trim().toLowerCase() === "drinks"),
    [categories]
  );
  const sideItems = useMemo(
    () => (sideCategory ? items.filter((item) => item.category_id === sideCategory.id) : []),
    [items, sideCategory]
  );
  const sideOptions = useMemo(() => sideItems.map((item) => item.name), [sideItems]);
  const sidePriceByName = useMemo(
    () => new Map(sideItems.map((item) => [item.name, item.price])),
    [sideItems]
  );

  const detailGroups = useMemo(
    () =>
      buildModifierGroups(
        selectedItem,
        sauces,
        sideOptions,
        Boolean(selectedItem && sideCategory && selectedItem.category_id === sideCategory.id),
        Boolean(selectedItem && drinksCategory && selectedItem.category_id === drinksCategory.id)
      ),
    [selectedItem, sauces, sideOptions, sideCategory, drinksCategory]
  );

  const itemsForCategory = useMemo(() => {
    if (!activeCategoryId) return [];
    return items.filter((item) => item.category_id === activeCategoryId);
  }, [items, activeCategoryId]);

  const topSellers = useMemo(() => {
    const counts = new Map<string, number>();
    orders.forEach((order) => {
      order.items.forEach((item) => {
        const name = item.name?.trim();
        if (!name) return;
        counts.set(name, (counts.get(name) ?? 0) + Math.max(0, item.quantity));
      });
    });
    const itemByName = new Map(items.map((item) => [item.name, item]));
    return Array.from(counts.entries())
      .map(([name, quantity]) => ({
        name,
        quantity,
        menuItem: itemByName.get(name) ?? null,
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [orders, items]);

  const cartTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      const sideName = item.modifiers.Side?.[0];
      const sidePrice =
        sideName && sideName !== "No side" ? sidePriceByName.get(sideName) ?? 0 : 0;
      return sum + item.quantity * (item.menuItem.price + sidePrice);
    }, 0);
  }, [cartItems, sidePriceByName]);

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
    const existing = sessionByTable.get(resolvedTable);
    setActiveSessionId(existing?.id ?? null);
  }, [resolvedTable, sessionByTable]);

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
    const groups = buildModifierGroups(
      item,
      sauces,
      sideOptions,
      Boolean(sideCategory && item.category_id === sideCategory.id),
      Boolean(drinksCategory && item.category_id === drinksCategory.id)
    );
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
    if (cartItems.length === 0) {
      notify("Select at least one menu item before submitting.", "error");
      return;
    }

    const tableName = resolvedTable;
    const isTakeaway = tableName === takeawayLabel;
    let sessionId = activeSessionId;
    if (!sessionId) {
      const created = await createSession(tableName);
      if (!created.ok || !created.session) {
        notify(created.error ?? "Unable to open a session.", "error");
        return;
      }
      sessionId = created.session.id;
      setActiveSessionId(sessionId);
    }

    const result = await addOrder({
      table: tableName,
      sessionId,
      items: cartItems.map((item) => ({
        name: item.menuItem.name,
        quantity: item.quantity,
        modifiers: item.modifiers,
        price:
          item.menuItem.price +
          (item.modifiers.Side?.[0] && item.modifiers.Side?.[0] !== "No side"
            ? sidePriceByName.get(item.modifiers.Side[0]) ?? 0
            : 0),
        registerCode: item.menuItem.register_code ?? undefined,
        showInKitchen: item.menuItem.show_in_kitchen,
      })),
    });

    if (!result.ok) {
      notify(result.error ?? "Unable to send order right now.", "error");
      return;
    }

    let closeError: string | null = null;
    if (isTakeaway && sessionId) {
      const closeResult = await closeSession(sessionId);
      if (!closeResult.ok) {
        closeError = closeResult.error ?? "Unable to close takeaway bill.";
      }
    }

    setTable(takeawayLabel);
    setCartItems([]);
    if (closeError) {
      notify(`Order sent, but ${closeError}`, "error");
    } else {
      notify(
        isTakeaway ? "Order sent and takeaway bill closed." : "Order sent to the kitchen.",
        "success"
      );
    }
    setOrderStep(1);
    setActiveSessionId(null);
  };

  const sendPendingItems = async (sessionId: string) => {
    if (cartItems.length === 0) {
      return { ok: true, skipped: true };
    }
    const result = await addOrder({
      table: resolvedTable,
      sessionId,
      items: cartItems.map((item) => ({
        name: item.menuItem.name,
        quantity: item.quantity,
        modifiers: item.modifiers,
        price:
          item.menuItem.price +
          (item.modifiers.Side?.[0] && item.modifiers.Side?.[0] !== "No side"
            ? sidePriceByName.get(item.modifiers.Side[0]) ?? 0
            : 0),
        registerCode: item.menuItem.register_code ?? undefined,
        showInKitchen: item.menuItem.show_in_kitchen,
      })),
    });
    return { ok: result.ok, error: result.error };
  };

  return (
    <section className="space-y-10">
      {menuError ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {menuError}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 rounded-3xl border border-accent-3/60 bg-accent-1/70 p-4 text-xs font-semibold uppercase tracking-[0.2em] text-contrast/70">
        <span className={orderStep === 1 ? "text-brand" : ""}>1. Items</span>
        <span className={orderStep === 2 ? "text-brand" : ""}>2. Bill & Send</span>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_0.6fr]">
        <section className="space-y-6">
          {orderStep === 1 ? (
            <>
              {topSellers.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-contrast/60">
                      Top sellers
                    </h3>
                    <span className="text-xs text-contrast/50">All time</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {topSellers.map((entry) => {
                      const canOpen = Boolean(entry.menuItem);
                      return (
                        <button
                          key={entry.name}
                          type="button"
                          disabled={!canOpen}
                          onClick={() => {
                            if (entry.menuItem) {
                              openDetailPanel(entry.menuItem);
                            }
                          }}
                          className="group rounded-2xl border border-accent-3/60 bg-primary/70 p-3 text-left text-xs text-contrast shadow-sm transition hover:-translate-y-0.5 hover:border-brand/50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-accent-3/60 bg-primary/60">
                                <Icon
                                  icon={entry.menuItem?.icon_name || fallbackIconName}
                                  className="h-4 w-4 text-brand"
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-contrast">
                                  {entry.name}
                                </p>
                                <p className="text-[10px] text-contrast/60">
                                  {entry.quantity.toLocaleString()} sold
                                </p>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

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
                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                          <h3 className="line-clamp-2 text-lg font-semibold leading-tight text-contrast">
                            {item.name}
                          </h3>
                          <div className="flex min-w-0 items-start gap-3">
                            <span className="min-w-[88px] flex-shrink-0 rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-center text-xs font-semibold tabular-nums text-brand">
                              {formatCurrency(item.price)}
                            </span>
                            {item.description ? (
                              <p className="text-xs text-contrast/70">{item.description}</p>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-accent-3/60 bg-primary/60">
                          <Icon
                            icon={item.icon_name || fallbackIconName}
                            className="h-6 w-6 text-brand"
                          />
                        </div>
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
              <h2 className="text-xl font-semibold text-contrast">Review order</h2>
              <p className="mt-2">
                Check totals and register codes before sending.
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
            </div>
          )}
        </section>

        <aside className="space-y-6 rounded-3xl border border-accent-3/60 bg-accent-2/70 p-6 shadow-lg shadow-accent-4/20">
          {orderStep === 2 ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-contrast/80" htmlFor="table">
                  Bill name (optional)
                </label>
                <input
                  id="table"
                  value={billInputValue}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (nextValue.trim()) {
                      setTable(nextValue);
                    } else {
                      setTable(takeawayLabel);
                    }
                  }}
                  className="mt-3 w-full rounded-2xl border border-accent-3/60 bg-primary/70 px-4 py-3 text-sm text-contrast outline-none transition focus:border-brand/60"
                  placeholder="e.g. Window 1, Marek"
                  autoComplete="off"
                />
                <p className="mt-2 text-xs text-contrast/60">
                  Leave empty for takeaway. Enter a name to open a bill.
                </p>
              </div>
              {activeSessionId && billInputValue.trim() ? (
                <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
                  Open bill active
                </div>
              ) : null}

              
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
                  const sideName = item.modifiers.Side?.[0];
                  const sidePrice =
                    sideName && sideName !== "No side" ? sidePriceByName.get(sideName) ?? 0 : 0;
                  const unitPrice = item.menuItem.price + sidePrice;
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
                        <span>{formatCurrency(unitPrice * item.quantity)}</span>
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
            {orderStep === 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (cartItems.length === 0 && existingItems.length === 0) {
                      notify("Add at least one item to continue.", "error");
                      return;
                    }
                    setFeedback(null);
                    setOrderStep(2);
                  }}
                  className="inline-flex items-center justify-center rounded-full bg-brand px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-md shadow-brand/40 transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  Bill & send
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
                {activeSessionId && billInputValue.trim() ? (
                  <button
                    type="button"
                    onClick={async () => {
                      const sendResult = await sendPendingItems(activeSessionId);
                      if (!sendResult.ok) {
                        notify(sendResult.error ?? "Unable to send items.", "error");
                        return;
                      }
                      const closeResult = await closeSession(activeSessionId);
                      if (!closeResult.ok) {
                        notify(closeResult.error ?? "Unable to close bill.", "error");
                        return;
                      }
                      setTable(takeawayLabel);
                      setCartItems([]);
                      notify(sendResult.skipped ? "Bill closed." : "Order sent and bill closed.", "success");
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
                  onClick={() => setOrderStep(1)}
                  className="inline-flex items-center justify-center rounded-full border border-accent-3/60 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-contrast/70 transition hover:border-brand/50 hover:text-brand"
                >
                  Back to items
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setTable(takeawayLabel);
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
                        const sidePrice =
                          group.label === "Side" && option !== "No side"
                            ? sidePriceByName.get(option)
                            : undefined;
                        const optionLabel =
                          sidePrice !== undefined ? `${option} (+${formatCurrency(sidePrice)})` : option;
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
                            {optionLabel}
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
                  {billGroup.table === takeawayLabel ? takeawayLabel : `Bill ${billGroup.table}`}
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
                      notify(result.error ?? "Unable to close bill.", "error");
                      return;
                    }
                    notify("Bill closed.", "success");
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
                    setOrderStep(1);
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
