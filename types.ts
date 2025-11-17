
export interface RelatedWord {
  word: string;
  tamilWord: string;
  reason: string;
}

export interface EtymologyStep {
  era: string;
  language: string;
  note: string;
}

export interface DialectVariation {
  dialect: string;
  vocabulary?: string;
  pronunciation?: string;
  example: {
    tamil: string;
    english: string;
  };
}

export interface WordAddendum {
  word: string;
  englishWord: string;
  meaning: string;
  variations: DialectVariation[];
  example?: {
    tamil: string;
    english: string;
  };
  origin: string;
  etymology?: EtymologyStep[];
  relatedWords?: RelatedWord[];
}

export interface ContextAnalysis {
  tone: string;
  sentiment: string;
  culturalNotes: string;
  dialect?: string;
}

export interface TranslationResponse {
  translation: string;
  idiom?: {
    phrase: string;
    explanation: string;
    translation: string;
  };
  addendum: WordAddendum[];
  contextAnalysis: ContextAnalysis;
  sources?: { uri: string; title: string; }[];
}

export interface ApiError {
  title: string;
  message: string;
  isRetryable: boolean;
}

export interface DictionaryWord {
  tamilWord: string;
  englishWord: string;
  tamilMeaning: string;
  englishMeaning: string;
  // Fields for deep dive information
  variations?: DialectVariation[];
  example?: {
    tamil: string;
    english: string;
  };
  origin?: string;
  etymology?: EtymologyStep[];
  sources?: { uri: string; title: string; }[];
  idiomExplanation?: string;
}

export interface DictionaryEntryResponse {
  englishWord: string;
  tamilMeaning: string;
  englishMeaning: string;
}