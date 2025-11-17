// A case-insensitive, smarter transliteration engine for converting Romanized Tamil to Tamil script.
// It uses a dictionary for common exceptions and digraphs (like 'th', 'nh') for ambiguity.

const wordReplacements: { [key: string]: string } = {
  // Greetings & Common
  'vanakkam': 'வணக்கம்',
  'nanri': 'நன்றி',
  'nandri': 'நன்றி',
  'tamil': 'தமிழ்',
  'thamizh': 'தமிழ்',
  'sri': 'ஸ்ரீ',
  'romba nanri': 'ரொம்ப நன்றி',
  'epadi irukinga': 'எப்படி இருக்கீங்க',
  'epdi irukinga': 'எப்படி இருக்கீங்க',
  'nalama': ' நலமா',
  'ama': 'ஆமா',
  'aama': 'ஆமா',
  'illai': 'இல்லை',
  'sandhosham': 'சந்தோஷம்',
  'santhosam': 'சந்தோஷம்',
  'arputham': 'அற்புதம்',


  // Family & Relationships (handle double consonants and vowel length)
  'amma': 'அம்மா',
  'appa': 'அப்பா',
  'akka': 'அக்கா',
  'anna': 'அண்ணா',
  'thambi': 'தம்பி',
  'thangai': 'தங்கை',
  'annan': 'அண்ணன்',
  'anni': 'அண்ணி',
  'machan': 'மச்சான்',
  'kanavar': 'கணவர்',
  'manaivi': 'மனைவி',

  // Pronouns
  'naan': 'நான்',
  'nee': 'நீ',
  'neenga': 'நீங்க',
  'neengal': 'நீங்கள்',
  'avar': 'அவர்',
  'aval': 'அவள்',
  'athu': 'அது',
  'avargal': 'அவர்கள்',
  'en': 'என்',
  'ennudaiya': 'என்னுடைய',
  'un': 'உன்',
  'unnudaiya': 'உன்னுடைய',
  'ungal': 'உங்கள்',
  'engal': 'எங்கள்',

  // Other common words
  'sariyana': 'சரியான',
  'sari': 'சரி',
  'theriyum': 'தெரியும்',
  'theriyathu': 'தெரியாது',
  'ippothu': 'இப்போது',
  'ipo': 'இப்போ',
  'eppothu': 'எப்போது',
  'epo': 'எப்போ',
  'appothu': 'அப்போது',
  'apo': 'அப்போ',
  'pogiren': 'போகிறேன்',
  'varen': 'வரேன்',
  'irukku': 'இருக்கு',
  'iruku': 'இருக்கு',
  'muzhusa': 'முழுசா',
};

const baseConsonants: { [key: string]: string } = {
  // Velar
  'k': 'க', 'g': 'க',
  'ng': 'ங',

  // Palatal
  'c': 'ச',
  's': 'ச', 'ch': 'ச',
  'j': 'ஜ', // Grantha
  'nj': 'ஞ',

  // Retroflex (single letter) vs. Dental (digraph)
  't': 'ட',
  'd': 'ட',
  'th': 'த',
  'dh': 'த',

  // The 'n' sounds - 'nh' provides the retroflex 'ண' sound needed for many words.
  'n': 'ன',  // Default 'n' is the alveolar 'ன' (e.g., 'avan')
  'nh': 'ண', // Use 'nh' for the retroflex 'ண' (e.g., 'kanhnhan' for 'கண்ணன்')
  // Note: Dental 'ந' is handled contextually.

  // The 'l' sounds
  'l': 'ல',
  'lh': 'ள',

  // The 'r' sounds
  'r': 'ர',
  'rh': 'ற',

  // Labial
  'p': 'ப', 'b': 'ப', 'f': 'ப',
  'm': 'ம',

  // Approximants
  'y': 'ய',
  'v': 'வ', 'w': 'வ',
  'zh': 'ழ',

  // Sibilants & Fricatives (Grantha)
  'sh': 'ஷ',
  'h': 'ஹ',
};

