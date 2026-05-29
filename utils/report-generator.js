/**
 * 测试看板分析报告生成模块
 * 使用 docx (docx-js) 库生成 .docx 格式的 Word 报告
 *
 * 导出函数: generateReport(records) => Buffer
 */

const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  WidthType,
  BorderStyle,
  ShadingType,
  Footer,
  PageNumber,
  PageBreak,
  SectionType,
  convertInchesToTwip,
} = require('docx');

// ============================================================================
// 常量定义
// ============================================================================

/** 基础字体配置：西文 Arial，中文 Microsoft YaHei */
const FONT = { ascii: 'Arial', hAnsi: 'Arial', eastAsia: 'Microsoft YaHei' };

/** 正文基础字号：21 half-points ≈ 10.5pt */
const BODY_SIZE = 21;

/** 标题 H2 字号：32 half-points ≈ 16pt */
const H2_SIZE = 32;

/** 封面标题字号：52 half-points ≈ 26pt */
const COVER_TITLE_SIZE = 52;

/** 封面副标题字号：28 half-points ≈ 14pt */
const COVER_SUB_SIZE = 28;

/** 表格边框颜色 */
const BORDER_COLOR = '999999';

/** 表头背景色 */
const HEADER_FILL = 'D5E8F0';

/** 表格边框定义 */
const TABLE_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  left: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  right: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  insideVertical: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
};

/** 表头单元格底纹 */
const HEADER_SHADING = { type: ShadingType.CLEAR, fill: HEADER_FILL };

/** 单元格边距 (单位: twips) */
const CELL_MARGINS = {
  top: convertInchesToTwip(0.05),
  bottom: convertInchesToTwip(0.05),
  left: convertInchesToTwip(0.08),
  right: convertInchesToTwip(0.08),
};

// ============================================================================
// 辅助函数：构建文档元素
// ============================================================================

/**
 * 创建 H2 标题段落
 * @param {string} text - 标题文本
 * @returns {Paragraph}
 */
function createHeading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 160 },
    children: [
      new TextRun({
        text,
        font: FONT,
        size: H2_SIZE,
        bold: true,
      }),
    ],
  });
}

/**
 * 创建正文段落
 * @param {string} text - 段落文本
 * @param {object} [opts={}] - 额外选项
 * @returns {Paragraph}
 */
function createParagraph(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    ...opts,
    children: [
      new TextRun({
        text,
        font: FONT,
        size: opts.size || BODY_SIZE,
        bold: opts.bold || false,
        color: opts.color || undefined,
      }),
    ],
  });
}

/**
 * 创建多段文本的段落（支持不同格式的文本片段）
 * @param {Array<{text: string, bold?: boolean, color?: string, size?: number}>} runs
 * @param {object} [opts={}]
 * @returns {Paragraph}
 */
function createRichParagraph(runs, opts = {}) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    ...opts,
    children: runs.map(
      (r) =>
        new TextRun({
          text: r.text,
          font: FONT,
          size: r.size || BODY_SIZE,
          bold: r.bold || false,
          color: r.color || undefined,
        })
    ),
  });
}

/**
 * 创建表头单元格
 * @param {string} text - 单元格文本
 * @param {number} widthPercent - 列宽百分比
 * @param {string} [align='center'] - 对齐方式
 * @param {object} [opts={}] - 额外选项
 * @returns {TableCell}
 */
function createHeaderCell(text, widthPercent, align = 'center', opts = {}) {
  const margins = opts.margins || CELL_MARGINS;
  const spacing = opts.compact ? { before: 20, after: 20 } : { before: 40, after: 40 };
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    shading: HEADER_SHADING,
    margins: margins,
    verticalAlign: 'center',
    children: [
      new Paragraph({
        alignment: align === 'center'
          ? AlignmentType.CENTER
          : align === 'right'
            ? AlignmentType.RIGHT
            : AlignmentType.LEFT,
        spacing: spacing,
        children: [
          new TextRun({
            text,
            font: FONT,
            size: BODY_SIZE,
            bold: true,
          }),
        ],
      }),
    ],
  });
}

/**
 * 创建数据单元格
 * @param {string} text - 单元格文本
 * @param {number} widthPercent - 列宽百分比
 * @param {string} [align='center'] - 对齐方式
 * @param {object} [opts={}] - 额外选项
 * @returns {TableCell}
 */
function createDataCell(text, widthPercent, align = 'center', opts = {}) {
  const margins = opts.margins || CELL_MARGINS;
  const spacing = opts.compact ? { before: 20, after: 20 } : { before: 40, after: 40 };
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    margins: margins,
    verticalAlign: 'center',
    children: [
      new Paragraph({
        alignment: align === 'center'
          ? AlignmentType.CENTER
          : align === 'right'
            ? AlignmentType.RIGHT
            : AlignmentType.LEFT,
        spacing: spacing,
        children: [
          new TextRun({
            text: String(text != null ? text : ''),
            font: FONT,
            size: BODY_SIZE,
            bold: opts.bold || false,
            color: opts.color || undefined,
          }),
        ],
      }),
    ],
  });
}

/**
 * 创建表格行（带 cantSplit）
 * @param {TableCell[]} cells - 单元格数组
 * @returns {TableRow}
 */
function createTableRow(cells) {
  return new TableRow({
    cantSplit: true,
    children: cells,
  });
}

/**
 * 根据总列数平均分配列宽并创建表格
 * @param {string[]} headers - 表头文本数组
 * @param {string[][]} data - 数据行数组（每行为字符串数组）
 * @param {object} [opts={}] - 选项
 * @param {number[]} [opts.colWidths] - 自定义列宽百分比数组（总和应为100）
 * @param {string[]} [opts.aligns] - 每列对齐方式
 * @returns {Table}
 */
