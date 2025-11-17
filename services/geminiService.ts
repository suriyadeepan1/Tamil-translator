
import { GoogleGenAI } from "@google/genai";
import { TranslationResponse, ApiError, DictionaryEntryResponse, ContextAnalysis, WordAddendum, RelatedWord } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface StreamedUpdate {
  type: 'context' | 'translationChunk' | 'addendum' | 'idiom' | 'sources' | 'error' | 'complete';
  payload: any;
}

/**
 * Extracts and parses a JSON object from a string. It's resilient to an incomplete
 * or malformed response, and trailing characters outside the main JSON object.
 * @param text The string to extract JSON from.
 * @returns The parsed JSON object.
 * @throws An error if a complete JSON object is not found or cannot be parsed.
 */
const extractAndParseJson = (text: string): any => {
  if (!text || typeof text !== 'string') {
    const safetyReason = (globalThis as any).response?.promptFeedback?.blockReason;
    if (safetyReason) {
      throw new Error(`Content Blocked: The request was blocked for safety reasons (${safetyReason}). Please modify your input.`);
    }
    throw new Error("Invalid response from API: The response was empty or not a string.");
  }
  
  let contentToParse = text;

  // Prioritize markdown block if it exists
  const markdownMatch = text.match(/```json\n([\s\S]*?)\n```/);
  if (markdownMatch && markdownMatch[1]) {
    contentToParse = markdownMatch[1];
  }

  const startIndex = contentToParse.indexOf('{');
  if (startIndex === -1) {
    console.error("Raw response did not contain a JSON object:", text);
    throw new Error("Invalid response structure from API: No JSON object found.");
  }
  
  // Find the matching closing brace for the first opening brace
  let openBraces = 0;
  let endIndex = -1;
  for (let i = startIndex; i < contentToParse.length; i++) {
    if (contentToParse[i] === '{') {
      openBraces++;
    } else if (contentToParse[i] === '}') {
      openBraces--;
    }
    
    if (openBraces === 0) {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    console.error("Could not find a complete JSON object in the response:", text);
    throw new Error("Invalid response structure from API: Malformed or incomplete JSON object.");
  }

  const jsonString = contentToParse.substring(startIndex, endIndex + 1);
  
  try {
    return JSON.parse(jsonString);
  } catch (parseError) {
    console.error("Failed to parse extracted JSON string:", jsonString);
    const message = parseError instanceof Error ? parseError.message : String(parseError);
    throw new Error(`Invalid response structure from API: JSON parsing failed. ${message}`);
  }
};


export const streamTranslationWithAddendum = async (
  tamilText: string,
  dictionary: { tamilWord: string, englishMeaning: string }[] = [],
  onUpdate: (update: StreamedUpdate) => void
): Promise<void> => {
  try {
    const dictionaryString = dictionary.length > 0
      ? `The user has provided the following custom dictionary. It is the highest authority. You MUST use the provided English meaning for any Tamil word found in this dictionary:\n${JSON.stringify(dictionary)}`
      : 'No custom dictionary provided.';

    const prompt = `
      Act as a cultural and linguistic expert specializing in Tamil. Your analysis must be informed by Google Search to ensure accuracy and real-world relevance.

      **CRITICAL RULE**: You must translate every Tamil word into its correct English meaning. DO NOT transliterate (romanize) Tamil words. For example, the Tamil word "சோசியர்" (Josier) is a loanword that means "astrologer". Do not confuse it with "social" or "social worker". Use Google Search to verify the precise meaning of all loanwords, proper nouns, and technical terms.

      First, perform a comprehensive context analysis of the provided Tamil text. Then, use that analysis to complete the subsequent tasks.

      1.  **Context Analysis**:
          -   **Tone**: Identify the tone (e.g., formal, poetic, conversational, humorous, somber).
          -   **Sentiment**: Determine the overall sentiment (e.g., positive, negative, nostalgic, critical).
          -   **Cultural Notes**: Point out any subtle cultural references, social nuances, or potential ambiguities that a non-native speaker might miss. This is crucial for a deep understanding.
          -   **Dialect**: Analyze the text for specific linguistic markers to identify a regional dialect. Look for unique vocabulary, colloquialisms, or phrasing characteristic of regions like 'Madurai Tamil', 'Jaffna Tamil', 'Tirunelveli Tamil', 'Coimbatore Tamil', or 'Chennai Tamil'. For example, does it use specific words like "என்னலே" (ennale), "பிகிலு" (bigilu), or verb endings like "-ஆங்க" (-aanga) vs. "-ஆனம்" (-aannam)? Based on these markers, state the most likely dialect. If no specific markers are found, return 'General Tamil'.

      2.  **Informed Translation**: Based *directly* on your context analysis and adhering strictly to the CRITICAL RULE above, provide a fluent, culturally-aware English translation. Your word choices should reflect the identified tone and sentiment. When streaming the translation via "translationChunk" objects, you MUST preserve all paragraph breaks from the original text by including "\\n" characters in the JSON data string. ${dictionaryString}

      3.  **Idiom Analysis**: Scan the text for any idiomatic phrases or proverbs. If one is found, create an 'idiom' object with the specific Tamil phrase itself in the 'phrase' field, its literal vs. figurative meanings in the 'explanation' field, and a direct English translation of just the phrase in the 'translation' field. If no idiom is found, do not output an object for it.

      4.  **Word Deep Dive (Addendum)**: Identify 3-5 key words with deep cultural, literary, or regional significance. For each word, provide a detailed addendum.
          -   The 'word' field MUST contain the Tamil word.
          -   The 'englishWord' field MUST contain its primary, single-word or short-phrase English equivalent (e.g., 'Respect' for 'மரியாதை').
          -   This addendum MUST include specific dialectal variations. Go beyond common dialects and focus on **lesser-known regional variations** from Tamil Nadu and Sri Lanka (e.g., Kongu Nadu, Nellai, Nanjil Nadu, Batticaloa, Up-Country Tamil). For each variation, you MUST structure it as an object within a 'variations' array. Each object in the array must contain: a 'dialect' key (e.g., 'Tirunelveli Tamil'), either a 'vocabulary' key OR a 'pronunciation' key explaining the difference, and an 'example' key containing an object with "tamil" and "english" keys for the sentence and its translation. Furthermore, analyze the word's etymology in the 'origin' field. If it has a **complex origin** (e.g., a loanword or significant meaning shifts over time), you MUST also provide a structured \`etymology\` field as an array of steps, where each step includes an \`era\`, \`language\`, and \`note\`. If the origin is simple, this field should be \`null\`.
          -   For each deep-dive word, also provide 2-3 **related Tamil words**. Each related word MUST be an object containing the 'word' (English), 'tamilWord', and a 'reason' explaining its connection to the deep-dive word. This MUST be an array of objects in a \`relatedWords\` field. If no relevant words are found, provide an empty array \`[]\`.

      Tamil Text:
      ---
      ${tamilText}
      ---
      
      Your entire response MUST be a stream of one valid JSON object per line. Do not include any text, markdown, or explanations outside of these JSON objects. Each JSON object must have a "type" field and a "data" field.

      The stream MUST follow this sequence and structure:
      1.  A single object with type "contextAnalysis" and "data" containing the analysis.
      2.  Multiple objects with type "translationChunk", where "data" is a string snippet of the full translation.
      3.  (If found) One object with type "idiom" and "data" for the idiom analysis.
      4.  Multiple objects with type "addendum", one for each key word deep dive.
      5.  A final object with type "end" and an empty "data" object to signal completion.

      Example of the exact streaming output format for a two-paragraph input:
      {"type": "contextAnalysis", "data": { "tone": "...", "sentiment": "...", "culturalNotes": "...", "dialect": "..." }}
      {"type": "translationChunk", "data": "This is the first paragraph. "}
      {"type": "translationChunk", "data": "It can have multiple sentences."}
      {"type": "translationChunk", "data": "\\n\\nThis is the second paragraph."}
      {"type": "addendum", "data": { "word": "மரியாதை", "englishWord": "Respect", "meaning": "...", "variations": [{"dialect": "Tirunelveli Tamil", "pronunciation": "The word is pronounced with a softer 'r' sound.", "example": {"tamil": "அவருக்கு ரெம்ப மரியாதை குடுத்தேன்.", "english": "I gave him a lot of respect."}}], "example": { "tamil": "...", "english": "..." }, "origin": "...", "etymology": null, "relatedWords": [{"word": "Honor", "tamilWord": "கௌரவம்", "reason": "A synonym often used in formal contexts to denote high respect."}] }}
      {"type": "end", "data": {}}
    `;

    const responseStream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{googleSearch: {}}],
        temperature: 0.2,
      },
    });

    let buffer = '';
    for await (const chunk of responseStream) {
      buffer += chunk.text;
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.substring(0, newlineIndex).trim();
        buffer = buffer.substring(newlineIndex + 1);
        if (line) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.type && parsed.data) {
                if (parsed.type === 'end') {
                    const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
                    let sources: { uri: string; title: string; }[] = [];
                    if (groundingChunks) {
                      const uniqueSources = new Map<string, string>();
                      groundingChunks.forEach((chunk: any) => {
                        if (chunk.web && chunk.web.uri) {
                          if (!uniqueSources.has(chunk.web.uri)) {
                            uniqueSources.set(chunk.web.uri, chunk.web.title || chunk.web.uri);
                          }
                        }
                      });
                      sources = Array.from(uniqueSources, ([uri, title]) => ({ uri, title }));
                      onUpdate({ type: 'sources', payload: sources });
                    }
                    onUpdate({ type: 'complete', payload: null });
                    return;
                } else {
                     onUpdate({ type: parsed.type, payload: parsed.data });
                }
            }
          } catch (e) {
            console.warn("Could not parse streaming JSON line:", line, e);
          }
        }
      }
    }
    // Handle any remaining buffer content if the stream ends without a newline
    if (buffer.trim()) {
        try {
            const parsed = JSON.parse(buffer.trim());
            if (parsed.type === 'end') {
                onUpdate({ type: 'complete', payload: null });
            }
        } catch (e) {
             console.warn("Could not parse final streaming buffer:", buffer.trim(), e);
        }
    }


  } catch (error) {
    console.error("Error calling Gemini API:", error);

    let apiError: ApiError = {
      title: "An Unknown Error Occurred",
      message: "Something went wrong while communicating with the AI. Please try again later.",
      isRetryable: true,
    };

    if (error instanceof Error) {
      const errorMessage = error.message;

      if (errorMessage.includes('api_key') || errorMessage.includes('permission denied')) {
        apiError = {
          title: "Authentication Error",
          message: "The API key is invalid or missing. Please ensure it's configured correctly.",
          isRetryable: false,
        };
      } else if (errorMessage.includes('network') || errorMessage.includes('failed to fetch')) {
        apiError = {
          title: "Network Issue",
          message: "Could not connect to the translation service. Please check your internet connection and try again.",
          isRetryable: true,
        };
      } else if (errorMessage.includes('Invalid response structure')) {
         apiError = {
          title: "Invalid Response",
          message: "The AI returned data in an unexpected format. This might be a temporary issue.",
          isRetryable: true,
        };
      } else if (errorMessage.includes('400 bad request') || errorMessage.includes('invalid argument')) {
          apiError = {
            title: "Invalid Input",
            message: "The text provided could not be processed. Please check for any unusual characters or formatting.",
            isRetryable: false
          }
      } else if (errorMessage.includes('Content Blocked')) {
          apiError = {
            title: "Content Blocked",
            message: "The request was blocked by the content filter. Please try rephrasing your text.",
            isRetryable: false
          }
      } else {
        // Keep a generic message for other errors, but use the error message from the exception
         apiError.message = `Failed to get translation: ${error.message}`;
      }
    }
    onUpdate({type: 'error', payload: apiError});
  }
};


