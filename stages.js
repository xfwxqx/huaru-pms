// 产品阶段定义（前后端共享）
// 所有阶段索引对应的阶段名称
const ALL_STAGES = [
  '图纸受控与BOM确认', // 0
  '烧录程序发布',     // 1
  '初样确认',         // 2
  '物料采购/成品采购', // 3
  '工艺受控',         // 4
  '正样确认',         // 5
  '生产组装',         // 6
  '应用程序发布',      // 7
  '配置升级',         // 8
  '成品检验',         // 9
  '打包发货'          // 10
];

// 自研产品：全部11阶段
const STAGES_SELF_DEVELOPED = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// 外购产品：图纸受控与BOM确认、初样确认(可选)、物料采购/成品采购、成品检验、打包发货
const STAGES_PURCHASED = [0, 2, 3, 9, 10];

// 自研软件：图纸受控与BOM确认、应用程序发布、成品检验、打包发货
const STAGES_SOFTWARE = [0, 7, 9, 10];

function getStagesForAttribute(attribute) {
  if (attribute === '外购产品') return STAGES_PURCHASED;
  if (attribute === '自研软件') return STAGES_SOFTWARE;
  return STAGES_SELF_DEVELOPED;
}

// 阶段是否标记为可选（初样确认）
function isOptionalStage(stageIndex) {
  return stageIndex === 2;
}

module.exports = { ALL_STAGES, STAGES_SELF_DEVELOPED, STAGES_PURCHASED, STAGES_SOFTWARE, getStagesForAttribute, isOptionalStage };