function createDataTable(headers, data, opts = {}) {
  const colCount = headers.length;
  const colWidths =
    opts.colWidths || headers.map(() => Math.floor(100 / colCount));
  const aligns = opts.aligns || headers.map(() => 'center');
  const compact = opts.compact || false;

  // 调整最后一列宽度，确保总和为100
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  if (totalWidth !== 100 && colWidths.length > 0) {
    colWidths[colWidths.length - 1] += 100 - totalWidth;
  }

  // 紧凑模式的单元格内边距
  const compactMargins = { top: 40, bottom: 40, left: 80, right: 80 };
  const normalMargins = CELL_MARGINS;

  // 表头行
  const headerRow = createTableRow(
    headers.map((h, i) => createHeaderCell(h, colWidths[i], aligns[i], compact ? { margins: compactMargins } : {}))
  );

  // 数据行
  const dataRows = data.map((row) =>
    createTableRow(
      row.map((cell, i) =>
        createDataCell(cell, colWidths[i], aligns[i], compact ? { margins: compactMargins, compact: true } : {})
      )
    )
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TABLE_BORDERS,
    rows: [headerRow, ...dataRows],
  });
}

// ============================================================================
// 数据预处理与解析
// ============================================================================

/**
 * 解析测试时长，支持字符串（如 "5天"）或数字
 * @param {string|number} val
 * @returns {number}
 */
