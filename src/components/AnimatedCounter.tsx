import { useState, useEffect, useRef } from "react";

export function AnimatedCounter({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(0);
  const animRef = useRef<number>();

  useEffect(() => {
    const start = prevValue.current;
    const end = value;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      const current = Math.round(start + (end - start) * eased);
      setDisplay(current);

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        prevValue.current = end;
      }
    };

    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [value, duration]);

  return <>{display}</>;
}
