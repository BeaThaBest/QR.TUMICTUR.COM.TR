"use client";
import { useEffect, type DependencyList } from "react";

export default function useDebouncedEffect(effect: () => void, deps: DependencyList, delay: number) {
  useEffect(() => {
    const handler = setTimeout(() => {
      effect();
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delay]);
}
