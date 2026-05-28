const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const router = express.Router();

// 确保缓存目录存在
const CACHE_DIR = path.join(__dirname, '..', 'cache', 'test-records');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// 清理旧文件，只保留最新的1个文件
function cleanupOldFiles() {
  const files = fs.readdirSync(CACHE_DIR)
    .filter(f => f.endsWith('.xlsx') || f.endsWith('.xls') || f.endsWith('.json'))
    .map(f => ({
      name: f,
      path: path.join(CACHE_DIR, f),
      time: fs.statSync(path.join(CACHE_DIR, f)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time);
  
  // 删除多余的文件，只保留最新的1个
  if (files.length > 1) {
    files.slice(1).forEach(f => {
      try {
        fs.unlinkSync(f.path);
        console.log('[测试记录缓存] 已删除旧文件:', f.name);
      } catch(e) {}
    });
  }
}

// 获取最新缓存的测试记录
router.get('/latest', (req, res) => {
  try {
    const files = fs.readdirSync(CACHE_DIR)
      .filter(f => f.endsWith('.xlsx') || f.endsWith('.xls') || f.endsWith('.json'))
      .map(f => ({
        name: f,
        path: path.join(CACHE_DIR, f),
        time: fs.statSync(path.join(CACHE_DIR, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);
    
    if (files.length === 0) {
      return res.json({ hasCache: false, records: [] });
    }
    
    const latest = files[0];
    let records = [];
    
    if (latest.name.endsWith('.json')) {
      const data = JSON.parse(fs.readFileSync(latest.path, 'utf8'));
      records = Array.isArray(data) ? data : (data.records || []);
    } else {
      // Excel文件
      const workbook = XLSX.readFile(latest.path);
      const sheetName = workbook.SheetNames[0];
      records = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false, defval: '' });
    }
    
    res.json({
      hasCache: true,
      fileName: latest.name,
      cachedAt: new Date(latest.time).toISOString(),
      records: records
    });
  } catch (e) {
    console.error('[测试记录缓存] 读取缓存失败:', e.message);
    res.json({ hasCache: false, records: [], error: e.message });
  }
});

// 上传并缓存测试记录文件
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, CACHE_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const timestamp = Date.now();
    cb(null, `test-records-${timestamp}${ext}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB限制
  fileFilter: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.json'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 .xlsx, .xls, .json 格式'));
    }
  }
});

router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: '没有上传文件' });
  }
  
  try {
    const filePath = req.file.path;
    let records = [];
    
    if (req.file.originalname.endsWith('.json')) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      records = Array.isArray(data) ? data : (data.records || []);
    } else {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      records = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false, defval: '' });
    }
    
    // 清理旧文件
    cleanupOldFiles();
    
    console.log('[测试记录缓存] 已保存文件:', req.file.filename, '记录数:', records.length);
    
    res.json({
      success: true,
      message: `已缓存文件，包含 ${records.length} 条记录`,
      fileName: req.file.filename,
      records: records
    });
  } catch (e) {
    console.error('[测试记录缓存] 处理文件失败:', e.message);
    res.status(500).json({ success: false, message: '处理文件失败: ' + e.message });
  }
});

// 获取缓存文件列表
router.get('/files', (req, res) => {
  try {
    const files = fs.readdirSync(CACHE_DIR)
      .filter(f => f.endsWith('.xlsx') || f.endsWith('.xls') || f.endsWith('.json'))
      .map(f => {
        const stat = fs.statSync(path.join(CACHE_DIR, f));
        return {
          name: f,
          size: stat.size,
          cachedAt: stat.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.cachedAt) - new Date(a.cachedAt));
    
    res.json({ files });
  } catch (e) {
    res.json({ files: [], error: e.message });
  }
});

// 删除缓存文件
router.delete('/files/:name', (req, res) => {
  try {
    const filePath = path.join(CACHE_DIR, req.params.name);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true, message: '已删除' });
    } else {
      res.status(404).json({ success: false, message: '文件不存在' });
    }
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
