
import React from 'react';
import { WordAddendum } from '../types';
import EtymologyTimeline from './EtymologyTimeline';

interface WordCardProps {
  wordData: WordAddendum;
}

const WordCard: React.FC<WordCardProps> = ({ wordData }) => {
  return (
    <div className="bg-white/50 backdrop-blur-sm border border-slate-200/80 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md p-6 mb-4">
      <h3 className="text-2xl font-bold text-indigo-700 mb-3">{wordData.word}</h3>
      <div className="space-y-4 text-slate-700">
        <div>
          <strong className="block text-sm font-semibold text-slate-500 uppercase tracking-wider">Meaning</strong>
          <p className="mt-1">{wordData.meaning}</p>
        </div>
        
        {Array.isArray(wordData.variations) && wordData.variations.length > 0 && (
          <div>
            <strong className="block text-sm font-semibold text-slate-500 uppercase tracking-wider">Dialect & Variations</strong>
            <div className="mt-2 space-y-4">
              {wordData.variations.map((variation, index) => (
                <div key={index} className="pl-4 border-l-2 border-indigo-200/60">
                  <p className="font-semibold text-slate-800">{variation.dialect}</p>
                  {variation.vocabulary && (
                    <p className="mt-1 text-sm text-slate-600"><strong className="font-medium text-slate-500">Vocabulary:</strong> {variation.vocabulary}</p>
                  )}
                  {variation.pronunciation && (
                    <p className="mt-1 text-sm text-slate-600"><strong className="font-medium text-slate-500">Pronunciation:</strong> {variation.pronunciation}</p>
                  )}
                  {variation.example && (
                    <div className="mt-1 text-sm">
                      <p className="text-slate-500 italic">e.g., "{variation.example.tamil}"</p>
                      <p className="text-xs text-slate-400 pl-4">— {variation.example.english}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {wordData.example && (
          <div>
            <strong className="block text-sm font-semibold text-slate-500 uppercase tracking-wider">Example</strong>
            <div className="mt-1 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="italic text-slate-800">"{wordData.example.tamil}"</p>
              <p className="text-slate-500 mt-2 text-sm">— {wordData.example.english}</p>
            </div>
          </div>
        )}
        <div>
          <strong className="block text-sm font-semibold text-slate-500 uppercase tracking-wider">Origin & Background</strong>
          <p className="mt-1">{wordData.origin}</p>
          {wordData.etymology && wordData.etymology.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200/60">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Etymological Journey</h4>
              <EtymologyTimeline steps={wordData.etymology} />
            </div>
          )}
        </div>
        {wordData.relatedWords && wordData.relatedWords.length > 0 && (
          <div className="pt-4 border-t border-slate-200/60">
            <strong className="block text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Related Words</strong>
            <div className="flex flex-wrap gap-3">
              {wordData.relatedWords.map((related, index) => (
                <div key={index} className="relative group">
                  <span className="cursor-default flex items-center gap-2 px-3 py-1.5 bg-sky-100 text-sky-800 rounded-full text-sm font-medium">
                    <span className="font-sans text-base">{related.tamilWord}</span>
                    <span>({related.word})</span>
                  </span>
                  <div className="absolute bottom-full z-10 mb-2 left-1/2 -translate-x-1/2 w-max max-w-xs bg-slate-800 text-white text-xs rounded-md py-1.5 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-lg">
                    {related.reason}
                    <svg className="absolute text-slate-800 h-2 w-full left-0 top-full" x="0px" y="0px" viewBox="0 0 255 255"><polygon className="fill-current" points="0,0 127.5,127.5 255,0"/></svg>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WordCard;