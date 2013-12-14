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

function isArray(thing) {
  return thing instanceof Array;
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


// Patch an `object` with a `diff` object. If the objects are different, will
// return a new object, patched with `diff`. Patch will deep-extend objects,
// but not arrays.
function patch(object, diff) {
  var key, prev, curr;

  // Check if values in diff are alread equal to values in object.
  var isChanged = false;
  for (key in diff) isChanged = (isChanged ? true : object[key] !== diff[key]);

  // If nothing has changed, return `object`. Nothing more to do.
  if (!isChanged) return object;

  // If changes have been made, create a new object to hold changes.
  var into = {};

  // Shallow copy all properties of `prev` to `into`.
  for (key in object) into[key] = object[key];

  for (key in diff) {
    curr = diff[key];
    prev = into[key];

    // If property has gone from an object to an object, we do a deep patch
    // on that object. We don't deep-patch arrays.
    if (isObject(curr) && isObject(prev) && !isArray(curr) && !isArray(prev)) {
      into[key] = patch(prev, curr);
    }
    // Otherwise, a shallow copy of value will suffice.
    else {
      into[key] = diff[key];
    }
  }

  return into;
}

// Patch a series of diffs on to a state object.
// Returns a spread with each state of the object over time. Note that the same
// mutated object is used every time.
function states(diffs, initial) {
  return dropRepeats(reductions(diffs, patch, initial || {}));
}

function prev(spread) {
  return accumulatable(function accumulatePrev(next, initial) {
    var accumulated = initial;
    accumulate(spread, function nextAccumulate(prev, item) {
      accumulated = next(accumulated, prev);
      return item;
    }, null);
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

function makeTrue() { return true; }
function makeFalse() { return false; }

var touchstarts = on(window, 'touchstart');
var touchmoves = on(window, 'touchmoves');
var touchends = on(window, 'touchend');
var touchcancels = on(window, 'touchcancel');
var touchmoves = on(window, 'touchmove');

// We want to use clicks instead of touchstart here b/c we don't want to
// conflict with swipe gesture for RocketBar.
var rbTouchstarts = filter(touchstarts, function isEventInRocketBarHotzone(event) {
  var firstTouchX = event.touches[0].screenX;
  var firstTouchY = event.touches[0].screenY;
  return isInRocketBarCollapsedHotzone(firstTouchX, firstTouchY, screen.width);
});

var rbTouchcycles = touchcycles(rbTouchstarts, touchmoves, touchcancels, touchends);

// Taps on RocketBar are any swipe that covers very little ground.
var rbTaps = filter(rbTouchcycles, function (cycle) {
  // Calculate y distance moved.
  var distanceMoved = touchDistanceY(cycle.start.touches[0], cycle.penultimate.touches[0]);
  // Filter out touch cycle that moved more than 20px.
  return distanceMoved < 20;
});

var rbCancelTouchstarts = filter(touchstarts, isTargetRbCancel);
// Prevent default on all rbCancel touch starts.
var rbCancelPreventedTouchStarts = invoke(rbCancelTouchstarts, 'preventDefault');

var rbOverlayTouchstarts = filter(touchstarts, isTargetRbOverlay);

var rbFocuses = rbTaps;
var rbBlurs = merge([rbCancelPreventedTouchStarts, rbOverlayTouchstarts]);
var rbExpanding = rbTouchstarts;
var rbShrinking = null; // @TODO

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
