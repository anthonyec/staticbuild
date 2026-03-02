// https://bobbyhadz.com/blog/typescript-property-status-does-not-exist-on-type-error
interface Error {
  code?: string
}

interface Args {
  watch?: boolean
}
