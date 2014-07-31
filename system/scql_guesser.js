
// This object exposes two main properties: currentText, which you should bind to an input view,
// and tokenStack, which contains an array of strings extracted from currentText as you go.

QueryAutocomplete.ScqlGuesser = SC.Object.extend({

  currentText: null,

  tokenStack: [],

  doShiftToken: function() {
    this._processCurrentText(YES);
  },

  _processCurrentText: function(_force) {
    // Pause notifications for the duration.
    this.beginPropertyChanges();

    var currentText = this.get('currentText'),
        currentTokens = this._q.tokenizeString(currentText, this._q.queryLanguage);

    // If our text tokenizes to more than one, move the leading ones onto the stack.
    var token;
    while (currentTokens.length > 1) {
      this._shiftToken(currentTokens.shift());
    }

    // If we have one token and our text ends in a space, or we're forcing, pop it over.
    if (currentTokens.length === 1) {
      if (currentText.substr(-1) === ' ' || _force) {
        this._shiftToken(currentTokens[0]);
      }
    }

    // Restart notifications.
    this.endPropertyChanges();
  }.observes('currentText'),

  // The passed token will be removed from the beginning of currentText and pushed
  // onto tokenStack.
  _shiftToken: function(token) {
    // No token, no ride.
    if (!token) return;

    // No current text, no ride.
    var currentText = this.get('currentText');
    if (!currentText) return;

    // Make sure that the token's value is actually at the beginning of the currentText.
    // (It's apparently Paranoid Friday.)
    var tokenValue = token.tokenValue;
    if (tokenValue.toLowerCase() !== currentText.trim().substr(0, tokenValue.length).toLowerCase()) return;

    // Remove the text from the currentText and push the token onto the stack.
    var newText = currentText.trim().substr(tokenValue.length);
    this.setIfChanged('currentText', newText);
    
    var tokenStack = this.get('tokenStack');
    tokenStack.pushObject(token);
    this.notifyPropertyChange('tokenStack');
  },

  // Does what it says on the tin. Chops off the last letter of the token value.
  popTokenIntoCurrentText: function() {
    var tokenStack = this.get('tokenStack') || [],
        topToken = tokenStack.get('lastObject');
    // Gatekeep.
    if (!topToken) {
      this.setIfChanged('currentText', '');
      return;
    }
    // Pop.
    tokenStack.removeObject(topToken);
    this.notifyPropertyChange('tokenStack');
    // Send to currentText.
    var tokenValue = topToken.tokenValue;
    this.set('currentText', tokenValue.slice(0, tokenValue.length - 1));
  },

  clear: function() {
    this.set('currentText', null);
    this.set('tokenStack', []);
  },

  init: function() {
    this._q = SC.Query.create();
    return sc_super();
  }

});
