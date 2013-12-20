// Define a module with a suite of simple DOM helpers.
define('dom', function (require, exports) {
  var a = require('accumulators');
  var handleEnd = a.handleEnd;

  // Internal higher-order function that expidites creating "setters" that
  // can operate on multiple items at once. Pass a `setOn` function that looks
  // like:
  //
  //     function setThingOn(value, target) { ... return value; }
  //
  // Where `target` is the thing being mutated. Make sure to return `value`!
  function multisetter(setOn) {
    var nextSetOn = handleEnd(setOn);

    function multiset(things, value) {
      accumulate(things, nextSetOn, value);
      return things;
    }

    return multiset;
  }

  // Test for the presence of an HTML class on a DOM element.
  function hasClass(element, elementClass) {
    return RegExp(elementClass, 'g').test(element.className);
  }
  exports.hasClass = hasClass;

  // Set `innerHtml` on multiple elements.
  var setHtml = multisetter(function setHtmlOn(html, element) {
    element.innerHTML = html;
    return html;
  });
  exports.setHtml = setHtml;

  var setText = multisetter(function setTextOn(text, element) {
    element.textContent = text;
    return text;
  });
  exports.setText = setText;

  // Set/remove a single attribute on a single element.
  function setSingleAttr(element, key, value) {
    // If value is nullish, remove the attribute.
    if (value == null) element.removeAttribute(key);
    // Otherwise, set the attribute.
    else element.setAttribute(key, value);
    return element;
  }

  var setAttr = multisetter(function setAttrOn(attr, element) {
    for (var key in attr) setSingleAttr(element, key, attr[key]);
    return attr;
  });
  exports.setAttr = setAttr;

  var addClass = multisetter(function addClassTo(elementClass, element) {
    var prevElementClass = element.className;
    if (prevElementClass.indexOf(elementClass) === -1)
      element.className = prevElementClass + ' ' + elementClass;
    return elementClass;
  });
  exports.addClass = setAddClass;

  var removeClass = multisetter(function removeClassFrom(elementClass, element) {
    var pattern = RegExp(elementClass, 'g');
    element.className = element.className.replace(pattern, '');
    return elementClass;
  });
  exports.removeClass = removeClass;

  var toggleClass = multisetter(function toggleClassOn(elementClass, element) {
    // @TODO make hasClass support multiple elements, or just test first element
    // or test all elements, or deal with elements one-by-one.
    return hasClass(element, elementClass) ?
      removeClass(element, elementClass) :
      addClass(element, elementClass);
  });
  exports.toggleClass = toggleClass;

  // Test if a given event has touches. Returns bolean.
  function hasTouches(event) {
    return event && event.touches && event.touches.length > 0;
  }
  exports.hasTouches = hasTouches;

  // Creates predicate function to match `id`.
  function withId(id) {
    function hasId(thing) {
      return thing && thing.id === id;
    }
    return hasId;
  }
  exports.withId = withId;

  // Create predicate function that matches id of target of event.
  // Returns a function. Useful for filtering events based on target.
  function withTargetId(id) {
    function isTargetId(event) {
      return event.target.id === id;
    }
    return isTargetId;
  }
  exports.withTargetId = withTargetId;

  function withClass(className) {
    function isClassOnElement(element) {
      return hasClass(element, className);
    }
    return isClassOnElement;
  }
  exports.withClass = withClass;

  function withTargetClass(className) {
    function isClassOnTarget(event) {
      return hasClass(event.target, className);
    }
    return isClassOnTarget;
  }
  exports.withTargetClass = withTargetClass;

  return exports;
});

