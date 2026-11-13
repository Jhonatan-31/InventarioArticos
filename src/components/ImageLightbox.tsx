import { useEffect } from 'react';

type Props = {
  src: string;
  title?: string;
  subtitle?: string;
  onClose: () => void;
};

export function ImageLightbox({ src, title, subtitle, onClose }: Props) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="image-lightbox" role="dialog" aria-modal="true" aria-label={title || 'Vista de imagen'} onMouseDown={onClose}>
      <div className="image-lightbox-panel" onMouseDown={(event) => event.stopPropagation()}>
        <header className="image-lightbox-head">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">×</button>
        </header>
        <div className="image-lightbox-stage">
          <img src={src} alt={title || 'Referencia'} />
        </div>
      </div>
    </div>
  );
}
