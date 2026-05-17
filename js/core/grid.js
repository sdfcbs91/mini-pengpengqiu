import Brick from './brick';
import Pickup from './pickup';
import {
  GRID_COLS, BRICK_GAP, BRICK_W, BRICK_H,
  GAME_AREA_LEFT, GAME_AREA_TOP,
  BRICK_FILL_RATE_MIN, BRICK_FILL_RATE_MAX,
  PICKUP_PER_ROW_MIN, PICKUP_PER_ROW_MAX,
} from '../config';

/**
 * 网格管理器
 * 管理砖块的生成、下移和布局
 */
export default class Grid {
  constructor() {
    this.bricks = [];    // 所有活跃砖块
    this.pickups = [];   // 所有活跃道具
    this.rowHeight = BRICK_H + BRICK_GAP;
  }

  /**
   * 计算指定列的X坐标（砖块左边）
   */
  getColX(col) {
    return GAME_AREA_LEFT + BRICK_GAP + col * (BRICK_W + BRICK_GAP);
  }

  /**
   * 计算指定行的Y坐标（砖块上边）
   * row 0 = 顶行
   */
  getRowY(row) {
    return GAME_AREA_TOP + BRICK_GAP + row * this.rowHeight;
  }

  /**
   * 初始化关卡 - 生成初始几行砖块
   */
  initLevel(stage) {
    this.bricks = [];
    this.pickups = [];

    // 初始生成3行
    for (let i = 0; i < 3; i++) {
      this.generateRow(stage - i, i);
    }
  }

  /**
   * 在指定行生成新的一行砖块和道具
   */
  generateRow(stage, rowIndex = 0) {
    const hp = Math.max(1, Math.round(stage * 1.5));
    const fillRate = Math.min(BRICK_FILL_RATE_MAX,
      BRICK_FILL_RATE_MIN + stage * 0.005);

    // 随机决定哪些列有砖块
    const cols = [];
    for (let c = 0; c < GRID_COLS; c++) {
      if (Math.random() < fillRate) {
        cols.push(c);
      }
    }
    // 至少3个砖块
    while (cols.length < 3) {
      const c = Math.floor(Math.random() * GRID_COLS);
      if (!cols.includes(c)) cols.push(c);
    }

    // 创建砖块
    cols.forEach(col => {
      const brick = new Brick();
      const isTriangle = Math.random() < 0.08; // 8%概率三角砖块
      const type = isTriangle ? 'triangle' : 'normal';
      const dirs = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];
      const dir = isTriangle ? dirs[Math.floor(Math.random() * dirs.length)] : '';

      brick.init(
        rowIndex, col,
        this.getColX(col),
        this.getRowY(rowIndex),
        BRICK_W, BRICK_H,
        Math.max(1, hp + Math.floor(Math.random() * 3) - 1), // HP有小波动，最少1
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
      PICKUP_PER_ROW_MIN + Math.floor(Math.random() * (PICKUP_PER_ROW_MAX - PICKUP_PER_ROW_MIN + 1))
    );
    // 随机选几个空列放道具
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

  /**
   * 所有砖块和道具下移一行
   * 返回是否有砖块到达底部
   */
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

  /**
   * 清理已消除的砖块和已收集的道具
   */
  cleanup() {
    this.bricks = this.bricks.filter(b => b.isAlive);
    this.pickups = this.pickups.filter(p => !p.collected);
  }

  /**
   * 检查是否有砖块超过底线
   */
  checkGameOver(bottomLimit) {
    return this.bricks.some(b => b.isAlive && b.y + b.height > bottomLimit);
  }

  update() {
    this.bricks.forEach(b => {
      if (b.isAlive) b.update();
    });
    this.pickups.forEach(p => {
      if (!p.collected) p.update();
    });
  }

  render(ctx, glowPhase) {
    // 砖块
    this.bricks.forEach(b => {
      b.render(ctx, glowPhase);
    });
    // 道具
    this.pickups.forEach(p => {
      p.render(ctx);
    });
  }
}
