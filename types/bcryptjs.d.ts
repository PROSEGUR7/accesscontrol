type BcryptInput = string | NodeJS.ArrayBufferView

type CompareCallback = (error: Error | null, same: boolean) => void

type HashCallback = (error: Error | null, hash: string) => void

type GenSaltCallback = (error: Error | null, salt: string) => void

declare module "bcryptjs" {
  interface Bcrypt {
    compare(data: BcryptInput, encrypted: string): Promise<boolean>
    compare(data: BcryptInput, encrypted: string, callback: CompareCallback): void
    compareSync(data: BcryptInput, encrypted: string): boolean
    hash(data: BcryptInput, salt: string | number): Promise<string>
    hash(data: BcryptInput, salt: string | number, callback: HashCallback): void
    hashSync(data: BcryptInput, salt: string | number): string
    genSalt(rounds?: number): Promise<string>
    genSalt(rounds: number, seedLength: number): Promise<string>
    genSalt(rounds: number, seedLength: number, callback: GenSaltCallback): void
    genSalt(rounds: number, callback: GenSaltCallback): void
    genSaltSync(rounds?: number, seedLength?: number): string
    getRounds(encrypted: string): number
    getSalt(encrypted: string): string
    VERSION: string
  }

  const bcrypt: Bcrypt
  export = bcrypt
}
