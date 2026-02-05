import { GoogleGenAI } from "@google/genai";

// Use the API key from the environment
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to strip the data:image/png;base64, prefix
const cleanBase64 = (dataUrl: string) => {
  return dataUrl.split(',')[1];
};

export const generateRelitImage = async (
  originalImageBase64: string,
  maskImageBase64: string,
  count: number = 1
): Promise<string[]> => {
  try {
    const model = 'gemini-3-pro-image-preview';

    const prompt = `
      You are an expert photo editor and lighting artist.
      
      Task: Relight the source image based on the provided lighting guide mask.
      
      Inputs:
      1. Source Image: The original photo.
      2. Lighting Guide: A transparent overlay where colored strokes indicate light sources.
      
      Interpretation of the Guide:
      - **Color**: The color of the stroke represents the color of the light source.
      - **Shape**: The shape of the stroke represents the type/form of the light source.
      
      Instructions:
      - Keep the composition and objects of the Source Image exactly the same.
      - Apply lighting effects strictly where the strokes are drawn in the Lighting Guide.
      - The light color MUST match the stroke color.
      - Calculate shadows realistically.
      - Output a high-quality, photorealistic result.
    `;

    // Prepare content parts
    const parts = [
      { text: prompt },
      {
        inlineData: {
          mimeType: 'image/png',
          data: cleanBase64(originalImageBase64),
        },
      },
      {
        inlineData: {
          mimeType: 'image/png',
          data: cleanBase64(maskImageBase64),
        },
      },
    ];

    console.log(`Generating ${count} image(s) with ${model}...`);

    // Create an array of promises to run generations in parallel
    // Note: We create a new client instance inside the loop if needed, 
    // but reusing the client is fine. We execute N requests.
    const requests = Array.from({ length: count }).map(async () => {
       const freshAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
       return freshAi.models.generateContent({
        model: model,
        contents: { parts },
        config: {
          imageConfig: {
            imageSize: '2K'
          }
        }
      });
    });

    const responses = await Promise.all(requests);
    const images: string[] = [];

    // Extract images from all responses
    for (const response of responses) {
      const candidates = response.candidates || [];
      for (const candidate of candidates) {
        const parts = candidate.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData && part.inlineData.data) {
            images.push(`data:image/png;base64,${part.inlineData.data}`);
          }
        }
      }
    }

    if (images.length === 0) {
      throw new Error("No images generated.");
    }

    return images;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};