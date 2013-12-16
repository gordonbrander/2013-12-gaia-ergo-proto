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

// Extend `into` with the values of 2 other objects.
function extend_(into, object0, object1) {
  var key;

  // Shallow copy all properties of `object0` to `into`.
  for (key in object0) into[key] = object0[key];

  // Shallow copy all properties of `object1` to `into`.
  for (key in object1) into[key] = object1[key];

  // Return finished object.
  return into;
}

// Checks if `set` contains all the values present in `subset`.
function contains(set, subset) {
  if (!isObject(set) || !isObject(subset)) return false;

  // Check if values in subset are equal to values in object.
  var isMissing = false;
  for (var key in subset) isMissing = (isMissing ? true : set[key] !== subset[key]);

  return !isMissing;
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
        state = extend_({}, state, diff);
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

// Reconfigures spreads of touch events into a spread of objects. Each object
// will contain a `start` `penultimate` and `end` event. These events let you
// extrapolate the distance moved between, say the first touch and the
// last move.
function touchcycles(touchstarts, touchmoves, touchcancels, touchends) {
  return accumulatable(function accumulateCycles(next, initial) {
    // Merge all touch types into a single stream.
    var cycles = merge([touchstarts, touchmoves, touchcancels, touchends]);
    // Create closure variables representing the 3 stages of the touch
    // lifecycle.
    var start = null;
    var penultimate = null;

    accumulate(cycles, function (accumulated, event) {
      var type = event.type;

      // If event is touchstart, assign to start closure var.
      if (type === 'touchstart') {
        start = event;
        penultimate = event;
      }
      // If event is move, assign to penultimate closure var. This gives us
      // access to the last move in the sequence at the end, and allows us to
      // extrapolate between touchstart and last move.
      else if (type === 'touchmove') {
        penultimate = event;
      }
      // If we have both a start and an end, this represents a complete touch
      // cycle.
      else if (type === 'touchend' || type === 'touchcancel') {
        if (start && penultimate) accumulated = next(accumulated, {
          start: start,
          penultimate: penultimate,
          end: event
        });

        // This is the end of the cycle. Reset all closure variables.
        start = penultimate = null;
      }

      return accumulated;
    }, initial);
  });
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
// @TODO take velocity y direction into account when calculating hotzone.
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

// Filter tap cycles, determining if a swipe distance was moved during cycle.
function isTap(cycle) {
  // Calculate y distance moved.
  var distanceMoved = touchDistanceY(cycle.start.touches[0], cycle.penultimate.touches[0]);
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

  // Find touch events that start within RocketBar's hot zone.
  var rbTouchstarts = filter(touchstarts, function isEventInRocketBarHotzone(event) {
    var firstTouch = event.touches[0];
    return isInRocketBarCollapsedHotzone(
      firstTouch.screenX,
      firstTouch.screenY,
      screen.width
    );
  });

  // Combine RocketBar touch starts with other touch cycle events.
  var rbTouchcycles = touchcycles(rbTouchstarts, touchmoves, touchcancels, touchends);

  // Taps on RocketBar are any swipe that covers very little ground.
  var rbTaps = filter(rbTouchcycles, isTap);

  // Swipes on RocketBar are anything else.
  // @TODO if ergo of swipable area is feeling bad, can create separate
  // touchcycle that expands hotzone based on direction of swipe.
  var rbSwipes = reject(rbTouchcycles, isTap);

  var rbCancelTouchstarts = filter(touchstarts, isTargetRbCancel);
  // Prevent default on all rbCancel touch starts.
  var rbCancelPreventedTouchStarts = invoke(rbCancelTouchstarts, 'preventDefault');

  var rbOverlayTouchstarts = filter(touchstarts, isTargetRbOverlay);

  // Map to states

  var rbFocuses = becomes(rbTaps, {
    is_rocketbar_focused: true,
    is_rocketbar_expanded: true
  });

  // @TODO I may have to do some sampling against current state to determine
  // if RB stays expanded.
  var rbBlurs = becomes(merge([rbCancelPreventedTouchStarts, rbOverlayTouchstarts]), {
    is_rocketbar_focused: false
  });

  var toModeTaskManager = becomes(rbSwipes, {
    is_rocketbar_expanded: true,
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
    is_rocketbar_expanded: false,
    is_rocketbar_focused: false,
    is_rocketbar_showing_results: false
  });

  // The difference here is that I'm getting a global state object.
  // Do I need it when I can simply merge together all the related states
  // I care about? Yeah I do because state lingers, but signals do not. Somthing
  // like this would have to happen at some point. Better to have it centralized
  // as a source of truth. I'm not asking "has this just changed" but "have any
  // of these just changed".

  // @TODO shorten and waterfall animations when going straight to focused.
  var whenRbFocused = routes(appStates, all(
    changed('is_rocketbar_focused', true),
    previously('is_rocketbar_expanded', true)
  ));

  var whenRbFocusedImmediately = routes(appStates, all(
    changed('is_rocketbar_focused', true),
    previously('is_rocketbar_expanded', false)
  ));

  var whenRbBlurred = routes(appStates, changed('is_rocketbar_focused', false));

  var whenRbExpanded = routes(appStates, changed('is_rocketbar_expanded', true));

  var whenModeTaskManager = routes(appStates, transitioned('is_mode_task_manager', false, true));

  var keyboardEl = document.getElementById('sys-fake-keyboard');
  addClass(keyboardEl, whenRbFocused, 'js-activated');
  removeClass(keyboardEl, whenRbBlurred, 'js-activated');

  var rbOverlayEl = document.getElementById('rb-overlay');
  dissolveOut(rbOverlayEl, whenRbBlurred, 200, 'ease-out');
  dissolveIn(rbOverlayEl, whenRbFocused, 200, 'ease-out');

  var rbRocketbarEl = document.getElementById('rb-rocketbar');
  addClass(rbRocketbarEl, whenRbExpanded, 'js-expanded');

  var taskManagerEl = document.getElementById('tm-task-manager');
  dissolveIn(taskManagerEl, whenModeTaskManager, 200, 'ease-out');

  return appStates;
}

print(app(window));

/*
var rbCancelEl = document.getElementById('rb-cancel');
removeClass(rbCancelEl, rbFocuses, 'js-hide');

*/
