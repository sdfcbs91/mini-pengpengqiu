import Brick from './brick';
import Pickup from './pickup';
import {
  GRID_COLS, BRICK_GAP, BRICK_W, BRICK_H,
  GAME_AREA_LEFT, GAME_AREA_TOP,
} from '../config';
import { getLevelConfig } from '../data/levelData';

/**
 * 网格管理器
 * 管理砖块的生成、下移和布局
 */
export default class Grid {
  constructor() {
    this.bricks = [];
    this.pickups = [];
    this.rowHeight = BRICK_H + BRICK_GAP;
    this.levelConfig = null;  // 当前关卡配置
  }

  getColX(col) {
    return GAME_AREA_LEFT + BRICK_GAP + col * (BRICK_W + BRICK_GAP);
  }

  getRowY(row) {
    return GAME_AREA_TOP + BRICK_GAP + row * this.rowHeight;
  }

  /**
   * 初始化关卡
   */
  initLevel(stage) {
    this.bricks = [];
    this.pickups = [];
    this.levelConfig = getLevelConfig(stage);

    const rows = this.levelConfig.initRows;
    for (let i = 0; i < rows; i++) {
      this.generateRow(stage - i, i);
    }
  }

  /**
   * 生成一行砖块和道具（使用关卡配置）
   */
  generateRow(stage, rowIndex = 0) {
    const cfg = this.levelConfig || getLevelConfig(Math.max(1, stage));
    const hp = Math.max(1, Math.round(stage * 1.5));
    const fillRate = cfg.fillRate;
    const triangleRate = cfg.triangleRate;
    const pickupMin = cfg.pickupMin;
    const pickupMax = cfg.pickupMax;

    // 随机决定哪些列有砖块
    const cols = [];
    for (let c = 0; c < GRID_COLS; c++) {
      if (Math.random() < fillRate) {
        cols.push(c);
      }
    }
    while (cols.length < 3) {
      const c = Math.floor(Math.random() * GRID_COLS);
      if (!cols.includes(c)) cols.push(c);
    }

    // 创建砖块
    cols.forEach(col => {
      const brick = new Brick();
      const isTriangle = Math.random() < triangleRate;
      const type = isTriangle ? 'triangle' : 'normal';
      const dirs = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];
      const dir = isTriangle ? dirs[Math.floor(Math.random() * dirs.length)] : '';

      brick.init(
        rowIndex, col,
        this.getColX(col),
        this.getRowY(rowIndex),
        BRICK_W, BRICK_H,
        Math.max(1, hp + Math.floor(Math.random() * 3) - 1),
        type, dir
      );
      this.bricks.push(brick);
    });

    // 在空白列中生成道具
    const emptyCols = [];
    for (let c = 0; c < GRID_COLS; c++) {
      if (!cols.includes(c)) emptyCols.push(c);
    }
    const pickupCount = Math.min(
      emptyCols.length,
      pickupMin + Math.floor(Math.random() * (pickupMax - pickupMin + 1))
    );
    const shuffled = emptyCols.sort(() => Math.random() - 0.5);
    for (let i = 0; i < pickupCount; i++) {
      const col = shuffled[i];
      const pickup = new Pickup();
      pickup.init(
        this.getColX(col) + BRICK_W / 2,
        this.getRowY(rowIndex) + BRICK_H / 2
      );
      this.pickups.push(pickup);
    }
  }

  shiftDown(bottomLimit) {
    let gameOver = false;

    this.bricks.forEach(brick => {
      if (!brick.isAlive) return;
      brick.row++;
      brick.targetY += this.rowHeight;
      if (brick.targetY + brick.height > bottomLimit) {
        gameOver = true;
      }
    });

    this.pickups.forEach(pickup => {
      if (!pickup.collected) {
        pickup.moveDown(this.rowHeight);
      }
    });

    return gameOver;
  }

  cleanup() {
    this.bricks = this.bricks.filter(b => b.isAlive);
    this.pickups = this.pickups.filter(p => !p.collected);
  }

  checkGameOver(bottomLimit) {
    return this.bricks.some(b => b.isAlive && b.y + b.height > bottomLimit);
  }

  update() {
    this.bricks.forEach(b => { if (b.isAlive) b.update(); });
    this.pickups.forEach(p => { if (!p.collected) p.update(); });
  }

  render(ctx, glowPhase) {
    this.bricks.forEach(b => { b.render(ctx, glowPhase); });
    this.pickups.forEach(p => { p.render(ctx); });
  }
}
