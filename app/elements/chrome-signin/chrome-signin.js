(function() {
  'use strict';
  /**
   * Enum brand values.
   * @readonly
   * @enum {string}
   */
  const BrandValue = {
    GOOGLE: 'google',
    PLUS: 'google-plus'
  };
  /**
   * Enum height values.
   * @readonly
   * @enum {string}
   */
  /**
   * Enum button label default values.
   * @readonly
   * @enum {string}
   */
  const LabelValue = {
    STANDARD: 'Sign in',
    WIDE: 'Sign in with Google',
    WIDE_PLUS: 'Sign in with Google+'
  };
  /**
   * Enum width values.
   * @readonly
   * @enum {string}
   */
  const WidthValue = {
    ICON_ONLY: 'iconOnly',
    STANDARD: 'standard',
    WIDE: 'wide'
  };
  /**
   This is a Chrome apps version of `<google-signin>`.

    `<chrome-signin>` is used to authenticate with Google, allowing you to interact
    with other Google APIs such as Drive and Google+.
    If you do not need to show the button, use companion `<chrome-signin-aware>` element to
    declare scopes, check authentication state.

    If you don't declare scope in the element, the ones from manifest file will be used.

    #### Examples

    ```
    <chrome-signin></chrome-signin>
    <chrome-signin label-signin="Sign-in" scopes="https://www.googleapis.com/auth/drive">
    </chrome-signin>
    <chrome-signin theme="dark" width="iconOnly" scopes="https://www.googleapis.com/auth/drive">
    </chrome-signin>
    ```

    See https://elements.polymer-project.org/elements/google-signin for more information
  */
  class ChromeSignin extends Polymer.Element {
    static get properties() {
      return {
        /**
         * The brand being used for logo and styling.
         *
         * @default 'google'
         */
        brand: {
          type: String,
          value: 'google'
        },

        /** @private */
        _brand: {
          type: String,
          computed: '_computeBrand(brand)'
        },
        /** Current access token */
        accessToken: {
          type: String,
          notify: true
        },
        /**
         * The height to use for the button.
         *
         * Available options: short, standard, tall.
         *
         * @type {HeightValue}
         */
        height: {
          type: String,
          value: 'standard'
        },
        /**
         * By default the ripple expands to fill the button. Set this to true to
         * constrain the ripple to a circle within the button.
         */
        fill: {
          type: Boolean,
          value: true
        },
        /**
         * An optional label for the button for additional permissions.
         */
        labelAdditional: {
          type: String,
          value: 'Additional permissions required'
        },
        /**
         * An optional label for the sign-in button.
         */
        labelSignin: {
          type: String,
          value: '' // Sign in
        },

        _labelSignin: {
          type: String,
          computed: '_computeSigninLabel(labelSignin, width, _brand)'
        },
        /**
         * An optional label for the sign-out button.
         */
        labelSignout: {
          type: String,
          value: 'Sign out'
        },
        /**
         * If true, the button will be styled with a shadow.
         */
        raised: {
          type: Boolean,
          value: false
        },
        /**
         * The scopes to provide access to (e.g https://www.googleapis.com/auth/drive)
         * and should be space-delimited.
         */
        scopes: {
          type: String,
          notify: true
        },
        /**
         * The theme to use for the button.
         *
         * Available options: light, dark.
         *
         * @type {ThemeValue}
         * @default 'dark'
         */
        theme: {
          type: String,
          value: 'light'
        },
        /**
         * The width to use for the button.
         *
         * Available options: iconOnly, standard, wide.
         *
         * @type {WidthValue}
         */
        width: {
          type: String,
          value: 'standard'
        },
        _brandIcon: {
          type: String,
          computed: '_computeIcon(_brand)'
        },
        /**
         * True if additional authorization required globally
         */
        needAdditionalAuth: {
          type: Boolean,
          value: false
        },
        /**
         * Is user signed in?
         */
        signedIn: {
          type: Boolean,
          notify: true,
          value: false
        },
        /**
         * True if authorizations for *this* element have been granted
         */
        isAuthorized: {
          type: Boolean,
          notify: true,
          value: false,
          observer: '_observeIsAuthorized'
        }
      };
    }
    _computeButtonClass(height, width, theme, isAuthorized, brand, needAdditionalAuth) {
      return 'height-' + height + ' width-' + width + ' theme-' + theme + ' signedIn-' +
        isAuthorized + ' brand-' + brand + '  additionalAuth-' + needAdditionalAuth;
    }

    _computeIcon(brand) {
      return 'google:' + brand;
    }

    /* Button state computed */
    _computeButtonIsSignIn(isAuthorized) {
      return !isAuthorized;
    }

    _computeButtonIsSignOut(isAuthorized, additionalAuth) {
      return isAuthorized && !additionalAuth;
    }

    _computeButtonIsSignOutAddl(isAuthorized, additionalAuth) {
      return isAuthorized && additionalAuth;
    }

    _computeBrand(attrBrand) {
      let newBrand;
      if (attrBrand) {
        newBrand = attrBrand;
      } else {
        newBrand = BrandValue.GOOGLE;
      }
      return newBrand;
    }

    _observeIsAuthorized(newVal) {
      if (newVal) {
        if (this.needAdditionalAuth) {
          this.fire('google-signin-necessary');
        } else {
          this.fire('google-signin-success');
        }
      } else {
        this.fire('google-signed-out');
      }
    }
    /**
     * Determines the proper label based on the attributes.
     * @param {String} labelSignin
     * @param {String} width
     * @param {String} _brand
     * @return {String}
     */
    _computeSigninLabel(labelSignin, width, _brand) {
      if (labelSignin) {
        return labelSignin;
      } else {
        switch (width) {
          case WidthValue.WIDE:
            return (_brand === BrandValue.PLUS) ?
              LabelValue.WIDE_PLUS : LabelValue.WIDE;
          case WidthValue.STANDARD:
            return LabelValue.STANDARD;
          case WidthValue.ICON_ONLY:
            return '';
          default:
            return LabelValue.STANDARD;
        }
      }
    }
    /** Sign in user. Opens the authorization dialog for signing in.
     * The dialog will be blocked by a popup blocker unless called inside click handler.
     */
    signIn() {
      this.fire('google-signin-attempted');
      this.$.aware.signIn();
    }

    _signInKeyPress(e) {
      if (e.which === 13 || e.keyCode === 13 || e.which === 32 || e.keyCode === 32) {
        e.preventDefault();
        this.signIn();
      }
    }

    /** Sign out the user */
    signOut() {
      this.fire('google-signout-attempted');
      this.$.aware.signOut();
    }

    _signOutKeyPress(e) {
      if (e.which === 13 || e.keyCode === 13 || e.which === 32 || e.keyCode === 32) {
        e.preventDefault();
        this.signOut();
      }
    }

    fire(type) {
      this.dispatchEvent(new CustomEvent(type));
    }
    /**
     * Fired when user is signed in.
     *
     * @event google-signin-success
     */
    /**
     * Fired when the user is signed-out.
     * @event google-signed-out
     */
    /**
     * Fired if user requires additional authorization
     * @event google-signin-necessary
     */
    /**
     * Fired when signed in, and scope has been authorized
     * @param {Object} result Authorization result.
     * @event google-signin-aware-success
     */
    /**
     * Fired when this scope is not authorized
     * @event google-signin-aware-signed-out
     */
  }
  window.customElements.define('chrome-signin', ChromeSignin);
}());