// Define module that offers a simple singly-linked list implementation.
define('linked-list', function (require, exports) {
  // Reducible prototype for linked list node.
  var __node__ = {
    reduce: function reduceNodes(reducer, initial) {
      var node = this;
      var accumulated = initial;
      do {
        accumulated = reducer(accumulated, node);
        node = next(node);
      }
      while(node !== null);
      return accumulated;
    }
  };

  // Create a linked list node.
  function node(value, nextNode) {
    var n = Object.create(__node__);
    n.value = value;
    n.next = nextNode || null;
    return n;
  }
  exports.node = node;

  function next(node) {
    return node && node.next ? node.next : null;
  }
  exports.next = next;

  function value(node) {
    return node && node.value ? node.value : null;
  }
  exports.value = value;

  // Given 2 items, return second.
  function chooseCurr(prev, curr) {
    return curr;
  }

  // Find head of reducible data structure.
  function head(reducible) {
    return reducible && reducible.reduce ? reducible.reduce(chooseCurr) : null;
  }
  exports.head = head;

  // Find first match for `predicate` in reducible data structure.
  // Returns null if no match is found.
  function find(reducible, predicate) {
    return reducible.reduce(function reduceFind(found, node) {
      // Match values, not nodes. This allows for general-purpose
      // predicate functions.
      if (found) return found;
      if (predicate(value(node))) return node;
      return null;
    }, null);
  }
  exports.find = find;

  return exports;
});

var a = require('accumulators');
var on = a.on;
var map = a.map;
var hub = a.hub;
var filter = a.filter;
var reject = a.reject;
var classname = a.classname;
var addClass = a.addClass;
var removeClass = a.removeClass;
// @TODO it may be that these DOM writers are not that useful. Perhaps a simple
// collection of DOM functions on spreads will be valuable instead.
var setAddClass = a.setAddClass;
var setRemoveClass = a.setRemoveClass;
var $ = a.$;
var merge = a.merge;
var reductions = a.reductions;
var accumulatable = a.accumulatable;
var accumulate = a.accumulate;
var end = a.end;
var write = a.write;
var id = a.id;
var slice = a.slice;

var dom = require('dom');
var hasClass = dom.hasClass;
var hasTouches = dom.hasTouches;
var withTargetId = dom.withTargetId;
var withId = dom.withId;
var withClass = dom.withClass;

var list = require('linked-list');
var node = list.node;
var find = list.find;
var head = list.head;
var value = list.value;

function print(spread) {
  accumulate(spread, function nextPrint(_, item) {
    console.log(item);
  });
}

function isNullish(thing) {
  return thing == null;
}

// Invoke a method on each object in a spread, presumably mutating that object
// causing side-effects.
//
// Returns a spread of objects after invocation.
function invoke(spread, method, args) {
  return map(spread, function mapInvoke(object) {
    object[method].apply(object, args);
    return object;
  });
}

function pluck(spread, key) {
  return map(spread, function toPluckedKey(object) {
    return object[key];
  });
}

function isObject(thing) {
  return thing && typeof thing === 'object';
}

// Filter items in stream by comparing adjacent items using using function
// `assert` to compare.
//
// Returns a new spread of items that pass `assert`.
function asserts(spread, assert) {
  return accumulatable(function accumulateFilterAdjacent(next, initial) {
    var accumulated = initial;
    accumulate(spread, function nextAssert(left, right) {
      if (right === end) next(accumulated, end);
      else if (assert(left, right)) accumulated = next(accumulated, right);

      // Right becomes new left for nextAssert.
      return right;
    }, null);
  });
}

// Are 2 things not equal?
function isDifferent(thing0, thing1) {
  return thing0 !== thing1;
}

// Drop adjacent repeats from spread.
function dropRepeats(spread) {
  return asserts(spread, isDifferent);
}

// Enumerate over an object's own keys/values, accumulating a value.
// `initial` defines the initial value for the accumulation. Reference is an
// optional additional argument that make a common case -- comparing 2
// objects -- easy and more efficient.
function enumerate(object, next, initial, reference) {
  var accumulated = initial;
  for (var key in object)
    // Test for own keys with `hasOwnProperty` instead of `Object.keys` to
    // avoid garbage creation.
    //
    // @TODO need to test this "optimization".
    if(object.hasOwnProperty(key)) accumulated = next(accumulated, key, object[key], object, reference);
  return accumulated;
}

// Set `value` on `object` at `key`. Returns `object`.
function set_(object, key, value) {
  object[key] = value;
  return object;
}

// Shallow-copy `object` by copying all non-empty own properties to `into`.
function copy_(into, object) {
  return enumerate(object, set_, into);
}

// Helper function for `contains`.
function enumIsMissing(isMissing, key, value, subset, set) {
  return (isMissing ? true : set[key] !== subset[key]);
}

