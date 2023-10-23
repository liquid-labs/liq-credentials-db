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
  getTokenFunc: () => {
    console.log('hey')
    return 'abc123'
  }
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
    const testDBPath = fsPath.join(__dirname, 'data', 'test-db.yaml')
    let credDB

    beforeAll(async () => {
      const authTokenPath = fsPath.join(__dirname, 'data', 'bogus-api-token.yaml')
      process.env.LIQ_CREDENTIALS_DB_PATH = testDBPath

      credDB = new CredentialsDB()
      credDB.registerCredentialType(bogusAuthTokenSpec)
      await credDB.import({ key: 'BOGUS_API', srcPath: authTokenPath })
    })

    afterAll(async () => await fs.rm(testDBPath))

    test('writes the updated DB by default', async () => expect(existsSync(testDBPath)).toBe(true))

    test('performs verification by default', () => {
      const detail = credDB.detail('BOGUS_API')
      expect(detail.status).toBe(status.SET_AND_VERIFIED)
    })

    test('getToken() retrieves token for AUTH_TOKEN types', async() => {
      process.env.LIQ_CREDENTIALS_DB_PATH = testDBPath
      const credDB = new CredentialsDB()
      credDB.registerCredentialType(bogusAuthTokenSpec)

      expect(await credDB.getToken('BOGUS_API')).toBe('abc123')
    })    
  })
})
