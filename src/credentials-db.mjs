import * as fs from 'node:fs/promises'
import * as fsPath from 'node:path'

import createError from 'http-errors'

import { readFJSON, writeFJSON } from '@liquid-labs/federated-json'
import { checkGitHubAPIAccess, checkGitHubSSHAccess } from '@liquid-labs/github-toolkit'
import { LIQ_HOME } from '@liquid-labs/liq-defaults'

import { CREDS_DB_CACHE_KEY, CRED_SPECS, credStatus, purposes, types } from './constants'

class CredentialsDB {
  static allFields = ['key', 'name', 'description', 'status', 'files']
  static defaultFields = CredentialsDB.allFields

  #cache
  #db
  #dbPath

  constructor({ cache }) {
    this.#dbPath = process.env.LIQ_CREDENTIALS_DB_PATH
      || /* default */ fsPath.join(LIQ_HOME(), 'credentials/db.yaml')

    this.#cache = cache

    this.resetDB()
  }

  resetDB() {
    let db = this.#cache?.get(CREDS_DB_CACHE_KEY)
    if (!db) { // load the DB from path
      ([db] = readFJSON(this.#dbPath, { createOnNone : {}, separateMeta : true }))
      this.#cache.put(CREDS_DB_CACHE_KEY, db)
    }

    this.#db = db
  }

  writeDB() {
    const writableDB = structuredClone(this.#db)
    for (const entry of Object.entries(this.#db)) {
      if (!(entry.key in CRED_SPECS)) {
        delete entry.description
        delete entry.name
      }
    }

    writeFJSON({ file : this.#dbPath, data : writableDB })
  }

  detail(key) {
    const baseData = CRED_SPECS.find((s) => s.key === key)
    if (baseData === undefined) return baseData

    return Object.assign({ status : credStatus.NOT_SET }, baseData, this.#db[key])
  }

  /**
   * Adds credential data at `srcPath` to the credential database. The credential type is specified by the `key`.
   * Attempting to import a credential with the same `key` as an existing credential will result in an error unless
   * `replace` is`true`. By default, the credential file(s) are left in place, but may be copied (to a centralized
   * location) by designating `destPath'.`By deault, the credential is verified as providing access to the associated
   * service unless `noVerify` is specified.
   */
  async import({ destPath, key, noVerify = false, replace, srcPath }) {
    const credSpec = CRED_SPECS.find((c) => c.key === key)
    if (credSpec === undefined) throw new Error(`Cannot import unknown credential type '${key}'.`)
    if (this.#db[key] !== undefined && replace !== true) { throw new Error(`Credential '${key}' already exists; set 'replace' to true to update the entry.`) }

    if (!Object.values(types).includes(credSpec.type)) {
      throw new Error(`Do not know how to handle credential type '${credSpec.type}' on import.`)
    }

    const files = []

    if (destPath !== undefined && fsPath.resolve(destPath) !== fsPath.resolve(fsPath.dirName(srcPath))) {
      await fs.mkdir(destPath, { recursive : true })
      if (credSpec.type === types.SSH_KEY_PAIR) {
        const privKeyPath = fsPath.join(destPath, key)
        const pubKeyPath = fsPath.join(destPath, key + '.pub')
        await fs.copyFile(srcPath, privKeyPath, { mode : fs.constants.COPYFILE_EXCL })
        await fs.copyFile(srcPath + '.pub', pubKeyPath, { mode : fs.constants.COPYFILE_EXCL })
        files.push(privKeyPath)
        files.push(pubKeyPath)
      }
      else if (credSpec.type === types.AUTH_TOKEN) {
        const tokenPath = fsPath.join(destPath, key + types.AUTH_TOKEN)
        await fs.copyFile(srcPath, tokenPath, { mode : fs.constants.COPYFILE_EXCL })
        files.push(tokenPath)
      }
    }
    else { // we do not copy the files, but leave them in place
      files.push(srcPath)
      if (credSpec.type === types.SSH_KEY_PAIR) {
        files.push(srcPath + '.pub')
      }
    }

    this.#db[key] = Object.assign({ files, status : credStatus.SET_BUT_UNTESTED }, CRED_SPECS[key])

    if (noVerify === false) {
      try {
        this.verifyCreds({ keys : [key], throwOnError : true })
      }
      catch (e) {
        this.resetDB()
        throw e
      }
    }

    this.writeDB()
  }

  getToken(key) {
    if (!Object.values(purposes).includes(key)) throw createError.BadRequest(`'${key}' is not a valid credential.`)
    if (!(key in this.#db)) { throw createError.NotFound(`Credential '${key}' is not stored. Try:\n\nliq credentials import ${key} -- srcPath=/path/to/credential/file`) }

    const detail = this.detail(key)
    if (detail.type !== types.AUTH_TOKEN) { throw createError.BadRequest(`Credential '${key}' does not provide an authorization token.`) }

    if (key === purposes.GITHUB_API) {
      // TODO: it's a yaml file, which is the FJSON default, so this will work. In future, we should implement a 'readAs' and be specific.
      let credentialData
      try {
        credentialData = readFJSON(detail.files[0], { readAs : 'yaml' })
      }
      catch (e) {
        throw createError.InternalServerError(`There was a problem reading the ${key} credential file`, { cause : e })
      }
      const token = credentialData?.['github.com']?.[0]?.oauth_token
      if (token === undefined) throw createError.NotFound(`The ${key} token was not defined in the credential source.`)

      return token
    }
    else {
      throw createError.NotImplemented(`Credential '${key}' is a known type, but token retrieval is not implemented.`)
    }
  }

  list() {
    return CRED_SPECS.map((s) => this.detail(s.key))
  }

  verifyCreds({ keys, reVerify = false, throwOnError = false }) {
    const failed = []

    for (const { files, key, name, status } of this.list()) {
      if (status !== credStatus.NOT_SET && (status !== credStatus.SET_AND_VERIFIED || reVerify === true)
          && (keys === undefined || keys.includes(key))) {
        try {
          if (key === purposes.GITHUB_API) {
            checkGitHubAPIAccess({ filePath : files[0] })
          }
          else if (key === purposes.GITHUB_SSH) {
            checkGitHubSSHAccess({ privKeyPath : files[0] })
          }
          else {
            throw new Error(`Do not know how to verify '${name}' (${key}) credentials.`)
          }
          this.#db[key].status = credStatus.SET_AND_VERIFIED
        }
        catch (e) {
          this.#db[key].status = credStatus.SET_BUT_INVALID
          if (throwOnError === true) throw e
          // else
          failed.push(key)
        }
      }
    }
    return failed
  }
}

export {
  CredentialsDB
}
