import { useMemo, useState } from "react";
import { useOrders } from "../features/orders/OrdersContext";

type MenuModifierGroup = {
  id: string;
  label: string;
  type: "single" | "multi";
  options: string[];
};

type MenuItem = {
  id: string;
  name: string;
  price: number;
  category: string;
  description?: string;
  modifiers?: MenuModifierGroup[];
};

type CartItem = {
  id: string;
  menuItem: MenuItem;
  quantity: number;
  modifiers: Record<string, string[]>;
};

const MENU_ITEMS: MenuItem[] = [
  {
    id: "hamburger",
    name: "Hamburger",
    price: 2.7,
    category: "Burgery",
    description: "Classic beef burger with fresh garnish.",
    modifiers: [
      {
        id: "Sauce",
        label: "Sauce",
        type: "single",
        options: ["No sauce", "Gyros", "Garlic", "Chili", "Mushroom", "Ketchup", "Tatarska"],
      },
      {
        id: "Side",
        label: "Side",
        type: "single",
        options: ["No side", "Hranolky", "Americke zemiaky", "Salat"],
      },
      {
        id: "Extras",
        label: "Extras",
        type: "multi",
        options: ["Extra syr", "Extra slanina", "Jalapeno"],
      },
    ],
  },
  {
    id: "cheeseburger",
    name: "Cheeseburger",
    price: 3.0,
    category: "Burgery",
    description: "Melted cheese, grilled beef, soft bun.",
    modifiers: [
      {
        id: "Sauce",
        label: "Sauce",
        type: "single",
        options: ["No sauce", "Gyros", "Garlic", "Chili", "Mushroom", "Ketchup", "Tatarska"],
      },
      {
        id: "Side",
        label: "Side",
        type: "single",
        options: ["No side", "Hranolky", "Americke zemiaky", "Salat"],
      },
      {
        id: "Extras",
        label: "Extras",
        type: "multi",
        options: ["Extra syr", "Extra slanina", "Jalapeno"],
      },
    ],
  },
  {
    id: "chicken-burger",
    name: "Chicken burger",
    price: 4.1,
    category: "Burgery",
    description: "Crispy chicken fillet, light sauce.",
    modifiers: [
      {
        id: "Sauce",
        label: "Sauce",
        type: "single",
        options: ["No sauce", "Gyros", "Garlic", "Chili", "Mushroom", "Ketchup", "Tatarska"],
      },
      {
        id: "Side",
        label: "Side",
        type: "single",
        options: ["No side", "Hranolky", "Americke zemiaky", "Salat"],
      },
      {
        id: "Extras",
        label: "Extras",
        type: "multi",
        options: ["Extra syr", "Extra slanina", "Jalapeno"],
      },
    ],
  },
  {
    id: "doubleburger",
    name: "Doubleburger",
    price: 3.5,
    category: "Burgery",
    description: "Two patties, double appetite.",
    modifiers: [
      {
        id: "Sauce",
        label: "Sauce",
        type: "single",
        options: ["No sauce", "Gyros", "Garlic", "Chili", "Mushroom", "Ketchup", "Tatarska"],
      },
      {
        id: "Side",
        label: "Side",
        type: "single",
        options: ["No side", "Hranolky", "Americke zemiaky", "Salat"],
      },
      {
        id: "Extras",
        label: "Extras",
        type: "multi",
        options: ["Extra syr", "Extra slanina", "Jalapeno"],
      },
    ],
  },
  {
    id: "gyros-plate",
    name: "Gyros na tanieri",
    price: 4.1,
    category: "Gyros",
    description: "Gyros served on a plate with a side.",
    modifiers: [
      {
        id: "Sauce",
        label: "Sauce",
        type: "single",
        options: ["No sauce", "Gyros", "Garlic", "Chili", "Mushroom", "Ketchup", "Tatarska"],
      },
      {
        id: "Side",
        label: "Side",
        type: "single",
        options: ["Ryza", "Hranolky", "Americke zemiaky"],
      },
    ],
  },
  {
    id: "gyros-pita",
    name: "Gyros pita",
    price: 3.5,
    category: "Gyros",
    description: "Gyros wrapped in warm pita.",
    modifiers: [
      {
        id: "Sauce",
        label: "Sauce",
        type: "single",
        options: ["No sauce", "Gyros", "Garlic", "Chili", "Mushroom", "Ketchup", "Tatarska"],
      },
    ],
  },
  {
    id: "gyros-twister",
    name: "Gyros twister",
    price: 3.5,
    category: "Gyros",
    description: "Gyros wrap with fresh salad.",
    modifiers: [
      {
        id: "Sauce",
        label: "Sauce",
        type: "single",
        options: ["No sauce", "Gyros", "Garlic", "Chili", "Mushroom", "Ketchup", "Tatarska"],
      },
    ],
  },
  {
    id: "gyros-tornado",
    name: "Gyros tornado",
    price: 3.6,
    category: "Gyros",
    description: "Wrap with crispy onion and cheese.",
    modifiers: [
      {
        id: "Sauce",
        label: "Sauce",
        type: "single",
        options: ["No sauce", "Gyros", "Garlic", "Chili", "Mushroom", "Ketchup", "Tatarska"],
      },
    ],
  },
  {
    id: "veggieburger",
    name: "Veggieburger",
    price: 3.0,
    category: "Burgery",
    description: "Plant-based patty and crisp toppings.",
    modifiers: [
      {
        id: "Sauce",
        label: "Sauce",
        type: "single",
        options: ["No sauce", "Gyros", "Garlic", "Chili", "Mushroom", "Ketchup", "Tatarska"],
      },
      {
        id: "Side",
        label: "Side",
        type: "single",
        options: ["No side", "Hranolky", "Americke zemiaky", "Salat"],
      },
      {
        id: "Extras",
        label: "Extras",
        type: "multi",
        options: ["Extra syr", "Extra slanina", "Jalapeno"],
      },
    ],
  },
  {
    id: "hranolky",
    name: "Hranolky",
    price: 1.6,
    category: "Prilohy",
    description: "Golden fries, lightly salted.",
    modifiers: [
      {
        id: "Dip",
        label: "Dip",
        type: "single",
        options: ["No dip", "Kecup", "Majoneza", "Tatarska"],
      },
      {
        id: "Size",
        label: "Size",
        type: "single",
        options: ["Small", "Medium", "Large"],
      },
    ],
  },
  {
    id: "americke-zemiaky",
    name: "Americke zemiaky",
    price: 1.6,
    category: "Prilohy",
    description: "Seasoned potato wedges.",
    modifiers: [
      {
        id: "Dip",
        label: "Dip",
        type: "single",
        options: ["No dip", "Kecup", "Majoneza", "Tatarska"],
      },
      {
        id: "Size",
        label: "Size",
        type: "single",
        options: ["Small", "Medium", "Large"],
      },
    ],
  },
  {
    id: "cibulove-kruzky",
    name: "Cibulove kruzky",
    price: 1.7,
    category: "Prilohy",
    description: "Crunchy onion rings.",
    modifiers: [
      {
        id: "Dip",
        label: "Dip",
        type: "single",
        options: ["No dip", "Kecup", "Majoneza", "Tatarska"],
      },
    ],
  },
  {
    id: "krokety",
    name: "Krokety",
    price: 1.6,
    category: "Prilohy",
    description: "Potato croquettes, crispy outside.",
    modifiers: [
      {
        id: "Dip",
        label: "Dip",
        type: "single",
        options: ["No dip", "Kecup", "Majoneza", "Tatarska"],
      },
    ],
  },
  {
    id: "palacinky",
    name: "Palacinky",
    price: 1.6,
    category: "Dezerty",
    description: "Sweet crepes with light filling.",
    modifiers: [
      {
        id: "Filling",
        label: "Filling",
        type: "single",
        options: ["Nutella", "Dzem", "Tvaroh"],
      },
    ],
  },
  {
    id: "gofry",
    name: "Gofry",
    price: 1.7,
    category: "Dezerty",
    description: "Warm waffles with toppings.",
    modifiers: [
      {
        id: "Topping",
        label: "Topping",
        type: "multi",
        options: ["Nutella", "Ovocie", "Slag", "Coko"],
      },
    ],
  },
  {
    id: "cola",
    name: "Cola 0.5l",
    price: 1.2,
    category: "Napoje",
    description: "Chilled soft drink.",
    modifiers: [
      {
        id: "Ice",
        label: "Ice",
        type: "single",
        options: ["No ice", "Ice"],
      },
      {
        id: "Lid",
        label: "Lid",
        type: "single",
        options: ["No lid", "With lid"],
      },
    ],
  },
  {
    id: "voda",
    name: "Voda 0.5l",
    price: 0.8,
    category: "Napoje",
    description: "Still water.",
    modifiers: [
      {
        id: "Ice",
        label: "Ice",
        type: "single",
        options: ["No ice", "Ice"],
      },
    ],
  },
  {
    id: "kava-espresso",
    name: "Kava espresso",
    price: 1.2,
    category: "Napoje",
    description: "Strong, quick espresso shot.",
    modifiers: [
      {
        id: "Milk",
        label: "Milk",
        type: "single",
        options: ["No milk", "A little milk", "Extra milk"],
      },
    ],
  },
];

