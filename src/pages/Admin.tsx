import { useEffect, useMemo, useState } from "react";
import { useMenu } from "../features/menu/MenuContext";
import type { MenuItem } from "../features/menu/MenuContext";

type ModalState =
  | { mode: "add"; type: "category" | "sauce" | "side" | "item" }
  | { mode: "edit-list"; type: "category" | "sauce" | "side" }
  | { mode: "edit-item"; id: string }
  | null;

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
    updateCategory,
    updateSauce,
    updateSide,
    updateItem,
  } = useMenu();

  const [modal, setModal] = useState<ModalState>(null);
  const [modalFeedback, setModalFeedback] = useState<string | null>(null);
  const [nameField, setNameField] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemRegisterCode, setItemRegisterCode] = useState("");
  const [itemCategoryId, setItemCategoryId] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemAllowSauces, setItemAllowSauces] = useState(true);
  const [itemAllowSides, setItemAllowSides] = useState(false);
  const [itemShowInKitchen, setItemShowInKitchen] = useState(true);
  const [categoryEdits, setCategoryEdits] = useState<Record<string, string>>({});
  const [sauceEdits, setSauceEdits] = useState<Record<string, string>>({});
  const [sideEdits, setSideEdits] = useState<Record<string, string>>({});
  const [rowFeedback, setRowFeedback] = useState<Record<string, string | null>>({});
  const [newEntry, setNewEntry] = useState({ category: "", sauce: "", side: "" });

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );

  useEffect(() => {
    if (!itemCategoryId && categories.length > 0) {
      setItemCategoryId(categories[0].id);
    }
  }, [categories, itemCategoryId]);

  useEffect(() => {
    setCategoryEdits(
      categories.reduce<Record<string, string>>((acc, category) => {
        acc[category.id] = category.name;
        return acc;
      }, {})
    );
  }, [categories]);

  useEffect(() => {
    setSauceEdits(
      sauces.reduce<Record<string, string>>((acc, sauce) => {
        acc[sauce.id] = sauce.name;
        return acc;
      }, {})
    );
  }, [sauces]);

  useEffect(() => {
    setSideEdits(
      sides.reduce<Record<string, string>>((acc, side) => {
        acc[side.id] = side.name;
        return acc;
      }, {})
    );
  }, [sides]);

  const closeModal = () => {
    setModal(null);
    setModalFeedback(null);
  };

  const openAddModal = (type: "category" | "sauce" | "side" | "item") => {
    setModal({ mode: "add", type });
    setModalFeedback(null);
    setNameField("");
    setItemName("");
    setItemPrice("");
    setItemRegisterCode("");
    setItemDescription("");
    setItemAllowSauces(true);
    setItemAllowSides(false);
    setItemShowInKitchen(true);
  };

  const openEditListModal = (type: "category" | "sauce" | "side") => {
    setModal({ mode: "edit-list", type });
    setModalFeedback(null);
  };

  const openEditItemModal = (id: string) => {
    const match = items.find((item) => item.id === id);
    setModal({ mode: "edit-item", id });
    setModalFeedback(null);
    setItemName(match?.name ?? "");
    setItemPrice(match ? match.price.toFixed(2) : "");
    setItemRegisterCode(match?.register_code ?? "");
    setItemCategoryId(match?.category_id ?? categories[0]?.id ?? "");
    setItemDescription(match?.description ?? "");
    setItemAllowSauces(match?.allow_sauces ?? true);
    setItemAllowSides(match?.allow_sides ?? false);
    setItemShowInKitchen(match?.show_in_kitchen ?? true);
  };

  const handleSave = async () => {
    if (!modal) return;

    if (modal.mode === "add") {
      if (modal.type === "category") {
        const result = await addCategory(nameField);
        setModalFeedback(result.ok ? "Category added." : result.error ?? "Unable to add category.");
        if (result.ok) closeModal();
      }

      if (modal.type === "sauce") {
        const result = await addSauce(nameField);
        setModalFeedback(result.ok ? "Sauce added." : result.error ?? "Unable to add sauce.");
        if (result.ok) closeModal();
      }

      if (modal.type === "side") {
        const result = await addSide(nameField);
        setModalFeedback(result.ok ? "Side added." : result.error ?? "Unable to add side.");
        if (result.ok) closeModal();
      }

      if (modal.type === "item") {
        const result = await addItem({
          name: itemName,
          price: Number(itemPrice),
          register_code: itemRegisterCode,
          category_id: itemCategoryId,
          description: itemDescription,
          allow_sauces: itemAllowSauces,
          allow_sides: itemAllowSides,
          show_in_kitchen: itemShowInKitchen,
        });
        setModalFeedback(result.ok ? "Item added." : result.error ?? "Unable to add item.");
        if (result.ok) closeModal();
      }
    }

    if (modal.mode === "edit-item") {
      const result = await updateItem({
        id: modal.id,
        name: itemName,
        price: Number(itemPrice),
        register_code: itemRegisterCode,
        category_id: itemCategoryId,
        description: itemDescription,
        allow_sauces: itemAllowSauces,
        allow_sides: itemAllowSides,
        show_in_kitchen: itemShowInKitchen,
      });
      setModalFeedback(result.ok ? "Saved." : result.error ?? "Unable to save.");
      if (result.ok) closeModal();
    }
  };

  const handleUpdateCategory = async (id: string) => {
    const result = await updateCategory(id, categoryEdits[id] ?? "");
    setRowFeedback((prev) => ({
      ...prev,
      [id]: result.ok ? "Saved." : result.error ?? "Unable to save.",
    }));
  };

  const handleUpdateSauce = async (id: string) => {
    const result = await updateSauce(id, sauceEdits[id] ?? "");
    setRowFeedback((prev) => ({
      ...prev,
      [id]: result.ok ? "Saved." : result.error ?? "Unable to save.",
    }));
  };

  const handleUpdateSide = async (id: string) => {
    const result = await updateSide(id, sideEdits[id] ?? "");
    setRowFeedback((prev) => ({
      ...prev,
      [id]: result.ok ? "Saved." : result.error ?? "Unable to save.",
    }));
  };

  const handleAddInline = async (type: "category" | "sauce" | "side") => {
    const value = newEntry[type].trim();
    if (!value) {
      setModalFeedback("Name is required.");
      return;
    }
    const addFn = type === "category" ? addCategory : type === "sauce" ? addSauce : addSide;
    const result = await addFn(value);
    setModalFeedback(result.ok ? "Added." : result.error ?? "Unable to add.");
    if (result.ok) {
      setNewEntry((prev) => ({ ...prev, [type]: "" }));
    }
  };

  const renderEditList = (
    type: "category" | "sauce" | "side",
    data: { id: string; name: string }[]
  ) => {
    const edits = type === "category" ? categoryEdits : type === "sauce" ? sauceEdits : sideEdits;
    const setEdits =
      type === "category" ? setCategoryEdits : type === "sauce" ? setSauceEdits : setSideEdits;
    const saveHandler =
      type === "category" ? handleUpdateCategory : type === "sauce" ? handleUpdateSauce : handleUpdateSide;

    return (
      <div className="space-y-3">
        <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-accent-3/60 bg-primary/60 p-4 sm:flex-row sm:items-center">
          <input
            value={newEntry[type]}
            onChange={(event) =>
              setNewEntry((prev) => ({
                ...prev,
                [type]: event.target.value,
              }))
            }
            className="flex-1 rounded-2xl border border-accent-3/60 bg-primary/70 px-3 py-2 text-sm text-contrast outline-none transition focus:border-brand/60"
            placeholder={`Add new ${type}`}
          />
          <button
            type="button"
            onClick={() => handleAddInline(type)}
            className="rounded-full bg-brand px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-md shadow-brand/40 transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            Add
          </button>
        </div>
        {data.length === 0 ? (
          <p className="text-sm text-contrast/60">No entries yet.</p>
        ) : (
          data.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-col gap-3 rounded-2xl border border-accent-3/60 bg-primary/70 p-4 sm:flex-row sm:items-center"
            >
              <input
                value={edits[entry.id] ?? ""}
                onChange={(event) =>
                  setEdits((prev: Record<string, string>) => ({
                    ...prev,
                    [entry.id]: event.target.value,
                  }))
                }
                className="flex-1 rounded-2xl border border-accent-3/60 bg-primary/70 px-3 py-2 text-sm text-contrast outline-none transition focus:border-brand/60"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => saveHandler(entry.id)}
                  className="rounded-full bg-brand px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-md shadow-brand/40 transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  Save
                </button>
                {rowFeedback[entry.id] ? (
                  <span className="text-xs text-contrast/60">{rowFeedback[entry.id]}</span>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    );
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
            Add or edit categories, sauces, sides, and menu items. Changes appear instantly on the
            cashier screen.
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

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => openAddModal("item")}
          className="rounded-full border border-brand/40 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-brand transition hover:bg-brand/10"
        >
          Add item
        </button>
        <button
          type="button"
          onClick={() => openEditListModal("category")}
          className="rounded-full border border-accent-3/60 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-contrast/70 transition hover:border-brand/50 hover:text-brand"
        >
          Edit categories
        </button>
        <button
          type="button"
          onClick={() => openEditListModal("sauce")}
          className="rounded-full border border-accent-3/60 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-contrast/70 transition hover:border-brand/50 hover:text-brand"
        >
          Edit sauces
        </button>
        <button
          type="button"
          onClick={() => openEditListModal("side")}
          className="rounded-full border border-accent-3/60 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-contrast/70 transition hover:border-brand/50 hover:text-brand"
        >
          Edit sides
        </button>
      </div>

      <div className="rounded-3xl border border-accent-3/60 bg-accent-2/70 p-8">
        <h2 className="text-lg font-semibold text-contrast">Menu items</h2>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-contrast/60">No items yet.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item: MenuItem) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openEditItemModal(item.id)}
                className="flex h-full flex-col gap-2 rounded-2xl border border-accent-3/60 bg-primary/70 p-4 text-left text-sm text-contrast transition hover:border-brand/50 hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-xs text-contrast/60">
                      {categoryMap.get(item.category_id) ?? "Unassigned"}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-brand">{item.price.toFixed(2)}</span>
                </div>
                {item.register_code ? (
                  <span className="text-[11px] font-semibold text-contrast/60">
                    Code {item.register_code}
                  </span>
                ) : (
                  <span className="text-[11px] text-contrast/40">No register code</span>
                )}
                {!item.show_in_kitchen ? (
                  <span className="text-[11px] font-semibold text-rose-300">
                    Hidden from kitchen
                  </span>
                ) : null}
                <div className="flex flex-wrap gap-2 text-[11px] text-contrast/60">
                  {item.allow_sauces ? <span>Sauces</span> : null}
                  {item.allow_sides ? <span>Sides</span> : null}
                </div>
                <span className="text-[11px] text-brand/70">Tap to edit</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/70 backdrop-blur p-4">
          <button type="button" aria-label="Close" className="absolute inset-0" onClick={closeModal} />
          <div className="relative z-10 w-full max-w-xl rounded-3xl border border-accent-3/60 bg-primary p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand/70">
                  {modal.mode === "add" ? "Add new" : "Edit"}
                </p>
                <h2 className="text-2xl font-semibold text-contrast">
                  {modal.mode === "edit-list" && modal.type === "category" && "Categories"}
                  {modal.mode === "edit-list" && modal.type === "sauce" && "Sauces"}
                  {modal.mode === "edit-list" && modal.type === "side" && "Sides"}
                  {modal.mode !== "edit-list" && modal.type === "category" && "Category"}
                  {modal.mode !== "edit-list" && modal.type === "sauce" && "Sauce"}
                  {modal.mode !== "edit-list" && modal.type === "side" && "Side"}
                  {modal.mode !== "edit-list" && modal.type === "item" && "Menu item"}
                  {modal.mode === "edit-item" && "Menu item"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full border border-accent-3/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-contrast/70 transition hover:border-brand/50 hover:text-brand"
              >
                Close
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {modal.mode === "edit-list" ? (
                renderEditList(
                  modal.type,
                  modal.type === "category" ? categories : modal.type === "sauce" ? sauces : sides
                )
              ) : modal.mode === "edit-item" || modal.type === "item" ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <input
                      value={itemName}
                      onChange={(event) => setItemName(event.target.value)}
                      className="w-full rounded-2xl border border-accent-3/60 bg-primary/70 px-4 py-3 text-sm text-contrast outline-none transition focus:border-brand/60"
                      placeholder="Item name"
                    />
                    <input
                      type="number"
                      step="0.1"
                      value={itemPrice}
                      onChange={(event) => setItemPrice(event.target.value)}
                      className="w-full rounded-2xl border border-accent-3/60 bg-primary/70 px-4 py-3 text-sm text-contrast outline-none transition focus:border-brand/60"
                      placeholder="3.50"
                    />
                    <input
                      value={itemRegisterCode}
                      onChange={(event) => setItemRegisterCode(event.target.value)}
                      className="w-full rounded-2xl border border-accent-3/60 bg-primary/70 px-4 py-3 text-sm text-contrast outline-none transition focus:border-brand/60"
                      placeholder="Register code"
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
                  <div className="flex flex-wrap gap-4 text-sm text-contrast/70">
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
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={itemShowInKitchen}
                        onChange={(event) => setItemShowInKitchen(event.target.checked)}
                      />
                      Show in kitchen
                    </label>
                  </div>
                </>
              ) : (
                <input
                  value={nameField}
                  onChange={(event) => setNameField(event.target.value)}
                  className="w-full rounded-2xl border border-accent-3/60 bg-primary/70 px-4 py-3 text-sm text-contrast outline-none transition focus:border-brand/60"
                  placeholder="Name"
                />
              )}

              {modalFeedback ? <p className="text-xs text-contrast/70">{modalFeedback}</p> : null}

              {modal.mode !== "edit-list" ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={handleSave}
                    className="rounded-full bg-brand px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-md shadow-brand/40 transition hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    {modal.mode === "add" ? "Add" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-full border border-accent-3/60 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-contrast/70 transition hover:border-brand/50 hover:text-brand"
                  >
                    Cancel
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default Admin;
