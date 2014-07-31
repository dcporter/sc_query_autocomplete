
// Turns a string into a set of record attribute guesses.
//
// Specify a recordType as the root, and bind currentText to a text input source; the object
// will output a list of possible attribute names on `guesses`. Supports following toOne and
// toMany record relationships.

QueryAutocomplete.AttributeGuesser = SC.Object.extend({
  // You must specify a recordType for the query.
  recordType: null,

  currentText: '',

  attributeStack: function() {
    return (this.get('currentText') || '').split('.');
  }.property('currentText').cacheable(),

  recordTypeStack: function() {
    var rootType = this.get('_recordType'),
        attributeStack = this.get('attributeStack'),
        ret = [rootType],
        i, len = attributeStack.length,
        thisType, thisAttribute, theseAttributes, nextType;
    // We're only going to search to the n - 1th attribute in the stack, because the user may not
    // be done typing the final attribute yet and we don't want any false positives. So if I type
    // "foo.bar" then only "foo" will be looked at until I hit dot to get "foo.bar.".
    for (i = 0; i < len - 1; i++) {
      thisType = ret[i];
      if (!thisType) break;
      thisAttribute = attributeStack[i];
      theseAttributes = thisType.recordAttributes();
      if (!theseAttributes[thisAttribute]) break;
      nextType = theseAttributes[thisAttribute].get('typeClass');
      if (!nextType || !SC.kindOf(nextType, SC.Record)) break;
      ret.push(nextType);
    }
    return ret;
  }.property('attributeStack').cacheable(),

  guesses: function() {
    var attributeStack = this.get('attributeStack'),
        index = attributeStack.length - 1,
        currentAttribute = (attributeStack[index] || '').toLowerCase(),
        recordTypeStack = this.get('recordTypeStack'),
        currentRecordType = recordTypeStack[index];
    if (!currentRecordType) return [];

    var recordAttributes = currentRecordType.recordAttributes(),
        len = currentAttribute.length,
        ret = [];
    
    for (key in recordAttributes) {
      if (key.toLowerCase().substring(0, len) === currentAttribute) ret.push(key);
    }
    for (key in recordAttributes) {
      if (key.toLowerCase().indexOf(currentAttribute) !== -1 && ret.indexOf(key) === -1) ret.push(key);
    }
    return ret;
  }.property('recordTypeStack').cacheable(),

  _recordType: function() {
    var recordType = this.get('recordType');
    if (SC.typeOf(recordType) === SC.T_STRING) recordType = SC.objectForPropertyPath(recordType);
    return recordType
  }.property('recordType').cacheable()

});

