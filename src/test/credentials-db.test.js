/* global describe expect test */
import { CREDS_DB_CACHE_KEY } from '../constants'
import { CredentialsDB } from '../credentials-db'

describe('CredentialsDB', () => {
  describe('constructor', () => {
    test('attempts to load DB from cache', () => {
      let getWasCalledWith
      const app = {
        liqHome : () => 'home'
      }
      const cache = {
        get(key) { getWasCalledWith = key; return {} }
      }

      new CredentialsDB({ app, cache }) // eslint-disable-line no-new
      expect(getWasCalledWith).toBe(CREDS_DB_CACHE_KEY)
    })
  })
})
