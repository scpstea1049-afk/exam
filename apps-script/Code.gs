/**
 * GAS Web App entry point.
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.bridge === '1') {
    return doGetApiBridge_();
  }
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('108課綱素養導向測驗生成器 (Gemini 2.5 Flash)')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Serves the hidden bridge used by the GitHub Pages front end. */
function doGetApiBridge_() {
  const allowedOrigin = PropertiesService.getScriptProperties().getProperty('GITHUB_PAGES_ORIGIN');
  const template = HtmlService.createTemplateFromFile('ApiBridge');
  template.allowedParentOrigin = allowedOrigin && /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(allowedOrigin)
    ? allowedOrigin
    : '';
  return template.evaluate()
    .setTitle('測驗生成服務連線')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Generates quiz content. The API key is read from Script Properties so the
 * browser does not need to collect or send a key for each request.
 * Front-end call: google.script.run.generateQuizContent({ prompt, options })
 *
 * Configure Script Properties with the name GEMINI_API_KEY.
 * @param {{text: string, options: Object}} data
 * @return {string}
 */
function generateQuizContent(data) {
  data = data || {};
  const text = String(data.text || '').trim();
  const options = data.options || {};
  const clientPrompt = String(data.prompt || '').trim();
  if (!clientPrompt && !text) {
    throw new Error('請先輸入或上傳教材內容。');
  }

  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('系統尚未設定 Gemini API Key，請聯絡網站管理者。');
  }

  // Use the detailed grade-level prompt built by Index.html. Keep the text and
  // options path as a fallback for older front-end versions.
  const prompt = clientPrompt || constructPrompt(text, options);
  if (!prompt) {
    throw new Error(text ? '請至少選擇一種題型。' : '請先輸入或上傳教材內容。');
  }

  const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    'gemini-2.5-flash:generateContent?key=' + encodeURIComponent(apiKey);
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192
    }
  };

  let response;
  try {
    response = UrlFetchApp.fetch(apiUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (error) {
    console.error('Gemini request failed: ' + error);
    throw new Error('目前無法連線至 Gemini，請稍後再試。');
  }

  let result;
  try {
    result = JSON.parse(response.getContentText());
  } catch (error) {
    throw new Error('Gemini 回傳了無法辨識的資料，請稍後再試。');
  }

  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300 || result.error) {
    const message = result.error && result.error.message ? result.error.message : '';
    if (/model.*not found|not found.*model/i.test(message) || response.getResponseCode() === 404) {
      throw new Error('Gemini 2.5 Flash 模型目前無法使用，請管理者檢查模型或 API 權限。');
    }
    console.error('Gemini API error: ' + message);
    throw new Error(message || 'Gemini API 呼叫失敗，請稍後再試。');
  }

  const candidate = result.candidates && result.candidates[0];
  const parts = candidate && candidate.content && candidate.content.parts;
  const output = parts ? parts.map(function(part) { return part.text || ''; }).join('').trim() : '';
  if (!output) {
    throw new Error('Gemini 未能生成內容，請調整教材或稍後再試。');
  }
  return output;
}

/**
 * Builds a prompt according to the selected quiz options.
 */
function constructPrompt(text, options) {
  options = options || {};
  let taskInstructions = '';
  let partCount = 1;

  if (options.reading) {
    taskInstructions += `
${partCount}. **PART ${partCount}: 素養閱讀文本 (情境化改寫)**
    * 請將上述教材的知識點，轉化為一篇約 600-800 字的文章。
    * **關鍵要求：** 文章必須具備「生活情境」或「解決問題」的脈絡（例如：將科學原理應用於環保議題，或將歷史事件連結到現代社會現象）。
    * 請標示此文本對應的核心素養面向（自主行動、溝通互動、或社會參與）。
    * 請在文中適當位置加入[圖表描述]，模擬課本圖表。
`;
    partCount++;
  }

  if (options.trueFalse) {
    taskInstructions += `
${partCount}. **PART ${partCount}: 基礎觀念檢核 (是非題 x 5)**
    * 針對基礎知識與閱讀文本進行檢核。
    * 格式請使用：
      1. (O/X) 題目敘述
         * 詳解：解釋正確或錯誤的原因...
`;
    partCount++;
  }

  if (options.multipleChoice) {
    taskInstructions += `
${partCount}. **PART ${partCount}: 素養導向選擇題 (單選題 x 5)**
    * 題目設計需符合 108 課綱精神，強調「理解、應用、分析」。
    * **務必包含**至少一題圖表判讀題（以文字詳細描述圖表內容讓學生判斷）或跨領域題。
    * 格式請使用：
        1. 題目情境敘述...
        (A) 選項 A
        (B) 選項 B
        (C) 選項 C
        (D) 選項 D
        * 正確答案：X
        * 解析：說明為何該答案符合素養指標，以及其他選項為何錯誤。
`;
    partCount++;
  }

  if (!taskInstructions) return null;

  return `
你是一位精通台灣「十二年國民基本教育課程綱要」（108課綱）的資深課程設計專家。
請依據以下提供的教材內容，生成一份給學生的「素養導向評量」。

**教材內容：**
${text}

**生成任務要求：**
${taskInstructions}

**輸出格式要求：**
請直接輸出內容，保持格式清晰，使用 Markdown 風格的標題 (例如 ###, **粗體**)。不要輸出任何程式碼區塊符號。
`;
}
