import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Cuentas from './pages/Cuentas';
import DetalleCuenta from './pages/DetalleCuenta';
import Legal from './pages/Legal';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"        element={<Login />} />
          <Route path="/dashboard"    element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/cuenta/:id"   element={<ProtectedRoute><DetalleCuenta /></ProtectedRoute>} />
          <Route path="/cuentas"      element={<ProtectedRoute><Cuentas /></ProtectedRoute>} />
          <Route path="/privacidad"        element={<Legal />} />
          <Route path="/terminos"          element={<Legal />} />
          <Route path="/eliminacion-datos" element={<Legal />} />
          <Route path="*"             element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
