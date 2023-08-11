const CREDS_DB_CACHE_KEY = 'liq-credentials-db'

const types = {
  SSH_KEY_PAIR : 'ssh',
  AUTH_TOKEN   : 'token'
}

const CREDS_PATH_STEM = 'credentials'

const status = {
  NOT_SET          : 'not set',
  SET_BUT_UNTESTED : 'set but untested',
  SET_AND_VERIFIED : 'set and ready',
  SET_BUT_INVALID  : 'set invalid',
  SET_BUT_EXPIRED  : 'set but expired'
}

export {
  CREDS_DB_CACHE_KEY,
  CREDS_PATH_STEM,
  status,
  types
}
