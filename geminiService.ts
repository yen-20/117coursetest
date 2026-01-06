
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const getAssignmentFeedback = async (
  assignmentContent: string,
  assignmentTitle: string
): Promise<string> => {
  if (!process.env.API_KEY) {
    console.warn("API Key is missing. Returning mock response.");
    return "API Key 未設定。作業寫得不錯，請繼續努力！";
  }

  try {
    const prompt = `
      你是一位親切且專業的老師。學生剛提交了一份標題為「${assignmentTitle}」的心得作業。
      內容如下：
      "${assignmentContent}"

      請給予這位學生 50-100 字左右的建設性回饋。
      語氣要鼓勵、正面，並具體指出一個優點和一個可以改進的地方。
      直接以老師的口吻回覆，不需要開頭問候。
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "無法產生回饋，請稍後再試。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "系統暫時無法產生 AI 回饋，請聯絡老師。";
  }
};
