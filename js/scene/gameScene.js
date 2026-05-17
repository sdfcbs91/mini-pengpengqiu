import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import {
  COLORS, SCALE,
  GAME_AREA_LEFT, GAME_AREA_RIGHT, GAME_AREA_TOP,
  LAUNCH_Y, LIGHTNING_INITIAL, MULTIBALL_INITIAL, MAX_ENERGY, ENERGY_PER_BRICK,
} from '../config';
import Grid from '../core/grid';
import Launcher from '../core/launcher';
import HUD from '../runtime/hud';
import { ballBrickCollision, ballPickupCollision, reflectBall } from '../core/collision';
import { getLevelConfig } from '../data/levelData';

/**
 * 游戏主场景
 * 管理碰碰球核心玩法的所有逻辑和渲染
 */
export default class GameScene {
  constructor() {
    this.grid = new Grid();
    this.launcher = new Launcher();
    this.hud = new HUD();

    // 游戏数据
    this.stage = 1;
    this.score = 0;
    this.line = 0;
    this.gameState = 'aiming';  // 'aiming' | 'launching' | 'running' | 'settling' | 'over' | 'win' | 'paused'
    this.prevState = '';         // 暂停前的状态
    this.glowPhase = 0;
    this.initialLevel = 1;       // 进入的关卡号（用于保存进度）
    this.maxRounds = 20;         // 通关所需回合数

    // 技能
    this.lightningCount = LIGHTNING_INITIAL;
    this.multiBallCount = MULTIBALL_INITIAL;
    this.energy = 0;
    this.showAimLine = true;

    // 球相关
    this.ballCount = 1;
    this.nextBallCount = 0;     // 本轮收集的加球道具数

    // 球速加速系统（基于帧计数，更精确）
    this.launchStartTime = 0;    // 发射开始时间戳
    this.runningFrames = 0;      // 球运行帧数（launching+running 阶段累计）
    this.speedMultiplier = 1;    // 当前速度倍率
    this.speedTipText = '';      // 加速提示文字
    this.speedTipTimer = 0;      // 提示显示计时器（帧数）

    // 统计（用于星级评价）
    this.totalBricksThisRound = 0;
    this.destroyedThisRound = 0;
    this.starProgress = 0;

    // 回调
    this.onGameOver = null;
    this.onBackToMenu = null;
    this.onLevelComplete = null;  // (levelNum, stars) => void
    this.winStars = 0;

    // 触摸绑定
    this._bindTouch();
  }

  /**
   * 初始化指定关卡
   */
  initLevel(levelNum) {
    this.initialLevel = levelNum;
    this.stage = levelNum;
    this.score = 0;
    this.line = 0;
    this.gameState = 'aiming';
    this.energy = 0;
    this.ballCount = 1;
    this.nextBallCount = 0;
    this.launchStartTime = 0;
    this.runningFrames = 0;
    this.speedMultiplier = 1;
    this.speedTipText = '';
    this.speedTipTimer = 0;
    this.totalBricksThisRound = 0;
    this.destroyedThisRound = 0;
    this.starProgress = 0;

    const cfg = getLevelConfig(levelNum);
    this.maxRounds = cfg.maxRounds || 20;

    this.grid.initLevel(this.stage);
    this.launcher.init(SCREEN_WIDTH / 2, this.ballCount);
  }