export const getDictionaryEntry = async (tamilWord: string): Promise<DictionaryEntryResponse> => {
  try {
    const prompt = `
      Using Google Search for accuracy, provide a concise dictionary entry for the following Tamil word.
      Give me its primary English keyword, its meaning in Tamil, and its meaning in English.

      Tamil Word: "${tamilWord}"

      Your response MUST be a single, valid JSON object formatted as follows, with no other text or markdown.
      {
        "englishWord": "string (the primary English equivalent, e.g., 'Respect')",
        "tamilMeaning": "string",
        "englishMeaning": "string (a more detailed definition in English)"
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{googleSearch: {}}],
        temperature: 0.1,
      },
    });
    
    if (!response.text) {
        throw new Error('The AI returned an empty response for the dictionary entry.');
    }
    const parsedResponse = extractAndParseJson(response.text);

    if (parsedResponse.englishWord && parsedResponse.tamilMeaning && parsedResponse.englishMeaning) {
      return parsedResponse as DictionaryEntryResponse;
    } else {
      throw new Error("Invalid response structure from API for dictionary entry.");
    }

  } catch (error) {
    console.error(`Error fetching dictionary entry for "${tamilWord}":`, error);
    if (error instanceof Error && error.message.toLowerCase().includes('api_key')) {
         throw new Error("Authentication failed. Check your API key.");
    }
    throw new Error(`Could not find a definition for "${tamilWord}". Please check the spelling or try another word.`);
  }
};

export const getTamilMeaning = async (tamilWord: string): Promise<string> => {
  try {
    const prompt = `
      Using Google Search for accuracy, provide a concise dictionary definition in Tamil for the following Tamil word.

      Tamil Word: "${tamilWord}"

      Your response MUST be a single, valid JSON object formatted as follows, with no other text or markdown.
      {
        "tamilMeaning": "string"
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{googleSearch: {}}],
        temperature: 0.1,
      },
    });

    if (!response.text) {
        throw new Error('The AI returned an empty response for the Tamil meaning.');
    }
    const parsedResponse = extractAndParseJson(response.text);

    if (parsedResponse.tamilMeaning && typeof parsedResponse.tamilMeaning === 'string') {
      return parsedResponse.tamilMeaning;
    } else {
      throw new Error("Invalid response structure from API for Tamil meaning.");
    }
  } catch (error) {
    console.error(`Error fetching Tamil meaning for "${tamilWord}":`, error);
    if (error instanceof Error && error.message.toLowerCase().includes('api_key')) {
         throw new Error("Authentication failed. Check your API key.");
    }
    throw new Error(`Could not find a Tamil definition for "${tamilWord}".`);
  }
};