// 碰撞检测模块

/**
 * 球与矩形砖块碰撞检测（也用于三角砖块，统一用AABB）
 * 返回 { hit: bool, side: 'top'|'bottom'|'left'|'right' }
 */
export function ballBrickCollision(ball, brick) {
  if (!brick.isAlive) return { hit: false };

  const bx = ball.x, by = ball.y, br = ball.radius;
  const rx = brick.x, ry = brick.y, rw = brick.width, rh = brick.height;

  // 找到矩形上距离球心最近的点
  const closestX = Math.max(rx, Math.min(bx, rx + rw));
  const closestY = Math.max(ry, Math.min(by, ry + rh));

  const dx = bx - closestX;
  const dy = by - closestY;
  const distSq = dx * dx + dy * dy;

  if (distSq >= br * br) return { hit: false };

  // 判断碰撞面
  const cx = rx + rw / 2;
  const cy = ry + rh / 2;
  const diffX = bx - cx;
  const diffY = by - cy;

  let side;
  if (Math.abs(diffX) / rw > Math.abs(diffY) / rh) {
    side = diffX > 0 ? 'right' : 'left';
  } else {
    side = diffY > 0 ? 'bottom' : 'top';
  }

  return { hit: true, side };
}

/**
 * 球与三角砖块碰撞检测（统一使用AABB，确保不穿透）
 */
export function ballTriangleCollision(ball, brick) {
  if (!brick.isAlive || brick.type !== 'triangle') return { hit: false };
  // 统一用矩形碰撞，保证可靠性
  const saved = brick.type;
  brick.type = 'normal';
  const result = ballBrickCollision(ball, brick);
  brick.type = saved;
  return result;
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
  const { side } = collisionResult;

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