  _bindTouch() {
    // 追踪触摸状态：是否有手指在屏幕上
    this._touching = false;

    this._touchStartHandler = (e) => {
      if (GameGlobal.databus.scene !== 'playing') return;
      this._touching = true;
      const { clientX, clientY } = e.touches[0];

      if (this.gameState === 'over') {
        this._handleOverTap(clientX, clientY);
        return;
      }

      if (this.gameState === 'win') {
        this._handleWinTap(clientX, clientY);
        return;
      }

      if (this.gameState === 'paused') {
        this._handlePauseTap(clientX, clientY);
        return;
      }

      // 检查HUD按钮
      if (this.hud.hitAimButton(clientX, clientY)) {
        this.showAimLine = !this.showAimLine;
        this.launcher.showAimLine = this.showAimLine;
        return;
      }
      if (this.hud.hitPauseButton(clientX, clientY)) {
        this.prevState = this.gameState;
        this.gameState = 'paused';
        return;
      }

      // 检查技能按钮（仅在瞄准阶段）
      if (this.gameState === 'aiming') {
        if (this.hud.hitLightningButton(clientX, clientY)) {
          this._useLightning();
          return;
        }
        if (this.hud.hitMultiBallButton(clientX, clientY)) {
          this._useMultiBall();
          return;
        }
      }

      // 瞄准 - 任意位置触摸都可以开始瞄准
      if (this.gameState === 'aiming') {
        this.launcher.isAiming = true;
        this.launcher.setAimAngle(clientX, clientY);
      }
    };

    this._touchMoveHandler = (e) => {
      if (GameGlobal.databus.scene !== 'playing') return;
      if (this.gameState !== 'aiming' || !this.launcher.isAiming) return;

      if (!e.touches || e.touches.length === 0) {
        this._touching = false;
        return;
      }

      const { clientX, clientY } = e.touches[0];
      this.launcher.setAimAngle(clientX, clientY);
    };

    this._touchEndHandler = () => {
      if (GameGlobal.databus.scene !== 'playing') return;
      this._touching = false;
      this._tryLaunch();
    };

    this._touchCancelHandler = () => {
      if (GameGlobal.databus.scene !== 'playing') return;
      this._touching = false;
      this._tryLaunch();
    };

    wx.onTouchStart(this._touchStartHandler);
    wx.onTouchMove(this._touchMoveHandler);
    wx.onTouchEnd(this._touchEndHandler);
    wx.onTouchCancel(this._touchCancelHandler);
  }

  /**
   * 尝试发射球
   */
  _tryLaunch() {
    if (this.gameState === 'aiming' && this.launcher.isAiming) {
      this.launcher.isAiming = false;
      this.gameState = 'launching';
      this.launcher.startLaunch();
      this.totalBricksThisRound = this.grid.bricks.filter(b => b.isAlive).length;
      this.destroyedThisRound = 0;
      this.launchStartTime = Date.now();
      // runningFrames 跨轮累计，不在每次发射时重置
      this.speedTipText = '';
      this.speedTipTimer = 0;
    }
  }

  unbindTouch() {
    wx.offTouchStart(this._touchStartHandler);
    wx.offTouchMove(this._touchMoveHandler);
    wx.offTouchEnd(this._touchEndHandler);
    wx.offTouchCancel(this._touchCancelHandler);
  }

  _useLightning() {
    if (this.lightningCount <= 0) return;
    this.lightningCount--;

    // 清除最底行砖块
    let maxRow = -1;
    this.grid.bricks.forEach(b => {
      if (b.isAlive && b.row > maxRow) maxRow = b.row;
    });
    if (maxRow >= 0) {
      this.grid.bricks.forEach(b => {
        if (b.isAlive && b.row === maxRow) {
          b.isAlive = false;
          this.score += b.hp;
        }
      });
      this.grid.cleanup();
    }
  }

  _useMultiBall() {
    if (this.multiBallCount <= 0) return;
    this.multiBallCount--;
    this.ballCount *= 2;
    this.launcher.ballCount = this.ballCount;
  }

  /**
   * 每帧更新
   */
  update() {
    if (this.gameState === 'paused' || this.gameState === 'over' || this.gameState === 'win') return;

    this.glowPhase += 0.03;
    if (this.glowPhase > Math.PI * 2) this.glowPhase -= Math.PI * 2;

    this.hud.update();
    this.grid.update();

    // 球速加速：从进入关卡开始持续计帧（所有非暂停/结束状态都累计）
    this._checkSpeedBoost();

    switch (this.gameState) {
      case 'aiming':
        // 帧级防卡死：如果正在瞄准但手指已不在屏幕上，自动发射
        if (this.launcher.isAiming && !this._touching) {
          this._tryLaunch();
        }
        break;

      case 'launching':
        this.launcher.updateLaunch();
        this._updateBalls();
        if (!this.launcher.isLaunching && this.launcher.allBallsStopped()) {
          this.gameState = 'settling';
        } else if (!this.launcher.isLaunching) {
          this.gameState = 'running';
        }
        break;

      case 'running':
        this._updateBalls();
        if (this.launcher.allBallsStopped()) {
          this.gameState = 'settling';
        }
        break;

      case 'settling':
        this._settle();
        break;
    }
  }