// Checks if `set` contains all the values present in `subset`.
// Returns boolean.
function contains(set, subset) {
  // Non-objects can't "contain" anything except themselves.
  if (!isObject(set) || !isObject(subset)) return false;
  // Go through all properties of subset, checking if the keys/values match up
  // in set.
  return !enumerate(subset, enumIsMissing, false, set);
}

// Patch state with diff if it would change state.
// Returns a new patched state object or original object.
function patch(state, diff) {
  // If either are not objects, patching is impossible. Return diff as
  // new state.
  if (!isObject(state) || !isObject(diff)) return diff;

  // If diff is already contained in state (all properties in diff are same
  // in state), return state. No need to change.
  if (contains(state, diff)) return state;

  // Otherwise, create new state object.
  return copy_(copy_({}, state), diff);
}

// Patch a spread of diffs on to an initial state.
function patches(diffs, state) {
  return dropRepeats(reductions(diffs, patch, state || {}));
}

// Derive diff from current state, previous state and target.
//
// State takes a spread of diffs, an initial state, an optional derive function
// and an optional target which contains state.
//
// Returns a new spread of patched/derived states.
function states(spread, derive, target) {
  derive = derive || id;
  return dropRepeats(reductions(spread, function deriveStates(prev, state) {
    // `prev` is previously calculated/patched state.
    // Patch state with diff calculated from prev, state, target.
    //
    // We need to check that patched state changes something
    // in prev. The derived state will almost always update state. But that
    // doesn't mean it actually changes from prev.
    var derived = patch(state, derive(prev, state, target));
    return contains(prev, derived) ? prev : derived;
  }, null));
}

// Write to a target as a side effect of accumulating `spread`.
//
// @TODO I'm currently doing it this way so as not to miss any updates.
// However, if each write function gets it's own "forked" state stream instead
// of using hub(), this may not be a problem. Need to test.
//
// Returns a new accumulatable spread that contains items from original. Spread
// will begin writes as soon as it is accumulated.
function widget(spread, target, test, update, enter, exit) {
  return accumulatable(function accumulateWidget(next, initial) {
    update = update || id;
    enter = enter || id;
    exit = exit || id;
    target = enter(target);

    var accumulated = initial;

    accumulate(spread, function nextWidgetWrite(prev, curr) {
      accumulated = next(accumulated, curr);

      if (curr === end) return exit(target);

      // test function gets previous state, current state and target, returns
      // true/false. Updates that don't pass the test will be skipped for write.
      if (test(prev, curr, target)) update(target, curr);

      return curr;
    }, null);
  });
}

// Get value at `key` on `thing`, or null if `thing` is not an object or no
// value at key.
function get(thing, key) {
  return thing && !isNullish(thing[key]) ? thing[key] : null;
}

// Check that both x and y are not null. Convenience for predicates below.
function hasBoth(x, y) {
  return !isNullish(x) && !isNullish(y);
}

function isUpdated(prev, curr, key) {
  // Note that if key is null in both cases, this will also return false.
  // So if you're checking against a key that doesn't exist, you'll get
  // continual false.
  return get(prev, key) !== get(curr, key);
}

// Creates an assertion function to test whether a given property at `key`
// has been updated.
function updated(key) {
  function maybeUpdated(prev, curr) {
    return isUpdated(prev, curr, key);
  }
  return maybeUpdated;
}

function hasTransitioned(prev, curr, key, from, to) {
  // Will return false for initial state cases where `prev` is null.
  return hasBoth(curr, prev) && (get(prev, key) === from) && (get(curr, key) === to);
}

// Creates an assertion function that checks if a given
// property at `key` is equal to `from` on `prev` and equal to `to` in
// `curr`.
//
// This gives you state machine-like functionality when used with
// `asserts()`. For example, to get a spread of all states where your
// became `awesome`:
//
//     var x = asserts(updates, transitioned('awesome', false, true));
function transitioned(key, from, to) {
  function maybeTransitioned(prev, curr) {
    return hasTransitioned(prev, curr, key, from, to);
  }
  return maybeTransitioned;
}

function isChanged(prev, curr, key, to) {
  return (get(prev, key) !== to) && (get(curr, key) === to);
}

