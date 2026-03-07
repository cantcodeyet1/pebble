import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true
})

export type ClassifyResult = {
  logos: string
  type: 'word' | 'phrase' | 'collocation'
  register: 'formal' | 'academic' | 'literary' | 'informal' | 'idiomatic'
  meaning: string
  synonyms: string[]
  sentence: string
}

export async function classify (entry: string): Promise<ClassifyResult> {
  console.log('working')
  const response = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [
      {
        role: 'system',
        content:
          'Classify the user input and respond with a JSON object containing exactly these fields: ' +
          '"logos" (the input as given), ' +
          '"type" (one of: word, phrase, collocation — a collocation is two or more words that habitually co-occur where native speakers prefer that specific combination over alternatives e.g. "deeply flawed", "make a decision". A phrase is a multi-word expression whose meaning cannot be derived from its parts e.g. "bite the bullet"), ' +
          '"pos" (part of speech — if type is word: noun, verb, adjective, adverb etc. If type is collocation: the structural breakdown in uppercase e.g. "ADVERB + ADJECTIVE", "VERB + NOUN". If type is phrase: phrase), ' +
          '"phonetic" (if type is word: IPA pronunciation e.g. /ˈef.ɪ.mər.əl/. If type is collocation or phrase: leave as empty string), ' +
          '"register" (one of: formal, academic, literary, informal, idiomatic), ' +
          '"meaning" (a concise definition), ' +
          '"synonyms" (a JSON array of related words or phrases of the same type), ' +
          '"sentence" (an example sentence using the input in context). ' +
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
