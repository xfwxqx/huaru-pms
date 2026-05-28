const fs = require('fs');
const path = require('path');

let config = { app: { version: 'V3.0' }, server: { port: 3456 }, database: {} };

function loadConfig() {
  const cfgPath = path.join(__dirname, 'config.ini');
  try {
    const text = fs.readFileSync(cfgPath, 'utf-8');
    let section = null;
    for (let line of text.split('\n')) {
      line = line.trim();
      if (!line || line.startsWith('#') || line.startsWith(';')) continue;
      const mSec = line.match(/^\[(.+)\]$/);
      if (mSec) { section = mSec[1]; config[section] = config[section] || {}; continue; }
      const mKV = line.match(/^(.+?)\s*=\s*(.+)$/);
      if (mKV && section) {
        let val = mKV[2].trim();
        if (/^\d+$/.test(val)) val = parseInt(val);
        config[section][mKV[1].trim()] = val;
      }
    }
  } catch (e) {
    console.warn('config.ini 读取失败，使用默认配置:', e.message);
  }
}

loadConfig();

module.exports = { config, reloadConfig: loadConfig };
