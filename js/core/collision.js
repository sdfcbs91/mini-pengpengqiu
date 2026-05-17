// 碰撞检测模块

/**
 * 碰撞检测系统
 */

/**
 * 球与矩形砖块碰撞检测
 * 返回 { hit: bool, side: 'top'|'bottom'|'left'|'right'|'corner' }
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
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist >= br) return { hit: false };

  // 判断碰撞面
  const overlapLeft = bx + br - rx;
  const overlapRight = rx + rw - (bx - br);
  const overlapTop = by + br - ry;
  const overlapBottom = ry + rh - (by - br);

  const minOverlapX = Math.min(overlapLeft, overlapRight);
  const minOverlapY = Math.min(overlapTop, overlapBottom);

  let side;
  if (minOverlapX < minOverlapY) {
    side = overlapLeft < overlapRight ? 'left' : 'right';
  } else {
    side = overlapTop < overlapBottom ? 'top' : 'bottom';
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

  // 先做粗检测 AABB
  if (bx + br < rx || bx - br > rx + rw || by + br < ry || by - br > ry + rh) {
    return { hit: false };
  }

  // 检测球心是否在三角形内（或球心到三角形各边的距离）
  const points = getTrianglePoints(brick);

  // 检查球心到三角形三条边的最短距离
  for (let i = 0; i < 3; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % 3];
    const dist = pointToSegmentDist(bx, by, p1.x, p1.y, p2.x, p2.y);
    if (dist < br) {
      // 判断是斜边还是直角边
      const isHypotenuse = i === getHypotenuseIndex(brick.triangleDir);
      if (isHypotenuse) {
        return { hit: true, type: 'hypotenuse' };
      }
      // 直角边按普通矩形边处理
      const edgeDx = p2.x - p1.x;
      const edgeDy = p2.y - p1.y;
      if (Math.abs(edgeDx) > Math.abs(edgeDy)) {
        return { hit: true, type: 'horizontal' };
      }
      return { hit: true, type: 'vertical' };
    }
  }

  return { hit: false };
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
  // bottomRight / default
  return [{ x: bx + w, y: by }, { x: bx, y: by + h }, { x: bx + w, y: by + h }];
}

function getHypotenuseIndex() {
  return 2;
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
  const dx = ball.x - pickup.x;
  const dy = ball.y - pickup.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist < ball.radius + pickup.radius;
}

/**
 * 根据碰撞结果反弹球
 */
export function reflectBall(ball, collisionResult, brick = null) {
  const { side, type } = collisionResult;

  if (type === 'hypotenuse' && brick) {
    // 三角斜面反弹
    const normal = brick.getTriangleNormal();
    const dot = ball.vx * normal.nx + ball.vy * normal.ny;
    ball.vx -= 2 * dot * normal.nx;
    ball.vy -= 2 * dot * normal.ny;
    return;
  }

  if (type === 'horizontal') {
    ball.vy = -ball.vy;
    return;
  }
  if (type === 'vertical') {
    ball.vx = -ball.vx;
    return;
  }

  switch (side) {
    case 'top':
    case 'bottom':
      ball.vy = -ball.vy;
      break;
    case 'left':
    case 'right':
      ball.vx = -ball.vx;
      break;
    case 'corner':
      ball.vx = -ball.vx;
      ball.vy = -ball.vy;
      break;
  }
}
