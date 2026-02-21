import { useMemo } from "react";
import Navbar from "./components/Navbar";
import VirtualKeyboard from "./components/VirtualKeyboard";
import PinGate from "./features/pin/PinGate";
import { OfflineSyncProvider, useOfflineSync } from "./features/offline/OfflineSyncContext";
import { OrdersProvider } from "./features/orders/OrdersContext";
import { MenuProvider } from "./features/menu/MenuContext";
import { SessionsProvider } from "./features/sessions/SessionsContext";
import AppRoutes from "./routes/AppRoutes";
import { Bounce, ToastContainer } from "react-toastify";
import useDocumentTheme from "./hooks/useDocumentTheme";

const ENABLE_VIRTUAL_KEYBOARD = false;

const OfflineBanner = () => {
  const { isOnline, pendingCount, isSyncing } = useOfflineSync();
  if (isOnline && pendingCount === 0) return null;

  return (
    <div className="border-b border-amber-400/40 bg-amber-200/70 px-4 py-2 text-xs font-semibold text-amber-900 dark:bg-amber-500/15 dark:text-amber-100">
      {!isOnline
        ? "Nincs internetkapcsolat. A mentések sorba állnak és automatikusan szinkronizálódnak."
        : isSyncing
          ? `Szinkronizálás folyamatban... (${pendingCount} függőben)`
          : `${pendingCount} függőben lévő mentés. Várakozás újrapróbálásra.`}
    </div>
  );
};

function App() {
  const isDark = useDocumentTheme();
  const toastTheme = useMemo(() => (isDark ? "dark" : "light"), [isDark]);

  return (
    <PinGate>
      <OfflineSyncProvider>
        <OrdersProvider>
          <MenuProvider>
            <SessionsProvider>
              <div className="min-h-screen bg-primary text-contrast transition-colors duration-300">
                <Navbar />
                <OfflineBanner />
                <main className="w-full px-4 pt-6 pb-12">
                  <AppRoutes />
                </main>
                {ENABLE_VIRTUAL_KEYBOARD ? <VirtualKeyboard /> : null}
              </div>
              <ToastContainer
                position="top-center"
                autoClose={1000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick={false}
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme={toastTheme}
                transition={Bounce}
              />
            </SessionsProvider>
          </MenuProvider>
        </OrdersProvider>
      </OfflineSyncProvider>
    </PinGate>
  );
}

export default App;
