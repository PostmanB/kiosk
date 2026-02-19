import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import { useOrders } from "../features/orders/OrdersContext";
import { useMenu } from "../features/menu/MenuContext";
import { useSessions } from "../features/sessions/SessionsContext";
import type { MenuItem } from "../features/menu/MenuContext";
import { toast } from "react-toastify";
import useLockBodyScroll from "../hooks/useLockBodyScroll";
import { printKitchenTicket } from "../lib/printing";

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
const SIDE_CATEGORY_NAMES = ["sides", "köretek"];
const DRINKS_CATEGORY_NAMES = ["drinks", "italok"];

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
const isSideCategoryName = (name: string) =>
  SIDE_CATEGORY_NAMES.includes(name.trim().toLowerCase());
const isDrinksCategoryName = (name: string) =>
  DRINKS_CATEGORY_NAMES.includes(name.trim().toLowerCase());
const formatCategoryName = (name: string) => {
  const normalized = name.trim().toLowerCase();
  if (normalized === "sides") return "Köretek";
  if (normalized === "drinks") return "Italok";
  return name;
};
const fallbackIconName = "ph:fork-knife";
const COMMON_EXTRAS = [
  "Hagyma nélkül",
  "Zöldség nélkül",
  "Paradicsom nélkül",
  "Saláta nélkül",
  "Uborka nélkül",
  "Sajt nélkül",
  "Extra szósz",
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

const buildKitchenPrintItems = (items: CartItem[]) =>
  items
    .filter((item) => item.menuItem.show_in_kitchen !== false)
    .map((item) => ({
      name: item.menuItem.name,
      quantity: item.quantity,
      modifiers: item.modifiers,
    }));

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
      label: "Szósz",
      type: "multi",
      options: [NO_SAUCE_VALUE, ...sauces.map((sauce) => sauce.name)],
    });
  }
  if (item.allow_sides && !isSideItem) {
    groups.push({
      id: "Side",
      label: "Köret",
      type: "single",
      options: [NO_SIDE_VALUE, ...sideOptions],
    });
  }
  if (!isSideItem && !isDrinkItem && COMMON_EXTRAS.length > 0) {
    groups.push({
      id: "Extras",
      label: "Extrák",
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
  const { orders, addOrder, error: ordersError } = useOrders();
  const {
    categories,
    items,
    sauces,
    error: menuError,
  } = useMenu();
  const { sessions, createSession, closeSession } = useSessions();
  const takeawayLabel = TAKEAWAY_LABEL;
  const portalTarget = typeof document !== "undefined" ? document.body : null;

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [table, setTable] = useState(TAKEAWAY_VALUE);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [billTable, setBillTable] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({});
  const [selectedQty, setSelectedQty] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [orderStep, setOrderStep] = useState<1 | 2 | 3>(1);
  const [panelTransition, setPanelTransition] = useState<"idle" | "out" | "in">("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const resolvedTable = table.trim() || TAKEAWAY_VALUE;
  const billInputValue = isTakeaway(table) ? "" : table;

  const notify = (message: string, tone: "info" | "success" | "error" = "info") => {
    setFeedback(message);
    toast(message, { type: tone });
  };

  const sideCategory = useMemo(
    () => categories.find((category) => isSideCategoryName(category.name)),
    [categories]
  );
  const drinksCategory = useMemo(
    () => categories.find((category) => isDrinksCategoryName(category.name)),
    [categories]
  );
  const activeItems = useMemo(
    () => items.filter((item) => item.is_active !== false),
    [items]
  );
  const sideItems = useMemo(
    () =>
      sideCategory ? activeItems.filter((item) => item.category_id === sideCategory.id) : [],
    [activeItems, sideCategory]
  );
  const allSideItems = useMemo(
    () => (sideCategory ? items.filter((item) => item.category_id === sideCategory.id) : []),
    [items, sideCategory]
  );
  const sideOptions = useMemo(() => sideItems.map((item) => item.name), [sideItems]);
  const sidePriceByName = useMemo(
    () => new Map(allSideItems.map((item) => [item.name, item.price])),
    [allSideItems]
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
      .filter((entry) => entry.menuItem)
      .filter((entry) => entry.menuItem?.is_active !== false)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [orders, items]);

  const cartTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      const sideName = item.modifiers["Side"]?.[0];
      const sidePrice =
        sideName && sideName !== NO_SIDE_VALUE ? sidePriceByName.get(sideName) ?? 0 : 0;
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
  useLockBodyScroll(Boolean(selectedItem) || Boolean(billGroup));
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
    if (isTakeaway(resolvedTable)) {
      const existing =
        sessionByTable.get(TAKEAWAY_VALUE) ?? sessionByTable.get(TAKEAWAY_LABEL) ?? null;
      setActiveSessionId(existing?.id ?? null);
      return;
    }
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
        defaults[group.id] = [group.options[0]];
      } else {
        defaults[group.id] = [];
      }
    });
    setSelectedItem(item);
    setSelectedModifiers(defaults);
    setSelectedQty(1);
  };

  const toggleModifier = (group: MenuModifierGroup, option: string) => {
    setSelectedModifiers((prev) => {
      const existing = prev[group.id] ?? [];
      if (group.type === "single") {
        return { ...prev, [group.id]: [option] };
      }
      if (group.id === "Sauce") {
        if (option === NO_SAUCE_VALUE) {
          return { ...prev, [group.id]: [NO_SAUCE_VALUE] };
        }
        const withoutNoSauce = existing.filter((value) => value !== NO_SAUCE_VALUE);
        const next = withoutNoSauce.includes(option)
          ? withoutNoSauce.filter((value) => value !== option)
          : [...withoutNoSauce, option];
        return { ...prev, [group.id]: next };
      }
      const next = existing.includes(option)
        ? existing.filter((value) => value !== option)
        : [...existing, option];
      return { ...prev, [group.id]: next };
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

  const panelExitDurationMs = 300;
  const panelEnterDurationMs = 320;
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleSubmit = async () => {
    if (isSubmitting || panelTransition !== "idle") return;
    setIsSubmitting(true);

    if (cartItems.length === 0) {
      notify("Válassz legalább egy tételt a beküldéshez.", "error");
      setIsSubmitting(false);
      return;
    }

    const tableName = resolvedTable;
    const isTakeawayOrder = isTakeaway(tableName);
    let sessionId = activeSessionId;
    if (!sessionId) {
      const created = await createSession(tableName);
      if (!created.ok || !created.session) {
        notify(created.error ?? "Nem sikerült munkamenetet nyitni.", "error");
        setIsSubmitting(false);
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
          (item.modifiers["Side"]?.[0] && item.modifiers["Side"]?.[0] !== NO_SIDE_VALUE
            ? sidePriceByName.get(item.modifiers["Side"][0]) ?? 0
            : 0),
        registerCode: item.menuItem.register_code ?? undefined,
        showInKitchen: item.menuItem.show_in_kitchen,
      })),
    });

    if (!result.ok) {
      notify(result.error ?? "A rendelést most nem lehet elküldeni.", "error");
      setIsSubmitting(false);
      return;
    }

    const kitchenItems = buildKitchenPrintItems(cartItems);
    if (kitchenItems.length > 0) {
      const printResult = printKitchenTicket({
        type: "kitchen",
        table: tableName,
        createdAt: new Date().toISOString(),
        items: kitchenItems,
        paperWidthMm: 58,
      });
      if (printResult.supported && !printResult.ok) {
        toast("A konyhai nyomtató nem válaszol. Ellenőrizd a Bluetooth-t.", { type: "error" });
      }
    }

    let closeError: string | null = null;
    if (isTakeawayOrder && sessionId) {
      const closeResult = await closeSession(sessionId);
      if (!closeResult.ok) {
        closeError = closeResult.error ?? "Nem sikerült lezárni az elviteles számlát.";
      }
    }

    if (closeError) {
      notify(`Rendelés elküldve, de ${closeError}`, "error");
    } else {
      notify(
        isTakeawayOrder
          ? "Rendelés elküldve, és az elviteles számla lezárva."
          : "Rendelés elküldve a konyhára.",
        "success"
      );
    }

    setPanelTransition("out");
    await sleep(panelExitDurationMs);

    setTable(TAKEAWAY_VALUE);
    setCartItems([]);
    setOrderStep(1);
    setActiveSessionId(null);

    setPanelTransition("in");
    await sleep(panelEnterDurationMs);
    setPanelTransition("idle");
    setIsSubmitting(false);
  };

  const panelAnimationClass =
    panelTransition === "out"
      ? "animate-fly-up-out"
      : panelTransition === "in"
        ? "animate-slide-up-in"
        : "";
  const panelIsAnimating = panelTransition !== "idle";
  const panelIsLocked = isSubmitting || panelIsAnimating;

  return (
    <section className="space-y-10">
      {menuError ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {menuError}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 rounded-3xl border border-accent-3/60 bg-accent-1/70 p-4 text-xs font-semibold uppercase tracking-[0.2em] text-contrast/70">
        <span className={orderStep === 1 ? "text-brand" : ""}>1. Tételek</span>
        <span className={orderStep === 2 ? "text-brand" : ""}>2. Számla és küldés</span>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_0.6fr]">
        <section className="space-y-6">
          {orderStep === 1 ? (
            <>
              {topSellers.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-contrast/60">
                      Legnépszerűbbek
                    </h3>
                    <span className="text-xs text-contrast/50">Összesen</span>
                  </div>
                  <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                    {topSellers.map((entry) => {
                      const canOpen = Boolean(entry.menuItem && entry.menuItem.is_active !== false);
                      return (
                        <button
                          key={entry.name}
                          type="button"
                          disabled={!canOpen}
                          onClick={() => {
                            if (entry.menuItem && entry.menuItem.is_active !== false) {
                              openDetailPanel(entry.menuItem);
                            }
                          }}
                          className={`group rounded-2xl border border-accent-3/60 bg-primary/70 p-3 text-left text-xs text-contrast shadow-sm transition ${
                            canOpen
                              ? "hover:-translate-y-0.5 hover:border-brand/50"
                              : "cursor-not-allowed opacity-50"
                          }`}
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
                                  {entry.quantity.toLocaleString()} eladva
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
                    Még nincs menükategória. Add hozzá az Adminban.
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
                      {formatCategoryName(category.name)}
                    </button>
                  ))
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {itemsForCategory.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-accent-3/60 bg-accent-1/80 p-6 text-sm text-contrast/60">
                    Még nincs tétel ebben a kategóriában.
                  </div>
                ) : (
                  itemsForCategory.map((item) => {
                    const isActive = item.is_active !== false;
                    return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!isActive}
                      onClick={() => {
                        if (isActive) {
                          openDetailPanel(item);
                        }
                      }}
                      className={`group relative overflow-hidden rounded-3xl border border-accent-3/60 bg-accent-1/80 p-5 text-left shadow-lg shadow-accent-4/20 transition ${
                        isActive
                          ? "hover:-translate-y-1 hover:border-brand/50"
                          : "cursor-not-allowed"
                      }`}
                    >
                      {!isActive ? (
                        <span className="pointer-events-none absolute inset-0">
                          <span className="absolute left-1/2 top-1/2 w-[200%] -translate-x-1/2 -translate-y-1/2 -rotate-[18deg] text-center text-3xl font-extrabold uppercase tracking-[0.35em] text-rose-500">
                            Elfogyott
                          </span>
                        </span>
                      ) : null}
                      <div className={isActive ? "" : "opacity-35"}>
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
                            {item.allow_sauces || item.allow_sides ? "Testreszabás" : "Gyors hozzáadás"}
                          </span>
                          <span className={isActive ? "text-brand/70 transition group-hover:text-brand" : "text-contrast/50"}>
                            {isActive ? "Érintsd meg a hozzáadáshoz" : "Inaktív"}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
                )}
              </div>
            </>
          ) : (
            <div className="rounded-3xl border border-accent-3/60 bg-accent-1/80 p-8 text-sm text-contrast/70">
              <h2 className="text-xl font-semibold text-contrast">Rendelés ellenőrzése</h2>
              <p className="mt-2">
                Ellenőrizd az összegeket és a regiszterkódokat küldés előtt.
              </p>
              <div className="mt-6 space-y-3">
                {reviewLines.length === 0 ? (
                  <p className="text-sm text-contrast/60">Nincsenek tételek a rendelésben.</p>
                ) : (
                  reviewLines.map((line) => (
                    <div
                      key={`${line.name}-${line.registerCode ?? "none"}`}
                      className="flex items-center justify-between rounded-2xl border border-accent-3/60 bg-primary/70 px-4 py-3 text-sm text-contrast"
                    >
                      <div>
                        <p className="font-semibold">{line.quantity}x {line.name}</p>
                        <p className="text-xs text-contrast/60">
                          Kód {line.registerCode ?? "—"}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </section>

        <aside className={`space-y-6 rounded-3xl border border-accent-3/60 bg-accent-2/70 p-6 shadow-lg shadow-accent-4/20 ${panelAnimationClass} ${panelIsAnimating ? "pointer-events-none" : ""}`} aria-busy={panelIsLocked}>
          {orderStep === 2 ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-contrast/80" htmlFor="table">
                  Számla neve (opcionális)
                </label>
                <input
                  id="table"
                  value={billInputValue}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (nextValue.trim()) {
                      setTable(nextValue);
                    } else {
                      setTable(TAKEAWAY_VALUE);
                    }
                  }}
                  className="mt-3 w-full rounded-2xl border border-accent-3/60 bg-primary/70 px-4 py-3 text-sm text-contrast outline-none transition focus:border-brand/60"
                  placeholder="pl. Ablak 1, Marek"
                  autoComplete="off"
                />
                <p className="mt-2 text-xs text-contrast/60">
                  Hagyd üresen elvitelhez. Adj nevet a számla megnyitásához.
                </p>
              </div>
              {activeSessionId && billInputValue.trim() ? (
                <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
                  Nyitott számla aktív
                </div>
              ) : null}

              
            </div>
          ) : null}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-contrast/80">
                Aktuális rendelés
              </h3>
              <span className="text-xs text-contrast/60">{cartItems.length} tétel</span>
            </div>
            {existingItems.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-contrast/60">
                  Meglévő tételek
                </p>
                {existingItems.map((item, index) => {
                  const modifierLines = Object.entries(item.modifiers ?? {})
                    .filter(([, values]) => values.length > 0)
                    .map(([group, values]) => {
                      const label = formatModifierGroup(group);
                      const displayValues = values.map((value) => formatModifierValue(value));
                      return `${label}: ${displayValues.join(", ")}`;
                    });
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
                Válassz tételeket a menükártyákról a rendelés indításához.
              </p>
            ) : (
              <div className="space-y-3">
                {existingItems.length > 0 ? (
                  <p className="text-xs font-semibold uppercase tracking-wide text-contrast/60">
                    Új tételek
                  </p>
                ) : null}
                {cartItems.map((item) => {
                  const modifierLines = Object.entries(item.modifiers)
                    .filter(([, values]) => values.length > 0)
                    .map(([group, values]) => {
                      const label = formatModifierGroup(group);
                      const displayValues = values.map((value) => formatModifierValue(value));
                      return `${label}: ${displayValues.join(", ")}`;
                    });
                  const sideName = item.modifiers["Side"]?.[0];
                  const sidePrice =
                    sideName && sideName !== NO_SIDE_VALUE
                      ? sidePriceByName.get(sideName) ?? 0
                      : 0;
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
                          Eltávolítás
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
              <span>Összesen</span>
              <span className="text-base font-semibold text-contrast">
                {formatCurrency(combinedTotal)}
              </span>
            </div>
            {existingItems.length > 0 ? (
              <p className="mt-1 text-[11px] text-contrast/60">
                Tartalmaz {formatCurrency(existingTotal)} értéket a meglévő tételekből.
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
                      notify("Adj hozzá legalább egy tételt a folytatáshoz.", "error");
                      return;
                    }
                    setFeedback(null);
                    setOrderStep(2);
                  }}
                  disabled={panelIsLocked}
                  className="inline-flex items-center justify-center rounded-full bg-brand px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-md shadow-brand/40 transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Számla és küldés
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={panelIsLocked}
                  className="inline-flex items-center justify-center rounded-full bg-brand px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-md shadow-brand/40 transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Küldés a konyhára
                </button>
                <button
                  type="button"
                  onClick={() => setOrderStep(1)}
                  disabled={panelIsLocked}
                  className="inline-flex items-center justify-center rounded-full border border-accent-3/60 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-contrast/70 transition hover:border-brand/50 hover:text-brand disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Vissza a tételekhez
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setTable(TAKEAWAY_VALUE);
                setCartItems([]);
                setFeedback(null);
                setOrderStep(1);
                setActiveSessionId(null);
              }}
              disabled={panelIsLocked}
              className="inline-flex items-center justify-center rounded-full border border-accent-3/60 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-contrast/70 transition hover:border-brand/50 hover:text-brand disabled:cursor-not-allowed disabled:opacity-70"
            >
              Rendelés törlése
            </button>
          </div>
        </aside>
      </div>

      {selectedItem && portalTarget
        ? createPortal(
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-primary/60 backdrop-blur-lg p-4">
          <button
            type="button"
            aria-label="Bezárás"
            className="absolute inset-0"
            onClick={resetDetailPanel}
          />
          <div className="relative z-10 w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-3xl border border-accent-3/60 bg-primary p-6 shadow-2xl">
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
                    Testreszabás
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
                        {group.type === "single" ? "Válassz egyet" : "Válassz tetszőlegesen"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.options.map((option) => {
                        const isSelected = (selectedModifiers[group.id] ?? []).includes(option);
                        const sidePrice =
                          group.id === "Side" && option !== NO_SIDE_VALUE
                            ? sidePriceByName.get(option)
                            : undefined;
                        const labelBase = formatModifierValue(option);
                        const optionLabel =
                          sidePrice !== undefined
                            ? `${labelBase} (+${formatCurrency(sidePrice)})`
                            : labelBase;
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
                Ehhez a tételhez nincs testreszabás. Add hozzá közvetlenül a rendeléshez.
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
                  Mégse
                </button>
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="rounded-full bg-brand px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-md shadow-brand/40 transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  Hozzáadás a rendeléshez
                </button>
              </div>
            </div>
          </div>
        </div>,
            portalTarget
          )
        : null}

      {billGroup && portalTarget
        ? createPortal(
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-primary/60 backdrop-blur-lg p-4">
          <button
            type="button"
            aria-label="Bezárás"
            className="absolute inset-0"
            onClick={() => setBillTable(null)}
          />
          <div className="relative z-10 flex w-full max-w-2xl max-h-[85vh] flex-col overflow-hidden rounded-3xl border border-accent-3/60 bg-primary p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand/70">
                  Nyitott számla
                </p>
                <h2 className="text-2xl font-semibold text-contrast">
                  {isTakeaway(billGroup.table)
                    ? takeawayLabel
                    : `Számla ${billGroup.table}`}
                </h2>
                <p className="mt-1 text-xs text-contrast/60">
                  {billGroup.ordersCount} rendelés
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const result = await closeSession(billGroup.sessionId);
                    if (!result.ok) {
                      notify(result.error ?? "Nem sikerült lezárni a számlát.", "error");
                      return;
                    }
                    notify("Számla lezárva.", "success");
                    setBillTable(null);
                  }}
                  className="rounded-full border border-amber-400/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-100 transition hover:border-amber-300 hover:text-amber-50"
                >
                  Számla lezárása
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
                  Tételek hozzáadása
                </button>
                <button
                  type="button"
                  onClick={() => setBillTable(null)}
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
                    <span>Összesen</span>
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
                    Összegzés
                  </h3>
                  {billSummaryLines.length === 0 ? (
                    <p className="text-sm text-contrast/60">Nincs tétel ezen a számlán.</p>
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
                            Kód {line.registerCode ?? "—"}
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

export default Cashier;
