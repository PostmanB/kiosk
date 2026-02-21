import { useMemo } from "react";
import Navbar from "./components/Navbar";
import VirtualKeyboard from "./components/VirtualKeyboard";
import PinGate from "./features/pin/PinGate";
import { OrdersProvider } from "./features/orders/OrdersContext";
import { MenuProvider } from "./features/menu/MenuContext";
import { SessionsProvider } from "./features/sessions/SessionsContext";
import AppRoutes from "./routes/AppRoutes";
import { Bounce, ToastContainer } from "react-toastify";
import useDocumentTheme from "./hooks/useDocumentTheme";

const ENABLE_VIRTUAL_KEYBOARD = false;

function App() {
  const isDark = useDocumentTheme();
  const toastTheme = useMemo(() => (isDark ? "dark" : "light"), [isDark]);

  return (
    <PinGate>
      <OrdersProvider>
        <MenuProvider>
          <SessionsProvider>
            <div className="min-h-screen bg-primary text-contrast transition-colors duration-300">
              <Navbar />
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
    </PinGate>
  );
}

export default App;
