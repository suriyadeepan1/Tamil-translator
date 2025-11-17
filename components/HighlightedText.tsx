import React from 'react';
import { DictionaryWord } from '../types';

interface HighlightedTextProps {
  text: string;
  dictionary: DictionaryWord[];
  onWordClick: (word: DictionaryWord) => void;
  language: 'tamil' | 'english';
}

const HighlightedText: React.FC<HighlightedTextProps> = ({ text, dictionary, onWordClick, language }) => {
  if (!text) return null;

  // 1. Prepare phrases for matching from the dictionary
  const matchablePhrases: { phrase: string, wordData: DictionaryWord }[] = [];
  dictionary.forEach(word => {
    const primaryPhrase = language === 'english' ? word.englishWord : word.tamilWord;
    if (!primaryPhrase) return;
    
    // Handle phrases with slashes like "Hello / Greeting", creating separate entries for each
    primaryPhrase.split('/').forEach(p => {
      const trimmedPhrase = p.trim();
      if (trimmedPhrase) {
        matchablePhrases.push({ phrase: trimmedPhrase, wordData: word });
      }
    });
  });

  // Sort by phrase length, descending. This is crucial to match "Thank You" before "Thank".
  matchablePhrases.sort((a, b) => b.phrase.length - a.phrase.length);

  if (matchablePhrases.length === 0) {
    return <>{text}</>;
  }

  // 2. The matching algorithm: Iterate through the text, find matches, and build an array of nodes.
  const elements: React.ReactNode[] = [];
  let currentIndex = 0;

  while (currentIndex < text.length) {
    let longestMatch = null;

    // Find the longest possible dictionary phrase that matches at the current index
    for (const item of matchablePhrases) {
      const { phrase, wordData } = item;
      const phraseLen = phrase.length;

      // Extract segment from text for comparison
      const textSegment = text.substring(currentIndex, currentIndex + phraseLen);
      
      // Perform case-insensitive comparison for English
      const isMatch = language === 'english'
        ? textSegment.toLowerCase() === phrase.toLowerCase()
        : textSegment === phrase;

      if (isMatch) {
        // Check for word boundaries to avoid matching substrings (e.g., 'cat' in 'caterpillar')
        const prevChar = currentIndex > 0 ? text[currentIndex - 1] : ' ';
        const nextChar = currentIndex + phraseLen < text.length ? text[currentIndex + phraseLen] : ' ';

        // \P{L} matches any character that is not a Unicode letter.
        const isBoundaryStart = !prevChar || prevChar.match(/\P{L}/u);
        const isBoundaryEnd = !nextChar || nextChar.match(/\P{L}/u);

        if (isBoundaryStart && isBoundaryEnd) {
          longestMatch = {
            originalText: textSegment,
            wordData: wordData,
            length: phraseLen,
          };
          // Since the list is sorted by length, the first match found is the longest one possible.
          break;
        }
      }
    }

    if (longestMatch) {
      elements.push(
        <button
          key={currentIndex}
          onClick={() => onWordClick(longestMatch.wordData)}
          className="bg-indigo-100 hover:bg-indigo-200 text-indigo-800 font-medium rounded-md px-1 py-0.5 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          title={`Go to definition for "${longestMatch.originalText}"`}
        >
          {longestMatch.originalText}
        </button>
      );
      currentIndex += longestMatch.length;
    } else {
      // If no match, append the current character as plain text and advance index by 1.
      elements.push(text[currentIndex]);
      currentIndex++;
    }
  }

  // 3. Performance optimization: Group consecutive string elements into single text nodes.
  const finalElements: React.ReactNode[] = [];
  let currentText = '';
  for (const el of elements) {
      if (typeof el === 'string') {
          currentText += el;
      } else {
          if (currentText) {
              finalElements.push(currentText);
              currentText = '';
          }
          finalElements.push(el);
      }
  }
  if (currentText) {
      finalElements.push(currentText);
  }

  return <>{finalElements.map((el, i) => <React.Fragment key={i}>{el}</React.Fragment>)}</>;
};

export default HighlightedText;