import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  account_id: string;
  twoFactorEnabled?: number;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser]       = useState<User | null>(null);
  const [token, setToken]     = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      // ── Handle Apple OAuth redirect: ?oauth_token=xxx ──────────────────────
      const params       = new URLSearchParams(window.location.search);
      const oauthToken   = params.get('oauth_token');
      const oauthError   = params.get('oauth_error');

      if (oauthToken) {
        // Clean the URL before doing anything so a page refresh doesn't re-use it
        const clean = window.location.pathname;
        window.history.replaceState({}, '', clean);

        try {
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${oauthToken}` },
          });
          if (res.ok) {
            const me = await res.json();
            localStorage.setItem('token', oauthToken);
            setToken(oauthToken);
            setUser(me);
            setIsLoading(false);
            return;
          }
        } catch { /* fall through to normal init */ }
      }

      if (oauthError) {
        window.history.replaceState({}, '', window.location.pathname);
        // Store error for Login page to pick up
        sessionStorage.setItem('oauth_error', oauthError);
      }

      // ── Normal JWT init ────────────────────────────────────────────────────
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${storedToken}` },
          });
          if (res.ok) {
            setUser(await res.json());
          } else {
            logout();
          }
        } catch {
          logout();
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
