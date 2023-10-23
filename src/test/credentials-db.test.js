/* global beforeAll describe expect test */
import { existsSync } from 'node:fs'
import * as fsPath from 'node:path'

import { CREDS_DB_CACHE_KEY, status, types } from '../constants'
import { CredentialsDB } from '../credentials-db'

/*const nullCache = {
  creds : {},
  get   : (key) => { return nullCache.creds[key] },
  put   : (key, value) => { nullCache[key] = value }
}*/

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

  describe('import', () => {
    describe('by default', () => {
      const dbPath = fsPath.join(__dirname, 'data', 'test-db.yaml')
      let credDB

      beforeAll(async () => {
        const authTokenPath = fsPath.join(__dirname, 'data', 'bogus-github-api-token.yaml')
        process.env.LIQ_CREDENTIALS_DB_PATH = dbPath

        credDB = new CredentialsDB()
        credDB.registerCredentialType({
          key: 'BOGUS_API',
          name: 'A test credential',
          type: types.AUTH_TOKEN,
          verifyFunc: () => true
        })
        await credDB.import({ key: 'BOGUS_API', srcPath: authTokenPath })
      })

      test('imports the credential file in-place', async () => expect(existsSync(dbPath)).toBe(true))

      test('performs verification', () => {
        const detail = credDB.detail('BOGUS_API')
        expect(detail.status).toBe(status.SET_AND_VERIFIED)
      })
    })
  })
})
