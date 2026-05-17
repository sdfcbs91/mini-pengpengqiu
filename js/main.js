import './render';
import DataBus from './databus';
import LevelSelect from './scene/levelSelect';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from './render';

const ctx = canvas.getContext('2d');

GameGlobal.databus = new DataBus();

/**
 * 游戏主函数
 * 管理场景切换和主循环
 */
export default class Main {
  constructor() {
    this.databus = GameGlobal.databus;

    // 初始化关卡选择场景
    this.levelSelect = new LevelSelect();
    this.levelSelect.onLevelSelected = this.onLevelSelected.bind(this);

    // 启动游戏主循环
    this.raf = null;
    this.loop();
  }

  /**
   * 当玩家选择关卡时
   */
  onLevelSelected(levelNum) {
    console.log(`选择关卡: ${levelNum}`);
    // TODO: 后续实现 - 切换到游戏场景
    // this.databus.startLevel(levelNum);
  }

  /**
   * 游戏主循环
   */
  loop() {
    ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    const scene = this.databus.scene;

    if (scene === 'levelSelect') {
      this.levelSelect.update();
      this.levelSelect.render(ctx);
    } else if (scene === 'playing') {
      // TODO: 后续实现游戏主场景
    }

    this.databus.frame++;
    this.raf = requestAnimationFrame(this.loop.bind(this));
  }

  /**
   * 开始或重启游戏
   */
  start() {
    this.databus.goToLevelSelect();
  }
}
