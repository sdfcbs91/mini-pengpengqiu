/**
 * 碰撞检测模块
 * 矩形砖块：Minkowski Sum + Slab Method（射线-AABB）
 * 三角形砖块：球与凸多边形的 Swept Collision（逐边检测）
 */

/**
 * 扫描碰撞入口：根据砖块类型分发
 */
function sweepBallBrick(ball, vx, vy, brick) {
  if (!brick.isAlive) return null;
  if (brick.type === 'triangle') {
    return sweepBallTriangle(ball, vx, vy, brick);
  }
  return sweepBallRect(ball, vx, vy, brick);
}

/**
 * 球与矩形砖块的扫描碰撞（Minkowski Sum + Slab Method）
 */
function sweepBallRect(ball, vx, vy, brick) {
  const r = ball.radius;
  const ex = brick.x - r;
  const ey = brick.y - r;
  const ew = brick.width + r * 2;
  const eh = brick.height + r * 2;

  const px = ball.x;
  const py = ball.y;

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

  if (tMin >= 1 || tMax <= 0) return null;
  if (tMin < 0) tMin = 0;

  return { brick, t: tMin, nx: hitNx, ny: hitNy };
}

/**
 * 球与三角形砖块的扫描碰撞
 * 算法：逐边检测移动球心（点）与膨胀边（线段外扩r）的碰撞 + 顶点圆碰撞
 * 取所有碰撞中最早的 t，法线为该边的外法线
 */
function sweepBallTriangle(ball, vx, vy, brick) {
  const r = ball.radius;
  const px = ball.x;
  const py = ball.y;
  const pts = brick._getTrianglePoints(brick.x, brick.y, brick.width, brick.height);

  // 三角形三条边
  const edges = [
    { a: pts[0], b: pts[1] },
    { a: pts[1], b: pts[2] },
    { a: pts[2], b: pts[0] },
  ];

  // 计算三角形重心（用于确定外法线方向）
  const cx = (pts[0].x + pts[1].x + pts[2].x) / 3;
  const cy = (pts[0].y + pts[1].y + pts[2].y) / 3;

  let bestT = Infinity;
  let bestNx = 0, bestNy = 0;

  // 1. 检测球心射线与每条膨胀边（外扩 r）的碰撞
  for (const edge of edges) {
    const ax = edge.a.x, ay = edge.a.y;
    const bx = edge.b.x, by = edge.b.y;

    // 边方向
    const edx = bx - ax;
    const edy = by - ay;
    const edLen = Math.sqrt(edx * edx + edy * edy);
    if (edLen < 0.001) continue;

    // 边的单位法线（选朝外的方向）
    let nx = -edy / edLen;
    let ny = edx / edLen;

    // 确保法线朝外（远离重心）
    const toCenterX = cx - ax;
    const toCenterY = cy - ay;
    if (nx * toCenterX + ny * toCenterY > 0) {
      nx = -nx;
      ny = -ny;
    }

    // 将边沿法线方向外扩 r，变为：平面检测
    // 球心到膨胀平面的距离检测
    // 平面方程：nx*(X - ax - nx*r) + ny*(Y - ay - ny*r) = 0
    // 即 nx*X + ny*Y = D，其中 D = nx*(ax + nx*r) + ny*(ay + ny*r)
    const D = nx * (ax + nx * r) + ny * (ay + ny * r);

    // 球心相对平面的有符号距离
    const dist0 = nx * px + ny * py - D;
    const velN = nx * vx + ny * vy;

    // 如果球心在平面外侧且朝平面运动
    if (dist0 > 0 && velN < -0.0001) {
      const t = dist0 / (-velN);
      if (t >= 0 && t < 1 && t < bestT) {
        // 检查碰撞点是否在边的投影范围内
        const hitX = px + vx * t;
        const hitY = py + vy * t;
        const projLen = (hitX - ax) * (edx / edLen) + (hitY - ay) * (edy / edLen);
        if (projLen >= -r && projLen <= edLen + r) {
          bestT = t;
          bestNx = nx;
          bestNy = ny;
        }
      }
    }
  }

  // 2. 检测球与三角形顶点的碰撞（球心射线与顶点圆的交叉）
  for (const pt of pts) {
    const t = sweepCirclePoint(px, py, vx, vy, pt.x, pt.y, r);
    if (t >= 0 && t < 1 && t < bestT) {
      // 碰撞法线 = 球心到顶点的方向
      const hitX = px + vx * t;
      const hitY = py + vy * t;
      const dnx = hitX - pt.x;
      const dny = hitY - pt.y;
      const dLen = Math.sqrt(dnx * dnx + dny * dny);
      if (dLen > 0.001) {
        bestT = t;
        bestNx = dnx / dLen;
        bestNy = dny / dLen;
      }
    }
  }

  // 3. 检查球心是否已在三角形内部（静态重叠）
  if (bestT === Infinity) {
    if (pointInTriangleExpanded(px, py, pts, r)) {
      // 已经重叠，找最近的边推出
      const pushResult = findClosestEdgePush(px, py, pts, cx, cy);
      if (pushResult) {
        return { brick, t: 0, nx: pushResult.nx, ny: pushResult.ny };
      }
    }
    return null;
  }

  return { brick, t: bestT, nx: bestNx, ny: bestNy };
}

