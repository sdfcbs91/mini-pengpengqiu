import Ball from './ball';
import {
  BALL_LAUNCH_INTERVAL, BALL_RADIUS,
  LAUNCH_Y, COLORS, SCALE,
  GAME_AREA_LEFT, GAME_AREA_RIGHT,
} from '../config';

/**
 * 发射器
 * 管理瞄准、角度计算、依次发射球
 */
export default class Launcher {
  constructor() {
    this.x = 0;              // 发射点X
    this.y = LAUNCH_Y;       // 发射点Y
    this.angle = -Math.PI / 2; // 发射角度（默认向上）
    this.isAiming = false;    // 是否正在瞄准
    this.showAimLine = true;  // 是否显示辅助线

    this.ballCount = 1;       // 当前球数量
    this.balls = [];          // 所有球实例
    this.launchedCount = 0;   // 已发射的球数
    this.launchTimer = 0;     // 发射计时器
    this.isLaunching = false; // 是否正在依次发射

    this.firstLandX = -1;    // 第一个落地球的X坐标
  }

  /**
   * 初始化发射器
   */
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
    this.angle = -Math.PI / 2;
  }

  /**
   * 设置瞄准角度（根据触摸点）
   */
  setAimAngle(touchX, touchY) {
    const dx = touchX - this.x;
    const dy = touchY - this.y;
    let angle = Math.atan2(dy, dx);

    // 限制角度：只能向上发射（-170° ~ -10°）
    const minAngle = -Math.PI + Math.PI / 18; // -170°
    const maxAngle = -Math.PI / 18;            // -10°
    angle = Math.max(minAngle, Math.min(maxAngle, angle));

    this.angle = angle;
  }

  /**
   * 开始发射
   */
  startLaunch() {
    this.isLaunching = true;
    this.isAiming = false;
    this.launchedCount = 0;
    this.launchTimer = 0;
    this.firstLandX = -1;
  }

  /**
   * 每帧更新发射（依次发射球）
   */
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

    // 所有球都发射完
    if (this.launchedCount >= this.ballCount) {
      this.isLaunching = false;
    }
  }

  /**
   * 检查球是否落地，记录第一个落地的X坐标
   */
  checkLanded(ball) {
    if (ball.landed && this.firstLandX < 0) {
      this.firstLandX = ball.landX;
    }
  }

  /**
   * 所有球是否都已落地
   */
  allBallsLanded() {
    if (this.isLaunching) return false;
    return this.balls.length > 0 && this.balls.every(b => !b.active);
  }

  /**
   * 获取下一轮的发射X坐标
   */
  getNextLaunchX() {
    if (this.firstLandX >= 0) {
      // 限制在游戏区域内
      return Math.max(GAME_AREA_LEFT + BALL_RADIUS * 2,
        Math.min(GAME_AREA_RIGHT - BALL_RADIUS * 2, this.firstLandX));
    }
    return this.x;
  }

  /**
   * 渲染发射点和辅助线
   */
  render(ctx, gameState) {
    const s = SCALE;

    // 发射点球
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

    // 辅助瞄准线（仅在瞄准状态且开启辅助线时）
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

      // 碰到边界后模拟反弹
      const alpha = 0.6 - (i / dotCount) * 0.4;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(px, py, 2 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /**
   * 渲染所有球
   */
  renderBalls(ctx) {
    this.balls.forEach(ball => ball.render(ctx));
  }
}
