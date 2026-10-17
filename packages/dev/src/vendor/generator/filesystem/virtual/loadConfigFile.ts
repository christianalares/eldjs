// Adapted from TanStack Router. See THIRD_PARTY_NOTICES.md.
import { createJiti } from 'jiti'

export async function loadConfigFile(filePath: string) {
  const jiti = createJiti(filePath, {
    interopDefault: false,
    tsconfigPaths: true,
  })
  const loaded = await jiti.import<any>(filePath)
  return loaded
}
