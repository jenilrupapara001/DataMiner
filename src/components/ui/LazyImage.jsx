import React, { useState, useRef, useEffect } from 'react';

/**
 * LazyImage
 * ─────────────────────────────────────────────────────────────────────────────
 * A drop-in <img> replacement that:
 *  - Only starts loading the real image when it scrolls within `rootMargin` px
 *    of the viewport (IntersectionObserver)
 *  - Shows a blurred low-res placeholder or skeleton color until the real src loads
 *  - Fades in the loaded image
 *  - Shows a fallback UI on load error
 *  - Uses native loading="lazy" as a progressive enhancement fallback
 *
 * @param {object}  props
 * @param {string}  props.src              Actual image URL
 * @param {string}  props.alt              Alt text
 * @param {string|number} [props.width]
 * @param {string|number} [props.height]
 * @param {string}  [props.placeholder]    Low-res src or base64 data URL for blur-up
 * @param {string}  [props.className]
 * @param {string}  [props.rootMargin='300px']  How far ahead of viewport to start loading
 * @param {string}  [props.objectFit='cover']
 * @param {string}  [props.fallbackText='Image unavailable']
 *
 * @example
 *   <LazyImage src={product.imageUrl} alt={product.name} width={80} height={80} />
 * ─────────────────────────────────────────────────────────────────────────────
 */
export default function LazyImage({
  src,
  alt = '',
  width,
  height,
  placeholder,
  className = '',
  rootMargin = '300px',
  objectFit = 'cover',
  fallbackText = '—',
  style = {},
  ...rest
}) {
  const [isInView,  setIsInView]  = useState(false);
  const [isLoaded,  setIsLoaded]  = useState(false);
  const [hasError,  setHasError]  = useState(false);
  const containerRef = useRef(null);

  // Intersection observer: trigger load when near viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // If IntersectionObserver not supported, load immediately
    if (!window.IntersectionObserver) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0.01 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  const containerStyle = {
    position: 'relative',
    overflow: 'hidden',
    display: 'inline-block',
    width:  width  !== undefined ? (typeof width  === 'number' ? `${width}px`  : width)  : '100%',
    height: height !== undefined ? (typeof height === 'number' ? `${height}px` : height) : 'auto',
    backgroundColor: '#e8eaed',
    ...style,
  };

  return (
    <div
      ref={containerRef}
      className={`lazy-image-wrap ${className}`}
      style={containerStyle}
      aria-label={alt || undefined}
    >
      {/* Blur-up placeholder */}
      {!isLoaded && !hasError && placeholder && (
        <img
          src={placeholder}
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit,
            filter: 'blur(12px)',
            transform: 'scale(1.08)',
            opacity: 1,
          }}
        />
      )}

      {/* Actual image — only mounted once in view */}
      {isInView && !hasError && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit,
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.4s ease',
          }}
          {...rest}
        />
      )}

      {/* Error fallback */}
      {hasError && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            color: '#9ca3af',
            background: '#f3f4f6',
          }}
          aria-label={`Image unavailable: ${alt}`}
        >
          {fallbackText}
        </div>
      )}
    </div>
  );
}
