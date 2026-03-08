import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true
})

export type ClassifyResult = {
  logos: string
  tier: 'Word' | 'Phrase'
  register: 'Formal' | 'Academic' | 'Literary' | 'Informal' | 'Idiomatic'
  pos: string
  phonetic: string
  definition: string
  synonyms: string[]
  sentence: string
}

export async function classify(entry: string, contextSentence?: string): Promise<ClassifyResult> {
  const response = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [
      {
        role: 'system',
        content:
          'Classify the user input and respond with a JSON object containing exactly these fields: ' +
          '"logos" (the input as given, in title case e.g. "Bite The Bullet", "Deeply Flawed", "Ephemeral"), ' +
          '"tier" (one of: Word, Phrase — ' +
          'Word is a single lexical item e.g. "ephemeral", "tenacious". ' +
          'Phrase is any multi-word expression — this includes idioms whose meaning cannot be derived from parts e.g. "bite the bullet", "hit the ground running", AND collocations where words habitually co-occur e.g. "deeply flawed", "make a decision", "commit a crime". If the input has more than one word, it is always a Phrase.), ' +
          '"pos" (part of speech — ' +
          'if tier is Word: return the part of speech in title case e.g. Adjective, Noun, Verb, Adverb. ' +
          'if tier is Phrase: return "Idiomatic Expression", "Verb Phrase", "Collocation" or "Noun Phrase" — never a structural breakdown), ' +
          '"phonetic" (if tier is Word: IPA pronunciation e.g. /ˈef.ɪ.mər.əl/. If tier is Phrase: return empty string), ' +
          '"register" (one of: Formal, Academic, Literary, Informal, Idiomatic), ' +
          '"definition" (a concise definition in sentence case), ' +
          '"synonyms" (a JSON array of related words or phrases in title case e.g. ["Fleeting", "Transient"] for words, ["Get Off To A Flying Start"] for phrases), ' +
          '"sentence" (a natural example sentence using the input in context, in sentence case). ' +
          (contextSentence
            ? 'A context sentence is provided showing exactly how the learner encountered this word. ' +
              'Identify the precise sense, register, tone, and nuance of the word as used in that sentence. ' +
              'Every output field must reflect that specific usage: ' +
              '"definition" must define only this sense, not a generic or alternative meaning; ' +
              '"synonyms" must be words or phrases that are interchangeable in this specific sense and register; ' +
              '"sentence" must be a freshly composed example — never copy or paraphrase the context sentence — but must illustrate the same sense and register; ' +
              '"register" must match the tone of the context. '
            : '') +
          'Respond with valid JSON only. No markdown, no preamble.'
      },
      {
        role: 'user',
        content: contextSentence
          ? `Entry: "${entry}"\nContext sentence: "${contextSentence}"`
          : entry,
      }
    ],
    response_format: { type: 'json_object' }
  })
  return JSON.parse(
    response.choices[0].message.content || '{}'
  ) as ClassifyResult
}

export type SessionContent = {
  usageCorrect: string;
  usageWrongs: [string, string, string];
  blankSentence: string;       // contains "BLANK" as placeholder
  synonymCorrect?: string;
  synonymWrongs?: [string, string, string];
}

export async function generateSessionContent(
  entry: string,
  definition: string,
  hasSynonyms: boolean,
  distractors: string[],
): Promise<SessionContent> {
  const response = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [
      {
        role: 'system',
        content:
          'You generate vocabulary training question content. Respond with valid JSON only, no markdown. ' +
          'Required fields: ' +
          '"usageCorrect" — one natural, correct sentence using the word in a fresh scenario (sentence case, must contain the word). ' +
          '"usageWrongs" — array of exactly 3 sentences that misuse the word subtly (wrong register, wrong collocation, grammatically wrong placement); each must contain the word; sentence case. ' +
          '"blankSentence" — a natural sentence using the entry correctly; replace the ENTIRE entry (all words if it is a multi-word phrase) as a single unit with the one literal token BLANK, positioned inside the sentence (never at the end). Use exactly one BLANK. E.g. for "ephemeral": "The BLANK beauty of the moment stayed with her." For "cut to the chase": "She always managed to BLANK in her presentations." ' +
          (hasSynonyms
            ? '"synonymCorrect" — the single best synonym or near-equivalent, title case. ' +
              '"synonymWrongs" — array of exactly 3 plausible but incorrect synonyms (different meaning, connotation, or register), title case. Each element must be the word or short phrase only — no arrows, no explanations, no editorial notes, no extra punctuation, nothing after the word itself. '
            : '') +
          'Respond with valid JSON only.'
      },
      {
        role: 'user',
        content:
          `Word: "${entry}"\nDefinition: "${definition}"` +
          (distractors.length ? `\nOther session words (for context only): ${distractors.slice(0, 5).join(', ')}` : ''),
      },
    ],
    response_format: { type: 'json_object' },
  });
  return JSON.parse(response.choices[0].message.content || '{}') as SessionContent;
}

