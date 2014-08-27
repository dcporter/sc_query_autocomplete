
/** @class
  This class verifies and tokenizes input SCQL query text, and offers a context-aware list of suggested
  autocompletions. Text goes in, a stack of query tokens and a list of next-up guesses comes out.

  This object exposes three main properties: `currentText`, which you should bind to an input source,
  `tokenStack`, which contains an array of strings extracted from currentText as you go, and `guesses`,
  which exposes an array of autocomplete strings.

  You can also observe `isValidQuery` for whether the current stack of tokens is a valid, complete query.

  @author Dave Porter dcporter@gmail.com
*/
QueryAutocomplete.ScqlGuesser = SC.Object.extend({

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
    Whether the current token stack represents a valid, complete query.

    @type {Boolean}
  */
  isValidQuery: function() {
    return !this._q.buildTokenTree(this.get('tokenStack'), this._q.queryLanguage).isError;
  }.property('tokenStack').cacheable(),

  // -------------------------
  // Guesses
  //

  /**
    The root record type of any property (attribute) guesses you wish to enable. Fed to the
    internal attributeGuesser controller.

    @type {SC.Record}
  */
  recordType: null,

  /**
    The attribute guesser class used to provide autocomplete guesses for the PROPERTY token
    type. You must also provide a recordType.

    @type {QueryAutocomplete.AttributeGuesser}
  */
  attributeGuesser: 'QueryAutocomplete.AttributeGuesser',

  /**
    The array of suggested autocompletions for the current text.

    @type {Array}
  */
  guesses: function() {
    var types = this.get('_nextTokenTypePredictions'),
      currentText = this.get('currentText'),
      guesser;

    // For now we're just gonna do PROPERTY (attribute) guesses.
    if (types.contains('PROPERTY')) {
      guesser = this.get('_attributeGuesser');
      guesser.set('currentText', currentText);
      return guesser.get('guesses');
    }
    else {
      return [];
    }
  }.property('_nextTokenTypePredictions', 'currentText').cacheable(),

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
        queryLanguage = this._q.queryLanguage,
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
    var tokenList = this.get('tokenStack'),
        grammar = this._q.queryLanguage,
        ret = [],
        token;

    // Special case: no grammar.
    if (!grammar) return ret;

    // Get the last token if available.
    var priorTokenMarker = tokenList ? tokenList[tokenList.length - 1] : null,
        priorTokenType = priorTokenMarker ? priorTokenMarker.tokenType : null,
        priorToken = priorTokenType ? grammar[priorTokenType] : null;

    // Special case: UNKNOWN.
    if (priorTokenType === 'UNKNOWN') return ret;

    // We could be in one of four places: the beginning, middle, end, or after.
    // For example:
    // property1    =    4   AND  property2    =   17
    // BEGINNING MIDDLE END AFTER BEGINNING MIDDLE END
    var BEGINNING = 0,
        MIDDLE = 1,
        END = 2,
        AFTER = 3,
        position, key;


    // First, figure out which position we're being asked to predict.

    // We're at the beginning if...
    // we're actually at the beginning.
    if (!priorToken) position = BEGINNING;
    // ...we're following an OPEN_PAREN.
    else if (priorTokenType === 'OPEN_PAREN') position = BEGINNING;
    // ...we're following an expression-level boolean like AND, OR, NOT, et cetera.
    else if (priorToken.evalType === 'BOOLEAN' && priorToken.rightType === 'BOOLEAN') position = BEGINNING;

    // We're in the middle if we're following a PROPERTY.
    else if (priorTokenType === 'PROPERTY') position = MIDDLE;

    // We're at the end if we're following...
    // an operator (evalType of BOOLEAN) with a PRIMITIVE rightType.
    else if (priorToken.evalType === 'BOOLEAN' && priorToken.rightType === 'PRIMITIVE') position = END;

    // We're after a full expression if...
    // ...we're after a non-PROPERTY primitive (including a full EXPRESSION; see above).
    else if (priorToken.evalType === 'PRIMITIVE' && priorTokenType !== 'PROPERTY') position = AFTER;
    // ...we're after an operator (evalType of BOOLEAN) with no rightType.
    else if (priorToken.evalType === 'BOOLEAN' && !priorToken.rightType) position = AFTER;
    // ... we're after a CLOSE_PAREN.
    else if (priorTokenType === 'CLOSE_PAREN') position = AFTER;
    // TODO: Should we just return the empty array?
    else throw new Error("QueryAutocomplete.ScqlGuesser#_predictNextToken ran into a situation that it didn't expect with token %@, and is unable to determine about which query position it is being asked.".fmt(priorTokenType));


    // With the position in hand, let's figure out what's acceptable there.

    if (position === BEGINNING) {
      // The first token can be an expression can be OPEN_PAREN, PROPERTY, or anything
      // with an evalType of BOOLEAN and no leftType (e.g. "NOT").
      ret.push('OPEN_PAREN');
      ret.push('PROPERTY');
      for (key in grammar) {
        token = grammar[key];
        if (token.evalType === 'BOOLEAN' && !token.leftType) ret.push(key);
      }
    }
    else if (position === MIDDLE) {
      // In the middle we expect an operator looking to operate on the left-side PRIMITIVE
      // which precedes it.
      for (key in grammar) {
        token = grammar[key];
        if (token.evalType === 'BOOLEAN' && token.leftType === 'PRIMITIVE') ret.push(key);
      }
    }
    else if (position === END) {
      // At the end, we want a primitive OTHER than a PROPERTY.
      for (key in grammar) {
        token = grammar[key];
        if (key !== 'PROPERTY' && token.evalType === 'PRIMITIVE') ret.push(key);
      }
    }
    else if (position === AFTER) {
      // In the AFTER position, we want an operator that expects a BOOLEAN on the left. Or a
      // CLOSE_PAREN, if appropriate.
      var parenCount = 0,
          i, tokenMarker, includeCloseParen;
      // Working backwards: Openers increment parenCount, closers decrement it. If parenCount ever goes over
      // zero, we've got an unclosed paren and should include CLOSE_PAREN.
      // For example, working backwards in "(( Hello )", parenCount goes to -1 before rising to 1, indicating
      // a needed close. Working backwards through "((()())" will result in a parenCount of -1, -2, -1, -2, -1,
      // 0, 1, indicating a needed close.
      // This won't currently handle syntactically invalid statements like ")()(".
      for (i = tokenList.length - 1; i >= 0; i--) {
        tokenMarker = tokenList[i];
        if (tokenMarker.tokenType === 'OPEN_PAREN') parenCount += 1;
        if (tokenMarker.tokenType === 'CLOSE_PAREN') parenCount -= 1;
        if (parenCount > 0) {
          includeCloseParen = true;
          break;
        }
      }
      if (includeCloseParen) ret.push('CLOSE_PAREN');
      for (key in grammar) {
        token = grammar[key];
        if (token.evalType === 'BOOLEAN' && token.leftType === 'BOOLEAN') ret.push(key);
      }
    }

    return ret;
  }.property('tokenStack').cacheable(),

  // -------------------------
  // Attribute guesses.
  //

  _attributeGuesser: function() {
    var attributeGuesser = this.get('attributeGuesser');
    if (!attributeGuesser) return null;
    if (SC.typeOf(attributeGuesser) === SC.T_STRING) attributeGuesser = SC.objectForPropertyPath(attributeGuesser);
    if (attributeGuesser.isClass) attributeGuesser = attributeGuesser.create();
    attributeGuesser.bind('recordType', this, 'recordType');
    return attributeGuesser;
  }.property('attributeGuesser').cacheable(),


});
