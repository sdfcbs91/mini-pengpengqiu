const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

/**
 * 云函数：saveUserProgress
 * 记录用户登录时间、openid、用户信息、当前最高关卡
 *
 * 调用参数：
 *   userInfo: { nickName, avatarUrl, gender, ... } （可选，用户授权后传入）
 *   maxLevel: number （当前闯到第几关）
 *
 * 数据库集合：user_progress
 * 文档结构：
 *   _openid: string
 *   userInfo: object
 *   maxLevel: number
 *   lastLoginTime: Date
 *   createTime: Date
 *   updateCount: number
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const { userInfo, maxLevel } = event;

  const collection = db.collection('user_progress');

  try {
    // 查找是否已有该用户记录
    const { data } = await collection.where({ _openid: openid }).get();

    if (data.length > 0) {
      // 已有记录 → 更新
      const doc = data[0];
      const updateData = {
        lastLoginTime: db.serverDate(),
        updateCount: (doc.updateCount || 0) + 1,
      };

      // 更新用户信息（如果传了）
      if (userInfo) {
        updateData.userInfo = userInfo;
      }

      // 更新最高关卡（只升不降）
      if (maxLevel && maxLevel > (doc.maxLevel || 0)) {
        updateData.maxLevel = maxLevel;
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
