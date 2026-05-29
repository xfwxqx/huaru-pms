// 测试看板页
const TestDashboardPage = {
  _rawData: [],
  _filteredData: [],
  _charts: {},
  _resizeTimer: null,

  async render() {
    // 优先从服务器缓存加载最新数据
    try {
      var resp = await fetch('/api/test-records/latest');
      var result = await resp.json();
      if (result.hasCache && result.records && result.records.length > 0) {
        this._rawData = this._fixData(result.records);
        console.log('[测试看板] 已加载服务器缓存:', result.fileName, result.records.length, '条');
      } else {
        this._rawData = this._sample();
      }
    } catch(e) {
      this._rawData = this._sample();
    }
    this._filteredData = [...this._rawData];
    const s = this._stats();
    const CH = 210;

    return '<div class="page-container page-dashboard" style="gap:8px;padding:8px 12px;">'+
      '<div class="page-header" style="display:flex;align-items:center;justify-content:space-between;padding:0;">'+
        '<h1 class="page-title" style="margin:0;">🧪 测试看板</h1>'+
        '<div class="flex gap-6">'+
          '<input type="file" id="td-upload" accept=".xlsx,.xls,.json" style="display:none;" onchange="TestDashboardPage._onUpload(event)">'+
          '<button class="btn btn-outline btn-sm" onclick="document.getElementById(\'td-upload\').click()">📁 导入</button>'+
          '<button class="btn btn-primary btn-sm" onclick="TestDashboardPage._export()">📥 导出</button>'+
        '</div>'+
      '</div>'+
      '<div class="stats-row" style="gap:6px;">'+
        '<div class="stat-card" style="padding:5px 8px;gap:3px;"><div class="stat-icon" style="font-size:18px;">📋</div><div class="stat-info"><div class="stat-num" style="font-size:16px;" id="td-records">'+s.records+'</div><div class="stat-label" style="font-size:9px;">测试记录</div></div></div>'+
        '<div class="stat-card primary" style="padding:5px 8px;gap:3px;"><div class="stat-icon" style="font-size:18px;">📁</div><div class="stat-info"><div class="stat-num" style="font-size:16px;" id="td-projects">'+s.projects+'</div><div class="stat-label" style="font-size:9px;">项目数</div></div></div>'+
        '<div class="stat-card success" style="padding:5px 8px;gap:3px;"><div class="stat-icon" style="font-size:18px;">📦</div><div class="stat-info"><div class="stat-num" style="font-size:16px;" id="td-products">'+s.products+'</div><div class="stat-label" style="font-size:9px;">产品数</div></div></div>'+
        '<div class="stat-card warning" style="padding:5px 8px;gap:3px;"><div class="stat-icon" style="font-size:18px;">🧪</div><div class="stat-info"><div class="stat-num" style="font-size:16px;" id="td-testitems">'+s.versions+'</div><div class="stat-label" style="font-size:9px;">版本数</div></div></div>'+
        '<div class="stat-card danger" style="padding:5px 8px;gap:3px;"><div class="stat-icon" style="font-size:18px;">🐛</div><div class="stat-info"><div class="stat-num" style="font-size:16px;" id="td-bugs">'+s.bugs+'</div><div class="stat-label" style="font-size:9px;">BUG总数</div></div></div>'+
        '<div class="stat-card" style="padding:5px 8px;gap:3px;border-left-color:#4facfe;"><div class="stat-icon" style="font-size:18px;">⏱️</div><div class="stat-info"><div class="stat-num" style="font-size:16px;" id="td-avg">'+s.avgDuration.toFixed(1)+'</div><div class="stat-label" style="font-size:9px;">均时长(天)</div></div></div>'+
      '</div>'+
      '<div class="charts-grid" style="gap:8px;">'+
        '<div class="card" style="margin:0;"><div class="card-header" style="padding:3px 8px;"><span class="card-title" style="font-size:11px;">🐛 BUG等级分布</span></div><div class="card-body" style="padding:2px;"><div id="td-chart-bug" style="width:100%;height:'+CH+'px;"></div></div></div>'+
        '<div class="card" style="margin:0;"><div class="card-header" style="padding:3px 8px;"><span class="card-title" style="font-size:11px;">📈 项目测试统计</span></div><div class="card-body" style="padding:2px;"><div id="td-chart-project" style="width:100%;height:'+CH+'px;"></div></div></div>'+
        '<div class="card" style="margin:0;"><div class="card-header" style="padding:3px 8px;"><span class="card-title" style="font-size:11px;">👥 测试人员工作</span></div><div class="card-body" style="padding:2px;"><div id="td-chart-tester" style="width:100%;height:'+CH+'px;"></div></div></div>'+
        '<div class="card" style="margin:0;"><div class="card-header" style="padding:3px 8px;"><span class="card-title" style="font-size:11px;">📅 月度测试趋势</span></div><div class="card-body" style="padding:2px;"><div id="td-chart-monthly" style="width:100%;height:'+CH+'px;"></div></div></div>'+
      '</div>'+
      '<div class="card table-card" style="margin:0;flex:1;min-height:0;">'+
        '<div class="card-header" style="padding:4px 10px;display:flex;align-items:center;justify-content:space-between;">'+
          '<span class="card-title" style="font-size:12px;">📋 测试记录明细 (<span id="td-count">'+this._filteredData.length+'</span>)</span>'+
          '<div class="filter-inline" style="display:flex;align-items:center;gap:8px;">'+
            this._filterHtml('项目','td-filter-project',s.projectList)+
            this._filterHtml('产品','td-filter-product',s.productList)+
            this._filterHtml('测试人员','td-filter-tester',s.testerList)+
            '<div class="form-group" style="min-width:100px;"><label class="form-label" style="font-size:10px;margin-bottom:1px;">开始</label><input type="date" id="td-filter-start" class="form-input" style="font-size:10px;padding:2px 5px;" onchange="TestDashboardPage._applyFilter()"></div>'+
            '<div class="form-group" style="min-width:100px;"><label class="form-label" style="font-size:10px;margin-bottom:1px;">结束</label><input type="date" id="td-filter-end" class="form-input" style="font-size:10px;padding:2px 5px;" onchange="TestDashboardPage._applyFilter()"></div>'+
            '<button class="btn btn-outline btn-sm" onclick="TestDashboardPage._resetFilter()" style="padding:2px 8px;font-size:10px;margin-top:14px;">重置</button>'+
          '</div>'+
        '</div>'+
        '<div class="card-body" id="td-table-wrap">'+this._renderTable()+'</div>'+
      '</div>'+
    '</div>';
  },

  _filterHtml: function(label, id, list) {
    var opts = ['<option value="">全部</option>'].concat(list.map(function(v) { return '<option value="'+v+'">'+v+'</option>'; })).join('');
    return '<div class="form-group" style="min-width:90px;"><label class="form-label" style="font-size:10px;margin-bottom:1px;">'+label+'</label><select id="'+id+'" class="form-select" style="font-size:10px;padding:2px 5px;" onchange="TestDashboardPage._onFilterChange(this)">'+opts+'</select></div>';
  },

  async mount() {
    if (typeof echarts === 'undefined') {
      await new Promise(function(resolve) {
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js';
        s.onload = resolve; document.head.appendChild(s);
      });
    }
    var self = this;
    await new Promise(function(resolve) { setTimeout(resolve, 100); });
    self._renderCharts();

    // 窗口大小变化时重建图表（防抖：停止resize后100ms才重绘，避免拖拽过程中频繁重绘）
    self._resizeHandlerFn = self._resizeHandlerFn || function() {
      clearTimeout(self._resizeTimer);
      self._resizeTimer = setTimeout(function() {
        self._renderCharts();
      }, 100);
    };
    window.removeEventListener('resize', self._resizeHandlerFn);
    window.addEventListener('resize', self._resizeHandlerFn);
  },

  _fixData: function(arr) {
    var self = this;
    return arr.map(function(r) {
      var row = {};
      for (var k in r) {
        var v = r[k];
        if (v === null || v === undefined || (typeof v === 'number' && isNaN(v))) row[k] = '';
        else if (v === 'NaT' || v === 'nan' || v === 'NaN' || v === 'null' || v === 'undefined') row[k] = '';
        else if (typeof v === 'string') {
          // 清理字符串
          var str = v.trim();
          // 如果是日期字段，尝试转换
          if (k === '版本发布时间' || k === '测试开始时间' || k === '测试结束时间') {
            var d = self._dateShort(str);
            row[k] = d === '-' ? '' : d;
          } else {
            row[k] = str;
          }
        } else {
          row[k] = v;
        }
      }
      return row;
    });
  },

  _destroyCharts: function() {
    for (var k in this._charts) { try { this._charts[k].dispose(); } catch(e) {} }
    this._charts = {};
  },

  _renderCharts: function() {
    var data = this._filteredData.slice();
    this._renderChartsWithData(data);
  },

  _renderChartsWithData: function(data) {
    var self = this;
    for (var k in this._charts) { try { this._charts[k].dispose(); } catch(e) {} }
    this._charts = {};

    var validData = data.filter(function(d) { return self._isValid(d.项目); });

    var bugEl = document.getElementById('td-chart-bug');
    if (bugEl) {
      var bug = { 严重:0, 重要:0, 轻微:0, 建议:0 };
      validData.forEach(function(d) { bug.严重 += (Number(d.严重问题)||0); bug.重要 += (Number(d.重要问题)||0); bug.轻微 += (Number(d.轻微问题)||0); bug.建议 += (Number(d.建议问题)||0); });
      var bc = echarts.init(bugEl);
      bc.setOption({
        tooltip:{trigger:'item',formatter:'{b}: {c}'},
        legend:{right:6,top:'center',orient:'vertical',textStyle:{fontSize:10}},
        series:[{
          type:'pie',
          radius:['45%','72%'],
          center:['38%','50%'],
          itemStyle:{borderRadius:4,borderColor:'#fff',borderWidth:2},
          label:{show:true,formatter:'{b}\n{c}',fontSize:9},
          data:[
            {value:bug.严重,name:'严重问题',itemStyle:{color:'#ef4444'}},
            {value:bug.重要,name:'重要问题',itemStyle:{color:'#f97316'}},
            {value:bug.轻微,name:'轻微问题',itemStyle:{color:'#3b82f6'}},
            {value:bug.建议,name:'建议问题',itemStyle:{color:'#22c55e'}}
          ]
        }]
      });
      this._charts.bug = bc;
    }

    var projEl = document.getElementById('td-chart-project');
    if (projEl) {
      var proj = {};
      validData.forEach(function(d) { if(!self._isValid(d.项目))return; if(!proj[d.项目])proj[d.项目]={t:0,b:0,v:0}; proj[d.项目].t+=(Number(d.测试项总数)||0); proj[d.项目].b+=(Number(d.BUG总数)||0); if(self._isValid(d.版本号))proj[d.项目].v++; });
      var keys = Object.keys(proj);
      var pc = echarts.init(projEl);
      pc.setOption({
        tooltip:{trigger:'axis',axisPointer:{type:'shadow'}},
        legend:{data:['测试项','BUG数','版本数'],bottom:0,textStyle:{fontSize:9}},
        grid:{left:6,right:40,top:22,bottom:26,containLabel:true},
        xAxis:{type:'category',data:keys,axisLabel:{rotate:30,fontSize:9}},
        yAxis:[
          {type:'value',name:'',axisLabel:{fontSize:9},splitLine:{lineStyle:{type:'dashed'}}},
          {type:'value',name:'',axisLabel:{fontSize:9},splitLine:{show:false}}
        ],
        series:[
          {name:'测试项',type:'bar',yAxisIndex:0,data:keys.map(function(k){return proj[k].t}),itemStyle:{color:'#667eea',borderRadius:[2,2,0,0]},barGap:'10%'},
          {name:'BUG数',type:'bar',yAxisIndex:0,data:keys.map(function(k){return proj[k].b}),itemStyle:{color:'#ef4444',borderRadius:[2,2,0,0]}},
          {name:'版本数',type:'line',yAxisIndex:1,data:keys.map(function(k){return proj[k].v}),itemStyle:{color:'#22c55e'},lineStyle:{width:2},symbol:'circle',symbolSize:6}
        ]
      });
      this._charts.project = pc;
    }

    var testerEl = document.getElementById('td-chart-tester');
    if (testerEl) {
      var tester = {};
      validData.forEach(function(d) { if(!self._isValid(d.测试人员))return; if(!tester[d.测试人员])tester[d.测试人员]={t:0,b:0,v:0}; tester[d.测试人员].t+=(Number(d.测试项总数)||0); tester[d.测试人员].b+=(Number(d.BUG总数)||0); if(self._isValid(d.版本号))tester[d.测试人员].v++; });
      var tKeys = Object.keys(tester);
      var tc = echarts.init(testerEl);
      tc.setOption({
        tooltip:{trigger:'axis',axisPointer:{type:'shadow'}},
        legend:{data:['测试项','BUG数','版本数'],bottom:0,textStyle:{fontSize:9}},
        grid:{left:6,right:40,top:22,bottom:26,containLabel:true},
        xAxis:{type:'value',axisLabel:{fontSize:9},splitLine:{lineStyle:{type:'dashed'}}},
        yAxis:{type:'category',data:tKeys,axisLabel:{fontSize:9}},
        series:[
          {name:'测试项',type:'bar',data:tKeys.map(function(k){return tester[k].t}),itemStyle:{color:'#3b82f6',borderRadius:[0,2,2,0]},barGap:'10%'},
          {name:'BUG数',type:'bar',data:tKeys.map(function(k){return tester[k].b}),itemStyle:{color:'#d946ef',borderRadius:[0,2,2,0]}},
          {name:'版本数',type:'line',data:tKeys.map(function(k){return tester[k].v}),itemStyle:{color:'#22c55e'},lineStyle:{width:2},symbol:'circle',symbolSize:6}
        ]
      });
      this._charts.tester = tc;
    }

    var monthEl = document.getElementById('td-chart-monthly');
    if (monthEl) {
      var month = {};
      validData.forEach(function(d) {
        var raw = String(d.版本发布时间||'').trim();
        if (!raw || raw === '-' || raw === '/' || raw === 'null' || raw === 'undefined') return;
        
        var year, month2;
        
        // 尝试匹配 Excel 日期序列号
        var num = Number(raw);
        if (!isNaN(num) && num > 0 && num < 100000) {
          var epoch = new Date(1899, 11, 30);
          var date = new Date(epoch.getTime() + num * 24 * 60 * 60 * 1000);
          year = date.getFullYear();
          month2 = String(date.getMonth() + 1).padStart(2, '0');
        } else {
          // YYYY-MM 或 YYYY/MM
          var m = raw.match(/(\d{4})[-/年](\d{1,2})/);
          if (m) {
            year = m[1];
            month2 = String(m[2]).padStart(2, '0');
          }
          // M/D/YY 或 M/D/YYYY
          if (!year) {
            m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
            if (m) {
              year = m[3].length === 2 ? (Number(m[3]) < 50 ? '20' + m[3] : '19' + m[3]) : m[3];
              month2 = String(m[1]).padStart(2, '0');
            }
          }
        }
        
        if (!year || !month2) return;
        
        var mk = year + '-' + month2;
        if (!month[mk]) month[mk] = { t:0, b:0, v:0 };
        month[mk].t += (Number(d.测试项总数)||0);
        month[mk].b += (Number(d.BUG总数)||0);
        if (self._isValid(d.版本号)) month[mk].v++;
      });
      var mKeys = Object.keys(month).sort();
      var mc = echarts.init(monthEl);
      mc.setOption({
        tooltip:{trigger:'axis'},
        legend:{data:['测试项','BUG数','版本数'],bottom:0,textStyle:{fontSize:9}},
        grid:{left:6,right:40,top:22,bottom:26,containLabel:true},
        xAxis:{type:'category',boundaryGap:false,data:mKeys,axisLabel:{fontSize:9}},
        yAxis:[
          {type:'value',name:'',axisLabel:{fontSize:9},splitLine:{lineStyle:{type:'dashed'}}},
          {type:'value',name:'',axisLabel:{fontSize:9},splitLine:{show:false}}
        ],
        series:[
          {name:'测试项',type:'line',yAxisIndex:0,smooth:true,data:mKeys.map(function(k){return month[k].t}),areaStyle:{color:{type:'linear',x:0,y:0,x2:0,y2:1,colorStops:[{offset:0,color:'rgba(102,126,234,0.2)'},{offset:1,color:'rgba(102,126,234,0.02)'}]}},itemStyle:{color:'#667eea'},lineStyle:{width:2}},
          {name:'BUG数',type:'line',yAxisIndex:0,smooth:true,data:mKeys.map(function(k){return month[k].b}),areaStyle:{color:{type:'linear',x:0,y:0,x2:0,y2:1,colorStops:[{offset:0,color:'rgba(239,68,68,0.2)'},{offset:1,color:'rgba(239,68,68,0.02)'}]}},itemStyle:{color:'#ef4444'},lineStyle:{width:2}},
          {name:'版本数',type:'bar',yAxisIndex:1,data:mKeys.map(function(k){return month[k].v}),itemStyle:{color:'#22c55e',borderRadius:[2,2,0,0]},barWidth:12}
        ]
      });
      this._charts.monthly = mc;
    }
  },

  _onFilterChange: function(changedEl) {
    var project = (document.getElementById('td-filter-project')||{}).value || '';
    var product = (document.getElementById('td-filter-product')||{}).value || '';
    var tester = (document.getElementById('td-filter-tester')||{}).value || '';
    var self = this;
    var baseData = this._rawData;

    // 计算三个条件的交集，用于更新日期范围
    var dataForDateRange = baseData.filter(function(d) {
      if (project && d.项目 !== project) return false;
      if (product && d.产品名称 !== product) return false;
      if (tester && d.测试人员 !== tester) return false;
      return true;
    });

    // 计算项目+测试人员的交集，用于更新产品选项
    var dataForProduct = baseData.filter(function(d) {
      if (project && d.项目 !== project) return false;
      if (tester && d.测试人员 !== tester) return false;
      return true;
    });

    // 计算产品+测试人员的交集，用于更新项目选项
    var dataForProject = baseData.filter(function(d) {
      if (product && d.产品名称 !== product) return false;
      if (tester && d.测试人员 !== tester) return false;
      return true;
    });

    // 计算项目+产品的交集，用于更新测试人员选项
    var dataForTester = baseData.filter(function(d) {
      if (project && d.项目 !== project) return false;
      if (product && d.产品名称 !== product) return false;
      return true;
    });

    // 更新所有下拉框选项，保留当前选中值
    this._updateSelectOptions('td-filter-project', dataForProject, '项目', project);
    this._updateSelectOptions('td-filter-product', dataForProduct, '产品名称', product);
    this._updateSelectOptions('td-filter-tester', dataForTester, '测试人员', tester);
    this._updateDateRange(dataForDateRange);

    this._applyFilter();
  },

  _updateDateRange: function(data) {
    var self = this;
    var dates = [];
    data.forEach(function(d) {
      var dt = self._extractDate(d.版本发布时间);
      if (dt) dates.push(dt);
    });
    dates.sort();
    var startEl = document.getElementById('td-filter-start');
    var endEl = document.getElementById('td-filter-end');
    if (startEl) startEl.value = dates.length > 0 ? dates[0] : '';
    if (endEl) endEl.value = dates.length > 0 ? dates[dates.length - 1] : '';
  },

  _updateSelectOptions: function(selectId, data, field, currentValue) {
    var select = document.getElementById(selectId);
    if (!select) return;
    var values = [];
    var self = this;
    data.forEach(function(d) {
      var v = d[field];
      if (self._isValid(v) && values.indexOf(v) === -1) {
        values.push(v);
      }
    });
    values.sort();
    var html = '<option value="">全部</option>';
    values.forEach(function(v) {
      html += '<option value="' + v + '"' + (v === currentValue ? ' selected' : '') + '>' + v + '</option>';
    });
    select.innerHTML = html;
    if (currentValue && values.indexOf(currentValue) !== -1) {
      select.value = currentValue;
    }
  },

  _applyFilter: function() {
    var project = (document.getElementById('td-filter-project')||{}).value || '';
    var product = (document.getElementById('td-filter-product')||{}).value || '';
    var tester = (document.getElementById('td-filter-tester')||{}).value || '';
    var start = (document.getElementById('td-filter-start')||{}).value || '';
    var end = (document.getElementById('td-filter-end')||{}).value || '';
    var self = this;

    this._filteredData = this._rawData.filter(function(d) {
      if (project && d.项目 !== project) return false;
      if (product && d.产品名称 !== product) return false;
      if (tester && d.测试人员 !== tester) return false;
      var date = TestDashboardPage._extractDate(d.版本发布时间);
      if (date) { if (start && date < start) return false; if (end && date > end) return false; }
      return true;
    });
    this._updateAll();
  },

  _resetFilter: function() {
    ['td-filter-project','td-filter-product','td-filter-tester','td-filter-start','td-filter-end'].forEach(function(id) {
      var el = document.getElementById(id); if (el) el.value = '';
    });
    this._filteredData = this._rawData.slice();
    this._updateSelectOptions('td-filter-project', this._rawData, '项目', '');
    this._updateSelectOptions('td-filter-product', this._rawData, '产品名称', '');
    this._updateSelectOptions('td-filter-tester', this._rawData, '测试人员', '');
    this._updateAll();
  },

  _updateAll: function() {
    var s = this._stats();
    var ids = { 'td-records':s.records, 'td-projects':s.projects, 'td-products':s.products, 'td-testitems':s.versions, 'td-bugs':s.bugs };
    for (var k in ids) { var el = document.getElementById(k); if (el) el.textContent = ids[k]; }
    var avgEl = document.getElementById('td-avg'); if (avgEl) avgEl.textContent = s.avgDuration.toFixed(1);
    var wrap = document.getElementById('td-table-wrap'); if (wrap) wrap.innerHTML = this._renderTable();
    var count = document.getElementById('td-count'); if (count) count.textContent = this._filteredData.length;
    this._renderCharts();
  },

  _renderTable: function() {
    var self = this;
    var data = this._filteredData;
    if (data.length === 0) return '<div class="empty-state" style="padding:16px;"><div class="icon" style="font-size:22px;">📋</div><p style="font-size:11px;">暂无匹配的测试记录</p></div>';
    var rows = data.map(function(r) {
      return '<tr><td>'+ (r.序号||'-') +'</td><td>'+ (r.项目||'-') +'</td>'+
        '<td title="'+ (r.产品名称||'') +'" style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+ (r.产品名称||'-') +'</td>'+
        '<td><span class="tag tag-blue" style="font-size:9px;">'+ (r.版本号||'-') +'</span></td>'+
        '<td style="font-size:9px;">'+ (self._dateShort(r.版本发布时间)||'-') +'</td>'+
        '<td>'+ (self._isValid(r.测试人员)?r.测试人员:'-') +'</td>'+
        '<td style="text-align:center;">'+ (r.测试项总数 != null ? r.测试项总数 : '-') +'</td>'+
        '<td style="text-align:center;color:var(--danger);font-weight:600;">'+ (r.BUG总数 != null ? r.BUG总数 : '-') +'</td>'+
        '<td style="text-align:center;">'+ (r.测试时长 != null ? r.测试时长 : '-') +'</td>'+
        '<td style="text-align:center;color:#f97316;font-weight:600;">'+ (r.严重问题||'-') +'</td>'+
        '<td style="text-align:center;">'+ (r.重要问题||'-') +'</td></tr>';
    }).join('');
    return '<div class="table-wrap"><table style="font-size:9px;"><thead><tr>'+
      '<th style="font-size:8px;">序号</th><th style="font-size:8px;">项目</th><th style="font-size:8px;">产品名称</th>'+
      '<th style="font-size:8px;">版本号</th><th style="font-size:8px;">发布时间</th><th style="font-size:8px;">测试人员</th>'+
      '<th style="font-size:8px;text-align:center;">测试项</th><th style="font-size:8px;text-align:center;">BUG数</th>'+
      '<th style="font-size:8px;text-align:center;">时长</th><th style="font-size:8px;text-align:center;">严重</th><th style="font-size:8px;text-align:center;">重要</th>'+
    '</tr></thead><tbody>'+rows+'</tbody></table></div>';
  },

  async _onUpload(e) {
    var f = e.target.files[0]; if (!f) return;
    try {
      if (f.name.endsWith('.json')) {
        this._rawData = this._fixData(JSON.parse(await f.text()));
      } else if (f.name.match(/\.xlsx?$/i)) {
        var wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
        var arr = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: false, defval: '' });
        this._rawData = this._fixData(arr);
      } else { App.showToast('请选择 .xlsx/.xls/.json', 'error'); return; }
      this._filteredData = this._rawData.slice();
      App.showToast('导入 ' + this._rawData.length + ' 条记录', 'success');
      
      // 上传到服务器缓存
      try {
        var formData = new FormData();
        formData.append('file', f);
        var resp = await fetch('/api/test-records/upload', { method: 'POST', body: formData });
        var result = await resp.json();
        if (result.success) {
          console.log('[测试看板] 文件已缓存到服务器');
        }
      } catch(e) { console.log('[测试看板] 缓存文件失败:', e.message); }
      
      await this._rerender();
    } catch (e) { App.showToast('导入失败: ' + e.message, 'error'); }
  },

  async _export() {
    if (this._filteredData.length === 0) {
      App.showToast('没有可导出的数据', 'error');
      return;
    }
    try {
      App.showToast('正在生成Word报告...', 'info');
      var resp = await fetch('/api/test-records/export-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: this._filteredData })
      });
      if (!resp.ok) {
        var err = await resp.json();
        App.showToast(err.message || '报告生成失败', 'error');
        return;
      }
      var blob = await resp.blob();
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '测试看板分析报告_' + new Date().toISOString().slice(0,10) + '.docx';
      a.click();
      App.showToast('Word报告已导出', 'success');
    } catch (e) {
      App.showToast('报告生成失败: ' + e.message, 'error');
    }
  },

  async _rerender() {
    this._destroyCharts();
    var c = document.getElementById('page-content'); if (!c) return;
    c.innerHTML = await this.render(); await this.mount();
  },

  _isValid: function(v) { var s = String(v||'').trim(); return s && s!=='undefined' && s!=='null' && s!=='/' && s!=='nan' && s!=='NaN' && s!=='NaT'; },

  _dateShort: function(d) {
    var v = String(d||'').trim();
    if (!v || v === '-' || v === '/' || v === 'null' || v === 'undefined') return '-';
    
    // 如果是数字（Excel日期序列号）
    var num = Number(v);
    if (!isNaN(num) && num > 0 && num < 100000) {
      var epoch = new Date(1899, 11, 30);
      var date = new Date(epoch.getTime() + num * 24 * 60 * 60 * 1000);
      return date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0');
    }
    
    // YYYY-MM-DD 或 YYYY/MM/DD 或 YYYY年MM月DD日
    var m = v.match(/(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/i);
    if (m) return m[1] + '-' + String(m[2]).padStart(2,'0') + '-' + String(m[3]).padStart(2,'0');
    
    // M/D/YY 或 M/D/YYYY（Excel常见格式，如 1/6/26、1/6/2026）
    m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
      var year = m[3].length === 2 ? (Number(m[3]) < 50 ? '20' + m[3] : '19' + m[3]) : m[3];
      return year + '-' + String(m[1]).padStart(2,'0') + '-' + String(m[2]).padStart(2,'0');
    }
    
    // M/D/YYYY HH:MM:SS 或 M/D/YY HH:MM:SS
    m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s/);
    if (m) {
      var year = m[3].length === 2 ? (Number(m[3]) < 50 ? '20' + m[3] : '19' + m[3]) : m[3];
      return year + '-' + String(m[1]).padStart(2,'0') + '-' + String(m[2]).padStart(2,'0');
    }
    
    // ISO 格式含T
    if (v.indexOf('T') >= 0) return v.substring(0, v.indexOf('T'));
    
    return v || '-';
  },

  _extractDate: function(d) {
    var v = String(d||'').trim();
    if (!v || v === '-' || v === '/' || v === 'null' || v === 'undefined') return '';
    
    // 如果是数字（Excel日期序列号）
    var num = Number(v);
    if (!isNaN(num) && num > 0 && num < 100000) {
      var epoch = new Date(1899, 11, 30);
      var date = new Date(epoch.getTime() + num * 24 * 60 * 60 * 1000);
      return date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0');
    }
    
    // YYYY-MM-DD 或 YYYY/MM/DD
    var m = v.match(/(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/i);
    if (m) return m[1] + '-' + String(m[2]).padStart(2,'0') + '-' + String(m[3]).padStart(2,'0');
    
    // M/D/YY 或 M/D/YYYY
    m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m) {
      var year = m[3].length === 2 ? (Number(m[3]) < 50 ? '20' + m[3] : '19' + m[3]) : m[3];
      return year + '-' + String(m[1]).padStart(2,'0') + '-' + String(m[2]).padStart(2,'0');
    }
    
    // 只匹配年月
    m = v.match(/(\d{4})[-/年](\d{1,2})/);
    if (m) return m[1] + '-' + String(m[2]).padStart(2,'0');
    
    return '';
  },

  _sample: function() {
    return [{序号:1,项目:'示例',产品名称:'示例产品',版本号:'V1.0.0',转测人员:'张',测试人员:'李',版本发布时间:'2026-01-15',测试开始时间:'2026-01-16',测试结束时间:'2026-01-20',测试时长:5,测试项总数:10,BUG总数:3,严重问题:1,重要问题:2,轻微问题:0,建议问题:0}];
  },

  _stats: function() {
    var self = this;
    var data = this._filteredData.filter(function(d) { return self._isValid(d.项目); });
    var projects = []; data.forEach(function(d) { if (projects.indexOf(d.项目)===-1) projects.push(d.项目); }); projects.sort();
    var testers = []; data.forEach(function(d) { if (self._isValid(d.测试人员) && testers.indexOf(d.测试人员)===-1) testers.push(d.测试人员); }); testers.sort();
    var products = []; data.forEach(function(d) { if (products.indexOf(d.产品名称)===-1) products.push(d.产品名称); }); products.sort();
    var versions = []; data.forEach(function(d) { if (self._isValid(d.版本号) && versions.indexOf(d.版本号)===-1) versions.push(d.版本号); });
    var ti = data.reduce(function(s,d) { return s + (Number(d.测试项总数)||0); }, 0);
    var bu = data.reduce(function(s,d) { return s + (Number(d.BUG总数)||0); }, 0);
    var dur = data.filter(function(d) { return d.测试时长 != null && !isNaN(Number(d.测试时长)) && Number(d.测试时长)>0; });
    var avg = dur.length > 0 ? dur.reduce(function(s,d) { return s + Number(d.测试时长); }, 0)/dur.length : 0;
    return {
      records: this._filteredData.length,
      projects: projects.length,
      products: products.length,
      versions: versions.length,
      testItems: ti,
      bugs: bu,
      avgDuration: avg,
      projectList: projects,
      testerList: testers,
      productList: products
    };
  }
};
