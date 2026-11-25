const SMALL_WORDS = new Set(['and', 'of', 'the', 'for', 'at', 'in', 'on'])

// Department code from its name: initials of the main words ("Sales and Marketing" -> "SM"),
// or the first 3 letters of a single word ("Operations" -> "OPE"). Max 20 chars (the column size).
export function acronym(name: string): string {
  const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean)
  const main = words.filter((w) => !SMALL_WORDS.has(w.toLowerCase()))
  const use = main.length ? main : words
  const code = use.length === 1 ? use[0]!.slice(0, 3) : use.map((w) => w[0]).join('')
  return code.toUpperCase().slice(0, 20)
}
