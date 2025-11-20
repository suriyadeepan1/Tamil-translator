
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { streamTranslationWithAddendum, getDictionaryEntry, getTamilMeaning } from './services/geminiService';
import { TranslationResponse, ApiError, DictionaryWord, ContextAnalysis, WordAddendum, RelatedWord, DialectVariation, TranslationHistoryItem } from './types';
import Loader from './components/Loader';
import ErrorDisplay from './components/ErrorDisplay';
import { transliterate } from './services/transliteration';
import WordCard from './components/WordCard';
import { StreamedUpdate } from './services/geminiService';
import HighlightedText from './components/HighlightedText';
import { defaultDictionary } from './data/dictionary';

interface AddWordError {
  message: string;
  word?: string;
}

// Levenshtein distance algorithm for fuzzy search
const levenshteinDistance = (a: string, b: string): number => {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) { matrix[i] = [i]; }
  for (let j = 0; j <= a.length; j++) { matrix[0][j] = j; }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
      }
    }
  }
  return matrix[b.length][a.length];
};

const App: React.FC = () => {
  // Network Status
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [userInput, setUserInput] = useState<string>('');
  
  // State for streaming response
  const [streamingTranslation, setStreamingTranslation] = useState<string>('');
  const [streamingContext, setStreamingContext] = useState<ContextAnalysis | null>(null);
  const [streamingAddendum, setStreamingAddendum] = useState<WordAddendum[]>([]);
  const [streamingIdiom, setStreamingIdiom] = useState<TranslationResponse['idiom'] | null>(null);
  const [streamingSources, setStreamingSources] = useState<{ uri: string; title: string; }[]>([]);
  const [hasStreamedContent, setHasStreamedContent] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [isTransliterationEnabled, setIsTransliterationEnabled] = useState<boolean>(true);
  const [lastTranslatedText, setLastTranslatedText] = useState<string>('');

  // Dictionary State
  const [dictionary, setDictionary] = useState<DictionaryWord[]>([]);
  const [isDictionaryLoaded, setIsDictionaryLoaded] = useState(false);
  const [isAddingWord, setIsAddingWord] = useState(false);
  const [addWordError, setAddWordError] = useState<AddWordError | null>(null);
  const [focusedWord, setFocusedWord] = useState<string | null>(null); // For dictionary navigation
  const [activeDictionaryTab, setActiveDictionaryTab] = useState<'tamil' | 'english'>('tamil');
  
  // Word Editing State
  const [isWordModalOpen, setIsWordModalOpen] = useState(false);
  const [editingWord, setEditingWord] = useState<DictionaryWord | null>(null);

  // History State
  const [translationHistory, setTranslationHistory] = useState<TranslationHistoryItem[]>([]);

  // Ref to hold the latest dictionary state for use in stable callbacks
  const dictionaryRef = useRef(dictionary);
  useEffect(() => {
    dictionaryRef.current = dictionary;
  }, [dictionary]);

  // Ref to hold latest streaming data to save to history on completion
  const currentStreamRef = useRef<{
    translation: string;
    context: ContextAnalysis | null;
    addendum: WordAddendum[];
    idiom: TranslationResponse['idiom'] | null;
    sources: { uri: string; title: string; }[];
  }>({ translation: '', context: null, addendum: [], idiom: null, sources: [] });

  useEffect(() => {
    currentStreamRef.current = {
      translation: streamingTranslation,
      context: streamingContext,
      addendum: streamingAddendum,
      idiom: streamingIdiom,
      sources: streamingSources
    };
  }, [streamingTranslation, streamingContext, streamingAddendum, streamingIdiom, streamingSources]);
  
  const defaultText = `மரியாதை என்பது கொடுக்கல் வாங்கல் போன்றது. நீ மற்றவர்களுக்கு கொடுத்தால் தான், உனக்கு மரியாதை கிடைக்கும்.`;

  // Load History from localStorage
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem('translationHistory');
      if (storedHistory) {
        setTranslationHistory(JSON.parse(storedHistory));
      }
    } catch (e) {
      console.error("Failed to load translation history", e);
    }
  }, []);

  // Load and merge dictionary from localStorage on initial render
  useEffect(() => {
    try {
      const defaultDictionaryMap = new Map<string, DictionaryWord>(
        defaultDictionary.map(item => [item.tamilWord, item])
      );

      const storedDictionaryJSON = localStorage.getItem('tamilDictionary');
      if (storedDictionaryJSON) {
        const storedDictionary = JSON.parse(storedDictionaryJSON);

        if (Array.isArray(storedDictionary)) {
          // Validate and add stored items. Stored items take precedence over default ones.
          storedDictionary.forEach((item: any) => {
            if (
              typeof item === 'object' &&
              item !== null &&
              typeof item.tamilWord === 'string' &&
              typeof item.englishWord === 'string' &&
              typeof item.englishMeaning === 'string' &&
              typeof item.tamilMeaning === 'string'
            ) {
              defaultDictionaryMap.set(item.tamilWord, item as DictionaryWord);
            }
          });
        }
      }
      
      const sortedDictionary = Array.from(defaultDictionaryMap.values()).sort((a, b) => a.tamilWord.localeCompare(b.tamilWord, 'ta'));
      setDictionary(sortedDictionary);

    } catch (error) {
      console.error("Failed to load or merge dictionary from localStorage:", error);
      // Fallback to default on any error
      const sortedDefault = [...defaultDictionary].sort((a, b) => a.tamilWord.localeCompare(b.tamilWord, 'ta'));
      setDictionary(sortedDefault);
    } finally {
      setIsDictionaryLoaded(true);
    }
  }, []);

  // Listen for storage changes to sync across tabs
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'tamilDictionary' && event.newValue) {
        try {
          const syncedDictionary = JSON.parse(event.newValue);
          if (Array.isArray(syncedDictionary)) {
            setDictionary(syncedDictionary);
          }
        } catch (error) {
          console.error("Failed to sync dictionary from external change:", error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Save dictionary to localStorage whenever it changes, BUT ONLY after initial load is complete.
  useEffect(() => {
    if (!isDictionaryLoaded) return;

    try {
      localStorage.setItem('tamilDictionary', JSON.stringify(dictionary));
    } catch (error) {
      console.error("Failed to save dictionary to localStorage:", error);
    }
  }, [dictionary, isDictionaryLoaded]);

  const updateDictionary = useCallback((newOrUpdatedEntry: DictionaryWord) => {
    setDictionary(prevDictionary => {
        const dictionaryMap = new Map<string, DictionaryWord>(prevDictionary.map(item => [item.tamilWord, item]));
        const key = newOrUpdatedEntry.tamilWord;
        
        // Merge with existing data to prevent overwriting details
        const existingEntry = dictionaryMap.get(key) || {};
        const finalEntry = { ...existingEntry, ...newOrUpdatedEntry };

        dictionaryMap.set(key, finalEntry);
        
        return Array.from(dictionaryMap.values()).sort((a, b) => a.tamilWord.localeCompare(b.tamilWord, 'ta'));
    });
  }, []);

  const addToHistory = useCallback((text: string, response: TranslationResponse) => {
    const newItem: TranslationHistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      originalText: text,
      response: response
    };

    setTranslationHistory(prev => {
      // Keep only the last 20 items to avoid localStorage limits
      const updated = [newItem, ...prev].slice(0, 20);
      localStorage.setItem('translationHistory', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleStreamUpdate = useCallback(async (update: StreamedUpdate) => {
    try {
      setHasStreamedContent(true);
      switch (update.type) {
        case 'context':
          setStreamingContext(update.payload);
          break;
        case 'translationChunk':
          setStreamingTranslation(prev => prev + update.payload);
          break;
        case 'addendum': {
          const addendumItem = update.payload as WordAddendum;
          setStreamingAddendum(prev => [...prev, addendumItem]);
          
          const existingEntry = dictionaryRef.current.find(d => d.tamilWord === addendumItem.word);
          let tamilMeaning = existingEntry?.tamilMeaning || '';
  
          if (!existingEntry || existingEntry.tamilMeaning === 'பொருள் வரையறுக்கப்படவில்லை') {
            try {
               // Only fetch if online
               if (navigator.onLine) {
                  tamilMeaning = await getTamilMeaning(addendumItem.word);
               } else {
                  tamilMeaning = 'பொருள் வரையறுக்கப்படவில்லை (Offline)';
               }
            } catch (error) {
              console.warn(`Could not fetch Tamil meaning for "${addendumItem.word}":`, error);
              tamilMeaning = 'பொருள் கிடைக்கவில்லை';
            }
          }
          updateDictionary({
            tamilWord: addendumItem.word,
            tamilMeaning: tamilMeaning,
            englishWord: addendumItem.englishWord,
            englishMeaning: addendumItem.meaning,
            variations: addendumItem.variations,
            example: addendumItem.example,
            origin: addendumItem.origin,
            etymology: addendumItem.etymology,
          });
          break;
        }
        case 'idiom': {
          const idiom = update.payload;
          setStreamingIdiom(idiom);
          updateDictionary({
            tamilWord: idiom.phrase,
            englishWord: 'Idiom / Phrase',
            englishMeaning: idiom.translation,
            tamilMeaning: "இது ஒரு மரபுத்தொடர்.", // "This is an idiom."
            idiomExplanation: idiom.explanation,
          });
          break;
        }
        case 'sources':
          setStreamingSources(update.payload);
          break;
        case 'complete':
          setIsLoading(false);
          // Save to history on completion
          const finalData = currentStreamRef.current;
          if (finalData.translation && finalData.context) {
            addToHistory(lastTranslatedText, {
              translation: finalData.translation,
              contextAnalysis: finalData.context,
              addendum: finalData.addendum,
              idiom: finalData.idiom || undefined,
              sources: finalData.sources
            });
          }
          break;
        case 'error':
          setError(update.payload as ApiError);
          setIsLoading(false);
          break;
      }
    } catch (e) {
      console.error("Error processing stream update:", e);
      setError({
          title: "Application Error",
          message: "An error occurred while processing the translation data. Please try again.",
          isRetryable: true,
      });
      setIsLoading(false);
    }
  }, [updateDictionary, lastTranslatedText, addToHistory]);

  const loadFromHistory = (item: TranslationHistoryItem) => {
    setUserInput(item.originalText);
    setLastTranslatedText(item.originalText);
    setStreamingTranslation(item.response.translation);
    setStreamingContext(item.response.contextAnalysis);
    setStreamingAddendum(item.response.addendum);
    setStreamingIdiom(item.response.idiom || null);
    setStreamingSources(item.response.sources || []);
    setHasStreamedContent(true);
    setActiveTab('translation');
    setError(null);
  };

  const handleTranslate = useCallback(async (textToTranslate: string) => {
    const trimmedText = textToTranslate.trim();
    if (!trimmedText) {
      setError({
        title: "Input Required",
        message: "Please enter some text to translate.",
        isRetryable: false,
      });
      return;
    }

    // Offline handling
    if (!isOnline) {
      // Check history for exact match
      const cached = translationHistory.find(t => t.originalText.trim() === trimmedText);
      if (cached) {
        loadFromHistory(cached);
        return;
      } else {
        setError({
          title: "You are Offline",
          message: "Cannot translate new text while offline. Please check your internet connection or view History for past translations.",
          isRetryable: false
        });
        return;
      }
    }

    // Reset state for new translation
    setIsLoading(true);
    setError(null);
    setStreamingTranslation('');
    setStreamingContext(null);
    setStreamingAddendum([]);
    setStreamingIdiom(null);
    setStreamingSources([]);
    setHasStreamedContent(false);
    
    setLastTranslatedText(trimmedText);
    setActiveTab('translation');

    await streamTranslationWithAddendum(
      trimmedText,
      dictionary.map(d => ({ tamilWord: d.tamilWord, englishMeaning: d.englishMeaning })),
      handleStreamUpdate
    );
  }, [dictionary, handleStreamUpdate, isOnline, translationHistory]);

  const handleUseDefault = () => {
    setUserInput(defaultText);
    setIsTransliterationEnabled(false);
  };

  const handleClear = () => {
    setUserInput('');
  };

  const handleAddWordToDictionary = async (newWord: string) => {
    const trimmedWord = newWord.trim();
    if (!trimmedWord) {
      setAddWordError({ message: "Please enter a word."});
      return;
    }
    if (dictionary.some(d => d.tamilWord === trimmedWord)) {
      setAddWordError({ message: "This word is already in the dictionary." });
      return;
    }
    
    if (!isOnline) {
       // If offline, don't show error, just open the manual entry modal prefilled
       setEditingWord({ 
           tamilWord: trimmedWord, 
           englishWord: '', 
           tamilMeaning: '', 
           englishMeaning: '' 
       });
       setIsWordModalOpen(true);
       setAddWordError(null);
       return;
    }

    setIsAddingWord(true);
    setAddWordError(null);
    
    try {
      const entry = await getDictionaryEntry(trimmedWord);
      const newDictionaryWord: DictionaryWord = {
        tamilWord: trimmedWord,
        englishWord: entry.englishWord,
        tamilMeaning: entry.tamilMeaning,
        englishMeaning: entry.englishMeaning
      };
      setDictionary(prev => [newDictionaryWord, ...prev].sort((a, b) => a.tamilWord.localeCompare(b.tamilWord, 'ta')));
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Could not find a definition for')) {
          setAddWordError({ message: error.message, word: trimmedWord });
        } else {
          setAddWordError({ message: error.message });
        }
      } else {
        setAddWordError({ message: "An unknown error occurred." });
      }
    } finally {
      setIsAddingWord(false);
    }
  };
  
  const handleAddWordManually = (wordToAdd: string) => {
    setEditingWord({ 
       tamilWord: wordToAdd, 
       englishWord: '', 
       tamilMeaning: '', 
       englishMeaning: '' 
    });
    setIsWordModalOpen(true);
    setAddWordError(null);
  };

  const handleWordClick = (word: DictionaryWord, language: 'tamil' | 'english') => {
    setActiveTab('dictionary');
    // Set the correct sub-tab within the dictionary view
    setActiveDictionaryTab(language);
    // Set the word to focus on, using tamilWord as the unique identifier
    setFocusedWord(word.tamilWord);
  };

  const handleUploadDictionary = (uploadedWords: DictionaryWord[]) => {
    setDictionary(prevDictionary => {
      const dictionaryMap = new Map<string, DictionaryWord>(prevDictionary.map(item => [item.tamilWord, item]));
      uploadedWords.forEach(word => {
          if (word.tamilWord && word.englishWord && word.tamilMeaning && word.englishMeaning) {
              dictionaryMap.set(word.tamilWord, word);
          }
      });
      return Array.from(dictionaryMap.values()).sort((a, b) => a.tamilWord.localeCompare(b.tamilWord, 'ta'));
    });
  };
  
  const handleDeleteWord = (tamilWord: string) => {
    if (window.confirm(`Are you sure you want to delete "${tamilWord}" from the dictionary?`)) {
        setDictionary(prev => prev.filter(w => w.tamilWord !== tamilWord));
    }
  };
  
  const handleEditWord = (word: DictionaryWord) => {
      setEditingWord(word);
      setIsWordModalOpen(true);
  };

  const handleSaveWord = (word: DictionaryWord) => {
      // Update the dictionary state directly. If it's an edit, it overwrites based on tamilWord key.
      // Note: If user changes Tamil word, it acts as a new entry. We might need to delete the old one if we want to support renaming key.
      // For simplicity, we'll treat tamilWord as the ID. If they edit the tamil word, we remove the old one from 'editingWord' reference if it differs.
      
      setDictionary(prev => {
          let newDict = [...prev];
          
          // If editing an existing word and the tamil word changed, remove the old entry
          if (editingWord && editingWord.tamilWord !== word.tamilWord) {
               newDict = newDict.filter(w => w.tamilWord !== editingWord.tamilWord);
          }
          
          // Remove any existing entry with the NEW tamil word to avoid duplicates/conflict
          newDict = newDict.filter(w => w.tamilWord !== word.tamilWord);
          
          // Add the new/updated word
          newDict.push(word);
          return newDict.sort((a, b) => a.tamilWord.localeCompare(b.tamilWord, 'ta'));
      });
      setIsWordModalOpen(false);
      setEditingWord(null);
  };

  const clearFocusedWord = useCallback(() => {
    setFocusedWord(null);
  }, []);

  const [activeTab, setActiveTab] = useState<'translation' | 'dictionary' | 'history'>('dictionary');
  
  const streamingResponse: TranslationResponse = {
    translation: streamingTranslation,
    contextAnalysis: streamingContext!,
    addendum: streamingAddendum,
    idiom: streamingIdiom || undefined,
    sources: streamingSources
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <Header isOnline={isOnline} />
      <main className="container mx-auto p-4 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          <InputPanel 
            userInput={userInput}
            setUserInput={setUserInput}
            onTranslate={handleTranslate}
            onUseDefault={handleUseDefault}
            onClear={handleClear}
            isLoading={isLoading}
            isTransliterationEnabled={isTransliterationEnabled}
            setIsTransliterationEnabled={setIsTransliterationEnabled}
            isOnline={isOnline}
          />
          
          <OutputPanel
            response={streamingResponse}
            isLoading={isLoading}
            error={error}
            hasStreamedContent={hasStreamedContent}
            onRetry={() => {
              if (lastTranslatedText) {
                handleTranslate(lastTranslatedText);
              } else {
                setError(null);
              }
            }}
            dictionary={dictionary}
            onAddWord={handleAddWordToDictionary}
            isAddingWord={isAddingWord}
            addWordError={addWordError}
            clearAddWordError={() => setAddWordError(null)}
            onAddWordManually={handleAddWordManually}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            lastTranslatedText={lastTranslatedText}
            onWordClick={handleWordClick}
            focusedWord={focusedWord}
            clearFocusedWord={clearFocusedWord}
            activeDictionaryTab={activeDictionaryTab}
            setActiveDictionaryTab={setActiveDictionaryTab}
            onUploadDictionary={handleUploadDictionary}
            isOnline={isOnline}
            history={translationHistory}
            onSelectHistoryItem={loadFromHistory}
            onDeleteWord={handleDeleteWord}
            onEditWord={handleEditWord}
          />

        </div>
      </main>
      
      {isWordModalOpen && (
          <WordFormModal 
              isOpen={isWordModalOpen}
              onClose={() => setIsWordModalOpen(false)}
              onSave={handleSaveWord}
              initialData={editingWord}
          />
      )}
    </div>
  );
};

const Header: React.FC<{ isOnline: boolean }> = ({ isOnline }) => (
  <header className="bg-white/80 backdrop-blur-lg border-b border-slate-200 sticky top-0 z-10">
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
      <div className="flex items-center space-x-3">
         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-indigo-600">
          <path d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.522c0 .318.217.6.5.707a9.735 9.735 0 0 0 3.25.555 9.707 9.707 0 0 0 5.25-1.533c1.556-.99 2.5-2.613 2.5-4.445 0-1.832-.944-3.455-2.5-4.445ZM12.75 4.533c-1.556-.99-2.5-2.613-2.5-4.445v18.824c0 1.832.944 3.455 2.5 4.445a9.707 9.707 0 0 0 5.25 1.533 9.735 9.735 0 0 0 3.25-.555.75.75 0 0 0 .5-.707V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533Z" />
        </svg>
        <h1 className="text-2xl font-bold text-slate-800">Tamil Cultural Translator</h1>
      </div>
      {!isOnline && (
        <div className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium flex items-center">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
           </svg>
           Offline Mode
        </div>
      )}
    </div>
  </header>
);

interface InputPanelProps {
  userInput: string;
  setUserInput: (text: string) => void;
  onTranslate: (text: string) => void;
  onUseDefault: () => void;
  onClear: () => void;
  isLoading: boolean;
  isTransliterationEnabled: boolean;
  setIsTransliterationEnabled: (enabled: boolean) => void;
  isOnline: boolean;
}

const InputPanel: React.FC<InputPanelProps> = ({ userInput, setUserInput, onTranslate, onUseDefault, onClear, isLoading, isTransliterationEnabled, setIsTransliterationEnabled, isOnline }) => {
  const [transliteratedText, setTransliteratedText] = useState('');
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);

  useEffect(() => {
    if (isTransliterationEnabled && userInput) {
      const timeoutId = setTimeout(() => {
        setTransliteratedText(transliterate(userInput));
      }, 150); // Debounce transliteration
      return () => clearTimeout(timeoutId);
    } else {
      setTransliteratedText('');
    }
  }, [userInput, isTransliterationEnabled]);
  
  useEffect(() => {
    // Reset expansion when user input changes
    setIsPreviewExpanded(false);
  }, [userInput]);

  const effectiveText = isTransliterationEnabled ? transliteratedText : userInput;
  
  const lines = transliteratedText.split('\n');
  const needsExpansion = lines.length > 10;
  const displayText = (needsExpansion && !isPreviewExpanded) ? lines.slice(0, 10).join('\n') : transliteratedText;

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // Sanitize to remove non-printable control characters, but preserve whitespace like newlines.
    const sanitizedText = e.target.value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
    setUserInput(sanitizedText);
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200/50">
      <h2 className="text-xl font-semibold mb-4 text-slate-700">Enter Tamil Text</h2>
      <div className="relative group">
        <textarea
          value={userInput}
          onChange={handleInputChange}
          placeholder={isTransliterationEnabled ? "Type in English (e.g., 'vanakkam')" : "Type or paste Tamil text here..."}
          className="w-full h-48 p-4 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow duration-200 resize-none"
          disabled={isLoading}
        />
        {userInput.length > 0 && !isLoading && (
          <button
            onClick={onClear}
            title="Clear text"
            className="absolute top-3 right-3 p-1 text-slate-400 rounded-full hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 transition-all"
            aria-label="Clear text"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <div className="mt-2 flex justify-between items-center">
        <div className="relative group">
          <label htmlFor="transliterate-toggle" className="flex items-center cursor-pointer">
            <div className="relative">
              <input type="checkbox" id="transliterate-toggle" className="sr-only" checked={isTransliterationEnabled} onChange={() => setIsTransliterationEnabled(!isTransliterationEnabled)} />
              <div className={`block w-12 h-6 rounded-full ${isTransliterationEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}></div>
              <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isTransliterationEnabled ? 'transform translate-x-6' : ''}`}></div>
            </div>
            <div className="ml-3 text-sm font-medium text-slate-600">Auto-transliterate</div>
          </label>
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max max-w-xs bg-slate-800 text-white text-xs rounded-md py-1.5 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-lg">
            Converts English typing to Tamil script in real-time.
            <svg className="absolute text-slate-800 h-2 w-full left-0 top-full" x="0px" y="0px" viewBox="0 0 255 255"><polygon className="fill-current" points="0,0 127.5,127.5 255,0"/></svg>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4">
        <button
          onClick={() => onTranslate(effectiveText)}
          disabled={isLoading || effectiveText.length === 0}
          className={`w-full sm:w-auto flex items-center justify-center px-6 py-3 font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all duration-300 ${isOnline ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-600 text-white hover:bg-slate-700'}`}
        >
          {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Translating...
              </>
            ) : isOnline ? 'Translate' : 'Try History Match'}
        </button>
        <button 
          onClick={onUseDefault}
          disabled={isLoading}
          className="w-full sm:w-auto px-4 py-3 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors"
        >
          Use Example Text
        </button>
      </div>
      {!isOnline && (
        <p className="mt-2 text-sm text-amber-600 italic">
          You are offline. Clicking translate will search your local history for an exact match.
        </p>
      )}
      
      {isTransliterationEnabled && userInput && transliteratedText && (
        <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 transition-all animate-fade-in">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Transliterated Text Preview</p>
          <p className="text-lg text-slate-800 font-sans leading-relaxed" style={{ whiteSpace: 'pre-wrap' }}>
            {displayText}
          </p>
          {needsExpansion && (
            <button
              onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold mt-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
            >
              {isPreviewExpanded ? 'Show Less' : `Show ${lines.length - 10} More Lines`}
            </button>
          )}
        </div>
      )}

    </div>
  );
};


interface OutputPanelProps {
  response: TranslationResponse;
  isLoading: boolean;
  error: ApiError | null;
  hasStreamedContent: boolean;
  onRetry: () => void;
  dictionary: DictionaryWord[];
  onAddWord: (word: string) => Promise<void>;
  isAddingWord: boolean;
  addWordError: AddWordError | null;
  clearAddWordError: () => void;
  onAddWordManually: (word: string) => void;
  activeTab: 'translation' | 'dictionary' | 'history';
  setActiveTab: (tab: 'translation' | 'dictionary' | 'history') => void;
  lastTranslatedText: string;
  onWordClick: (word: DictionaryWord, language: 'tamil' | 'english') => void;
  focusedWord: string | null;
  clearFocusedWord: () => void;
  activeDictionaryTab: 'tamil' | 'english';
  setActiveDictionaryTab: (tab: 'tamil' | 'english') => void;
  onUploadDictionary: (words: DictionaryWord[]) => void;
  isOnline: boolean;
  history: TranslationHistoryItem[];
  onSelectHistoryItem: (item: TranslationHistoryItem) => void;
  onDeleteWord: (word: string) => void;
  onEditWord: (word: DictionaryWord) => void;
}

const OutputPanel: React.FC<OutputPanelProps> = ({ 
  response, isLoading, error, hasStreamedContent, onRetry,
  dictionary, onAddWord, isAddingWord, addWordError, clearAddWordError, onAddWordManually,
  activeTab, setActiveTab, lastTranslatedText, onWordClick, focusedWord, clearFocusedWord,
  activeDictionaryTab, setActiveDictionaryTab, onUploadDictionary, isOnline, history, onSelectHistoryItem,
  onDeleteWord, onEditWord
}) => {
  const [copyState, setCopyState] = useState(false);
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const [activeTranslationTab, setActiveTranslationTab] = useState<'english' | 'original' | 'deepDive'>('english');


  useEffect(() => {
    // Reset context expansion when response changes
    setIsContextExpanded(false);
    setActiveTranslationTab('english');
  }, [response.contextAnalysis, lastTranslatedText]);

  const getTabClass = (tabName: 'translation' | 'dictionary' | 'history') => {
    return activeTab === tabName
      ? 'text-indigo-600 border-b-2 border-indigo-600'
      : 'text-slate-500 hover:text-slate-700';
  };
  
  const getTranslationTabClass = (tabName: 'english' | 'original' | 'deepDive') => {
    return activeTranslationTab === tabName
      ? 'bg-indigo-100 text-indigo-700'
      : 'bg-slate-50 hover:bg-slate-200 text-slate-600';
  };

  const handleCopy = () => {
    if (response?.translation) {
      navigator.clipboard.writeText(response.translation);
      setCopyState(true);
      setTimeout(() => setCopyState(false), 2000);
    }
  };

  const culturalNotes = response?.contextAnalysis?.culturalNotes || '';
  const noteLines = culturalNotes.split('\n');
  const needsContextExpansion = noteLines.length > 5;
  const displayedNotes = (needsContextExpansion && !isContextExpanded) ? noteLines.slice(0, 5).join('\n') : culturalNotes;


  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200/50 min-h-[400px] flex flex-col">
       <div className="flex border-b border-slate-200 mb-6 overflow-x-auto">
        <button 
          onClick={() => setActiveTab('translation')}
          className={`px-4 py-3 font-semibold text-sm transition-colors duration-200 whitespace-nowrap ${getTabClass('translation')}`}
        >
          Translation
        </button>
        <button 
          onClick={() => setActiveTab('dictionary')}
          className={`px-4 py-3 font-semibold text-sm transition-colors duration-200 whitespace-nowrap ${getTabClass('dictionary')}`}
        >
          Dictionary
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`px-4 py-3 font-semibold text-sm transition-colors duration-200 whitespace-nowrap ${getTabClass('history')}`}
        >
          History {history.length > 0 && `(${history.length})`}
        </button>
      </div>

      <div className="flex-grow overflow-hidden">
        {activeTab === 'history' && (
           <div className="flex flex-col h-full animate-fade-in">
              {history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                     <p>No recent translations found.</p>
                  </div>
              ) : (
                  <ul className="space-y-3 overflow-y-auto pr-2">
                      {history.map((item) => (
                          <li key={item.id} className="p-4 bg-slate-50 border border-slate-200 rounded-lg hover:border-indigo-300 transition-colors cursor-pointer" onClick={() => onSelectHistoryItem(item)}>
                              <div className="flex justify-between items-start mb-1">
                                  <span className="text-xs text-slate-500 font-medium">{new Date(item.timestamp).toLocaleString()}</span>
                                  <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                                     {item.response.contextAnalysis?.dialect || 'General Tamil'}
                                  </span>
                              </div>
                              <p className="font-sans text-slate-800 font-medium line-clamp-2 mb-2">{item.originalText}</p>
                              <p className="text-slate-600 text-sm line-clamp-2">{item.response.translation}</p>
                          </li>
                      ))}
                  </ul>
              )}
           </div>
        )}
        {activeTab === 'translation' && (
          <div className="flex flex-col h-full">
            {isLoading && !hasStreamedContent && <Loader message="Translating & Generating Insights" />}
            {error && !isLoading && <ErrorDisplay error={error} onRetry={onRetry} />}
            
            {hasStreamedContent && !error && (
              <div className="space-y-6 animate-fade-in flex-grow flex flex-col">
                
                {/* CONTEXT ANALYSIS SECTION */}
                {response.contextAnalysis && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <h3 className="text-base font-semibold text-slate-600 mb-3">Context Analysis</h3>
                    <div className="space-y-3 text-sm">
                      {response.contextAnalysis.dialect && response.contextAnalysis.dialect !== 'General Tamil' && (
                        <div className="flex items-start">
                          <strong className="w-24 flex-shrink-0 font-medium text-slate-500">Dialect</strong>
                          <p className="text-indigo-700 font-semibold">{response.contextAnalysis.dialect}</p>
                        </div>
                      )}
                      <div className="flex items-start">
                        <strong className="w-24 flex-shrink-0 font-medium text-slate-500">Tone</strong>
                        <p className="text-slate-700">{response.contextAnalysis.tone}</p>
                      </div>
                      <div className="flex items-start">
                        <strong className="w-24 flex-shrink-0 font-medium text-slate-500">Sentiment</strong>
                        <p className="text-slate-700">{response.contextAnalysis.sentiment}</p>
                      </div>
                      {culturalNotes && culturalNotes.trim() !== '' && (
                      <div className="flex flex-col items-start">
                        <strong className="w-24 flex-shrink-0 font-medium text-slate-500 mb-1">Cultural Notes</strong>
                        <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{displayedNotes}</p>
                        {needsContextExpansion && (
                            <button
                                onClick={() => setIsContextExpanded(!isContextExpanded)}
                                className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold mt-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
                            >
                                {isContextExpanded ? 'Show less' : `Show ${noteLines.length - 5} more lines...`}
                            </button>
                        )}
                      </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Translation Sub-Tabs */}
                 <div className="flex-grow flex flex-col">
                  <div className="flex-shrink-0 border-b border-slate-200">
                    <div className="inline-flex rounded-t-lg overflow-hidden -mb-px">
                        <button onClick={() => setActiveTranslationTab('english')} className={`px-4 py-2 text-sm font-semibold transition-colors ${getTranslationTabClass('english')}`}>
                          English Translation
                        </button>
                        <button onClick={() => setActiveTranslationTab('original')} className={`px-4 py-2 text-sm font-semibold transition-colors ${getTranslationTabClass('original')}`}>
                          Original Text
                        </button>
                         {response.addendum && response.addendum.length > 0 && (
                            <button onClick={() => setActiveTranslationTab('deepDive')} className={`px-4 py-2 text-sm font-semibold transition-colors ${getTranslationTabClass('deepDive')}`}>
                              Word Deep Dive
                            </button>
                        )}
                    </div>
                  </div>

                  <div className="flex-grow overflow-y-auto pt-6 -mr-3 pr-3">
                     {activeTranslationTab === 'english' && response.translation && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h2 className="text-xl font-semibold text-slate-700">English Translation</h2>
                            <button
                              onClick={handleCopy}
                              className="flex items-center space-x-2 px-3 py-1.5 text-sm font-medium bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:opacity-50"
                              disabled={copyState || !response.translation}
                            >
                              {copyState ? (
                                <>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                  <span>Copied!</span>
                                </>
                              ) : (
                                <>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                          <div className="text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-lg" style={{ whiteSpace: 'pre-wrap' }}>
                              <HighlightedText
                                  text={response.translation}
                                  dictionary={dictionary}
                                  onWordClick={(word) => onWordClick(word, 'english')}
                                  language="english"
                              />
                          </div>
                        </div>
                      )}

                      {activeTranslationTab === 'original' && lastTranslatedText && (
                          <div>
                              <h2 className="text-xl font-semibold text-slate-700 mb-3">Original Text</h2>
                              <div className="text-slate-800 leading-relaxed bg-slate-50 p-4 rounded-lg font-sans text-lg" style={{ whiteSpace: 'pre-wrap' }}>
                                  <HighlightedText
                                      text={lastTranslatedText}
                                      dictionary={dictionary}
                                      onWordClick={(word) => onWordClick(word, 'tamil')}
                                      language="tamil"
                                  />
                              </div>
                          </div>
                      )}
                      
                      {activeTranslationTab === 'deepDive' && response.addendum && response.addendum.length > 0 && (
                        <div>
                          <h3 className="text-xl font-semibold text-slate-700 mb-4">Word Deep Dive</h3>
                          <div className="space-y-4">
                            {response.addendum.map((item, index) => (
                              <WordCard key={index} wordData={item} />
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                </div>

                {isLoading && (
                  <div className="flex items-center justify-center pt-6 text-slate-500 flex-shrink-0">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Receiving more details...</span>
                  </div>
                )}
              </div>
            )}
            {!isLoading && !error && !hasStreamedContent && (
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 mb-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C13.18 7.083 14.135 7 15 7c.865 0 1.72.083 2.533.243m-4.533-2.43a48.47 48.47 0 00-1.087.058M3 12.036A48.478 48.478 0 017.5 12c1.33 0 2.66.052 3.977.158M3.977 15.75A48.465 48.465 0 017.5 15.5c1.45 0 2.885.056 4.286.168m-7.759-2.990A48.467 48.467 0 007.5 12.5c1.18 0 2.345.044 3.482.126m-4.462 2.859A48.448 48.448 0 007.5 15c.955 0 1.896.038 2.815.112" />
                </svg>
                <h3 className="text-xl font-semibold text-slate-600">Your translation will appear here</h3>
                <p className="mt-2 max-w-md">Enter Tamil text on the left and click "Translate" to see the magic happen.</p>
              </div>
            )}
          </div>
        )}
        {activeTab === 'dictionary' && (
          <DictionaryView 
            dictionary={dictionary} 
            onAddWord={onAddWord}
            isAddingWord={isAddingWord}
            addWordError={addWordError}
            clearAddWordError={clearAddWordError}
            onAddWordManually={onAddWordManually}
            focusedWord={focusedWord}
            clearFocusedWord={clearFocusedWord}
            activeDictionaryTab={activeDictionaryTab}
            setActiveDictionaryTab={setActiveDictionaryTab}
            onUploadDictionary={onUploadDictionary}
            isOnline={isOnline}
            onDeleteWord={onDeleteWord}
            onEditWord={onEditWord}
          />
        )}
      </div>
    </div>
  );
};

const DictionaryItem: React.FC<{ word: DictionaryWord, filter: string, activeTab: 'tamil' | 'english', isHighlighted: boolean, onDelete: (w: string) => void, onEdit: (w: DictionaryWord) => void }> = ({ word, filter, activeTab, isHighlighted, onDelete, onEdit }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedSourcesWord, setExpandedSourcesWord] = useState<string | null>(null);

  const hasDeepInfo = !!(word.variations?.length || word.example || word.origin || word.idiomExplanation || (word.etymology && word.etymology.length > 0) || word.sources?.length);

  const highlightMatch = (text: string, query: string): React.ReactNode => {
    if (!query.trim() || !text) {
      return text;
    }
    const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = text.split(regex);
    
    return (
      <>
        {parts.map((part, index) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={index} className="bg-indigo-100 text-indigo-800 font-bold rounded-sm px-0.5 py-0">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  const isTamilPrimary = activeTab === 'tamil';
  
  const title = isTamilPrimary ? word.tamilWord : word.englishWord;
  const secondaryWordLabel = isTamilPrimary ? 'English Word' : 'Tamil Word';
  const secondaryWord = isTamilPrimary ? word.englishWord : word.tamilWord;
  
  return (
    <li 
      id={`dict-item-${encodeURIComponent(word.tamilWord)}`}
      className={`p-4 bg-slate-50 border border-slate-200 rounded-lg transition-all duration-500 group/item ${isHighlighted ? 'ring-2 ring-indigo-400 ring-offset-2 bg-indigo-50' : ''}`}
    >
      <div className="flex justify-between items-start">
          <h4 className="text-xl font-bold text-indigo-800">
            <span className={isTamilPrimary ? 'font-sans' : ''}>
              {highlightMatch(title, filter)}
            </span>
          </h4>
          <div className="flex space-x-2 opacity-0 group-hover/item:opacity-100 transition-opacity">
             <button 
               onClick={(e) => { e.stopPropagation(); onEdit(word); }}
               className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-indigo-50 transition-colors"
               title="Edit Word"
             >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
             </button>
             <button 
               onClick={(e) => { e.stopPropagation(); onDelete(word.tamilWord); }}
               className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
               title="Delete Word"
             >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
             </button>
          </div>
      </div>

      <div className="mt-2 pl-2 border-l-2 border-indigo-200 space-y-1">
        <p className="text-sm text-slate-600">
          <strong className="font-semibold text-slate-700 w-28 inline-block">{secondaryWordLabel}:</strong>
          <span className={!isTamilPrimary ? 'font-sans' : ''}>
            {highlightMatch(secondaryWord, filter)}
          </span>
        </p>
        <p className="text-sm text-slate-600">
          <strong className="font-semibold text-slate-700 w-28 inline-block">English Meaning:</strong>
          {highlightMatch(word.englishMeaning, filter)}
        </p>
        <p className="text-sm text-slate-600">
          <strong className="font-semibold text-slate-700 w-28 inline-block">Tamil Meaning:</strong>
          {highlightMatch(word.tamilMeaning, filter)}
        </p>
      </div>

      <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
        <div className="pt-4">
            {word.idiomExplanation && (
              <div className="mt-3 p-3 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-semibold text-amber-800">Idiom Explained</h3>
                    <div className="mt-1 text-sm text-amber-700 space-y-2 leading-relaxed">
                        {word.idiomExplanation.literal && <p><strong className="font-medium text-amber-800/90">Literal:</strong> {word.idiomExplanation.literal}</p>}
                        {word.idiomExplanation.figurative && <p><strong className="font-medium text-amber-800/90">Figurative:</strong> {word.idiomExplanation.figurative}</p>}
                        {word.idiomExplanation.context && <p><strong className="font-medium text-amber-800/90">Context:</strong> {word.idiomExplanation.context}</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="mt-4 pt-4 border-t border-slate-200/80 space-y-4 text-slate-700">
               {word.example && (
                <div>
                  <strong className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Example</strong>
                  <div className="mt-1 p-3 bg-white rounded-lg border border-slate-200">
                    <p className="italic text-slate-800 font-sans">"{word.example.tamil}"</p>
                    <p className="text-slate-500 mt-2 text-xs">— {word.example.english}</p>
                  </div>
                </div>
              )}
              {Array.isArray(word.variations) && word.variations.length > 0 && (
                <div>
                  <strong className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Dialect & Variations</strong>
                  <div className="mt-2 space-y-3">
                    {word.variations.map((variation, index) => (
                      <div key={index} className="text-sm pl-3 border-l-2 border-slate-200/80">
                        <p className="font-semibold text-slate-700">{variation.dialect}</p>
                        {variation.vocabulary && (
                          <p className="mt-0.5 text-slate-600">
                            <strong className="font-medium text-slate-500">Vocab:</strong> {variation.vocabulary}
                          </p>
                        )}
                        {variation.pronunciation && (
                          <p className="mt-0.5 text-slate-600">
                            <strong className="font-medium text-slate-500">Pronunciation:</strong> {variation.pronunciation}
                          </p>
                        )}
                        {variation.example && (
                          <div className="mt-1 text-sm">
                            <p className="text-slate-500 italic">e.g., "{variation.example.tamil}"</p>
                            <p className="text-slate-400 text-xs pl-4">— {variation.example.english}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {word.origin && (
                <div>
                  <strong className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Origin & Background</strong>
                  <p className="mt-1 text-sm">{word.origin}</p>
                </div>
              )}
              {word.sources && word.sources.length > 0 && (
                <div>
                  <h5 className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Sources</h5>
                  <div className="flex flex-col space-y-1">
                      {expandedSourcesWord === word.tamilWord ? (
                        word.sources.map((source, index) => (
                          <a key={index} href={source.uri} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline flex items-start group" title={source.uri}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 flex-shrink-0 mr-1.5 mt-0.5 text-slate-400 group-hover:text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                            <span className="truncate">{source.title}</span>
                          </a>
                        ))
                      ) : (
                        <a href={word.sources[0].uri} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline flex items-start group" title={word.sources[0].uri}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 flex-shrink-0 mr-1.5 mt-0.5 text-slate-400 group-hover:text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                          <span className="truncate">{word.sources[0].title}</span>
                        </a>
                      )}
                  </div>
                  {word.sources.length > 1 && (
                    <button
                        onClick={() => setExpandedSourcesWord(expandedSourcesWord === word.tamilWord ? null : word.tamilWord)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold mt-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
                    >
                        {expandedSourcesWord === word.tamilWord ? 'Show less' : `Show ${word.sources.length - 1} more sources`}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
      </div>
      {hasDeepInfo && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 mt-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded text-left"
        >
          {isExpanded ? 'Show Less' : 'Show More Details...'}
        </button>
      )}
    </li>
  );
};


interface DictionaryViewProps {
  dictionary: DictionaryWord[];
  onAddWord: (word: string) => Promise<void>;
  isAddingWord: boolean;
  addWordError: AddWordError | null;
  clearAddWordError: () => void;
  onAddWordManually: (word: string) => void;
  focusedWord: string | null;
  clearFocusedWord: () => void;
  activeDictionaryTab: 'tamil' | 'english';
  setActiveDictionaryTab: (tab: 'tamil' | 'english') => void;
  onUploadDictionary: (words: DictionaryWord[]) => void;
  isOnline: boolean;
  onDeleteWord: (word: string) => void;
  onEditWord: (word: DictionaryWord) => void;
}


const DictionaryView: React.FC<DictionaryViewProps> = ({ 
  dictionary, onAddWord, isAddingWord, addWordError, clearAddWordError, onAddWordManually, 
  focusedWord, clearFocusedWord, activeDictionaryTab, setActiveDictionaryTab, onUploadDictionary, isOnline,
  onDeleteWord, onEditWord
}) => {
  const [newWord, setNewWord] = useState('');
  const [filter, setFilter] = useState('');
  const [highlightedWord, setHighlightedWord] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusedWord) {
      const element = document.getElementById(`dict-item-${encodeURIComponent(focusedWord)}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedWord(focusedWord);
        const timer = setTimeout(() => {
          setHighlightedWord(null);
          clearFocusedWord();
        }, 2500); // Highlight for 2.5 seconds
        return () => clearTimeout(timer);
      } else {
        // If element not found, still clear the focus state
        clearFocusedWord();
      }
    }
  }, [focusedWord, clearFocusedWord]);

  const handleAddClick = async () => {
    await onAddWord(newWord);
    if(!addWordError && isOnline) {
      // Clear input only if successful (online mode generally implies success or error handled)
      // If offline, the AddWordToDictionary function handles opening the modal, we can clear it there or keep it.
      // For consistent UX, we clear it here if not blocked by error.
       setNewWord('');
    } else if (!isOnline) {
       setNewWord(''); // Clear on offline manual trigger too
    }
  };
  
  const handleDownload = () => {
    if (dictionary.length === 0) return;

    const header = ['Tamil Word', 'English Word', 'Tamil Meaning', 'English Meaning'];
    const rows = dictionary.map(word => 
      [word.tamilWord, word.englishWord, word.tamilMeaning, word.englishMeaning].map(field => `"${(field || '').replace(/"/g, '""')}"`)
    );
    
    const csvContent = [header.join(','), ...rows.map(row => row.join(','))].join('\n');
    
    // To ensure Tamil characters are encoded correctly
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'tamil_dictionary.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target?.result as string;
            const lines = text.split(/\r?\n/);
            
            if (lines.length < 1) {
              alert('The selected file is empty.');
              return;
            }

            const headerLine = lines.shift()!.trim();
            // Remove BOM character if present
            const header = (headerLine.startsWith('\uFEFF') ? headerLine.substring(1) : headerLine).split(',').map(h => h.trim().replace(/"/g, ''));
            const expectedHeader = ['Tamil Word', 'English Word', 'Tamil Meaning', 'English Meaning'];

            if (header.length !== expectedHeader.length || !header.every((h, i) => h === expectedHeader[i])) {
              alert('Invalid CSV header. Please ensure the columns are: ' + expectedHeader.join(', '));
              return;
            }
            
            const uploadedWords = lines.map(line => {
                if (!line.trim()) return null;
                const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
                const cleanValues = values.map(v => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));

                if (cleanValues.length === header.length) {
                    return {
                        tamilWord: cleanValues[0],
                        englishWord: cleanValues[1],
                        tamilMeaning: cleanValues[2],
                        englishMeaning: cleanValues[3],
                    };
                }
                return null;
            }).filter((w): w is DictionaryWord => w !== null);
            
            onUploadDictionary(uploadedWords);
            alert(`${uploadedWords.length} words successfully uploaded and merged.`);

        } catch (error) {
            console.error("Error parsing CSV file:", error);
            alert("Failed to read or parse the CSV file. Please ensure it is correctly formatted.");
        } finally {
            if (event.target) {
                event.target.value = ''; // Reset file input
            }
        }
    };
    reader.onerror = () => {
        alert("Error reading the file.");
    };
    reader.readAsText(file);
  };

  const { filteredDictionary, isFuzzySearch } = React.useMemo(() => {
    const query = filter.trim().toLowerCase();
    
    const sortAlphabetically = (a: DictionaryWord, b: DictionaryWord) => {
      if (activeDictionaryTab === 'tamil') {
        return a.tamilWord.localeCompare(b.tamilWord, 'ta');
      } else {
        return a.englishWord.localeCompare(b.englishWord, 'en');
      }
    };

    if (!query) {
      return { 
        filteredDictionary: [...dictionary].sort(sortAlphabetically), 
        isFuzzySearch: false 
      };
    }

    const exactMatches = dictionary.filter(d => 
      d.tamilWord.toLowerCase().includes(query) || 
      d.englishWord.toLowerCase().includes(query) ||
      d.englishMeaning.toLowerCase().includes(query) ||
      (d.tamilMeaning && d.tamilMeaning.toLowerCase().includes(query))
    );

    if (exactMatches.length > 0) {
      return { 
        filteredDictionary: exactMatches.sort(sortAlphabetically), 
        isFuzzySearch: false 
      };
    }

    // Fuzzy Search
    const fuzzyMatches = dictionary
      .map(d => {
        const distTamil = levenshteinDistance(d.tamilWord.toLowerCase(), query);
        const distEnglish = levenshteinDistance(d.englishWord.toLowerCase(), query);
        return { word: d, score: Math.min(distTamil, distEnglish) };
      })
      .filter(item => {
          // Allow more errors for longer words
          const len = Math.max(item.word.tamilWord.length, item.word.englishWord.length);
          const maxDist = len < 5 ? 1 : len < 10 ? 2 : 3;
          return item.score <= maxDist;
      })
      .sort((a, b) => a.score - b.score) // Sort by relevance (score)
      .map(item => item.word);

    return { filteredDictionary: fuzzyMatches, isFuzzySearch: true };

  }, [dictionary, filter, activeDictionaryTab]);

  const getDictTabClass = (tabName: 'tamil' | 'english') => {
    return activeDictionaryTab === tabName
      ? 'bg-indigo-100 text-indigo-700'
      : 'bg-slate-100 text-slate-600 hover:bg-slate-200';
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Add Word Form */}
      <div className="mb-6 pb-6 border-b border-slate-200 relative">
        <h3 className="text-lg font-semibold text-slate-700 mb-3">Add a Word</h3>
        <div className="flex items-start space-x-2">
          <input 
            type="text"
            value={newWord}
            onChange={(e) => {
              setNewWord(e.target.value);
              if (addWordError) clearAddWordError();
            }}
            placeholder={isOnline ? "Enter a Tamil word..." : "Enter word to add manually..."}
            className="flex-grow p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
            disabled={isAddingWord}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddClick() }}
          />
          <button
            onClick={handleAddClick}
            disabled={isAddingWord || !newWord.trim()}
            className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 disabled:bg-slate-300 flex items-center justify-center min-w-[80px] transition-colors"
          >
            {isAddingWord ? (
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
            ) : "Add"}
          </button>
        </div>
        {!isOnline && (
          <div className="mt-2 text-xs text-amber-600 italic">
             Offline Mode: Clicking "Add" will open manual entry form.
          </div>
        )}
        {addWordError && (
          <div className="mt-2 p-3 bg-red-50 border-l-4 border-red-400 rounded-r-lg">
            <p className="text-sm font-medium text-red-800">{addWordError.message}</p>
            {addWordError.word && (
              <button 
                onClick={() => onAddWordManually(addWordError.word!)}
                className="mt-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
              >
                Add "{addWordError.word}" with a placeholder definition
              </button>
            )}
          </div>
        )}
      </div>

      {/* Dictionary List */}
      <div className="flex-grow flex flex-col overflow-hidden">
        <div className="flex justify-between items-center mb-2 flex-shrink-0 gap-2">
          <h3 className="text-lg font-semibold text-slate-700">My Dictionary ({dictionary.length})</h3>
          <div className="flex space-x-2">
            <button
                onClick={handleDownload}
                disabled={dictionary.length === 0}
                className="p-2 text-slate-500 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 rounded-full transition-colors disabled:opacity-50"
                title="Download Dictionary CSV"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
            </button>
            <button
                onClick={handleUploadClick}
                className="p-2 text-slate-500 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 rounded-full transition-colors"
                title="Upload Dictionary CSV"
            >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
            </button>
             {/* Hidden file input */}
             <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".csv"
                className="hidden"
            />
          </div>
        </div>

        <div className="mb-4 flex items-center space-x-2 flex-shrink-0">
            <div className="relative flex-grow">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                </div>
                <input
                    type="text"
                    className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md leading-5 bg-white placeholder-slate-500 focus:outline-none focus:placeholder-slate-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150 ease-in-out"
                    placeholder="Search dictionary..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                />
            </div>
            <div className="flex rounded-md shadow-sm">
                <button
                    onClick={() => setActiveDictionaryTab('tamil')}
                    className={`px-3 py-2 text-sm font-medium rounded-l-md border border-slate-300 transition-colors focus:z-10 focus:ring-2 focus:ring-indigo-500 focus:text-indigo-700 ${getDictTabClass('tamil')}`}
                >
                    Tamil
                </button>
                <button
                    onClick={() => setActiveDictionaryTab('english')}
                    className={`px-3 py-2 text-sm font-medium rounded-r-md border border-l-0 border-slate-300 transition-colors focus:z-10 focus:ring-2 focus:ring-indigo-500 focus:text-indigo-700 ${getDictTabClass('english')}`}
                >
                    English
                </button>
            </div>
        </div>
        
        {isFuzzySearch && filteredDictionary.length > 0 && (
          <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            No exact matches found. Showing similar words for "{filter}".
          </div>
        )}

        {dictionary.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-500 bg-slate-50 rounded-lg border border-slate-200/60 border-dashed">
                <p>Dictionary is empty.</p>
                <p className="text-sm mt-1">Add words above or upload a CSV.</p>
            </div>
        ) : filteredDictionary.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-32 text-slate-500 bg-slate-50 rounded-lg border border-slate-200/60 border-dashed">
                <p>No matches found.</p>
            </div>
        ) : (
          <ul className="overflow-y-auto space-y-3 pr-2 pb-2 flex-grow">
            {filteredDictionary.map((word) => (
              <DictionaryItem 
                key={word.tamilWord} 
                word={word} 
                filter={filter} 
                activeTab={activeDictionaryTab} 
                isHighlighted={highlightedWord === word.tamilWord}
                onDelete={onDeleteWord}
                onEdit={onEditWord}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};


interface WordFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (word: DictionaryWord) => void;
  initialData?: DictionaryWord | null;
}

const WordFormModal: React.FC<WordFormModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
    const [formData, setFormData] = useState<DictionaryWord>({
        tamilWord: '',
        englishWord: '',
        tamilMeaning: '',
        englishMeaning: ''
    });

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
        } else {
             setFormData({ tamilWord: '', englishWord: '', tamilMeaning: '', englishMeaning: '' });
        }
    }, [initialData]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">{initialData ? 'Edit Word' : 'Add Manual Entry'}</h3>
                    <button onClick={onClose} className="text-indigo-100 hover:text-white focus:outline-none">
                         <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                         </svg>
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tamil Word *</label>
                        <input 
                            type="text" 
                            required
                            className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                            value={formData.tamilWord}
                            onChange={e => setFormData({...formData, tamilWord: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">English Word/Translation *</label>
                        <input 
                            type="text" 
                            required
                            className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                            value={formData.englishWord}
                            onChange={e => setFormData({...formData, englishWord: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tamil Meaning</label>
                        <textarea 
                            className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 h-20 resize-none"
                            value={formData.tamilMeaning}
                            onChange={e => setFormData({...formData, tamilMeaning: e.target.value})}
                        />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">English Meaning</label>
                        <textarea 
                            className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 h-20 resize-none"
                            value={formData.englishMeaning}
                            onChange={e => setFormData({...formData, englishMeaning: e.target.value})}
                        />
                    </div>
                    <div className="pt-4 flex justify-end space-x-3">
                         <button 
                            type="button" 
                            onClick={onClose}
                            className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md font-medium transition-colors"
                         >
                            Cancel
                         </button>
                         <button 
                            type="submit" 
                            className="px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-md font-medium transition-colors shadow-sm"
                         >
                            Save
                         </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default App;
