(function() {
  'use strict';
  const AuthEngine = {
    _grantedScopeArray: [],
    _requestedScopeArray: [],
    signinAwares: [],
    signedIn: true,
    accessToken: null,

    attachSigninAware: function(aware) {
      if (this.signinAwares.indexOf(aware) === -1) {
        this.signinAwares.push(aware);
        aware._setAccessToken(this.accessToken);
        aware._setIsAuthorized(this.isAuthorized);
        aware._setSignedIn(this.signedIn);
      }
    },

    detachSigninAware: function(aware) {
      const index = this.signinAwares.indexOf(aware);
      if (index !== -1) {
        this.signinAwares.splice(index, 1);
      }
    },

    signIn: function(interactive) {
      if (!this.signedIn) {
        return Promise.reject({
          'message': 'The user is not signed in.'
        });
      }
      return this.getToken(interactive);
    },

    signOut: function() {
      this.revokeToken();
    },
    /**
     * Clear auth data.
     * @return {Promise}
     */
    clearCache: function() {
      if (!this.accessToken) {
        return Promise.resolve(true);
      }
      return new Promise((resolve) => {
        chrome.identity.removeCachedAuthToken({
          token: this.accessToken
        }, () => {
          this.setTokenData(null);
          resolve(true);
        });
      });
    },
    /**
     * Revoke access token. The token will not work after this operation.
     */
    revokeToken: function() {
      this.getToken(false).then((accessToken) => {
          if (!accessToken) {
            this.setTokenData(null);
            return;
          }
          window.setTimeout(() => {
            this.clearCache();
          }, 1);
          // any aware will be ok.
          // In chrome apps token will exist until it's revoked.
          // To do this the app need to make a call to perform the operation.
          this.signinAwares[0].$.revokeRequest.generateRequest();
        })
        .catch((e) => {
          let event = new CustomEvent('app-log', {
            detail: {
              'message': ['Token revoke error.', e],
              'level': 'error'
            }
          });
          document.dispatchEvent(event);
        });
    },

    /**
     * true if scopes have been granted
     * @param {String} scopeStr
     * @return {Boolean}
     */
    hasGrantedScopes: function(scopeStr) {
      const scopes = this._toScopeArray(scopeStr);
      for (let i = 0; i < scopes.length; i++) {
        if (this._grantedScopeArray.indexOf(scopes[i]) === -1) {
          return false;
        }
      }
      return true;
    },

    updateScopes: function(scopes) {
      const newScopes = this._toScopeArray(scopes);
      let scopesUpdated = false;
      for (let i = 0; i < newScopes.length; i++) {
        if (this._requestedScopeArray.indexOf(newScopes[i]) === -1) {
          this._requestedScopeArray.push(newScopes[i]);
          scopesUpdated = true;
        }
      }
      if (scopesUpdated) {
        this._restore().catch(() => {});
      }
    },
    /**
     * To be called when successfully authorized.
     * @param {String} accessToken
     */
    setTokenData: function(accessToken) {
      this.accessToken = accessToken;
      this.isAuthorized = accessToken ? true : false;
      if (accessToken) {
        this.signedIn = true;
      } else {
        this._grantedScopeArray = [];
      }
      this.signinAwares.forEach((aware) => {
        aware._setAccessToken(this.accessToken);
        aware._setIsAuthorized(this.isAuthorized);
        aware._setSignedIn(this.signedIn);
      });
    },
    /**
     * Construct an options for chrome.identity.getAuthToken function.
     * @param {Boolean} interactive
     * @return {Object}
     */
    _authOptions: function(interactive) {
      if (typeof interactive !== 'boolean') {
        interactive = true;
      }
      const options = {
        interactive: interactive
      };
      if (this._requestedScopeArray !== null) {
        options.scopes = this._toScopeArray(this._requestedScopeArray);
      }
      return options;
    },
    /**
     * Restore token info.
     * @return {String|undefined}
     */
    _restore: function() {
      return this.getToken(false).catch(() => {});
    },

    getToken: function(interactive) {
      return new Promise((resolve, reject) => {
        try {
          let options = this._authOptions(interactive);
          chrome.identity.getAuthToken(options, (accessToken) => {
            let error = chrome.runtime.lastError;
            if (!!error) {
              this.setTokenData(null);
              if (error.message === 'The user is not signed in.') {
                this.signinAwares.forEach((aware) => {
                  this.signedIn = false;
                  aware._setSignedIn(false);
                });
              }
              reject(error);
              return;
            }
            if (accessToken && options.scopes) {
              let arr = this._grantedScopeArray.concat(options.scopes);
              this._grantedScopeArray = arr.filter((item) => {
                return arr.indexOf(item) === -1;
              });
            }
            this.signedIn = true;
            this.signinAwares.forEach((aware) => {
              aware._setSignedIn(true);
            });
            this.setTokenData(accessToken);
            resolve(accessToken);
          });
        } catch (e) {
          this.setTokenData(null);
          reject(e);
        }
      });
    },

    /**
     * convert scope string to scope array
     * @param {String} str
     * @return {Array<String>}
     */
    _toScopeArray: function(str) {
      if (!str) {
        return [];
      }
      if (str instanceof Array) {
        return str;
      }
      // remove extra spaces, then split
      const scopes = str.replace(/[\ ,]+/g, ' ').trim().split(' ');
      for (let i = 0; i < scopes.length; i++) {
        scopes[i] = scopes[i].toLowerCase();
        // Handle scopes that will be deprecated but are still returned with their old value
        if (scopes[i] === 'https://www.googleapis.com/auth/userinfo.profile') {
          scopes[i] = 'profile';
        }
        if (scopes[i] === 'https://www.googleapis.com/auth/userinfo.email') {
          scopes[i] = 'email';
        }
      }
      // return with duplicates filtered out
      return scopes.filter(function(value, index, self) {
        return self.indexOf(value) === index;
      });
    }
  };
  /**
  `chrome-signin-aware` is used to enable authentication in custom elements by
  interacting with a `chrome-signin` element that needs to be present somewhere
  on the page.
  The element is based on `google-signin-aware` element but it is created to support Chrome Apps.

  The `chrome-signin-aware-success` event is triggered when a user successfully
  authenticates.
  The `google-signin-aware-signed-out` event is triggered when a user explicitly
  signs out via the `chrome-signin` element.

  You can bind to `isAuthorized` property to monitor authorization state.
  ##### Example
      <template id="awareness" is="dom-bind">
        <chrome-signin-aware
          on-chrome-signin-aware-success="handleSignin"
          on-chrome-signin-aware-signed-out="handleSignOut"></google-signin-aware>
      </template>
      <script>
        var aware = document.querySelector('#awareness');
        aware.handleSignin = function(response) {
          chrome.identity.getProfileUserInfo(function(info) {
            console.log('User email: %s, user id: %s', info.email, info.id);
          });
        };
        aware.handleSignOut = function() {
          // logout the user.
        };
    </script>
  */
  class ChromeSigninAware extends Polymer.Element {
    static get properties() {
      return {
        /**
         * True if user is signed in to Chrome. The API won't work if the user is not signed in.
         */
        signedIn: {
          type: Boolean,
          notify: true,
          readOnly: true,
          value: true
        },
        /**
         * True if authorizations for *this* element have been granted
         */
        isAuthorized: {
          type: Boolean,
          notify: true,
          readOnly: true,
          value: false,
          observer: '_isAuthorizedChanged'
        },
        /**
         * If provided it will change scopes provided in the manifest file.
         */
        scopes: {
          type: String,
          notify: true,
          observer: '_scopeChanged'
        },
        /**
         * Current access token.
         */
        accessToken: {
          type: String,
          notify: true,
          readOnly: true
        },
        /**
         * True if additional authorizations for *any* element are required
         */
        needAdditionalAuth: {
          type: Boolean,
          notify: true,
          readOnly: true
        },
        /**
         * List of scopes that that access has been granted to
         */
        _grantedScopeArray: {
          type: Array,
          value: []
        },
        /**
         * A handler for user session state change
         */
        _signInChanged: {
          type: Function,
          value: function() {
            return this._onUserChange.bind(this);
          }
        }
      };
    }

    ready() {
      if (!this.scopes && chrome.runtime.getManifest) {
        this.set('scopes', chrome.runtime.getManifest().oauth2.scopes);
      }
      this.signIn(false);
    }

    connectedCallback() {
      super.connectedCallback();
      chrome.identity.onSignInChanged.addListener(this._signInChanged);
      AuthEngine.attachSigninAware(this);
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      chrome.identity.onSignInChanged.removeListener(this._signInChanged);
      AuthEngine.detachSigninAware(this);
    }
    /**
     * Authorize the user.
     * If `interactive` parameter is set to true (default false) it pops up the authorization
     * dialog if the user did not authorized the app.
     *
     * @param {Boolean} interactive Show popup dialog if not authorized.
     * @return {Promise} Fulfilled promise with authorization result.
     * Promise will reject if the user is not signed in to Chrome or
     * error ocurred during the request.
     */
    signIn(interactive) {
      return AuthEngine.signIn(interactive)
      .catch((e) => {
        let type;
        let detail;
        if (e.message && e.message.indexOf('did not approve') !== -1) {
          type = 'chrome-signin-aware-canceled';
        } else {
          type = 'chrome-signin-aware-error';
          detail = e;
        }
        this.dispatchEvent(new CustomEvent(type, {
          bubbles: true,
          composed: true,
          detail
        }));
      });
    }
    /** signs user out */
    signOut() {
      AuthEngine.signOut();
    }

    /**
     * A function to be called when the token has been revoked.
     */
    _tokenRevokedHandler() {
      // AuthEngine.clearCache()
      // .then(() => {
      //   // this._scopeChanged(this.scopes);
      //   // this.fire('google-signin-aware-signed-out');
      // })
      // .catch((e) => {
      //
      // });
    }
    /**
     * Revoke error handler.
     * @param {Event} e
     */
    _tokenRevokeError(e) {
      console.warn(e);
    }

    /**
     * A success handler for token info request.
     * @param {CustomEvent} e
     */
    _tokenInfoHandler(e) {
      const tokenInfo = e.detail.response;
      if (!tokenInfo) {
        AuthEngine.setTokenData(null);
        return;
      }
      if (tokenInfo.expires_in <= 0) {
        AuthEngine.setTokenData(null);
      }
    }
    /**
     * An error handler for token info request.
     * @param {CustomEvent} e
     */
    _tokenInfoError(e) {
      switch (e.detail.xhr.status) {
        case 400:
          // bad request - accessToken not ready.
          break;
        default:
          console.error(e);
      }
    }

    /**
     * Fired when signin state changes for an account on the user's profile.
     * @param {Object} account
     * @param {Boolean} signedIn
     */
    _onUserChange(account, signedIn) {
      if (signedIn) {
        this._setSignedIn(true);
        this._restore();
      } else {
        this._setSignedIn(false);
        AuthEngine.setTokenData(null);
      }
      this._scopeChanged(this.scopes);
    }

    _scopeChanged(newVal) {
      AuthEngine.updateScopes(newVal);
      // need to tell if the user authorized current scope.
      const newAuthorized = this.isAuthorized && AuthEngine.hasGrantedScopes(this.scopes);
      if (newAuthorized !== this.isAuthorized) {
        this._setIsAuthorized(newAuthorized);
      }
    }

    _isAuthorizedChanged(isAuthorized) {
      let detail;
      let type;
      if (isAuthorized) {
        type = 'chrome-signin-aware-success';
        detail = {
          token: this.accessToken
        };
      } else {
        type = 'chrome-signin-aware-signed-out';
        AuthEngine.setTokenData(null);
      }
      this.dispatchEvent(new CustomEvent(type, {
        bubbles: true,
        composed: true,
        detail
      }));
    }
    /**
     * Fired when the user has been authorized
     * @param {String} token Authorization token.
     * @event chrome-signin-aware-success
     */
    /**
     * Fired when the user is signed out
     * @event chrome-signin-aware-signed-out
     */
  }
  window.customElements.define('chrome-signin-aware', ChromeSigninAware);
})();
