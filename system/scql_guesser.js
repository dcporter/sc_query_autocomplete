

QAC.QUERY_POSITION = {
  BEGINNING: 'beginning',
  MIDDLE: 'middle',
  END: 'end',
  AFTER: 'after',
  UNKNOWN: 'unknown'
};

/** @class
  This class verifies and tokenizes input SCQL query text, and offers a context-aware list of suggested
  autocompletions. Text goes in, a stack of query tokens and a list of next-up guesses comes out.

  This object exposes three main properties: `currentText`, which you should bind to an input source,
  `tokenStack`, which contains an array of strings extracted from currentText as you go, and `guesses`,
  which exposes an array of autocomplete strings.

  When you need to snag the query's full text out, get the `fullText` property.

  You can observe `isValidQuery` for whether the current stack of tokens is a valid, complete query.

  @author Dave Porter dcporter@gmail.com
*/
QAC.ScqlGuesser = SC.Object.extend({

  /**
    The current input text. Bind this (two-way) to your text input source.

    @type {String}
  */
  currentText: null,

  /**
    The stack of tokens that have been pulled out of currentText as it went.

    @type {Array}
  */
  tokenStack: [],

  /**
    The full text of the query as entered. Includes auto-closed parentheses.
  
    @property
    @readonly
    @type {String}
  */
  fullText: function() {
    var tokenStack = this.get('tokenStack'),
      currentText = this.get('currentText'),
      parenCount = this.get('closingParenthesisCount'),
      i, token,
      ret = '';
    for (i = 0; i < tokenStack.length; i++) {
      token = tokenStack[i];
      if (token.tokenType === 'STRING') ret += ' "%@"'.fmt(token.tokenValue);
      else ret += " " + token.tokenValue;
    }
    if (currentText) ret += " " + currentText;
    for (i = 0; i < parenCount; i++) { ret += ' )'; }
    return ret;
  }.property('tokenStack', 'currentText').cacheable(),

  /**
    The query language. Defaults to SC.Query's queryLanguage property.
  */
  queryLanguage: function() {
    return SC.clone(this._q.queryLanguage);
  }.property().cacheable(),

  /**
    Whether the current token stack represents a valid, complete query.

    @type {Boolean}
  */
  isValidQuery: function() {
    return !this._q.buildTokenTree(this.get('tokenStack'), this.get('queryLanguage')).isError;
  }.property('tokenStack').cacheable(),

  // -------------------------
  // Guessing
  //

  /**
    The query position of the currently-editing token (currentText). Can be:

    - QAC.QUERY_POSITION.BEGINNING: The first token in an expression should be a property, or certain types of
      operators (e.g. NOT).
    - QAC.QUERY_POSITION.MIDDLE: After a property comes an operator to operate on it.
    - QAC.QUERY_POSITION.END: After most operators comes a primitive value.
    - QAC.QUERY_POSITION.AFTER: After a complete expression, you can close any parentheses or add an expression-
      level operator (e.g. AND).
    - QAC.QUERY_POSITION.UNKNOWN

    @type {QAC.QUERY_POSITION}
  */
  currentQueryPosition: function() {
    var tokenStack = this.get('tokenStack'),
        grammar = this.get('queryLanguage'),
        position = QAC.QUERY_POSITION.UNKNOWN;

    // Get the last token if available.
    var priorTokenMarker = tokenStack ? tokenStack[tokenStack.length - 1] : null,
        priorTokenType = priorTokenMarker ? priorTokenMarker.tokenType : null,
        priorToken = priorTokenType ? grammar[priorTokenType] : null;

    // Special case: UNKNOWN.
    if (priorTokenType === 'UNKNOWN') return position;

    // We're at the beginning if...
    // we're actually at the beginning.
    if (!priorToken) position = QAC.QUERY_POSITION.BEGINNING;
    // ...we're following an OPEN_PAREN.
    else if (priorTokenType === 'OPEN_PAREN') position = QAC.QUERY_POSITION.BEGINNING;
    // ...we're following an expression-level boolean like AND, OR, NOT, et cetera.
    else if (priorToken.evalType === 'BOOLEAN' && priorToken.rightType === 'BOOLEAN') position = QAC.QUERY_POSITION.BEGINNING;

    // We're in the middle if we're following a PROPERTY.
    else if (priorTokenType === 'PROPERTY') position = QAC.QUERY_POSITION.MIDDLE;

    // We're at the end if we're following...
    // an operator (evalType of BOOLEAN) with a PRIMITIVE rightType.
    else if (priorToken.evalType === 'BOOLEAN' && priorToken.rightType === 'PRIMITIVE') position = QAC.QUERY_POSITION.END;

    // We're after a full expression if...
    // ...we're after a non-PROPERTY primitive (including a full EXPRESSION; see above).
    else if (priorToken.evalType === 'PRIMITIVE' && priorTokenType !== 'PROPERTY') position = QAC.QUERY_POSITION.AFTER;
    // ...we're after an operator (evalType of BOOLEAN) with no rightType.
    else if (priorToken.evalType === 'BOOLEAN' && !priorToken.rightType) position = QAC.QUERY_POSITION.AFTER;
    // ... we're after a CLOSE_PAREN.
    else if (priorTokenType === 'CLOSE_PAREN') position = QAC.QUERY_POSITION.AFTER;

    return position;
  }.property('tokenStack').cacheable(),

  /**
    The number of closing parentheses currently needed. For example, "((()" needs two, while "(()()" needs one.

    @property
    @readonly
    @type {Number}
  */
  closingParenthesisCount: function() {
    var tokenStack = this.get('tokenStack'),
      parenCount = 0,
      i, tokenMarker, includeCloseParen;
    for (i = 0; i < tokenStack.length; i++) {
      tokenMarker = tokenStack[i];
      if (tokenMarker.tokenType === 'OPEN_PAREN') parenCount += 1;
      if (tokenMarker.tokenType === 'CLOSE_PAREN') parenCount -= 1;
    }
    return parenCount;
  }.property('tokenStack').cacheable(),

  /**
    The root record type of any property (attribute) guesses you wish to enable. Fed to the
    internal attributeGuesser controller.

    @type {SC.Record}
  */
  recordType: null,

  /**
    The attribute guesser class used to provide autocomplete guesses for the PROPERTY token
    type. You must also provide a recordType.

    @type {QAC.AttributeGuesser|String}
  */
  attributeGuesser: 'QAC.AttributeGuesser',

  /**
    The array of suggested autocompletions for the current text.

    To modify this list in your own subclass, override this calculated property and manipulate
    the results of `sc_super()`.

    @property
    @readonly
    @type {Array}
  */
  guesses: function() {
    var types = this.get('_nextTokenTypePredictions'),
      excluded = this.get('excluded') || SC.EMPTY_ARRAY,
      queryLanguage = this.get('queryLanguage'),
      currentText = this.get('currentText') || '',
      ret = [],
      len = types.get('length'),
      i, type, token, guesser;

    currentText = currentText.toLowerCase();

    // Loop through the suggestion types, building the guesses list depending on what's in it.
    // NOTE: There's a disappointing amount of special-case handling here. A few extensions to
    // the SCQL token API may be able to reduce this without being too fiddly or special-case.
    for (i = 0; i < len; i++) {
      type = types[i];
      token = queryLanguage[type];
      // For PROPERTY, we turn it over to the attributeGuesser.
      if (type === 'PROPERTY') {
        guesser = this.get('_attributeGuesser');
        guesser.set('currentText', currentText);
        ret = ret.concat(guesser.get('guesses'));
      }
      // If the token is a "reservedWord" (i.e. its type is its value text, e.g. "="), it goes right in.
      else if (
        token.reservedWord &&
        currentText === type.substr(0, currentText.length).toLowerCase() &&
        !excluded.contains(type)
      ) {
        ret.push(type);
      }
      // Add open and close parentheses, if appropriate.
      else if (type === 'OPEN_PAREN') {
        if (currentText === '' || currentText === '(') ret.push('(');
      }
      else if (type === 'CLOSE_PAREN') {
        if (currentText === '' || currentText === ')') ret.push(')');
      }
    }

    return ret;
  }.property('_nextTokenTypePredictions', 'currentText', 'recordType').cacheable(),

  /**
    The list of tokens that will not show up as suggestions. Note that this property is not concatenated with
    subclass values, allowing you to include the default-excluded terms; however, this means that if you
    override it you must include them yourself if you wish to do so.

    @type {Array}
  */
  excluded: ['%@', 'YES', 'NO'],


  // -------------------------
  // Methods
  //

  /**
    This method shifts the current text onto the token stack. Used when the user hits enter or tab.
  */
  doShiftToken: function() {
    this._processCurrentText(YES);
  },

  /**
    The token at the top of the stack will be popped off, and its text, less one letter, will be made the
    currentText. Used when the user has deleted the currentText back to the previous token.
  */
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
    if (topToken.tokenType === "STRING") tokenValue = '"' + tokenValue + '"';
    this.set('currentText', tokenValue.slice(0, tokenValue.length - 1));
  },

  /** Resets the guesser with no text and no token stack. */
  clear: function() {
    this.set('currentText', null);
    this.set('tokenStack', []);
  },

  // -------------------------
  // Internal Support
  //

  /** @private */
  init: function() {
    this._q = SC.Query.create();
    return sc_super();
  },
  /** @private */
  destroy: function() {
    this._q.destroy();
    this.attributeGuesser.destroy();
    return sc_super();
  },

  /** @private The currentText needs processing whenver it changes. */
  _processCurrentText: function(_force) {
    // Pause notifications for the duration.
    this.beginPropertyChanges();

    var currentText = this.get('currentText'),
        queryLanguage = this.get('queryLanguage'),
        currentTokens = this._q.tokenizeString(currentText, queryLanguage);

    // If our text tokenizes to more than one token, move the leading ones onto the stack.
    var token;
    while (currentTokens.length > 1) {
      this._shiftToken(currentTokens.shift());
    }

    // If we have a token left (i.e. if we didn't start with zero)...
    if (currentTokens.length === 1) {
      token = currentTokens[0];
      // If our text ends in a space, or we're forcing, shift it over.
      if (currentText.substr(-1) === ' ' || _force === YES) {
        this._shiftToken(token);
      }
      // If that last token is a singleCharacter, shift it over.
      else {
        // Get full token.
        var tokenDef = queryLanguage[token.tokenType];
        if (tokenDef && tokenDef.singleCharacter) { this._shiftToken(token); }
      }
    }

    // Restart notifications.
    this.endPropertyChanges();
  }.observes('currentText'),

  /** @private
    The passed token will be removed from the beginning of currentText and pushed
    onto tokenStack.
  */
  _shiftToken: function(token) {
    // No token, no ride.
    if (!token) {
      return;
    }

    // No current text, no ride.
    var currentText = this.get('currentText') || '';

    // Make sure that the token's value is actually at the beginning of the currentText.
    // (It's apparently Paranoid Friday.)
    var tokenValue = token.tokenValue,
      isString = token.tokenType === "STRING";
    // Standard stuff if not a string.
    if (!isString) {
      if (tokenValue.toLowerCase() !== currentText.trim().substr(0, tokenValue.length).toLowerCase()) {
        return;
      }
    }
    // If it's a string: the tokenization step removes quotes, so we have to wrap the value in quotes to test it.
    else {
      // THIS CODE IS BEAUTIFUL. SHUT UP
      if (
        '"%@"'.fmt(tokenValue.toLowerCase()) !== currentText.trim().substr(0, tokenValue.length + 2).toLowerCase() &&
        "'%@'".fmt(tokenValue.toLowerCase()) !== currentText.trim().substr(0, tokenValue.length + 2).toLowerCase()
      ) {
        return;
      }
    }

    // Remove the text from the currentText and push the token onto the stack.
    var tokenLength = isString ? tokenValue.length + 2 : tokenValue.length,
      newText = currentText.trim().substr(tokenLength);
    this.setIfChanged('currentText', newText);
    
    var tokenStack = this.get('tokenStack');
    tokenStack.pushObject(token);
    this.notifyPropertyChange('tokenStack');
  },

  /* @private Offers a list of next token types. */
  _nextTokenTypePredictions: function() {
    var position = this.get('currentQueryPosition'),
      grammar = this.get('queryLanguage'),
      ret = [],
      key, token;

    // With the position in hand, let's figure out what's acceptable there.

    if (position === QAC.QUERY_POSITION.BEGINNING) {
      // The first token can be an expression can be OPEN_PAREN, PROPERTY, or anything
      // with an evalType of BOOLEAN and no leftType (e.g. "NOT").
      ret.push('OPEN_PAREN');
      ret.push('PROPERTY');
      for (key in grammar) {
        token = grammar[key];
        if (token.evalType === 'BOOLEAN' && !token.leftType) ret.push(key);
      }
    }
    else if (position === QAC.QUERY_POSITION.MIDDLE) {
      // In the middle we expect an operator looking to operate on the left-side PRIMITIVE
      // which precedes it.
      for (key in grammar) {
        token = grammar[key];
        if (token.evalType === 'BOOLEAN' && token.leftType === 'PRIMITIVE') ret.push(key);
      }
    }
    else if (position === QAC.QUERY_POSITION.END) {
      // At the end, we want a primitive OTHER than a PROPERTY.
      for (key in grammar) {
        token = grammar[key];
        if (key !== 'PROPERTY' && token.evalType === 'PRIMITIVE') ret.push(key);
      }
    }
    else if (position === QAC.QUERY_POSITION.AFTER) {
    // In the AFTER position, we want an operator that expects a BOOLEAN on the left. Or a
    // CLOSE_PAREN, if appropriate.
      if (this.get('closingParenthesisCount')) ret.push('CLOSE_PAREN');
      for (key in grammar) {
        token = grammar[key];
        if (token.evalType === 'BOOLEAN' && token.leftType === 'BOOLEAN') ret.push(key);
      }
    }

    return ret;
  }.property('currentQueryPosition').cacheable(),

  // -------------------------
  // Attribute guesses.
  //

  _attributeGuesser: function() {
    var attributeGuesser = this.get('attributeGuesser');
    if (SC.typeOf(attributeGuesser) === SC.T_STRING) attributeGuesser = SC.objectForPropertyPath(attributeGuesser);
    // FAST PATH: Nothin.
    if (!attributeGuesser) return null;
    if (attributeGuesser.isClass) attributeGuesser = attributeGuesser.create({ recordType: this.get('recordType') });
    attributeGuesser.bind('recordType', this, 'recordType');
    return attributeGuesser;
  }.property('attributeGuesser').cacheable(),


});
