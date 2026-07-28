import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import type { Order, OrderItem, OrderStatus } from "./OrdersContext";

const TABLE_NAME = "kiosk_orders";
const PAGE_SIZE = 1000;

type OrderRow = {
  id: string;
  table_number: string;
  session_id: string | null;
  items: OrderItem[] | null;
  notes: string | null;
  status: string | null;
  created_at: string;
};

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

const fetchOrderHistory = async () => {
  const rows: OrderRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("id, table_number, session_id, items, notes, status, created_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    const page = (data ?? []) as OrderRow[];
    rows.push(...page);

    if (page.length < PAGE_SIZE) break;
  }

  return rows.map(mapRowToOrder);
};

const useOrderHistory = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);

    try {
      const nextOrders = await fetchOrderHistory();
      if (requestId !== requestIdRef.current) return;
      setOrders(nextOrders);
      setError(null);
    } catch (refreshError) {
      if (requestId !== requestIdRef.current) return;
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "A statisztika betöltése sikertelen."
      );
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const channel = supabase
      .channel("kiosk-statistics-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: TABLE_NAME },
        () => {
          void refresh();
        }
      )
      .subscribe();

    return () => {
      requestIdRef.current += 1;
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { orders, isLoading, error, refresh };
};

export default useOrderHistory;