// Creates an assertion function that checks if a given
// property at `key` is equal to `to` on `curr` but not on `prev`
function changed(key, to) {
  function maybeChanged(prev, curr) {
    return isChanged(prev, curr, key, to);
  }
  return maybeChanged;
}

function isCurrently(prev, curr, key, value) {
  // Will return false for initial state cases where `prev` is null.
  return get(curr, key) === value;
}

// Creates an assertion function that checks if a given
// property at `key` is equal to `value` in `curr`.
function currently(key, value) {
  function maybeCurrently(prev, curr) {
    return isCurrently(prev, curr, key, value);
  }
  return maybeCurrently;
}

function wasPreviously(prev, curr, key, value) {
  // Will return false for initial state cases where `prev` is null.
  return hasBoth(curr, prev) && get(prev, key) === value;
}

// Creates an assertion function that checks if a given
// property at `key` is equal to `value` in `prev`.
function previously(key, value) {
  function maybePreviously(prev, curr) {
    return wasPreviously(prev, curr, key, value);
  }
  return maybePreviously;
}

// Combine `n` assertion functions into a single assertion function
// that tests all given assertions using an `and` relationship.
//
// Pass each assertion function as an argument to `all`. Returns an
// assertion function.
//
// Protip: returned assertion function is composable with `all` or `any`
// allowing for complex nested boolean logic.
function all(/* judge, ... */) {
  var judges = slice(arguments);

  function judgeAll(target, curr, prev) {
    var isPassing = true;

    // Run every assertion function in sequence. If any are not passed,
    // isPassing becomes false. Every assertion must return true.
    for (var i = 0; i < judges.length; i += 1) {
      isPassing = isPassing ? judges[i](target, curr, prev) : false;
    }

    return isPassing;
  }

  return judgeAll;
}

// Combine `n` assertion functions into a single assertion function
// that tests all given assertions using an `or` relationship.
//
// Pass each assertion function as an argument to `any`. Returns an
// assertion function.
//
// Protip: returned assertion function is composable with `all` or `any`
// allowing for complex nested boolean logic.
function any(/* judge, ... */) {
  var judges = slice(arguments);

  function judgeAny(target, curr, prev) {
    var isPassing = false;

    // Run every assertion function in sequence. If any are not passed,
    // isPassing becomes false. Every assertion must return true.
    for (var i = 0; i < judges.length; i += 1)
      isPassing = !isPassing ? judges[i](target, curr, prev) : true;

    return isPassing;
  }

  return judgeAny;
}

// Check if an event is an ending event (cancel or end).
function isEventStop(event) {
  return event && (event.type === 'touchend' || event.type === 'touchcancel');
}

function isEventMove(event) {
  return event && event.type === 'touchmove';
}

function isEventStart(event) {
  return event && event.type === 'touchstart';
}

// Begins with touchmove event.
function isHeadEventStart(node) {
  return isEventStart(value(head(node)));
}

function isTailEventStop(node) {
  return isEventStop(value(node));
}

// Build touch event linked lists that look like:
//
//     touchstart.null
//     touchmove.touchstart.null
//     touchend.touchmove.touchstart.null
//
// Where touchmove is in all cases the most recent touchmove at creation of the
// list node. Used by `drags()` (see below).
function reduceDrag(before, event) {
  // Previous event is called `next` in accord with linked list convention.
  // See <https://en.wikipedia.org/wiki/Linked_list>.

  // Break off new chain if touchstart, or if previous event was an
  // ending event.
  if (isEventStart(event))
    return node(event);

  // If last event was a touchend or if `before` was null, return null.
  // We do this in cases where events happen without a previous corresponding
  // touchstart. This can happen on first turn or after. Instead of
  // creating chains for these orphan moves/ends, we return null
  // (filtered out in `drags`). This step is repeated until a new start begins.
  if(isNullish(before) || isTailEventStop(before)) return null;

  // Subsequent touchmoves.
  if (isEventMove(event) && isEventMove(value(before)))
    // Branch off of previous touchmove node's parent. Should be a touchstart.
    // This allows previous touchmoves to be garbaged.
    return node(event, list.next(before));

  // First touchmove, end and cancel, chain with previous node.
  return node(event, before);
}

