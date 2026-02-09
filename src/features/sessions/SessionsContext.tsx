import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export type SessionStatus = "open" | "closed";

export type TableSession = {
  id: string;
  table: string;
  status: SessionStatus;
  openedAt: string;
  closedAt: string | null;
};

type SessionsContextValue = {
  sessions: TableSession[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createSession: (table: string) => Promise<{ ok: boolean; session?: TableSession; error?: string }>;
  closeSession: (id: string) => Promise<{ ok: boolean; error?: string }>;
};

const TABLE_NAME = "kiosk_sessions";

type SessionRow = {
  id: string;
  table_number: string;
  status: string | null;
  opened_at: string;
  closed_at: string | null;
};

const SessionsContext = createContext<SessionsContextValue | undefined>(undefined);

const isSessionStatus = (value: string | null): value is SessionStatus =>
  value === "open" || value === "closed";

const mapRowToSession = (row: SessionRow): TableSession => ({
  id: row.id,
  table: row.table_number,
  status: isSessionStatus(row.status) ? row.status : "open",
  openedAt: row.opened_at,
  closedAt: row.closed_at,
});

export const SessionsProvider = ({ children }: { children: React.ReactNode }) => {
  const [sessions, setSessions] = useState<TableSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const { data, error: fetchError } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .order("opened_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setIsLoading(false);
      return;
    }

    setSessions((data ?? []).map(mapRowToSession));
    setError(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel("kiosk-sessions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: TABLE_NAME },
        () => {
          refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  const createSession = useCallback(
    async (table: string) => {
      const trimmed = table.trim();
      if (!trimmed) {
        return { ok: false, error: "Az asztal megadása kötelező." };
      }
      const { data, error: insertError } = await supabase
        .from(TABLE_NAME)
        .insert({ table_number: trimmed, status: "open" })
        .select("*")
        .single();

      if (insertError) {
        setError(insertError.message);
        return { ok: false, error: insertError.message };
      }

      const session = data ? mapRowToSession(data as SessionRow) : undefined;
      setError(null);
      await refresh();
      return { ok: true, session };
    },
    [refresh]
  );

  const closeSession = useCallback(
    async (id: string) => {
      const { error: updateError } = await supabase
        .from(TABLE_NAME)
        .update({ status: "closed", closed_at: new Date().toISOString() })
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

  const value = useMemo(
    () => ({ sessions, isLoading, error, refresh, createSession, closeSession }),
    [sessions, isLoading, error, refresh, createSession, closeSession]
  );

  return <SessionsContext.Provider value={value}>{children}</SessionsContext.Provider>;
};

export const useSessions = () => {
  const context = useContext(SessionsContext);
  if (!context) {
    throw new Error("A useSessions csak SessionsProvideren belül használható.");
  }
  return context;
};
