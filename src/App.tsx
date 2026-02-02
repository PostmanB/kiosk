import Navbar from "./components/Navbar";
import { OrdersProvider } from "./features/orders/OrdersContext";
import AppRoutes from "./routes/AppRoutes";

function App() {
  return (
    <OrdersProvider>
      <div className="min-h-screen bg-primary text-contrast transition-colors duration-300">
        <Navbar />
        <main className="mx-auto max-w-6xl px-4 py-12">
          <AppRoutes />
        </main>
      </div>
    </OrdersProvider>
  );
}

export default App;
