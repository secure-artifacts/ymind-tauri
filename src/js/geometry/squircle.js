export function getAppleSquirclePath(x, y, w, h, r, smoothing = 0.62) {
  const maxR = Math.min(w / 2, h / 2);
  r = Math.min(r, maxR);
  let p = (1 + smoothing) * r;
  if (p > maxR) { p = maxR; r = p / (1 + smoothing); }

  const a = 1.073 * r, b = 0.730 * r, c = 0.546 * r, d = 0.358 * r;
  const e = 0.205 * r, f = 0.109 * r, g = 0.015 * r;
  const x0 = x, y0 = y, x1 = x + w, y1 = y + h;

  return `
    M ${x0 + p} ${y0}
    L ${x1 - p} ${y0}
    C ${x1 - a} ${y0}, ${x1 - b} ${y0 + g}, ${x1 - c} ${y0 + f}
    C ${x1 - d} ${y0 + e}, ${x1 - e} ${y0 + d}, ${x1 - f} ${y0 + c}
    C ${x1 - g} ${y0 + b}, ${x1} ${y0 + a}, ${x1} ${y0 + p}
    L ${x1} ${y1 - p}
    C ${x1} ${y1 - a}, ${x1 - g} ${y1 - b}, ${x1 - f} ${y1 - c}
    C ${x1 - e} ${y1 - d}, ${x1 - d} ${y1 - e}, ${x1 - c} ${y1 - f}
    C ${x1 - b} ${y1 - g}, ${x1 - a} ${y1}, ${x1 - p} ${y1}
    L ${x0 + p} ${y1}
    C ${x0 + a} ${y1}, ${x0 + b} ${y1 - g}, ${x0 + c} ${y1 - f}
    C ${x0 + d} ${y1 - e}, ${x0 + e} ${y1 - d}, ${x0 + f} ${y1 - c}
    C ${x0 + g} ${y1 - b}, ${x0} ${y1 - a}, ${x0} ${y1 - p}
    L ${x0} ${y0 + p}
    C ${x0} ${y0 + a}, ${x0 + g} ${y0 + b}, ${x0 + f} ${y0 + c}
    C ${x0 + e} ${y0 + d}, ${x0 + d} ${y0 + e}, ${x0 + c} ${y0 + f}
    C ${x0 + b} ${y0 + g}, ${x0 + a} ${y0}, ${x0 + p} ${y0}
    Z
  `.replace(/\s+/g, ' ').trim();
}

export function getHandDrawnBoxPath(w, h, seedStr = "node") {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = (seed * 37 + seedStr.charCodeAt(i)) % 10000;
  }
  const pseudo = (offset = 0) => {
    const v = Math.sin(seed + offset * 17.13) * 10000;
    return v - Math.floor(v);
  };
  const j = (offset, scale = 2.4) => (pseudo(offset) - 0.5) * scale;

  const x0 = 0 + j(1), y0 = 0 + j(2);
  const x1 = w + j(3), y1 = 0 + j(4);
  const x2 = w + j(5), y2 = h + j(6);
  const x3 = 0 + j(7), y3 = h + j(8);

  const cpTopX = w * 0.5 + j(9, 3.5), cpTopY = j(10, 2.5);
  const cpRightX = w + j(11, 2.5), cpRightY = h * 0.5 + j(12, 3.5);
  const cpBottomX = w * 0.5 + j(13, 3.5), cpBottomY = h + j(14, 2.5);
  const cpLeftX = j(15, 2.5), cpLeftY = h * 0.5 + j(16, 3.5);

  return `
    M ${x0 - 2.5} ${y0 + j(17, 1.2)}
    Q ${cpTopX} ${cpTopY}, ${x1 + 2.5} ${y1 + j(18, 1.2)}
    Q ${cpRightX} ${cpRightY}, ${x2 + j(19, 1.2)} ${y2 + 2.5}
    Q ${cpBottomX} ${cpBottomY}, ${x3 - 2.5} ${y3 + j(20, 1.2)}
    Q ${cpLeftX} ${cpLeftY}, ${x0 + j(21, 1.2)} ${y0 - 2.5}
    Z
  `.replace(/\s+/g, ' ').trim();
}
