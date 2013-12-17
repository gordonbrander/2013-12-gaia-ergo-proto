var a = require('accumulators');
var on = a.on;
var map = a.map;
var filter = a.filter;
var reject = a.reject;
var classname = a.classname;
var addClass = a.addClass;
var removeClass = a.removeClass;
var $ = a.$;
var merge = a.merge;
var reductions = a.reductions;
var accumulatable = a.accumulatable;
var accumulate = a.accumulate;
var end = a.end;
var write = a.write;
var id = a.id;
var slice = a.slice;

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

// Patch a series of diffs on to a state object.
// Returns a spread with each state of the object over time.
//
// Note: it's a bad idea to mutate this state object from assertion functions
// because other consumers will also be using it, introducing state-related
// bugs. Instead, send your changes to state as part of `diffs` spread, so
// all other consumers can be notified of change.
function states(diffs, state) {
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

// Route states using assertion function.
// Returns a new spread that contains the values which
// pass `assert(left, right)`.
function routes(states, assert) {
  return asserts(states, function assertRoute(left, right) {
    // Wrap assertion, skipping first left value (which will be null). The
    // first right value will be initial state. Skipping the null value will
    // mean the first assertion hit will compare initial state to first
    // patched state.
    return (left !== null) ? assert(left, right) : false;
  });
}

// Get value at `key` on `thing`, or null if `thing` is not an object.
function get(thing, key) {
  return thing ? thing[key] : null;
}

// Creates an assertion function that checks if a given
// property at `path` is equal to `from` on `prev` and equal to `to` in
// `curr`.
//
// This gives you state machine-like functionality when used with
// `asserts()`. For example, to get a spread of all states where your
// became `awesome`:
//
//     var x = asserts(appStates, transitioned('awesome', false, true));
function transitioned(key, from, to) {
  function hasTransitioned(prev, curr) {
    return (get(prev, key) === from) && (get(curr, key) === to);
  }
  return hasTransitioned;
}

// Creates an assertion function that checks if a given
// property at `path` is equal to `to` on `curr` but not on `prev`
function changed(key, to) {
  function isChanged(prev, curr) {
    return (get(prev, key) !== to) && (get(curr, key) === to);
  }
  return isChanged;
}

// Creates an assertion function that checks if a given
// property at `key` is equal to `value` in `curr`.
function currently(key, value) {
  function isCurrently(prev, curr) {
    return get(curr, key) === value;
  }
  return isCurrently;
}

// Creates an assertion function that checks if a given
// property at `key` is equal to `value` in `prev`.
function previously(key, value) {
  function wasPreviously(prev, curr) {
    return get(prev, key) === value;
  }
  return wasPreviously;
}

// Combine `n` assertion functions into a single assertion function
// that tests all given assertions using an `and` relationship.
//
// Pass each assertion function as an argument to `all`. Returns an
// assertion function.
//
// Protip: returned assertion function is composable with `all` or `any`
// allowing for complex nested boolean logic.
function all(/* assert, ... */) {
  var assertions = slice(arguments);

  function assertAll(prev, curr) {
    var isPassing = false;

    // Run every assertion function in sequence. If any are not passed,
    // isPassing becomes false. Every assertion must return true.
    for (var i = 0; i < assertions.length; i += 1)
      isPassing = isPassing ? assertions[i](prev, curr) : false;

    return isPassing;
  }

  return assertAll;
}

// Combine `n` assertion functions into a single assertion function
// that tests all given assertions using an `or` relationship.
//
// Pass each assertion function as an argument to `any`. Returns an
// assertion function.
//
// Protip: returned assertion function is composable with `all` or `any`
// allowing for complex nested boolean logic.
function any(/* assert, ... */) {
  var assertions = slice(arguments);

  function assertAny(prev, curr) {
    var isPassing = false;

    // Run every assertion function in sequence. If any are not passed,
    // isPassing becomes false. Every assertion must return true.
    for (var i = 0; i < assertions.length; i += 1)
      isPassing = !isPassing ? assertions[i](prev, curr) : true;

    return isPassing;
  }

  return assertAny;
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

function isTargetRocketBar(event) {
  return event.target.id === 'rb-rocketbar';
}

function isTargetRbCancel(event) {
  return event.target.id === 'rb-cancel';
}

function isTargetRbOverlay(event) {
  return event.target.id === 'rb-overlay';
}

// Create a node in a linked list.
function node(value, nextNode, into) {
  return set_(set_(into || {}, 'value', value), 'next', nextNode);
}

function next(node) {
  return node && node.next ? node.next : null;
}

function value(node) {
  return node && node.value ? node.value : null;
}

function find(node, predicate) {
  // Capture variable to avoid mutating closure variable.
  var n = node;
  while(next(n) !== null && !predicate(value(n))) n = next(n);
  return n;
}

function head(node) {
  // Capture variable to avoid mutating closure variable.
  var n = node;
  while(next(n) !== null) n = next(n);
  return n;
}

// Turns touchstart, touchmove, touchend cycles into a linked list of events.
// Note that touchmove event fires every time, but linked list node is
// mutated to reduce garbage. This means the resulting object will
// eventually contain just 3 nodes: touchstart, last touchmove, touched.
function drags(touchstarts, touchmoves, touchcancels, touchends) {
  // Merge all touch types into a single stream.
  var cycles = merge([touchstarts, touchmoves, touchcancels, touchends]);
  return reductions(cycles, function reduceDrag(before, event) {
    // Previous event is called `next` in accord with linked list convention.
    // See <https://en.wikipedia.org/wiki/Linked_list>.

    // Break off new chain every touchstart.
    if (event.type === 'touchstart')
      return node(event);

    // Subsequent touchmoves.
    if (event.type === 'touchmove' && next(before))
      // Reuse touchmove node.
      return node(event, next(before), before);

    // First touchmove, end and cancle.
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

function isTypeTouchmove(event) {
  return event.type === 'touchmove';
}

// Filter tap cycles, determining if a swipe distance was moved during cycle.
function isTap(node) {
  // Calculate y distance moved using touchstart event and last touchmove.
  // @TODO if we can accurately get a good read using just velocity, it
  // becomes unnecessary to keep `start` and maybe `end`.
  var touchStartFirstTouch = value(head(node)).touches[0];
  var lastTouchMoveFirstTouch = value(find(node, isTypeTouchmove)).touches[0];

  var distanceMoved = touchDistanceY(
    touchStartFirstTouch,
    lastTouchMoveFirstTouch
  );

  // Filter out touch cycle that moved more than 20px.
  return distanceMoved < 10;
}

// Convert every item in a spread into given value.
function becomes(spread, value) {
  return reductions(spread, id, value);
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

  var rbCancelTouchstarts = filter(touchstarts, isTargetRbCancel);
  // Prevent default on all rbCancel touch starts.
  var rbCancelPreventedTouchStarts = invoke(rbCancelTouchstarts, 'preventDefault');

  // Overlay's diff should include shrinking the RocketBar in cases where not
  // in Task Manager mode. Need to use sample().
  var rbOverlayTouchstarts = filter(touchstarts, isTargetRbOverlay);

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

  var allDiffs = merge([rbFocuses, rbBlurs, toModeTaskManager]);

  // Merge into global state object.
  var appStates = states(allDiffs, {
    // @TODO rocketbar expands with task manager mode, but expansion is
    // independent (loading, homescreen etc).
    is_mode_task_manager: false,
    is_mode_rocketbar_focused: false,
    is_rocketbar_showing_results: false
  });

  var toRbFocusedFromAnywhere = routes(appStates, changed('is_mode_rocketbar_focused', true));

  var toRbFocusedFromTaskManager = routes(appStates, all(
    changed('is_mode_rocketbar_focused', true),
    previously('is_mode_task_manager', true)
  ));

  // @TODO shorten and waterfall animations when going straight to focused.
  var toRbFocusedImmediately = routes(appStates, all(
    changed('is_mode_rocketbar_focused', true),
    previously('is_mode_task_manager', false)
  ));

  var whenRbBlurred = routes(appStates, changed('is_mode_rocketbar_focused', false));

  var toRbExpanded = routes(appStates, any(
    changed('is_mode_rocketbar_focused', true),
    changed('is_mode_task_manager', true)
  ));

  var whenModeTaskManager = routes(appStates, transitioned('is_mode_task_manager', false, true));

  var keyboardEl = document.getElementById('sys-fake-keyboard');
  addClass(keyboardEl, toRbFocusedFromAnywhere, 'js-activated');
  removeClass(keyboardEl, whenRbBlurred, 'js-activated');

  var rbOverlayEl = document.getElementById('rb-overlay');
  dissolveIn(rbOverlayEl, toRbFocusedFromAnywhere, 200, 'ease-out');
  dissolveOut(rbOverlayEl, whenRbBlurred, 200, 'ease-out');

  var rbCancelEl = document.getElementById('rb-cancel');
  addClass(rbCancelEl, whenRbBlurred, 'js-hide');
  removeClass(rbCancelEl, toRbFocusedFromAnywhere, 'js-hide');

  var rbRocketbarEl = document.getElementById('rb-rocketbar');
  addClass(rbRocketbarEl, toRbExpanded, 'js-expanded');

  var taskManagerEl = document.getElementById('tm-task-manager');
  dissolveIn(taskManagerEl, whenModeTaskManager, 200, 'ease-out');

  return appStates;
}

print(app(window));

/*

*/
