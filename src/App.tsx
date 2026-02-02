import Navbar from "./components/Navbar";
import { OrdersProvider } from "./features/orders/OrdersContext";
import { MenuProvider } from "./features/menu/MenuContext";
import AppRoutes from "./routes/AppRoutes";

function App() {
  return (
    <OrdersProvider>
      <MenuProvider>
        <div className="min-h-screen bg-primary text-contrast transition-colors duration-300">
          <Navbar />
          <main className="mx-auto max-w-6xl px-4 py-12">
            <AppRoutes />
          </main>
        </div>
      </MenuProvider>
    </OrdersProvider>
  );
}

export default App;
