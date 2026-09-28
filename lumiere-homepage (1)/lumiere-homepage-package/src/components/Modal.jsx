import React, { useEffect, useRef } from 'react';

export default function Modal({ children, onClose, titleId, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; dialog.close(); };
  }, []);
  return <dialog ref={ref} className={`shared-modal ${className}`} aria-labelledby={titleId}
    onClose={() => { if (!ref.current?.open) onClose(); }}
    onClick={event => {
      if (event.target !== ref.current) return;
      const box = ref.current.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
    }}>
    <button className="dialog-close" type="button" onClick={onClose} aria-label="Close window">×</button>
    {children}
  </dialog>;
}
