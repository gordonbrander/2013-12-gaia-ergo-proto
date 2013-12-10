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

// Invoke a method on each object in a spread, presumably mutating that object
// causing side-effects.
//
// Returns a spread of objects after invocation.
function invoke(spread, method, args) {
  args = args || [];
  return map(spread, function mapInvoke(object) {
    object[method].apply(object, args);
    return object;
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

function isTargetRocketBar(event) {
  return event.target.id === 'rb-rocketbar';
}

function isTargetRbCancel(event) {
  return event.target.id === 'rb-cancel';
}

function makeTrue() { return true; }
function makeFalse() { return false; }

// Returns a spread of gesture swipes 
function swipes(element) {
  var touchstarts = on(window, 'touchstart');
  var touchends = on(window, 'touchend');
}

var touchstarts = on(window, 'touchstart');
var clicks = on(window, 'click');

// We want to use clicks instead of touchstart here b/c we don't want to
// conflict with swipe gesture for RocketBar.
var rbClicks = filter(clicks, isTargetRocketBar);
var rbTapOpens = map(rbClicks, makeTrue);

var rbCancelTouchstarts = filter(touchstarts, isTargetRbCancel);
// Prevent default on all rbCancel touch starts.
var rbCancelPreventedTouchStarts = invoke(rbCancelTouchstarts, 'preventDefault');
var rbCancels = map(rbCancelPreventedTouchStarts, makeFalse);

var rbOverlayClicks = filter(clicks, function isTargetRbOverlay(event) {
  return event.target.id === 'rb-overlay';
});

var rbFocuses = rbTapOpens;
var rbBlurs = merge([rbCancelPreventedTouchStarts, rbOverlayClicks]);
var rbExpanding = rbTapOpens;
var rbShrinking = null; // @TODO

// Convert rocketbar expanded changes to 
var rbIsExanded = merge([rbCancels, rbTapOpens]);

var keyboardEl = document.getElementById('sys-fake-keyboard');

removeClass(keyboardEl, rbBlurs, 'js-activated');
addClass(keyboardEl, rbFocuses, 'js-activated');

var rbRocketbarEl = document.getElementById('rb-rocketbar');
addClass(rbRocketbarEl, rbIsExanded, 'js-expanded');

var rbOverlayEl = document.getElementById('rb-overlay');

dissolveOut(rbOverlayEl, rbBlurs, 200, 'ease-out');
dissolveIn(rbOverlayEl, rbFocuses, 200, 'ease-out');
