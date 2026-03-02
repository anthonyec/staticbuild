// https://bobbyhadz.com/blog/typescript-property-status-does-not-exist-on-type-error
interface Error {
  code?: string
}

interface Args {
  watch?: boolean
}

interface ExternalAsset {
  inputPath: string
}

interface InlineAsset {
  contents: string
}

type Asset = { type: "css" | "js" } & (ExternalAsset | InlineAsset)

interface Page {
  html: string
  assets: Asset[]
}
