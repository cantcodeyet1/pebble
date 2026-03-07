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
          'if tier is Collocation: return the structural breakdown in uppercase e.g. "ADVERB + ADJECTIVE", "VERB + NOUN", "VERB + NOUN + VERB". ' +
          'if tier is Phrase: return "Idiomatic Expression", "Verb Phrase", or "Noun Phrase" — never a structural breakdown), ' +
          '"phonetic" (if tier is Word: IPA pronunciation e.g. /ˈef.ɪ.mər.əl/. If tier is Collocation or Phrase: return empty string), ' +
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
  console.log(JSON.parse(response.choices[0].message.content))
  return JSON.parse(
    response.choices[0].message.content || '{}'
  ) as ClassifyResult
}
