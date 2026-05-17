import Pool from './base/pool';

let instance;

/**
 * 全局状态管理器
 * 负责管理游戏的状态，包括场景切换、关卡数据等
 */
export default class DataBus {
  // 场景状态: 'levelSelect' | 'playing' | 'gameOver'
  scene = 'levelSelect';

  // 关卡相关
  currentLevel = 1;        // 当前选择的关卡
  stage = 1;               // 当前关卡（同 currentLevel）

  // 游戏状态
  score = 0;
  isGameOver = false;
  isPaused = false;
  gameState = 'aiming';    // 'aiming' | 'launching' | 'running' | 'settling' | 'over'
  frame = 0;

  // 球相关
  balls = [];
  ballCount = 1;

  // 砖块相关
  bricks = [];
  pickups = [];

  // 动画与特效
  animations = [];

  // 对象池
  pool = new Pool();

  constructor() {
    if (instance) return instance;
    instance = this;
  }

  reset() {
    this.frame = 0;
    this.score = 0;
    this.balls = [];
    this.bricks = [];
    this.pickups = [];
    this.animations = [];
    this.isGameOver = false;
    this.isPaused = false;
    this.gameState = 'aiming';
  }

  /**
   * 进入关卡选择场景
   */
  goToLevelSelect() {
    this.scene = 'levelSelect';
    this.reset();
  }

  /**
   * 开始指定关卡
   */
  startLevel(levelNum) {
    this.scene = 'playing';
    this.currentLevel = levelNum;
    this.stage = levelNum;
    this.reset();
  }

  gameOver() {
    this.isGameOver = true;
    this.gameState = 'over';
  }
}
