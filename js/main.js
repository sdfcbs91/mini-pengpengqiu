import './render';
import DataBus from './databus';
import LevelSelect from './scene/levelSelect';
import GameScene from './scene/gameScene';
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

    // 初始化游戏场景（延迟创建）
    this.gameScene = null;

    // 启动游戏主循环
    this.raf = null;
    this.loop();
  }

  /**
   * 当玩家选择关卡时，切换到游戏场景
   */
  onLevelSelected(levelNum) {
    // 解绑关卡选择的触摸事件
    this.levelSelect.unbindTouch();

    // 创建游戏场景
    this.gameScene = new GameScene();
    this.gameScene.onBackToMenu = this.onBackToMenu.bind(this);
    this.gameScene.onGameOver = () => {};
    this.gameScene.initLevel(levelNum);

    // 切换场景
    this.databus.startLevel(levelNum);
  }

  /**
   * 返回关卡选择菜单
   */
  onBackToMenu() {
    if (this.gameScene) {
      this.gameScene.unbindTouch();
      this.gameScene = null;
    }

    // 重新绑定关卡选择触摸
    this.levelSelect._bindTouch();
    this.databus.goToLevelSelect();
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
    } else if (scene === 'playing' && this.gameScene) {
      this.gameScene.update();
      this.gameScene.render(ctx);
    }

    this.databus.frame++;
    this.raf = requestAnimationFrame(this.loop.bind(this));
  }
}
