import { createContext, useContext, useState, useEffect } from 'react';

const STORAGE_KEY = 'pdv_bosque_waiter';

const WaiterContext = createContext(null);

export function WaiterProvider({ children }) {
  const [waiter, setWaiterState] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        // Garçom normal (tem id) ou usuário "caixa" (acesso total)
        if ((data?.id != null && data?.name) || (data?.isCaixa && data?.name)) setWaiterState(data);
      }
    } catch (_) {}
  }, []);

  const setWaiter = (data) => {
    setWaiterState(data);
    if (data) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    else localStorage.removeItem(STORAGE_KEY);
  };

  const logout = () => setWaiter(null);

  return (
    <WaiterContext.Provider value={{ waiter, setWaiter, logout }}>
      {children}
    </WaiterContext.Provider>
  );
}

export function useWaiter() {
  const ctx = useContext(WaiterContext);
  if (!ctx) throw new Error('useWaiter must be used inside WaiterProvider');
  return ctx;
}
