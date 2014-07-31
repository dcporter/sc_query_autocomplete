
// A view which allows users to intuitively edit a string of space-delimited tokens.
// Bind currentText and tokenStack to a SC.ScqlGuesser instance.

QueryAutocomplete.QueryFieldView = SC.View.extend({

  // Eventually, this should be a special class which handles tokenizing, attribute-guessing and query suggesting.
  controller: null,

  _controller: function() {
    var controller = this.get('controller');
    if (!controller) return null;
    if (SC.typeOf(controller) === SC.T_STRING) controller = SC.objectForPropertyPath(controller);
    if (controller.isClass) controller = controller.create();
    return controller;
  }.property('controller').cacheable(),

  // We need three things from the controller: the list of tokens, the current text, and the list
  // of guesses.

  currentText: null,
  currentTextBinding: '*_controller.currentText',
  tokenStack: null,
  tokenStackBinding: SC.Binding.oneWay('*_controller.tokenStack'),
  guessList: null,
  guessListBinding: SC.Binding.oneWay('*_controller.guessList'),

  // The view is made up of a series of token pills, and a final editable section.
  childViewLayout: SC.View.HORIZONTAL_STACK,

  childViews: ['inputView'],

  inputView: SC.TextFieldView.extend(SC.AutoResize, {
    layout: { width: 10 },
    valueBinding: '.parentView.currentText',
    deleteBackward: function(evt) {
      var value = this.get('value') || '';
      if (value.length !== 0) return NO;
      this.parentView.get('_controller').popTokenIntoCurrentText();
      return YES;
    },
    insertNewline: function(evt) {
      this.parentView.get('_controller').doShiftToken();
      return NO;
    },
    insertTab: function(evt) {
      this.parentView.get('_controller').doShiftToken();
      return NO;
    }
  }),

  tokenExampleView: SC.LabelView.extend(SC.AutoResize, {
    layout: { width: 10 },
    classNames: ['query-token-view'],
    displayProperties: ['value'],
    token: null,
    value: null
  }),

  // Our job here is to reliably turn a list of tokens into a list of token pill views.
  _scqfv_tokenStackDidChange: function() {
    // Get the token stack, and all of the token views currently present.
    var tokenStack = this.get('tokenStack') || [],
        childViews = this.get('childViews') || [],
        inputView = childViews.get('lastObject'),
        tokenViews = childViews.slice(0, -1), // All but the last view, which is our input view.
        tokenCount = tokenStack.length,
        viewCount = tokenViews.length,
        i, token, view;
    // For each token, update or create a view.
    for (i = 0; i < tokenCount; i++) {
      token = tokenStack[i];
      view = tokenViews[i];
      // Update...
      if (view) {
        view.setIfChanged('token', token);
        view.setIfChanged('value', token.tokenValue);
        view.setIfChanged('isVisible', YES);
      }
      // ...or create.
      else {
        view = this.tokenExampleView.create({
          token: token,
          value: token.tokenValue
        });
        this.insertBefore(view, inputView);
      }
    }
    // For each remaining view, hide it.
    for (i; i < viewCount; i++) {
      view = tokenViews[i];
      if (view) view.set('isVisible', NO);
    }
  }.observes('*tokenStack.[]')

});
