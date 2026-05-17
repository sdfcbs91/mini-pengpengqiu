// 碰撞检测模块

/**
 * 球与矩形砖块碰撞检测
 * 返回 { hit: bool, side: 'top'|'bottom'|'left'|'right' }
 */
export function ballBrickCollision(ball, brick) {
  if (!brick.isAlive || brick.type === 'triangle') return { hit: false };

  const bx = ball.x, by = ball.y, br = ball.radius;
  const rx = brick.x, ry = brick.y, rw = brick.width, rh = brick.height;

  // 找到矩形上距离球心最近的点
  const closestX = Math.max(rx, Math.min(bx, rx + rw));
  const closestY = Math.max(ry, Math.min(by, ry + rh));

  const dx = bx - closestX;
  const dy = by - closestY;
  const distSq = dx * dx + dy * dy;

  if (distSq >= br * br) return { hit: false };

  // 判断碰撞面：球心在砖块哪一侧
  const cx = rx + rw / 2;
  const cy = ry + rh / 2;
  const diffX = bx - cx;
  const diffY = by - cy;

  // 用球心相对砖块中心的位置 + 砖块宽高比判断碰撞面
  let side;
  if (Math.abs(diffX) / rw > Math.abs(diffY) / rh) {
    side = diffX > 0 ? 'right' : 'left';
  } else {
    side = diffY > 0 ? 'bottom' : 'top';
  }

  return { hit: true, side };
}

/**
 * 球与三角砖块碰撞检测
 */
export function ballTriangleCollision(ball, brick) {
  if (!brick.isAlive || brick.type !== 'triangle') return { hit: false };

  const bx = ball.x, by = ball.y, br = ball.radius;
  const rx = brick.x, ry = brick.y, rw = brick.width, rh = brick.height;

  // 粗检测 AABB
  if (bx + br < rx || bx - br > rx + rw || by + br < ry || by - br > ry + rh) {
    return { hit: false };
  }

  const points = getTrianglePoints(brick);

  // 检查球心到三角形三条边的最短距离
  for (let i = 0; i < 3; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % 3];
    const dist = pointToSegmentDist(bx, by, p1.x, p1.y, p2.x, p2.y);
    if (dist < br) {
      const isHypotenuse = i === 2; // 第三条边始终是斜边
      if (isHypotenuse) {
        return { hit: true, type: 'hypotenuse' };
      }
      const edgeDx = p2.x - p1.x;
      const edgeDy = p2.y - p1.y;
      if (Math.abs(edgeDx) > Math.abs(edgeDy)) {
        return { hit: true, type: 'horizontal' };
      }
      return { hit: true, type: 'vertical' };
    }
  }

  // 额外检查：球心是否在三角形内部（完全穿透时上面的边距检测可能漏掉）
  if (pointInTriangle(bx, by, points[0], points[1], points[2])) {
    return { hit: true, type: 'hypotenuse' };
  }

  return { hit: false };
}

/**
 * 点是否在三角形内
 */
function pointInTriangle(px, py, p0, p1, p2) {
  const d1 = sign(px, py, p0.x, p0.y, p1.x, p1.y);
  const d2 = sign(px, py, p1.x, p1.y, p2.x, p2.y);
  const d3 = sign(px, py, p2.x, p2.y, p0.x, p0.y);
  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  return !(hasNeg && hasPos);
}

function sign(px, py, x1, y1, x2, y2) {
  return (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
}

function getTrianglePoints(brick) {
  const bx = brick.x, by = brick.y, w = brick.width, h = brick.height;
  if (brick.triangleDir === 'topLeft') {
    return [{ x: bx, y: by }, { x: bx + w, y: by }, { x: bx, y: by + h }];
  } else if (brick.triangleDir === 'topRight') {
    return [{ x: bx, y: by }, { x: bx + w, y: by }, { x: bx + w, y: by + h }];
  } else if (brick.triangleDir === 'bottomLeft') {
    return [{ x: bx, y: by }, { x: bx, y: by + h }, { x: bx + w, y: by + h }];
  }
  return [{ x: bx + w, y: by }, { x: bx, y: by + h }, { x: bx + w, y: by + h }];
}

function pointToSegmentDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);

  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));

  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}

/**
 * 球与道具碰撞检测
 */
export function ballPickupCollision(ball, pickup) {
  if (pickup.collected) return false;
  if (!ball.active) return false;
  const dx = ball.x - pickup.x;
  const dy = ball.y - pickup.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist < ball.radius + pickup.radius;
}

/**
 * 根据碰撞结果反弹球，并修正球位置到砖块外部（防止穿透）
 */
export function reflectBall(ball, collisionResult, brick = null) {
  const { side, type } = collisionResult;

  if (type === 'hypotenuse' && brick) {
    const normal = brick.getTriangleNormal();
    const dot = ball.vx * normal.nx + ball.vy * normal.ny;
    ball.vx -= 2 * dot * normal.nx;
    ball.vy -= 2 * dot * normal.ny;
    // 推出：沿法线方向把球推出
    _pushOutTriangle(ball, brick);
    return;
  }

  if (type === 'horizontal') {
    ball.vy = -ball.vy;
    if (brick) _pushOutRect(ball, brick);
    return;
  }
  if (type === 'vertical') {
    ball.vx = -ball.vx;
    if (brick) _pushOutRect(ball, brick);
    return;
  }

  switch (side) {
    case 'top':
      ball.vy = -Math.abs(ball.vy);
      if (brick) ball.y = brick.y - ball.radius;
      break;
    case 'bottom':
      ball.vy = Math.abs(ball.vy);
      if (brick) ball.y = brick.y + brick.height + ball.radius;
      break;
    case 'left':
      ball.vx = -Math.abs(ball.vx);
      if (brick) ball.x = brick.x - ball.radius;
      break;
    case 'right':
      ball.vx = Math.abs(ball.vx);
      if (brick) ball.x = brick.x + brick.width + ball.radius;
      break;
  }
}

/**
 * 把球推出矩形砖块（找最小穿透方向推出）
 */
function _pushOutRect(ball, brick) {
  const r = ball.radius;
  const bx = brick.x, by = brick.y, bw = brick.width, bh = brick.height;

  // 计算四个方向的穿透深度
  const pushLeft = ball.x + r - bx;
  const pushRight = bx + bw - (ball.x - r);
  const pushUp = ball.y + r - by;
  const pushDown = by + bh - (ball.y - r);

  // 只推正值（说明有穿透），取最小的
  const pushes = [];
  if (pushLeft > 0) pushes.push({ d: pushLeft, fx: -1, fy: 0 });
  if (pushRight > 0) pushes.push({ d: pushRight, fx: 1, fy: 0 });
  if (pushUp > 0) pushes.push({ d: pushUp, fx: 0, fy: -1 });
  if (pushDown > 0) pushes.push({ d: pushDown, fx: 0, fy: 1 });

  if (pushes.length === 0) return;
  pushes.sort((a, b) => a.d - b.d);
  const best = pushes[0];
  ball.x += best.fx * (best.d + 0.5);
  ball.y += best.fy * (best.d + 0.5);
}

/**
 * 把球推出三角砖块（沿法线方向）
 */
function _pushOutTriangle(ball, brick) {
  const normal = brick.getTriangleNormal();
  // 把球沿法线方向推出一个球半径距离
  ball.x += normal.nx * ball.radius * 0.5;
  ball.y += normal.ny * ball.radius * 0.5;
}
