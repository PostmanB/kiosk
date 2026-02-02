import { useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import { OrdersProvider } from "./features/orders/OrdersContext";
import { MenuProvider } from "./features/menu/MenuContext";
import AppRoutes from "./routes/AppRoutes";

function App() {
  const location = useLocation();
  const isKitchen = location.pathname.startsWith("/kitchen");

  return (
    <OrdersProvider>
      <MenuProvider>
        <div className="min-h-screen bg-primary text-contrast transition-colors duration-300">
          <Navbar />
          <main className={`mx-auto px-4 py-12 ${isKitchen ? "w-full max-w-none" : "max-w-6xl"}`}>
            <AppRoutes />
          </main>
        </div>
      </MenuProvider>
    </OrdersProvider>
  );
}

export default App;
