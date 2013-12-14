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

// Filter items based on adjacent item using function `assert` to compare.
// Returns a new spread of items that pass `assert`.
function compareAdjacent(spread, assert) {
  return accumulatable(function accumulateFilterAdjacent(next, initial) {
    var accumulated = initial;
    accumulate(spread, function nextCompare(prev, item) {
      if (item === end) next(accumulated, end);
      else if (assert(prev, item)) accumulated = next(accumulated, item);
      return item;
    }, null);
  });
}

// Are 2 things not equal?
function isDifferent(thing0, thing1) {
  return thing0 !== thing1;
}

// Drop adjacent repeats from spread.
function dropRepeats(spread) {
  return compareAdjacent(spread, isDifferent);
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
// Returns a spread with each state of the object over time. Note that the same
// mutated object is used every time.
function states(diffs, state) {
  return accumulatable(function accumulateStates(next, initial) {
    var accumulated = initial;

    function nextDiff(state, diff) {
      if (diff === end) {
        next(accumulated, end);
      }
      // If values in `state` are different from values in `diff`...
      else if (!contains(state, diff)) {
        // Update state.
        state = extend_({}, state, diff);
        // Accumulate `next` with new state.
        accumulated = next(accumulated, state);
      }
      return state;
    }

    accumulate(diffs, nextDiff, state || {});
  });
}

// Creates an assertion function for `compareAdjacent()`. Checks if a given
// property at `path` is equal to `from` on `prev` and equal to `to` in
// `curr`. This gives you state machine-like functionality when used with
// `route()`.
function changed(key, from, to) {
  function isChanged(prev, curr) {
    return prev[key] === from && curr[key] === to;
  }
  return isChanged;
}

// Creates an assertion function for `compareAdjacent()`. Checks if a given
// property at `path` is equal to `value`.
function currently(key, value) {
  function isCurrently(prev, curr) {
    return curr[key] === value;
  }
  return isCurrently;
}

// "route" global states based on a series of assertions which have an "and"
// relationship.
function route(spread, assertions) {
  return compareAdjacent(spread, function assertPassing(prev, curr) {
    var isPassing = false;

    // Run every assertion function in sequence. If any are not passed,
    // isPassing becomes false. Every assertion must return true.
    for (var i = 0; i < assertions.length; i += 1)
      isPassing = isPassing ? assertions[i](prev, curr) : false;

    return isPassing;
  });
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

function firstTouch(event) {
  return event.touches[0];
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
    var firstTouchX = event.touches[0].screenX;
    var firstTouchY = event.touches[0].screenY;
    return isInRocketBarCollapsedHotzone(firstTouchX, firstTouchY, screen.width);
  });

  // Combine RocketBar touch starts with other touch cycle events.
  var rbTouchcycles = touchcycles(rbTouchstarts, touchmoves, touchcancels, touchends);

  // Taps on RocketBar are any swipe that covers very little ground.
  var rbTaps = filter(rbTouchcycles, function (cycle) {
    // Calculate y distance moved.
    var distanceMoved = touchDistanceY(cycle.start.touches[0], cycle.penultimate.touches[0]);
    // Filter out touch cycle that moved more than 20px.
    return distanceMoved < 10;
  });

  var rbCancelTouchstarts = filter(touchstarts, isTargetRbCancel);
  // Prevent default on all rbCancel touch starts.
  var rbCancelPreventedTouchStarts = invoke(rbCancelTouchstarts, 'preventDefault');

  var rbOverlayTouchstarts = filter(touchstarts, isTargetRbOverlay);

  // Map to states

  var rbFocuses = becomes(rbTaps, { is_rocketbar_focused: true, is_rocketbar_expanded: true });

  var rbBlurs = becomes(merge([rbCancelPreventedTouchStarts, rbOverlayTouchstarts]), {
    is_rocketbar_focused: false
  });

  var rbExpanding = becomes(rbTouchstarts, { is_rocketbar_expanded: true });

  var rbShrinking = null; // @TODO

  var allDiffs = merge([rbFocuses, rbBlurs, rbExpanding, rbShrinking]);

  // Merge into global state object.
  var appStates = states(allDiffs, {
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
  var whenRbFocused = route(appStates, [
    currently('is_rocketbar_focused', true)
  ]);

  var whenRbBlurred = route(appStates, [
    currently('is_rocketbar_focused', false)
  ]);

  var keyboardEl = document.getElementById('sys-fake-keyboard');
  addClass(keyboardEl, whenRbFocused, 'js-activated');
  removeClass(keyboardEl, whenRbBlurred, 'js-activated');

  return appStates;
}

print(app(window));

/*
var keyboardEl = document.getElementById('sys-fake-keyboard');
removeClass(keyboardEl, rbBlurs, 'js-activated');
addClass(keyboardEl, rbFocuses, 'js-activated');

var rbRocketbarEl = document.getElementById('rb-rocketbar');
addClass(rbRocketbarEl, rbExpanding, 'js-expanded');

var rbCancelEl = document.getElementById('rb-cancel');
removeClass(rbCancelEl, rbFocuses, 'js-hide');

var taskManagerEl = document.getElementById('tm-task-manager');
dissolveIn(taskManagerEl, rbExpanding, 200, 'ease-out');

var rbOverlayEl = document.getElementById('rb-overlay');
dissolveOut(rbOverlayEl, rbBlurs, 200, 'ease-out');
dissolveIn(rbOverlayEl, rbFocuses, 200, 'ease-out');
*/