  /**
   * 检测球速加速（阈值从关卡配置读取）
   */
  _checkSpeedBoost() {
    this.runningFrames++;

    const cfg = getLevelConfig(this.stage);
    let newMultiplier = 1;
    if (this.runningFrames >= cfg.speedBoostFrame2) {
      newMultiplier = 3;
    } else if (this.runningFrames >= cfg.speedBoostFrame1) {
      newMultiplier = 2;
    }

    if (newMultiplier !== this.speedMultiplier) {
      this.speedMultiplier = newMultiplier;
      if (newMultiplier === 2) {
        this.speedTipText = '加速 x2';
      } else if (newMultiplier === 3) {
        this.speedTipText = '加速 x3';
      }
      this.speedTipTimer = 120; // 显示2秒

      // 立即对所有飞行中的球强制设速
      this.launcher.balls.forEach(ball => {
        if (ball.active) {
          ball.applySpeedMultiplier(newMultiplier);
        }
      });
    }

    if (this.speedTipTimer > 0) {
      this.speedTipTimer--;
    }
  }

  _updateBalls() {
    const left = GAME_AREA_LEFT;
    const right = GAME_AREA_RIGHT;
    const top = GAME_AREA_TOP;
    const bottom = LAUNCH_Y;

    this.launcher.balls.forEach(ball => {
      // 已完全停止的球不再处理
      if (ball.isFullyStopped()) return;

      // 飞行中的球应用速度倍率
      if (ball.active && this.speedMultiplier > 1) {
        ball.applySpeedMultiplier(this.speedMultiplier);
      }

      // 正在滑动回收中：只更新滑动
      if (ball.sliding) {
        ball.update(left, right, top, bottom);
        return;
      }

      // 已落地但还没开始滑动：触发滑动检测
      if (ball.landed && !ball.sliding && !ball.slideDone) {
        this.launcher.checkLanded(ball);
        ball.update(left, right, top, bottom);
        return;
      }

      // 飞行中
      if (!ball.active) return;

      let curVx = ball.vx;
      let curVy = ball.vy;
      const hitBricksThisFrame = new Set();

      // 子步进：确保每步移动距离 < 15px，防穿透
      const ballSpeed = Math.sqrt(curVx * curVx + curVy * curVy);
      const subSteps = Math.max(1, Math.ceil(ballSpeed / 15));

      for (let step = 0; step < subSteps; step++) {
        if (!ball.active) break;

        // 每步只移动 1/subSteps 的距离
        ball.vx = curVx / subSteps;
        ball.vy = curVy / subSteps;
        ball.update(left, right, top, bottom);

        // update中可能发生墙壁反弹，同步更新基准速度方向
        if (ball.vx > 0 !== curVx / subSteps > 0) curVx = -curVx;
        if (ball.vy > 0 !== curVy / subSteps > 0) curVy = -curVy;

        if (!ball.active) {
          if (ball.landed && !ball.slideDone && !ball.sliding) {
            this.launcher.checkLanded(ball);
          }
          break;
        }

        // 碰撞检测 - 砖块（每步最多碰一个）
        for (const brick of this.grid.bricks) {
          if (!brick.isAlive) continue;
          if (hitBricksThisFrame.has(brick)) continue;

          const result = ballBrickCollision(ball, brick);

          if (result.hit) {
            hitBricksThisFrame.add(brick);

            // 恢复完整速度方向再反弹
            ball.vx = curVx;
            ball.vy = curVy;
            reflectBall(ball, result, brick);

            // 更新基准速度为反弹后的方向（后续步骤用新方向）
            curVx = ball.vx;
            curVy = ball.vy;

            const destroyed = brick.hit();
            if (destroyed) {
              this.score += brick.maxHp;
              this.destroyedThisRound++;
              this.energy = Math.min(MAX_ENERGY, this.energy + ENERGY_PER_BRICK);
            }
            break;
          }
        }

        // 碰撞检测 - 道具
        if (ball.active) {
          for (const pickup of this.grid.pickups) {
            if (pickup.collected) continue;
            if (ballPickupCollision(ball, pickup)) {
              pickup.collect();
              this.nextBallCount++;
              break;
            }
          }
        }
      }

      // 恢复完整速度
      if (ball.active) {
        ball.vx = curVx;
        ball.vy = curVy;
      }
    });
  }

