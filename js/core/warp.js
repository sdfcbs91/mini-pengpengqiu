import { SCALE } from '../config';

/**
 * 空心白洞 — 随机穿越道具
 * 球碰到白洞后传送到游戏区域的随机位置
 * 白洞不可破坏，随砖块一起下移
 */
export default class Warp {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.targetY = 0;
    this.radius = 12 * SCALE;
    this.active = true;
    this.phase = Math.random() * Math.PI * 2;

    // 缓存的传送目标位置（每轮只计算一次）
    this.cachedDestX = -1;
    this.cachedDestY = -1;
    this.cachedAngle = 0;
    this.destShowTimer = 0;  // 目标点显示倒计时（帧数）
  }

  init(x, y) {
    this.x = x;
    this.y = y;
    this.targetY = y;
    this.active = true;
    this.phase = Math.random() * Math.PI * 2;
    this.cachedDestX = -1;
    this.cachedDestY = -1;
    this.cachedAngle = 0;
    this.destShowTimer = 0;
  }

  /**
   * 每轮结算后清除缓存，下一轮重新计算传送目标
   */
  resetCache() {
    this.cachedDestX = -1;
    this.cachedDestY = -1;
    this.cachedAngle = 0;
    this.destShowTimer = 0;
  }

  /**
   * 是否已有缓存的目标位置
   */
  hasCachedDest() {
    return this.cachedDestX >= 0;
  }

  /**
   * 设置目标点后启动显示计时（2秒 = 120帧）
   */
  startDestTimer() {
    this.destShowTimer = 120;
  }

  moveDown(amount) {
    this.targetY += amount;
  }

  update() {
    this.phase += 0.06;
    if (this.phase > Math.PI * 2) this.phase -= Math.PI * 2;

    // 目标点显示倒计时
    if (this.destShowTimer > 0) {
      this.destShowTimer--;
    }

    // 平滑下移
    if (Math.abs(this.y - this.targetY) > 0.5) {
      this.y += (this.targetY - this.y) * 0.2;
    } else {
      this.y = this.targetY;
    }
  }

  render(ctx) {
    if (!this.active) return;

    const s = SCALE;
    const glow = 0.5 + 0.5 * Math.sin(this.phase);
    const r = this.radius;

    // 外圈（旋转效果）
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 * s;
    ctx.shadowColor = 'rgba(255,255,255,0.8)';
    ctx.shadowBlur = 8 * s * glow;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 内圈（脉动）
    const innerR = r * (0.4 + 0.15 * Math.sin(this.phase * 2));
    ctx.strokeStyle = 'rgba(200,220,255,0.7)';
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.arc(this.x, this.y, innerR, 0, Math.PI * 2);
    ctx.stroke();

    // 中心点
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(this.x, this.y, 2 * s, 0, Math.PI * 2);
    ctx.fill();

    // 渲染缓存的穿越目标位置标记（仅在计时器内显示）
    if (this.hasCachedDest() && this.destShowTimer > 0) {
      this._renderDestMarker(ctx, s);
    }
  }

  /**
   * 渲染穿越目标位置标记 —— 脉动双圈 + 十字星 + 连线
   */
  _renderDestMarker(ctx, s) {
    const dx = this.cachedDestX;
    const dy = this.cachedDestY;
    const pulse = 0.6 + 0.4 * Math.sin(this.phase * 1.5);
    const r = this.radius;

    // 从白洞到目标的虚线连线
    ctx.strokeStyle = 'rgba(200,220,255,0.15)';
    ctx.lineWidth = 1 * s;
    ctx.setLineDash([4 * s, 4 * s]);
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(dx, dy);
    ctx.stroke();
    ctx.setLineDash([]);

    // 外圈发光
    ctx.shadowColor = 'rgba(150,200,255,0.9)';
    ctx.shadowBlur = 12 * s * pulse;
    ctx.strokeStyle = `rgba(200,220,255,${0.5 + 0.3 * pulse})`;
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.arc(dx, dy, r * (0.8 + 0.2 * pulse), 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 内圈脉动
    const innerR2 = r * (0.35 + 0.2 * Math.sin(this.phase * 2.5));
    ctx.strokeStyle = `rgba(180,210,255,${0.4 + 0.3 * pulse})`;
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.arc(dx, dy, innerR2, 0, Math.PI * 2);
    ctx.stroke();

    // 十字星标记
    const crossLen = 5 * s * pulse;
    ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.3 * pulse})`;
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.moveTo(dx - crossLen, dy);
    ctx.lineTo(dx + crossLen, dy);
    ctx.moveTo(dx, dy - crossLen);
    ctx.lineTo(dx, dy + crossLen);
    ctx.stroke();

    // 中心亮点
    ctx.fillStyle = `rgba(255,255,255,${0.4 + 0.4 * pulse})`;
    ctx.beginPath();
    ctx.arc(dx, dy, 2.5 * s, 0, Math.PI * 2);
    ctx.fill();
  }
}
