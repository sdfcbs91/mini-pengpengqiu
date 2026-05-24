import { TOTAL_LEVELS } from '../config';

/**
 * 关卡数据模块
 * 所有关卡配置均为静态预设，不动态生成
 */

/**
 * 静态关卡配置表（200关）
 * 每关字段：
 *   level        - 关卡号
 *   baseHp       - 砖块基础HP
 *   fillRate     - 砖块填充率(0~1)
 *   initRows     - 初始砖块行数
 *   triangleRate - 三角砖块出现概率(0~1)
 *   pickupMin    - 每行最少道具数
 *   pickupMax    - 每行最多道具数
 *   speedBoostFrame1 - 第一次加速帧数阈值
 *   speedBoostFrame2 - 第二次加速帧数阈值
 *   maxRounds        - 通关所需回合数（生存N轮砖块下移即通关）
 *   defaultBalls     - 初始白球数量
 *   plankRate        - 每行生成横板的概率(0~1)，第5关起开始出现
 */
export const LEVEL_CONFIGS = [
  // ===== 第1~10关：新手引导 =====
  { level: 1, baseHp: 1, fillRate: 0.42, initRows: 2, triangleRate: 0, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 900, speedBoostFrame2: 1800, maxRounds: 4, defaultBalls: 2, plankRate: 0 },
  { level: 2, baseHp: 2, fillRate: 0.42, initRows: 2, triangleRate: 0, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 900, speedBoostFrame2: 1800, maxRounds: 4, defaultBalls: 3, plankRate: 0 },
  { level: 3, baseHp: 5, fillRate: 0.46, initRows: 2, triangleRate: 0, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 900, speedBoostFrame2: 1800, maxRounds: 4, defaultBalls: 4, plankRate: 0 },
  { level: 4, baseHp: 6, fillRate: 0.46, initRows: 2, triangleRate: 0, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 900, speedBoostFrame2: 1800, maxRounds: 5, defaultBalls: 5, plankRate: 0 },
  { level: 5, baseHp: 7, fillRate: 0.48, initRows: 2, triangleRate: 0.04, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 900, speedBoostFrame2: 1800, maxRounds: 5, defaultBalls: 6, plankRate: 0.08 },
  { level: 6, baseHp: 10, fillRate: 0.48, initRows: 2, triangleRate: 0.04, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 900, speedBoostFrame2: 1800, maxRounds: 5, defaultBalls: 7, plankRate: 0.08 },
  { level: 7, baseHp: 12, fillRate: 0.50, initRows: 3, triangleRate: 0.05, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 880, speedBoostFrame2: 1760, maxRounds: 6, defaultBalls: 8, plankRate: 0.10 },
  { level: 8, baseHp: 14, fillRate: 0.50, initRows: 3, triangleRate: 0.05, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 880, speedBoostFrame2: 1760, maxRounds: 6, defaultBalls: 9, plankRate: 0.10 },
  { level: 9, baseHp: 17, fillRate: 0.53, initRows: 3, triangleRate: 0.06, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 860, speedBoostFrame2: 1720, maxRounds: 6, defaultBalls: 10, plankRate: 0.12 },
  { level: 10, baseHp: 20, fillRate: 0.53, initRows: 3, triangleRate: 0.06, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 860, speedBoostFrame2: 1720, maxRounds: 6, defaultBalls: 11, plankRate: 0.12 },

  // ===== 第11~20关：初级 =====
  { level: 11, baseHp: 23, fillRate: 0.54, initRows: 3, triangleRate: 0.06, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 850, speedBoostFrame2: 1700, maxRounds: 7, defaultBalls: 12, plankRate: 0.12 },
  { level: 12, baseHp: 26, fillRate: 0.54, initRows: 3, triangleRate: 0.07, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 850, speedBoostFrame2: 1700, maxRounds: 7, defaultBalls: 13, plankRate: 0.12 },
  { level: 13, baseHp: 29, fillRate: 0.55, initRows: 3, triangleRate: 0.07, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 840, speedBoostFrame2: 1680, maxRounds: 7, defaultBalls: 14, plankRate: 0.14 },
  { level: 14, baseHp: 31, fillRate: 0.55, initRows: 3, triangleRate: 0.07, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 840, speedBoostFrame2: 1680, maxRounds: 7, defaultBalls: 15, plankRate: 0.14 },
  { level: 15, baseHp: 35, fillRate: 0.58, initRows: 3, triangleRate: 0.08, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 830, speedBoostFrame2: 1660, maxRounds: 8, defaultBalls: 16, plankRate: 0.15 },
  { level: 16, baseHp: 37, fillRate: 0.58, initRows: 3, triangleRate: 0.08, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 830, speedBoostFrame2: 1660, maxRounds: 8, defaultBalls: 17, plankRate: 0.15 },
  { level: 17, baseHp: 41, fillRate: 0.60, initRows: 4, triangleRate: 0.08, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 820, speedBoostFrame2: 1640, maxRounds: 8, defaultBalls: 18, plankRate: 0.15 },
  { level: 18, baseHp: 43, fillRate: 0.60, initRows: 4, triangleRate: 0.10, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 820, speedBoostFrame2: 1640, maxRounds: 8, defaultBalls: 19, plankRate: 0.18, warpRate: 0.08 },
  { level: 19, baseHp: 46, fillRate: 0.62, initRows: 4, triangleRate: 0.10, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 810, speedBoostFrame2: 1620, maxRounds: 8, defaultBalls: 20, plankRate: 0.18, warpRate: 0.08 },
  { level: 20, baseHp: 49, fillRate: 0.62, initRows: 4, triangleRate: 0.10, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 810, speedBoostFrame2: 1620, maxRounds: 9, defaultBalls: 21, plankRate: 0.18, warpRate: 0.08 },

  // ===== 第21~40关：中级 =====
  { level: 21, baseHp: 52, fillRate: 0.64, initRows: 4, triangleRate: 0.10, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 800, speedBoostFrame2: 1600, maxRounds: 9, defaultBalls: 22, plankRate: 0.20, warpRate: 0.08 },
  { level: 22, baseHp: 55, fillRate: 0.64, initRows: 4, triangleRate: 0.11, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 800, speedBoostFrame2: 1600, maxRounds: 9, defaultBalls: 23, plankRate: 0.20, warpRate: 0.08 },
  { level: 23, baseHp: 58, fillRate: 0.65, initRows: 4, triangleRate: 0.11, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 790, speedBoostFrame2: 1580, maxRounds: 9, defaultBalls: 24, plankRate: 0.20, warpRate: 0.08 },
  { level: 24, baseHp: 60, fillRate: 0.65, initRows: 4, triangleRate: 0.11, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 790, speedBoostFrame2: 1580, maxRounds: 9, defaultBalls: 25, plankRate: 0.20, warpRate: 0.08 },
  { level: 25, baseHp: 64, fillRate: 0.66, initRows: 4, triangleRate: 0.12, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 780, speedBoostFrame2: 1560, maxRounds: 9, defaultBalls: 26, plankRate: 0.20, warpRate: 0.08 },
  { level: 26, baseHp: 66, fillRate: 0.66, initRows: 4, triangleRate: 0.12, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 780, speedBoostFrame2: 1560, maxRounds: 9, defaultBalls: 27, plankRate: 0.20, warpRate: 0.08 },
  { level: 27, baseHp: 70, fillRate: 0.67, initRows: 4, triangleRate: 0.12, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 770, speedBoostFrame2: 1540, maxRounds: 9, defaultBalls: 28, plankRate: 0.20, warpRate: 0.08 },
  { level: 28, baseHp: 72, fillRate: 0.67, initRows: 4, triangleRate: 0.12, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 770, speedBoostFrame2: 1540, maxRounds: 9, defaultBalls: 29, plankRate: 0.20, warpRate: 0.08 },
  { level: 29, baseHp: 74, fillRate: 0.68, initRows: 5, triangleRate: 0.12, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 760, speedBoostFrame2: 1520, maxRounds: 9, defaultBalls: 30, plankRate: 0.20, warpRate: 0.08 },
  { level: 30, baseHp: 79, fillRate: 0.68, initRows: 5, triangleRate: 0.12, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 760, speedBoostFrame2: 1520, maxRounds: 9, defaultBalls: 31, plankRate: 0.20, warpRate: 0.08 },
  { level: 31, baseHp: 84, fillRate: 0.70, initRows: 5, triangleRate: 0.12, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 750, speedBoostFrame2: 1500, maxRounds: 9, defaultBalls: 32, plankRate: 0.20, warpRate: 0.08 },
  { level: 32, baseHp: 86, fillRate: 0.70, initRows: 5, triangleRate: 0.12, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 750, speedBoostFrame2: 1500, maxRounds: 9, defaultBalls: 33, plankRate: 0.20, warpRate: 0.08 },
  { level: 33, baseHp: 89, fillRate: 0.70, initRows: 5, triangleRate: 0.13, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 740, speedBoostFrame2: 1480, maxRounds: 9, defaultBalls: 34, plankRate: 0.20, warpRate: 0.08 },
  { level: 34, baseHp: 94, fillRate: 0.70, initRows: 5, triangleRate: 0.13, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 740, speedBoostFrame2: 1480, maxRounds: 9, defaultBalls: 35, plankRate: 0.20, warpRate: 0.08 },
  { level: 35, baseHp: 98, fillRate: 0.70, initRows: 5, triangleRate: 0.13, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 730, speedBoostFrame2: 1460, maxRounds: 9, defaultBalls: 36, plankRate: 0.20, warpRate: 0.08 },
  { level: 36, baseHp: 101, fillRate: 0.70, initRows: 5, triangleRate: 0.13, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 730, speedBoostFrame2: 1460, maxRounds: 9, defaultBalls: 37, plankRate: 0.20, warpRate: 0.08 },
  { level: 37, baseHp: 103, fillRate: 0.70, initRows: 5, triangleRate: 0.13, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 720, speedBoostFrame2: 1440, maxRounds: 9, defaultBalls: 38, plankRate: 0.20, warpRate: 0.08 },
  { level: 38, baseHp: 108, fillRate: 0.70, initRows: 5, triangleRate: 0.14, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 720, speedBoostFrame2: 1440, maxRounds: 9, defaultBalls: 39, plankRate: 0.20, warpRate: 0.08 },
  { level: 39, baseHp: 113, fillRate: 0.70, initRows: 5, triangleRate: 0.14, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 710, speedBoostFrame2: 1420, maxRounds: 9, defaultBalls: 40, plankRate: 0.20, warpRate: 0.08 },
  { level: 40, baseHp: 115, fillRate: 0.70, initRows: 5, triangleRate: 0.14, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 710, speedBoostFrame2: 1420, maxRounds: 9, defaultBalls: 41, plankRate: 0.20, warpRate: 0.08 },

  // ===== 第41~60关：进阶 =====
  { level: 41, baseHp: 118, fillRate: 0.70, initRows: 5, triangleRate: 0.14, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 700, speedBoostFrame2: 1400, maxRounds: 9, defaultBalls: 42, plankRate: 0.20, warpRate: 0.08 },
  { level: 42, baseHp: 122, fillRate: 0.70, initRows: 5, triangleRate: 0.14, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 700, speedBoostFrame2: 1400, maxRounds: 9, defaultBalls: 43, plankRate: 0.20, warpRate: 0.08 },
  { level: 43, baseHp: 127, fillRate: 0.70, initRows: 5, triangleRate: 0.14, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 690, speedBoostFrame2: 1380, maxRounds: 9, defaultBalls: 44, plankRate: 0.20, warpRate: 0.08 },
  { level: 44, baseHp: 130, fillRate: 0.70, initRows: 5, triangleRate: 0.14, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 690, speedBoostFrame2: 1380, maxRounds: 9, defaultBalls: 45, plankRate: 0.20, warpRate: 0.08 },
  { level: 45, baseHp: 132, fillRate: 0.70, initRows: 5, triangleRate: 0.16, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 680, speedBoostFrame2: 1360, maxRounds: 9, defaultBalls: 46, plankRate: 0.20, warpRate: 0.08 },
  { level: 46, baseHp: 137, fillRate: 0.70, initRows: 5, triangleRate: 0.16, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 680, speedBoostFrame2: 1360, maxRounds: 9, defaultBalls: 47, plankRate: 0.20, warpRate: 0.08 },
  { level: 47, baseHp: 142, fillRate: 0.70, initRows: 5, triangleRate: 0.16, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 670, speedBoostFrame2: 1340, maxRounds: 9, defaultBalls: 48, plankRate: 0.20, warpRate: 0.08 },
  { level: 48, baseHp: 144, fillRate: 0.70, initRows: 5, triangleRate: 0.16, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 670, speedBoostFrame2: 1340, maxRounds: 9, defaultBalls: 49, plankRate: 0.20, warpRate: 0.08 },
  { level: 49, baseHp: 146, fillRate: 0.70, initRows: 5, triangleRate: 0.16, pickupMin: 1, pickupMax: 1, speedBoostFrame1: 660, speedBoostFrame2: 1320, maxRounds: 9, defaultBalls: 50, plankRate: 0.20, warpRate: 0.08 },
  { level: 50, baseHp: 151, fillRate: 0.70, initRows: 5, triangleRate: 0.16, pickupMin: 1, pickupMax: 1, speedBoostFrame1: 660, speedBoostFrame2: 1320, maxRounds: 9, defaultBalls: 51, plankRate: 0.22, warpRate: 0.08 },
  { level: 51, baseHp: 156, fillRate: 0.70, initRows: 5, triangleRate: 0.16, pickupMin: 1, pickupMax: 1, speedBoostFrame1: 660, speedBoostFrame2: 1320, maxRounds: 9, defaultBalls: 52, plankRate: 0.22, warpRate: 0.08 },
  { level: 52, baseHp: 158, fillRate: 0.70, initRows: 5, triangleRate: 0.16, pickupMin: 1, pickupMax: 1, speedBoostFrame1: 650, speedBoostFrame2: 1300, maxRounds: 9, defaultBalls: 53, plankRate: 0.22, warpRate: 0.08 },
  { level: 53, baseHp: 161, fillRate: 0.70, initRows: 5, triangleRate: 0.16, pickupMin: 1, pickupMax: 1, speedBoostFrame1: 650, speedBoostFrame2: 1300, maxRounds: 9, defaultBalls: 54, plankRate: 0.22, warpRate: 0.08 },
  { level: 54, baseHp: 166, fillRate: 0.70, initRows: 5, triangleRate: 0.17, pickupMin: 1, pickupMax: 1, speedBoostFrame1: 650, speedBoostFrame2: 1300, maxRounds: 9, defaultBalls: 55, plankRate: 0.22, warpRate: 0.08 },
  { level: 55, baseHp: 170, fillRate: 0.70, initRows: 5, triangleRate: 0.17, pickupMin: 1, pickupMax: 1, speedBoostFrame1: 640, speedBoostFrame2: 1280, maxRounds: 9, defaultBalls: 56, plankRate: 0.22, warpRate: 0.08 },
  { level: 56, baseHp: 173, fillRate: 0.70, initRows: 5, triangleRate: 0.17, pickupMin: 1, pickupMax: 1, speedBoostFrame1: 640, speedBoostFrame2: 1280, maxRounds: 9, defaultBalls: 57, plankRate: 0.22, warpRate: 0.08 },
  { level: 57, baseHp: 175, fillRate: 0.70, initRows: 5, triangleRate: 0.17, pickupMin: 1, pickupMax: 1, speedBoostFrame1: 640, speedBoostFrame2: 1280, maxRounds: 9, defaultBalls: 58, plankRate: 0.22, warpRate: 0.08 },
  { level: 58, baseHp: 180, fillRate: 0.70, initRows: 5, triangleRate: 0.17, pickupMin: 1, pickupMax: 1, speedBoostFrame1: 630, speedBoostFrame2: 1260, maxRounds: 9, defaultBalls: 59, plankRate: 0.22, warpRate: 0.08 },
  { level: 59, baseHp: 185, fillRate: 0.70, initRows: 5, triangleRate: 0.17, pickupMin: 1, pickupMax: 1, speedBoostFrame1: 630, speedBoostFrame2: 1260, maxRounds: 9, defaultBalls: 60, plankRate: 0.22, warpRate: 0.08 },
  { level: 60, baseHp: 187, fillRate: 0.70, initRows: 5, triangleRate: 0.17, pickupMin: 1, pickupMax: 1, speedBoostFrame1: 630, speedBoostFrame2: 1260, maxRounds: 9, defaultBalls: 61, plankRate: 0.22, warpRate: 0.08 },
];

