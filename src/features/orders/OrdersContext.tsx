import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export type OrderStatus = "new" | "prepping" | "ready" | "served";

export type OrderItem = {
  name: string;
  quantity: number;
  modifiers?: Record<string, string[]>;
  price?: number;
  registerCode?: string;
  showInKitchen?: boolean;
  done?: boolean;
};

export type Order = {
  id: string;
  table: string;
  sessionId: string | null;
  items: OrderItem[];
  notes: string;
  status: OrderStatus;
  createdAt: string;
};

type NewOrderInput = {
  table: string;
  sessionId?: string | null;
  items: OrderItem[];
  notes?: string;
};

type OrdersContextValue = {
  orders: Order[];
  isLoading: boolean;
  error: string | null;
  addOrder: (input: NewOrderInput) => Promise<{ ok: boolean; error?: string }>;
  updateStatus: (id: string, status: OrderStatus) => Promise<void>;
  updateItemDone: (id: string, itemIndex: number, done: boolean) => Promise<void>;
  removeOrder: (id: string) => Promise<void>;
  clearServed: () => Promise<void>;
};

const TABLE_NAME = "kiosk_orders";

type OrderRow = {
  id: string;
  table_number: string;
  session_id: string | null;
  items: OrderItem[] | null;
  notes: string | null;
  status: string | null;
  created_at: string;
};

const OrdersContext = createContext<OrdersContextValue | undefined>(undefined);

const isOrderStatus = (value: string | null): value is OrderStatus =>
  value === "new" || value === "prepping" || value === "ready" || value === "served";

const mapRowToOrder = (row: OrderRow): Order => ({
  id: row.id,
  table: row.table_number,
  sessionId: row.session_id ?? null,
  items: Array.isArray(row.items) ? row.items : [],
  notes: row.notes ?? "",
  status: isOrderStatus(row.status) ? row.status : "new",
  createdAt: row.created_at,
});

export const OrdersProvider = ({ children }: { children: React.ReactNode }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    const { data, error: fetchError } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setIsLoading(false);
      return;
    }

    setOrders((data ?? []).map(mapRowToOrder));
    setError(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchOrders();
    const channel = supabase
      .channel("kiosk-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: TABLE_NAME },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrders]);

  const addOrder = useCallback(async ({ table, items, notes, sessionId }: NewOrderInput) => {
    const cleanedItems = items
      .map((item) => ({
        name: item.name.trim(),
        quantity: Math.max(1, Math.floor(item.quantity)),
        modifiers: item.modifiers ?? {},
        price: typeof item.price === "number" ? item.price : undefined,
        registerCode: item.registerCode ?? undefined,
        showInKitchen: item.showInKitchen ?? true,
        done: item.done ?? false,
      }))
      .filter((item) => item.name.length > 0);

    if (!table.trim() || cleanedItems.length === 0) {
      return { ok: false, error: "Missing table or items." };
    }

    const { error: insertError } = await supabase.from(TABLE_NAME).insert({
      table_number: table.trim(),
      session_id: sessionId ?? null,
      items: cleanedItems,
      notes: notes?.trim() ?? "",
      status: "new",
    });

    if (insertError) {
      setError(insertError.message);
      return { ok: false, error: insertError.message };
    }

    setError(null);
    await fetchOrders();
    return { ok: true };
  }, [fetchOrders]);

  const updateStatus = useCallback(
    async (id: string, status: OrderStatus) => {
    const { error: updateError } = await supabase
      .from(TABLE_NAME)
      .update({ status })
      .eq("id", id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setError(null);
    await fetchOrders();
  }, [fetchOrders]);

  const updateItemDone = useCallback(
    async (id: string, itemIndex: number, done: boolean) => {
      let nextItems: OrderItem[] | null = null;

      setOrders((prev) => {
        const order = prev.find((current) => current.id === id);
        if (!order) return prev;

        const updatedItems = order.items.map((item, index) =>
          index === itemIndex ? { ...item, done } : item
        );
        nextItems = updatedItems;

        return prev.map((current) =>
          current.id === id ? { ...current, items: updatedItems } : current
        );
      });

      if (!nextItems) return;

      const { error: updateError } = await supabase
        .from(TABLE_NAME)
        .update({ items: nextItems })
        .eq("id", id);

      if (updateError) {
        setError(updateError.message);
        await fetchOrders();
        return;
      }

      setError(null);
    },
    [fetchOrders]
  );

  const removeOrder = useCallback(async (id: string) => {
    const { error: deleteError } = await supabase.from(TABLE_NAME).delete().eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setError(null);
    await fetchOrders();
  }, [fetchOrders]);

  const clearServed = useCallback(async () => {
    const { error: deleteError } = await supabase.from(TABLE_NAME).delete().eq("status", "served");
    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setError(null);
    await fetchOrders();
  }, [fetchOrders]);

  const value = useMemo(
    () => ({
      orders,
      isLoading,
      error,
      addOrder,
      updateStatus,
      updateItemDone,
      removeOrder,
      clearServed,
    }),
    [orders, isLoading, error, addOrder, updateStatus, updateItemDone, removeOrder, clearServed]
  );

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
};

export const useOrders = () => {
  const context = useContext(OrdersContext);
  if (!context) {
    throw new Error("useOrders must be used within an OrdersProvider.");
  }
  return context;
};
