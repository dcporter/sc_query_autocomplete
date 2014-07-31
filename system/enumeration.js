// Work in progress.

SC.EnumerationMember = SC.Object.extend({
  
  isEnumerationMember: YES,

  value: null,

  underlyingValue: null,

  title: null,

  description: null,

  localize: NO
});

/*
  Implements the enumeration (a.k.a. enum, or categorical variable) data
  type. Provides a simple way to define a category with finite, discrete
  membership; for example, the size category could include small, medium
  and large.

  To create an enumeration, just pass in an array of member values. (Note
  that by convention, enumerations which are used to organize constants
  should be capitalized.)

  `
  MyApp.SIZE = SC.Enumeration.create({ members: ['small', 'medium', 'large'] });
  `

  For your convenience in this common case, you can also pass in a list of
  members:

  `
  MyApp.SIZE = SC.Enumeration.create(['small', 'medium', 'large']);
  `  

  By default, each member's underlying value will be the member itself. For
  example, the underlying values of the Size enumeration's small member will
  be "small". If you need to define the underlying values, e.g. to store in
  a database or to perform bitwise operations, you can do so at create time
  like so:

  `
  MyApp.SIZE = SC.Enumeration.create({
    members: ['small', 'medium', 'large'],
    small: 1,
    medium: 2,
    large: 3
  })
  `

  Members, being property keys, are stringified. Underlying values may be
  of any type, as long as they are unique within the enumeration.

  If you wish to define human-readable options

*/

SC.Enumeration = SC.Object.extend({

  isEnumeration: YES,

  members: [],

  concatenatedProperties: ['members']

});

SC.Enumeration.mixin({
  extend: function() {

  },

  create: function() {

  },

  reopen: function() {

  }

});