// ===== 第61~200关：批量填充（每10关一个梯度） =====
(function fillRemaining() {
  const stages = [
    // [startLevel, baseHp, fillRate, triangleRate, speedBoostFrame1, maxRounds]
    [61, 162, 0.70, 0.17, 620, 9],
    [71, 192, 0.70, 0.17, 610, 9],
    [81, 222, 0.70, 0.18, 600, 9],
    [91, 252, 0.70, 0.18, 600, 9],
    [101, 288, 0.70, 0.18, 600, 9],
    [111, 324, 0.70, 0.18, 600, 9],
    [121, 360, 0.70, 0.18, 600, 9],
    [131, 396, 0.70, 0.18, 600, 9],
    [141, 432, 0.70, 0.18, 600, 9],
    [151, 480, 0.70, 0.18, 600, 9],
    [161, 528, 0.70, 0.18, 600, 9],
    [171, 576, 0.70, 0.18, 600, 9],
    [181, 624, 0.70, 0.18, 600, 9],
    [191, 672, 0.70, 0.18, 600, 9],
  ];

  for (const [start, hp, fill, tri, boost1, rounds] of stages) {
    for (let i = 0; i < 10 && start + i <= TOTAL_LEVELS; i++) {
      const lv = start + i;
      LEVEL_CONFIGS.push({
        level: lv,
        baseHp: hp + i * 3,
        fillRate: fill,
        initRows: 3 + Math.floor(lv / 30),
        triangleRate: tri,
        pickupMin: 1,
        pickupMax: 1,
        speedBoostFrame1: boost1,
        speedBoostFrame2: boost1 * 2,
        maxRounds: rounds,
        defaultBalls: 1 + lv,
        plankRate: 0.25,
        warpRate: 0.08,
      });
    }
  }
})();

