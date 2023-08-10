import * as fs from 'node:fs/promises'
import * as fsPath from 'node:path'

import createError from 'http-errors'

import { readFJSON, writeFJSON } from '@liquid-labs/federated-json'
import { LIQ_HOME } from '@liquid-labs/liq-defaults'

import { CREDS_DB_CACHE_KEY, CREDS_PATH_STEM, status, types } from './constants'

class CredentialsDB {
  static allFields = ['key', 'name', 'description', 'status', 'files']
  static defaultFields = CredentialsDB.allFields

  #cache
  #db
  #dbPath
  #supportedCredentials = []

  constructor({ cache }) {
    this.#dbPath = process.env.LIQ_CREDENTIALS_DB_PATH
      || /* default */ fsPath.join(LIQ_HOME(), CREDS_PATH_STEM, 'db.yaml')

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
    for (const spec of Object.values(writableDB)) {
      delete spec.description
      delete spec.name
    }

    writeFJSON({ file : this.#dbPath, data : writableDB })
  }

  detail(key, { required = false } = {}) {
    if (!this.#supportedCredentials.some(({ key : supportedKey }) => key === supportedKey)) { throw createError.BadRequest(`'${key}' is not a valid credential. Perhaps there is a missing plugin?`) }
    if (!(key in this.#db)) { throw createError.NotFound(`Credential '${key}' is not stored. Try:\n\nliq credentials import ${key} -- srcPath=/path/to/credential/file`) }

    const baseData = this.getCredSpec(key)
    if (baseData === undefined) return
    // else
    delete baseData.verifyFunc
    delete baseData.getTokenFunc

    return Object.assign({ status : status.NOT_SET }, baseData, this.#db[key])
  }

  getCredSpec(key, { required = false, msgGen = ({ key }) => `Unknown credential type '${key}'.` } = {}) {
    const spec = this.#supportedCredentials.find((c) => c.key === key)
    if (required === true && spec === undefined) throw new Error(msgGen({ key }))

    return Object.assign({}, spec)
  }

  /**
   * Adds credential data at `srcPath` to the credential database. The credential type is specified by the `key`.
   * Attempting to import a credential with the same `key` as an existing credential will result in an error unless
   * `replace` is`true`. By default, the credential file(s) are left in place, but may be copied (to a centralized
   * location) by designating `destPath'.`By deault, the credential is verified as providing access to the associated
   * service unless `noVerify` is specified.
   */
  async import({ destPath, key, noVerify = false, replace, srcPath }) {
    const credSpec = this.getCredSpec(key,
      { required : true, msgGen : ({ key }) => `Cannot import unknown credential type '${key}'.` })

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

    this.#db[key] = Object.assign({}, credSpec, { files, status : status.SET_BUT_UNTESTED })

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
    const detail = this.detail(key, { required : true })
    if (detail.type !== types.AUTH_TOKEN) { throw createError.BadRequest(`Credential '${specName(detail)}' does not provide an authorization token.`) }

    if (detail.getTokenFunc === undefined) { throw createError.NotImplemented(`Credential '${specName}' does not support token retrieval.`) }

    return detail.getTokenFunc({ files : detail.files })
  }

  list() {
    return Object.keys(this.#db).map((key) => this.detail(key))
  }

  listSupported() {
    return this.#supportedCredentials.map((e) => {
      const newEntry = Object.assign({}, e)
      newEntry.verifyFunc = !!newEntry.verifyFunc
      newEntry.getTokenFunc = !!newEntry.getTokenFunc

      return newEntry
    })
  }

  registerCredentialType(credSpec) {
    for (const field of ['key', 'name', 'type', 'verifyFunc']) {
      if (!(field in credSpec)) {
        throw createError.BadRequest(`Credentials spec '${specName(credSpec)}' missing field ${field}.`)
      }
    }

    this.#supportedCredentials.push(Object.assign({}, credSpec))
  }

  verifyCreds({ keys, reVerify = false, throwOnError = false }) {
    const failed = []

    for (const key of keys || Object.keys(this.#db)) {
      const { files, status : myStatus } = this.detail(key, { required : true })

      if (myStatus !== status.NOT_SET && (myStatus !== status.SET_AND_VERIFIED || reVerify === true)
          && (keys === undefined || keys.includes(key))) {
        try {
          const { verifyFunc } = this.getCredSpec(key, {
            required : true,
            msgGen   : ({ key }) => `Unknown credential '${key}' found in DB while attempting to verify credentials.`
          })
          verifyFunc({ files }) // will throw if there's a failure
          this.#db[key].status = status.SET_AND_VERIFIED
        }
        catch (e) {
          this.#db[key].status = status.SET_BUT_INVALID
          if (throwOnError === true) throw e
          // else
          failed.push(key)
        }
      }
    }
    return failed
  }
}

const specName = ({ name, key }) => name || key || 'UNKNOWN'

export {
  CredentialsDB
}
