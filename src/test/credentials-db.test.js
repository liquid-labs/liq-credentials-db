/* global beforeAll describe expect test */
import { existsSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as fsPath from 'node:path'

import { CREDS_DB_CACHE_KEY, status, types } from '../constants'
import { CredentialsDB } from '../credentials-db'

/*const nullCache = {
  creds : {},
  get   : (key) => { return nullCache.creds[key] },
  put   : (key, value) => { nullCache[key] = value }
}*/

const bogusAuthTokenSpec = {
  key: 'BOGUS_API',
  name: 'A test credential',
  type: types.AUTH_TOKEN,
  verifyFunc: () => true,
  getTokenFunc: async ({ files }) => (await fs.readFile(files[0], { encoding: 'utf8' })).trim()
}

describe('CredentialsDB', () => {
  describe('constructor', () => {
    test('attempts to load DB from cache', () => {
      let getWasCalledWith
      const cache = {
        get(key) { getWasCalledWith = key; return {} }
      }

      new CredentialsDB({ cache }) // eslint-disable-line no-new
      expect(getWasCalledWith).toBe(CREDS_DB_CACHE_KEY)
    })
  })

  describe('key lifecycle', () => {
    const authTokenPath = fsPath.join(__dirname, 'data', 'bogus-api-token.yaml')
    const testDBPath = fsPath.join(__dirname, 'data', 'test-db.yaml')
    let credDB

    beforeAll(async () => {
      process.env.LIQ_CREDENTIALS_DB_PATH = testDBPath

      credDB = new CredentialsDB()
      credDB.registerCredentialType(bogusAuthTokenSpec)
      await credDB.import({ key: 'BOGUS_API', srcPath: authTokenPath })
    })

    afterAll(async () => await fs.rm(testDBPath))

    test('import writes the updated DB by default', async () => expect(existsSync(testDBPath)).toBe(true))

    test('import performs verification by default', () => {
      const detail = credDB.detail('BOGUS_API')
      expect(detail.status).toBe(status.SET_AND_VERIFIED)
    })

    test("on import, 'srcPath' preserves original credential src by default", () => {
      expect(credDB.detail('BOGUS_API').files[0]).toBe(authTokenPath)
    })

    test('getToken() retrieves token for AUTH_TOKEN types', async() => {
      process.env.LIQ_CREDENTIALS_DB_PATH = testDBPath
      const credDB = new CredentialsDB()
      credDB.registerCredentialType(bogusAuthTokenSpec)

      expect(await credDB.getToken('BOGUS_API')).toBe('abc123')
    })

    const authToken2Path = fsPath.join(__dirname, 'data', 'bogus-api-token-2.yaml')
    test('rejects importing same key when replace is false', async () => {
      try {
        await credDB.import({ key: 'BOGUS_API', srcPath: authToken2Path })
        throw new Error('import did not throw as expected')
      }
      catch (e) {
        expect(e.message).toMatch(/already exists/)
      }
    })

    test('can import replacement key (replace: true)', async () => {
      await credDB.import({ key: 'BOGUS_API', replace: true, srcPath: authToken2Path })
      expect(await credDB.getToken('BOGUS_API')).toBe('123abc')
    })

    test("when 'destPath' is set, a copy of the key is made in the dir named by the key name", async () => {
      const destPath = fsPath.join(__dirname, 'data')
      const credPath = fsPath.join(destPath, 'BOGUS_API')
      await credDB.import({ destPath, key: 'BOGUS_API', replace: true, srcPath: authToken2Path })
      expect(existsSync(credPath)).toBe(true)
    })
  })
})
