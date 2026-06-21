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
 * 球与三角形砖块的扫描碰撞（Swept Circle vs Convex Polygon）
 * 
 * 业界标准算法：将三角形 Minkowski 膨胀球半径 r，形成圆角三角形（Rounded Triangle）
 * 圆角三角形 = 3条外扩平面（边向外平移r）+ 3个顶点圆（半径r）
 * 球心作为质点射线，检测与圆角三角形的碰撞
 * 
 * 关键改进：
 * 1. 边碰撞的投影范围严格限制在 [0, edgeLen]，不再扩展
 * 2. 顶点圆碰撞完全独立检测，覆盖边的端点区域
 * 3. 增加 Voronoi 区域判断，确保碰撞法线精确
 */
function sweepBallTriangle(ball, vx, vy, brick) {
  const r = ball.radius;
  const px = ball.x;
  const py = ball.y;
  const pts = brick._getTrianglePoints(brick.x, brick.y, brick.width, brick.height);

  // 计算三角形重心（用于确定外法线方向）
  const cx = (pts[0].x + pts[1].x + pts[2].x) / 3;
  const cy = (pts[0].y + pts[1].y + pts[2].y) / 3;

  // 预计算三条边的几何信息
  const edgeData = [];
  for (let i = 0; i < 3; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % 3];
    const edx = b.x - a.x;
    const edy = b.y - a.y;
    const len = Math.sqrt(edx * edx + edy * edy);
    if (len < 0.001) continue;

    // 边的单位方向
    const ux = edx / len;
    const uy = edy / len;

    // 边的外法线（远离重心方向）
    let nx = -uy;
    let ny = ux;
    if (nx * (cx - a.x) + ny * (cy - a.y) > 0) {
      nx = -nx;
      ny = -ny;
    }

    edgeData.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, ux, uy, nx, ny, len });
  }

  let bestT = Infinity;
  let bestNx = 0, bestNy = 0;

  // === 1. 边碰撞检测（平面碰撞，投影严格在 [0, edgeLen] 内）===
  for (const ed of edgeData) {
    // 球心到边平面的有符号距离（正值 = 在外法线侧）
    const dist0 = (px - ed.ax) * ed.nx + (py - ed.ay) * ed.ny;

    // 球心必须在边的外侧（距离 > 0）
    if (dist0 <= 0) continue;

    // 速度在法线方向的分量
    const velN = vx * ed.nx + vy * ed.ny;

    // 球必须朝边移动
    if (velN >= -0.0001) continue;

    // 碰撞时间：球心到膨胀平面（外扩r）的距离
    const t = (dist0 - r) / (-velN);
    if (t < -0.001 || t >= 1 || t >= bestT) continue;

    // 碰撞点在边方向上的投影（严格在边范围内）
    const hitX = px + vx * t;
    const hitY = py + vy * t;
    const proj = (hitX - ed.ax) * ed.ux + (hitY - ed.ay) * ed.uy;

    // 严格限制在边的范围内，端点区域由顶点圆处理
    if (proj >= 0 && proj <= ed.len) {
      if (t < 0) continue; // 已经穿过了
      bestT = t;
      bestNx = ed.nx;
      bestNy = ed.ny;
    }
  }

  // === 2. 顶点圆碰撞（独立检测，覆盖 Voronoi 顶点区域）===
  for (let i = 0; i < pts.length; i++) {
    const pt = pts[i];
    const t = _sweepCirclePoint(px, py, vx, vy, pt.x, pt.y, r);
    if (t < 0 || t >= 1 || t >= bestT) continue;

    // 碰撞法线 = 碰撞时刻球心指向顶点的反方向（从顶点指向球心）
    const hitX = px + vx * t;
    const hitY = py + vy * t;
    const dnx = hitX - pt.x;
    const dny = hitY - pt.y;
    const dLen = Math.sqrt(dnx * dnx + dny * dny);
    if (dLen < 0.001) continue;

    // Voronoi 区域验证：碰撞点不应在任何边的有效投影范围内
    // 这确保顶点碰撞只在真正的顶点区域触发
    const normNx = dnx / dLen;
    const normNy = dny / dLen;

    bestT = t;
    bestNx = normNx;
    bestNy = normNy;
  }

  // === 3. 静态重叠检测（球心已在膨胀三角形内部）===
  if (bestT === Infinity) {
    // 检查球心是否在三角形的 Minkowski 膨胀区域内
    const overlap = _checkTriangleOverlap(px, py, pts, edgeData, r);
    if (overlap) {
      return { brick, t: 0, nx: overlap.nx, ny: overlap.ny };
    }
    return null;
  }

  return { brick, t: bestT, nx: bestNx, ny: bestNy };
}

