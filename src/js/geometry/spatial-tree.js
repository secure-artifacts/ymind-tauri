export class QuadTree {
  constructor(boundary = { x: -50000, y: -50000, width: 100000, height: 100000 }, capacity = 12, depth = 0, maxDepth = 7) {
    this.boundary = boundary;
    this.capacity = capacity;
    this.depth = depth;
    this.maxDepth = maxDepth;
    this.items = [];
    this.divided = false;
    this.nw = null;
    this.ne = null;
    this.sw = null;
    this.se = null;
  }

  subdivide() {
    const { x, y, width, height } = this.boundary;
    const w = width / 2, h = height / 2;
    const nextDepth = this.depth + 1;
    this.nw = new QuadTree({ x, y, width: w, height: h }, this.capacity, nextDepth, this.maxDepth);
    this.ne = new QuadTree({ x: x + w, y, width: w, height: h }, this.capacity, nextDepth, this.maxDepth);
    this.sw = new QuadTree({ x, y: y + h, width: w, height: h }, this.capacity, nextDepth, this.maxDepth);
    this.se = new QuadTree({ x: x + w, y, width: w, height: h }, this.capacity, nextDepth, this.maxDepth);
    this.divided = true;

    const oldItems = this.items;
    this.items = [];
    for (let i = 0; i < oldItems.length; i++) this.insert(oldItems[i]);
  }

  insert(item) {
    if (!this.intersects(this.boundary, item)) return false;
    if (!this.divided) {
      if (this.items.length < this.capacity || this.depth >= this.maxDepth) {
        this.items.push(item);
        return true;
      }
      this.subdivide();
    }
    const inNW = this.nw.insert(item);
    const inNE = this.ne.insert(item);
    const inSW = this.sw.insert(item);
    const inSE = this.se.insert(item);
    return inNW || inNE || inSW || inSE;
  }

  queryRange(range, found = new Set()) {
    if (!this.intersects(this.boundary, range)) return found;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      if (this.intersects(it, range)) found.add(it.id);
    }
    if (this.divided) {
      this.nw.queryRange(range, found);
      this.ne.queryRange(range, found);
      this.sw.queryRange(range, found);
      this.se.queryRange(range, found);
    }
    return found;
  }

  queryItems(range, found = [], seen = new Set()) {
    if (!this.intersects(this.boundary, range)) return found;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      if (!seen.has(it.id) && this.intersects(it, range)) {
        seen.add(it.id);
        found.push(it);
      }
    }
    if (this.divided) {
      this.nw.queryItems(range, found, seen);
      this.ne.queryItems(range, found, seen);
      this.sw.queryItems(range, found, seen);
      this.se.queryItems(range, found, seen);
    }
    return found;
  }

  pickNode(wx, wy, pad = 8, isVisibleFn = null) {
    const searchBox = { x: wx - pad, y: wy - pad, width: pad * 2, height: pad * 2 };
    const candidates = this.queryItems(searchBox);
    for (let i = candidates.length - 1; i >= 0; i--) {
      const item = candidates[i];
      if (isVisibleFn && !isVisibleFn(item.id)) continue;
      if (wx >= item.x - pad && wx <= item.x + item.width + pad &&
          wy >= item.y - pad && wy <= item.y + item.height + pad) {
        return item.node;
      }
    }
    return null;
  }

  pickCollapseBadge(wx, wy, focusedRootId, isVisibleFn = null) {
    const searchBox = { x: wx - 18, y: wy - 18, width: 36, height: 36 };
    const candidates = this.queryItems(searchBox);
    for (let i = 0; i < candidates.length; i++) {
      const n = candidates[i].node;
      if (isVisibleFn && !isVisibleFn(n.id)) continue;
      if (n.children && n.children.length > 0 && n.id !== focusedRootId) {
        const bx = (n.branchDirection === "left") ? n.x : (n.x + n.width);
        const by = n.y + n.height / 2;
        if (Math.hypot(wx - bx, wy - by) <= 12) return n;
      }
    }
    return null;
  }

  intersects(r1, r2) {
    const r1x2 = r1.x + (r1.width || 0);
    const r1y2 = r1.y + (r1.height || 0);
    const r2x2 = r2.x + (r2.width || 0);
    const r2y2 = r2.y + (r2.height || 0);
    return !(r1x2 < r2.x || r1.x > r2x2 || r1y2 < r2.y || r1.y > r2y2);
  }

  clear() {
    this.items = [];
    this.divided = false;
    this.nw = null;
    this.ne = null;
    this.sw = null;
    this.se = null;
  }
}
