/**
 * 性能测试脚本 - 对比优化前后的多用户读取性能
 * 使用方法: node benchmark.js
 */

const http = require('http');
const { performance } = require('perf_hooks');

// 配置
const BASE_URL = 'localhost';
const PORT = 3456;
const CONCURRENT_USERS = [1, 5, 10, 20, 50]; // 并发用户数
const REQUESTS_PER_USER = 100; // 每个用户请求次数

// 测试的 API 端点
const ENDPOINTS = [
  { name: '项目列表', path: '/api/projects', method: 'GET' },
  { name: '项目详情', path: '/api/projects/1', method: 'GET' },
  { name: '产品列表', path: '/api/products?project_id=1', method: 'GET' },
  { name: '产品详情', path: '/api/products/1', method: 'GET' }
];

// 存储 token
let authToken = null;

// 发送 HTTP 请求
function request(path, method = 'GET', token = null, body = null) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const duration = performance.now() - start;
        resolve({
          status: res.statusCode,
          duration: duration,
          cached: res.headers['x-cache'] === 'HIT',
          data: data
        });
      });
    });
    
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// 登录获取 token
async function login() {
  console.log('[登录] 获取认证 token...');
  const result = await request('/api/auth/login', 'POST', null, {
    username: 'admin',
    password: 'admin123'
  });
  
  if (result.status === 200) {
    const data = JSON.parse(result.data);
    authToken = data.token;
    console.log('[登录] 成功');
    return true;
  } else {
    console.log('[登录] 失败:', result.data);
    return false;
  }
}

// 模拟单个用户
async function simulateUser(userId, endpoint, requestsCount, token) {
  const results = [];
  for (let i = 0; i < requestsCount; i++) {
    try {
      const result = await request(endpoint.path, endpoint.method, token);
      results.push(result);
    } catch (e) {
      results.push({ error: true, message: e.message, duration: 0 });
    }
  }
  return results;
}

// 运行并发测试
async function runConcurrentTest(concurrentUsers, endpoint) {
  console.log(`\n  并发用户数: ${concurrentUsers}, 端点: ${endpoint.name}`);
  
  const start = performance.now();
  
  // 创建并发用户
  const userPromises = [];
  for (let i = 0; i < concurrentUsers; i++) {
    userPromises.push(simulateUser(i, endpoint, REQUESTS_PER_USER, authToken));
  }
  
  // 等待所有用户完成
  const allResults = await Promise.all(userPromises);
  
  const totalDuration = performance.now() - start;
  
  // 统计结果
  const allRequests = allResults.flat();
  const successful = allRequests.filter(r => !r.error && r.status === 200);
  const failed = allRequests.filter(r => r.error || r.status !== 200);
  const cached = allRequests.filter(r => r.cached);
  
  const totalRequests = concurrentUsers * REQUESTS_PER_USER;
  const rps = (totalRequests / (totalDuration / 1000)).toFixed(2);
  
  if (successful.length === 0) {
    console.log(`    总请求数: ${totalRequests}`);
    console.log(`    成功: 0, 失败: ${failed.length}`);
    console.log(`    警告: 所有请求都失败了，请检查服务状态`);
    return {
      concurrentUsers,
      endpoint: endpoint.name,
      totalRequests,
      successful: 0,
      failed: failed.length,
      cached: 0,
      totalDuration,
      rps: 0,
      avgDuration: 0,
      minDuration: 0,
      maxDuration: 0,
      p95Duration: 0
    };
  }
  
  const durations = successful.map(r => r.duration);
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);
  const p95Duration = durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)];
  
  console.log(`    总请求数: ${totalRequests}`);
  console.log(`    成功: ${successful.length}, 失败: ${failed.length}`);
  console.log(`    缓存命中: ${cached.length} (${(cached.length/totalRequests*100).toFixed(1)}%)`);
  console.log(`    总耗时: ${totalDuration.toFixed(2)}ms`);
  console.log(`    QPS: ${rps}`);
  console.log(`    平均响应: ${avgDuration.toFixed(2)}ms`);
  console.log(`    最小响应: ${minDuration.toFixed(2)}ms`);
  console.log(`    最大响应: ${maxDuration.toFixed(2)}ms`);
  console.log(`    P95响应: ${p95Duration.toFixed(2)}ms`);
  
  return {
    concurrentUsers,
    endpoint: endpoint.name,
    totalRequests,
    successful: successful.length,
    failed: failed.length,
    cached: cached.length,
    totalDuration,
    rps: parseFloat(rps),
    avgDuration,
    minDuration,
    maxDuration,
    p95Duration
  };
}

