// Substitui next/dynamic no build estático (tudo já é client-side).
import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from "react";

export default function dynamic<P extends object>(loader: () => Promise<{ default: ComponentType<P> }>) {
  const Lazy = lazy(loader) as LazyExoticComponent<ComponentType<object>>;
  return function Dynamic(props: P) {
    return (
      <Suspense fallback={null}>
        <Lazy {...props} />
      </Suspense>
    );
  };
}
