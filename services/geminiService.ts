import { GoogleGenAI, Type } from "@google/genai";
import { Document, QcmDifficulty } from "../types";

const apiKey = process.env.API_KEY;
// Note: We create the client inside functions or check existence to handle key selection if needed,
// but per instructions, we assume process.env.API_KEY is available.
const ai = new GoogleGenAI({ apiKey: apiKey || '' });

export interface GeneratedQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

export const generateQcmFromText = async (text: string, count: number = 5): Promise<GeneratedQuestion[]> => {
  if (!apiKey) throw new Error("API Key missing");

  const modelId = "gemini-3-flash-preview"; 

  const prompt = `
    Analyze the following text and generate ${count} multiple-choice questions (MCQs) to test understanding.
    
    Text content:
    "${text.substring(0, 10000)}" 
    
    Requirements:
    1. Questions should cover key concepts.
    2. Provide 4 options for each question.
    3. Vary difficulty (easy, medium, hard).
    4. Return strictly valid JSON.
  `;

  const response = await ai.models.generateContent({
    model: modelId,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            options: { 
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            correctIndex: { type: Type.INTEGER, description: "Index of the correct option (0-3)" },
            difficulty: { type: Type.STRING, enum: ["easy", "medium", "hard"] }
          },
          required: ["question", "options", "correctIndex", "difficulty"]
        }
      }
    }
  });

  if (response.text) {
    return JSON.parse(response.text) as GeneratedQuestion[];
  }
  return [];
};

export const chatWithDocuments = async (
  query: string, 
  history: {role: 'user' | 'model', content: string}[],
  documents: Document[]
): Promise<string> => {
  if (!apiKey) throw new Error("API Key missing");

  // Create a context from documents
  const context = documents.map(d => `Document Title: ${d.title}\nContent: ${d.content}`).join("\n\n");

  const systemInstruction = `
    You are an intelligent study assistant named SmartRecall AI.
    Your goal is to help the user understand their study materials.
    
    Reference Material:
    ${context}
    
    Instructions:
    - Answer the user's question primarily based on the provided Reference Material.
    - If the answer isn't in the documents, state that, but offer general knowledge if helpful (explicitly mentioning it's outside the provided notes).
    - Be concise, encouraging, and educational.
  `;

  // Filter history to last 10 messages to save tokens and keep context relevant
  const recentHistory = history.slice(-10);

  // Use simple generateContent for single-turn logic with context injection, 
  // or chat if we want to maintain session. Given the stateless nature of the service call,
  // we will construct the prompt with history manually or use the chat helper.
  
  // Using generateContent with manual history construction for full control over context injection
  const contents = [
    ...recentHistory.map(h => ({ role: h.role, parts: [{ text: h.content }] })),
    { role: 'user', parts: [{ text: query }] }
  ];

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: contents,
    config: {
      systemInstruction: systemInstruction,
    }
  });

  return response.text || "I couldn't generate a response.";
};
