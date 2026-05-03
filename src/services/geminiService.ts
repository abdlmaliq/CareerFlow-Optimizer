import { GoogleGenAI } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

const getAI = () => {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === 'undefined' || key === 'null') {
      throw new Error('GEMINI_API_KEY is missing. Please ensure it is set in the environment.');
    }
    aiInstance = new GoogleGenAI({ apiKey: key });
  }
  return aiInstance;
};

// Daily usage tracking
const DAILY_LIMIT = 5;
const STORAGE_KEY = 'career_flow_usage_v1';

interface UsageData {
  count: number;
  lastResetDate: string; // YYYY-MM-DD
}

export const checkDailyLimit = (): { allowed: boolean; remaining: number } => {
  const today = new Date().toISOString().split('T')[0];
  const stored = localStorage.getItem(STORAGE_KEY);
  
  let data: UsageData = stored ? JSON.parse(stored) : { count: 0, lastResetDate: today };
  
  if (data.lastResetDate !== today) {
    data = { count: 0, lastResetDate: today };
  }
  
  return {
    allowed: data.count < DAILY_LIMIT,
    remaining: Math.max(0, DAILY_LIMIT - data.count)
  };
};

export const incrementUsage = () => {
  const today = new Date().toISOString().split('T')[0];
  const stored = localStorage.getItem(STORAGE_KEY);
  let data: UsageData = stored ? JSON.parse(stored) : { count: 0, lastResetDate: today };
  
  if (data.lastResetDate !== today) {
    data.count = 1;
    data.lastResetDate = today;
  } else {
    data.count += 1;
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

const handleGeminiError = (error: any) => {
  console.error("Gemini Error Context:", error);
  const errorMessage = error?.message || "";
  
  if (errorMessage.includes("API_KEY")) {
    return "Invalid API key configuration. Please contact support or check settings.";
  }
  
  if (errorMessage.includes("429") || errorMessage.toLowerCase().includes("quota")) {
    return "Model rate limit reached. Please wait a moment before trying again.";
  }
  
  if (errorMessage.toLowerCase().includes("safety") || errorMessage.toLowerCase().includes("candidate")) {
    return "The AI safety filters blocked this request. Try adjusting your input.";
  }

  return "The AI engine encountered an issue. Please try clicking 'Retry Stage'.";
};

export type OptimizationStage = 1 | 2 | 3 | 4 | 5 | 6;

const STAGE_SYSTEM_PROMPTS: Record<OptimizationStage, string> = {
  1: `Act as a senior recruiter and resume strategist. Rewrite the entire resume to be fully tailored to the JD.
Requirements:
• Return the FULL updated resume in Markdown.
• Mirror the language, keywords, and priorities in the JD.
• Reorder bullet points based on relevance to the role.
• Rewrite each bullet to show impact (Action + Task + Result).
• Integrate ATS keywords naturally.
• Keep formatting clean and professional.`,
  
  2: `Rewrite the work experience section to directly match the role.
Requirements:
• Return the FULL updated resume in Markdown.
• For each role, rewrite bullets using: Action verb + Task + Method + Result.
• Quantify results (%, $, time saved).
• Limit to 3–5 high-impact bullets per role.
• Sound like this experience directly prepared the candidate for this specific job.`,

  3: `Optimize for ATS (Applicant Tracking Systems).
Requirements:
• Return the FULL updated resume in Markdown.
• Inject top keywords, skills, and competencies from the JD naturally.
• Ensure readability for human recruiters while scoring high for scanners.
• Highlight relevant tools and technical skills prominently.
• At the end of the document, add a separator "--- ATS HIGHLIGHTS ---" followed by the top keywords used.`,

  4: `Identify gaps and reframe experience.
Requirements:
• Return the FULL updated resume in Markdown.
• Use transferable skills to cover any experience gaps identified from the JD.
• Adjust wording to industry-specific language.
• Suggest subtle additions based on common industry experience (without fabricating).`,

  5: `Write a powerful professional summary.
Requirements:
• Return the FULL updated resume in Markdown.
• Create a 3–4 line professional summary at the top.
• Include years of experience, specialization, and key strengths matching the JD.
• Positioning the candidate as an immediate fit for this specific role.`,

  6: `Act as a hiring manager. Final polish for a Top 1% candidate profile.
Requirements:
• Return the FINAL, perfectly polished resume in clean Markdown.
• Ensure the tone is executive, confident, and precise.
• The formatting must be immaculate (Consulting/Big 4 standard).
• Include a clear contact info placeholder at the top if missing.
• At the very bottom of the response, after a "--- BENCHMARK ---" separator, provide a ranking (e.g., Top 5%) and 3 final improvement tips to stay competitive.`
};

export async function optimizeResumeStage(
  stage: OptimizationStage,
  cvText: string,
  jdText: string,
  previousOutputs: string[]
) {
  const currentPrompt = STAGE_SYSTEM_PROMPTS[stage];
  const prompt = `
Context:
Job Description:
${jdText}

Current Resume State:
${stage === 1 ? cvText : previousOutputs[stage - 2]}

Instructions:
${currentPrompt}

Please provide your output in clean Markdown format.
`;

  try {
    const ai = getAI();
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    if (!result.text) {
      throw new Error("The AI returned an empty response.");
    }

    return result.text;
  } catch (error) {
    throw new Error(handleGeminiError(error));
  }
}

export async function generateCoverLetter(cvText: string, jdText: string) {
  const prompt = `
Context:
Job Description:
${jdText}

Candidate Resume:
${cvText}

Instructions:
You are a cover letter generator. Your task is to create a humanized and concise cover letter. To compose a compelling cover letter, you must scrutinise the job description for key qualifications. Begin with a succinct introduction about the candidate's identity and career goals. Highlight skills aligned with the job, underpinned by tangible examples. Incorporate details about the company, emphasising its mission or unique aspects that align with the candidate's values. Conclude by reaffirming the candidate's suitability, inviting further discussion. Use job-specific terminology for a tailored and impactful letter, maintaining a professional style suitable for the job role. Please provide your response in under 350 words.

Please provide your output in clean Markdown format.
`;

  try {
    const ai = getAI();
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    if (!result.text) {
      throw new Error("The AI returned an empty response.");
    }

    return result.text;
  } catch (error) {
    throw new Error(handleGeminiError(error));
  }
}
