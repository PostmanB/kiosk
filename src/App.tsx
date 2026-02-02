import Navbar from "./components/Navbar";
import { OrdersProvider } from "./features/orders/OrdersContext";
import { MenuProvider } from "./features/menu/MenuContext";
import { SessionsProvider } from "./features/sessions/SessionsContext";
import AppRoutes from "./routes/AppRoutes";

function App() {
  return (
    <OrdersProvider>
      <MenuProvider>
        <SessionsProvider>
          <div className="min-h-screen bg-primary text-contrast transition-colors duration-300">
            <Navbar />
            <main className="w-full px-4 py-12">
              <AppRoutes />
            </main>
          </div>
        </SessionsProvider>
      </MenuProvider>
    </OrdersProvider>
  );
}

export default App;
