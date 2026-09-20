/**
 * 数据迁移：把扁平 Category 排成 KnowledgeArea → 子分类 → 叶子 的两层结构
 * 
 * 步骤：
 * 1. 把未归类的 20 个分类挂到正确的 KnowledgeArea
 * 2. 创建子分类容器 Category
 * 3. 把叶子分类挂到子分类下
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  console.log('=== Step 1: 先看看现状 ===');
  const areas = await p.knowledgeArea.findMany({ orderBy: { order: 'asc' } });
  const areaMap = new Map(areas.map((a) => [a.name, a.id]));
  const cats = await p.category.findMany();
  const catByName = new Map(cats.map((c) => [c.name, c]));
  console.log('Areas:', areas.map(a => `${a.name}(${a.id.slice(-4)})`).join(', '));
  console.log('Total cats:', cats.length);

  /* ========== Step 2: 把未归类的挂到正确 Area ========== */
  console.log('\n=== Step 2: 给未归类分类分配 Area ===');
  
  const areaAssignments = {
    '交易心得': '交易手法',
    '规律': '交易技术',
    '重要事件': '其他知识',
    '具体交易': '交易手法',
    '吐槽': '其他知识',
    '经典话': '其他知识',
    '人生感悟': '个人成长',
    '孙宇晨': '宏观市场',
    '秋生': '其他知识',
    '期待感': '交易心理',
    '供需关系消费': '宏观市场',
    '增量存量': '宏观市场',
    '人不能欺': '交易心理',
    '杂七杂八': '其他知识',
    '关注个股': '宏观市场',
    '墙哥语录': '其他知识',
    '新功能': '其他知识',
    '川子交易习惯': '交易手法',
    '孙子兵法': '个人成长',
    '两性': '个人成长',
  };

  for (const [catName, areaName] of Object.entries(areaAssignments)) {
    const cat = catByName.get(catName);
    const areaId = areaMap.get(areaName);
    if (cat && areaId && !cat.knowledgeAreaId) {
      await p.category.update({ where: { id: cat.id }, data: { knowledgeAreaId: areaId } });
      console.log(`  ✓ ${catName} → ${areaName}`);
    } else if (cat && cat.knowledgeAreaId) {
      // 已归过类，跳过
      console.log(`  · ${catName} 已有 Area`);
    } else {
      console.log(`  ✗ 找不到: ${catName}`);
    }
  }

  /* ========== Step 3: 创建子分类 + 移动叶子 ========== */
  console.log('\n=== Step 3: 创建子分类容器 + 移动叶子 ===');

  /**
   * 每个 Entry: [areaName, subCatName, memberCatNames[]]
   * subCatName 可以是已有的分类名（自动复用），或者是新的（自动创建）
   */
  const moves = [
    // 交易技术 → 技术运用
    ['交易技术', '技术运用', ['ICT技术', 'MTM各种细节', 'VWAP细节', 'POC细节', 'OBV细节', 'h顶h底', '凹凸曲线']],
    // 交易技术 → 指标说明
    ['交易技术', '指标说明', ['必看指标', '期权分析', '宏观指标', '各类标的指标细节']],
    
    // 交易手法 → Lee哥相关
    ['交易手法', 'Lee哥相关', ['LEE哥', 'lee哥交易手法']],
    // 交易手法 → 机构手法
    ['交易手法', '机构手法', ['机构操盘手法', '华尔街没有名字']],
    
    // 宏观市场 → 加密
    ['宏观市场', '加密市场', ['加密货币', '加密黑话', '孙宇晨']],
    // 宏观市场 → 其他标的
    ['宏观市场', '宏观标的', ['黄金原油', '美元利率', '税收', '供需关系消费', '增量存量', '关注个股']],
  ];

  for (const [areaName, subName, members] of moves) {
    const areaId = areaMap.get(areaName);
    if (!areaId) { console.log(`  ✗ Area 不存在: ${areaName}`); continue; }

    // 找或创建子分类
    let subCat = cats.find(c => c.name === subName && c.knowledgeAreaId === areaId);
    if (!subCat) {
      subCat = await p.category.create({
        data: { name: subName, knowledgeAreaId: areaId, color: '#654ACB' },
      });
      console.log(`  + 创建子分类: ${areaName} / ${subName} (${subCat.id.slice(-4)})`);
    } else {
      console.log(`  · 复用已有: ${areaName} / ${subName} (${subCat.id.slice(-4)})`);
    }

    // 移动成员
    for (const memberName of members) {
      const member = catByName.get(memberName);
      if (!member) { console.log(`    ✗ 找不到分类: ${memberName}`); continue; }
      if (member.parentId === subCat.id) { console.log(`    · 已是子分类: ${memberName}`); continue; }
      await p.category.update({
        where: { id: member.id },
        data: { parentId: subCat.id, knowledgeAreaId: areaId },
      });
      console.log(`    ↓ ${memberName} → ${subName}`);
    }
  }

  /* ========== Step 4: 验证结果 ========== */
  console.log('\n=== Step 4: 最终结构 ===');
  
  const finalAreas = await p.knowledgeArea.findMany({ orderBy: { order: 'asc' } });
  const finalCats = await p.category.findMany({ include: { children: true } });
  
  for (const area of finalAreas) {
    const topLevel = finalCats.filter(c => c.knowledgeAreaId === area.id && !c.parentId);
    console.log(`\n📂 ${area.name} (${topLevel.length} 个顶层)`);
    for (const cat of topLevel) {
      const children = finalCats.filter(c => c.parentId === cat.id);
      if (children.length > 0) {
        console.log(`  📁 ${cat.name} (${children.length} 子分类)`);
        for (const child of children) {
          console.log(`    📄 ${child.name}`);
        }
      } else {
        console.log(`  📄 ${cat.name} (叶子)`);
      }
    }
  }

  // 未归类的
  const unassigned = finalCats.filter(c => !c.knowledgeAreaId);
  if (unassigned.length > 0) {
    console.log(`\n⚠️ 还有 ${unassigned.length} 个未归类:`);
    unassigned.forEach(c => console.log(`  - ${c.name}`));
  }

  await p.$disconnect();
  console.log('\n✅ 完成');
})();