export type WotdResult = { word: ClassifyResult; phrase: ClassifyResult };

export async function generateWotd(existingEntries: string[]): Promise<WotdResult> {
  const response = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [
      {
        role: 'system',
        content:
          'You generate a daily vocabulary entry for a learner of sophisticated English. ' +
          'Return a JSON object with exactly two keys: "word" and "phrase". ' +
          'Each must have these fields: ' +
          '"logos" (the entry in title case), ' +
          '"tier" ("Word" for single words, "Phrase" for multi-word expressions), ' +
          '"pos" (part of speech — for words: Adjective/Noun/Verb/Adverb; for phrases: Idiomatic Expression/Verb Phrase/Collocation/Noun Phrase), ' +
          '"phonetic" (IPA for words e.g. /ˈef.ɪ.mər.əl/, empty string for phrases), ' +
          '"register" (one of: Formal, Academic, Literary, Informal, Idiomatic), ' +
          '"definition" (concise, sentence case), ' +
          '"synonyms" (array of 2–4 related words or phrases in title case), ' +
          '"sentence" (a natural example sentence in sentence case). ' +
          '"word" must be a single uncommon but genuinely useful English word. ' +
          '"phrase" must be a multi-word idiom, collocation, or expression. ' +
          'Do NOT use any entry from the exclusion list. ' +
          'Respond with valid JSON only, no markdown.',
      },
      {
        role: 'user',
        content: existingEntries.length
          ? `Exclusion list (already in library): ${existingEntries.slice(0, 60).join(', ')}`
          : "Generate today's word and phrase.",
      },
    ],
    response_format: { type: 'json_object' },
  });
  return JSON.parse(response.choices[0].message.content || '{}') as WotdResult;
}

export type EvalResult = { correct: boolean; feedback: string }

export async function evaluateSentence(entry: string, definition: string, sentence: string): Promise<EvalResult> {
  const response = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [
      {
        role: 'system',
        content:
          'You are evaluating whether a learner has used a vocabulary word correctly in a sentence. ' +
          'Respond with a JSON object: { "correct": boolean, "feedback": string }. ' +
          '"correct" is true if the word is used naturally and its meaning matches the definition given. ' +
          '"feedback" is 1–2 sentences of specific, constructive feedback — if correct, briefly affirm why; if incorrect, explain what went wrong and how to improve. ' +
          'Respond with valid JSON only. No markdown, no preamble.'
      },
      {
        role: 'user',
        content: `Word: "${entry}"\nDefinition: "${definition}"\nLearner's sentence: "${sentence}"`
      }
    ],
    response_format: { type: 'json_object' }
  })
  return JSON.parse(response.choices[0].message.content || '{}') as EvalResult
}

export type ChallengeResult = { accepted: boolean; verdict: string; learning: string }

export async function challengeGrading(
  word: string,
  userSentence: string,
  originalFeedback: string,
  userChallenge: string,
): Promise<ChallengeResult> {
  const response = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [
      {
        role: 'system',
        content:
          'You previously evaluated a sentence and flagged it as incorrect. Re-evaluate carefully and honestly. ' +
          'Accept the challenge if the user demonstrates genuine understanding of the word meaning even if the construction is unconventional. ' +
          'Accept passive voice as correct. Accept informal or creative constructions if meaning is clearly demonstrated. ' +
          'Only reject if the word is genuinely misused in a way that reveals misunderstanding of its meaning. ' +
          'Do not penalise for style or elegance. ' +
          'Respond in JSON with exactly these fields: accepted (boolean), verdict (single sentence explaining final decision — if accepted acknowledge what the user got right, if rejected explain precisely why), learning (if accepted: what this challenge taught about valid usage, if rejected: what correct usage looks like). ' +
          'No markdown no preamble.',
      },
      {
        role: 'user',
        content: `Word: "${word}"\nLearner's sentence: "${userSentence}"\nOriginal feedback: "${originalFeedback}"\nLearner's challenge: "${userChallenge}"`,
      },
    ],
    response_format: { type: 'json_object' },
  })
  return JSON.parse(response.choices[0].message.content || '{}') as ChallengeResult
}
