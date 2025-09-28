const storage = require('./storage');

// 工具函数
function sleep(ms) { 
  return new Promise(resolve => setTimeout(resolve, ms)); 
}

// 获取API密钥
function getApiKey() {
  try {
    const settings = storage.getSettings() || {};
    if (settings.deepseekApiKey) {
      return settings.deepseekApiKey.trim();
    }
    
    // 尝试从扩展配置获取
    const extConfig = wx.getExtConfigSync ? wx.getExtConfigSync() : {};
    if (extConfig && extConfig.DEEPSEEK_API_KEY) {
      return extConfig.DEEPSEEK_API_KEY.trim();
    }
    
    return '';
  } catch (error) {
    console.error('获取API密钥失败:', error);
    return '';
  }
}

// 版本比较函数
function compareVersion(v1, v2) {
  const arr1 = v1.split('.');
  const arr2 = v2.split('.');
  const len = Math.max(arr1.length, arr2.length);

  while (arr1.length < len) arr1.push('0');
  while (arr2.length < len) arr2.push('0');

  for (let i = 0; i < len; i++) {
    const num1 = parseInt(arr1[i]);
    const num2 = parseInt(arr2[i]);

    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }

  return 0;
}

// 获取系统信息（兼容新旧API）
function getSystemInfo() {
  try {
    if (wx.getSystemSetting) {
      return wx.getSystemSetting();
    }
    if (wx.getSystemInfoSync) {
      return wx.getSystemInfoSync();
    }
    return { SDKVersion: '2.31.0' }; // 默认版本
  } catch (error) {
    console.warn('获取系统信息失败:', error);
    return { SDKVersion: '2.31.0' };
  }
}

// 云函数代理请求
async function callProxy(body) {
  if (!wx.cloud || !wx.cloud.callFunction) {
    return null;
  }
  
  try {
    console.log('尝试云函数请求');
    const { result } = await wx.cloud.callFunction({ 
      name: 'chatProxy', 
      data: { body } 
    });
    
    if (result && result.ok) {
      console.log('云函数请求成功');
      return result.data;
    }
    
    return null;
  } catch (error) {
    console.warn('云函数请求失败:', error);
    return null;
  }
}

// 直接调用DeepSeek API
function callDeepSeekAPI(body, apiKey) {
  return new Promise((resolve, reject) => {
    console.log('开始直接调用DeepSeek API');
    
    const requestConfig = {
      url: 'https://api.deepseek.com/chat/completions',
      method: 'POST',
      data: body,
      header: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${apiKey}`
      },
      timeout: 30000,
      success: (response) => {
        console.log('API请求成功，状态码:', response.statusCode);
        
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data);
        } else {
          const errorMessage = getErrorMessage(response.statusCode, response.data);
          reject(new Error(errorMessage));
        }
      },
      fail: (error) => {
        console.error('API请求失败:', error);
        const errorMessage = error.errMsg || '网络连接失败，请检查网络设置';
        reject(new Error(errorMessage));
      }
    };

    wx.request(requestConfig);
  });
}

// 获取错误消息
function getErrorMessage(statusCode, responseData) {
  console.log('处理错误，状态码:', statusCode, '响应数据:', responseData);
  
  switch (statusCode) {
    case 401:
      return 'API密钥无效，请检查设置';
    case 402:
      console.warn('API余额不足');
      return 'API余额不足，请充值后重试';
    case 429:
      return '请求过于频繁，请稍后再试';
    case 500:
      return 'DeepSeek服务暂时不可用，请稍后重试';
    case 503:
      return 'DeepSeek服务繁忙，请稍后重试';
    default:
      const errorMsg = responseData?.error?.message || 
                      responseData?.message || 
                      `HTTP ${statusCode} 错误`;
      return errorMsg;
  }
}

// 流式聊天请求
function chatCompletionStream(body, callbacks = {}) {
  const { onMessage, onDone, onError } = callbacks;
  const apiKey = getApiKey();
  
  if (!apiKey) {
    const error = new Error('未配置API密钥，无法使用流式聊天');
    onError && onError(error);
    return { abort: () => {} };
  }

  // 检查基础库版本
  const systemInfo = getSystemInfo();
  const version = systemInfo.SDKVersion || '2.31.0';
  const supportsStreaming = compareVersion(version, '2.31.0') >= 0;

  if (!supportsStreaming) {
    console.warn('基础库版本过低，不支持流式请求');
    const error = new Error('基础库版本过低，不支持流式请求');
    onError && onError(error);
    return { abort: () => {} };
  }

  // 创建控制器
  const controller = { 
    aborted: false, 
    abort: () => { 
      controller.aborted = true; 
      if (task) task.abort(); 
    } 
  };

  const streamBody = { ...body, stream: true };
  let buffer = '';
  let task = null;

  try {
    console.log('开始流式请求');
    
    task = wx.request({
      url: 'https://api.deepseek.com/chat/completions',
      method: 'POST',
      enableChunked: true,
      data: streamBody,
      header: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'text/event-stream'
      },
      timeout: 60000,
      onChunkReceived: (response) => {
        if (controller.aborted) return;
        
        try {
          let chunk = '';
          
          // 处理数据块
          if (typeof TextDecoder !== 'undefined') {
            const decoder = new TextDecoder('utf-8');
            chunk = decoder.decode(response.data, { stream: true });
          } else {
            chunk = response.data || '';
          }
          
          if (!chunk) return;
          
          console.log('收到流式数据:', chunk.substring(0, 100));
          buffer += chunk;
          
          // 处理SSE数据
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) return;
            
            const dataStr = trimmed.replace(/^data:\s*/, '');
            if (dataStr === '[DONE]') {
              console.log('流式请求完成');
              onDone && onDone();
              return;
            }
            
            try {
              const json = JSON.parse(dataStr);
              const delta = json?.choices?.[0]?.delta?.content || '';
              if (delta && onMessage) {
                onMessage(delta);
              }
            } catch (parseError) {
              console.warn('解析JSON失败:', parseError);
            }
          });
          
        } catch (error) {
          console.error('处理流式数据失败:', error);
          onError && onError(error);
        }
      },
      success: () => {
        if (!controller.aborted) {
          console.log('流式请求成功完成');
          onDone && onDone();
        }
      },
      fail: (error) => {
        if (!controller.aborted) {
          console.error('流式请求失败:', error);
          onError && onError(error);
        }
      }
    });
    
  } catch (error) {
    console.error('创建流式请求失败:', error);
    onError && onError(error);
  }

  return controller;
}

// 普通聊天请求
async function chatCompletion(body) {
  console.log('开始普通聊天请求');
  
  // 优先尝试云函数
  try {
    const proxyResult = await callProxy(body);
    if (proxyResult) {
      return proxyResult;
    }
  } catch (error) {
    console.warn('云函数请求失败:', error);
  }
  
  // 直接调用DeepSeek API
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('未配置API密钥');
  }
  
  try {
    const result = await callDeepSeekAPI(body, apiKey);
    console.log('DeepSeek API调用成功');
    return result;
  } catch (error) {
    console.error('DeepSeek API调用失败:', error);
    throw error;
  }
}

// 清空聊天记录
async function clearChat() {
  return { ok: true, local: true };
}

// 导出模块
module.exports = { 
  chatCompletion, 
  chatCompletionStream, 
  clearChat 
};