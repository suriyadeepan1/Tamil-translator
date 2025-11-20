
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
      ? `*** IMPORTANT: CUSTOM DICTIONARY OVERRIDE ***
         The user has provided a custom dictionary. You MUST perform a lookup before translating.
         If any word in the input text matches a 'tamilWord' in the list below, you MUST use the provided 'englishMeaning' in your translation.
         Do NOT use a synonym. Do NOT transliterate. Use the exact English definition provided.
         Dictionary Data: ${JSON.stringify(dictionary)}`
      : 'No custom dictionary provided.';

    const prompt = `
      Act as a cultural and linguistic expert specializing in Tamil. Your analysis must be informed by Google Search to ensure accuracy and real-world relevance.

      **CRITICAL TRANSLATION RULES**: 
      1. You must translate every Tamil word into its correct English meaning. 
      2. **DO NOT TRANSLITERATE** (romanize) Tamil words unless they are proper names (like person names).
         - INCORRECT: "சோசியர்" translated as "Josier".
         - CORRECT: "சோசியர்" translated as "Astrologer".
         - INCORRECT: "பஸ்" translated as "Bus" (if written as 'Bass').
         - CORRECT: "பஸ்" translated as "Bus".
      3. Use Google Search to verify the precise meaning of all loanwords, proper nouns, and technical terms to avoid "Tanglish" transliteration errors.

      First, perform a comprehensive context analysis of the provided Tamil text. Then, use that analysis to complete the subsequent tasks.

      1.  **Context Analysis**:
          -   **Tone**: Identify the tone (e.g., formal, poetic, conversational, humorous, somber).
          -   **Sentiment**: Determine the overall sentiment (e.g., positive, negative, nostalgic, critical).
          -   **Cultural Notes**: Point out any subtle cultural references, social nuances, or potential ambiguities that a non-native speaker might miss. **Crucially, if a dialect is identified, you MUST cite the specific word(s) or phrase(s) from the input text that led to your conclusion here.**
          -   **Dialect Identification (HIGH PRIORITY)**: Perform a deep linguistic analysis to identify the most probable regional dialect. You MUST justify your conclusion with specific evidence from the text (to be included in the 'Cultural Notes' above).
              -   **Methodology**:
                  1.  Scan for **lexical markers** (unique vocabulary and slang).
                  2.  Scan for **phonological markers** (indicated by spelling choices that reflect pronunciation).
                  3.  Scan for **grammatical markers** (unique verb conjugations, suffixes, particles, or sentence structures).
              -   **Dialect Cheat Sheet (Use these examples to guide your analysis):**
                  *   **Tirunelveli / Nellai Tamil**: Look for words like "அண்ணாச்சி" (annachi), the suffix "-லே" (e.g., "என்னலே" - ennale), informal address like "ஏலே" (elae), and fast-paced speech patterns. Question form "என்னா?" (enna?) instead of "என்ன?" (enna?).
                  *   **Madurai Tamil**: Characterized by a drawn-out tone. Look for words like "அங்கன" (angana) for "அங்கே" (ange), "இங்கன" (ingana) for "இங்கே" (inge), "பைய" (paiya) for 'slowly', and verb endings like "-ஆப்ல" (-aapla). Use of the particle "வை" (vai) for emphasis. Tendency to use \`போல\` (pola) instead of \`மாதிரி\` (maathiri).
                  *   **Coimbatore / Kongu Tamil**: Known for its respectful tone. Look for the honorific "ங்க" (nga) used frequently (e.g., "வாங்க," "சொல்லுங்க"). Unique words like "அக்கட்ட" (akkata) for "that side," "கண்டீங்களா" (kandeengala) for "did you see?", and the use of "கிறு" (kiru) in present continuous tense (e.g., "சொல்லிட்டு கீறன்").
                  *   **Chennai / Madras Tamil**: A mix of other dialects with numerous English loanwords. Look for slang like "மச்சி" (machi - 'dude'), "கலாய்" (kalaai - 'to tease'), "கேவுள்" (kevul - 'great'), "மொக்கை" (mokkai - 'lame'), and unique pronouns like "என்ட" (enda).
                  *   **Jaffna / Yazhpanam Tamil (Sri Lanka)**: Retains older Tamil forms. Look for different vocabulary, such as "பெட்டை" (pettai) for "girl", "ஆம்பிளை" (aambalai) for "boy/man", "பேந்து" (pendhu) for 'afterwards', and unique verb forms (e.g., future tense).
                  *   **Nanjil Nadu Tamil (Kanyakumari)**: A mix of Tamil and Malayalam influences. Look for unique pronouns, Malayalam loanwords, and words like "சானம்" (chaanam) for "சாணம்" (saanam) and "ஏணி" (eni) for 'then'.
              -   **Output**: Based on your analysis, state the most likely dialect. If no specific markers are present, classify it as 'General Literary Tamil' or 'General Spoken Tamil'.

      2.  **Informed Translation**: Based *directly* on your context analysis and adhering strictly to the CRITICAL RULES above, provide a fluent, culturally-aware English translation. Your word choices should reflect the identified tone and sentiment. When streaming the translation via "translationChunk" objects, you MUST preserve all paragraph breaks from the original text by including "\\n" characters in the JSON data string. ${dictionaryString}

      3.  **Idiom Analysis**: Scan the text for any idiomatic phrases or proverbs. Use Google Search to find context.
          -   If an idiom is found, create an 'idiom' object.
          -   **'phrase'**: The specific Tamil phrase.
          -   **'translation'**: A direct English translation of just the phrase.
          -   **'explanation'**: This MUST be a JSON object with the following keys:
              -   **'literal'**: (string) The literal, word-for-word meaning of the phrase.
              -   **'figurative'**: (string) The actual, figurative meaning of the idiom.
              -   **'context'**: (string, optional) Provide historical context, origin, or common scenarios where this idiom is used, based on search results. If no relevant context is found, omit this key.
          -   If no idiom is found, do not output an object for it.

      4.  **Word Deep Dive (Addendum)**: Identify 2-3 key words with deep cultural, literary, or regional significance. For each word, provide a concise but insightful addendum. **Prioritize speed and the most relevant information.**
          -   The 'word' field MUST contain the Tamil word.
          -   The 'englishWord' field MUST contain its primary, single-word or short-phrase English equivalent (e.g., 'Respect' for 'மரியாதை').
          -   The addendum MUST include a 'meaning', 'variations', 'origin', and 'relatedWords'.
          -   For 'variations', keep the descriptions brief.
          -   For 'relatedWords', provide 1-2 highly relevant words. If none are found, an empty array \`[]\` is acceptable.
          -   The 'etymology' field is OPTIONAL. Only include it if the word has a complex and noteworthy origin. Otherwise, omit it or set it to null.


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
    let completed = false;
    for await (const chunk of responseStream) {
      // FIX: The `.text` accessor on a `GenerateContentResponse` object is a property, not a method.
      // Accessing it as `chunk.text()` causes a "not callable" error.
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
                    completed = true;
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
    
    // If the stream ends without a proper 'end' signal, force completion to avoid an infinite loading state.
    if (!completed) {
        console.warn("Stream ended without a 'end' signal. Forcing completion.");
        onUpdate({ type: 'complete', payload: null });
    }

  } catch (error) {
    console.error("Error calling Gemini API:", error);

    let apiError: ApiError = {
      title: "An Unknown Error Occurred",
      message: "Something went wrong while communicating with the AI. Please try again later.",
      isRetryable: true,
    };

    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();

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
      } else if (errorMessage.includes('503') || errorMessage.includes('unavailable') || errorMessage.includes('overloaded')) {
        apiError = {
          title: "Service Busy",
          message: "The AI service is currently experiencing high traffic or is temporarily unavailable. Please try again in a moment.",
          isRetryable: true,
        };
      } else if (errorMessage.includes('invalid response structure')) {
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
      } else if (errorMessage.includes('content blocked')) {
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
    // FIX: The `.text` accessor on a `GenerateContentResponse` object is a property, not a method.
    // Accessing it as `response.text()` causes a "not callable" error.
    const parsedResponse = extractAndParseJson(response.text);

    if (parsedResponse.englishWord && parsedResponse.tamilMeaning && parsedResponse.englishMeaning) {
      return parsedResponse as DictionaryEntryResponse;
    } else {
      throw new Error("Invalid response structure from API for dictionary entry.");
    }

  } catch (error) {
    console.error(`Error fetching dictionary entry for "${tamilWord}":`, error);
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

    if (errorMessage.includes('api_key')) {
         throw new Error("Authentication failed. Check your API key.");
    }
    if (errorMessage.includes('503') || errorMessage.includes('unavailable') || errorMessage.includes('overloaded')) {
         throw new Error("Service is temporarily unavailable (503). Please try again.");
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
    // FIX: The `.text` accessor on a `GenerateContentResponse` object is a property, not a method.
    // Accessing it as `response.text()` causes a "not callable" error.
    const parsedResponse = extractAndParseJson(response.text);

    if (parsedResponse.tamilMeaning && typeof parsedResponse.tamilMeaning === 'string') {
      return parsedResponse.tamilMeaning;
    } else {
      throw new Error("Invalid response structure from API for Tamil meaning.");
    }
  } catch (error) {
    console.error(`Error fetching Tamil meaning for "${tamilWord}":`, error);
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    
    if (errorMessage.includes('api_key')) {
         throw new Error("Authentication failed. Check your API key.");
    }
    if (errorMessage.includes('503') || errorMessage.includes('unavailable') || errorMessage.includes('overloaded')) {
         throw new Error("Service is temporarily unavailable (503). Please try again.");
    }
    throw new Error(`Could not find a Tamil definition for "${tamilWord}".`);
  }
};
