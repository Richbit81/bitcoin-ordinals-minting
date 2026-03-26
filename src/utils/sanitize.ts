import DOMPurify from 'dompurify';

const SVG_CONFIG: DOMPurify.Config = {
  USE_PROFILES: { svg: true, svgFilters: true },
  ADD_TAGS: ['use', 'image', 'animate', 'animateTransform', 'animateMotion', 'set'],
  ADD_ATTR: ['href', 'xlink:href', 'viewBox', 'xmlns', 'xmlns:xlink', 'preserveAspectRatio', 'fill', 'stroke', 'opacity', 'd', 'transform', 'x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'x1', 'y1', 'x2', 'y2', 'points', 'dx', 'dy', 'text-anchor', 'dominant-baseline', 'font-size', 'font-family', 'font-weight', 'letter-spacing', 'text-decoration', 'clip-path', 'mask', 'filter', 'flood-color', 'flood-opacity', 'color-interpolation-filters', 'stdDeviation', 'in', 'in2', 'result', 'type', 'values', 'mode', 'operator', 'k1', 'k2', 'k3', 'k4', 'gradientUnits', 'gradientTransform', 'spreadMethod', 'offset', 'stop-color', 'stop-opacity', 'patternUnits', 'patternTransform', 'patternContentUnits', 'markerWidth', 'markerHeight', 'refX', 'refY', 'orient', 'begin', 'dur', 'repeatCount', 'from', 'to', 'attributeName', 'calcMode', 'keyTimes', 'keySplines'],
  FORBID_TAGS: ['script', 'style'],
  FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
};

const HTML_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: ['div', 'span', 'p', 'br', 'img', 'a', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'tr', 'td', 'th', 'thead', 'tbody'],
  ALLOWED_ATTR: ['class', 'style', 'src', 'alt', 'href', 'target', 'rel', 'width', 'height'],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button'],
  FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
};

export function sanitizeSvg(dirty: string): string {
  return DOMPurify.sanitize(dirty, SVG_CONFIG);
}

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, HTML_CONFIG);
}
