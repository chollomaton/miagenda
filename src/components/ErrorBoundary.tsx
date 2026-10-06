import { Component } from 'react';
import type { ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() { return { hasError: true }; }

  render() {
    if (this.state.hasError) {
      return <main role="alert"><h1>No se ha podido mostrar Mi Agenda</h1><p>Recarga la página para volver a intentarlo.</p><button type="button" onClick={() => window.location.reload()}>Reintentar</button></main>;
    }
    return this.props.children;
  }
}