/**
 * 获取指定关卡配置
 */
export function getLevelConfig(levelNum) {
  const idx = Math.max(0, Math.min(LEVEL_CONFIGS.length - 1, levelNum - 1));
  return LEVEL_CONFIGS[idx];
}

// ====== 玩家关卡进度数据 ======

const STORAGE_KEY = 'ppq_level_progress';

/**
 * 关卡进度管理
 * 每关: { unlocked: bool, stars: 0-3 }
 */
export class LevelProgress {
  constructor() {
    this.data = this._load();
  }

  _load() {
    try {
      const raw = wx.getStorageSync(STORAGE_KEY);
      if (raw && raw.length === TOTAL_LEVELS) return raw;
    } catch (e) { /* ignore */ }
    return this._createDefault();
  }

  _createDefault() {
    const data = [];
    for (let i = 0; i < TOTAL_LEVELS; i++) {
      data.push({ unlocked: i === 0, stars: 0 });
    }
    return data;
  }

  save() {
    try {
      wx.setStorageSync(STORAGE_KEY, this.data);
    } catch (e) { /* ignore */ }
  }

  get(levelNum) {
    return this.data[Math.max(0, levelNum - 1)] || { unlocked: false, stars: 0 };
  }

  isUnlocked(levelNum) {
    return this.get(levelNum).unlocked;
  }

  getStars(levelNum) {
    return this.get(levelNum).stars;
  }

  completeLevel(levelNum, stars) {
    const idx = levelNum - 1;
    if (idx < 0 || idx >= TOTAL_LEVELS) return;
    this.data[idx].stars = Math.max(this.data[idx].stars, Math.min(3, stars));
    if (idx + 1 < TOTAL_LEVELS) {
      this.data[idx + 1].unlocked = true;
    }
    this.save();
  }

  unlock(levelNum) {
    const idx = levelNum - 1;
    if (idx >= 0 && idx < TOTAL_LEVELS) {
      this.data[idx].unlocked = true;
      this.save();
    }
  }

  getMaxUnlocked() {
    for (let i = TOTAL_LEVELS - 1; i >= 0; i--) {
      if (this.data[i].unlocked) return i + 1;
    }
    return 1;
  }

  getAllData() {
    return this.data;
  }
}
