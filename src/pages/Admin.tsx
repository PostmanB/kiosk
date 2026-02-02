import { useEffect, useMemo, useState } from "react";
import { useMenu } from "../features/menu/MenuContext";

const Admin = () => {
  const {
    categories,
    sauces,
    sides,
    items,
    isLoading,
    error,
    addCategory,
    addSauce,
    addSide,
    addItem,
  } = useMenu();

  const [categoryName, setCategoryName] = useState("");
  const [sauceName, setSauceName] = useState("");
  const [sideName, setSideName] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemCategoryId, setItemCategoryId] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemAllowSauces, setItemAllowSauces] = useState(true);
  const [itemAllowSides, setItemAllowSides] = useState(false);
  const [categoryFeedback, setCategoryFeedback] = useState<string | null>(null);
  const [sauceFeedback, setSauceFeedback] = useState<string | null>(null);
  const [sideFeedback, setSideFeedback] = useState<string | null>(null);
  const [itemFeedback, setItemFeedback] = useState<string | null>(null);

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );

  useEffect(() => {
    if (!itemCategoryId && categories.length > 0) {
      setItemCategoryId(categories[0].id);
    }
  }, [categories, itemCategoryId]);

  const handleAddCategory = async () => {
    const result = await addCategory(categoryName);
    setCategoryFeedback(result.ok ? "Category added." : result.error ?? "Unable to add category.");
    if (result.ok) {
      setCategoryName("");
    }
  };

  const handleAddSauce = async () => {
    const result = await addSauce(sauceName);
    setSauceFeedback(result.ok ? "Sauce added." : result.error ?? "Unable to add sauce.");
    if (result.ok) {
      setSauceName("");
    }
  };

  const handleAddSide = async () => {
    const result = await addSide(sideName);
    setSideFeedback(result.ok ? "Side added." : result.error ?? "Unable to add side.");
    if (result.ok) {
      setSideName("");
    }
  };

  const handleAddItem = async () => {
    const priceValue = Number(itemPrice);
    const result = await addItem({
      name: itemName,
      price: priceValue,
      category_id: itemCategoryId,
      description: itemDescription,
      allow_sauces: itemAllowSauces,
      allow_sides: itemAllowSides,
    });

    setItemFeedback(result.ok ? "Item added." : result.error ?? "Unable to add item.");

    if (result.ok) {
      setItemName("");
      setItemPrice("");
      setItemDescription("");
      setItemAllowSauces(true);
      setItemAllowSides(false);
    }
  };

  return (
    <section className="space-y-10">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand/70">
            Admin Console
          </p>
          <h1 className="text-3xl font-bold text-contrast sm:text-4xl">
            Manage the kiosk menu in one place.
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-contrast/75">
            Add categories, sauces, sides, and menu items that will instantly appear on the cashier
            screen.
          </p>
        </div>
        <div className="rounded-2xl border border-accent-3/60 bg-accent-2/70 px-4 py-3 text-sm text-contrast/70 shadow-sm">
          {isLoading ? "Syncing menu..." : `${items.length} menu items`}
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-6 rounded-3xl border border-accent-3/60 bg-accent-1/80 p-8 shadow-lg shadow-accent-4/20">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-contrast">Add category</h2>
              <input
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                className="w-full rounded-2xl border border-accent-3/60 bg-primary/70 px-4 py-3 text-sm text-contrast outline-none transition focus:border-brand/60"
                placeholder="Burgery"
              />
              <button
                type="button"
                onClick={handleAddCategory}
                className="rounded-full bg-brand px-5 py-2 text-sm font-semibold uppercase tracking-wide text-white shadow-md shadow-brand/40 transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                Add category
              </button>
              {categoryFeedback ? <p className="text-xs text-contrast/70">{categoryFeedback}</p> : null}
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-contrast">Add sauce</h2>
              <input
                value={sauceName}
                onChange={(event) => setSauceName(event.target.value)}
                className="w-full rounded-2xl border border-accent-3/60 bg-primary/70 px-4 py-3 text-sm text-contrast outline-none transition focus:border-brand/60"
                placeholder="Cesnakova"
              />
              <button
                type="button"
                onClick={handleAddSauce}
                className="rounded-full border border-brand/40 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-brand transition hover:bg-brand/10"
              >
                Add sauce
              </button>
              {sauceFeedback ? <p className="text-xs text-contrast/70">{sauceFeedback}</p> : null}
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-contrast">Add side</h2>
              <input
                value={sideName}
                onChange={(event) => setSideName(event.target.value)}
                className="w-full rounded-2xl border border-accent-3/60 bg-primary/70 px-4 py-3 text-sm text-contrast outline-none transition focus:border-brand/60"
                placeholder="Hranolky"
              />
              <button
                type="button"
                onClick={handleAddSide}
                className="rounded-full border border-brand/40 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-brand transition hover:bg-brand/10"
              >
                Add side
              </button>
              {sideFeedback ? <p className="text-xs text-contrast/70">{sideFeedback}</p> : null}
            </div>
          </div>

          <div className="rounded-3xl border border-accent-3/60 bg-primary/70 p-6">
            <h2 className="text-lg font-semibold text-contrast">Add menu item</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <input
                value={itemName}
                onChange={(event) => setItemName(event.target.value)}
                className="w-full rounded-2xl border border-accent-3/60 bg-primary/70 px-4 py-3 text-sm text-contrast outline-none transition focus:border-brand/60"
                placeholder="Gyros pita"
              />
              <input
                type="number"
                step="0.1"
                value={itemPrice}
                onChange={(event) => setItemPrice(event.target.value)}
                className="w-full rounded-2xl border border-accent-3/60 bg-primary/70 px-4 py-3 text-sm text-contrast outline-none transition focus:border-brand/60"
                placeholder="3.50"
              />
              <select
                value={itemCategoryId}
                onChange={(event) => setItemCategoryId(event.target.value)}
                className="w-full rounded-2xl border border-accent-3/60 bg-primary/70 px-4 py-3 text-sm text-contrast outline-none transition focus:border-brand/60"
              >
                {categories.length === 0 ? (
                  <option value="">No categories yet</option>
                ) : (
                  categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))
                )}
              </select>
              <input
                value={itemDescription}
                onChange={(event) => setItemDescription(event.target.value)}
                className="w-full rounded-2xl border border-accent-3/60 bg-primary/70 px-4 py-3 text-sm text-contrast outline-none transition focus:border-brand/60"
                placeholder="Short description"
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-contrast/70">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={itemAllowSauces}
                  onChange={(event) => setItemAllowSauces(event.target.checked)}
                />
                Allow sauces
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={itemAllowSides}
                  onChange={(event) => setItemAllowSides(event.target.checked)}
                />
                Allow sides
              </label>
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={handleAddItem}
                className="rounded-full bg-brand px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-md shadow-brand/40 transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                Add item
              </button>
              {itemFeedback ? <span className="text-xs text-contrast/70">{itemFeedback}</span> : null}
            </div>
          </div>
        </section>

        <aside className="space-y-6 rounded-3xl border border-accent-3/60 bg-accent-2/70 p-8">
          <div>
            <h2 className="text-lg font-semibold text-contrast">Categories</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {categories.length === 0 ? (
                <p className="text-sm text-contrast/60">No categories yet.</p>
              ) : (
                categories.map((category) => (
                  <span
                    key={category.id}
                    className="rounded-full border border-accent-3/60 px-3 py-1 text-xs text-contrast/70"
                  >
                    {category.name}
                  </span>
                ))
              )}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-contrast">Sauces</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {sauces.length === 0 ? (
                <p className="text-sm text-contrast/60">No sauces yet.</p>
              ) : (
                sauces.map((sauce) => (
                  <span
                    key={sauce.id}
                    className="rounded-full border border-accent-3/60 px-3 py-1 text-xs text-contrast/70"
                  >
                    {sauce.name}
                  </span>
                ))
              )}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-contrast">Sides</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {sides.length === 0 ? (
                <p className="text-sm text-contrast/60">No sides yet.</p>
              ) : (
                sides.map((side) => (
                  <span
                    key={side.id}
                    className="rounded-full border border-accent-3/60 px-3 py-1 text-xs text-contrast/70"
                  >
                    {side.name}
                  </span>
                ))
              )}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-contrast">Menu items</h2>
            <div className="mt-3 space-y-3">
              {items.length === 0 ? (
                <p className="text-sm text-contrast/60">No items yet.</p>
              ) : (
                items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-accent-3/60 bg-primary/70 p-3 text-sm text-contrast"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-xs text-contrast/60">
                          {categoryMap.get(item.category_id) ?? "Unassigned"}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-brand">{item.price.toFixed(2)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-contrast/60">
                      {item.allow_sauces ? <span>Sauces</span> : null}
                      {item.allow_sides ? <span>Sides</span> : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
};

export default Admin;