// 主测试函数
async function runBenchmark() {
  console.log('========================================');
  console.log('  多用户读取性能测试');
  console.log('========================================');
  console.log(`服务器: http://${BASE_URL}:${PORT}`);
  console.log(`测试场景: 读多写少（纯读取测试）`);
  console.log(`并发用户: ${CONCURRENT_USERS.join(', ')}`);
  console.log(`每用户请求: ${REQUESTS_PER_USER} 次`);
  
  // 登录
  const loggedIn = await login();
  if (!loggedIn) {
    console.log('登录失败，退出测试');
    return;
  }
  
  // 预热 - 先请求一次，让缓存生效
  console.log('\n[预热] 发送初始请求...');
  for (const endpoint of ENDPOINTS) {
    await request(endpoint.path, endpoint.method, authToken);
  }
  console.log('[预热] 完成');
  
  // 运行测试
  const allResults = [];
  
  for (const endpoint of ENDPOINTS) {
    console.log(`\n========================================`);
    console.log(`测试端点: ${endpoint.name}`);
    console.log(`路径: ${endpoint.path}`);
    console.log(`========================================`);
    
    for (const concurrentUsers of CONCURRENT_USERS) {
      const result = await runConcurrentTest(concurrentUsers, endpoint);
      allResults.push(result);
      
      // 间隔一下，让服务器喘口气
      await new Promise(r => setTimeout(r, 500));
    }
  }
  
  // 汇总报告
  console.log('\n========================================');
  console.log('  测试汇总');
  console.log('========================================');
  
  // 按端点分组
  const byEndpoint = {};
  allResults.forEach(r => {
    if (!byEndpoint[r.endpoint]) byEndpoint[r.endpoint] = [];
    byEndpoint[r.endpoint].push(r);
  });
  
  for (const [endpointName, results] of Object.entries(byEndpoint)) {
    console.log(`\n${endpointName}:`);
    console.log('并发用户\tQPS\t\t平均响应\tP95响应\t缓存命中率');
    console.log('--------\t---\t\t--------\t-------\t----------');
    results.forEach(r => {
      const cacheRate = r.totalRequests > 0 ? (r.cached / r.totalRequests * 100).toFixed(1) : '0.0';
      const qps = r.rps ? r.rps.toFixed(2) : '0.00';
      const avg = r.avgDuration ? r.avgDuration.toFixed(2) : '0.00';
      const p95 = r.p95Duration ? r.p95Duration.toFixed(2) : '0.00';
      console.log(`${r.concurrentUsers.toString().padEnd(8)}\t${qps.padEnd(8)}\t${avg.padEnd(8)}\t${p95.padEnd(8)}\t${cacheRate}%`);
    });
  }
  
  // 性能对比说明
  console.log('\n========================================');
  console.log('  性能分析');
  console.log('========================================');
  console.log('优化效果:');
  console.log('1. 内存存储: 项目/产品数据直接从内存读取，避免数据库查询');
  console.log('2. 请求缓存: 相同请求30-60秒内直接返回缓存结果');
  console.log('3. 缓存命中率越高，性能提升越明显');
  console.log('\n预期效果:');
  console.log('- 首次请求: 正常数据库查询速度');
  console.log('- 缓存命中: 响应时间 < 1ms');
  console.log('- 并发提升: 支持更多用户同时访问不卡顿');
}

// 运行测试
runBenchmark().catch(console.error);
