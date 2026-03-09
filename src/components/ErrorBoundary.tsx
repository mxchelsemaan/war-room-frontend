import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex items-center justify-center h-full w-full bg-background">
          <div className="glass-panel px-6 py-4 text-center">
            <p className="text-sm font-medium text-foreground">Something went wrong.</p>
            <p className="mt-1 text-xs text-muted-foreground">Reload the page to try again.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
