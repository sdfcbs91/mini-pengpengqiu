/**
 * 碰撞检测模块
 * 使用扫描碰撞（Swept）：移动前检测路径，碰到砖块就停在碰撞点
 */

/**
 * 扫描碰撞：球沿 (vx,vy) 移动时，找到最先碰到的砖块
 * 返回 { brick, t, nx, ny } 或 null
 * t = 碰撞时间比例 (0~1)，0=起点就碰，1=终点才碰
 */
function sweepBallBrick(ball, vx, vy, brick) {
  if (!brick.isAlive) return null;

  const r = ball.radius;
  // 将砖块扩展球半径（Minkowski Sum），问题变为点与扩展矩形的射线检测
  const ex = brick.x - r;
  const ey = brick.y - r;
  const ew = brick.width + r * 2;
  const eh = brick.height + r * 2;

  const px = ball.x;
  const py = ball.y;

  // 射线-AABB 相交（Slab Method）
  let tMin = -Infinity, tMax = Infinity;
  let hitNx = 0, hitNy = 0;

  // X 轴
  if (Math.abs(vx) < 0.0001) {
    if (px < ex || px > ex + ew) return null;
  } else {
    let t1 = (ex - px) / vx;
    let t2 = (ex + ew - px) / vx;
    let n1x = -1;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; n1x = 1; }
    if (t1 > tMin) { tMin = t1; hitNx = n1x; hitNy = 0; }
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return null;
  }

  // Y 轴
  if (Math.abs(vy) < 0.0001) {
    if (py < ey || py > ey + eh) return null;
  } else {
    let t1 = (ey - py) / vy;
    let t2 = (ey + eh - py) / vy;
    let n1y = -1;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; n1y = 1; }
    if (t1 > tMin) { tMin = t1; hitNx = 0; hitNy = n1y; }
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return null;
  }

  // tMin 是最先碰到的时间
  if (tMin >= 1 || tMax <= 0) return null; // 在移动范围外
  if (tMin < 0) tMin = 0; // 已经重叠

  return { brick, t: tMin, nx: hitNx, ny: hitNy };
}

/**
 * 移动球并处理砖块碰撞（扫描方式，不会穿透）
 * 返回碰撞到的砖块列表
 */
export function moveBallWithCollision(ball, vx, vy, bricks) {
  const hitBricks = [];
  let remainVx = vx;
  let remainVy = vy;
  const maxBounces = 4; // 一步内最多反弹4次

  for (let bounce = 0; bounce < maxBounces; bounce++) {
    // 找最先碰到的砖块
    let earliest = null;
    for (const brick of bricks) {
      if (!brick.isAlive) continue;
      const hit = sweepBallBrick(ball, remainVx, remainVy, brick);
      if (hit && (!earliest || hit.t < earliest.t)) {
        earliest = hit;
      }
    }

    if (!earliest || earliest.t >= 1) {
      // 无碰撞，正常移动到终点
      ball.x += remainVx;
      ball.y += remainVy;
      break;
    }

    // 移动到碰撞点（稍微留一点间隙）
    const safeT = Math.max(0, earliest.t - 0.01);
    ball.x += remainVx * safeT;
    ball.y += remainVy * safeT;

    // 记录被击中的砖块（避免重复）
    if (!hitBricks.includes(earliest.brick)) {
      hitBricks.push(earliest.brick);
    }

    // 计算剩余移动量
    const leftT = 1 - earliest.t;
    remainVx *= leftT;
    remainVy *= leftT;

    // 反弹：沿碰撞法线翻转速度分量
    const dot = remainVx * earliest.nx + remainVy * earliest.ny;
    remainVx -= 2 * dot * earliest.nx;
    remainVy -= 2 * dot * earliest.ny;

    // 同时更新球的实际速度方向
    const vdot = ball.vx * earliest.nx + ball.vy * earliest.ny;
    ball.vx -= 2 * vdot * earliest.nx;
    ball.vy -= 2 * vdot * earliest.ny;
  }

  return hitBricks;
}

/**
 * 球与道具碰撞检测
 */
export function ballPickupCollision(ball, pickup) {
  if (pickup.collected || !ball.active) return false;
  const dx = ball.x - pickup.x;
  const dy = ball.y - pickup.y;
  return dx * dx + dy * dy < (ball.radius + pickup.radius) * (ball.radius + pickup.radius);
}
