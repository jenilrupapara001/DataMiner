import React from 'react';
import './Skeleton.css';

/**
 * Base Skeleton element.
 *
 * @param {object}  props
 * @param {string|number} [props.width]        CSS width (e.g. '100%', 120)
 * @param {string|number} [props.height]       CSS height
 * @param {string}  [props.borderRadius]       Overrides default radius
 * @param {'rectangular'|'circular'|'text'}  [props.variant='rectangular']
 * @param {'wave'|'pulse'|'none'}             [props.animation='wave']
 * @param {string}  [props.className]
 * @param {number}  [props.count=1]            Render multiple lines (text variant)
 * @param {object}  [props.style]
 */
function Skeleton({
  width,
  height,
  borderRadius,
  variant = 'rectangular',
  animation = 'wave',
  className = '',
  count = 1,
  style = {},
}) {
  const variantClass = variant === 'circular' ? 'sk--circular'
    : variant === 'text'        ? 'sk--text'
    : '';

  const animClass = animation === 'wave'  ? 'sk--wave'
    : animation === 'pulse' ? 'sk--pulse'
    : '';

  const baseStyle = {
    width:  width  !== undefined ? (typeof width  === 'number' ? `${width}px`  : width)  : undefined,
    height: height !== undefined ? (typeof height === 'number' ? `${height}px` : height) : undefined,
    ...(borderRadius ? { borderRadius } : {}),
    ...style,
  };

  // Default dimensions per variant
  if (variant === 'circular') {
    if (!baseStyle.width)  baseStyle.width  = '40px';
    if (!baseStyle.height) baseStyle.height = baseStyle.width;
    baseStyle.borderRadius = '50%';
  } else if (variant === 'text') {
    if (!baseStyle.height) baseStyle.height = '1em';
    if (!baseStyle.width)  baseStyle.width  = '100%';
  } else {
    if (!baseStyle.height) baseStyle.height = '100px';
    if (!baseStyle.width)  baseStyle.width  = '100%';
  }

  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          role="presentation"
          className={`sk ${variantClass} ${animClass} ${className}`.trim()}
          style={{
            ...baseStyle,
            // Last text line is usually shorter (natural text look)
            ...(variant === 'text' && i === count - 1 && count > 1
              ? { width: '65%' }
              : {}),
            ...(i > 0 ? { animationDelay: `${i * 0.07}s` } : {}),
          }}
        />
      ))}
    </>
  );
}

export default Skeleton;