// Turns touchstart, touchmove, touchend cycles into a linked list of events.
// Note that touchmove event fires every time, but linked list node is
// mutated to reduce garbage. This means the resulting object will
// eventually contain just 3 nodes: touchstart, last touchmove, touched.
function drags(touchstarts, touchmoves, touchcancels, touchends) {
  // Merge all touch types into a single stream.
  // @TODO getting duplicate touchends for some reason. Need to investigate.
  var events = dropRepeats(merge([touchstarts, touchmoves, touchcancels, touchends]));

  // Build all chains.
  return reject(reductions(events, reduceDrag, null), isNullish);
}

function touchDistanceY(touch0, touch1) {
  y1 = touch0.screenY;
  y2 = touch1.screenY;
  return (y2 - y1);
}

function inRange(number, less, more) {
  return (number >= less) && (number <= more);
}

// Given an x/y coord, determine if point is within the RocketBar's touch zone.
// This is an irregularly shaped hot zone.
// @TODO take y direction into account when calculating hotzone.
// @TODO need a second function to handle RocketBar in expanded mode.
function isInRocketBarCollapsedHotzone(x, y, screenW) {
  return (
    // Inside of the status bar box
    (inRange(x, 0, screenW - 100) && inRange(y, 0, 20)) ||
    // The "extra" fuzzy space below that doesn't overlap with button area of
    // app header.
    (inRange(x, 40, screenW - 100) && inRange(y, 20, 40))
  );
}

// @TODO ok, this is the idea: we use this in initial patch stage to narrow
// down the swipes. But maybe it's actually more useful to do this at the
// membrane level?
function isInRocketbarExpandedHotzone(x, y, screenW) {
  return inRange(x, 0, screenW) && inRange(y, 0, 50);
}

// We capture all events possibly related to the RocketBar, then tease apart
// what we're actually interested in at membrane level.
function isEventRelatedToRocketBar(event) {
  var firstTouch = event.touches[0];
  return isInRocketbarExpandedHotzone(
    firstTouch.screenX,
    firstTouch.screenY,
    screen.width
  );
}

// Given x/y coord, determine if point is within screen bottom touch zone.
// @TODO take y direction into account when calculating hotzone.
function isInscreenBottomHotzone(x, y, prevX, prevY, screenW, screenH) {
  return (
    (inRange(x, 0, screenW) && inRange(y, screenH - 20, screenH))
  );
}

// Filter tap cycles, determining if a swipe distance was moved during cycle.
function isTap(node) {
  // Calculate y distance moved using touchstart event and last touchmove.
  // @TODO if we can accurately get a good read using just velocity, it
  // becomes unnecessary to keep `start` and maybe `end`.
  var touchStartFirstTouch = value(head(node)).touches[0];
  var mostRecentTouches = value(find(node, hasTouches)).touches[0];

  var distanceMoved = touchDistanceY(
    touchStartFirstTouch,
    mostRecentTouches
  );

  // Filter out touch cycle that moved more than 20px.
  return distanceMoved < 10;
}

function isDragDown(node) {
  var touchmove = value(node);
  if (touchmove.type !== 'touchmove') return false;
  var touchstart = value(head(node));
  var distance = touchDistanceY(touchstart.touches[0], touchmove.touches[0]);

  return true;
}

// Convert every item in a spread into given value.
function becomes(spread, value) {
  return reductions(spread, id, value);
}

function deriveIsRocketbarFocused(prev, curr, target) {
  var event = value(head(get(curr, 'rocketbar_area_tapped')));

  if (!hasTouches(event)) return { is_mode_rocketbar_focused: false };

  var touch = event.touches[0];

  var test = hasClass(target, 'js-expanded') ?
      isInRocketbarExpandedHotzone(touch.screenX, touch.screenY, screen.width) :
      isInRocketBarCollapsedHotzone(touch.screenX, touch.screenY, screen.width);

  return { is_mode_rocketbar_focused: test, rocketbar_area_tapped: null };
}

function deriveIsModeTaskManager(prev, curr) {
  return {};
}

function deriveIsRocketbarExpanded(prev, curr, target) {
  var isExpanded = (
    isCurrently(prev, curr, 'is_mode_rocketbar_focused', true) ||
    isCurrently(prev, curr, 'is_mode_task_manager', true)
  );

  return { is_rocketbar_expanded: isExpanded };
}

