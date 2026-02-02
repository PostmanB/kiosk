import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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

export type MenuItem = {
  id: string;
  name: string;
  price: number;
  category_id: string;
  description: string | null;
  allow_sauces: boolean;
  allow_sides: boolean;
};

type AddItemInput = {
  name: string;
  price: number;
  category_id: string;
  description?: string;
  allow_sauces: boolean;
  allow_sides: boolean;
};

type MenuContextValue = {
  categories: MenuCategory[];
  sauces: MenuSauce[];
  sides: MenuSide[];
  items: MenuItem[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addCategory: (name: string) => Promise<{ ok: boolean; error?: string }>;
  addSauce: (name: string) => Promise<{ ok: boolean; error?: string }>;
  addSide: (name: string) => Promise<{ ok: boolean; error?: string }>;
  addItem: (input: AddItemInput) => Promise<{ ok: boolean; error?: string }>;
};

const TABLES = {
  categories: "kiosk_categories",
  sauces: "kiosk_sauces",
  sides: "kiosk_sides",
  items: "kiosk_items",
};

const MenuContext = createContext<MenuContextValue | undefined>(undefined);

const normalizeItem = (item: MenuItem) => ({
  ...item,
  price: Number(item.price),
});

export const MenuProvider = ({ children }: { children: React.ReactNode }) => {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [sauces, setSauces] = useState<MenuSauce[]>([]);
  const [sides, setSides] = useState<MenuSide[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const [categoriesRes, saucesRes, sidesRes, itemsRes] = await Promise.all([
      supabase.from(TABLES.categories).select("*").order("name"),
      supabase.from(TABLES.sauces).select("*").order("name"),
      supabase.from(TABLES.sides).select("*").order("name"),
      supabase.from(TABLES.items).select("*").order("name"),
    ]);

    if (categoriesRes.error || saucesRes.error || sidesRes.error || itemsRes.error) {
      setError(
        categoriesRes.error?.message ||
          saucesRes.error?.message ||
          sidesRes.error?.message ||
          itemsRes.error?.message ||
          "Unable to load menu."
      );
      setIsLoading(false);
      return;
    }

    setCategories(categoriesRes.data ?? []);
    setSauces(saucesRes.data ?? []);
    setSides(sidesRes.data ?? []);
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
      .on("postgres_changes", { event: "*", schema: "public", table: TABLES.items }, refresh)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  const addCategory = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        return { ok: false, error: "Category name is required." };
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

  const addSauce = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        return { ok: false, error: "Sauce name is required." };
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

  const addSide = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        return { ok: false, error: "Side name is required." };
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

  const addItem = useCallback(
    async (input: AddItemInput) => {
      const trimmedName = input.name.trim();
      if (!trimmedName) {
        return { ok: false, error: "Item name is required." };
      }
      if (!input.category_id) {
        return { ok: false, error: "Pick a category for the item." };
      }
      if (!Number.isFinite(input.price) || input.price < 0) {
        return { ok: false, error: "Enter a valid price." };
      }

      const { error: insertError } = await supabase.from(TABLES.items).insert({
        name: trimmedName,
        price: input.price,
        category_id: input.category_id,
        description: input.description?.trim() || null,
        allow_sauces: input.allow_sauces,
        allow_sides: input.allow_sides,
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

  const value = useMemo(
    () => ({
      categories,
      sauces,
      sides,
      items,
      isLoading,
      error,
      refresh,
      addCategory,
      addSauce,
      addSide,
      addItem,
    }),
    [categories, sauces, sides, items, isLoading, error, refresh, addCategory, addSauce, addSide, addItem]
  );

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
};

export const useMenu = () => {
  const context = useContext(MenuContext);
  if (!context) {
    throw new Error("useMenu must be used within a MenuProvider.");
  }
  return context;
};
