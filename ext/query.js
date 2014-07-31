// Reopen SC.Query to add token prediction.

if (!SC.Query.prototype.predictNextToken) {
  SC.Query.reopen({
    predictNextToken: function(tokenList, grammar) {
      var ret = [],
          token;

      // Special case: no grammar.
      if (!grammar) return ret;

      // Get the last token if available.
      var priorTokenMarker = tokenList ? tokenList[tokenList.length - 1] : null,
          priorTokenType = priorTokenMarker ? priorTokenMarker.tokenType : null,
          priorToken = priorTokenType ? grammar[priorTokenType] : null;

      // Special case: UNKNOWN.
      if (priorTokenType === 'UNKNOWN') return ret;

      // Special case: If the prior token is a CLOSE_PAREN, then we treat the entire
      // parenthetical expression as a special fake type.
      if (priorTokenType === 'CLOSE_PAREN') {
        priorTokenType === 'EXPRESSION';
      }

      // We could be in one of four places: the beginning, middle, end, or after.
      // For example:
      // property1    =    4   AND  property2    =   17
      // BEGINNING MIDDLE END AFTER BEGINNING MIDDLE END
      //
      // ("After" is somewhat of a misnomer.)
      var BEGINNING = 0,
          MIDDLE = 1,
          END = 2,
          AFTER = 3,
          position;

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
      else throw new Error("SC.Query#predictNextToken ran into a situation that it didn't expect with token %@, and is unable to determine what query position it is being asked".fmt(priorTokenType));

      // With the position in hand, let's figure out what's acceptable there.

      // The first token can be an expression can be OPEN_PAREN, PROPERTY, or anything
      // with an evalType of BOOLEAN and no leftType.
      if (position === BEGINNING) {
        ret.push('OPEN_PAREN');
        ret.push('PROPERTY');
        for (key in grammar) {
          token = grammar[key];
          if (token.evalType === 'BOOLEAN' && !token.leftType) ret.push(key);
        }
      }
      // In the middle we expect an operator looking to operate on the left-side PRIMITIVE
      // which precedes it.
      else if (position === MIDDLE) {
        for (key in grammar) {
          token = grammar[key];
          if (token.evalType === 'BOOLEAN' && token.leftType === 'PRIMITIVE') ret.push(key);
        }
      }
      // At the end, we want a primitive OTHER than a PROPERTY.
      else if (position === END) {
        for (key in grammar) {
          token = grammar[key];
          if (key !== 'PROPERTY' && token.evalType === 'PRIMITIVE') ret.push(key);
        }
      }
      // In the AFTER position, we want an operator that expects a BOOLEAN on the left. Or a
      // CLOSE_PAREN, if appropriate.
      else if (position === AFTER) {
        // Openers increment parenCount, closers decrement it. If parenCount ever goes over
        // zero, we've got an unclosed paren and should include 
        var parenCount = 0,
            i, tokenMarker, includeCloseParen;
        for (i = tokenList.length - 1; i >= 0; i--) {
          tokenMarker = tokenList[i];
          if (tokenMarker.tokenType === 'OPEN_PAREN') parenCount += 1;
          if (tokenMarker.tokenType === '') parenCount -= 1;
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
    }    
  })
}