function app(window) {
  // Listen for touch events.
  var touchstarts = on(window, 'touchstart');
  var touchmoves = on(window, 'touchmove');
  var touchends = on(window, 'touchend');
  var touchcancels = on(window, 'touchcancel');

  var rbStarts = filter(touchstarts, isEventRelatedToRocketBar);
  // We want all drags that begin in RocketBar and end wherever.
  var rbDrags = drags(rbStarts, touchmoves, touchcancels, touchends);
  var rbDragStops = filter(rbDrags, isTailEventStop);

  // Taps on RocketBar are any swipe that covers very little ground.
  var rbTaps = filter(rbDragStops, isTap);

  var rbTapDiffs = map(rbTaps, function (node) {
    return { rocketbar_area_tapped: node };
  });

  // Swipes on RocketBar are anything else.
  // @TODO if ergo of swipable area is feeling bad, can create separate
  // touchcycle that expands hotzone based on direction of swipe.
  var rbSwipes = reject(rbDragStops, isTap);

  var rbCancelTouchstarts = filter(touchstarts, withTargetId('rb-cancel'));

  // Overlay's diff should include shrinking the RocketBar in cases where not
  // in Task Manager mode. Need to use sample().
  var rbOverlayTouchstarts = filter(touchstarts, withTargetId('rb-overlay'));

  // Map to states

  // @TODO rocketbar focus and blur is actually a derived state from actions
  // taken around rocket bar.

  var rbBlurs = becomes(merge([rbCancelTouchstarts, rbOverlayTouchstarts]), {
    is_mode_rocketbar_focused: false
  });

  // @TODO loaded URL, scrolling homescreen, etc.
  var rbShrinking = null;

  // @TODO loading URL, other cases that are independent of modes.
  var rbExpanding = null;

  var setTouchstarts = filter(touchstarts, withTargetId('rb-icons'));

  var toSetPanel = map(setTouchstarts, function (event) {
    return { settings_panel_triggered: event };
  });

  var allDiffs = merge([toSetPanel, rbTapDiffs]);

  // Merge into global state object.
  var updates = patches(allDiffs);

  var keyboardEl = document.getElementById('sys-fake-keyboard');
  var rbOverlayEl = document.getElementById('rb-overlay');
  var rbRocketbarEl = document.getElementById('rb-rocketbar');
  var rbCancelEl = document.getElementById('rb-cancel');
  var activeSheet = $('.sh-head');
  var settingsPanelEl = document.getElementById('set-settings');

  updates = states(updates, deriveIsRocketbarFocused, rbRocketbarEl);
  //updates = states(updates, deriveIsModeTaskManager);
  updates = states(updates, deriveIsRocketbarExpanded);

  updates = widget(updates, settingsPanelEl, updated('settings_panel_triggered'), function (target, state) {
    var event = state.settings_panel_triggered;
    event.preventDefault();
    event.stopPropagation();
    dom.toggleClass(target, 'js-hide');
  });

  updates = widget(updates, keyboardEl, changed('is_mode_rocketbar_focused', false), function (target) {
    dom.removeClass(target, 'js-activated');
  });

  updates = widget(updates, keyboardEl, changed('is_mode_rocketbar_focused', true), function (target) {
    dom.addClass(target, 'js-activated');
  });

  // Animation perf seems slightly faster when cancel is toggled via class
  // instead of CSS.
  updates = widget(updates, $('#rb-cancel, #rb-overlay'), changed('is_mode_rocketbar_focused', true), function (target) {
    dom.removeClass(target, 'js-hide');
  });

  // Animation perf seems slightly faster when cancel is toggled via class
  // instead of CSS.
  updates = widget(updates, $('#rb-cancel, #rb-overlay'), changed('is_mode_rocketbar_focused', false), function (target) {
    dom.addClass(target, 'js-hide');
  });

  updates = widget(updates, rbRocketbarEl, updated('is_rocketbar_expanded'), function (target, state) {
    if(state.is_rocketbar_expanded) dom.addClass(target, 'js-expanded');
    else dom.removeClass(target, 'js-expanded');
  });

  return updates;
}

print(app(window));
