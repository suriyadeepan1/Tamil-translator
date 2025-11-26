
import React, { useMemo } from 'react';
import { DictionaryWord } from '../types';

interface HighlightedTextProps {
  text: string;
  dictionary: DictionaryWord[];
  onWordClick: (word: DictionaryWord) => void;
  language: 'tamil' | 'english';
}

const HighlightedText: React.FC<HighlightedTextProps> = ({ text, dictionary, onWordClick, language }) => {
  
  // Memoize the regex generation for performance
  const { parts, wordMap } = useMemo(() => {
    if (!text) return { parts: [], wordMap: new Map() };

    const wordMap = new Map<string, DictionaryWord>();
    const phrasesToMatch: string[] = [];

    // 1. Build a map of phrases to dictionary entries
    dictionary.forEach(word => {
      const primaryPhrase = language === 'english' ? word.englishWord : word.tamilWord;
      if (!primaryPhrase) return;

      // Handle multi-word entries separated by slashes
      primaryPhrase.split('/').forEach(p => {
        const trimmed = p.trim();
        if (trimmed) {
          const key = language === 'english' ? trimmed.toLowerCase() : trimmed;
          wordMap.set(key, word);
          phrasesToMatch.push(trimmed);
        }
      });
    });

    if (phrasesToMatch.length === 0) {
      return { parts: [text], wordMap };
    }

    // 2. Sort by length descending to ensure longest match wins (e.g. "Grandfather" matches before "Grand")
    phrasesToMatch.sort((a, b) => b.length - a.length);

    // 3. Escape special regex characters
    const escapeRegExp = (string: string) => {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    const escapedPhrases = phrasesToMatch.map(escapeRegExp);
    
    // 4. Construct Regex based on language
    let regex: RegExp;
    if (language === 'english') {
       // English: Use word boundaries (\b) to prevent partial matches like "cat" in "category"
       regex = new RegExp(`\\b(${escapedPhrases.join('|')})\\b`, 'gi');
    } else {
       // Tamil: Do NOT use \b because Unicode word boundaries are unreliable for Tamil.
       // Also, we WANT to match root words inside agglutinated words (e.g. "உறுதுணை" inside "உறுதுணையோடு").
       // Since we sorted by length, the longest root will be matched first.
       regex = new RegExp(`(${escapedPhrases.join('|')})`, 'g');
    }

    // 5. Split the text
    // The capturing group (...) in the regex ensures the delimiters (the words) are included in the result array
    const parts = text.split(regex);
    
    return { parts, wordMap };
  }, [text, dictionary, language]);

  if (!parts || parts.length === 0) return null;

  return (
    <>
      {parts.map((part, index) => {
        // Check if this part corresponds to a dictionary word
        const key = language === 'english' ? part.toLowerCase() : part;
        const matchedWord = wordMap.get(key);

        if (matchedWord) {
          return (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                onWordClick(matchedWord);
              }}
              className="bg-indigo-100 hover:bg-indigo-200 text-indigo-800 font-medium rounded-md px-1 py-0.5 mx-0.5 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 align-baseline inline-block"
              title={`See definition for "${part}"`}
            >
              {part}
            </button>
          );
        }
        
        // Return plain text
        return <span key={index}>{part}</span>;
      })}
    </>
  );
};

export default HighlightedText;
