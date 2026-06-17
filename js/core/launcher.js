import Ball from './ball';
import {
  BALL_LAUNCH_INTERVAL, BALL_RADIUS,
  LAUNCH_Y, COLORS, SCALE,
  GAME_AREA_LEFT, GAME_AREA_RIGHT, GAME_AREA_TOP,
} from '../config';

/**
 * 发射器
 * 管理瞄准、角度计算、依次发射球、逐球回收滑动
 */
export default class Launcher {
  constructor() {
    this.x = 0;
    this.y = LAUNCH_Y;
    this.angle = -Math.PI / 2;
    this.isAiming = false;
    this.showAimLine = true;

    this.ballCount = 1;
    this.balls = [];
    this.launchedCount = 0;
    this.launchTimer = 0;
    this.isLaunching = false;

    this.firstLandX = -1;
    this.landedCount = 0;

    // 闪电技能：本轮发射的所有球都带闪电效果
    this.lightningArmed = false;

    // 保持技能：保存每个球各自的升级状态（数组）
    this.savedBallStates = [];  // [{hitCount, powerLevel}, ...]
  }

  init(x, ballCount) {
    this.x = x;
    this.y = LAUNCH_Y;
    this.ballCount = ballCount;
    this.balls = [];
    this.launchedCount = 0;
    this.launchTimer = 0;
    this.isLaunching = false;
    this.isAiming = false;
    this.firstLandX = -1;
    this.landedCount = 0;
    this.angle = -Math.PI / 2;
  }

  setAimAngle(touchX, touchY, useDelta = false, deltaX = 0, deltaY = 0) {
    let angle;
    if (useDelta) {
      // 增量模式：根据手指移动增量调整角度
      const sensitivityX = 0.008; // X轴灵敏度

      // X轴：正负直接控制角度正负
      let angleDelta = deltaX * sensitivityX;

      // Y轴：根据当前角度所在象限决定方向
      // 角度范围：[-π, -π/18]（左上到右上）
      // 第1象限：[-π/2, 0]（右上方向），Y轴正向（手指向下）→ 角度正向（更水平）
      // 第2象限：[-π, -π/2]（左上方向），Y轴正向（手指向下）→ 角度负向（更垂直）
      const quadrant = this.angle >= -Math.PI / 2 ? 1 : 2;
      const yDirection = quadrant === 1 ? 1 : -1;
      const sensitivityY = 0.005;
      angleDelta += deltaY * sensitivityY * yDirection;

      angle = this.angle + angleDelta;
    } else {
      // 绝对模式：根据触摸位置计算角度
      const dx = touchX - this.x;
      const dy = touchY - this.y;
      angle = Math.atan2(dy, dx);
    }

    const minAngle = -Math.PI + Math.PI / 18;
    const maxAngle = -Math.PI / 18;
    angle = Math.max(minAngle, Math.min(maxAngle, angle));

    this.angle = angle;
  }

  startLaunch() {
    this.isLaunching = true;
    this.isAiming = false;
    this.launchedCount = 0;
    this.launchTimer = 0;
    this.firstLandX = -1;
    this.landedCount = 0;
    // 注意：不能在这里重置 lightningArmed，否则发射的球会拿不到闪电属性
    // lightningArmed 由 gameScene._settle 在每回合结算时清除
  }

  updateLaunch() {
    if (!this.isLaunching) return;

    this.launchTimer++;

    if (this.launchedCount < this.ballCount && this.launchTimer >= BALL_LAUNCH_INTERVAL) {
      this.launchTimer = 0;
      const ball = new Ball();
      ball.init(this.x, this.y, this.angle);
      // 注入本轮闪电属性
      ball.hasLightning = !!this.lightningArmed;
      // 注入"保持"技能保存的该球各自的升级状态（按发射顺序索引）
      const savedState = this.savedBallStates && this.savedBallStates[this.launchedCount];
      if (savedState && savedState.hitCount > 0) {
        ball.hitCount = savedState.hitCount;
        ball.powerLevel = savedState.powerLevel;
      }
      this.balls.push(ball);
      this.launchedCount++;
    }

    if (this.launchedCount >= this.ballCount) {
      this.isLaunching = false;
    }
  }

