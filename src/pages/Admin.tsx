import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import { useMenu } from "../features/menu/MenuContext";
import type { MenuItem } from "../features/menu/MenuContext";
import useLockBodyScroll from "../hooks/useLockBodyScroll";
type ModalState =
  | { mode: "add"; type: "category" | "sauce" | "side" | "item" }
  | { mode: "edit-list"; type: "category" | "sauce" | "side" }
  | { mode: "edit-item"; id: string }
  | null;
const ICON_CHOICES = [
  "ph:fork-knife",
  "ph:hamburger",
  "ph:pizza",
  "ph:ice-cream",
  "ph:coffee",
  "lucide:cup-soda",
  "ph:beer-stein",
  "ph:martini",
  "ph:wine",
  "ph:fish",
  "ph:shrimp",
  "ph:egg",
  "ph:bread",
  "ph:cheese",
  "ph:carrot",
  "ph:leaf",
  "ph:pepper",
  "ph:knife",
  "mdi:french-fries",
  "material-symbols:kebab-dining-rounded",
  "mdi:gyro",
  "lucide:dessert",
  "ep:dessert",
  "mdi:ice-cream",
  "mingcute:fries-fill",
  "icon-park-outline:hamburger",
  "icon-park-outline:icecream",
];
const Admin = () => {
  const {
    categories,
    sauces,
    sides,
    items,
    isLoading,
    error,
    addCategory,
    deleteCategory,
    addSauce,
    addSide,
    addItem,
    updateCategory,
    updateSauce,
    updateSide,
    updateItem,
    deleteItem,
    deleteSauce,
  } = useMenu();
  const [modal, setModal] = useState<ModalState>(null);
  const [modalFeedback, setModalFeedback] = useState<string | null>(null);
  const [nameField, setNameField] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemRegisterCode, setItemRegisterCode] = useState("");
  const [itemIconName, setItemIconName] = useState("");
  const [isIconModalOpen, setIsIconModalOpen] = useState(false);
  const [itemCategoryId, setItemCategoryId] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemAllowSauces, setItemAllowSauces] = useState(true);
  const [itemAllowSides, setItemAllowSides] = useState(false);
  const [itemShowInKitchen, setItemShowInKitchen] = useState(true);
  const [itemIsActive, setItemIsActive] = useState(true);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState(false);
  const [confirmDeleteCategoryId, setConfirmDeleteCategoryId] = useState<string | null>(null);
  useLockBodyScroll(Boolean(modal) || isIconModalOpen);
  const portalTarget = typeof document !== "undefined" ? document.body : null;
  const [categoryEdits, setCategoryEdits] = useState<Record<string, string>>({});
  const [sauceEdits, setSauceEdits] = useState<Record<string, string>>({});
  const [sideEdits, setSideEdits] = useState<Record<string, string>>({});
  const [rowFeedback, setRowFeedback] = useState<Record<string, string | null>>({});
  const [newEntry, setNewEntry] = useState({ category: "", sauce: "", side: "" });
  const modalType = modal?.mode === "add" || modal?.mode === "edit-list" ? modal.type : null;
  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );
  const categoryItemCounts = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((item) => {
      counts.set(item.category_id, (counts.get(item.category_id) ?? 0) + 1);
    });
    return counts;
  }, [items]);
  const selectedCategoryName = useMemo(
    () => categories.find((category) => category.id === itemCategoryId)?.name?.trim().toLowerCase() ?? "",
    [categories, itemCategoryId]
  );
  const isSidesCategory = selectedCategoryName === "sides";
  const isDrinksCategory = selectedCategoryName === "drinks";
  useEffect(() => {
    if (!itemCategoryId && categories.length > 0) {
      setItemCategoryId(categories[0].id);
    }
  }, [categories, itemCategoryId]);
  useEffect(() => {
    if (isDrinksCategory) {
      if (itemAllowSauces) setItemAllowSauces(false);
      if (itemAllowSides) setItemAllowSides(false);
      if (itemShowInKitchen) setItemShowInKitchen(false);
      return;
    }
    if (isSidesCategory) {
      if (itemAllowSides) setItemAllowSides(false);
      if (!itemShowInKitchen) setItemShowInKitchen(true);
    }
  }, [isDrinksCategory, isSidesCategory, itemAllowSauces, itemAllowSides, itemShowInKitchen]);
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
    setConfirmDeleteItem(false);
    setConfirmDeleteCategoryId(null);
  };
  const openAddModal = (type: "category" | "sauce" | "side" | "item") => {
    setModal({ mode: "add", type });
    setModalFeedback(null);
    setNameField("");
    setItemName("");
    setItemPrice("");
    setItemRegisterCode("");
    setItemIconName("");
    setIsIconModalOpen(false);
    setItemDescription("");
    setItemAllowSauces(true);
    setItemAllowSides(false);
    setItemShowInKitchen(true);
    setItemIsActive(true);
    setConfirmDeleteItem(false);
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
    setItemIconName(match?.icon_name ?? "");
    setIsIconModalOpen(false);
    setItemCategoryId(match?.category_id ?? categories[0]?.id ?? "");
    setItemDescription(match?.description ?? "");
    setItemAllowSauces(match?.allow_sauces ?? true);
    setItemAllowSides(match?.allow_sides ?? false);
    setItemShowInKitchen(match?.show_in_kitchen ?? true);
    setItemIsActive(match?.is_active ?? true);
    setConfirmDeleteItem(false);
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
          icon_name: itemIconName,
          category_id: itemCategoryId,
          description: itemDescription,
          allow_sauces: itemAllowSauces,
          allow_sides: itemAllowSides,
          show_in_kitchen: itemShowInKitchen,
          is_active: itemIsActive,
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
        icon_name: itemIconName,
        category_id: itemCategoryId,
        description: itemDescription,
        allow_sauces: itemAllowSauces,
        allow_sides: itemAllowSides,
        show_in_kitchen: itemShowInKitchen,
        is_active: itemIsActive,
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
    const canDelete = type === "category" || type === "sauce";
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
                {canDelete ? (
                  (() => {
                    if (type === "category") {
                      const count = categoryItemCounts.get(entry.id) ?? 0;
                      const isDefault =
                        ["sides", "drinks"].includes(entry.name.trim().toLowerCase());
                      if (count > 0 || isDefault) {
                        return (
                          <span className="text-[11px] text-contrast/50">
                            {isDefault ? "Default" : `${count} items`}
                          </span>
                        );
                      }
                    }

                    if (confirmDeleteCategoryId === entry.id) {
                      const label = type === "category" ? "Category" : "Sauce";
                      return (
                        <button
                          type="button"
                          onClick={async () => {
                            const result =
                              type === "category"
                                ? await deleteCategory(entry.id)
                                : await deleteSauce(entry.id);
                            setConfirmDeleteCategoryId(null);
                            setModalFeedback(
                              result.ok
                                ? `${label} deleted.`
                                : result.error ?? `Unable to delete ${label.toLowerCase()}.`
                            );
                          }}
                          className="rounded-full border border-rose-400/70 bg-rose-500/15 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-rose-300 transition hover:border-rose-300 hover:text-rose-200"
                        >
                          Confirm delete
                        </button>
                      );
                    }
                    return (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteCategoryId(entry.id)}
                        className="rounded-full border border-rose-400/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-rose-300 transition hover:border-rose-300 hover:text-rose-200"
                      >
                        Delete
                      </button>
                    );
                  })()
                ) : null}
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
      <div className="rounded-2xl border border-accent-3/60 bg-accent-2/70 px-4 py-3 text-sm text-contrast/70 shadow-sm">
        {isLoading ? "Syncing menu..." : `${items.length} menu items`}
      </div>
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
      </div>
      <div className="rounded-3xl border border-accent-3/60 bg-accent-2/70 p-8">
        <h2 className="text-lg font-semibold text-contrast">Menu items</h2>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-contrast/60">No items yet.</p>
        ) : (
          <div className="mt-4 grid gap-3 grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
            {items.map((item: MenuItem) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openEditItemModal(item.id)}
                className="group relative flex h-full flex-col gap-2 overflow-hidden rounded-2xl border border-accent-3/60 bg-primary/70 p-4 text-left text-sm text-contrast transition hover:border-brand/50 hover:-translate-y-0.5"
              >
                {item.is_active === false ? (
                  <span className="pointer-events-none absolute inset-0">
                    <span className="absolute left-1/2 top-1/2 w-[200%] -translate-x-1/2 -translate-y-1/2 -rotate-[18deg] text-center text-2xl font-extrabold uppercase tracking-[0.35em] text-rose-500">
                      Disabled
                    </span>
                  </span>
                ) : null}
                <div className={item.is_active === false ? "opacity-35" : ""}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-accent-3/60 bg-primary/60">
                      <Icon icon={item.icon_name || "ph:fork-knife"} className="h-5 w-5 text-brand" />
                    </div>
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-xs text-contrast/60">
                        {categoryMap.get(item.category_id) ?? "Unassigned"}
                      </p>
                    </div>
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
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      {modal && portalTarget
        ? createPortal(
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-primary/60 backdrop-blur-lg p-4">
          <button type="button" aria-label="Close" className="absolute inset-0" onClick={closeModal} />
          <div className="relative z-10 w-full max-h-[85vh] max-w-xl overflow-y-auto rounded-3xl border border-accent-3/60 bg-primary p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand/70">
                  {modal.mode === "add" ? "Add new" : "Edit"}
                </p>
                <h2 className="text-2xl font-semibold text-contrast">
                  {modal.mode === "edit-list" && modalType === "category" && "Categories"}
                  {modal.mode === "edit-list" && modalType === "sauce" && "Sauces"}
                  {modal.mode === "edit-list" && modalType === "side" && "Sides"}
                  {modal.mode === "add" && modalType === "category" && "Category"}
                  {modal.mode === "add" && modalType === "sauce" && "Sauce"}
                  {modal.mode === "add" && modalType === "side" && "Side"}
                  {modal.mode === "add" && modalType === "item" && "Menu item"}
                  {modal.mode === "edit-item" && "Menu item"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-accent-3/60 text-contrast/70 transition hover:border-brand/50 hover:text-brand"
              >
                ×
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
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => setIsIconModalOpen(true)}
                        className="flex w-full items-center gap-3 rounded-2xl border border-accent-3/60 bg-primary/70 px-3 py-2 text-left text-sm text-contrast transition hover:border-brand/50"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-accent-3/60 bg-primary/60">
                          <Icon icon={itemIconName || "ph:fork-knife"} className="h-5 w-5 text-brand" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-contrast/70">
                            {itemIconName ? "Selected icon" : "No icon selected"}
                          </p>
                          <p className="text-xs text-contrast/60">
                            {itemIconName || "Click to choose"}
                          </p>
                        </div>
                      </button>
                    </div>
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
                    {!isDrinksCategory ? (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={itemAllowSauces}
                          onChange={(event) => setItemAllowSauces(event.target.checked)}
                        />
                        Allow sauces
                      </label>
                    ) : null}
                    {!isSidesCategory && !isDrinksCategory ? (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={itemAllowSides}
                          onChange={(event) => setItemAllowSides(event.target.checked)}
                        />
                        Allow sides
                      </label>
                    ) : null}
                    {!isDrinksCategory && !isSidesCategory ? (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={itemShowInKitchen}
                          onChange={(event) => setItemShowInKitchen(event.target.checked)}
                        />
                        Show in kitchen
                      </label>
                    ) : null}
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {modal.mode === "edit-item" ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <button
                        type="button"
                        onClick={() => setItemIsActive((prev) => !prev)}
                        className={`rounded-full border px-5 py-3 text-sm font-semibold uppercase tracking-wide transition ${
                          itemIsActive
                            ? "border-slate-300/60 text-slate-500 hover:border-slate-400 hover:text-slate-600"
                            : "border-emerald-400/50 text-emerald-400 hover:border-emerald-300 hover:text-emerald-300"
                        }`}
                      >
                        {itemIsActive ? "Disable item" : "Enable item"}
                      </button>
                      {confirmDeleteItem ? (
                        <button
                          type="button"
                          onClick={async () => {
                            const result = await deleteItem(modal.id);
                            setConfirmDeleteItem(false);
                            setModalFeedback(result.ok ? "Item deleted." : result.error ?? "Unable to delete item.");
                            if (result.ok) {
                              closeModal();
                            }
                          }}
                          className="rounded-full border border-rose-400/70 bg-rose-500/15 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-rose-300 transition hover:border-rose-300 hover:text-rose-200"
                        >
                          Confirm delete
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteItem(true)}
                          className="rounded-full border border-rose-400/60 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-rose-300 transition hover:border-rose-300 hover:text-rose-200"
                        >
                          Delete item
                        </button>
                      )}
                    </div>
                  ) : (
                    <span />
                  )}
                  <div className="sm:ml-auto">
                    <button
                      type="button"
                      onClick={handleSave}
                      className="rounded-full bg-brand px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-md shadow-brand/40 transition hover:-translate-y-0.5 hover:shadow-lg"
                    >
                      {modal.mode === "add" ? "Add" : "Save"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          {isIconModalOpen ? (
            <div className="fixed inset-0 z-[90] flex items-center justify-center bg-primary/60 backdrop-blur-lg p-4">
              <button
                type="button"
                aria-label="Close icon picker"
                className="absolute inset-0"
                onClick={() => setIsIconModalOpen(false)}
              />
              <div className="relative z-10 w-full max-h-[85vh] max-w-3xl overflow-y-auto rounded-3xl border border-accent-3/60 bg-primary p-6 shadow-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand/70">
                      Icon picker
                    </p>
                    <h3 className="text-xl font-semibold text-contrast">Choose an icon</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsIconModalOpen(false)}
                    className="rounded-full border border-accent-3/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-contrast/70 transition hover:border-brand/50 hover:text-brand"
                  >
                    Close
                  </button>
                </div>
                <div className="mt-5 grid grid-cols-5 gap-3 sm:grid-cols-6 md:grid-cols-8">
                  {ICON_CHOICES.map((icon) => {
                    const selected = itemIconName === icon;
                    return (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => {
                          setItemIconName(icon);
                          setIsIconModalOpen(false);
                        }}
                        aria-pressed={selected}
                        className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition ${
                          selected
                            ? "border-brand/60 bg-brand/15 text-brand"
                            : "border-accent-3/60 bg-primary/70 text-contrast/70 hover:border-brand/40 hover:text-brand"
                        }`}
                      >
                        <Icon icon={icon} className="h-6 w-6" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>,
            portalTarget
          )
        : null}
    </section>
  );
};
export default Admin;