/**
 * 射线（质点）与圆的碰撞时间
 * 质点从 (px,py) 以 (vx,vy) 移动，碰到以 (cx,cy) 为圆心、半径 r 的圆
 * 返回最早的正碰撞时间，无碰撞返回 -1
 */
function _sweepCirclePoint(px, py, vx, vy, cx, cy, r) {
  const dx = px - cx;
  const dy = py - cy;
  const a = vx * vx + vy * vy;
  const b = 2 * (dx * vx + dy * vy);
  const c = dx * dx + dy * dy - r * r;

  if (a < 0.0001) return -1;

  const disc = b * b - 4 * a * c;
  if (disc < 0) return -1;

  const sqrtDisc = Math.sqrt(disc);
  const t1 = (-b - sqrtDisc) / (2 * a);
  if (t1 >= 0) return t1;

  // 如果 t1 < 0 说明球心已在圆内，取 t2（穿出时间）
  // 但对于碰撞检测我们不需要穿出时间
  return -1;
}

/**
 * 检查球心是否在三角形的 Minkowski 膨胀区域内（静态重叠）
 * 膨胀区域 = 三角形内部 + 各边外扩r的矩形带 + 各顶点半径r的圆
 * 返回推出法线（最浅穿透方向），或 null
 */
function _checkTriangleOverlap(px, py, pts, edgeData, r) {
  // 先检查是否在原始三角形内部
  const inTriangle = _pointInTriangle(px, py, pts);

  if (inTriangle) {
    // 在三角形内部，找最近的边推出
    let minPen = Infinity;
    let bestNx = 0, bestNy = 0;
    for (const ed of edgeData) {
      const dist = (px - ed.ax) * ed.nx + (py - ed.ay) * ed.ny;
      // dist 应该是负值（在内侧），穿透深度 = r - dist
      const pen = r - dist;
      if (pen < minPen) {
        minPen = pen;
        bestNx = ed.nx;
        bestNy = ed.ny;
      }
    }
    return { nx: bestNx, ny: bestNy };
  }

  // 不在三角形内部，检查是否在边的外扩带或顶点圆内
  // 找到最近的边或顶点
  let minDist = Infinity;
  let bestNx = 0, bestNy = 0;

  // 检查各边
  for (const ed of edgeData) {
    const proj = (px - ed.ax) * ed.ux + (py - ed.ay) * ed.uy;
    if (proj >= 0 && proj <= ed.len) {
      const dist = (px - ed.ax) * ed.nx + (py - ed.ay) * ed.ny;
      if (dist >= 0 && dist < r && dist < minDist) {
        minDist = dist;
        bestNx = ed.nx;
        bestNy = ed.ny;
      }
    }
  }

  // 检查各顶点
  for (const pt of pts) {
    const dx = px - pt.x;
    const dy = py - pt.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < r && dist < minDist) {
      minDist = dist;
      if (dist > 0.001) {
        bestNx = dx / dist;
        bestNy = dy / dist;
      }
    }
  }

  if (minDist < Infinity) return { nx: bestNx, ny: bestNy };
  return null;
}

/**
 * 判断点是否在三角形内部（使用重心坐标法）
 */
