import { Navigate, Route, Routes } from "react-router-dom";
import Admin from "../pages/Admin";
import Cashier from "../pages/Cashier";
import Kitchen from "../pages/Kitchen";
import Tables from "../pages/Tables";

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Cashier />} />
      <Route path="/cashier" element={<Cashier />} />
      <Route path="/kitchen" element={<Kitchen />} />
      <Route path="/tables" element={<Tables />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
