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

function swipes(element) {
  return accumulatable(function accumulateSwipes(next, initial) {
    var touchstarts = on(element, 'touchstart');
    var touchmoves = on(element, 'touchmove');
    var touchends = on(element, 'touchend');

    var swipes = merge([touchstarts, touchmoves, touchends]);

    return swipes;
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

function touchXDistance(touch1, touch2) {
  x1 = touch1.screenX;
  x2 = touch2.screenX;
  return x2 - x1;
}

function touchDistanceY(touch0, touch1) {
  y1 = touch0.screenY;
  y2 = touch1.screenY;
  return (y2 - y1);
}

function makeTrue() { return true; }
function makeFalse() { return false; }

var touchstarts = on(window, 'touchstart');
var touchmoves = on(window, 'touchmoves');
var touchends = on(window, 'touchend');
var touchcancels = on(window, 'touchcancel');
var touchmoves = on(window, 'touchmove');
var clicks = on(window, 'click');

// We want to use clicks instead of touchstart here b/c we don't want to
// conflict with swipe gesture for RocketBar.
var rbTouchstarts = filter(touchstarts, isTargetRocketBar);
var rbTouchmoves = filter(touchmoves, isTargetRocketBar);
var rbTouchends = filter(touchends, isTargetRocketBar);
var rbTouchcancels = filter(touchcancels, isTargetRocketBar);

var rbTouchCycles = merge([rbTouchstarts, touchmoves, touchcancels, touchends]);

var rbTouchReductions = reductions(rbTouchCycles, function (cycle, event) {
  // Reset distanceY.
  cycle.distanceY = null;

  // At end of touch cycle, calculate distance moved on y axis.
  // `prev` is the `touchstart` event in this case.
  if (event.type === 'touchend' || event.type === 'touchcancel') {
    cycle.distanceY = touchDistanceY(cycle.last.touches[0], cycle.first.touches[0]);
    cycle.first = null;
    cycle.last = null;
  }
  else if (event.type === 'touchmove') {
    cycle.last = event;
  }
  // @TODO the problem I'm running into is that touchends are not always matched
  // with touchstarts because I'm targeting starts that happen in RocketBar and
  // ends that happen elsewhere. Need to be more intelligent about this.
  else if (event.type === 'touchstart') {
    cycle.first = event;
    cycle.last = event;
  }

  console.log(cycle);

  // Current `event` becomes `prev`.
  return cycle;
}, {
  first: null,
  last: null,
  distanceY: null
});

var rbTaps = filter(rbTouchReductions, function (event) {
  return event.type === 'touchend' || event.type === 'touchcancel';
});

accumulate(rbTouchReductions, function (_, event) {  });

var rbCancelTouchstarts = filter(touchstarts, isTargetRbCancel);
// Prevent default on all rbCancel touch starts.
var rbCancelPreventedTouchStarts = invoke(rbCancelTouchstarts, 'preventDefault');
var rbCancels = map(rbCancelPreventedTouchStarts, makeFalse);

var rbOverlayTouchstarts = filter(touchstarts, isTargetRbOverlay);

var rbFocuses = null;
var rbBlurs = merge([rbCancelPreventedTouchStarts, rbOverlayTouchstarts]);
var rbExpanding = rbTouchstarts;
var rbShrinking = null; // @TODO

var keyboardEl = document.getElementById('sys-fake-keyboard');
removeClass(keyboardEl, rbBlurs, 'js-activated');
addClass(keyboardEl, rbFocuses, 'js-activated');

var rbRocketbarEl = document.getElementById('rb-rocketbar');
addClass(rbRocketbarEl, rbExpanding, 'js-expanded');

var rbOverlayEl = document.getElementById('rb-overlay');
dissolveOut(rbOverlayEl, rbBlurs, 200, 'ease-out');
dissolveIn(rbOverlayEl, rbFocuses, 200, 'ease-out');
