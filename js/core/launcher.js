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

  setAimAngle(touchX, touchY) {
    const dx = touchX - this.x;
    const dy = touchY - this.y;
    let angle = Math.atan2(dy, dx);

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
  }

  updateLaunch() {
    if (!this.isLaunching) return;

    this.launchTimer++;

    if (this.launchedCount < this.ballCount && this.launchTimer >= BALL_LAUNCH_INTERVAL) {
      this.launchTimer = 0;
      const ball = new Ball();
      ball.init(this.x, this.y, this.angle);
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

    if (this.firstLandX < 0) {
      this.firstLandX = ball.landX;
      ball.slideDone = true;
    } else {
      const targetX = Math.max(GAME_AREA_LEFT + BALL_RADIUS * 2,
        Math.min(GAME_AREA_RIGHT - BALL_RADIUS * 2, this.firstLandX));
      ball.startSlide(targetX);
    }
  }

  allBallsStopped() {
    if (this.isLaunching) return false;
    if (this.balls.length === 0) return false;
    return this.balls.every(b => b.isFullyStopped());
  }

  getNextLaunchX() {
    if (this.firstLandX >= 0) {
      return Math.max(GAME_AREA_LEFT + BALL_RADIUS * 2,
        Math.min(GAME_AREA_RIGHT - BALL_RADIUS * 2, this.firstLandX));
    }
    return this.x;
  }

  render(ctx, gameState, bricks) {
    const s = SCALE;

    if (gameState === 'launching' || gameState === 'running') {
      if (this.firstLandX >= 0) {
        const tx = Math.max(GAME_AREA_LEFT + BALL_RADIUS * 2,
          Math.min(GAME_AREA_RIGHT - BALL_RADIUS * 2, this.firstLandX));
        ctx.fillStyle = COLORS.ballColor;
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.arc(tx, LAUNCH_Y - BALL_RADIUS, BALL_RADIUS * 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        const stoppedCount = this.balls.filter(b => b.isFullyStopped()).length;
        if (stoppedCount > 0) {
          ctx.fillStyle = COLORS.textWhite;
          ctx.font = `bold ${10 * s}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(`x ${stoppedCount}`, tx, LAUNCH_Y - BALL_RADIUS - 8 * s);
        }
      }
      return;
    }

    // 瞄准/空闲状态：发射点球
    ctx.fillStyle = COLORS.ballColor;
    ctx.shadowColor = COLORS.ballGlow;
    ctx.shadowBlur = 10 * s;
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
      this._renderAimLine(ctx, s, bricks || []);
    }
  }

  /**
   * 渲染瞄准辅助线（射线追踪 + 墙壁/砖块反弹折线）
   * 最多反弹 MAX_BOUNCES 次
   */
  _renderAimLine(ctx, s, bricks) {
    const MAX_BOUNCES = 1;
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
      // 找到这条射线的最近碰撞点
      const hit = this._raycast(ox, oy, dx, dy, left, right, top, r, bricks);

      // 沿射线画虚线点，从 ox,oy 到 hit.x,hit.y
      const segDx = hit.x - ox;
      const segDy = hit.y - oy;
      let segLen = Math.sqrt(segDx * segDx + segDy * segDy);
      if (segLen < 1) break;

      // 反弹后的线段最长90px
      if (bounce > 0) segLen = Math.min(segLen, 90 * s);

      const steps = Math.floor(segLen / DOT_GAP);
      const ndx = segDx / Math.sqrt(segDx * segDx + segDy * segDy);
      const ndy = segDy / Math.sqrt(segDx * segDx + segDy * segDy);

      for (let i = 1; i <= steps; i++) {
        const alpha = 0.5 - bounce * 0.12 - (i / steps) * 0.15;
        if (alpha <= 0.05) break;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(ox + ndx * DOT_GAP * i, oy + ndy * DOT_GAP * i, DOT_R, 0, Math.PI * 2);
        ctx.fill();
      }

      // 在碰撞点画一个亮点标记
      if (bounce < MAX_BOUNCES && hit.type !== 'none') {
        ctx.globalAlpha = 0.6 - bounce * 0.15;
        ctx.beginPath();
        ctx.arc(hit.x, hit.y, DOT_R * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // 如果没碰到任何东西（射出屏幕），结束
      if (hit.type === 'none') break;

      // 根据碰撞面反弹方向
      if (hit.type === 'left' || hit.type === 'right') {
        dx = -dx;
      } else {
        dy = -dy;
      }

      // 下一段起点
      ox = hit.x;
      oy = hit.y;
    }

    ctx.globalAlpha = 1;
  }

  /**
   * 射线投射：从 (ox,oy) 沿 (dx,dy) 方向，找到最近的碰撞点
   * 返回 { x, y, type: 'left'|'right'|'top'|'brick_h'|'brick_v'|'none' }
   */
  _raycast(ox, oy, dx, dy, left, right, top, r, bricks) {
    let minT = 99999;
    let hitType = 'none';

    // 左墙
    if (dx < 0) {
      const t = (left + r - ox) / dx;
      if (t > 0.1 && t < minT) { minT = t; hitType = 'left'; }
    }
    // 右墙
    if (dx > 0) {
      const t = (right - r - ox) / dx;
      if (t > 0.1 && t < minT) { minT = t; hitType = 'right'; }
    }
    // 顶墙
    if (dy < 0) {
      const t = (top + r - oy) / dy;
      if (t > 0.1 && t < minT) { minT = t; hitType = 'top'; }
    }

    // 砖块碰撞检测
    for (const brick of bricks) {
      if (!brick.isAlive) continue;

      const bx = brick.x;
      const by = brick.y;
      const bw = brick.width;
      const bh = brick.height;

      // 扩展砖块边界（球半径）
      const ex = bx - r;
      const ey = by - r;
      const ew = bw + r * 2;
      const eh = bh + r * 2;

      // 射线 vs 扩展 AABB
      let tNear = -99999;
      let tFar = 99999;
      let nearSide = '';

      // X 轴
      if (Math.abs(dx) > 0.0001) {
        let t1 = (ex - ox) / dx;
        let t2 = (ex + ew - ox) / dx;
        let s1 = 'left';
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; s1 = 'right'; }
        if (t1 > tNear) { tNear = t1; nearSide = s1; }
        if (t2 < tFar) tFar = t2;
      } else {
        if (ox < ex || ox > ex + ew) continue;
      }

      // Y 轴
      if (Math.abs(dy) > 0.0001) {
        let t1 = (ey - oy) / dy;
        let t2 = (ey + eh - oy) / dy;
        let s1 = 'top';
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; s1 = 'bottom'; }
        if (t1 > tNear) { tNear = t1; nearSide = s1; }
        if (t2 < tFar) tFar = t2;
      } else {
        if (oy < ey || oy > ey + eh) continue;
      }

      if (tNear > tFar || tFar < 0) continue;
      if (tNear < 0.1) continue; // 忽略起点附近

      if (tNear < minT) {
        minT = tNear;
        hitType = (nearSide === 'left' || nearSide === 'right') ? 'brick_v' : 'brick_h';
      }
    }

    if (hitType === 'none' || minT > 9999) {
      // 没碰到，延伸到足够远
      return { x: ox + dx * 500, y: oy + dy * 500, type: 'none' };
    }

    // 碰撞面映射到反弹方向
    let finalType;
    if (hitType === 'left' || hitType === 'right' || hitType === 'brick_v') {
      finalType = hitType === 'right' ? 'right' : 'left';
    } else {
      finalType = 'top';
    }

    return {
      x: ox + dx * minT,
      y: oy + dy * minT,
      type: finalType,
    };
  }

  renderBalls(ctx) {
    this.balls.forEach(ball => ball.render(ctx));
  }
}
