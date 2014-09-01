
/** @class
  Turns a string into a set of record attribute guesses.

  Specify a root `recordType`, and bind `currentText` to a text source; the `guesses` property
  will update with the list of possible matched attributes. Supports toOne and toMany record
  relationships.
  
  For example, consider the following setup:

    MyApp.Person = SC.Record.extend({
      bestFriend: SC.Record.toOne("MyApp.Person"),
      dog: SC.Record.toOne("MyApp.Dog")
    }),
    MyApp.Dog = SC.Record.extend({
      master: SC.Record.toOne("MyApp.Person"),
      waterBowl: SC.Record.toOne("MyApp.Bowl")
    }),
    MyApp.Bowl = SC.Record.extend({
      type: SC.Record.attr(String)
    })

  If you create an AttributeGuesser with `recordType` of `MyApp.Person`, and enter the text
  "bestFriend.dog." into `currentText`, the `guesses` property will return ["master", "waterBowl"].
  If you then type a 'w', giving you "bestFriend.dog.w", the `guesses` property will update to
  ["waterBowl"].

  @author Dave Porter dcporter@gmail.com
*/
QAC.AttributeGuesser = SC.Object.extend({
  /**
    The root record type. You may specify a class, an instance, or a string.

    @type {SC.Record}
  */
  // (TODO: Add support for an array of starting record types? In which case the first thing you type is the record type.)
  recordType: null,

  /**
    The currently-typed text. If empty, the user will be given a full list of the root record type's attributes.
    Otherwiseit will give a list of attributes which match what has been typed, drilling down into related record
    types if appropriate.

    Should not include any spaces.

    @type {String}
  */
  currentText: '',

  /**
    The array of guesses based on the current text.

    @property
    @type {Array}
  */
  guesses: function() {
    // We are currently matching to the last attribute in the string. For example if currentText is
    // "bestFriend.dog.waterBo" we are searching the dog's record type for attributes which begin with
    // "waterBo".
    var attributeStack = this.get('_attributeStack'),
        index = attributeStack.length - 1,
        currentAttribute = (attributeStack[index] || '').toLowerCase(),
        recordTypeStack = this.get('_recordTypeStack'),
        currentRecordType = recordTypeStack[index];
    
    // FAST PATH: No currentRecordType.
    if (!currentRecordType) return [];

    var recordAttributes = currentRecordType.recordAttributes(),
        len = currentAttribute.length,
        key,
        ret = [];

    // EXPERIMENTAL: Add the full attribute stack to each suggestion. (Not quite working yet.)
    var fullAttributePrefix = attributeStack.length > 1 ? attributeStack.slice(0, attributeStack.length - 1).join('.') + '.' : '';

    // Prioritize matches that start with the current attribute.
    for (key in recordAttributes) {
      if (key.toLowerCase().substring(0, len) === currentAttribute) ret.push(fullAttributePrefix + key);
    }
    // Find any others that match internally (e.g. 'log' matching 'blogged').
    for (key in recordAttributes) {
      if (key.toLowerCase().indexOf(currentAttribute) >= 1) ret.push(fullAttributePrefix + key);
    }
    return ret;
  }.property('_recordTypeStack').cacheable(),

  /** @private
    currentText split by '.'; for example if currentText is "bestFriend.dog.waterB",
    this will return ["bestFriend", "dog", "waterB"].
  */
  _attributeStack: function() {
    return (this.get('currentText') || '').split('.');
  }.property('currentText').cacheable(),

  /** @private
    The attribute stack turned into a stack of record types; for example ["bestFriend", "dog", "waterB"] will return
    [MyApp.Person, MyApp.Dog]. Note that the last attribute is not turned into a record type, as we assume that it's
    partially typed until a '.' is typed.
  */
  _recordTypeStack: function() {
    var rootType = this.get('_recordType'),
        attributeStack = this.get('_attributeStack'),
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
  }.property('_attributeStack', '_recordType').cacheable(),

  /** @private The recordType property, converted from a string if needed. */
  _recordType: function() {
    var recordType = this.get('recordType');
    if (SC.typeOf(recordType) === SC.T_STRING) recordType = SC.objectForPropertyPath(recordType);
    if (!recordType) return null;
    if (!recordType.isClass) recordType = recordType.constructor;
    return recordType;
  }.property('recordType').cacheable()

});

