import { Component, type ReactNode } from "react";
import { ErrorState } from "./States";

type Props = { children: ReactNode; fallback?: ReactNode; title?: string };

export class Boundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;
    return <ErrorState title={this.props.title} error={this.state.error} onRetry={() => this.setState({ error: null })} />;
  }
}