  checkLanded(ball) {
    if (!ball.landed) return;
    if (ball.sliding || ball.slideDone) return;

    this.landedCount++;

    // 所有落地球都 slide 回发射器原位置（this.x），不再以首个落地点为汇集点
    const targetX = Math.max(GAME_AREA_LEFT + BALL_RADIUS * 2,
      Math.min(GAME_AREA_RIGHT - BALL_RADIUS * 2, this.x));

    if (Math.abs(ball.landX - targetX) < 1) {
      // 已经在发射器位置附近，无需滑动
      ball.slideDone = true;
    } else {
      ball.startSlide(targetX);
    }
  }

  allBallsStopped() {
    if (this.isLaunching) return false;
    if (this.balls.length === 0) return false;
    return this.balls.every(b => b.isFullyStopped());
  }

  /**
   * 获取下次发射位置
   * 已废弃"以本次首个落地球位置"逻辑，改为始终保持上次发射时的位置
   */
  getNextLaunchX() {
    return this.x;
  }

  render(ctx, gameState, bricks, segments) {
    const s = SCALE;

    if (gameState === 'launching' || gameState === 'running') {
      // 在发射点显示已停下的球计数（提示玩家球将回到这里）
      const stoppedCount = this.balls.filter(b => b.isFullyStopped()).length;
      if (stoppedCount > 0) {
        const tx = this.x;
        ctx.fillStyle = COLORS.ballColor;
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.arc(tx, this.y, BALL_RADIUS * 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.fillStyle = COLORS.textWhite;
        ctx.font = `bold ${10 * s}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`x ${stoppedCount}`, tx, this.y - BALL_RADIUS - 8 * s);
      }
      return;
    }

    // 瞄准/空闲状态：发射点球
    ctx.fillStyle = COLORS.ballColor;
    ctx.shadowColor = COLORS.ballGlow;
    ctx.shadowBlur = 3 * s;
    ctx.beginPath();
    ctx.arc(this.x, this.y, BALL_RADIUS * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 球数显示
    ctx.fillStyle = COLORS.textWhite;
    ctx.font = `bold ${12 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`x ${this.ballCount}`, this.x, this.y - 12 * s);

    // 辅助瞄准线（带反弹折线）
    if (gameState === 'aiming' && this.isAiming && this.showAimLine) {
      this._renderAimLine(ctx, s, bricks || [], segments || []);
    }
  }

  /**
   * 渲染瞄准辅助线（射线追踪 + 反弹折线）
   * 支持：墙壁、矩形砖块、三角形砖块、横板
   * 最多反弹 MAX_BOUNCES 次
   */
  _renderAimLine(ctx, s, bricks, segments) {
    const MAX_BOUNCES = 3;
    const DOT_GAP = 6 * s;
    const DOT_R = 2 * s;
    const left = GAME_AREA_LEFT;
    const right = GAME_AREA_RIGHT;
    const top = GAME_AREA_TOP;
    const r = BALL_RADIUS;

    let ox = this.x;
    let oy = this.y;
    let dx = Math.cos(this.angle);
    let dy = Math.sin(this.angle);

    ctx.fillStyle = '#ffffff';

    for (let bounce = 0; bounce <= MAX_BOUNCES; bounce++) {
      // 找到这条射线的最近碰撞点和法线
      const hit = this._raycast(ox, oy, dx, dy, left, right, top, r, bricks, segments);

      // 沿射线画虚线点
      const segDx = hit.x - ox;
      const segDy = hit.y - oy;
      const fullLen = Math.sqrt(segDx * segDx + segDy * segDy);
      if (fullLen < 1) break;

      // 反弹后的线段最长限制（只限最后一段）
      const maxLen = (bounce === MAX_BOUNCES) ? 80 * s : 9999;
      const segLen = Math.min(fullLen, maxLen);

      const ndx = segDx / fullLen;
      const ndy = segDy / fullLen;

      const steps = Math.floor(segLen / DOT_GAP);
      for (let i = 0; i <= steps; i++) {
        const dist = i * DOT_GAP;
        if (dist > segLen) break;
        const alpha = (0.5 - bounce * 0.1) * (1 - dist / segLen * 0.3);
        if (alpha <= 0.03) break;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(ox + ndx * dist, oy + ndy * dist, DOT_R, 0, Math.PI * 2);
        ctx.fill();
      }

      // 碰撞点亮点标记
      if (bounce < MAX_BOUNCES && hit.nx !== undefined) {
        ctx.globalAlpha = 0.5 - bounce * 0.12;
        ctx.beginPath();
        ctx.arc(hit.x, hit.y, DOT_R * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // 没碰到任何东西
      if (hit.nx === undefined) break;

      // 用法线反射方向
      const dot = dx * hit.nx + dy * hit.ny;
      dx = dx - 2 * dot * hit.nx;
      dy = dy - 2 * dot * hit.ny;

      // 下一段起点
      ox = hit.x;
      oy = hit.y;
    }

    ctx.globalAlpha = 1;
  }

  /**
   * 射线投射：从 (ox,oy) 沿 (dx,dy) 方向，找到最近碰撞
   * 返回 { x, y, nx, ny } — nx/ny 为碰撞法线，undefined 表示未碰到
   * 支持：左右顶墙、矩形砖块/横板、三角形砖块
   */
  _raycast(ox, oy, dx, dy, left, right, top, r, bricks, segments) {
    let minT = 99999;
    let hitNx, hitNy;

    // --- 墙壁碰撞 ---
    if (dx < 0) {
      const t = (left + r - ox) / dx;
      if (t > 0.1 && t < minT) { minT = t; hitNx = 1; hitNy = 0; }
    }
    if (dx > 0) {
      const t = (right - r - ox) / dx;
      if (t > 0.1 && t < minT) { minT = t; hitNx = -1; hitNy = 0; }
    }
    if (dy < 0) {
      const t = (top + r - oy) / dy;
      if (t > 0.1 && t < minT) { minT = t; hitNx = 0; hitNy = 1; }
    }

    // --- 砖块/横板碰撞 ---
    for (const brick of bricks) {
      if (!brick.isAlive) continue;

      if (brick.type === 'triangle') {
        // 三角形砖块：逐边检测
        const result = this._rayTriangle(ox, oy, dx, dy, r, brick);
        if (result && result.t > 0.1 && result.t < minT) {
          minT = result.t;
          hitNx = result.nx;
          hitNy = result.ny;
        }
      } else {
        // 矩形砖块/横板：AABB
        const result = this._rayRect(ox, oy, dx, dy, r, brick);
        if (result && result.t > 0.1 && result.t < minT) {
          minT = result.t;
          hitNx = result.nx;
          hitNy = result.ny;
        }
      }
    }

    // --- 绘制线段碰撞 ---
    if (segments && segments.length > 0) {
      const lineThickness = 3;
      const totalR = r + lineThickness;
      for (const seg of segments) {
        const sx = seg.x2 - seg.x1;
        const sy = seg.y2 - seg.y1;
        const segLenSq = sx * sx + sy * sy;
        if (segLenSq < 1) continue;
        const segLen = Math.sqrt(segLenSq);
        const ux = sx / segLen;
        const uy = sy / segLen;
        // 线段法线
        let nx = -uy;
        let ny = ux;
        // 射线起点相对线段起点
        const dpx = ox - seg.x1;
        const dpy = oy - seg.y1;
        const distN = dpx * nx + dpy * ny;
        if (distN < 0) { nx = -nx; ny = -ny; }
        const absDist = Math.abs(distN);
        // 射线方向在法线上的分量
        const velN = dx * nx + dy * ny;
        if (velN >= 0) continue; // 射线远离线段
        // 碰撞时间
        const t = (absDist - totalR) / (-velN);
        if (t <= 0.1 || t >= minT) continue;
        // 检查碰撞点是否在线段范围内
        const hitX = ox + dx * t;
        const hitY = oy + dy * t;
        const proj = (hitX - seg.x1) * ux + (hitY - seg.y1) * uy;
        if (proj >= -totalR && proj <= segLen + totalR) {
          minT = t;
          hitNx = nx;
          hitNy = ny;
        }
      }
    }

    if (minT > 9999) {
      return { x: ox + dx * 500, y: oy + dy * 500 };
    }

    return { x: ox + dx * minT, y: oy + dy * minT, nx: hitNx, ny: hitNy };
  }

  /**
   * 射线与扩展矩形（Minkowski Sum）碰撞
   */
  _rayRect(ox, oy, dx, dy, r, brick) {
    const ex = brick.x - r;
    const ey = brick.y - r;
    const ew = brick.width + r * 2;
    const eh = brick.height + r * 2;

    let tNear = -99999, tFar = 99999;
    let nx = 0, ny = 0;

    // X 轴
    if (Math.abs(dx) > 0.0001) {
      let t1 = (ex - ox) / dx;
      let t2 = (ex + ew - ox) / dx;
      let n1 = -1;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; n1 = 1; }
      if (t1 > tNear) { tNear = t1; nx = n1; ny = 0; }
      if (t2 < tFar) tFar = t2;
    } else {
      if (ox < ex || ox > ex + ew) return null;
    }

    // Y 轴
    if (Math.abs(dy) > 0.0001) {
      let t1 = (ey - oy) / dy;
      let t2 = (ey + eh - oy) / dy;
      let n1 = -1;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; n1 = 1; }
      if (t1 > tNear) { tNear = t1; nx = 0; ny = n1; }
      if (t2 < tFar) tFar = t2;
    } else {
      if (oy < ey || oy > ey + eh) return null;
    }

    if (tNear > tFar || tFar < 0) return null;
    if (tNear < 0) return null;

    return { t: tNear, nx, ny };
  }

  /**
   * 射线与三角形砖块碰撞
   * 逐边检测：射线点与膨胀边（外扩 r）的碰撞
   */
  _rayTriangle(ox, oy, dx, dy, r, brick) {
    const pts = brick._getTrianglePoints(brick.x, brick.y, brick.width, brick.height);
    const cx = (pts[0].x + pts[1].x + pts[2].x) / 3;
    const cy = (pts[0].y + pts[1].y + pts[2].y) / 3;

    const edges = [
      { a: pts[0], b: pts[1] },
      { a: pts[1], b: pts[2] },
      { a: pts[2], b: pts[0] },
    ];

    let bestT = Infinity;
    let bestNx = 0, bestNy = 0;

    // 1. 边碰撞（投影严格在 [0, edgeLen] 内）
    for (const edge of edges) {
      const ax = edge.a.x, ay = edge.a.y;
      const bx = edge.b.x, by = edge.b.y;

      const edx = bx - ax;
      const edy = by - ay;
      const edLen = Math.sqrt(edx * edx + edy * edy);
      if (edLen < 0.001) continue;

      const ux = edx / edLen;
      const uy = edy / edLen;

      // 边的外法线
      let nx = -edy / edLen;
      let ny = edx / edLen;
      if (nx * (cx - ax) + ny * (cy - ay) > 0) { nx = -nx; ny = -ny; }

      // 球心到边平面的有符号距离
      const dist0 = (ox - ax) * nx + (oy - ay) * ny;
      const velN = dx * nx + dy * ny;

      // 球心在外侧且朝边移动
      if (dist0 > 0 && velN < -0.0001) {
        const t = (dist0 - r) / (-velN);
        if (t > 0 && t < bestT) {
          // 碰撞点在边方向上的投影（严格在边范围内）
          const hitX = ox + dx * t;
          const hitY = oy + dy * t;
          const proj = (hitX - ax) * ux + (hitY - ay) * uy;
          if (proj >= 0 && proj <= edLen) {
            bestT = t;
            bestNx = nx;
            bestNy = ny;
          }
        }
      }
    }

    // 2. 顶点圆碰撞（独立检测）
    for (const pt of pts) {
      const pdx = ox - pt.x;
      const pdy = oy - pt.y;
      const a = dx * dx + dy * dy;
      const b = 2 * (pdx * dx + pdy * dy);
      const c = pdx * pdx + pdy * pdy - r * r;
      if (a < 0.0001) continue;
      const disc = b * b - 4 * a * c;
      if (disc < 0) continue;
      const sqrtDisc = Math.sqrt(disc);
      const t = (-b - sqrtDisc) / (2 * a);
      if (t > 0 && t < bestT) {
        const hitX = ox + dx * t;
        const hitY = oy + dy * t;
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

    if (bestT === Infinity) return null;
    return { t: bestT, nx: bestNx, ny: bestNy };
  }

  renderBalls(ctx) {
    this.balls.forEach(ball => ball.render(ctx));
  }
}
