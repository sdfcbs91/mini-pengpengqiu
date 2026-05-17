import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import {
  COLORS, SCALE,
  GAME_AREA_LEFT, GAME_AREA_RIGHT, GAME_AREA_TOP,
  LAUNCH_Y, LIGHTNING_INITIAL, MULTIBALL_INITIAL, MAX_ENERGY, ENERGY_PER_BRICK,
} from '../config';
import Grid from '../core/grid';
import Launcher from '../core/launcher';
import HUD from '../runtime/hud';
import { ballBrickCollision, ballTriangleCollision, ballPickupCollision, reflectBall } from '../core/collision';

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
    this.gameState = 'aiming';  // 'aiming' | 'launching' | 'running' | 'settling' | 'over' | 'paused'
    this.prevState = '';         // 暂停前的状态
    this.glowPhase = 0;

    // 技能
    this.lightningCount = LIGHTNING_INITIAL;
    this.multiBallCount = MULTIBALL_INITIAL;
    this.energy = 0;
    this.showAimLine = true;

    // 球相关
    this.ballCount = 1;
    this.nextBallCount = 0;     // 本轮收集的加球道具数

    // 统计（用于星级评价）
    this.totalBricksThisRound = 0;
    this.destroyedThisRound = 0;
    this.starProgress = 0;

    // 回调
    this.onGameOver = null;
    this.onBackToMenu = null;

    // 触摸绑定
    this._bindTouch();
  }

  /**
   * 初始化指定关卡
   */
  initLevel(levelNum) {
    this.stage = levelNum;
    this.score = 0;
    this.line = 0;
    this.gameState = 'aiming';
    this.energy = 0;
    this.ballCount = 1;
    this.nextBallCount = 0;
    this.totalBricksThisRound = 0;
    this.destroyedThisRound = 0;
    this.starProgress = 0;

    this.grid.initLevel(this.stage);
    this.launcher.init(SCREEN_WIDTH / 2, this.ballCount);
  }

  _bindTouch() {
    this._touchStartHandler = (e) => {
      if (GameGlobal.databus.scene !== 'playing') return;
      const { clientX, clientY } = e.touches[0];

      if (this.gameState === 'over') {
        this._handleOverTap(clientX, clientY);
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

      // 瞄准
      if (this.gameState === 'aiming') {
        this.launcher.isAiming = true;
        this.launcher.setAimAngle(clientX, clientY);
      }
    };

    this._touchMoveHandler = (e) => {
      if (GameGlobal.databus.scene !== 'playing') return;
      if (this.gameState !== 'aiming' || !this.launcher.isAiming) return;

      const { clientX, clientY } = e.touches[0];
      this.launcher.setAimAngle(clientX, clientY);
    };

    this._touchEndHandler = () => {
      if (GameGlobal.databus.scene !== 'playing') return;

      if (this.gameState === 'aiming' && this.launcher.isAiming) {
        this.launcher.isAiming = false;
        // 开始发射
        this.gameState = 'launching';
        this.launcher.startLaunch();
        this.totalBricksThisRound = this.grid.bricks.filter(b => b.isAlive).length;
        this.destroyedThisRound = 0;
      }
    };

    wx.onTouchStart(this._touchStartHandler);
    wx.onTouchMove(this._touchMoveHandler);
    wx.onTouchEnd(this._touchEndHandler);
  }

  unbindTouch() {
    wx.offTouchStart(this._touchStartHandler);
    wx.offTouchMove(this._touchMoveHandler);
    wx.offTouchEnd(this._touchEndHandler);
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
    if (this.gameState === 'paused' || this.gameState === 'over') return;

    this.glowPhase += 0.03;
    if (this.glowPhase > Math.PI * 2) this.glowPhase -= Math.PI * 2;

    this.hud.update();
    this.grid.update();

    switch (this.gameState) {
      case 'aiming':
        // 等待玩家操作
        break;

      case 'launching':
        this.launcher.updateLaunch();
        this._updateBalls();
        if (!this.launcher.isLaunching && this.launcher.allBallsLanded()) {
          this.gameState = 'settling';
        } else if (!this.launcher.isLaunching) {
          this.gameState = 'running';
        }
        break;

      case 'running':
        this._updateBalls();
        if (this.launcher.allBallsLanded()) {
          this.gameState = 'settling';
        }
        break;

      case 'settling':
        this._settle();
        break;
    }
  }

  _updateBalls() {
    const left = GAME_AREA_LEFT;
    const right = GAME_AREA_RIGHT;
    const top = GAME_AREA_TOP;
    const bottom = LAUNCH_Y;

    this.launcher.balls.forEach(ball => {
      if (!ball.active) {
        this.launcher.checkLanded(ball);
        return;
      }

      ball.update(left, right, top, bottom);

      // 碰撞检测 - 砖块
      for (const brick of this.grid.bricks) {
        if (!brick.isAlive) continue;

        let result;
        if (brick.type === 'triangle') {
          result = ballTriangleCollision(ball, brick);
        } else {
          result = ballBrickCollision(ball, brick);
        }

        if (result.hit) {
          reflectBall(ball, result, brick);
          const destroyed = brick.hit();
          if (destroyed) {
            this.score += brick.maxHp;
            this.destroyedThisRound++;
            this.energy = Math.min(MAX_ENERGY, this.energy + ENERGY_PER_BRICK);
          }
          break; // 每帧每球只处理一次碰撞
        }
      }

      // 碰撞检测 - 道具
      for (const pickup of this.grid.pickups) {
        if (pickup.collected) continue;
        if (ballPickupCollision(ball, pickup)) {
          pickup.collected = true;
          this.nextBallCount++;
        }
      }

      this.launcher.checkLanded(ball);
    });
  }

  _settle() {
    // 结算：清理、下移、生成新行
    this.grid.cleanup();

    // 计算星级进度
    if (this.totalBricksThisRound > 0) {
      this.starProgress = Math.min(1, this.destroyedThisRound / this.totalBricksThisRound);
    }

    // 增加行数
    this.line++;
    this.stage++;

    // 砖块下移
    const isOver = this.grid.shiftDown(LAUNCH_Y);

    // 生成新行
    this.grid.generateRow(this.stage, 0);

    // 更新球数
    this.ballCount += this.nextBallCount;
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
    this.launcher.render(ctx, this.gameState);

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

    // 暂停覆盖层
    if (this.gameState === 'paused') {
      this._renderPauseOverlay(ctx);
    }

    // 游戏结束覆盖层
    if (this.gameState === 'over') {
      this._renderGameOverOverlay(ctx);
    }
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

    // 底部红线（发射线）
    ctx.strokeStyle = COLORS.neonRed;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = COLORS.neonRed;
    ctx.shadowBlur = 6 * s;
    ctx.beginPath();
    ctx.moveTo(GAME_AREA_LEFT, LAUNCH_Y);
    ctx.lineTo(GAME_AREA_RIGHT, LAUNCH_Y);
    ctx.stroke();
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
