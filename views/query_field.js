
// A view which allows users to intuitively edit a string of space-delimited tokens.
// Bind currentText and tokenStack to a SC.ScqlGuesser instance.

QAC.QueryFieldView = SC.View.extend({

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
  guesses: null,
  guessesBinding: SC.Binding.oneWay('*_controller.guesses'),

  // The view is made up of a series of token pills, and a final editable section.
  childViewLayout: SC.View.HORIZONTAL_STACK,

  childViews: ['inputView', 'parenthesesView'],
  _qfmp_staticChildViewCount: 2,

  inputView: SC.TextFieldView.extend(SC.AutoResize, {
    layout: { height: 24, width: 10 },
    classNames: ['query-autocomplete-input'],
    valueBinding: '.parentView.currentText',
    spellCheckEnabled: NO,

    currentMenuItem: null,
    currentMenuItemBinding: SC.Binding.oneWay('.parentView._menuPane*currentMenuItem.value'),

    deleteBackward: function(evt) {
      var value = this.get('value') || '';
      if (value.length !== 0) return NO;
      this.parentView.get('_controller').popTokenIntoCurrentText();
      return YES;
    },
    insertNewline: function(evt) {
      var currentMenuItem = this.get('currentMenuItem');
      if (currentMenuItem) {
        this.setPath('parentView._controller.currentText', currentMenuItem);
      }
      this.parentView.get('_controller').doShiftToken();
      return YES;
    },
    insertTab: function(evt) {
      var currentMenuItem = this.get('currentMenuItem');
      if (currentMenuItem) {
        this.set('value', currentMenuItem);
      }
      return YES;
    },

    // Key events proxied directly to the menu pane.
    moveUp: function() { return this.getPath('parentView._menuPane').moveUp() },
    moveDown: function() { return this.getPath('parentView._menuPane').moveDown() },
    moveToBeginningOfDocument: function() { return this.getPath('parentView._menuPane').moveToBeginningOfDocument() },
    moveToEndOfDocument: function() { return this.getPath('parentView._menuPane').moveToEndOfDocument() },
    pageDown: function() { return this.getPath('parentView._menuPane').pageDown() },
    pageUp: function() { return this.getPath('parentView._menuPane').pageUp() },

    didBecomeFirstResponder: function() {
      this.parentView._scqfv_guessesDidChange();
    },
    willLoseFirstResponder: function() {
      // this.getPath('parentView._menuPane').remove();
    }
  }),

  parenthesesView: SC.LabelView.extend(SC.AutoResize, {
    layout: { height: 24, width: 10 },
    classNames: ['query-autocomplete-closing-parentheses'],
    count: 0,
    countBinding: SC.Binding.oneWay('.parentView*_controller.closingParenthesisCount'),
    marginBefore: 10, // see SC.View.HORIZONTAL_STACK
    value: function() {
      var count = this.get('count'),
        ret = '',
        i;
      for (i = 0; i < count; i++) { ret += ' )'; }
      return ret;
    }.property('count').cacheable()
  }),

  tokenExampleView: SC.LabelView.extend(SC.AutoResize, {
    layout: { height: 24, width: 10 },
    classNames: ['query-autocomplete-token'],
    displayProperties: ['value'],
    token: null,
    value: function() {
      return this.getPath('token.tokenValue');
    }.property('token').cacheable(),
    tokenType: function() {
      return this.getPath('token.tokenType');
    }.property('token').cacheable(),
    // classNameBindings: ['tokenTypeClass'],
    // tokenTypeClass: function() {
    //   var tokenType = this.get('tokenType');
    //   if (!tokenType) return '';
    //   else if (tokenType === '=') return 'query-autocomplete-token-operator';
    //   else return 'query-autocomplete-token-%@'.fmt(tokenType.toLowerCase());
    // }.property('tokenType').cacheable()
  }),

  menuPane: SC.MenuPane.extend({
    acceptsMenuPane: NO,
    isModal: NO,
    layout: { width: 200 },
    _qfmp_menuItemsDidChange: function() {
      this.invokeLast(this._qfmp_updateHeight);
    }.observes('items'),
    _qfmp_updateHeight: function() {
      this.adjust('height', this.get('menuHeight'));
    },
    modalPaneDidClick: function() {
      this.anchor.becomeFirstResponder();
      return YES;
    },
    exampleView: SC.MenuItemView.extend({
      mouseEntered: null,
      mouseExited: null,
      mouseUp: function() {
        var controller = this.getPath('parentMenu.anchor._controller');
        controller.set('currentText', this.get('value'));
        controller.doShiftToken();
        return YES;
      }
    })
  }),

  _menuPane: function() {
    var menuPane = this.get('menuPane');
    if (!menuPane) return null;
    if (SC.typeOf(menuPane) === SC.T_STRING) menuPane = SC.objectForPropertyPath(menuPane);
    if (menuPane.isClass) menuPane = menuPane.create();
    // Anchor should be set automatically, but hasn't since SC commit daa3c3cbb864c81a5c1511d4126644773cb5ecf3
    menuPane.set('anchor', this);
    menuPane.bind('items', this, 'guesses');
    return menuPane;
  }.property('menuPane').cacheable(),

  init: function() {
    sc_super();
    this._scqfv_guessesDidChange();
  },

  // Our job here is to reliably turn a list of tokens into a list of token pill views.
  _scqfv_tokenStackDidChange: function() {
    // Get the token stack, and all of the token views currently present.
    var tokenStack = this.get('tokenStack') || [],
        childViews = this.get('childViews') || [],
        inputView = this.inputView,
        tokenViews = childViews.slice(0, -this._qfmp_staticChildViewCount), // Slice off the non-static views.
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
        view.setIfChanged('isVisible', YES);
      }
      // ...or create.
      else {
        view = this.tokenExampleView.create({
          token: token,
        });
        this.insertBefore(view, inputView);
      }
    }
    // For each remaining view, hide it.
    for (i; i < viewCount; i++) {
      view = tokenViews[i];
      if (view) view.set('isVisible', NO);
    }
  }.observes('*tokenStack.[]'),

  _scqfv_guessesDidChange: function() {
    var menuPane = this.get('_menuPane'),
      isAttached = menuPane.get('isAttached'),
      guesses = this.get('guesses'),
      guessCount = guesses ? guesses.get('length') : 0;
    if (guessCount && !isAttached && this.get('hasFirstResponder')) {
      menuPane.popup(this);
    } else if (!guessCount && isAttached) {
      menuPane.remove();
    }
  }.observes('*guesses.[]')

});
