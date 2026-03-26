type StringLiteral = { position: number; value: string }

type KeyValuePair = { key: string; value: string }

type ParsedArgs = (StringLiteral | KeyValuePair)[]

export function isStringLiteral(value: unknown): value is StringLiteral {
  return value !== null && typeof value === "object" && "position" in value && "value" in value
}

export function isKeyValuePair(value: unknown): value is KeyValuePair {
  return value !== null && typeof value === "object" && "key" in value && "value" in value
}

export function parseArgv(argv: string[]): ParsedArgs {
  if (argv.length <= 2) return []

  const rawArgs = argv.slice(2, argv.length)
  const parsedArgs: (StringLiteral | KeyValuePair)[] = []

  let isParsingKeyValuePair: boolean = false

  for (let index = 0; index < rawArgs.length; index++) {
    const currentRawArg = rawArgs[index]
    const lastProcessedArg = parsedArgs[parsedArgs.length - 1]

    if (currentRawArg.startsWith("-")) {
      parsedArgs.push({ key: currentRawArg.replace(/^\-\-?/, ""), value: "" })
      isParsingKeyValuePair = true
      continue
    }

    if (isParsingKeyValuePair && !currentRawArg.startsWith("-")) {
      lastProcessedArg.value = currentRawArg
      isParsingKeyValuePair = false
      continue
    }

    if (!isParsingKeyValuePair) {
      parsedArgs.push({ position: index, value: currentRawArg })
      continue
    }
  }

  return parsedArgs
}
