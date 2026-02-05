import { Navigate, Route, Routes } from "react-router-dom";
import Admin from "../pages/Admin";
import Bills from "../pages/Bills";
import Cashier from "../pages/Cashier";
import Kitchen from "../pages/Kitchen";
import Stats from "../pages/Stats";

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Cashier />} />
      <Route path="/cashier" element={<Cashier />} />
      <Route path="/bills" element={<Bills />} />
      <Route path="/kitchen" element={<Kitchen />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/stats" element={<Stats />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
