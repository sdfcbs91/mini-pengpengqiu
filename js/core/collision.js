// 碰撞检测模块

/**
 * 球与砖块碰撞检测（AABB）
 * 返回 { hit: bool, side: 'top'|'bottom'|'left'|'right' }
 */
export function ballBrickCollision(ball, brick) {
  if (!brick.isAlive) return { hit: false };

  const bx = ball.x, by = ball.y, br = ball.radius;
  const rx = brick.x, ry = brick.y, rw = brick.width, rh = brick.height;

  // 球心到砖块的扩展AABB（扩展球半径）的重叠检测
  if (bx + br <= rx || bx - br >= rx + rw || by + br <= ry || by - br >= ry + rh) {
    return { hit: false };
  }

  // 计算球心到砖块最近点的距离（精确圆-矩形检测）
  const closestX = Math.max(rx, Math.min(bx, rx + rw));
  const closestY = Math.max(ry, Math.min(by, ry + rh));
  const dx = bx - closestX;
  const dy = by - closestY;
  if (dx * dx + dy * dy >= br * br) return { hit: false };

  // 判断碰撞面：取最小穿透深度方向
  const penetL = bx + br - rx;       // 从左边穿入的深度
  const penetR = rx + rw - (bx - br); // 从右边穿入的深度
  const penetT = by + br - ry;       // 从上边穿入的深度
  const penetB = ry + rh - (by - br); // 从下边穿入的深度

  const minPenet = Math.min(penetL, penetR, penetT, penetB);

  let side;
  if (minPenet === penetL) side = 'left';
  else if (minPenet === penetR) side = 'right';
  else if (minPenet === penetT) side = 'top';
  else side = 'bottom';

  return { hit: true, side };
}

/**
 * 球与三角砖块碰撞检测（统一AABB）
 */
export function ballTriangleCollision(ball, brick) {
  if (!brick.isAlive || brick.type !== 'triangle') return { hit: false };
  return ballBrickCollision(ball, brick);
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
 * 根据碰撞结果反弹球，并将球推出砖块
 */
export function reflectBall(ball, collisionResult, brick = null) {
  const { side } = collisionResult;
  if (!brick) return;

  const r = ball.radius;

  switch (side) {
    case 'top':
      ball.vy = -Math.abs(ball.vy);
      ball.y = brick.y - r - 0.5;
      break;
    case 'bottom':
      ball.vy = Math.abs(ball.vy);
      ball.y = brick.y + brick.height + r + 0.5;
      break;
    case 'left':
      ball.vx = -Math.abs(ball.vx);
      ball.x = brick.x - r - 0.5;
      break;
    case 'right':
      ball.vx = Math.abs(ball.vx);
      ball.x = brick.x + brick.width + r + 0.5;
      break;
  }
}
