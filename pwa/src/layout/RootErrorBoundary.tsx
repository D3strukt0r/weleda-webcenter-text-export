import { Component, ErrorInfo, PropsWithChildren } from 'react';

interface State {
  hasError: boolean;
}

export class RootErrorBoundary extends Component<PropsWithChildren<object>, State> {
  constructor(props: object) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex items-center justify-center flex-col text-center">
          <h1>Oops!</h1>
          <p>Sorry, an unexpected error has occurred.</p>
        </div>
      );
    }

    return this.props.children;
  }
}
