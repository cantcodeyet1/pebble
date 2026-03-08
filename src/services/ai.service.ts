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

export async function classify (entry: string): Promise<ClassifyResult> {
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
          'Respond with valid JSON only. No markdown, no preamble.'
      },
      {
        role: 'user',
        content: entry
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
          '"blankSentence" — a natural sentence using the word correctly; the word MUST be replaced IN PLACE (inside the sentence, never at the end) with the literal token BLANK, e.g. "The BLANK beauty of the moment stayed with her." not "The beauty of the moment stayed with her. BLANK". ' +
          (hasSynonyms
            ? '"synonymCorrect" — the single best synonym or near-equivalent, title case. ' +
              '"synonymWrongs" — array of exactly 3 plausible but incorrect synonyms (different meaning, connotation, or register), title case. '
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
