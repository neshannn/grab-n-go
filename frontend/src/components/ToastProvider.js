import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 1;

function Toast({ toast, onClose }) {
  const background = toast.type === 'error' ? '#fee2e2' : toast.type === 'success' ? '#dcfce7' : '#e0e7ff';
  const color = toast.type === 'error' ? '#b91c1c' : toast.type === 'success' ? '#166534' : '#3730a3';
  return (
    <div style={{ background, color, borderLeft: `4px solid ${color}`, padding: '10px 12px', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1 }}>{toast.message}</div>
      <button onClick={() => onClose(toast.id)} style={{ color, fontWeight: 700, background: 'transparent', border: 'none', cursor: 'pointer' }}>×</button>
    </div>
  );
}

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'info', timeoutMs = 3000) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    if (timeoutMs > 0) {
      setTimeout(() => remove(id), timeoutMs);
    }
  }, [remove]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div style={{ position: 'fixed', right: 16, bottom: 16, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 2000 }}>
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onClose={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}