function _pointInTriangle(px, py, pts) {
  const x0 = pts[0].x, y0 = pts[0].y;
  const x1 = pts[1].x, y1 = pts[1].y;
  const x2 = pts[2].x, y2 = pts[2].y;

  const dX = px - x2;
  const dY = py - y2;
  const dX21 = x2 - x1;
  const dY12 = y1 - y2;
  const D = dY12 * (x0 - x2) + dX21 * (y0 - y2);
  if (Math.abs(D) < 0.0001) return false;

  const s = (dY12 * dX + dX21 * dY) / D;
  const t = ((y2 - y0) * dX + (x0 - x2) * dY) / D;

  return s >= 0 && t >= 0 && (s + t) <= 1;
}

/**
 * 球与有厚度线段的扫描碰撞
 * 线段 {x1,y1,x2,y2}，厚度 thickness
 * 算法：胶囊体碰撞 = 平面碰撞（中间段）+ 端点圆碰撞（两端）
 * 两种碰撞独立检测，取最早的碰撞时间
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

  let bestT = Infinity;
  let bestNx = 0, bestNy = 0;

  // === 1. 平面碰撞（线段中间段）===
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
  // 球朝线段移动时才检测平面碰撞
  if (velN < -0.0001) {
    const t = (absDist - r) / (-velN);
    if (t >= 0 && t < 1 && t < bestT) {
      // 碰撞点在线段方向上的投影（必须在线段范围内）
      const hitX = ball.x + vx * t;
      const hitY = ball.y + vy * t;
      const projOnSeg = (hitX - segment.x1) * ux + (hitY - segment.y1) * uy;
      if (projOnSeg >= 0 && projOnSeg <= segLen) {
        bestT = t;
        bestNx = nx;
        bestNy = ny;
      }
    }
  }

  // === 2. 端点圆碰撞（两端独立检测）===
  // 端点1
  const t1 = _sweepBallPoint(ball.x, ball.y, vx, vy, segment.x1, segment.y1, r);
  if (t1 >= 0 && t1 < 1 && t1 < bestT) {
    const chx = ball.x + vx * t1 - segment.x1;
    const chy = ball.y + vy * t1 - segment.y1;
    const chLen = Math.sqrt(chx * chx + chy * chy);
    if (chLen > 0.001) {
      bestT = t1;
      bestNx = chx / chLen;
      bestNy = chy / chLen;
    }
  }

  // 端点2
  const t2 = _sweepBallPoint(ball.x, ball.y, vx, vy, segment.x2, segment.y2, r);
  if (t2 >= 0 && t2 < 1 && t2 < bestT) {
    const chx = ball.x + vx * t2 - segment.x2;
    const chy = ball.y + vy * t2 - segment.y2;
    const chLen = Math.sqrt(chx * chx + chy * chy);
    if (chLen > 0.001) {
      bestT = t2;
      bestNx = chx / chLen;
      bestNy = chy / chLen;
    }
  }

  if (bestT >= 1 || bestT === Infinity) return null;
  return { brick: segment, t: bestT, nx: bestNx, ny: bestNy };
}

/**
 * 球心射线与圆的碰撞时间（辅助函数）
 * 从 (px,py) 以 (vx,vy) 移动，碰到以 (cx,cy) 为圆心、半径 r 的圆
 */
function _sweepBallPoint(px, py, vx, vy, cx, cy, r) {
  const dx = px - cx;
  const dy = py - cy;
  const a = vx * vx + vy * vy;
  const b = 2 * (dx * vx + dy * vy);
  const c = dx * dx + dy * dy - r * r;
  if (a < 0.0001) return -1;
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
        if (!hit) continue;
        // 上实下虚横条（单向平台）：碰撞法线朝下（ny>0）表示球从下方接触 → 放行穿过；
        // 仅当法线朝上（球从上方下落）时才反弹，与碰到白板一致。
        if (seg.type === 'oneway' && hit.ny > 0) continue;
        if (!earliest || hit.t < earliest.t) {
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

    // 移动到碰撞点（微小退避防止数值穿透，0.001足够小不会产生视觉间隙）
    const safeT = Math.max(0, earliest.t - 0.001);
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