const standaloneVowels: { [key: string]: string } = {
  'a': 'அ', 'aa': 'ஆ', 'i': 'இ', 'ee': 'ஈ', 'u': 'உ', 'oo': 'ஊ',
  'e': 'எ', 'ae': 'ஏ', 'ai': 'ஐ', 'o': 'ஒ', 'oa': 'ஓ', 'au': 'ஔ',
};

const vowelDiacritics: { [key: string]: string } = {
  'aa': 'ா', 'i': 'ி', 'ee': 'ீ', 'u': 'ு', 'oo': 'ூ',
  'e': 'ெ', 'ae': 'ே', 'ai': 'ை', 'o': 'ொ', 'oa': 'ோ', 'au': 'ௌ',
  'a': '',
};

const PULLI = '்';

// Order matters for matching, longest first.
const CONSONANT_KEYS = Object.keys(baseConsonants).sort((a, b) => b.length - a.length);
const VOWEL_KEYS = Object.keys(standaloneVowels).sort((a, b) => b.length - a.length);

const transliterateWord = (word: string): string => {
  let transliteratedWord = '';
  let i = 0;
  let lastPhonemeWasVowel = false;
  let previousVowelKey = ''; // e.g., 'i', 'a', 'oo'

  while (i < word.length) {
    const remainingWord = word.substring(i);

    // 1. Check for consonant match
    const consonantMatch = CONSONANT_KEYS.find(c => remainingWord.startsWith(c));
    if (consonantMatch) {
      let base = baseConsonants[consonantMatch];
      const consonantLength = consonantMatch.length;

      // --- Contextual Phonetic Rule for 'n' ---
      if (consonantMatch === 'n') {
        const nextChars = word.substring(i + consonantLength);
        if (nextChars.startsWith('th') || nextChars.startsWith('dh')) {
          base = 'ந';
        }
      }
      // --- End of Rule ---

      i += consonantLength;

      // Check for a following vowel
      const vowelMatch = VOWEL_KEYS.find(v => word.substring(i).startsWith(v));
      if (vowelMatch) {
        transliteratedWord += base + vowelDiacritics[vowelMatch];
        i += vowelMatch.length;
        lastPhonemeWasVowel = true;
        previousVowelKey = vowelMatch;
      } else {
        // Consonant not followed by a vowel, so add a pulli
        transliteratedWord += base + PULLI;
        lastPhonemeWasVowel = false;
        previousVowelKey = '';
      }
      continue; // Move to next iteration
    }

    // 2. Check for vowel match
    const vowelMatch = VOWEL_KEYS.find(v => remainingWord.startsWith(v));
    if (vowelMatch) {
      if (lastPhonemeWasVowel) {
        // Vowel follows a vowel sound, so insert a glide consonant.
        let glide = '';
        // 'y' glide for front vowels
        if (['i', 'ee', 'e', 'ae', 'ai'].includes(previousVowelKey)) {
          glide = baseConsonants['y']; // ய
        } else { // 'v' glide for back and central vowels
          glide = baseConsonants['v']; // வ
        }
        transliteratedWord += glide + vowelDiacritics[vowelMatch];
      } else {
        // Standalone vowel (at the beginning of a word or after a consonant with pulli)
        transliteratedWord += standaloneVowels[vowelMatch];
      }

      i += vowelMatch.length;
      lastPhonemeWasVowel = true;
      previousVowelKey = vowelMatch;
      continue; // Move to next iteration
    }

    // 3. If no match, pass the character through
    transliteratedWord += word[i];
    i++;
    lastPhonemeWasVowel = false;
    previousVowelKey = '';
  }
  return transliteratedWord;
};


export const transliterate = (text: string): string => {
  // Process the text by splitting on delimiters to check words against the dictionary.
  const parts = text.split(/(\s+|[.,!?;:"])/);
  const processedParts = parts.map(part => {
    if (!part) return '';
    const lowerPart = part.toLowerCase();
    
    // If the part is a dictionary word, replace it.
    if (wordReplacements[lowerPart]) {
      return wordReplacements[lowerPart];
    }
    
    // Otherwise, if it's not a delimiter, transliterate it character by character.
    if (!part.match(/(\s+|[.,!?;:"])/)) {
        return transliterateWord(lowerPart);
    }
    
    // Return delimiters as is.
    return part;
  });

  return processedParts.join('');
};
