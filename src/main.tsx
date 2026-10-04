import './styles/base.css';
import './styles/tokens.css';
import './styles/native.css';

async function start() {
  const container = document.getElementById('root');
  if (!container) throw new Error('Missing root container');
  const [{ createRoot }, { StrictMode }, { CloudApp }, { ErrorBoundary }] = await Promise.all([
    import('react-dom/client'), import('react'), import('./app/CloudApp'), import('./components/ErrorBoundary'),
  ]);
  createRoot(container).render(<StrictMode><ErrorBoundary><CloudApp /></ErrorBoundary></StrictMode>);
}

void start().catch(() => {
  const message = document.createElement('p');
  message.setAttribute('role', 'alert');
  message.textContent = 'No se ha podido iniciar Mi Agenda. Recarga la página para volver a intentarlo.';
  (document.getElementById('root') ?? document.body).replaceChildren(message);
});

if (import.meta.env.PROD && 'serviceWorker' in navigator) { window.addEventListener('load', () => { void navigator.serviceWorker.register('./service-worker.js').catch(() => {}); }); }
