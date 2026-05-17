import Ball from './ball';
import {
  BALL_LAUNCH_INTERVAL, BALL_RADIUS,
  LAUNCH_Y, COLORS, SCALE,
  GAME_AREA_LEFT, GAME_AREA_RIGHT,
} from '../config';

/**
 * 发射器
 * 管理瞄准、角度计算、依次发射球、逐球回收滑动
 */
export default class Launcher {
  constructor() {
    this.x = 0;              // 发射点X
    this.y = LAUNCH_Y;       // 发射点Y
    this.angle = -Math.PI / 2;
    this.isAiming = false;
    this.showAimLine = true;

    this.ballCount = 1;
    this.balls = [];
    this.launchedCount = 0;
    this.launchTimer = 0;
    this.isLaunching = false;

    this.firstLandX = -1;
    this.landedCount = 0;      // 已落地球数（用于触发逐球滑动）
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

    const minAngle = -Math.PI + Math.PI / 36;
    const maxAngle = -Math.PI / 36;
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

  /**
   * 检查球是否刚落地，记录第一个落地的X，并让后续球开始滑动
   */
  checkLanded(ball) {
    if (!ball.landed) return;
    if (ball.sliding || ball.slideDone) return; // 已经处理过了

    this.landedCount++;

    if (this.firstLandX < 0) {
      // 第一个落地的球：记录位置，标记为直接完成（不需要滑动）
      this.firstLandX = ball.landX;
      ball.slideDone = true;
    } else {
      // 第2个及以后的球：从落地位置滑动到第一个球的落地位置
      const targetX = Math.max(GAME_AREA_LEFT + BALL_RADIUS * 2,
        Math.min(GAME_AREA_RIGHT - BALL_RADIUS * 2, this.firstLandX));
      ball.startSlide(targetX);
    }
  }

  /**
   * 所有球是否都已完全停止（落地+滑动完成）
   */
  allBallsStopped() {
    if (this.isLaunching) return false;
    if (this.balls.length === 0) return false;
    return this.balls.every(b => b.isFullyStopped());
  }

  /**
   * 获取下一轮的发射X坐标
   */
  getNextLaunchX() {
    if (this.firstLandX >= 0) {
      return Math.max(GAME_AREA_LEFT + BALL_RADIUS * 2,
        Math.min(GAME_AREA_RIGHT - BALL_RADIUS * 2, this.firstLandX));
    }
    return this.x;
  }

  /**
   * 渲染
   */
  render(ctx, gameState) {
    const s = SCALE;

    if (gameState === 'launching' || gameState === 'running') {
      // 发射/运行中：在第一个球落地位置显示集合点指示
      if (this.firstLandX >= 0) {
        const tx = Math.max(GAME_AREA_LEFT + BALL_RADIUS * 2,
          Math.min(GAME_AREA_RIGHT - BALL_RADIUS * 2, this.firstLandX));
        ctx.fillStyle = COLORS.ballColor;
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.arc(tx, LAUNCH_Y - BALL_RADIUS, BALL_RADIUS * 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // 已汇聚的球数
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

    // 辅助瞄准线
    if (gameState === 'aiming' && this.isAiming && this.showAimLine) {
      this._renderAimLine(ctx, s);
    }
  }

  _renderAimLine(ctx, s) {
    const dotCount = 30;
    const dotGap = 12 * s;
    const dirX = Math.cos(this.angle);
    const dirY = Math.sin(this.angle);

    ctx.fillStyle = COLORS.trailColor;
    for (let i = 1; i <= dotCount; i++) {
      const px = this.x + dirX * dotGap * i;
      const py = this.y + dirY * dotGap * i;

      const alpha = 0.6 - (i / dotCount) * 0.4;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(px, py, 2 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  renderBalls(ctx) {
    this.balls.forEach(ball => ball.render(ctx));
  }
}
