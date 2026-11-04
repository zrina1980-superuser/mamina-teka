import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    try {
      if (import.meta.env.PROD) {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            reg.update().catch(() => {});
          })
          .catch(() => {});
      } else {
        navigator.serviceWorker
          .getRegistrations()
          .then((regs) => {
            for (const reg of regs) {
              reg.unregister().catch(() => {});
            }
          })
          .catch(() => {});
      }
    } catch {
      // Ignore cross-origin iframe restrictions
    }
  });
}

createRoot(document.getElementById('root')!).render(<App />);

