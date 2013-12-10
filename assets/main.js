var a = require('accumulators');
var on = a.on;
var map = a.map;
var filter = a.filter;
var classname = a.classname;
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

// Convert rocketbar expanded changes to 
var rbIsExanded = merge([rbCancels, rbTapOpens]);

classname($('#sys-fake-keyboard'), 'js-activated', rbIsExanded);
classname($('#rb-rocketbar'), 'js-expanded', rbIsExanded);
