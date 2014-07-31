// Reopen SC.Record to add class-level attribute introspection.

if (!SC.Record.recordAttributes) {
  SC.Record.reopen({
    /*
      Returns a hash of the record's class's record attributes.

      @returns {Hash} record attributes
    */
    recordAttributes: function() {
      return this.constructor.recordAttributes();
    }.property(),
    recordAttributeNames: function() {
      return this.constructor.recordAttributeNames();
    }.property(),

  });

  SC.Record.mixin({
    /*
      Returns a list of the model class's record attributes.

      @returns {Hash} record attributes list
    */
    recordAttributes: function() {
      if (!this._screc_recordAttributes) this._screc_generateRecordAttributes();
      return SC.clone(this._screc_recordAttributes);
    },

    recordAttributeNames: function() {
      if (!this._screc_recordAttributeNames) this._screc_generateRecordAttributes();
      return this._screc_recordAttributeNames.slice();
    },

    /* @private - Cache of record attributes. */
    _screc_recordAttributes: null,

    _screc_recordAttributeNames: null,

    /* @private - expose attributes at the class level for introspection. */
    _screc_generateRecordAttributes: function() {
      var recordAttributes = {},
        recordAttributeNames = [];

      var key, value;
      for (property in this.prototype) {
        value = this.prototype[property];
        // If the property is an attribute, add it to recordAttributes.
        if (value && value.isRecordAttribute) {
          recordAttributeNames.push(property);
          recordAttributes[property] = value;
        }
      }
      this._screc_recordAttributeNames = recordAttributeNames;
      this._screc_recordAttributes = recordAttributes;
    },
    /* @private - Invalidates record attribute cache here and on all subclasses. */
    _screc_invalidateRecordAttributes: function() {
      // Invalidate here.
      this._screc_recordAttributes = null;
      this._screc_recordAttributeNames = null;
      // Invalidate on all subclasses.
      this.subclasses.forEach(function(subclass) {
        subclass._screc_invalidateRecordAttributes();
      });
    },

    /* @private - Extended to clear record attribute cache and notify SC.Query if necessary. */
    extend: function() {
      var ret = SC.Object.extend.apply(this, Array.prototype.slice.apply(arguments));
      ret._screc_invalidateRecordAttributes();
      if(SC.Query) SC.Query._scq_didDefineRecordType(ret);
      return ret;
    },
    /* @private - Extended to clear record attribute cache. */
    reopen: function() {
      var ret = SC.Object.reopen.apply(this, Array.prototype.slice.apply(arguments));
      this._screc_invalidateRecordAttributes();
      return ret;
    }
  });
}
