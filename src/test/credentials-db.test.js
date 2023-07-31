import * as fs from 'node:fs/promises'
import * as fsPath from 'node:path'

/* global describe expect test */
import { CREDS_DB_CACHE_KEY, purposes } from '../constants'
import { CredentialsDB } from '../credentials-db'

const nullCache = {
  creds : {},
  get   : (key) => { return nullCache.creds[key] },
  put   : (key, value) => { nullCache[key] = value }
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

  describe('import', () => {
    test('can import a GitHub API token (without verification)', async() => {
      const noDBPath = fsPath.join(__dirname, 'data', 'no-db.yaml')
      try {
        await fs.rm(noDBPath)
      }
      catch (e) {
        if (e.code !== 'ENOENT') {
          throw e
        }
      }
      process.env.LIQ_CREDENTIALS_DB_PATH = noDBPath

      const db = new CredentialsDB({ cache : nullCache })
      const tokenFilePath = fsPath.join(__dirname, 'data', 'bogus-github-api-token')
      db.import({ key : purposes.GITHUB_API, noVerify : true, srcPath : tokenFilePath })

      expect(db.getToken(purposes.GITHUB_API)).toBe('ghp_abcdefghijklmnopqrstuvwxyz0123456789')
    })
  })
})
