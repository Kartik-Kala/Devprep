import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const AuthContext = createContext(null);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { email, token }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("devprep_token");
    const email = localStorage.getItem("devprep_email");
    if (token && email) {
      setUser({ token, email });
    }
    setLoading(false);
  }, []);

  const register = async (email, password) => {
    const res = await axios.post(`${API}/auth/register`, { email, password });
    const { token } = res.data;
    localStorage.setItem("devprep_token", token);
    localStorage.setItem("devprep_email", email);
    setUser({ token, email });
    return res.data;
  };

  const login = async (email, password) => {
    const res = await axios.post(`${API}/auth/login`, { email, password });
    const { token } = res.data;
    localStorage.setItem("devprep_token", token);
    localStorage.setItem("devprep_email", email);
    setUser({ token, email });
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem("devprep_token");
    localStorage.removeItem("devprep_email");
    setUser(null);
  };

  const getAuthHeader = () => {
    const token = user?.token || localStorage.getItem("devprep_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, getAuthHeader }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}