/**
 * 射线（点）与圆的碰撞时间
 * 点从 (px,py) 以 (vx,vy) 移动，碰到以 (cx,cy) 为圆心、半径 r 的圆
 */
function sweepCirclePoint(px, py, vx, vy, cx, cy, r) {
  const dx = px - cx;
  const dy = py - cy;
  const a = vx * vx + vy * vy;
  const b = 2 * (dx * vx + dy * vy);
  const c = dx * dx + dy * dy - r * r;

  if (a < 0.0001) return -1; // 不动

  const disc = b * b - 4 * a * c;
  if (disc < 0) return -1;

  const sqrtDisc = Math.sqrt(disc);
  const t1 = (-b - sqrtDisc) / (2 * a);
  if (t1 >= 0) return t1;

  const t2 = (-b + sqrtDisc) / (2 * a);
  if (t2 >= 0) return t2;

  return -1;
}

/**
 * 检查点是否在三角形（膨胀 r）内部
 */
function pointInTriangleExpanded(px, py, pts, r) {
  // 简单方法：检查点到三角形各边的距离是否都 < r 或在内侧
  const cx = (pts[0].x + pts[1].x + pts[2].x) / 3;
  const cy = (pts[0].y + pts[1].y + pts[2].y) / 3;

  for (let i = 0; i < 3; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % 3];
    const edx = b.x - a.x;
    const edy = b.y - a.y;
    const len = Math.sqrt(edx * edx + edy * edy);
    if (len < 0.001) continue;

    let nx = -edy / len;
    let ny = edx / len;
    if (nx * (cx - a.x) + ny * (cy - a.y) > 0) { nx = -nx; ny = -ny; }

    const dist = nx * (px - a.x) + ny * (py - a.y);
    if (dist > r) return false;
  }
  return true;
}

/**
 * 找到距离点最近的三角形边，返回推出法线
 */
function findClosestEdgePush(px, py, pts, cx, cy) {
  let minDist = Infinity;
  let bestNx = 0, bestNy = 0;

  for (let i = 0; i < 3; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % 3];
    const edx = b.x - a.x;
    const edy = b.y - a.y;
    const len = Math.sqrt(edx * edx + edy * edy);
    if (len < 0.001) continue;

    let nx = -edy / len;
    let ny = edx / len;
    if (nx * (cx - a.x) + ny * (cy - a.y) > 0) { nx = -nx; ny = -ny; }

    const dist = Math.abs(nx * (px - a.x) + ny * (py - a.y));
    if (dist < minDist) {
      minDist = dist;
      bestNx = nx;
      bestNy = ny;
    }
  }

  if (minDist < Infinity) return { nx: bestNx, ny: bestNy };
  return null;
}

/**
 * 球与有厚度线段的扫描碰撞
 * 线段 {x1,y1,x2,y2}，厚度 thickness
 * 算法：将线段视为一个胶囊体（两端半圆 + 中间矩形），检测球心射线与胶囊体的碰撞
 */
