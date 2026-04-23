'use client';

import { useRef } from 'react';

export function MagneticButton({ className = '', children, ...props }) {
  const ref = useRef(null);

  function handlePointerMove(event) {
    const button = ref.current;
    if (!button) {
      return;
    }

    const rect = button.getBoundingClientRect();
    const offsetX = ((event.clientX - rect.left) / rect.width - 0.5) * 12;
    const offsetY = ((event.clientY - rect.top) / rect.height - 0.5) * 10;
    button.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
  }

  function resetTransform() {
    if (ref.current) {
      ref.current.style.transform = 'translate3d(0, 0, 0)';
    }
  }

  return (
    <button
      {...props}
      ref={ref}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetTransform}
      className={`transition-transform duration-200 will-change-transform ${className}`}
    >
      {children}
    </button>
  );
}