const formatCurrency = (value: number) => `EUR ${value.toFixed(2)}`;

const normalizeModifiers = (modifiers: Record<string, string[]>) => {
  const sortedEntries = Object.entries(modifiers)
    .map(([group, values]) => [group, [...values].sort()] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(sortedEntries);
};

const modifiersSignature = (modifiers: Record<string, string[]>) =>
  JSON.stringify(normalizeModifiers(modifiers));

const Cashier = () => {
  const { orders, addOrder, isLoading, error } = useOrders();
  const categories = useMemo(
    () => Array.from(new Set(MENU_ITEMS.map((item) => item.category))),
    []
  );
  const [activeCategory, setActiveCategory] = useState(categories[0] ?? "Menu");
  const [table, setTable] = useState("");
  const [notes, setNotes] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({});
  const [selectedQty, setSelectedQty] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);

  const itemsForCategory = useMemo(
    () => MENU_ITEMS.filter((item) => item.category === activeCategory),
    [activeCategory]
  );

  const cartTotal = useMemo(
    () =>
      cartItems.reduce((sum, item) => sum + item.quantity * item.menuItem.price, 0),
    [cartItems]
  );

  const resetDetailPanel = () => {
    setSelectedItem(null);
    setSelectedModifiers({});
    setSelectedQty(1);
  };

  const openDetailPanel = (item: MenuItem) => {
    setSelectedItem(item);
    const defaults: Record<string, string[]> = {};
    item.modifiers?.forEach((group) => {
      if (group.type === "single") {
        defaults[group.label] = [group.options[0]];
      } else {
        defaults[group.label] = [];
      }
    });
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

    const result = await addOrder({
      table,
      notes,
      items: cartItems.map((item) => ({
        name: item.menuItem.name,
        quantity: item.quantity,
        modifiers: item.modifiers,
        price: item.menuItem.price,
      })),
    });

    if (!result.ok) {
      setFeedback(result.error ?? "Unable to send order right now.");
      return;
    }

    setTable("");
    setNotes("");
    setCartItems([]);
    setFeedback("Order sent to the kitchen.");
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
          </p>
        </div>
        <div className="rounded-2xl border border-accent-3/60 bg-accent-2/70 px-4 py-3 text-sm text-contrast/70 shadow-sm">
          {isLoading ? "Syncing orders..." : `${orders.length} active orders`}
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
        <section className="space-y-6">
          <div className="flex flex-wrap gap-3">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold uppercase tracking-wide transition ${
                  activeCategory === category
                    ? "border-brand/50 bg-brand/15 text-brand"
                    : "border-accent-3/60 text-contrast/70 hover:border-brand/40 hover:text-brand"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {itemsForCategory.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openDetailPanel(item)}
                className="group rounded-3xl border border-accent-3/60 bg-accent-1/80 p-5 text-left shadow-lg shadow-accent-4/20 transition hover:-translate-y-1 hover:border-brand/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-contrast">{item.name}</h3>
                    {item.description ? (
                      <p className="mt-1 text-xs text-contrast/70">{item.description}</p>
                    ) : null}
                  </div>
                  <span className="rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
                    {formatCurrency(item.price)}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-contrast/60">
                  <span>{item.modifiers?.length ? "Customize" : "Quick add"}</span>
                  <span className="text-brand/70 transition group-hover:text-brand">Tap to add</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <aside className="space-y-6 rounded-3xl border border-accent-3/60 bg-accent-2/70 p-6 shadow-lg shadow-accent-4/20">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-contrast/80" htmlFor="table">
                Table
              </label>
              <input
                id="table"
                value={table}
                onChange={(event) => setTable(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-accent-3/60 bg-primary/70 px-4 py-3 text-sm text-contrast outline-none transition focus:border-brand/60"
                placeholder="12"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-contrast/80" htmlFor="notes">
                Notes
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="mt-2 min-h-[120px] w-full rounded-2xl border border-accent-3/60 bg-primary/70 px-4 py-3 text-sm text-contrast outline-none transition focus:border-brand/60"
                placeholder="No onions, extra sauce..."
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-contrast/80">
                Current order
              </h3>
              <span className="text-xs text-contrast/60">{cartItems.length} items</span>
            </div>
            {cartItems.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-accent-3/60 bg-primary/70 p-4 text-sm text-contrast/60">
                Choose items from the menu cards to start the order.
              </p>
            ) : (
              <div className="space-y-3">
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
              <span className="text-base font-semibold text-contrast">{formatCurrency(cartTotal)}</span>
            </div>
          </div>

          {feedback ? <p className="text-sm text-contrast/70">{feedback}</p> : null}
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              className="inline-flex items-center justify-center rounded-full bg-brand px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-md shadow-brand/40 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              Send to kitchen
            </button>
            <button
              type="button"
              onClick={() => {
                setTable("");
                setNotes("");
                setCartItems([]);
                setFeedback(null);
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
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand/70">
                  Customize
                </p>
                <h2 className="text-2xl font-semibold text-contrast">{selectedItem.name}</h2>
                {selectedItem.description ? (
                  <p className="mt-2 text-sm text-contrast/70">{selectedItem.description}</p>
                ) : null}
              </div>
              <span className="rounded-full border border-brand/40 bg-brand/10 px-4 py-2 text-sm font-semibold text-brand">
                {formatCurrency(selectedItem.price)}
              </span>
            </div>

            {selectedItem.modifiers?.length ? (
              <div className="mt-6 space-y-5">
                {selectedItem.modifiers.map((group) => (
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
    </section>
  );
};

export default Cashier;
