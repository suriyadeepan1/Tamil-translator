
import { DictionaryWord } from '../types';

export const defaultDictionary: DictionaryWord[] = [
  // --- General Words ---
  {
    tamilWord: 'வணக்கம்',
    englishWord: 'Hello / Greeting',
    tamilMeaning: 'ஒருவரை சந்திக்கும் போது அல்லது விடைபெறும் போது பயன்படுத்தப்படும் ஒரு பாரம்பரிய தமிழ் வாழ்த்து.',
    englishMeaning: 'A traditional Tamil greeting used when meeting or leaving someone, similar to "hello" or "goodbye".',
    example: {
      tamil: 'காலை வணக்கம், நண்பரே!',
      english: 'Good morning, my friend!',
    },
    variations: [
      {
        dialect: 'Kongu Tamil (Coimbatore)',
        vocabulary: 'கும்பிடுறீங்க (Kumbidreenga)',
        pronunciation: 'Soft and respectful tone',
        example: {
          tamil: 'வாங்க, கும்பிடுறீங்க! வீட்ல எல்லாரும் சௌக்கியமா?',
          english: 'Welcome, greetings! Is everyone at home doing well?'
        }
      },
      {
        dialect: 'Chennai Tamil (Madras Bashai)',
        vocabulary: 'வணக்கம் பாஸ் (Vanakkam Boss)',
        pronunciation: 'Fast-paced, often uses English titles',
        example: {
          tamil: 'வணக்கம் பாஸ்! என்ன ஆளையே காணோம்?',
          english: 'Hello Boss! Haven\'t seen you around lately?'
        }
      }
    ]
  },
  {
    tamilWord: 'நன்றி',
    englishWord: 'Thank You',
    tamilMeaning: 'ஒருவர் செய்த உதவிக்கு அல்லது அன்பிற்கு நன்றி தெரிவிக்கும் சொல்.',
    englishMeaning: 'A word to express gratitude for help or kindness received.',
    example: {
      tamil: 'உங்கள் உதவிக்கு மிக்க நன்றி.',
      english: 'Thank you very much for your help.',
    },
    variations: [
      {
        dialect: 'Madurai Tamil',
        vocabulary: 'ரொம்ப நன்றிப்பா (Romba Nandrippa)',
        pronunciation: 'Elongated ending with affectionate "pa"',
        example: {
          tamil: 'நீ செஞ்ச உதவிக்கு ரொம்ப நன்றிப்பா.',
          english: 'Thanks a lot for the help you did, brother/friend.'
        }
      },
      {
        dialect: 'Sri Lankan / Jaffna Tamil',
        vocabulary: 'மிக்க நன்றி (Mikka Nandri)',
        pronunciation: 'Formal and precise articulation',
        example: {
          tamil: 'தங்கள் வருகைக்கு மிக்க நன்றி.',
          english: 'Many thanks for your visit.'
        }
      }
    ]
  },
  {
    tamilWord: 'சோசியர்',
    englishWord: 'Astrologer',
    tamilMeaning: 'கோள்களின் நிலையை வைத்து வருங்காலத்தை கணிப்பவர்.',
    englishMeaning: 'A person who predicts the future by the positions of the planets and sun and moon.',
    example: {
      tamil: 'திருமணப் பொருத்தத்தைப் பார்க்க சோசியரிடம் சென்றனர்.',
      english: 'They went to the astrologer to check the marriage compatibility.',
    },
    variations: [
      {
        dialect: 'General Spoken',
        vocabulary: 'ஜோசியர் (Josier)',
        pronunciation: 'Sanskritized pronunciation',
        example: {
            tamil: 'எங்க குடும்ப ஜோசியர் சொன்னா கரெக்டா இருக்கும்.',
            english: 'If our family astrologer says it, it will be correct.'
        }
      }
    ]
  },
  {
    tamilWord: 'அன்பு',
    englishWord: 'Love / Affection',
    tamilMeaning: 'பாசம், நேசம், மற்றும் மென்மையான உணர்வுகளின் வெளிப்பாடு.',
    englishMeaning: 'An expression of affection, love, and tender feelings.',
    example: {
      tamil: 'தாய் தன் குழந்தை மீது அன்பு காட்டினாள்.',
      english: 'The mother showed affection for her child.',
    },
    variations: [
      {
        dialect: 'Tirunelveli / Nellai Tamil',
        vocabulary: 'பாசம் (Paasam)',
        pronunciation: 'Emphasized with emotion',
        example: {
          tamil: 'எங்க ஊரு ஆளுங்க மேல கொள்ள பாசம் வைச்சிருக்கோம்.',
          english: 'We hold an immense amount of affection for our town\'s people.'
        }
      },
      {
        dialect: 'General Spoken Tamil',
        vocabulary: 'பிரியம் (Piriyam)',
        example: {
          tamil: 'அவர் மேல எனக்கு தனி பிரியம் உண்டு.',
          english: 'I have a special fondness for him.'
        }
      }
    ]
  },
  // --- Karisal Region Words ---
  {
    tamilWord: 'கரிசல்',
    englishWord: 'Karisal / Arid Land',
    tamilMeaning: 'வறண்ட நிலப்பகுதியைக் குறிக்கும் சொல், குறிப்பாக கோவில்பட்டி மற்றும் அதன் சுற்றுவட்டாரப் பகுதிகள்.',
    englishMeaning: 'Refers to the arid, black soil region, particularly around Kovilpatti. Associated with the works of author Ki. Rajanarayanan.',
    example: {
      tamil: 'கரிசல் மண் விவசாயத்திற்கு ஏற்றது.',
      english: 'The black soil is suitable for agriculture.',
    },
    variations: [
      {
        dialect: 'Kovilpatti / Karisal Dialect',
        vocabulary: 'கரிசக்காடு (Karisakkaadu)',
        pronunciation: 'Rough, earthy tone',
        example: {
          tamil: 'கரிசக்காட்டுல மழ பேஞ்சா தான் பொழப்பு.',
          english: 'In the black soil forest, life depends entirely on the rain.'
        }
      }
    ]
  },
  {
    tamilWord: 'பசலை',
    englishWord: 'Pasalai / Lovesickness',
    tamilMeaning: 'ஒரு வகை கீரை; இலக்கியத்தில், பிரிவினால் ஏற்படும் ஒருவித நோய் அல்லது ஏக்கத்தைக் குறிக்கும்.',
    englishMeaning: 'A type of spinach; in literature, it refers to a lovesickness or pallor caused by separation from a lover.',
    example: {
      tamil: 'தலைவனைப் பிரிந்த தலைவிக்கு பசலை நோய் வந்தது.',
      english: 'The heroine suffered from lovesickness after being separated from her hero.',
    },
    variations: [
      {
        dialect: 'Sangam Literature (Classical)',
        vocabulary: 'பசலை (Pasalai)',
        pronunciation: 'Poetic meter',
        example: {
          tamil: 'பசலை பாய்ந்தது மேனியில், காதலன் பிரிவால்.',
          english: 'Pallor spread across her body due to the separation from her lover.'
        }
      },
      {
        dialect: 'Modern Spoken Tamil',
        vocabulary: 'ஏக்கம் (Yekkam)',
        example: {
          tamil: 'அவன் நெனப்புல அவ ஏங்கிப் போய் இருக்கா.',
          english: 'She is pining away in thoughts of him.'
        }
      }
    ]
  },
  {
    tamilWord: 'ஏத்தம்',
    englishWord: 'Eatham / Well Irrigation',
    tamilMeaning: 'கிணற்றிலிருந்து நீர் இறைக்கப் பயன்படும் ஒரு பாரம்பரிய சாதனம்.',
    englishMeaning: 'A traditional well irrigation device using a long pole and bucket, common in the Karisal region.',
    example: {
      tamil: 'விவசாயி ஏத்தம் இறைத்து வயலுக்கு நீர் பாய்ச்சினார்.',
      english: 'The farmer irrigated the field by drawing water using an eatham.',
    },
    variations: [
      {
        dialect: 'Thanjavur / Delta Tamil',
        vocabulary: 'துலா (Thula)',
        pronunciation: 'Specific agricultural term',
        example: {
          tamil: 'துலா மிதிச்சு தண்ணி இறைக்கிறது லேசான வேல இல்ல.',
          english: 'Treading the Thula (irrigation lever) to draw water is no easy task.'
        }
      }
    ]
  },
  // --- Modern Tamil Literature ---
  {
    tamilWord: 'தனிமை',
    englishWord: 'Solitude / Loneliness',
    tamilMeaning: 'தனித்து இருக்கும் நிலை; நவீன இலக்கியத்தில் தனிநபரின் ஒதுக்கப்பட்ட உணர்வை விவரிக்கும் ஒரு முக்கியக் கருப்பொருள்.',
    englishMeaning: 'The state of being alone, solitude; a major theme in modern literature exploring an individual\'s sense of isolation.',
    example: {
      tamil: 'அவர் தன் முதுமையில் தனிமையை உணர்ந்தார்.',
      english: 'He felt loneliness in his old age.',
    },
    variations: [
      {
        dialect: 'Chennai Slang (Tanglish)',
        vocabulary: 'லோன்லி ஃபீல் (Lonely Feel)',
        example: {
          tamil: 'மச்சி, இன்னைக்கு ரொம்ப லோன்லியா ஃபீல் பண்றேன்.',
          english: 'Dude, I\'m feeling very lonely today.'
        }
      },
      {
        dialect: 'Literary Tamil',
        vocabulary: 'ஏகாந்தம் (Yegaantham)',
        pronunciation: 'Sanskritized formal tone',
        example: {
          tamil: 'இறைவனோடு கலக்கும் ஏகாந்த நிலை அது.',
          english: 'It is that state of solitude where one merges with the Divine.'
        }
      }
    ]
  },
  {
    tamilWord: 'விளிம்புநிலை',
    englishWord: 'Marginalized',
    tamilMeaning: 'சமூகத்தின் மைய நீரோட்டத்திலிருந்து ஒதுக்கப்பட்ட அல்லது புறக்கணிக்கப்பட்ட மக்களைக் குறிக்கும் சொல்.',
    englishMeaning: 'A term referring to marginalized or subaltern people, who are excluded from the societal mainstream.',
    example: {
      tamil: 'அந்தத் திட்டம் விளிம்புநிலை மக்களுக்கு உதவியது.',
      english: 'That scheme helped the marginalized people.',
    },
    variations: [
      {
        dialect: 'Political / Activist Tamil',
        vocabulary: 'ஒடுக்கப்பட்டோர் (Odukkappattor)',
        example: {
          tamil: 'ஒடுக்கப்பட்டோரின் உரிமைக்காக குரல் கொடுக்க வேண்டும்.',
          english: 'We must raise our voice for the rights of the oppressed.'
        }
      }
    ]
  },
  {
    tamilWord: 'இருண்மை',
    englishWord: 'Obscurity / Ambiguity',
    tamilMeaning: 'பொருள் தெளிவற்ற, சிக்கலான எழுத்து நடையைக் குறிக்கும் இலக்கியச் சொல். நவீனத்துவப் படைப்புகளில் காணப்படும் ஒரு தன்மை.',
    englishMeaning: 'Obscurity or darkness; a literary term for a complex, non-linear, and often ambiguous style of writing found in modernist works.',
    example: {
      tamil: 'அவரது கவிதைகளில் இருண்மை அதிகமாக உள்ளது.',
      english: 'There is a lot of obscurity in his poems.',
    },
    variations: [
      {
        dialect: 'Academic Tamil',
        vocabulary: 'தெளிவின்மை (Thelivinmai)',
        example: {
          tamil: 'இந்தக் கட்டுரையில் கருத்துத் தெளிவின்மை காணப்படுகிறது.',
          english: 'There is a lack of clarity (ambiguity) in the concepts of this essay.'
        }
      }
    ]
  }
];
