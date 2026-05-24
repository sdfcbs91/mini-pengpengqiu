const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

/**
 * 云函数：saveUserProgress
 * 记录用户登录时间、openid、用户信息、当前最高关卡、完整关卡进度
 *
 * 调用参数：
 *   action: 'save' | 'get'（默认 'save'）
 *   userInfo: { nickName, avatarUrl, gender, ... }（可选）
 *   maxLevel: number（当前闯到第几关）
 *   levelProgress: Array<{ unlocked, stars }>（完整关卡进度，可选）
 *
 * 数据库集合：user_progress
 * 文档结构：
 *   _openid: string
 *   userInfo: object
 *   maxLevel: number
 *   levelProgress: Array（完整关卡进度数据）
 *   lastLoginTime: Date
 *   createTime: Date
 *   updateCount: number
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const { action = 'save', userInfo, maxLevel, levelProgress, mode150, level, score } = event;

  const collection = db.collection('user_progress');

  try {
    // 查询操作：返回云端数据
    if (action === 'get') {
      const { data } = await collection.where({ _openid: openid }).get();
      if (data.length > 0) {
        return {
          code: 0,
          msg: 'found',
          openid,
          maxLevel: data[0].maxLevel || 1,
          levelProgress: data[0].levelProgress || null,
        };
      } else {
        return {
          code: 0,
          msg: 'not_found',
          openid,
          maxLevel: 0,
          levelProgress: null,
        };
      }
    }

    // 保存关卡最高分（仅当超过历史最高分时更新）
    if (action === 'saveScore' && level && score) {
      const { data } = await collection.where({ _openid: openid }).get();
      if (data.length > 0) {
        const doc = data[0];
        const scores = doc.levelScores || {};
        const oldBest = scores[`lv${level}`] || 0;
        if (score > oldBest) {
          scores[`lv${level}`] = score;
          await collection.doc(doc._id).update({
            data: { levelScores: scores },
          });
        }
        return { code: 0, msg: 'score_saved', level, score, oldBest };
      } else {
        // 新用户
        const scores = {};
        scores[`lv${level}`] = score;
        await collection.add({
          data: {
            _openid: openid,
            levelScores: scores,
            maxLevel: level,
            lastLoginTime: db.serverDate(),
            createTime: db.serverDate(),
            updateCount: 0,
          },
        });
        return { code: 0, msg: 'score_created', level, score };
      }
    }

    // 保存操作
    const { data } = await collection.where({ _openid: openid }).get();

    if (data.length > 0) {
      // 已有记录 → 更新
      const doc = data[0];
      const updateData = {
        lastLoginTime: db.serverDate(),
        updateCount: (doc.updateCount || 0) + 1,
      };

      if (userInfo) {
        updateData.userInfo = userInfo;
      }

      // 更新最高关卡（只升不降）
      if (maxLevel && maxLevel > (doc.maxLevel || 0)) {
        updateData.maxLevel = maxLevel;
      }

      // 更新完整关卡进度
      if (levelProgress) {
        updateData.levelProgress = levelProgress;
      }

      // 更新150球模式成绩（保留最高分）
      if (mode150) {
        const oldBest = doc.mode150BestScore || 0;
        if (mode150.score > oldBest) {
          updateData.mode150BestScore = mode150.score;
          updateData.mode150BestTime = mode150.time;
          updateData.mode150LastRecord = mode150;
        }
      }

      await collection.doc(doc._id).update({ data: updateData });

      return {
        code: 0,
        msg: 'updated',
        openid,
        maxLevel: Math.max(maxLevel || 0, doc.maxLevel || 0),
      };
    } else {
      // 新用户 → 创建记录
      await collection.add({
        data: {
          _openid: openid,
          userInfo: userInfo || null,
          maxLevel: maxLevel || 1,
          levelProgress: levelProgress || null,
          lastLoginTime: db.serverDate(),
          createTime: db.serverDate(),
          updateCount: 0,
        },
      });

      return {
        code: 0,
        msg: 'created',
        openid,
        maxLevel: maxLevel || 1,
      };
    }
  } catch (err) {
    return {
      code: -1,
      msg: err.message || 'unknown error',
      openid,
    };
  }
};
