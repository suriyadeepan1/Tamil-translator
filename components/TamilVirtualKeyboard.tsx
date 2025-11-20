
import React from 'react';

interface TamilVirtualKeyboardProps {
  onKeyPress: (char: string) => void;
  onClose: () => void;
}

const TamilVirtualKeyboard: React.FC<TamilVirtualKeyboardProps> = ({ onKeyPress, onClose }) => {
  const vowels = ['அ', 'ஆ', 'இ', 'ஈ', 'உ', 'ஊ', 'எ', 'ஏ', 'ஐ', 'ஒ', 'ஓ', 'ஔ', 'ஃ'];
  const consonants = ['க', 'ங', 'ச', 'ஞ', 'ட', 'ண', 'த', 'ந', 'ப', 'ம', 'ய', 'ர', 'ல', 'வ', 'ழ', 'ள', 'ற', 'ன'];
  const grantha = ['ஜ', 'ஷ', 'ஸ', 'ஹ', 'க்ஷ', 'ஸ்ரீ'];
  const modifiers = ['ா', 'ி', 'ீ', 'ு', 'ூ', 'ெ', 'ே', 'ை', 'ொ', 'ோ', 'ௌ', '்'];

  return (
    <div className="mt-4 p-4 bg-slate-100 rounded-xl border border-slate-200 shadow-inner animate-fade-in relative">
      <button 
        onClick={onClose}
        className="absolute top-2 right-2 text-slate-400 hover:text-slate-600 focus:outline-none"
        title="Close Keyboard"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      
      <div className="space-y-3">
        {/* Vowels */}
        <div>
            <p className="text-xs font-semibold text-slate-500 mb-1 uppercase">Uyir (Vowels)</p>
            <div className="flex flex-wrap gap-1.5">
            {vowels.map((char) => (
                <button
                key={char}
                onClick={() => onKeyPress(char)}
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-white border border-slate-300 rounded shadow-sm hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 text-slate-800 font-medium transition-colors"
                >
                {char}
                </button>
            ))}
            </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
            {/* Consonants */}
            <div className="flex-grow">
                <p className="text-xs font-semibold text-slate-500 mb-1 uppercase">Mei (Consonants)</p>
                <div className="flex flex-wrap gap-1.5">
                {consonants.map((char) => (
                    <button
                    key={char}
                    onClick={() => onKeyPress(char)}
                    className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-white border border-slate-300 rounded shadow-sm hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 text-slate-800 font-medium transition-colors"
                    >
                    {char}
                    </button>
                ))}
                </div>
            </div>
            
             {/* Grantha */}
             <div>
                <p className="text-xs font-semibold text-slate-500 mb-1 uppercase">Grantha</p>
                <div className="flex flex-wrap gap-1.5">
                {grantha.map((char) => (
                    <button
                    key={char}
                    onClick={() => onKeyPress(char)}
                    className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-slate-50 border border-slate-300 rounded shadow-sm hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 text-slate-800 font-medium transition-colors"
                    >
                    {char}
                    </button>
                ))}
                </div>
            </div>
        </div>

        {/* Modifiers */}
        <div>
            <p className="text-xs font-semibold text-slate-500 mb-1 uppercase">Modifiers</p>
            <div className="flex flex-wrap gap-1.5">
            {modifiers.map((char) => (
                <button
                key={char}
                onClick={() => onKeyPress(char)}
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-indigo-50 border border-indigo-200 rounded shadow-sm hover:bg-indigo-100 hover:border-indigo-300 hover:text-indigo-800 text-slate-800 font-medium transition-colors"
                >
                {char === ' ' ? 'Space' : char}
                </button>
            ))}
            </div>
        </div>
      </div>
    </div>
  );
};

export default TamilVirtualKeyboard;
