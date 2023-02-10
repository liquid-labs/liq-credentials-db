const CREDS_DB_CACHE_KEY = 'liq-credentials-db'

const purposes = {
  GITHUB_API : 'gitHubAPI',
  GITHUB_SSH : 'gitHubSSH'
}

const types = {
  SSH_KEY_PAIR : 'ssh',
  AUTH_TOKEN   : 'token'
}

const CRED_SPECS = [
  {
    key         : purposes.GITHUB_SSH,
    name        : 'GitHub SSH key',
    description : 'Used to authenticate user for git operations such as clone, fetch, and push.',
    type        : types.SSH_KEY_PAIR
  },
  {
    key         : purposes.GITHUB_API,
    name        : 'GitHub API token',
    description : 'Used to authenticate REST/API actions.',
    type        : types.AUTH_TOKEN
  }
]
const CRED_TYPES = CRED_SPECS.map((cs) => cs.key)

const CREDS_PATH_STEM = 'credentials'

const credStatus = {
  NOT_SET          : 'not set',
  SET_BUT_UNTESTED : 'set but untested',
  SET_AND_VERIFIED : 'set and ready',
  SET_BUT_INVALID  : 'set invalid',
  SET_BUT_EXPIRED  : 'set but expired'
}

export {
  CREDS_DB_CACHE_KEY,
  CRED_SPECS,
  CRED_TYPES,
  CREDS_PATH_STEM,
  credStatus,
  purposes,
  types
}