function parseDuration(val) {
  if (typeof val === 'number') return val;
  if (val == null) return 0;
  const match = String(val).match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * 安全转数字
 * @param {*} val
 * @returns {number}
 */
function toNum(val) {
  if (typeof val === 'number') return val;
  if (val == null || val === '') return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

// ============================================================================
// 第1节：缺陷等级分布分析
// ============================================================================

function buildSection1(records) {
  const children = [];

  // 汇总各级别数量
  let totalSevere = 0;
  let totalMajor = 0;
  let totalMinor = 0;
  let totalSuggestion = 0;

  // 统计涉及版本数（该等级 > 0 的记录数）
  let severeVersions = 0;
  let majorVersions = 0;
  let minorVersions = 0;
  let suggestionVersions = 0;

  for (const r of records) {
    const s = toNum(r['严重问题']);
    const m = toNum(r['重要问题']);
    const mi = toNum(r['轻微问题']);
    const su = toNum(r['建议问题']);

    totalSevere += s;
    totalMajor += m;
    totalMinor += mi;
    totalSuggestion += su;

    if (s > 0) severeVersions++;
    if (m > 0) majorVersions++;
    if (mi > 0) minorVersions++;
    if (su > 0) suggestionVersions++;
  }

  const totalBugs = totalSevere + totalMajor + totalMinor + totalSuggestion;
  const totalRecords = records.length;

  const pct = (count) =>
    totalBugs > 0 ? ((count / totalBugs) * 100).toFixed(1) + '%' : '0.0%';

  // 版本占比：涉及版本数 / 总记录数
  const versionPct = (count) =>
    totalRecords > 0 ? ((count / totalRecords) * 100).toFixed(1) + '%' : '0.0%';

  // 单版本平均：总数量 / 涉及版本数
  const avgPerVersion = (count, versions) =>
    versions > 0 ? (count / versions).toFixed(1) : '0.0';

  children.push(createHeading2('一、缺陷等级分布分析'));

  // 表格
  const severityTable = createDataTable(
    ['缺陷等级', '数量', '占比', '涉及版本数', '版本占比', '单版本平均'],
    [
      ['严重', String(totalSevere), pct(totalSevere), String(severeVersions), versionPct(severeVersions), avgPerVersion(totalSevere, severeVersions)],
      ['重要', String(totalMajor), pct(totalMajor), String(majorVersions), versionPct(majorVersions), avgPerVersion(totalMajor, majorVersions)],
      ['轻微', String(totalMinor), pct(totalMinor), String(minorVersions), versionPct(minorVersions), avgPerVersion(totalMinor, minorVersions)],
      ['建议', String(totalSuggestion), pct(totalSuggestion), String(suggestionVersions), versionPct(suggestionVersions), avgPerVersion(totalSuggestion, suggestionVersions)],
      ['合计', String(totalBugs), '100.0%', String(totalRecords), '100.0%', avgPerVersion(totalBugs, totalRecords)],
    ],
    { colWidths: [14, 12, 12, 16, 16, 16] }
  );
  children.push(severityTable);

  // 汇总文字
  const maxSeverity =
    totalSevere >= totalMajor && totalSevere >= totalMinor && totalSevere >= totalSuggestion
      ? '严重'
      : totalMajor >= totalMinor && totalMajor >= totalSuggestion
        ? '重要'
        : totalMinor >= totalSuggestion
          ? '轻微'
          : '建议';

  let summaryText = `本次统计共涉及 ${totalRecords} 条测试记录，BUG 总数为 ${totalBugs} 个。`;
  summaryText += `其中严重问题 ${totalSevere} 个（${pct(totalSevere)}），涉及 ${severeVersions} 个版本（${versionPct(severeVersions)}），单版本平均 ${avgPerVersion(totalSevere, severeVersions)} 个；`;
  summaryText += `重要问题 ${totalMajor} 个（${pct(totalMajor)}），涉及 ${majorVersions} 个版本（${versionPct(majorVersions)}），单版本平均 ${avgPerVersion(totalMajor, majorVersions)} 个；`;
  summaryText += `轻微问题 ${totalMinor} 个（${pct(totalMinor)}），涉及 ${minorVersions} 个版本（${versionPct(minorVersions)}），单版本平均 ${avgPerVersion(totalMinor, minorVersions)} 个；`;
  summaryText += `建议问题 ${totalSuggestion} 个（${pct(totalSuggestion)}），涉及 ${suggestionVersions} 个版本（${versionPct(suggestionVersions)}），单版本平均 ${avgPerVersion(totalSuggestion, suggestionVersions)} 个。`;
  summaryText += `缺陷等级主要集中在"${maxSeverity}"级别，`;
  if (totalSevere > 0) {
    summaryText += `严重问题占比 ${pct(totalSevere)}，涉及 ${severeVersions} 个版本，需引起高度重视并及时修复。`;
  } else {
    summaryText += `无明显严重问题，整体缺陷严重程度可控。`;
  }

  children.push(createParagraph(summaryText));

  return children;
}

// ============================================================================
// 第2节：严重问题版本详情
// ============================================================================

function buildSection2(records) {
  const children = [];

  // 筛选有严重问题的记录
  const severeRecords = records
    .filter((r) => toNum(r['严重问题']) > 0)
    .map((r) => ({
      项目: r['项目'] || '',
      产品名称: r['产品名称'] || '',
      版本号: r['版本号'] || '',
      严重问题数: toNum(r['严重问题']),
      备注: r['备注'] || '',
    }))
    .sort((a, b) => b.严重问题数 - a.严重问题数);

  children.push(createHeading2('二、严重问题版本详情'));

  if (severeRecords.length === 0) {
    children.push(
      createParagraph('本次统计中无严重问题版本，所有版本的测试质量良好。')
    );
    return children;
  }

  // 表格
  const tableData = severeRecords.map((r) => [
    r.项目,
    r.产品名称,
    r.版本号,
    String(r.严重问题数),
    r.备注,
  ]);

  const table = createDataTable(
    ['项目', '产品名称', '版本号', '严重问题数', '备注'],
    tableData,
    { colWidths: [8, 12, 10, 8, 62], aligns: ['left', 'left', 'left', 'center', 'left'], compact: true }
  );
  children.push(table);

  // 汇总
  const totalSevere = severeRecords.reduce((s, r) => s + r.严重问题数, 0);
  const summaryText = `共有 ${severeRecords.length} 个版本存在严重问题，严重问题总数为 ${totalSevere} 个。`
    + `其中严重问题数最多的版本为"${severeRecords[0].产品名称} ${severeRecords[0].版本号}"，共 ${severeRecords[0].严重问题数} 个严重问题。`
    + `建议优先对这些版本进行回归测试和问题修复。`;

  children.push(createParagraph(summaryText));

  return children;
}

// ============================================================================
// 第3节：BUG数量分布（按区间）
// ============================================================================

function buildSection3(records) {
  const children = [];
  children.push(createHeading2('三、BUG数量分布'));

  // 按 BUG 数量区间统计版本数
  const ranges = [
    { label: '0个', min: 0, max: 0, count: 0 },
    { label: '1-2个', min: 1, max: 2, count: 0 },
    { label: '3-4个', min: 3, max: 4, count: 0 },
    { label: '5-9个', min: 5, max: 9, count: 0 },
    { label: '10个及以上', min: 10, max: Infinity, count: 0 },
  ];

  for (const r of records) {
    const bugs = toNum(r['BUG总数']);
    for (const range of ranges) {
      if (range.max === Infinity) {
        if (bugs >= range.min) {
          range.count++;
          break;
        }
      } else {
        if (bugs >= range.min && bugs <= range.max) {
          range.count++;
          break;
        }
      }
    }
  }

  const total = records.length;
  const pctStr = (c) => (total > 0 ? ((c / total) * 100).toFixed(1) + '%' : '0.0%');

  const tableData = ranges.map((r) => [r.label, String(r.count), pctStr(r.count)]);

  const table = createDataTable(
    ['BUG区间', '版本数量', '占比'],
    tableData,
    { colWidths: [35, 30, 35] }
  );
  children.push(table);

  // 汇总
  const sorted = [...ranges].sort((a, b) => b.count - a.count);
  const maxRange = sorted[0];
  const zeroBugs = ranges[0].count;
  const highBugs = ranges[4].count;

  let summaryText = `按 BUG 数量区间统计，共 ${total} 个版本。`;
  summaryText += `其中 BUG 数量为 0 的版本有 ${zeroBugs} 个（${pctStr(zeroBugs)}），`;
  summaryText += `BUG 数量在 10 个及以上的版本有 ${highBugs} 个（${pctStr(highBugs)}）。`;
  summaryText += `大多数版本集中在"${maxRange.label}"区间，共 ${maxRange.count} 个版本（${pctStr(maxRange.count)}）。`;
  if (highBugs > 0) {
    summaryText += `存在 ${highBugs} 个高 BUG 数量版本，建议重点关注这些版本的质量问题。`;
  } else {
    summaryText += `整体 BUG 数量分布较为均匀，无异常高缺陷版本。`;
  }

  children.push(createParagraph(summaryText));

  return children;
}

// ============================================================================
// 第4节：测试时长分布
// ============================================================================

function buildSection4(records) {
  const children = [];
  children.push(createHeading2('四、测试时长分布'));

  // 新的分类区间
  const ranges = [
    { label: '1天内', min: 0, max: 1, count: 0 },
    { label: '1-2天', min: 1, max: 2, count: 0 },
    { label: '2-3天', min: 2, max: 3, count: 0 },
    { label: '3-5天', min: 3, max: 5, count: 0 },
    { label: '5-10天', min: 5, max: 10, count: 0 },
    { label: '10天及以上', min: 10, max: Infinity, count: 0 },
  ];

  for (const r of records) {
    const dur = parseDuration(r['测试时长']);
    for (const range of ranges) {
      if (range.max === Infinity) {
        if (dur >= range.min) {
          range.count++;
          break;
        }
      } else {
        if (dur > range.min && dur <= range.max) {
          range.count++;
          break;
        }
      }
    }
  }

  const total = records.length;
  const pctStr = (c) => (total > 0 ? ((c / total) * 100).toFixed(1) + '%' : '0.0%');

  const tableData = ranges.map((r) => [r.label, String(r.count), pctStr(r.count)]);

  const table = createDataTable(
    ['时长区间', '版本数量', '占比'],
    tableData,
    { colWidths: [35, 30, 35] }
  );
  children.push(table);

  // 汇总
  const durations = records.map((r) => parseDuration(r['测试时长'])).filter((d) => d > 0);
  const avgDur =
    durations.length > 0
      ? (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1)
      : '0';
  const maxDur = durations.length > 0 ? Math.max(...durations).toFixed(1) : '0';
  const minDur = durations.length > 0 ? Math.min(...durations).toFixed(1) : '0';

  const sorted = [...ranges].sort((a, b) => b.count - a.count);
  const maxRange = sorted[0];

  let summaryText = `测试时长分布中，平均测试时长为 ${avgDur} 天，最短 ${minDur} 天，最长 ${maxDur} 天。`;
  summaryText += `大多数测试集中在"${maxRange.label}"区间，共 ${maxRange.count} 条记录（${pctStr(maxRange.count)}）。`;
  const longTests = ranges[5].count;
  if (longTests > 0) {
    summaryText += `有 ${longTests} 个版本测试时长超过 10 天，建议对长周期测试进行专项分析，评估是否存在资源瓶颈或测试范围不合理的情况。`;
  } else {
    summaryText += `测试周期整体较为合理，无明显过长测试。`;
  }

  children.push(createParagraph(summaryText));

  return children;
}

// ============================================================================
// 第5节：项目健康度分析
// ============================================================================

function buildSection5(records) {
  const children = [];
  children.push(createHeading2('五、项目健康度分析'));

  // 按项目分组
  const projectMap = new Map();
  for (const r of records) {
    const project = r['项目'] || '未知项目';
    if (!projectMap.has(project)) {
      projectMap.set(project, {
        testItems: 0,
        totalBugs: 0,
        severe: 0,
        count: 0,
        totalDuration: 0,
      });
    }
    const p = projectMap.get(project);
    p.testItems += toNum(r['测试项总数']);
    p.totalBugs += toNum(r['BUG总数']);
    p.severe += toNum(r['严重问题']);
    p.count++;
    p.totalDuration += parseDuration(r['测试时长']);
  }

  // 按平均缺陷密度降序排列
  const sortedProjects = [...projectMap.entries()].sort(
    (a, b) => {
      const ratioA = a[1].testItems > 0 ? a[1].totalBugs / a[1].testItems : 0;
      const ratioB = b[1].testItems > 0 ? b[1].totalBugs / b[1].testItems : 0;
      return ratioB - ratioA;
    }
  );

  const tableData = sortedProjects.map(([name, p]) => {
    const avgBugsPerVersion = p.count > 0 ? (p.totalBugs / p.count).toFixed(1) : '0';
    const avgSeverePerVersion = p.count > 0 ? (p.severe / p.count).toFixed(1) : '0';
    const avgDuration = p.count > 0 ? (p.totalDuration / p.count).toFixed(1) : '0';
    const defectDensity = p.testItems > 0 ? (p.totalBugs / p.testItems).toFixed(3) : '0';
    return [
      name,
      String(p.count),
      String(p.totalBugs),
      avgBugsPerVersion,
      String(p.severe),
      avgSeverePerVersion,
      avgDuration,
      defectDensity,
    ];
  });

  const table = createDataTable(
    ['项目', '总版本数', '总BUG数', '单版本平均BUG数', '总严重问题数', '单版本平均严重问题数', '平均测试时长', '平均缺陷密度'],
    tableData,
    { colWidths: [14, 10, 10, 14, 14, 16, 12, 12] }
  );
  children.push(table);

  // 汇总
  const worstProject = sortedProjects[0];
  const bestProject = sortedProjects[sortedProjects.length - 1];

  let summaryText = `项目健康度分析基于缺陷密度（BUG总数/测试项总数）和版本平均 BUG 数进行评估。`;
  summaryText += `共涉及 ${projectMap.size} 个项目。`;
  if (worstProject) {
    const worstRatio = worstProject[1].testItems > 0 ? (worstProject[1].totalBugs / worstProject[1].testItems).toFixed(3) : '0';
    summaryText += `缺陷密度最高的项目为"${worstProject[0]}"（缺陷密度 ${worstRatio}），`;
    summaryText += `总 BUG 数 ${worstProject[1].totalBugs} 个，严重问题 ${worstProject[1].severe} 个，建议重点关注并加强质量管控。`;
  }
  if (bestProject && bestProject[0] !== worstProject?.[0]) {
    const bestRatio = bestProject[1].testItems > 0 ? (bestProject[1].totalBugs / bestProject[1].testItems).toFixed(3) : '0';
    summaryText += `缺陷密度最低的项目为"${bestProject[0]}"（缺陷密度 ${bestRatio}），质量表现较好。`;
  }

  children.push(createParagraph(summaryText));

  return children;
}

// ============================================================================
// 第6节：测试人员能力画像
// ============================================================================

function buildSection6(records) {
  const children = [];
  children.push(createHeading2('六、测试人员能力画像'));

  // 按测试人员分组
  const testerMap = new Map();
  for (const r of records) {
    const tester = r['测试人员'] || '未知';
    if (!testerMap.has(tester)) {
      testerMap.set(tester, {
        count: 0,
        testItems: 0,
        totalBugs: 0,
        severeBugs: 0,
        totalDuration: 0,
      });
    }
    const t = testerMap.get(tester);
    t.count++;
    t.testItems += toNum(r['测试项总数']);
    t.totalBugs += toNum(r['BUG总数']);
    t.severeBugs += toNum(r['严重问题']);
    t.totalDuration += parseDuration(r['测试时长']);
  }

  // 按负责版本数降序排列
  const sortedTesters = [...testerMap.entries()].sort(
    (a, b) => b[1].count - a[1].count
  );

  const tableData = sortedTesters.map(([name, t]) => {
    const avgBugsPerVersion = t.count > 0 ? (t.totalBugs / t.count).toFixed(1) : '0';
    const avgSeverePerVersion = t.count > 0 ? (t.severeBugs / t.count).toFixed(1) : '0';
    const avgDuration = t.count > 0 ? (t.totalDuration / t.count).toFixed(1) : '0';
    const defectDensity = t.testItems > 0 ? (t.totalBugs / t.testItems).toFixed(3) : '0';
    return [
      name,
      String(t.count),
      String(t.testItems),
      String(t.totalBugs),
      avgBugsPerVersion,
      String(t.severeBugs),
      avgSeverePerVersion,
      avgDuration,
      defectDensity,
    ];
  });

  const table = createDataTable(
    ['测试人员', '负责版本数', '总测试项数', '总BUG发现数', '单版本平均BUG发现数', '严重问题发现总数', '单版本平均严重问题发现数', '平均测试时长', '平均缺陷密度'],
    tableData,
    { colWidths: [12, 10, 10, 10, 14, 12, 16, 10, 10] }
  );
  children.push(table);

  // 汇总
  let summaryText = `共有 ${testerMap.size} 名测试人员参与测试工作。`;
  const topTester = sortedTesters[0];
  if (topTester) {
    const avgBugs = topTester[1].count > 0 ? (topTester[1].totalBugs / topTester[1].count).toFixed(1) : '0';
    summaryText += `负责版本数最多的测试人员为"${topTester[0]}"，共负责 ${topTester[1].count} 个版本，`;
    summaryText += `总发现 BUG ${topTester[1].totalBugs} 个（其中严重 ${topTester[1].severeBugs} 个），单版本平均发现 ${avgBugs} 个 BUG。`;
  }
  // 找到缺陷密度最高的测试人员
  const sortedByDensity = [...sortedTesters].sort((a, b) => {
    const ratioA = a[1].testItems > 0 ? a[1].totalBugs / a[1].testItems : 0;
    const ratioB = b[1].testItems > 0 ? b[1].totalBugs / b[1].testItems : 0;
    return ratioB - ratioA;
  });
  const topDensity = sortedByDensity[0];
  if (topDensity) {
    const density = topDensity[1].testItems > 0 ? (topDensity[1].totalBugs / topDensity[1].testItems).toFixed(3) : '0';
    summaryText += `缺陷密度最高的测试人员为"${topDensity[0]}"（缺陷密度 ${density}），展现出较强的缺陷发现能力。`;
  }

  children.push(createParagraph(summaryText));

  return children;
}

// ============================================================================
// 第7节：转测人员交付质量
// ============================================================================

function buildSection7(records) {
  const children = [];
  children.push(createHeading2('七、转测人员交付质量'));

  // 转测人员 = 转测人员字段（不是测试人员）
  const transferMap = new Map();
  for (const r of records) {
    const transfer = r['转测人员'] || '未知';
    if (!transferMap.has(transfer)) {
      transferMap.set(transfer, {
        count: 0,
        totalBugs: 0,
        severeBugs: 0,
      });
    }
    const t = transferMap.get(transfer);
    t.count++;
    t.totalBugs += toNum(r['BUG总数']);
    t.severeBugs += toNum(r['严重问题']);
  }

  // 按交付版本数降序排列
  const sortedTransfers = [...transferMap.entries()].sort(
    (a, b) => b[1].count - a[1].count
  );

  const tableData = sortedTransfers.map(([name, t]) => {
    const avgBugsPerVersion = t.count > 0 ? (t.totalBugs / t.count).toFixed(1) : '0';
    const avgSeverePerVersion = t.count > 0 ? (t.severeBugs / t.count).toFixed(1) : '0';
    return [
      name,
      String(t.count),
      String(t.totalBugs),
      avgBugsPerVersion,
      String(t.severeBugs),
      avgSeverePerVersion,
    ];
  });

  const table = createDataTable(
    ['转测人员', '交付版本数', '总BUG数', '单版本平均BUG数', '总严重问题数', '单版本平均严重问题数'],
    tableData,
    { colWidths: [18, 16, 14, 16, 16, 16] }
  );
  children.push(table);

  // 汇总
  let summaryText = `转测人员交付质量分析基于 BUG 数量和严重问题数量进行评估。`;
  summaryText += `共涉及 ${transferMap.size} 名转测人员。`;

  // 找到单版本平均 BUG 数最高的
  const sortedByAvgBugs = [...sortedTransfers].sort((a, b) => {
    const avgA = a[1].count > 0 ? a[1].totalBugs / a[1].count : 0;
    const avgB = b[1].count > 0 ? b[1].totalBugs / b[1].count : 0;
    return avgB - avgA;
  });
  const worstDelivery = sortedByAvgBugs[0];
  if (worstDelivery) {
    const avgBugs = worstDelivery[1].count > 0 ? (worstDelivery[1].totalBugs / worstDelivery[1].count).toFixed(1) : '0';
    summaryText += `单版本平均 BUG 数最高的转测人员为"${worstDelivery[0]}"（平均 ${avgBugs} 个/版本），`;
    summaryText += `建议加强自测环节和代码审查。`;
  }

  const bestDelivery = sortedByAvgBugs[sortedByAvgBugs.length - 1];
  if (bestDelivery && bestDelivery[0] !== worstDelivery?.[0]) {
    const avgBugs = bestDelivery[1].count > 0 ? (bestDelivery[1].totalBugs / bestDelivery[1].count).toFixed(1) : '0';
    summaryText += `交付质量较好的转测人员为"${bestDelivery[0]}"（平均 ${avgBugs} 个/版本）。`;
  }

  children.push(createParagraph(summaryText));

  return children;
}

// ============================================================================
// 第8节：高频问题关键词统计
// ============================================================================

function buildSection8(records) {
  const children = [];
  children.push(createHeading2('八、高频问题关键词统计'));

  // 从备注列中提取关键词
  const keywordMap = new Map();

  for (const r of records) {
    const remark = r['备注'] || '';
    if (!remark.trim()) continue;

    // 按常见分隔符和标点拆分，提取问题描述中的关键词
    // 匹配中文词汇、英文单词、数字组合
    const parts = remark
      .replace(/[\d\.]+/g, ' ') // 移除数字编号如 1. 2.
      .split(/[、，,；;。\.\/\\\-_\(\)（）\[\]【】\n\r]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2 && s.length <= 20); // 过滤太短或太长的

    for (const part of parts) {
      // 清理关键词，移除前后空格和无意义字符
      const keyword = part.replace(/^[\s\d\.]+|[\s\d\.]+$/g, '').trim();
      if (keyword.length < 2) continue;
      // 跳过纯数字、纯标点、常见无意义词
      if (/^[\d\s\.]+$/.test(keyword)) continue;
      if (/^(问题|严重|重要|轻微|建议|测试|版本|备注|bug|BUG)$/i.test(keyword)) continue;
      keywordMap.set(keyword, (keywordMap.get(keyword) || 0) + 1);
    }
  }

  // 按出现次数降序排序，取 Top 20
  const topKeywords = [...keywordMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  if (topKeywords.length === 0) {
    children.push(
      createParagraph('本次统计中未从备注列中提取到有效关键词。')
    );
    return children;
  }

  const tableData = topKeywords.map(([keyword, count]) => [
    keyword,
    String(count),
  ]);

  const table = createDataTable(
    ['问题关键词', '出现次数'],
    tableData,
    { colWidths: [50, 50], aligns: ['left', 'center'] }
  );
  children.push(table);

  // 汇总
  let summaryText = `从备注列中提取高频问题关键词，共发现 ${keywordMap.size} 个不同关键词。`;
  summaryText += `出现频率最高的前 5 个关键词为：`;
  for (let i = 0; i < Math.min(5, topKeywords.length); i++) {
    summaryText += `"${topKeywords[i][0]}"（${topKeywords[i][1]} 次）`;
    if (i < Math.min(5, topKeywords.length) - 1) summaryText += '、';
  }
  summaryText += `。`;
  summaryText += `这些高频关键词反映了当前测试中发现的主要问题类型和故障模式，`;
  summaryText += `建议针对高频问题关键词对应的故障类型进行根因分析和预防措施制定。`;

  children.push(createParagraph(summaryText));

  return children;
}

// ============================================================================
// 第9节：产品健康度分析
// ============================================================================

function buildSection9(records) {
  const children = [];
  children.push(createHeading2('九、产品健康度分析'));

  // 按产品名称分组
  const productMap = new Map();
  for (const r of records) {
    const product = r['产品名称'] || '未知产品';
    if (!productMap.has(product)) {
      productMap.set(product, {
        project: r['项目'] || '',
        testItems: 0,
        totalBugs: 0,
        severe: 0,
        count: 0,
        totalDuration: 0,
      });
    }
    const p = productMap.get(product);
    p.testItems += toNum(r['测试项总数']);
    p.totalBugs += toNum(r['BUG总数']);
    p.severe += toNum(r['严重问题']);
    p.count++;
    p.totalDuration += parseDuration(r['测试时长']);
  }

  // 按平均缺陷密度降序排列
  const sortedProducts = [...productMap.entries()].sort(
    (a, b) => {
      const ratioA = a[1].testItems > 0 ? a[1].totalBugs / a[1].testItems : 0;
      const ratioB = b[1].testItems > 0 ? b[1].totalBugs / b[1].testItems : 0;
      return ratioB - ratioA;
    }
  );

  const tableData = sortedProducts.map(([name, p]) => {
    const avgBugsPerVersion = p.count > 0 ? (p.totalBugs / p.count).toFixed(1) : '0';
    const avgSeverePerVersion = p.count > 0 ? (p.severe / p.count).toFixed(1) : '0';
    const avgDuration = p.count > 0 ? (p.totalDuration / p.count).toFixed(1) : '0';
    const defectDensity = p.testItems > 0 ? (p.totalBugs / p.testItems).toFixed(3) : '0';
    return [
      name,
      p.project,
      String(p.count),
      String(p.totalBugs),
      avgBugsPerVersion,
      String(p.severe),
      avgSeverePerVersion,
      avgDuration,
      defectDensity,
    ];
  });

  const table = createDataTable(
    ['产品名称', '所属项目', '总版本数', '总BUG数', '单版本平均BUG数', '总严重问题数', '单版本平均严重问题数', '平均测试时长', '平均缺陷密度'],
    tableData,
    { colWidths: [16, 12, 8, 8, 14, 12, 16, 10, 10] }
  );
  children.push(table);

  // 汇总
  let summaryText = `产品健康度分析基于缺陷密度（BUG总数/测试项总数）进行评估，共涉及 ${productMap.size} 个产品。`;
  const worstProducts = sortedProducts.slice(0, 3);
  if (worstProducts.length > 0) {
    summaryText += `缺陷密度最高的产品为：`;
    for (let i = 0; i < worstProducts.length; i++) {
      const [name, p] = worstProducts[i];
      const density = p.testItems > 0 ? (p.totalBugs / p.testItems).toFixed(3) : '0';
      summaryText += `"${name}"（缺陷密度 ${density}，总 BUG ${p.totalBugs} 个）`;
      if (i < worstProducts.length - 1) summaryText += '、';
    }
    summaryText += `。`;
    summaryText += `建议对这些高缺陷密度产品进行专项质量改进，加强代码审查和自动化测试覆盖率。`;
  }

  children.push(createParagraph(summaryText));

  return children;
}

// ============================================================================
// 总结页
// ============================================================================

function buildConclusion(records) {
  const children = [];

  children.push(createHeading2('总结与建议'));

  // 计算关键指标
  const totalBugs = records.reduce((s, r) => s + toNum(r['BUG总数']), 0);
  const totalSevere = records.reduce((s, r) => s + toNum(r['严重问题']), 0);
  const totalTestItems = records.reduce((s, r) => s + toNum(r['测试项总数']), 0);
  const overallRatio = totalTestItems > 0 ? (totalBugs / totalTestItems).toFixed(3) : '0';
  const severeRate = totalBugs > 0 ? ((totalSevere / totalBugs) * 100).toFixed(1) + '%' : '0.0%';

  const projects = new Set(records.map((r) => r['项目'] || '')).size;
  const testers = new Set(records.map((r) => r['测试人员'] || '')).size;
  const products = new Set(records.map((r) => r['产品名称'] || '')).size;

  const durations = records.map((r) => parseDuration(r['测试时长'])).filter((d) => d > 0);
  const avgDuration =
    durations.length > 0
      ? (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1)
      : '0';

  children.push(
    createRichParagraph([
      { text: '一、总体概况', bold: true },
    ])
  );

  children.push(
    createParagraph(
      `本次测试看板分析覆盖 ${records.length} 条测试记录，`
      + `涉及 ${projects} 个项目、${products} 个产品，`
      + `由 ${testers} 名测试/转测人员参与。`
      + `测试项总数为 ${totalTestItems} 个，发现问题 BUG 共 ${totalBugs} 个，`
      + `整体 BUG 密度为 ${overallRatio}，严重问题占比 ${severeRate}。`
      + `平均测试时长为 ${avgDuration} 天。`
    )
  );

  children.push(
    createRichParagraph([
      { text: '二、关键发现', bold: true },
    ])
  );

  // 查找有严重问题的记录
  const severeCount = records.filter((r) => toNum(r['严重问题']) > 0).length;
  const noSevereCount = records.length - severeCount;

  children.push(
    createParagraph(
      `1. 严重问题分布：${severeCount} 条记录存在严重问题，${noSevereCount} 条记录无严重问题。`
      + `严重问题主要集中在少数产品和版本中，需重点关注。`
    )
  );

  children.push(
    createParagraph(
      `2. 测试时长分析：平均测试时长 ${avgDuration} 天，`
      + `各版本测试周期差异较大，建议根据产品复杂度制定合理的测试周期标准。`
    )
  );

  // 找健康度最差的项目
  const projectHealthMap = new Map();
  for (const r of records) {
    const proj = r['项目'] || '未知项目';
    if (!projectHealthMap.has(proj)) {
      projectHealthMap.set(proj, { testItems: 0, bugs: 0 });
    }
    const ph = projectHealthMap.get(proj);
    ph.testItems += toNum(r['测试项总数']);
    ph.bugs += toNum(r['BUG总数']);
  }
  let worstProject = '';
  let worstRatio = 0;
  for (const [proj, ph] of projectHealthMap) {
    const ratio = ph.testItems > 0 ? ph.bugs / ph.testItems : 0;
    if (ratio > worstRatio) {
      worstRatio = ratio;
      worstProject = proj;
    }
  }

  children.push(
    createParagraph(
      `3. 项目健康度：${worstProject ? `"${worstProject}"项目 BUG 密度最高（${worstRatio.toFixed(3)}），` : ''}`
      + `建议相关团队加强单元测试和代码评审，降低缺陷引入率。`
    )
  );

  children.push(
    createRichParagraph([
      { text: '三、改进建议', bold: true },
    ])
  );

  children.push(
    createParagraph(
      `1. 针对严重问题集中的版本，建议建立专项修复计划并安排回归测试。`
    )
  );

  children.push(
    createParagraph(
      `2. 对健康度评级为"中"或"差"的项目，建议增加自动化测试覆盖，引入持续集成质量门禁。`
    )
  );

  children.push(
    createParagraph(
      `3. 对测试时长超过10天的版本，建议复盘测试范围与资源分配，优化测试策略。`
    )
  );

  children.push(
    createParagraph(
      `4. 加强转测前的自测力度，将严重 BUG 发现前移，降低转测后严重缺陷比例。`
    )
  );

  children.push(
    createParagraph(
      `5. 针对 BUG 高频产品，建议开展专项代码走查和技术债务清理。`
    )
  );

  children.push(createParagraph(''));
  children.push(
    createParagraph(
      `报告生成时间：${new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      { alignment: AlignmentType.RIGHT }
    )
  );

  return children;
}

// ============================================================================
// 封面页
// ============================================================================

function buildCoverPage(records) {
  const today = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return [
    new Paragraph({ spacing: { before: 2400 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: '测 试 看 板 分 析 报 告',
          font: { ...FONT, eastAsia: 'Microsoft YaHei' },
          size: COVER_TITLE_SIZE,
          bold: true,
        }),
      ],
    }),
    new Paragraph({ spacing: { before: 400 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: `报告日期：${today}`,
          font: FONT,
          size: COVER_SUB_SIZE,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: `统计记录数：${records.length} 条`,
          font: FONT,
          size: COVER_SUB_SIZE,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: '华如防务项目管理系统',
          font: FONT,
          size: COVER_SUB_SIZE,
        }),
      ],
    }),
    new Paragraph({ spacing: { before: 1200 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: '— 本报告由系统自动生成 —',
          font: FONT,
          size: BODY_SIZE,
          italics: true,
          color: '888888',
        }),
      ],
    }),
  ];
}

// ============================================================================
// 主入口：generateReport
// ============================================================================

/**
 * 生成测试看板分析报告
 * @param {Array<object>} records - 测试记录数组，每条记录包含字段：
 *   序号, 项目, 产品名称, 版本号, 版本发布时间, 测试人员,
 *   测试项总数, BUG总数, 测试时长, 严重问题, 重要问题, 轻微问题, 建议问题,
 *   测试开始时间, 测试结束时间
 * @returns {Promise<Buffer>} .docx 文件的 Buffer
 */
async function generateReport(records) {
  if (!Array.isArray(records) || records.length === 0) {
    // 无数据时返回一个简单文档
    const emptyDoc = new Document({
      sections: [
        {
          properties: {
            type: SectionType.NEXT_PAGE,
            page: {
              margin: {
                top: convertInchesToTwip(1),
                bottom: convertInchesToTwip(1),
                left: convertInchesToTwip(1.2),
                right: convertInchesToTwip(1.2),
              },
            },
          },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: '测试看板分析报告',
                  font: FONT,
                  size: COVER_TITLE_SIZE,
                  bold: true,
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 400 },
              children: [
                new TextRun({
                  text: '暂无测试数据记录，无法生成报告。',
                  font: FONT,
                  size: COVER_SUB_SIZE,
                }),
              ],
            }),
          ],
        },
      ],
    });

    return await Packer.toBuffer(emptyDoc);
  }

  // 公共 section properties
  const sectionProps = {
    page: {
      margin: {
        top: convertInchesToTwip(1),
        bottom: convertInchesToTwip(1),
        left: convertInchesToTwip(1.2),
        right: convertInchesToTwip(1.2),
      },
    },
  };

  // 构建文档 sections
  // 封面页
  const coverSection = {
    properties: { ...sectionProps, type: SectionType.NEXT_PAGE },
    children: buildCoverPage(records),
  };

  // 内容页 section 1-4
  const contentSection1 = {
    properties: sectionProps,
    children: [
      ...buildSection1(records),
      new Paragraph({ children: [new PageBreak()] }),
      ...buildSection2(records),
      new Paragraph({ children: [new PageBreak()] }),
      ...buildSection3(records),
      new Paragraph({ children: [new PageBreak()] }),
      ...buildSection4(records),
    ],
  };

  // 内容页 section 5-9
  const contentSection2 = {
    properties: sectionProps,
    children: [
      ...buildSection5(records),
      new Paragraph({ children: [new PageBreak()] }),
      ...buildSection6(records),
      new Paragraph({ children: [new PageBreak()] }),
      ...buildSection7(records),
      new Paragraph({ children: [new PageBreak()] }),
      ...buildSection8(records),
      new Paragraph({ children: [new PageBreak()] }),
      ...buildSection9(records),
    ],
  };

  // 总结页
  const conclusionSection = {
    properties: sectionProps,
    children: [
      new Paragraph({ children: [new PageBreak()] }),
      ...buildConclusion(records),
    ],
  };

  // 页脚：页码
  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: '第 ',
            font: FONT,
            size: 18,
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            font: FONT,
            size: 18,
          }),
          new TextRun({
            text: ' 页 / 共 ',
            font: FONT,
            size: 18,
          }),
          new TextRun({
            children: [PageNumber.TOTAL_PAGES],
            font: FONT,
            size: 18,
          }),
          new TextRun({
            text: ' 页',
            font: FONT,
            size: 18,
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      { ...coverSection, footers: { default: footer } },
      { ...contentSection1, footers: { default: footer } },
      { ...contentSection2, footers: { default: footer } },
      { ...conclusionSection, footers: { default: footer } },
    ],
  });

  return await Packer.toBuffer(doc);
}

// ============================================================================
// 导出
// ============================================================================

module.exports = { generateReport };
