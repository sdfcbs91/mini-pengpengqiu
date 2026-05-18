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
 */
export const LEVEL_CONFIGS = [
  // ===== 第1~10关：新手引导 =====
  { level: 1, baseHp: 1, fillRate: 0.42, initRows: 2, triangleRate: 0, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 900, speedBoostFrame2: 1800, maxRounds: 12 },
  { level: 2, baseHp: 2, fillRate: 0.42, initRows: 2, triangleRate: 0, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 900, speedBoostFrame2: 1800, maxRounds: 12 },
  { level: 3, baseHp: 4, fillRate: 0.46, initRows: 2, triangleRate: 0, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 900, speedBoostFrame2: 1800, maxRounds: 15 },
  { level: 4, baseHp: 5, fillRate: 0.46, initRows: 2, triangleRate: 0, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 900, speedBoostFrame2: 1800, maxRounds: 15 },
  { level: 5, baseHp: 6, fillRate: 0.48, initRows: 2, triangleRate: 0.04, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 900, speedBoostFrame2: 1800, maxRounds: 15 },
  { level: 6, baseHp: 8, fillRate: 0.48, initRows: 2, triangleRate: 0.04, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 900, speedBoostFrame2: 1800, maxRounds: 18 },
  { level: 7, baseHp: 10, fillRate: 0.50, initRows: 3, triangleRate: 0.05, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 880, speedBoostFrame2: 1760, maxRounds: 18 },
  { level: 8, baseHp: 12, fillRate: 0.50, initRows: 3, triangleRate: 0.05, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 880, speedBoostFrame2: 1760, maxRounds: 18 },
  { level: 9, baseHp: 14, fillRate: 0.53, initRows: 3, triangleRate: 0.06, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 860, speedBoostFrame2: 1720, maxRounds: 22 },
  { level: 10, baseHp: 17, fillRate: 0.53, initRows: 3, triangleRate: 0.06, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 860, speedBoostFrame2: 1720, maxRounds: 22 },

  // ===== 第11~20关：初级 =====
  { level: 11, baseHp: 19, fillRate: 0.54, initRows: 3, triangleRate: 0.06, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 850, speedBoostFrame2: 1700, maxRounds: 22 },
  { level: 12, baseHp: 22, fillRate: 0.54, initRows: 3, triangleRate: 0.07, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 850, speedBoostFrame2: 1700, maxRounds: 22 },
  { level: 13, baseHp: 24, fillRate: 0.55, initRows: 3, triangleRate: 0.07, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 840, speedBoostFrame2: 1680, maxRounds: 27 },
  { level: 14, baseHp: 26, fillRate: 0.55, initRows: 3, triangleRate: 0.07, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 840, speedBoostFrame2: 1680, maxRounds: 27 },
  { level: 15, baseHp: 29, fillRate: 0.58, initRows: 3, triangleRate: 0.08, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 830, speedBoostFrame2: 1660, maxRounds: 27 },
  { level: 16, baseHp: 31, fillRate: 0.58, initRows: 3, triangleRate: 0.08, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 830, speedBoostFrame2: 1660, maxRounds: 30 },
  { level: 17, baseHp: 34, fillRate: 0.60, initRows: 4, triangleRate: 0.08, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 820, speedBoostFrame2: 1640, maxRounds: 30 },
  { level: 18, baseHp: 36, fillRate: 0.60, initRows: 4, triangleRate: 0.10, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 820, speedBoostFrame2: 1640, maxRounds: 30 },
  { level: 19, baseHp: 38, fillRate: 0.62, initRows: 4, triangleRate: 0.10, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 810, speedBoostFrame2: 1620, maxRounds: 30 },
  { level: 20, baseHp: 41, fillRate: 0.62, initRows: 4, triangleRate: 0.10, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 810, speedBoostFrame2: 1620, maxRounds: 30 },

  // ===== 第21~40关：中级 =====
  { level: 21, baseHp: 43, fillRate: 0.64, initRows: 4, triangleRate: 0.10, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 800, speedBoostFrame2: 1600, maxRounds: 33 },
  { level: 22, baseHp: 46, fillRate: 0.64, initRows: 4, triangleRate: 0.11, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 800, speedBoostFrame2: 1600, maxRounds: 33 },
  { level: 23, baseHp: 48, fillRate: 0.65, initRows: 4, triangleRate: 0.11, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 790, speedBoostFrame2: 1580, maxRounds: 33 },
  { level: 24, baseHp: 50, fillRate: 0.65, initRows: 4, triangleRate: 0.11, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 790, speedBoostFrame2: 1580, maxRounds: 38 },
  { level: 25, baseHp: 53, fillRate: 0.66, initRows: 4, triangleRate: 0.12, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 780, speedBoostFrame2: 1560, maxRounds: 38 },
  { level: 26, baseHp: 55, fillRate: 0.66, initRows: 4, triangleRate: 0.12, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 780, speedBoostFrame2: 1560, maxRounds: 38 },
  { level: 27, baseHp: 58, fillRate: 0.67, initRows: 4, triangleRate: 0.12, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 770, speedBoostFrame2: 1540, maxRounds: 38 },
  { level: 28, baseHp: 60, fillRate: 0.67, initRows: 4, triangleRate: 0.12, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 770, speedBoostFrame2: 1540, maxRounds: 38 },
  { level: 29, baseHp: 62, fillRate: 0.68, initRows: 5, triangleRate: 0.12, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 760, speedBoostFrame2: 1520, maxRounds: 42 },
  { level: 30, baseHp: 66, fillRate: 0.68, initRows: 5, triangleRate: 0.12, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 760, speedBoostFrame2: 1520, maxRounds: 42 },
  { level: 31, baseHp: 70, fillRate: 0.70, initRows: 5, triangleRate: 0.12, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 750, speedBoostFrame2: 1500, maxRounds: 42 },
  { level: 32, baseHp: 72, fillRate: 0.70, initRows: 5, triangleRate: 0.12, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 750, speedBoostFrame2: 1500, maxRounds: 42 },
  { level: 33, baseHp: 74, fillRate: 0.70, initRows: 5, triangleRate: 0.13, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 740, speedBoostFrame2: 1480, maxRounds: 45 },
  { level: 34, baseHp: 78, fillRate: 0.70, initRows: 5, triangleRate: 0.13, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 740, speedBoostFrame2: 1480, maxRounds: 45 },
  { level: 35, baseHp: 82, fillRate: 0.70, initRows: 5, triangleRate: 0.13, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 730, speedBoostFrame2: 1460, maxRounds: 45 },
  { level: 36, baseHp: 84, fillRate: 0.70, initRows: 5, triangleRate: 0.13, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 730, speedBoostFrame2: 1460, maxRounds: 45 },
  { level: 37, baseHp: 86, fillRate: 0.70, initRows: 5, triangleRate: 0.13, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 720, speedBoostFrame2: 1440, maxRounds: 45 },
  { level: 38, baseHp: 90, fillRate: 0.70, initRows: 5, triangleRate: 0.14, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 720, speedBoostFrame2: 1440, maxRounds: 45 },
  { level: 39, baseHp: 94, fillRate: 0.70, initRows: 5, triangleRate: 0.14, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 710, speedBoostFrame2: 1420, maxRounds: 45 },
  { level: 40, baseHp: 96, fillRate: 0.70, initRows: 5, triangleRate: 0.14, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 710, speedBoostFrame2: 1420, maxRounds: 45 },

  // ===== 第41~60关：进阶 =====
  { level: 41, baseHp: 98, fillRate: 0.70, initRows: 5, triangleRate: 0.14, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 700, speedBoostFrame2: 1400, maxRounds: 45 },
  { level: 42, baseHp: 102, fillRate: 0.70, initRows: 5, triangleRate: 0.14, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 700, speedBoostFrame2: 1400, maxRounds: 45 },
  { level: 43, baseHp: 106, fillRate: 0.70, initRows: 5, triangleRate: 0.14, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 690, speedBoostFrame2: 1380, maxRounds: 52 },
  { level: 44, baseHp: 108, fillRate: 0.70, initRows: 5, triangleRate: 0.14, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 690, speedBoostFrame2: 1380, maxRounds: 52 },
  { level: 45, baseHp: 110, fillRate: 0.70, initRows: 5, triangleRate: 0.16, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 680, speedBoostFrame2: 1360, maxRounds: 52 },
  { level: 46, baseHp: 114, fillRate: 0.70, initRows: 5, triangleRate: 0.16, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 680, speedBoostFrame2: 1360, maxRounds: 52 },
  { level: 47, baseHp: 118, fillRate: 0.70, initRows: 5, triangleRate: 0.16, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 670, speedBoostFrame2: 1340, maxRounds: 52 },
  { level: 48, baseHp: 120, fillRate: 0.70, initRows: 5, triangleRate: 0.16, pickupMin: 1, pickupMax: 2, speedBoostFrame1: 670, speedBoostFrame2: 1340, maxRounds: 52 },
  { level: 49, baseHp: 122, fillRate: 0.70, initRows: 5, triangleRate: 0.16, pickupMin: 1, pickupMax: 1, speedBoostFrame1: 660, speedBoostFrame2: 1320, maxRounds: 52 },
  { level: 50, baseHp: 126, fillRate: 0.70, initRows: 5, triangleRate: 0.16, pickupMin: 1, pickupMax: 1, speedBoostFrame1: 660, speedBoostFrame2: 1320, maxRounds: 52 },
  { level: 51, baseHp: 130, fillRate: 0.70, initRows: 5, triangleRate: 0.16, pickupMin: 1, pickupMax: 1, speedBoostFrame1: 660, speedBoostFrame2: 1320, maxRounds: 52 },
  { level: 52, baseHp: 132, fillRate: 0.70, initRows: 5, triangleRate: 0.16, pickupMin: 1, pickupMax: 1, speedBoostFrame1: 650, speedBoostFrame2: 1300, maxRounds: 52 },
  { level: 53, baseHp: 134, fillRate: 0.70, initRows: 5, triangleRate: 0.16, pickupMin: 1, pickupMax: 1, speedBoostFrame1: 650, speedBoostFrame2: 1300, maxRounds: 52 },
  { level: 54, baseHp: 138, fillRate: 0.70, initRows: 5, triangleRate: 0.17, pickupMin: 1, pickupMax: 1, speedBoostFrame1: 650, speedBoostFrame2: 1300, maxRounds: 52 },
  { level: 55, baseHp: 142, fillRate: 0.70, initRows: 5, triangleRate: 0.17, pickupMin: 1, pickupMax: 1, speedBoostFrame1: 640, speedBoostFrame2: 1280, maxRounds: 60 },
  { level: 56, baseHp: 144, fillRate: 0.70, initRows: 5, triangleRate: 0.17, pickupMin: 1, pickupMax: 1, speedBoostFrame1: 640, speedBoostFrame2: 1280, maxRounds: 60 },
  { level: 57, baseHp: 146, fillRate: 0.70, initRows: 5, triangleRate: 0.17, pickupMin: 1, pickupMax: 1, speedBoostFrame1: 640, speedBoostFrame2: 1280, maxRounds: 60 },
  { level: 58, baseHp: 150, fillRate: 0.70, initRows: 5, triangleRate: 0.17, pickupMin: 1, pickupMax: 1, speedBoostFrame1: 630, speedBoostFrame2: 1260, maxRounds: 60 },
  { level: 59, baseHp: 154, fillRate: 0.70, initRows: 5, triangleRate: 0.17, pickupMin: 1, pickupMax: 1, speedBoostFrame1: 630, speedBoostFrame2: 1260, maxRounds: 60 },
  { level: 60, baseHp: 156, fillRate: 0.70, initRows: 5, triangleRate: 0.17, pickupMin: 1, pickupMax: 1, speedBoostFrame1: 630, speedBoostFrame2: 1260, maxRounds: 60 },
];

