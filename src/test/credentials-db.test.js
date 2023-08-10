/* global describe expect test */
import { CREDS_DB_CACHE_KEY } from '../constants'
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
})
