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
  const dxAbs = Math.abs(dx), dyAbs = Math.abs(dy);

  // 1. 极简直线
  if (lineStyle === "straight") {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }

  // 2. 直角折线
  if (lineStyle === "sharp-ortho") {
    if (isDown) {
      const midY = (y1 + y2) / 2;
      return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
    } else {
      const midX = (x1 + x2) / 2;
      return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
    }
  }

  // 3. 圆角折线
  if (lineStyle === "rounded-ortho") {
    const r = 8;
    if (isDown) {
      const midY = (y1 + y2) / 2;
      const sx = Math.sign(dx) || 1;
      if (dxAbs < r * 2) return `M ${x1} ${y1} L ${x2} ${y2}`;
      return `M ${x1} ${y1} L ${x1} ${midY - r} Q ${x1} ${midY} ${x1 + sx * r} ${midY} L ${x2 - sx * r} ${midY} Q ${x2} ${midY} ${x2} ${midY + r} L ${x2} ${y2}`;
    } else {
      const midX = (x1 + x2) / 2;
      const sy = Math.sign(dy) || 1;
      const sx = isLeft ? -1 : 1;
      if (dyAbs < r * 2) return `M ${x1} ${y1} L ${x2} ${y2}`;
      return `M ${x1} ${y1} L ${midX - sx * r} ${y1} Q ${midX} ${y1} ${midX} ${y1 + sy * r} L ${midX} ${y2 - sy * r} Q ${midX} ${y2} ${midX + sx * r} ${y2} L ${x2} ${y2}`;
    }
  }

  // 4. 现代单圆弧
  if (lineStyle === "arc-corner") {
    if (isDown) return `M ${x1} ${y1} Q ${x1} ${y2} ${x2} ${y2}`;
    return `M ${x1} ${y1} Q ${x2} ${y1} ${x2} ${y2}`;
  }

  // 5. 默认平滑贝塞尔曲线
  if (isDown) {
    return `M ${x1} ${y1} C ${x1} ${y1 + dy * 0.5}, ${x2} ${y2 - dy * 0.5}, ${x2} ${y2}`;
  } else if (isLeft) {
    const tension = Math.min(Math.max(26, dyAbs * 0.28), dxAbs * 0.52);
    return `M ${x1} ${y1} C ${x1 - tension} ${y1 + dy * 0.08}, ${x2 + Math.max(22, dxAbs * 0.35)} ${y2}, ${x2} ${y2}`;
  } else {
    const tension = Math.min(Math.max(26, dyAbs * 0.28), dxAbs * 0.52);
    return `M ${x1} ${y1} C ${x1 + tension} ${y1 + dy * 0.08}, ${x2 - Math.max(22, dxAbs * 0.35)} ${y2}, ${x2} ${y2}`;
  }
}
