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
    function isClassOnTarget(target) {
      return hasClass(target, className);
    }
    return isClassOnTarget;
  }
  exports.withClass = withClass;

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
    return reducible.reduce(chooseCurr);
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
  accumulate(spread, function (_, item) {
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

// Extend `into` with the own values of another object.
function extend_(into, object) {
  return enumerate(object, set_, into);
}

// Helper function for `contains`.
function enumerateContains(isMissing, key, value, subset, set) {
  return (isMissing ? true : set[key] !== subset[key]);
}

// Checks if `set` contains all the values present in `subset`.
function contains(set, subset) {
  if (!isObject(set) || !isObject(subset)) return false;
  return !enumerate(subset, enumerateContains, false, set);
}

// Patch a series of diffs on to an object.
// Returns a spread with each state of the object over time.
//
// Note: it's a bad idea to mutate this state object
// because other consumers will also be using it.
function patches(diffs, state) {
  return accumulatable(function accumulateStates(next, initial) {
    // State must always be an object.
    state = state || {};

    // Accumulate initial state.
    var accumulated = next(initial, state);

    function nextDiff(state, diff) {
      if (diff === end) {
        next(accumulated, end);
      }
      // If values in `state` are different from values in `diff`...
      // This is a shallow comparison of strict equality.
      // Goal: diffs that do not change current state are skipped.
      else if (!contains(state, diff)) {
        // Update state.
        state = extend_(extend_({}, state), diff);
        // Accumulate `next` with new state.
        accumulated = next(accumulated, state);
      }
      return state;
    }

    accumulate(diffs, nextDiff, state);
  });
}

// Filter and transform a spread of values using a "brane" function.
//
//     function myBrane(curr, prev, target) { ... }
//
// `curr` is the current value of spread, `prev` is the previous value, and
// `target` is an optional value supplied via the 3rd argument 2 membrane.
//
// Function is expected to return either a value or null. If null is returned
// value will be ignored during accumulation (that value will be skipped).
//
// Any value returned becomes the new `curr` value.
//
// Typically used to create calculated states based on state properties and
// current state of `target`.
//
// Returns a new spread of non-null values produced by `brane()`.
//
// @TODO not a verb. This function derives new states.
// Candidates: synthesize, derive, secrete (lol), sift. Maybe ok, tho.
function membrane(spread, brane, target) {
  return accumulatable(function accumulateMembrane(next, initial) {
    var accumulated = initial;
    accumulate(spread, function nextAssert(prev, curr) {
      // We're only interested in non-null comparisons.
      // Skips first item in spread.
      if (isNullish(prev)) return curr;

      // Handle end-of-source scenario.
      if (curr === end) return next(accumulated, end);

      // Create a product from current and previous value + any target
      // with state.
      var product = brane(curr, prev, target);
      // If product is not nullish, we accumulate. Nullish returns are
      // considered "not state changes".
      if (!isNullish(product)) accumulated = next(accumulated, product);

      // Curr becomes next prev.
      return curr;
    }, null);
  });
}

// Get value at `key` on `thing`, or null if `thing` is not an object.
function get(thing, key) {
  return thing ? thing[key] : null;
}

function isUpdated(curr, prev, key) {
  return get(prev, key) !== get(curr, key);
}

// Creates an assertion function to test whether a given property at `key`
// has been updated.
function updated(key) {
  function maybeUpdated(curr, prev) {
    return isUpdated(curr, prev, key) ? curr : null;
  }
  return maybeUpdated;
}

function hasTransitioned(curr, prev, key, from, to) {
  return (get(prev, key) === from) && (get(curr, key) === to);
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
  function maybeTransitioned(curr, prev) {
    return hasTransitioned(curr, prev, key, from, to) ? curr : null;
  }
  return maybeTransitioned;
}

function isChanged(curr, prev, key, to) {
  return (get(prev, key) !== to) && (get(curr, key) === to);
}

// Creates an assertion function that checks if a given
// property at `key` is equal to `to` on `curr` but not on `prev`
function changed(key, to) {
  function maybeChanged(curr, prev) {
    return isChanged(curr, prev, key, to) ? curr : null;
  }
  return maybeChanged;
}

function isCurrently(curr, prev, key, value) {
  return get(curr, key) === value;
}

// Creates an assertion function that checks if a given
// property at `key` is equal to `value` in `curr`.
function currently(key, value) {
  function maybeCurrently(curr, prev) {
    return isCurrently(curr, prev, key, value) ? curr : null;
  }
  return maybeCurrently;
}

function wasPreviously(curr, prev, key, value) {
  return get(prev, key) === value;
}

// Creates an assertion function that checks if a given
// property at `key` is equal to `value` in `prev`.
function previously(key, value) {
  function maybePreviously(curr, prev) {
    return wasPreviously(curr, prev, key, value) ? curr : null;
  }
  return maybePreviously;
}

function maybe(value) {
  function maybeValue(curr) {
    return !isNullish(curr) ? value : null;
  }
  return maybeValue;
}

// Combine `n` membrane functions into a single composed membrane function
// that filters `curr` through membranes until either one returns null or
// all return a value.
function layer(/* brane, ... */) {
  var branes = slice(arguments);

  function maybeLayer(curr, prev, target) {
    // Pass curr through every brane in sequence. If any brane returns null,
    // the subsequent branes will be skipped and null will be returned.
    for (var i = 0; i < branes.length; i += 1)
      curr = !isNullish(curr) ? branes[i](curr, prev, target) : null;

    return curr;
  }

  return maybeLayer;
}

function timeout(ms) {
  return accumulatable(function accumulateTimeout(next, initial) {
    var accumulated = initial;

    // Accumulate the first interval.
    accumulated = next(accumulated, Date.now());

    setTimeout(function onInterval() {
      next(accumulated, end);
    }, ms);
  });
}

function updateDissolveOut(element) {
  element.style.opacity = 0;
}

function exitDissolveOut(element) {
  element.style.transition = 'none';
  element.style.display = 'none';
  return element;
}

function dissolveOut(element, trigger, ms, easing) {
  // Create `enter` transition from arguments.
  function enterDissolveOut(element) {
    element.style.opacity = 1;
    element.style.display = 'block';
    element.style.transition = 'opacity ' + ms + 'ms ' + easing;
    return element;
  }

  write(element, trigger, function updateTrigger(element) {
    var time = timeout(ms + 100);
    write(element, time, updateDissolveOut, enterDissolveOut, exitDissolveOut);
  });
}

function updateDissolveIn(element) {
  element.style.opacity = 1;
}

function exitDissolveIn(element) {
  element.style.transition = 'none';
  return element;
}

function dissolveIn(element, trigger, ms, easing) {
  // Create `enter` transition from argumentse
  function enterDissolveIn(element) {
    element.style.display = 'block';
    element.style.opacity = 0;
    element.style.transition = 'opacity ' + ms + 'ms ' + easing;
    // @hack forces style resolution. Gross!
    // See https://bugzilla.mozilla.org/show_bug.cgi?id=649247.
    element.clientTop;
    return element;
  }

  write(element, trigger, function updateTrigger(element) {
    var time = timeout(ms + 100);
    write(element, time, updateDissolveIn, enterDissolveIn, exitDissolveIn);
  });
}

// Turns touchstart, touchmove, touchend cycles into a linked list of events.
// Note that touchmove event fires every time, but linked list node is
// mutated to reduce garbage. This means the resulting object will
// eventually contain just 3 nodes: touchstart, last touchmove, touched.
function drags(touchstarts, touchmoves, touchcancels, touchends) {
  // Merge all touch types into a single stream.
  // @TODO getting duplicate touchends for some reason. Need to investigate.
  var cycles = dropRepeats(merge([touchstarts, touchmoves, touchcancels, touchends]));
  return reductions(cycles, function reduceDrag(before, event) {
    // Previous event is called `next` in accord with linked list convention.
    // See <https://en.wikipedia.org/wiki/Linked_list>.

    // Break off new chain every touchstart.
    if (event.type === 'touchstart')
      return node(event);

    // Subsequent touchmoves.
    if (event.type === 'touchmove' && value(before).type === 'touchmove')
      // Branch off of previous touchmove node's parent. Should be a touchstart.
      // This allows previous touchmoves to be garbaged.
      return node(event, list.next(before));

    // First touchmove, end and cancel.
    return node(event, before);
  });
}

function isFullCycle(node) {
  return (
    (value(node).type === 'touchend' || value(node).type === 'touchcancel') &&
    value(head(node)).type === 'touchstart'
  );
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

// Convert every item in a spread into given value.
function becomes(spread, value) {
  return reductions(spread, id, value);
}

function makeAddClass(className) {
  function addMemoizedClassTo(element) {
    return dom.addClass(element, className);
  }
  return addMemoizedClassTo;
}

function makeRemoveClass(className) {
  function removeMemoizedClassFrom(element) {
    return dom.removeClass(element, className);
  }
  return removeMemoizedClassFrom;
}

function makeToggleClass(className) {
  function toggleMemoizedClassOn(element) {
    return dom.toggleClass(element, className);
  }
  return toggleMemoizedClassOn;
}

function app(window) {
  // Listen for touch events.
  var touchstarts = on(window, 'touchstart');
  var touchmoves = on(window, 'touchmove');
  var touchends = on(window, 'touchend');
  var touchcancels = on(window, 'touchcancel');

  var windowDrags = drags(touchstarts, touchmoves, touchcancels, touchends);

  var windowCycles = filter(windowDrags, isFullCycle);

  // Touchcyles which begin in RocketBar hotzone.
  var rbCycles = filter(windowCycles, function (node) {
    var firstTouch = value(head(node)).touches[0];
    return isInRocketBarCollapsedHotzone(
      firstTouch.screenX,
      firstTouch.screenY,
      screen.width
    );
  });

  // Taps on RocketBar are any swipe that covers very little ground.
  var rbTaps = filter(rbCycles, isTap);

  // Swipes on RocketBar are anything else.
  // @TODO if ergo of swipable area is feeling bad, can create separate
  // touchcycle that expands hotzone based on direction of swipe.
  var rbSwipes = reject(rbCycles, isTap);

  var rbCancelTouchstarts = filter(touchstarts, withTargetId('rb-cancel'));
  // Prevent default on all rbCancel touch starts.
  var rbCancelPreventedTouchStarts = invoke(rbCancelTouchstarts, 'preventDefault');

  // Overlay's diff should include shrinking the RocketBar in cases where not
  // in Task Manager mode. Need to use sample().
  var rbOverlayTouchstarts = filter(touchstarts, withTargetId('rb-overlay'));

  // Map to states

  var rbFocuses = becomes(rbTaps, {
    is_mode_rocketbar_focused: true
  });

  // @TODO I may have to do some sampling against current state to determine
  // if RB stays expanded.
  var rbBlurs = becomes(merge([rbCancelPreventedTouchStarts, rbOverlayTouchstarts]), {
    is_mode_rocketbar_focused: false
  });

  var toModeTaskManager = becomes(rbSwipes, {
    is_mode_task_manager: true
  });

  // @TODO loaded URL, scrolling homescreen, etc.
  var rbShrinking = null;

  // @TODO loading URL, other cases that are independent of modes.
  var rbExpanding = null;

  var setTouchstarts = filter(touchstarts, withTargetId('rb-icons'));

  var toSetPanel = map(setTouchstarts, function () {
    return { settings_panel_triggered: Date.now() };
  });

  var allDiffs = merge([rbFocuses, rbBlurs, toModeTaskManager, toSetPanel]);

  // Merge into global state object.
  var updates = patches(allDiffs, {
    // @TODO rocketbar expands with task manager mode, but expansion is
    // independent (loading, homescreen etc).
    is_mode_task_manager: false,
    is_mode_rocketbar_focused: false,
    is_rocketbar_showing_results: false,
    settings_panel_triggered: null
  });

  var keyboardEl = document.getElementById('sys-fake-keyboard');

  // Build in
  var keyboardActivations = membrane(updates, layer(
    changed('is_mode_rocketbar_focused', true),
    maybe('js-activated')
  ));
  write(keyboardEl, keyboardActivations, dom.addClass);

  // Build out
  var keyboardDeactivations = membrane(updates, layer(
    changed('is_mode_rocketbar_focused', false),
    maybe('js-activated')
  ));
  write(keyboardEl, keyboardDeactivations, dom.removeClass);


  var toRbFocusedFromAnywhere = membrane(updates, changed('is_mode_rocketbar_focused', true));
  var toRbBlurred = membrane(updates, changed('is_mode_rocketbar_focused', false));

  var rbOverlayEl = document.getElementById('rb-overlay');

  dissolveIn(rbOverlayEl, toRbFocusedFromAnywhere, 200, 'ease-out');
  dissolveOut(rbOverlayEl, toRbBlurred, 200, 'ease-out');

  var whenRbExpandedChange = membrane(updates, function (curr, prev) {
    var relevantUpdates = (
      isUpdated(curr, prev, 'is_mode_rocketbar_focused') ||
      isUpdated(curr, prev, 'is_mode_task_manager')
    );

    if (!relevantUpdates) return null;

    // Expanded state is interdependant on various states.
    // Derive expanded state from global state.
    var isExpanded = (
      isChanged(curr, prev, 'is_mode_rocketbar_focused', true) ||
      isCurrently(curr, prev, 'is_mode_task_manager', true)
    );

    // Return derived state.
    return isExpanded;
  });

  var rbRocketbarEl = document.getElementById('rb-rocketbar');

  write(rbRocketbarEl, whenRbExpandedChange, function (target, isExpanded) {
    if(isExpanded) dom.addClass(target, 'js-expanded');
    else dom.removeClass(target, 'js-expanded');
  });

  var rbCancelEl = document.getElementById('rb-cancel');
  addClass(rbCancelEl, toRbBlurred, 'js-hide');
  removeClass(rbCancelEl, toRbFocusedFromAnywhere, 'js-hide');

  var activeSheet = $('.sh-head');
  var toModeTaskManagerFromAnywhere = membrane(updates, changed('is_mode_task_manager', true));
  addClass(activeSheet, toModeTaskManagerFromAnywhere, 'sh-scaled');

  // Build in/out
  var settingsPanelEl = document.getElementById('set-settings');
  var settingsToggles = membrane(updates, layer(
    updated('settings_panel_triggered'),
    maybe('js-hide')
  ));
  write(settingsPanelEl, settingsToggles, dom.toggleClass);

  return updates;
}

print(app(window));
