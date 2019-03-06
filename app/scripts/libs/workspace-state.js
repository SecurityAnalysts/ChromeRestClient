const STORE_NAME = 'arc-workspace';
const STORE_VERSION = 1;
let workspaceName;
/**
 * A module responsible for storing / restoring workspace state.
 * It uses IndexedDB as a backend to store the data.
 *
 * Database name: `arc-workspace`
 * Store name: `workspace`
 *
 * Keys (`id`) represent a unique id of the workspace. By default it is index of
 * the opened window. However (this is planned feature) the user can open previously
 * saved workspace and the id is a UUID generated for the entry.
 *
 * Value is a workspace state dispatched in a custom event by arc workspace element.
 *
 * Each state contains the following properties:
 * - name `String` - Workspace name. Optional for autogenerated workspaces
 * - environment `String` - Last used environment
 * - selected `Number` - Selected request in the workspace
 * - requests `Array<Object>` - List of requests in the workspace
 * - config `Object` - Workspace configuration
 * - variables `Array<Object>` - List of variables in the workspace
 *
 * The workspace is tied to the window. When replacing the workspace it has to
 * create new window.
 */
export class WorkspaceState {
  /**
   * @param {String} name Workspace id.
   */
  constructor(name) {
    if (!name) {
      throw new Error('Trying to initialize workspace without indetificator');
    }
    workspaceName = name;
    this._readHandler = this._readHandler.bind(this);
    this._storeHandler = this._storeHandler.bind(this);
    this._createSchema = this._createSchema.bind(this);
  }

  get name() {
    return workspaceName;
  }

  get workspaceId() {
    return `workspace-${this.name}`;
  }

  listen() {
    window.addEventListener('workspace-state-read', this._readHandler);
    window.addEventListener('workspace-state-store', this._storeHandler);
  }

  getStore() {
    if (this.__db) {
      return Promise.resolve(this.__db);
    }
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(STORE_NAME, STORE_VERSION);
      request.onsuccess = (e) => {
        this.__db = e.target.result;
        resolve(e.target.result);
      };
      request.onerror = function() {
        reject(new Error('Unable to open the store'));
      };
      request.onupgradeneeded = this._createSchema;
    });
  }

  /**
   * Creates a database schema when is newly created.
   * @param {Event} e Database create request event
   */
  _createSchema(e) {
    const db = e.target.result;
    const store = db.createObjectStore('workspace', {keyPath: 'id'});
    store.createIndex('name', 'name', {unique: false});
    store.createIndex('environment', 'environment', {unique: false});
  }

  _readHandler(e) {
    if (e.defaultPrevented) {
      return;
    }
    e.preventDefault();
    e.detail.result = this.readState();
  }

  readState() {
    return this.getStore()
    .then((db) => this._readState(db));
  }

  _readState(db) {
    return new Promise((resolve) => {
      const tx = db.transaction('workspace', 'readonly');
      const store = tx.objectStore('workspace');
      tx.onerror = () => {
        console.warn('Transaction error: _readState');
        resolve({});
      };
      const request = store.get(this.workspaceId);
      request.onsuccess = (e) => {
        resolve(e.target.result);
      };
    });
  }

  _storeHandler(e) {
    if (e.defaultPrevented) {
      return;
    }
    e.preventDefault();
    const state = Object.assign({}, e.detail.value);
    e.detail.result = this.storeState(state);
  }

  storeState(state) {
    return this.getStore()
    .then((db) => this._storeState(db, state));
  }

  _storeState(db, state) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('workspace', 'readwrite');
      const store = tx.objectStore('workspace');
      tx.onerror = () => {
        console.warn('Transaction error: _storeState');
        reject(new Error('Unable to store workspace state.'));
      };
      state.id = this.workspaceId;
      const request = store.put(state);
      request.onsuccess = (e) => {
        resolve(e.target.result);
      };
    });
  }
}
