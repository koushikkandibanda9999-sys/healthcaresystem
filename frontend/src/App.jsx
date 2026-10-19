import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth }   from "./hooks/useAuth";

// Pages
import LandingPage      from "./pages/LandingPage";
import LoginPage        from "./pages/LoginPage";
import RegisterPage     from "./pages/RegisterPage";
import PatientDashboard from "./pages/PatientDashboard";
import DoctorDashboard  from "./pages/DoctorDashboard";
import HospitalDashboard from "./pages/HospitalDashboard";
import SysAdminDashboard from "./pages/SysAdminDashboard";
import RecordDetailPage  from "./pages/RecordDetailPage";
import AuditPage         from "./pages/AuditPage";
import PerformancePage   from "./pages/PerformancePage";
import NotFoundPage      from "./pages/NotFoundPage";

function RequireAuth({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  function dashboardFor(role) {
    if (role === "patient")       return "/patient";
    if (role === "doctor")        return "/doctor";
    if (role === "hospitalAdmin") return "/hospital";
    if (role === "sysAdmin")      return "/admin";
    return "/";
  }

  return (
    <Routes>
      <Route path="/"         element={<LandingPage />} />
      <Route path="/login"    element={user ? <Navigate to={dashboardFor(user.role)} /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to={dashboardFor(user.role)} /> : <RegisterPage />} />

      <Route path="/patient/*" element={
        <RequireAuth roles={["patient"]}>
          <PatientDashboard />
        </RequireAuth>
      } />

      <Route path="/doctor/*" element={
        <RequireAuth roles={["doctor"]}>
          <DoctorDashboard />
        </RequireAuth>
      } />

      <Route path="/hospital/*" element={
        <RequireAuth roles={["hospitalAdmin"]}>
          <HospitalDashboard />
        </RequireAuth>
      } />

      <Route path="/admin/*" element={
        <RequireAuth roles={["sysAdmin"]}>
          <SysAdminDashboard />
        </RequireAuth>
      } />

      <Route path="/records/:id" element={
        <RequireAuth>
          <RecordDetailPage />
        </RequireAuth>
      } />

      <Route path="/audit" element={
        <RequireAuth>
          <AuditPage />
        </RequireAuth>
      } />

      <Route path="/performance" element={
        <RequireAuth roles={["sysAdmin", "hospitalAdmin"]}>
          <PerformancePage />
        </RequireAuth>
      } />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