  _settle() {
    // 结算：清理已消除砖块和已收集道具
    this.grid.cleanup();

    // 清理超出底线的未收集道具（防止道具无限累积）
    this.grid.pickups = this.grid.pickups.filter(p => {
      if (p.collected) return false;
      if (p.targetY > LAUNCH_Y) return false; // 超出游戏区域的道具直接移除
      return true;
    });

    // 计算星级进度
    if (this.totalBricksThisRound > 0) {
      this.starProgress = Math.min(1, this.destroyedThisRound / this.totalBricksThisRound);
    }

    // 增加行数
    this.line++;

    // 检查通关
    if (this.line >= this.maxRounds) {
      // 计算星级：根据分数和剩余轮数
      const stars = this.line >= this.maxRounds ? (this.score > this.maxRounds * 10 ? 3 : this.score > this.maxRounds * 5 ? 2 : 1) : 0;
      this.winStars = stars;
      this.gameState = 'win';
      if (this.onLevelComplete) {
        this.onLevelComplete(this.initialLevel, stars);
      }
      return;
    }

    this.stage++;

    // 砖块下移
    const isOver = this.grid.shiftDown(LAUNCH_Y);

    // 生成新行
    this.grid.generateRow(this.stage, 0);

    // 更新球数（单轮加球上限 = 当前球数的50%，至少+1，防止暴涨）
    const maxAdd = Math.max(1, Math.ceil(this.ballCount * 0.5));
    const actualAdd = Math.min(this.nextBallCount, maxAdd);
    this.ballCount += actualAdd;
    this.nextBallCount = 0;

    // 更新发射点
    const nextX = this.launcher.getNextLaunchX();
    this.launcher.init(nextX, this.ballCount);
    this.launcher.showAimLine = this.showAimLine;

    // 检查游戏结束
    if (isOver || this.grid.checkGameOver(LAUNCH_Y)) {
      this.gameState = 'over';
      return;
    }

    this.gameState = 'aiming';
  }

  /**
   * 渲染
   */
  render(ctx) {
    // 背景
    this._renderBackground(ctx);

    // 游戏区域边框
    this._renderGameAreaBorder(ctx);

    // 砖块和道具
    this.grid.render(ctx, this.glowPhase);

    // 球
    this.launcher.renderBalls(ctx);

    // 发射点（瞄准线等）
    this.launcher.render(ctx, this.gameState, this.grid.bricks);

    // HUD（含技能按钮）
    this.hud.render(ctx, {
      stage: this.stage,
      line: this.line,
      score: this.score,
      starProgress: this.starProgress,
      showAimLine: this.showAimLine,
      lightningCount: this.lightningCount,
      multiBallCount: this.multiBallCount,
    });

    // 加速提示
    if (this.speedTipTimer > 0) {
      this._renderSpeedTip(ctx);
    }

    // 暂停覆盖层
    if (this.gameState === 'paused') {
      this._renderPauseOverlay(ctx);
    }

    // 游戏结束覆盖层
    if (this.gameState === 'over') {
      this._renderGameOverOverlay(ctx);
    }

    // 通关覆盖层
    if (this.gameState === 'win') {
      this._renderWinOverlay(ctx);
    }
  }

