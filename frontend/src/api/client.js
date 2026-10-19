import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("hc_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("hc_token");
      localStorage.removeItem("hc_user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;

// ── API helpers ──────────────────────────────────────────────

export const auth = {
  register: (data)  => api.post("/auth/register", data),
  login:    (data)  => api.post("/auth/login", data),
  logout:   ()      => api.post("/auth/logout"),
  me:       ()      => api.get("/auth/me"),
};

export const patients = {
  me:           ()         => api.get("/patients/me"),
  myRecords:    ()         => api.get("/patients/me/records"),
  myRequests:   ()         => api.get("/patients/me/access-requests"),
  updateWallet: (addr)     => api.put("/patients/me/wallet", { walletAddress: addr }),
  records:      (id)       => api.get(`/patients/${id}/records`),
};

export const records = {
  create: (data)   => api.post("/records", data),
  get:    (id)     => api.get(`/records/${id}`),
  verify: (id)     => api.post(`/records/${id}/verify`),
};

export const access = {
  request: (data)        => api.post("/access-requests", data),
  list:    ()            => api.get("/access-requests"),
  grant:   (id, data)    => api.post(`/access-requests/${id}/grant`, data),
  deny:    (id)          => api.post(`/access-requests/${id}/deny`),
  revoke:  (id)          => api.post(`/access-requests/${id}/revoke`),
};

export const hospitals = {
  list:      ()     => api.get("/hospitals"),
  get:       (id)   => api.get(`/hospitals/${id}`),
  register:  (data) => api.post("/hospitals/register", data),
  doctors:   (id)   => api.get(`/hospitals/${id}/doctors`),
};

export const auditApi = {
  logs: (params) => api.get("/audit", { params }),
};

export const performance = {
  results:   () => api.get("/performance/results"),
  gasReport: () => api.get("/performance/gas-report"),
};
