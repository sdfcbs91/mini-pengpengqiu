/**
 * 碰撞检测模块（简洁高效版）
 * 采用 Swept AABB 思路：先移动球，检测重叠，修正位置+反弹
 */

/**
 * 检测球与单个砖块的碰撞
 * 返回 null（无碰撞）或 { brick, nx, ny, pen }（碰撞法线和穿透深度）
 */
function checkBallBrick(ball, brick) {
  if (!brick.isAlive) return null;

  const bx = ball.x, by = ball.y, r = ball.radius;
  const rx = brick.x, ry = brick.y, rw = brick.width, rh = brick.height;

  // 最近点
  const cx = Math.max(rx, Math.min(bx, rx + rw));
  const cy = Math.max(ry, Math.min(by, ry + rh));
  const dx = bx - cx;
  const dy = by - cy;
  const distSq = dx * dx + dy * dy;

  if (distSq >= r * r) return null;

  // 球心在砖块内部（深度穿透）
  if (distSq < 0.001) {
    // 按最小穿透轴推出
    const pl = bx - rx + r;
    const pr = rx + rw - bx + r;
    const pt = by - ry + r;
    const pb = ry + rh - by + r;
    const m = Math.min(pl, pr, pt, pb);
    if (m === pt) return { brick, nx: 0, ny: -1, pen: pt };
    if (m === pb) return { brick, nx: 0, ny: 1, pen: pb };
    if (m === pl) return { brick, nx: -1, ny: 0, pen: pl };
    return { brick, nx: 1, ny: 0, pen: pr };
  }

  const dist = Math.sqrt(distSq);
  const pen = r - dist;
  return { brick, nx: dx / dist, ny: dy / dist, pen };
}

/**
 * 处理球与所有砖块的碰撞（单帧，最多3轮解决重叠）
 * 返回碰撞到的砖块列表
 */
export function resolveBallBricks(ball, bricks) {
  const hitBricks = [];

  for (let iter = 0; iter < 3; iter++) {
    // 找穿透最深的碰撞
    let best = null;
    for (const brick of bricks) {
      if (!brick.isAlive) continue;
      const c = checkBallBrick(ball, brick);
      if (c && (!best || c.pen > best.pen)) {
        best = c;
      }
    }

    if (!best || best.pen <= 0) break;

    // 推出球
    ball.x += best.nx * (best.pen + 0.5);
    ball.y += best.ny * (best.pen + 0.5);

    // 反弹速度（沿法线方向翻转）
    const dot = ball.vx * best.nx + ball.vy * best.ny;
    if (dot < 0) {
      // 球正在朝砖块方向运动才反弹
      ball.vx -= 2 * dot * best.nx;
      ball.vy -= 2 * dot * best.ny;
    }

    hitBricks.push(best.brick);
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