function sweepBallSegment(ball, vx, vy, segment, thickness) {
  const r = ball.radius + thickness;
  const sx = segment.x2 - segment.x1;
  const sy = segment.y2 - segment.y1;
  const segLenSq = sx * sx + sy * sy;
  if (segLenSq < 1) return null;
  const segLen = Math.sqrt(segLenSq);

  // 线段单位方向和法线
  const ux = sx / segLen;
  const uy = sy / segLen;
  // 法线（两个方向都要检测，选球所在的一侧）
  let nx = -uy;
  let ny = ux;

  // 球心相对线段起点
  const dpx = ball.x - segment.x1;
  const dpy = ball.y - segment.y1;

  // 球心在法线方向的有符号距离
  const distN = dpx * nx + dpy * ny;
  // 如果球在法线负侧，翻转法线
  if (distN < 0) {
    nx = -nx;
    ny = -ny;
  }
  const absDist = Math.abs(distN);

  // 速度在法线方向的分量
  const velN = vx * nx + vy * ny;
  // 球必须朝线段移动
  if (velN >= 0) return null;

  // 计算碰撞时间：球心到膨胀线段平面的距离 / 速度法线分量
  const t = (absDist - r) / (-velN);
  if (t < 0 || t >= 1) return null;

  // 碰撞点在线段方向上的投影
  const hitX = ball.x + vx * t;
  const hitY = ball.y + vy * t;
  const projOnSeg = (hitX - segment.x1) * ux + (hitY - segment.y1) * uy;

  // 碰撞点必须在线段范围内（含两端半径扩展）
  if (projOnSeg >= -r && projOnSeg <= segLen + r) {
    // 如果在线段两端之外，需要做端点圆碰撞
    if (projOnSeg < 0 || projOnSeg > segLen) {
      // 端点碰撞
      const endX = projOnSeg < 0 ? segment.x1 : segment.x2;
      const endY = projOnSeg < 0 ? segment.y1 : segment.y2;
      const edx = ball.x - endX;
      const edy = ball.y - endY;
      const a = vx * vx + vy * vy;
      const b = 2 * (edx * vx + edy * vy);
      const c = edx * edx + edy * edy - r * r;
      if (a < 0.0001) return null;
      const disc = b * b - 4 * a * c;
      if (disc < 0) return null;
      const sqrtDisc = Math.sqrt(disc);
      const t1 = (-b - sqrtDisc) / (2 * a);
      if (t1 < 0 || t1 >= 1) return null;
      // 端点碰撞法线：从端点指向球心
      const chx = ball.x + vx * t1 - endX;
      const chy = ball.y + vy * t1 - endY;
      const chLen = Math.sqrt(chx * chx + chy * chy);
      if (chLen < 0.001) return null;
      return { brick: segment, t: t1, nx: chx / chLen, ny: chy / chLen };
    }
    return { brick: segment, t, nx, ny };
  }

  return null;
}

/**
 * 移动球并处理砖块碰撞（扫描方式，不会穿透）
 * 返回碰撞到的砖块列表
 * ball._pathPoints 记录帧内完整路径点（供道具碰撞检测用）
 * @param {Array} segments 可选，绘制的线段列表 [{x1,y1,x2,y2}]
 */
export function moveBallWithCollision(ball, vx, vy, bricks, segments) {
  const hitBricks = [];
  let remainVx = vx;
  let remainVy = vy;
  const maxBounces = 4;
  let lastHitBrick = null;
  const lineThickness = 3; // 线段碰撞厚度

  // 记录路径起点
  ball._pathPoints = [{ x: ball.x, y: ball.y }];

  for (let bounce = 0; bounce < maxBounces; bounce++) {
    let earliest = null;
    for (const brick of bricks) {
      if (!brick.isAlive) continue;
      if (brick === lastHitBrick) continue;
      const hit = sweepBallBrick(ball, remainVx, remainVy, brick);
      if (hit && (!earliest || hit.t < earliest.t)) {
        earliest = hit;
      }
    }

    // 线段碰撞检测
    if (segments && segments.length > 0) {
      for (const seg of segments) {
        if (seg === lastHitBrick) continue;
        const hit = sweepBallSegment(ball, remainVx, remainVy, seg, lineThickness);
        if (hit && (!earliest || hit.t < earliest.t)) {
          earliest = hit;
        }
      }
    }

    if (!earliest || earliest.t >= 1) {
      ball.x += remainVx;
      ball.y += remainVy;
      ball._pathPoints.push({ x: ball.x, y: ball.y });
      break;
    }

    // 移动到碰撞点
    const safeT = Math.max(0, earliest.t - 0.01);
    ball.x += remainVx * safeT;
    ball.y += remainVy * safeT;
    ball._pathPoints.push({ x: ball.x, y: ball.y });

    if (!hitBricks.includes(earliest.brick) && earliest.brick.isAlive !== undefined) {
      hitBricks.push(earliest.brick);
    }

    // 记录碰撞用于循环弹跳检测
    if (ball.recordBounce) {
      ball.recordBounce(earliest.brick);
    }

    lastHitBrick = earliest.brick;

    // 计算剩余移动量
    const leftT = 1 - earliest.t;
    remainVx *= leftT;
    remainVy *= leftT;

    // 反弹：沿法线反射
    const dot = remainVx * earliest.nx + remainVy * earliest.ny;
    remainVx -= 2 * dot * earliest.nx;
    remainVy -= 2 * dot * earliest.ny;

    // 更新球速方向
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
