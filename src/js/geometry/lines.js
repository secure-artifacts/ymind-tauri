export function getLinePathData(node, child, isRootOfView, lineStyle = "curve") {
  let x1, y1, x2, y2;
  const isDown = child.branchDirection === "down";
  const isLeft = child.branchDirection === "left";

  if (isDown) {
    x1 = node.x + node.width / 2; y1 = node.y + node.height;
    x2 = child.x + child.width / 2; y2 = child.y;
  } else if (isLeft) {
    x1 = node.x; y1 = node.y + node.height / 2;
    x2 = child.x + child.width; y2 = child.y + child.height / 2;
  } else {
    x1 = node.x + node.width; y1 = node.y + node.height / 2;
    x2 = child.x; y2 = child.y + child.height / 2;
  }

  const dx = x2 - x1, dy = y2 - y1;

  if (lineStyle === "straight") {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }

  if (lineStyle === "rounded-ortho") {
    const r = 8;
    if (isDown) {
      const midY = (y1 + y2) / 2;
      const sx = Math.sign(dx) || 1;
      if (Math.abs(dx) < r * 2) return `M ${x1} ${y1} L ${x2} ${y2}`;
      return `M ${x1} ${y1} L ${x1} ${midY - r} Q ${x1} ${midY} ${x1 + sx * r} ${midY} L ${x2 - sx * r} ${midY} Q ${x2} ${midY} ${x2} ${midY + r} L ${x2} ${y2}`;
    } else {
      const midX = (x1 + x2) / 2;
      const sy = Math.sign(dy) || 1;
      const sx = isLeft ? -1 : 1;
      if (Math.abs(dy) < r * 2) return `M ${x1} ${y1} L ${x2} ${y2}`;
      return `M ${x1} ${y1} L ${midX - sx * r} ${y1} Q ${midX} ${y1} ${midX} ${y1 + sy * r} L ${midX} ${y2 - sy * r} Q ${midX} ${y2} ${midX + sx * r} ${y2} L ${x2} ${y2}`;
    }
  }

  if (lineStyle === "hand-drawn") {
    if (isDown) {
      const cx1 = x1 + dx * 0.12, cy1 = y1 + dy * 0.52;
      const cx2 = x2 - dx * 0.12, cy2 = y2 - dy * 0.38;
      return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
    } else {
      const dxAbs = Math.abs(dx), dyAbs = Math.abs(dy);
      const tension = isLeft ? -Math.min(Math.max(32, dyAbs * 0.35), dxAbs * 0.55) : Math.min(Math.max(32, dyAbs * 0.35), dxAbs * 0.55);
      const sweepY = Math.sin(Math.min(Math.PI, dyAbs * 0.025)) * (dy >= 0 ? 3.2 : -3.2);
      const cx1 = x1 + tension, cy1 = y1 + dy * 0.08 + sweepY;
      const cx2 = isLeft ? (x2 + Math.max(26, dxAbs * 0.36)) : (x2 - Math.max(26, dxAbs * 0.36));
      const cy2 = y2 - sweepY * 0.5;
      return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
    }
  }

  // 默认平滑曲线
  if (isDown) {
    return `M ${x1} ${y1} C ${x1} ${y1 + dy * 0.5}, ${x2} ${y2 - dy * 0.5}, ${x2} ${y2}`;
  } else if (isLeft) {
    const tension = Math.min(Math.max(26, Math.abs(dy) * 0.28), Math.abs(dx) * 0.52);
    return `M ${x1} ${y1} C ${x1 - tension} ${y1 + dy * 0.08}, ${x2 + Math.max(22, Math.abs(dx) * 0.35)} ${y2}, ${x2} ${y2}`;
  } else {
    const tension = Math.min(Math.max(26, Math.abs(dy) * 0.28), Math.abs(dx) * 0.52);
    return `M ${x1} ${y1} C ${x1 + tension} ${y1 + dy * 0.08}, ${x2 - Math.max(22, Math.abs(dx) * 0.35)} ${y2}, ${x2} ${y2}`;
  }
}
