import { COLORS, SCALE } from '../config';

/**
 * 砖块类
 * 支持普通方块和三角方块
 */
export default class Brick {
  constructor() {
    this.row = 0;
    this.col = 0;
    this.x = 0;
    this.y = 0;
    this.targetY = 0;        // 动画目标Y（下移用）
    this.width = 0;
    this.height = 0;
    this.hp = 1;
    this.maxHp = 1;
    this.type = 'normal';    // 'normal' | 'triangle'
    this.triangleDir = '';   // 'topLeft'|'topRight'|'bottomLeft'|'bottomRight'
    this.isAlive = true;
    this.shakeTimer = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
    // 闪电特效计时器（>0 时绘制淡蓝闪电光晕，由 brick 自身渲染时使用，已废弃）
    this.lightningTimer = 0;
  }

  init(row, col, x, y, w, h, hp, type = 'normal', triangleDir = '') {
    this.row = row;
    this.col = col;
    this.x = x;
    this.y = y;
    this.targetY = y;
    this.width = w;
    this.height = h;
    this.hp = hp;
    this.maxHp = hp;
    this.type = type;
    this.triangleDir = triangleDir;
    this.isAlive = true;
    this.shakeTimer = 0;
  }

  /**
   * 被击中，HP减少damage点（默认1）
   */
  hit(damage = 1) {
    if (!this.isAlive) return false;
    this.hp -= damage;
    this.shakeTimer = 6; // 抖动6帧
    if (this.hp <= 0) {
      this.hp = 0;
      this.isAlive = false;
      return true; // 消除了
    }
    return false;
  }

  /**
   * 获取砖块颜色方案（根据HP/maxHp比例）
   */
  getColorScheme() {
    const colors = COLORS.brickColors;
    if (!this.maxHp || this.maxHp <= 0) return colors[0];
    const ratio = Math.max(0, Math.min(1, this.hp / this.maxHp));
    const idx = Math.min(colors.length - 1, Math.floor(ratio * (colors.length - 1)));
    return colors[idx];
  }

  update() {
    // 抖动效果
    if (this.shakeTimer > 0) {
      this.shakeTimer--;
      this.shakeOffsetX = (Math.random() - 0.5) * 4 * SCALE;
      this.shakeOffsetY = (Math.random() - 0.5) * 4 * SCALE;
    } else {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
    }

    // 闪电特效计时器（递减）
    if (this.lightningTimer > 0) {
      this.lightningTimer--;
    }

    // 平滑下移动画
    if (Math.abs(this.y - this.targetY) > 0.5) {
      this.y += (this.targetY - this.y) * 0.2;
    } else {
      this.y = this.targetY;
    }
  }

  render(ctx, glowPhase) {
    if (!this.isAlive) return;

    const x = this.x + this.shakeOffsetX;
    const y = this.y + this.shakeOffsetY;
    const w = this.width;
    const h = this.height;
    const s = SCALE;
    const scheme = this.getColorScheme();

    if (this.type === 'triangle') {
      this._renderTriangle(ctx, x, y, w, h, scheme, glowPhase);
    } else {
      this._renderNormal(ctx, x, y, w, h, scheme, glowPhase, s);
    }
    // 闪电视觉效果由 gameScene 的"闪电链电丝"统一渲染，砖块本体不再叠加边框光晕
  }

  /**
   * 渲染闪电特效：仅在砖块周围呈现淡蓝色光晕闪烁
   * 中心放射电弧已移除，电弧由 gameScene 的 lightningChain 折线统一渲染
   */
  _renderLightningEffect(ctx, x, y, w, h, s) {
    const t = this.lightningTimer;
    const pulse = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.5));
    const alpha = Math.min(1, t / 30) * pulse;

    ctx.save();

    // 外圈淡蓝光晕（蓝色丝带闪烁）
    ctx.shadowColor = `rgba(120, 200, 255, ${alpha})`;
    ctx.shadowBlur = 3 * s * pulse;
    ctx.strokeStyle = `rgba(150, 220, 255, ${alpha * 0.8})`;
    ctx.lineWidth = 2 * s;
    ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);

    // 内层亮蓝边
    ctx.shadowBlur = 2 * s * pulse;
    ctx.strokeStyle = `rgba(180, 235, 255, ${alpha})`;
    ctx.lineWidth = 1 * s;
    ctx.strokeRect(x, y, w, h);
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  _renderNormal(ctx, x, y, w, h, scheme, glowPhase, s) {
    const r = 4 * s;

    // 背景
    ctx.fillStyle = scheme.bg;
    ctx.globalAlpha = 0.85;
    _roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 发光边框
    const glow = 0.6 + 0.3 * Math.sin(glowPhase + this.col * 0.5 + this.row * 0.3);
    ctx.strokeStyle = scheme.border;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = scheme.border;
    ctx.shadowBlur = 2 * s * glow;
    _roundRect(ctx, x, y, w, h, r);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // HP数字
    ctx.fillStyle = COLORS.textWhite;
    ctx.font = `bold ${13 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(this.hp), x + w / 2, y + h / 2);
  }

  _renderTriangle(ctx, x, y, w, h, scheme, glowPhase) {
    const s = SCALE;
    // 四种方向的三角形
    const points = this._getTrianglePoints(x, y, w, h);

    // 填充
    ctx.fillStyle = scheme.bg;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    ctx.lineTo(points[2].x, points[2].y);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // 发光边框
    const glow = 0.6 + 0.3 * Math.sin(glowPhase + this.col + this.row);
    ctx.strokeStyle = scheme.border;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = scheme.border;
    ctx.shadowBlur = 2 * s * glow;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    ctx.lineTo(points[2].x, points[2].y);
    ctx.closePath();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // HP数字（三角中心）
    const cx = (points[0].x + points[1].x + points[2].x) / 3;
    const cy = (points[0].y + points[1].y + points[2].y) / 3;
    ctx.fillStyle = COLORS.textWhite;
    ctx.font = `bold ${11 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(this.hp), cx, cy);
  }

  _getTrianglePoints(px, py, w, h) {
    if (this.triangleDir === 'topLeft') {
      return [{ x: px, y: py }, { x: px + w, y: py }, { x: px, y: py + h }];
    } else if (this.triangleDir === 'topRight') {
      return [{ x: px, y: py }, { x: px + w, y: py }, { x: px + w, y: py + h }];
    } else if (this.triangleDir === 'bottomLeft') {
      return [{ x: px, y: py }, { x: px, y: py + h }, { x: px + w, y: py + h }];
    }
    // bottomRight / default
    return [{ x: px + w, y: py }, { x: px, y: py + h }, { x: px + w, y: py + h }];
  }

  /**
   * 获取三角形斜边的法线方向（用于碰撞反弹）
   */
  getTriangleNormal() {
    const sq = 1 / Math.SQRT2;
    if (this.triangleDir === 'topLeft')     return { nx: sq, ny: sq };
    if (this.triangleDir === 'topRight')    return { nx: -sq, ny: sq };
    if (this.triangleDir === 'bottomLeft')  return { nx: sq, ny: -sq };
    if (this.triangleDir === 'bottomRight') return { nx: -sq, ny: -sq };
    return { nx: 0, ny: -1 };
  }
}

/**
 * 圆角矩形辅助
 */
function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
