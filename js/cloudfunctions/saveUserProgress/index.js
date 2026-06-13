const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

/**
 * 云函数：saveUserProgress
 * 记录用户登录时间、openid、用户信息、当前最高关卡、完整关卡进度、技能管理
 *
 * 调用参数：
 *   action: 'save' | 'get' | 'saveScore' | 'getSkills' | 'useSkill' | 'levelCleared'
 *   userInfo: { nickName, avatarUrl, gender, ... }（可选）
 *   maxLevel: number（当前闯到第几关）
 *   levelProgress: Array<{ unlocked, stars }>（完整关卡进度，可选）
 *   skillType: 'lightning' | 'multiBall' | 'atkBoost'（useSkill时必填）
 *
 * 技能管理：
 *   getSkills  - 获取玩家当前技能次数
 *   useSkill   - 使用技能，扣减1次（需传 skillType）
 *   levelCleared - 记录通关次数，每3次通关三种技能各+1
 *
 * 数据库集合：user_progress
 * 文档结构：
 *   _openid: string
 *   userInfo: object
 *   maxLevel: number
 *   levelProgress: Array（完整关卡进度数据，含 score）
 *   skillLightning: number（闪电技能剩余次数）
 *   skillMultiBall: number（加球技能剩余次数）
 *   skillAtkBoost: number（保持技能剩余次数）
 *   levelClearCount: number（累计通关次数）
 *   lastLoginTime: Date
 *   createTime: Date
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const { action = 'save', userInfo, maxLevel, levelProgress, mode150, level, score, skillType } = event;

  const collection = db.collection('user_progress');

  try {
    // ====== 技能管理：获取技能次数 ======
    if (action === 'getSkills') {
      const { data } = await collection.where({ _openid: openid }).get();
      if (data.length > 0) {
        const doc = data[0];
        return {
          code: 0,
          msg: 'skills_found',
          skills: {
            lightning: doc.skillLightning || 0,
            multiBall: doc.skillMultiBall || 0,
            atkBoost: doc.skillAtkBoost || 0,
          },
          levelClearCount: doc.levelClearCount || 0,
        };
      } else {
        return {
          code: 0,
          msg: 'skills_not_found',
          skills: { lightning: 0, multiBall: 0, atkBoost: 0 },
          levelClearCount: 0,
        };
      }
    }

    // ====== 技能管理：使用技能（扣减1次） ======
    if (action === 'useSkill' && skillType) {
      const fieldMap = {
        lightning: 'skillLightning',
        multiBall: 'skillMultiBall',
        atkBoost: 'skillAtkBoost',
      };
      const field = fieldMap[skillType];
      if (!field) {
        return { code: -1, msg: 'invalid_skill_type', skillType };
      }

      const { data } = await collection.where({ _openid: openid }).get();
      if (data.length > 0) {
        const doc = data[0];
        const current = doc[field] || 0;
        if (current <= 0) {
          return { code: -1, msg: 'skill_insufficient', skillType, current: 0 };
        }
        await collection.doc(doc._id).update({
          data: { [field]: current - 1 },
        });
        return { code: 0, msg: 'skill_used', skillType, remaining: current - 1 };
      } else {
        return { code: -1, msg: 'user_not_found' };
      }
    }

    // ====== 技能管理：通关奖励（每通过3次关卡，三种技能各+1） ======
    if (action === 'levelCleared') {
      const { data } = await collection.where({ _openid: openid }).get();
      if (data.length > 0) {
        const doc = data[0];
        const oldCount = doc.levelClearCount || 0;
        const newCount = oldCount + 1;
        const updateData = { levelClearCount: newCount };

        // 每3次通关，三种技能各+1
        let rewarded = false;
        if (Math.floor(newCount / 3) > Math.floor(oldCount / 3)) {
          updateData.skillLightning = (doc.skillLightning || 0) + 1;
          updateData.skillMultiBall = (doc.skillMultiBall || 0) + 1;
          updateData.skillAtkBoost = (doc.skillAtkBoost || 0) + 1;
          rewarded = true;
        }

        await collection.doc(doc._id).update({ data: updateData });
        return {
          code: 0,
          msg: rewarded ? 'level_cleared_rewarded' : 'level_cleared',
          levelClearCount: newCount,
          rewarded,
          skills: rewarded ? {
            lightning: (doc.skillLightning || 0) + 1,
            multiBall: (doc.skillMultiBall || 0) + 1,
            atkBoost: (doc.skillAtkBoost || 0) + 1,
          } : {
            lightning: doc.skillLightning || 0,
            multiBall: doc.skillMultiBall || 0,
            atkBoost: doc.skillAtkBoost || 0,
          },
        };
      } else {
        // 新用户：创建记录并记录第1次通关
        await collection.add({
          data: {
            _openid: openid,
            levelClearCount: 1,
            skillLightning: 0,
            skillMultiBall: 0,
            skillAtkBoost: 0,
            lastLoginTime: db.serverDate(),
            createTime: db.serverDate(),
          },
        });
        return {
          code: 0,
          msg: 'level_cleared',
          levelClearCount: 1,
          rewarded: false,
          skills: { lightning: 0, multiBall: 0, atkBoost: 0 },
        };
      }
    }

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
          skills: {
            lightning: data[0].skillLightning || 0,
            multiBall: data[0].skillMultiBall || 0,
            atkBoost: data[0].skillAtkBoost || 0,
          },
          levelClearCount: data[0].levelClearCount || 0,
        };
      } else {
        return {
          code: 0,
          msg: 'not_found',
          openid,
          maxLevel: 0,
          levelProgress: null,
          skills: { lightning: 0, multiBall: 0, atkBoost: 0 },
          levelClearCount: 0,
        };
      }
    }

    // 保存关卡最高分（存入 levelProgress 对应关卡的 score + scoreTime）
    if (action === 'saveScore' && level && score) {
      const { data } = await collection.where({ _openid: openid }).get();
      if (data.length > 0) {
        const doc = data[0];
        let progress = doc.levelProgress;
        if (!progress || !Array.isArray(progress)) {
          progress = [];
        }
        const idx = level - 1;
        // 确保数组长度足够
        while (progress.length <= idx) {
          progress.push({ unlocked: false, stars: 0 });
        }
        const oldBest = progress[idx].score || 0;
        if (score > oldBest) {
          progress[idx].score = score;
          progress[idx].scoreTime = new Date().toISOString();
          await collection.doc(doc._id).update({
            data: { levelProgress: progress },
          });
          return { code: 0, msg: 'score_updated', level, score, oldBest };
        }
        return { code: 0, msg: 'score_not_higher', level, score, oldBest };
      } else {
        // 新用户：创建记录
        const progress = [];
        for (let i = 0; i < level; i++) {
          progress.push({ unlocked: i === 0, stars: 0 });
        }
        progress[level - 1].score = score;
        progress[level - 1].scoreTime = new Date().toISOString();
        await collection.add({
          data: {
            _openid: openid,
            levelProgress: progress,
            maxLevel: level,
            lastLoginTime: db.serverDate(),
            createTime: db.serverDate(),
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
      };

      // 合并 userInfo，只更新有值的字段（避免覆盖原有数据）
      if (userInfo) {
        const existingUserInfo = doc.userInfo || {};
        const mergedUserInfo = { ...existingUserInfo };

        // 只更新有值的字段
        if (userInfo.nickName !== undefined && userInfo.nickName !== '') {
          mergedUserInfo.nickName = userInfo.nickName;
        }
        if (userInfo.avatarUrl !== undefined && userInfo.avatarUrl !== '') {
          mergedUserInfo.avatarUrl = userInfo.avatarUrl;
        }

        updateData.userInfo = mergedUserInfo;
      }

      // 更新最高关卡（只升不降）
      if (maxLevel && maxLevel > (doc.maxLevel || 0)) {
        updateData.maxLevel = maxLevel;
      }

      // 更新完整关卡进度（合并：保留云端的 score/scoreTime 不被覆盖）
      if (levelProgress) {
        const existingProgress = doc.levelProgress || [];
        const merged = levelProgress.map((item, idx) => {
          const existing = existingProgress[idx];
          const result = { ...item };
          // 保留云端已有的 score 和 scoreTime
          if (existing && existing.score) {
            result.score = existing.score;
            result.scoreTime = existing.scoreTime;
          }
          return result;
        });
        updateData.levelProgress = merged;
      }

      // 更新150球模式成绩（保留最高分，含 score + scoreTime）
      if (mode150) {
        const oldBest = doc.mode150BestScore || 0;
        if (mode150.score > oldBest) {
          updateData.mode150BestScore = mode150.score;
          updateData.mode150BestTime = mode150.time;
          updateData.mode150ScoreTime = new Date().toISOString();
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
