import { useEffect, useRef } from "react";

export function useAutoScroll<T extends HTMLElement>(deps: unknown[]) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }, deps);

  return ref;
}
