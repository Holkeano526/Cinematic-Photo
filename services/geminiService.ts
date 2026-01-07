
import { GoogleGenAI } from "@google/genai";
import { ModelType, GenerationConfig } from "../types";

export class GeminiService {
  private static instance: GeminiService;
  
  private constructor() {}

  public static getInstance(): GeminiService {
    if (!this.instance) {
      this.instance = new GeminiService();
    }
    return this.instance;
  }

  /**
   * Generates or edits an image using the specified Gemini model.
   */
  public async generateImage(
    prompt: string,
    modelType: ModelType,
    referenceImageBase64?: string,
    config: GenerationConfig = { aspectRatio: "1:1" }
  ): Promise<string> {
    // Correctly initialize with API_KEY from process.env directly. 
    // Guidelines: Create a new instance right before making an API call.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

    const contents: any = {
      parts: [
        { text: prompt }
      ]
    };

    if (referenceImageBase64) {
      contents.parts.unshift({
        inlineData: {
          data: referenceImageBase64.split(',')[1] || referenceImageBase64,
          mimeType: 'image/jpeg'
        }
      });
    }

    try {
      const response = await ai.models.generateContent({
        model: modelType,
        contents,
        config: {
          imageConfig: modelType === ModelType.PRO ? {
            aspectRatio: config.aspectRatio,
            imageSize: config.imageSize || "1K"
          } : {
            aspectRatio: config.aspectRatio
          }
        }
      });

      let imageUrl = '';
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            imageUrl = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }
      }

      if (!imageUrl) {
        throw new Error("No image data found in model response.");
      }

      return imageUrl;
    } catch (error: any) {
      console.error("Gemini Image Generation Error:", error);
      
      // Handle the specific error mentioned in instructions for re-triggering key selection
      if (error.message?.includes("Requested entity was not found.")) {
        throw new Error("API_KEY_ERROR");
      }
      
      throw error;
    }
  }
}
