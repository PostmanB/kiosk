import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export type MenuCategory = {
  id: string;
  name: string;
};

export type MenuSauce = {
  id: string;
  name: string;
};

export type MenuSide = {
  id: string;
  name: string;
};

export type MenuExtra = {
  id: string;
  name: string;
};

export type MenuItem = {
  id: string;
  name: string;
  price: number;
  register_code: string | null;
  icon_name: string | null;
  category_id: string;
  description: string | null;
  allow_sauces: boolean;
  allow_sides: boolean;
  show_in_kitchen: boolean;
  is_active?: boolean;
};

type AddItemInput = {
  name: string;
  price: number;
  register_code?: string;
  icon_name?: string;
  category_id: string;
  description?: string;
  allow_sauces: boolean;
  allow_sides: boolean;
  show_in_kitchen?: boolean;
  is_active?: boolean;
};

type MenuContextValue = {
  categories: MenuCategory[];
  sauces: MenuSauce[];
  sides: MenuSide[];
  extras: MenuExtra[];
  items: MenuItem[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addCategory: (name: string) => Promise<{ ok: boolean; error?: string }>;
  deleteCategory: (id: string) => Promise<{ ok: boolean; error?: string }>;
  addSauce: (name: string) => Promise<{ ok: boolean; error?: string }>;
  deleteSauce: (id: string) => Promise<{ ok: boolean; error?: string }>;
  addSide: (name: string) => Promise<{ ok: boolean; error?: string }>;
  addExtra: (name: string) => Promise<{ ok: boolean; error?: string }>;
  addItem: (input: AddItemInput) => Promise<{ ok: boolean; error?: string }>;
  updateCategory: (id: string, name: string) => Promise<{ ok: boolean; error?: string }>;
  updateSauce: (id: string, name: string) => Promise<{ ok: boolean; error?: string }>;
  updateSide: (id: string, name: string) => Promise<{ ok: boolean; error?: string }>;
  updateExtra: (id: string, name: string) => Promise<{ ok: boolean; error?: string }>;
  updateItem: (input: AddItemInput & { id: string }) => Promise<{ ok: boolean; error?: string }>;
  deleteItem: (id: string) => Promise<{ ok: boolean; error?: string }>;
  deleteExtra: (id: string) => Promise<{ ok: boolean; error?: string }>;
};

const TABLES = {
  categories: "kiosk_categories",
  sauces: "kiosk_sauces",
  sides: "kiosk_sides",
  extras: "kiosk_extras",
  items: "kiosk_items",
};
const DEFAULT_CATEGORIES = ["Sides", "Drinks"];
const DEFAULT_EXTRAS = [
  "Hagyma nélkül",
  "Zöldség nélkül",
  "Paradicsom nélkül",
  "Saláta nélkül",
  "Uborka nélkül",
  "Sajt nélkül",
  "Extra szósz",
];

const MenuContext = createContext<MenuContextValue | undefined>(undefined);

const normalizeItem = (item: MenuItem) => ({
  ...item,
  price: Number(item.price),
  show_in_kitchen: item.show_in_kitchen ?? true,
  is_active: item.is_active ?? true,
});

export const MenuProvider = ({ children }: { children: React.ReactNode }) => {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [sauces, setSauces] = useState<MenuSauce[]>([]);
  const [sides, setSides] = useState<MenuSide[]>([]);
  const [extras, setExtras] = useState<MenuExtra[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ensuredDefaultsRef = useRef(false);
  const ensuredExtrasDefaultsRef = useRef(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const [categoriesRes, saucesRes, sidesRes, extrasRes, itemsRes] = await Promise.all([
      supabase.from(TABLES.categories).select("*").order("name"),
      supabase.from(TABLES.sauces).select("*").order("name"),
      supabase.from(TABLES.sides).select("*").order("name"),
      supabase.from(TABLES.extras).select("*").order("name"),
      supabase.from(TABLES.items).select("*").order("name"),
    ]);

    if (categoriesRes.error || saucesRes.error || sidesRes.error || itemsRes.error) {
      setError(
        categoriesRes.error?.message ||
          saucesRes.error?.message ||
          sidesRes.error?.message ||
          itemsRes.error?.message ||
          "A menü betöltése sikertelen."
      );
      setIsLoading(false);
      return;
    }

    const extrasTableMissing =
      extrasRes.error &&
      (extrasRes.error.code === "42P01" ||
        extrasRes.error.message.toLowerCase().includes(TABLES.extras));
    if (extrasRes.error && !extrasTableMissing) {
      setError(extrasRes.error.message || "Az extrák betöltése sikertelen.");
      setIsLoading(false);
      return;
    }

    setCategories(categoriesRes.data ?? []);
    setSauces(saucesRes.data ?? []);
    setSides(sidesRes.data ?? []);
    setExtras(
      extrasTableMissing
        ? DEFAULT_EXTRAS.map((name, index) => ({ id: `default-extra-${index}`, name }))
        : extrasRes.data ?? []
    );
    setItems((itemsRes.data ?? []).map(normalizeItem));
    setError(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refresh();

    const channel = supabase
      .channel("kiosk-menu")
      .on("postgres_changes", { event: "*", schema: "public", table: TABLES.categories }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: TABLES.sauces }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: TABLES.sides }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: TABLES.extras }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: TABLES.items }, refresh)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  useEffect(() => {
    if (isLoading || error || ensuredDefaultsRef.current) {
      return;
    }
    const existing = new Set(
      categories.map((category) => category.name.trim().toLowerCase())
    );
    const missing = DEFAULT_CATEGORIES.filter(
      (name) => !existing.has(name.toLowerCase())
    );
    if (missing.length === 0) {
      ensuredDefaultsRef.current = true;
      return;
    }
    ensuredDefaultsRef.current = true;
    supabase
      .from(TABLES.categories)
      .insert(missing.map((name) => ({ name })))
      .then(({ error: insertError }) => {
        if (!insertError) {
          refresh();
        }
      });
  }, [categories, error, isLoading, refresh]);

  useEffect(() => {
    if (isLoading || error || ensuredExtrasDefaultsRef.current) {
      return;
    }
    if (extras.length > 0) {
      ensuredExtrasDefaultsRef.current = true;
      return;
    }
    ensuredExtrasDefaultsRef.current = true;
    supabase
      .from(TABLES.extras)
      .insert(DEFAULT_EXTRAS.map((name) => ({ name })))
      .then(({ error: insertError }) => {
        if (!insertError) {
          refresh();
        }
      });
  }, [error, extras.length, isLoading, refresh]);

  const addCategory = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        return { ok: false, error: "A kategória neve kötelező." };
      }
      const { error: insertError } = await supabase
        .from(TABLES.categories)
        .insert({ name: trimmed });
      if (insertError) {
        setError(insertError.message);
        return { ok: false, error: insertError.message };
      }
      setError(null);
      await refresh();
      return { ok: true };
    },
    [refresh]
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      const { error: deleteError } = await supabase.from(TABLES.categories).delete().eq("id", id);
      if (deleteError) {
        setError(deleteError.message);
        return { ok: false, error: deleteError.message };
      }
      setCategories((prev) => prev.filter((category) => category.id !== id));
      setError(null);
      await refresh();
      return { ok: true };
    },
    [refresh]
  );

  const addSauce = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        return { ok: false, error: "A szósz neve kötelező." };
      }
      const { error: insertError } = await supabase.from(TABLES.sauces).insert({ name: trimmed });
      if (insertError) {
        setError(insertError.message);
        return { ok: false, error: insertError.message };
      }
      setError(null);
      await refresh();
      return { ok: true };
    },
    [refresh]
  );

  const deleteSauce = useCallback(
    async (id: string) => {
      const { error: deleteError } = await supabase.from(TABLES.sauces).delete().eq("id", id);
      if (deleteError) {
        setError(deleteError.message);
        return { ok: false, error: deleteError.message };
      }
      setSauces((prev) => prev.filter((sauce) => sauce.id !== id));
      setError(null);
      await refresh();
      return { ok: true };
    },
    [refresh]
  );

  const addSide = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        return { ok: false, error: "A köret neve kötelező." };
      }
      const { error: insertError } = await supabase.from(TABLES.sides).insert({ name: trimmed });
      if (insertError) {
        setError(insertError.message);
        return { ok: false, error: insertError.message };
      }
      setError(null);
      await refresh();
      return { ok: true };
    },
    [refresh]
  );

  const addExtra = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        return { ok: false, error: "Az extra neve kötelező." };
      }
      const { error: insertError } = await supabase.from(TABLES.extras).insert({ name: trimmed });
      if (insertError) {
        setError(insertError.message);
        return { ok: false, error: insertError.message };
      }
      setError(null);
      await refresh();
      return { ok: true };
    },
    [refresh]
  );

  const addItem = useCallback(
    async (input: AddItemInput) => {
      const trimmedName = input.name.trim();
      if (!trimmedName) {
        return { ok: false, error: "A tétel neve kötelező." };
      }
      if (!input.category_id) {
        return { ok: false, error: "Válassz kategóriát a tételhez." };
      }
      if (!Number.isFinite(input.price) || input.price < 0) {
        return { ok: false, error: "Adj meg érvényes árat." };
      }

      const { error: insertError } = await supabase.from(TABLES.items).insert({
        name: trimmedName,
        price: input.price,
        register_code: input.register_code?.trim() || null,
        icon_name: input.icon_name?.trim() || null,
        category_id: input.category_id,
        description: input.description?.trim() || null,
        allow_sauces: input.allow_sauces,
        allow_sides: input.allow_sides,
        show_in_kitchen: input.show_in_kitchen ?? true,
        is_active: input.is_active ?? true,
      });

      if (insertError) {
        setError(insertError.message);
        return { ok: false, error: insertError.message };
      }

      setError(null);
      await refresh();
      return { ok: true };
    },
    [refresh]
  );

  const updateCategory = useCallback(
    async (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        return { ok: false, error: "A kategória neve kötelező." };
      }
      const { error: updateError } = await supabase
        .from(TABLES.categories)
        .update({ name: trimmed })
        .eq("id", id);
      if (updateError) {
        setError(updateError.message);
        return { ok: false, error: updateError.message };
      }
      setError(null);
      await refresh();
      return { ok: true };
    },
    [refresh]
  );

  const updateSauce = useCallback(
    async (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        return { ok: false, error: "A szósz neve kötelező." };
      }
      const { error: updateError } = await supabase
        .from(TABLES.sauces)
        .update({ name: trimmed })
        .eq("id", id);
      if (updateError) {
        setError(updateError.message);
        return { ok: false, error: updateError.message };
      }
      setError(null);
      await refresh();
      return { ok: true };
    },
    [refresh]
  );

  const updateSide = useCallback(
    async (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        return { ok: false, error: "A köret neve kötelező." };
      }
      const { error: updateError } = await supabase
        .from(TABLES.sides)
        .update({ name: trimmed })
        .eq("id", id);
      if (updateError) {
        setError(updateError.message);
        return { ok: false, error: updateError.message };
      }
      setError(null);
      await refresh();
      return { ok: true };
    },
    [refresh]
  );

  const updateExtra = useCallback(
    async (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        return { ok: false, error: "Az extra neve kötelező." };
      }
      const { error: updateError } = await supabase
        .from(TABLES.extras)
        .update({ name: trimmed })
        .eq("id", id);
      if (updateError) {
        setError(updateError.message);
        return { ok: false, error: updateError.message };
      }
      setError(null);
      await refresh();
      return { ok: true };
    },
    [refresh]
  );

  const updateItem = useCallback(
    async (input: AddItemInput & { id: string }) => {
      const trimmedName = input.name.trim();
      if (!trimmedName) {
        return { ok: false, error: "A tétel neve kötelező." };
      }
      if (!input.category_id) {
        return { ok: false, error: "Válassz kategóriát a tételhez." };
      }
      if (!Number.isFinite(input.price) || input.price < 0) {
        return { ok: false, error: "Adj meg érvényes árat." };
      }

      const { error: updateError } = await supabase
        .from(TABLES.items)
        .update({
          name: trimmedName,
          price: input.price,
          register_code: input.register_code?.trim() || null,
          icon_name: input.icon_name?.trim() || null,
          category_id: input.category_id,
          description: input.description?.trim() || null,
          allow_sauces: input.allow_sauces,
          allow_sides: input.allow_sides,
          show_in_kitchen: input.show_in_kitchen ?? true,
          is_active: input.is_active ?? true,
        })
        .eq("id", input.id);

      if (updateError) {
        setError(updateError.message);
        return { ok: false, error: updateError.message };
      }

      setError(null);
      await refresh();
      return { ok: true };
    },
    [refresh]
  );

  const deleteItem = useCallback(
    async (id: string) => {
      const { error: deleteError } = await supabase.from(TABLES.items).delete().eq("id", id);
      if (deleteError) {
        setError(deleteError.message);
        return { ok: false, error: deleteError.message };
      }
      setError(null);
      await refresh();
      return { ok: true };
    },
    [refresh]
  );

  const deleteExtra = useCallback(
    async (id: string) => {
      const { error: deleteError } = await supabase.from(TABLES.extras).delete().eq("id", id);
      if (deleteError) {
        setError(deleteError.message);
        return { ok: false, error: deleteError.message };
      }
      setExtras((prev) => prev.filter((extra) => extra.id !== id));
      setError(null);
      await refresh();
      return { ok: true };
    },
    [refresh]
  );

  const value = useMemo(
    () => ({
      categories,
      sauces,
      sides,
      extras,
      items,
      isLoading,
      error,
      refresh,
      addCategory,
      deleteCategory,
      addSauce,
      deleteSauce,
      addSide,
      addExtra,
      addItem,
      updateCategory,
      updateSauce,
      updateSide,
      updateExtra,
      updateItem,
      deleteItem,
      deleteExtra,
    }),
    [
      categories,
      sauces,
      sides,
      extras,
      items,
      isLoading,
      error,
      refresh,
      addCategory,
      deleteCategory,
      addSauce,
      deleteSauce,
      addSide,
      addExtra,
      addItem,
      updateCategory,
      updateSauce,
      updateSide,
      updateExtra,
      updateItem,
      deleteItem,
      deleteExtra,
    ]
  );

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
};

export const useMenu = () => {
  const context = useContext(MenuContext);
  if (!context) {
    throw new Error("A useMenu csak MenuProvideren belül használható.");
  }
  return context;
};
