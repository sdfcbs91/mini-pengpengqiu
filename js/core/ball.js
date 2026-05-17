import { BALL_RADIUS, BALL_SPEED, BALL_TRAIL_LENGTH, COLORS, SCALE } from '../config';

/**
 * 球类
 * 管理球的运动、落地、滑动回收、渲染
 */
export default class Ball {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.radius = BALL_RADIUS;
    this.speed = BALL_SPEED;
    this.active = false;       // 是否正在飞行
    this.landed = false;       // 是否已落地
    this.landX = 0;            // 落地位置X
    this.trail = [];           // 轨迹点

    // 滑动回收状态
    this.sliding = false;      // 是否正在滑动到目标点
    this.slideDone = false;    // 滑动是否完成
    this.slideTargetX = 0;     // 滑动目标X
    this.slideSpeed = 0;       // 滑动速度
  }

  /**
   * 初始化球，设置发射位置和角度
   */
  init(x, y, angle) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
    this.active = true;
    this.landed = false;
    this.landX = x;
    this.trail = [];
    this.sliding = false;
    this.slideDone = false;
  }

  /**
   * 开始滑动到目标X（第一个落地球的位置）
   */
  startSlide(targetX) {
    this.sliding = true;
    this.slideDone = false;
    this.slideTargetX = targetX;
    const dist = Math.abs(targetX - this.x);
    // 速度：距离越远越快，最少 4*SCALE/帧，保证 ~15帧内完成
    this.slideSpeed = Math.max(4 * SCALE, dist / 15);
  }

  update(left, right, top, bottom) {
    // 滑动回收中
    if (this.sliding && !this.slideDone) {
      const dx = this.slideTargetX - this.x;
      if (Math.abs(dx) <= this.slideSpeed) {
        this.x = this.slideTargetX;
        this.sliding = false;
        this.slideDone = true;
      } else {
        this.x += dx > 0 ? this.slideSpeed : -this.slideSpeed;
      }
      return;
    }

    if (!this.active) return;

    // 记录轨迹
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > BALL_TRAIL_LENGTH) {
      this.trail.shift();
    }

    // 移动
    this.x += this.vx;
    this.y += this.vy;

    // 墙壁碰撞
    if (this.x - this.radius <= left) {
      this.x = left + this.radius;
      this.vx = Math.abs(this.vx);
    }
    if (this.x + this.radius >= right) {
      this.x = right - this.radius;
      this.vx = -Math.abs(this.vx);
    }
    if (this.y - this.radius <= top) {
      this.y = top + this.radius;
      this.vy = Math.abs(this.vy);
    }

    // 底部落地（仅当球正在向下运动时才判定）
    if (this.vy > 0 && this.y + this.radius >= bottom) {
      this.y = bottom - this.radius;
      this.active = false;
      this.landed = true;
      this.landX = this.x;
    }
  }

  /**
   * 球是否已完全停止（落地 + 滑动完成或无需滑动）
   */
  isFullyStopped() {
    if (!this.landed) return false;
    if (this.sliding) return false;
    return true;  // landed 且不在 sliding
  }

  render(ctx) {
    // 飞行中：绘制轨迹 + 球
    if (this.active) {
      // 轨迹
      for (let i = 0; i < this.trail.length; i++) {
        const t = this.trail[i];
        const alpha = (i + 1) / this.trail.length * 0.5;
        const r = this.radius * (0.3 + 0.4 * (i / this.trail.length));
        ctx.fillStyle = COLORS.trailColor;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.shadowColor = COLORS.ballGlow;
      ctx.shadowBlur = 8;
      ctx.fillStyle = COLORS.ballColor;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      return;
    }

    // 滑动回收中：绘制球（稍小一点，带拖影）
    if (this.sliding && !this.slideDone) {
      ctx.fillStyle = COLORS.ballColor;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }

    // 已落地且完成滑动（或第一个球直接停在原地）：不渲染，由 launcher 统一渲染集合点
  }
}
