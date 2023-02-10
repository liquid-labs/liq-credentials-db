/* global describe expect test */
import { CREDS_DB_CACHE_KEY } from '../constants'
import { CredentialsDB } from '../credentials-db'

describe('CredentialsDB', () => {
  describe('constructor', () => {
    test('attempts to load DB from cache', () => {
      let getWasCalledWith
      const app = {
        liqHome: () => 'home'
      }
      const cache = {
        get(key) { getWasCalledWith = key; return {} }
      }

      const credDB = new CredentialsDB({ app, cache })
      expect(getWasCalledWith).toBe(CREDS_DB_CACHE_KEY)
    })
  })
})