  _renderSpeedTip(ctx) {
    const s = SCALE;
    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT * 0.35;

    // 淡入淡出
    let alpha = 1;
    if (this.speedTipTimer > 105) alpha = (120 - this.speedTipTimer) / 15;
    else if (this.speedTipTimer < 25) alpha = this.speedTipTimer / 25;

    ctx.globalAlpha = alpha * 0.95;

    // 背景圆角矩形
    const tw = 160 * s;
    const th = 40 * s;
    const r = th / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath();
    ctx.moveTo(centerX - tw / 2 + r, centerY - th / 2);
    ctx.lineTo(centerX + tw / 2 - r, centerY - th / 2);
    ctx.arcTo(centerX + tw / 2, centerY - th / 2, centerX + tw / 2, centerY, r);
    ctx.arcTo(centerX + tw / 2, centerY + th / 2, centerX + tw / 2 - r, centerY + th / 2, r);
    ctx.lineTo(centerX - tw / 2 + r, centerY + th / 2);
    ctx.arcTo(centerX - tw / 2, centerY + th / 2, centerX - tw / 2, centerY, r);
    ctx.arcTo(centerX - tw / 2, centerY - th / 2, centerX - tw / 2 + r, centerY - th / 2, r);
    ctx.closePath();
    ctx.fill();

    // 边框发光
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 文字
    ctx.fillStyle = '#ffcc00';
    ctx.font = `bold ${18 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.speedTipText, centerX, centerY);

    ctx.globalAlpha = 1;
  }

  _renderBackground(ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, SCREEN_HEIGHT);
    gradient.addColorStop(0, COLORS.bgTop);
    gradient.addColorStop(0.4, COLORS.bgMid);
    gradient.addColorStop(1, COLORS.bgBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  }

  _renderGameAreaBorder(ctx) {
    const s = SCALE;
    const glow = 0.5 + 0.3 * Math.sin(this.glowPhase);

    ctx.strokeStyle = COLORS.neonBlue;
    ctx.lineWidth = 2;
    ctx.shadowColor = COLORS.neonBlue;
    ctx.shadowBlur = 10 * s * glow;
    ctx.strokeRect(
      GAME_AREA_LEFT - 2, GAME_AREA_TOP - 2,
      GAME_AREA_RIGHT - GAME_AREA_LEFT + 4,
      LAUNCH_Y - GAME_AREA_TOP + 4
    );
    ctx.shadowBlur = 0;
  }

  _renderPauseOverlay(ctx) {
    const s = SCALE;

    // 半透明背景
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT / 2;

    // 标题
    ctx.fillStyle = COLORS.textWhite;
    ctx.font = `bold ${24 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PAUSED', centerX, centerY - 60 * s);

    // 继续按钮
    this._drawButton(ctx, centerX, centerY, 120 * s, 40 * s, 'CONTINUE', COLORS.neonCyan);

    // 返回菜单按钮
    this._drawButton(ctx, centerX, centerY + 60 * s, 120 * s, 40 * s, 'MENU', COLORS.neonRed);
  }

  _renderGameOverOverlay(ctx) {
    const s = SCALE;

    // 半透明背景
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT / 2;

    // 标题
    ctx.fillStyle = COLORS.neonRed;
    ctx.font = `bold ${28 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = COLORS.neonRed;
    ctx.shadowBlur = 10 * s;
    ctx.fillText('GAME OVER', centerX, centerY - 80 * s);
    ctx.shadowBlur = 0;

    // 分数
    ctx.fillStyle = COLORS.textWhite;
    ctx.font = `${16 * s}px Arial`;
    ctx.fillText(`Score: ${this.score}`, centerX, centerY - 30 * s);
    ctx.fillText(`Stage: ${this.stage}`, centerX, centerY);
    ctx.fillText(`Line: ${this.line}`, centerX, centerY + 30 * s);

    // 重试按钮
    this._drawButton(ctx, centerX, centerY + 80 * s, 120 * s, 40 * s, 'RETRY', COLORS.neonCyan);

    // 返回菜单
    this._drawButton(ctx, centerX, centerY + 130 * s, 120 * s, 40 * s, 'MENU', COLORS.neonRed);
  }

  _renderWinOverlay(ctx) {
    const s = SCALE;

    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT / 2;

    // 标题
    ctx.fillStyle = '#39ff14';
    ctx.font = `bold ${28 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#39ff14';
    ctx.shadowBlur = 12 * s;
    ctx.fillText('STAGE CLEAR!', centerX, centerY - 100 * s);
    ctx.shadowBlur = 0;

    // 星星
    const starY = centerY - 55 * s;
    const starSize = 14 * s;
    const starGap = starSize * 2.5;
    for (let i = 0; i < 3; i++) {
      const sx = centerX + (i - 1) * starGap;
      const filled = i < this.winStars;
      ctx.fillStyle = filled ? '#ffdd00' : '#333355';
      if (filled) { ctx.shadowColor = '#ffdd00'; ctx.shadowBlur = 6 * s; }
      ctx.beginPath();
      for (let j = 0; j < 10; j++) {
        const r = j % 2 === 0 ? starSize : starSize * 0.4;
        const angle = -Math.PI / 2 + (Math.PI / 5) * j;
        const px = sx + Math.cos(angle) * r;
        const py = starY + Math.sin(angle) * r;
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 分数信息
    ctx.fillStyle = COLORS.textWhite;
    ctx.font = `${15 * s}px Arial`;
    ctx.fillText(`Score: ${this.score}`, centerX, centerY - 15 * s);
    ctx.fillText(`Rounds: ${this.line} / ${this.maxRounds}`, centerX, centerY + 15 * s);

    // 下一关按钮
    this._drawButton(ctx, centerX, centerY + 65 * s, 140 * s, 40 * s, 'NEXT LEVEL', '#39ff14');

    // 返回菜单
    this._drawButton(ctx, centerX, centerY + 120 * s, 140 * s, 40 * s, 'MENU', COLORS.neonCyan);
  }

  _handleWinTap(x, y) {
    const s = SCALE;
    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT / 2;
    const bw = 140 * s;
    const bh = 40 * s;

    // 下一关按钮
    const nextY = centerY + 65 * s;
    if (x >= centerX - bw / 2 && x <= centerX + bw / 2 &&
        y >= nextY - bh / 2 && y <= nextY + bh / 2) {
      this.initLevel(this.initialLevel + 1);
      return;
    }

    // 返回菜单
    const menuY = centerY + 120 * s;
    if (x >= centerX - bw / 2 && x <= centerX + bw / 2 &&
        y >= menuY - bh / 2 && y <= menuY + bh / 2) {
      if (this.onBackToMenu) this.onBackToMenu();
      return;
    }
  }

  _drawButton(ctx, cx, cy, w, h, text, color) {
    const s = SCALE;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6 * s;
    ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(cx - w / 2, cy - h / 2, w, h);

    ctx.fillStyle = color;
    ctx.font = `bold ${14 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, cy);

    // 存储按钮区域用于点击检测
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }

  _handlePauseTap(x, y) {
    const s = SCALE;
    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT / 2;
    const bw = 120 * s;
    const bh = 40 * s;

    // 继续按钮
    if (x >= centerX - bw / 2 && x <= centerX + bw / 2 &&
        y >= centerY - bh / 2 && y <= centerY + bh / 2) {
      this.gameState = this.prevState || 'aiming';
      return;
    }

    // 返回菜单按钮
    const menuY = centerY + 60 * s;
    if (x >= centerX - bw / 2 && x <= centerX + bw / 2 &&
        y >= menuY - bh / 2 && y <= menuY + bh / 2) {
      if (this.onBackToMenu) this.onBackToMenu();
      return;
    }
  }

  _handleOverTap(x, y) {
    const s = SCALE;
    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT / 2;
    const bw = 120 * s;
    const bh = 40 * s;

    // 重试按钮
    const retryY = centerY + 80 * s;
    if (x >= centerX - bw / 2 && x <= centerX + bw / 2 &&
        y >= retryY - bh / 2 && y <= retryY + bh / 2) {
      this.initLevel(this.stage);
      return;
    }

    // 返回菜单
    const menuY = centerY + 130 * s;
    if (x >= centerX - bw / 2 && x <= centerX + bw / 2 &&
        y >= menuY - bh / 2 && y <= menuY + bh / 2) {
      if (this.onBackToMenu) this.onBackToMenu();
      return;
    }
  }
}
