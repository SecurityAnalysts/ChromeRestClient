/**
 * It'a a wrapper for API console to render the console from unresolved
 * AMF model.
 *
 * ARC stores unresolved ld+json model of AMF so it is possible to generate
 * RAML/OAS files from it later. Before API console can be used with data model
 * it has to be resolved.
 */
class ApicChrome extends ArcComponents.ArcFileDropMixin(
  ApiElements.AmfHelperMixin(Polymer.Element)) {
  static get is() {
    return 'apic-chrome';
  }
  static get properties() {
    return {
      /**
       * Unresolved AMF model.
       */
      amf: String,
      /**
       * API original type.
       */
      apiType: String,
      /**
       * Resolved AMF model.
       */
      amfModel: Object,
      /**
       * Passed to API console's `selected` property.
       */
      selected: String,
      /**
       * Passed to API console's `selectedType` property.
       */
      selectedType: String,
      narrow: Boolean,
      scrollTarget: Object,

      baseUri: {
        type: String,
        computed: '_computeBaseUri(amfModel)',
        observer: '_baseUriChanged'
      },

      apiVersion: {
        type: String,
        notify: true,
        computed: '_getApiVersion(amfModel)'
      },

      apiInfo: {
        type: Object,
        readOnly: true,
        notify: true
      },

      versions: {
        type: Array,
        notify: true,
        computed: '_computeVersionsList(apiInfo.*)'
      },

      multiVersion: {
        type: Boolean,
        notify: true,
        computed: '_computeIsMultiVersion(versions)'
      },

      saved: {
        type: Boolean,
        notify: true,
        readOnly: true
      },

      canSave: {
        type: Boolean,
        notify: true,
        computed: '_computeCanSave(baseUri, apiVersion)'
      },

      versionSaved: {
        type: Boolean,
        notify: true,
        computed: '_computeIsVersionSaved(versions.*, apiVersion)'
      },
      /**
       * When set the API is being processed.
       */
      apiProcessing: {type: Boolean, notify: true}
    };
  }

  static get observers() {
    return [
      '_amfChanged(amf, apiType)'
    ];
  }

  constructor() {
    super();
    this._indexChangeHandler = this._indexChangeHandler.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('api-index-changed', this._indexChangeHandler);
    // window.addEventListener('api-version-deleted', this._indexChangeHandler);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('api-index-changed', this._indexChangeHandler);
  }

  _amfChanged(amf, type) {
    if (!amf || typeof amf !== 'string' || !type) {
      this.amfModel = undefined;
      return;
    }
    if (this.__processingResolve) {
      clearTimeout(this.__processingResolve);
    }
    this.__processingResolve = setTimeout(() => {
      this.__processingResolve = undefined;
      this._processApi(amf, type);
    });
  }

  _processApi(amf, type) {
    this.apiProcessing = true;
    const e = this._dispatchResolve(amf, type);
    return e.detail.result
    .then((model) => {
      this.amfModel = JSON.parse(model);
      this.apiProcessing = false;
    })
    .catch((cause) => {
      this.apiProcessing = false;
      this.$.errorToast.text = cause.message;
      this.$.errorToast.opened = true;
      console.error(cause);
    });
  }

  _dispatchResolve(model, type) {
    const e = new CustomEvent('api-resolve-model', {
      bubbles: true,
      composed: true,
      cancelable: true,
      detail: {
        model,
        type
      }
    });
    this.dispatchEvent(e);
    return e;
  }

  /**
   * Computes model's base Uri
   * @param {Object|Array} model AMF data model
   * @return {String}
   */
  _computeBaseUri(model) {
    if (!model) {
      return;
    }
    const server = this._computeServer(model);
    const protocols = this._computeProtocols(model);
    return this._getAmfBaseUri(server, protocols);
  }

  _getApiVersion(amfModel) {
    let version = this._computeApiVersion(amfModel);
    if (!version) {
      version = '1';
    }
    return String(version);
  }

  _baseUriChanged(baseUri) {
    this._setSaved(false);
    this._setApiInfo(undefined);
    if (!baseUri) {
      return;
    }
    this._getApiInfo(baseUri)
    .then((apiInfo) => {
      const saved = !!apiInfo;
      if (this.saved !== saved) {
        this._setSaved(saved);
      }
      if (saved) {
        this._setApiInfo(apiInfo);
      }
    })
    .catch((cause) => {
      console.error(cause);
    });
  }

  _computeCanSave(baseUri, apiVersion) {
    if (!baseUri || !apiVersion) {
      return false;
    }
    return true;
  }

  _getApiInfo(baseUri) {
    const e = new CustomEvent('api-index-read', {
      detail: {
        baseUri
      },
      bubbles: true,
      cancelable: true,
      composed: true
    });
    this.dispatchEvent(e);
    if (!e.defaultPrevented) {
      return Promise.reject(new Error('APIs model is not in the DOM'));
    }
    return e.detail.result;
  }

  _computeIsVersionSaved(record, apiVersion) {
    const versions = record && record.base;
    if (!versions || !versions.length || !apiVersion) {
      return;
    }
    return versions.indexOf(apiVersion) !== -1;
  }

  _computeIsMultiVersion(versions) {
    if (!versions) {
      return false;
    }
    return versions.length > 1;
  }
  /**
   * Opens previously saved API.
   * @param {String} id API database ID
   * @param {?String} version API version. Default to latest version
   * @return {Prommise} Promise resolved when API unresolved data are set.
   * Note, property change observers will run model resolving API when
   * unresolved model and type is set.
   */
  open(id, version) {
    this.amf = undefined;
    this.amfModel = undefined;
    this.apiProcessing = true;
    return this.getApi(id, version)
    .then((result) => {
      let api = result.api;
      if (api && typeof api !== 'string') {
        api = JSON.stringify(api);
      }
      this.amf = api;
      this.apiType = result.type;
    })
    .catch((cause) => {
      this.apiProcessing = false;
      throw cause;
    });
  }

  save() {
    if (!this.amfModel) {
      return Promise.reject(new Error('AMF model not set'));
    }
    if (!this.canSave) {
      return Promise.reject(new Error('API version is missing.'));
    }
    const apiInfo = this.apiInfo;
    if (!apiInfo) {
      return this._saveApi();
    }
    return this._saveVersion(Object.assign({}, apiInfo));
  }

  _saveApi() {
    const baseUri = this.baseUri;
    if (!baseUri) {
      return Promise.reject(new Error('API base URI is missing.'));
    }
    const webApi = this._computeWebApi(this.amfModel);
    const title = this._getValue(webApi, this.ns.schema.schemaName);
    if (!title) {
      return Promise.reject(new Error('API title is missing.'));
    }
    const info = {
      _id: baseUri,
      title,
      order: 0,
      type: this.apiType
    };
    return this._saveVersion(info);
  }

  _saveVersion(apiInfo) {
    const version = this.apiVersion;
    if (!version) {
      return Promise.reject(new Error('API version is missing.'));
    }
    return this._updateVersionInfo(apiInfo, version)
    .then(() => this._updateDataObject(apiInfo._id, version));
  }

  _updateVersionInfo(apiInfo, version) {
    if (!(apiInfo.versions instanceof Array)) {
      apiInfo.versions = [];
    } else {
      apiInfo.versions = Array.from(apiInfo.versions);
    }
    if (apiInfo.versions.indexOf(version) === -1) {
      apiInfo.versions.push(version);
    }
    apiInfo.latest = version;
    if (!this.apiInfo) {
      this._setApiInfo(apiInfo);
    }
    const e = new CustomEvent('api-index-changed', {
      detail: {
        apiInfo
      },
      bubbles: true,
      cancelable: true,
      composed: true
    });
    this.dispatchEvent(e);
    if (!e.defaultPrevented) {
      return Promise.reject(new Error('APIs model is not in the DOM'));
    }
    return e.detail.result;
  }

  _updateDataObject(id, version) {
    const e = new CustomEvent('api-data-changed', {
      detail: {
        indexId: id,
        version,
        data: this.amf
      },
      bubbles: true,
      cancelable: true,
      composed: true
    });
    this.dispatchEvent(e);
    if (!e.defaultPrevented) {
      return Promise.reject(new Error('APIs model is not in the DOM'));
    }
    return e.detail.result;
  }

  _indexChangeHandler(e) {
    if (e.cancelable || !this.apiInfo) {
      return;
    }
    const changed = e.detail.apiInfo;
    if (this.apiInfo._id !== changed._id) {
      return;
    }
    this._setApiInfo(changed);
    if (!this.saved) {
      this._setSaved(true);
    }
  }
  /**
   * Requests to delete current API from the data store.
   * It removes all versions of the API data and then the API index.
   * @return {Promise}
   */
  delete() {
    if (!this.saved) {
      return Promise.reject(new Error('This API is not yet saved'));
    }
    const info = this.apiInfo;
    if (!info) {
      return Promise.reject(new Error('API data not restored'));
    }
    const e = new CustomEvent('api-deleted', {
      detail: {
        id: info._id
      },
      bubbles: true,
      cancelable: true,
      composed: true
    });
    this.dispatchEvent(e);
    if (!e.defaultPrevented) {
      return Promise.reject(new Error('APIs model is not in the DOM'));
    }
    return e.detail.result;
  }
  /**
   * Removes given version of the API.
   *
   * @param {String} version
   * @return {Promise}
   */
  deleteVersion(version) {
    if (!this.saved) {
      return Promise.reject(new Error('This API is not yet saved'));
    }
    const info = this.apiInfo;
    if (!info) {
      return Promise.reject(new Error('API data not restored'));
    }
    const e = new CustomEvent('api-version-deleted', {
      detail: {
        id: info._id,
        version
      },
      bubbles: true,
      cancelable: true,
      composed: true
    });
    this.dispatchEvent(e);
    if (!e.defaultPrevented) {
      return Promise.reject(new Error('APIs model is not in the DOM'));
    }
    return e.detail.result;
  }

  getApi(id, version) {
    if (!id) {
      return Promise.reject(new Error('No API id given'));
    }
    let apiType;
    return this._getApiInfo(id)
    .then((doc) => {
      apiType = doc.type;
      if (!version) {
        version = doc.latest;
      }
      return this._requestApiVersion(id + '|' + version);
    })
    .then((api) => {
      return {
        api,
        type: apiType
      };
    });
  }

  _requestApiVersion(versionId) {
    const e = new CustomEvent('api-data-read', {
      detail: {
        id: versionId
      },
      bubbles: true,
      cancelable: true,
      composed: true
    });
    this.dispatchEvent(e);
    if (!e.defaultPrevented) {
      return Promise.reject(new Error('APIs model is not in the DOM'));
    }
    return e.detail.result
    .then((doc) => doc.data);
  }

  _computeVersionsList(record) {
    const info = record && record.base;
    if (!info) {
      return;
    }
    if (!info.versions) {
      info.versions = [];
    }
    return info.versions;
  }
}
window.customElements.define(ApicChrome.is, ApicChrome);