// ===== 第61~200关：批量填充（每10关一个梯度） =====
(function fillRemaining() {
  const stages = [
    // [startLevel, baseHp, fillRate, triangleRate, speedBoostFrame1, maxRounds]
    [61, 162, 0.70, 0.17, 620, 60],
    [71, 192, 0.70, 0.17, 610, 60],
    [81, 222, 0.70, 0.18, 600, 68],
    [91, 252, 0.70, 0.18, 600, 68],
    [101, 288, 0.70, 0.18, 600, 68],
    [111, 324, 0.70, 0.18, 600, 75],
    [121, 360, 0.70, 0.18, 600, 75],
    [131, 396, 0.70, 0.18, 600, 75],
    [141, 432, 0.70, 0.18, 600, 75],
    [151, 480, 0.70, 0.18, 600, 75],
    [161, 528, 0.70, 0.18, 600, 75],
    [171, 576, 0.70, 0.18, 600, 75],
    [181, 624, 0.70, 0.18, 600, 75],
    [191, 672, 0.70, 0.18, 600, 75],
  ];

  for (const [start, hp, fill, tri, boost1, rounds] of stages) {
    for (let i = 0; i < 10 && start + i <= TOTAL_LEVELS; i++) {
      const lv = start + i;
      LEVEL_CONFIGS.push({
        level: lv,
        baseHp: hp + i * 3,
        fillRate: fill,
        initRows: 3,
        triangleRate: tri,
        pickupMin: 1,
        pickupMax: 1,
        speedBoostFrame1: boost1,
        speedBoostFrame2: boost1 * 2,
        maxRounds: rounds,
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
