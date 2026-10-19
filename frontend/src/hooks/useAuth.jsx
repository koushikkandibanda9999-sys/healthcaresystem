import { useState, useEffect, createContext, useContext } from "react";
import { auth as authApi } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(() => {
    try { return JSON.parse(localStorage.getItem("hc_user")); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  function saveSession(token, userData) {
    localStorage.setItem("hc_token", token);
    localStorage.setItem("hc_user", JSON.stringify(userData));
    setUser(userData);
  }

  async function login(email, password) {
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      saveSession(res.data.token, res.data.user);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.response?.data?.error || "Login failed" };
    } finally {
      setLoading(false);
    }
  }

  async function register(data) {
    setLoading(true);
    try {
      const res = await authApi.register(data);
      saveSession(res.data.token, res.data.user);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.response?.data?.error || "Registration failed" };
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    authApi.logout().catch(() => {});
    localStorage.removeItem("hc_token");
    localStorage.removeItem("hc_user");
    setUser(null);
  }

  const value = { user, loading, login, register, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
