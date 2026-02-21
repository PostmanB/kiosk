import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import type { OrderItem } from "../orders/OrdersContext";

type KitchenQueueItem = {
  name: string;
  quantity: number;
  modifiers?: Record<string, string[]>;
};

type QueuedOrderPayload = {
  table: string;
  sessionId: string | null;
  isTakeawayOrder: boolean;
  items: OrderItem[];
  takeawayNumber?: number;
  notes?: string;
  kitchenItems: KitchenQueueItem[];
};

type QueueItem = {
  id: string;
  type: "submit_order";
  createdAt: string;
  payload: QueuedOrderPayload;
};

type OfflineSyncContextValue = {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  enqueueOrderSubmission: (payload: QueuedOrderPayload) => void;
  processQueue: () => Promise<void>;
};

const STORAGE_KEY = "kiosk_offline_queue_v1";
const SYNC_INTERVAL_MS = 12_000;

const OfflineSyncContext = createContext<OfflineSyncContextValue | undefined>(undefined);

const readQueue = (): QueueItem[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueueItem[] | null;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeQueue = (queue: QueueItem[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
};

const createQueueId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const replayOrderSubmission = async (item: QueueItem) => {
  const payload = item.payload;
  let sessionId = payload.sessionId;

  if (!sessionId) {
    const { data: existingSession } = await supabase
      .from("kiosk_sessions")
      .select("id")
      .eq("table_number", payload.table)
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSession?.id) {
      sessionId = existingSession.id;
    } else {
      const { data: createdSession, error: createSessionError } = await supabase
        .from("kiosk_sessions")
        .insert({ table_number: payload.table, status: "open" })
        .select("id")
        .single();

      if (createSessionError || !createdSession?.id) {
        throw new Error(createSessionError?.message ?? "Nem sikerült munkamenetet létrehozni.");
      }

      sessionId = createdSession.id;
    }
  }

  const { error: insertOrderError } = await supabase.from("kiosk_orders").insert({
    table_number: payload.table,
    session_id: sessionId,
    items: payload.items,
    notes: payload.notes?.trim() ?? "",
    status: "new",
  });
  if (insertOrderError) {
    throw new Error(insertOrderError.message);
  }

  if (payload.isTakeawayOrder && sessionId) {
    const { error: closeSessionError } = await supabase
      .from("kiosk_sessions")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", sessionId);
    if (closeSessionError) {
      throw new Error(closeSessionError.message);
    }
  }
};

export const isLikelyOfflineError = (message?: string | null) => {
  const value = (message ?? "").toLowerCase();
  return (
    value.includes("failed to fetch") ||
    value.includes("network") ||
    value.includes("offline") ||
    value.includes("fetch")
  );
};

export const OfflineSyncProvider = ({ children }: { children: React.ReactNode }) => {
  const [isOnline, setIsOnline] = useState(
    typeof window === "undefined" ? true : window.navigator.onLine
  );
  const [queue, setQueue] = useState<QueueItem[]>(() => readQueue());
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    writeQueue(queue);
  }, [queue]);

  const processQueue = useCallback(async () => {
    if (!isOnline || isSyncing) return;
    if (queue.length === 0) return;

    setIsSyncing(true);
    let remaining = [...queue];
    for (const item of queue) {
      try {
        if (item.type === "submit_order") {
          await replayOrderSubmission(item);
        }
        remaining = remaining.filter((entry) => entry.id !== item.id);
        setQueue([...remaining]);
      } catch {
        break;
      }
    }
    setIsSyncing(false);
  }, [isOnline, isSyncing, queue]);

  const enqueueOrderSubmission = useCallback((payload: QueuedOrderPayload) => {
    setQueue((prev) => [
      ...prev,
      {
        id: createQueueId(),
        type: "submit_order",
        createdAt: new Date().toISOString(),
        payload,
      },
    ]);
  }, []);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (!isOnline) return;
    void processQueue();
  }, [isOnline, processQueue]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (navigator.onLine) {
        void processQueue();
      }
    }, SYNC_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [processQueue]);

  const value = useMemo(
    () => ({
      isOnline,
      pendingCount: queue.length,
      isSyncing,
      enqueueOrderSubmission,
      processQueue,
    }),
    [isOnline, queue.length, isSyncing, enqueueOrderSubmission, processQueue]
  );

  return <OfflineSyncContext.Provider value={value}>{children}</OfflineSyncContext.Provider>;
};

export const useOfflineSync = () => {
  const context = useContext(OfflineSyncContext);
  if (!context) {
    throw new Error("A useOfflineSync csak OfflineSyncProvideren belül használható.");
  }
  return context;
};

