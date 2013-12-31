// Define a module with a suite of simple DOM helpers.
define('dom', function (require, exports) {
  var a = require('accumulators');
  var handleEnd = a.handleEnd;

  var __slice__ = Array.prototype.slice;
  function slice(arraylike, start, end) {
    return __slice__.call(arraylike, start, end);
  }
  exports.slice = slice;


  // Check if a `thing` is an object with an own `length` property. This is the
  // closest proxy to knowing if an object is arraylike.
  function hasLength(thing) {
    return thing && thing.hasOwnProperty && thing.hasOwnProperty('length');
  }

  // Get a real array of elements. `element` argument can be a single element,
  // an arraylike list of elements, or a selector to be queried.
  function $(element) {
    // If `element` is actually a selector string, query for elements, then
    // slice nodeList into true array.
    if (typeof element === 'string')
      return slice(document.querySelectorAll(element));

    // If `element` has a length property (it's arraylike), we slice it.
    // This covers cases where you may want to pass a nodeList to `$`.
    if (hasLength(element)) return slice(element);

    // Otherwise, we can assume element is just an element. Elements are
    // accumulatable, so we can just return it.
    return element;
  }
  exports.$ = $;

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
  exports.addClass = addClass;

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

  // Return value of something.
  function value(thing) {
    // If thing has a value, return it. Otherwise
    return (thing && thing.value != null) ? thing.value : thing;
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
var filter = a.filter;
var reject = a.reject;
var hub = a.hub;
// @TODO it may be that these DOM writers are not that useful. Perhaps a simple
// collection of DOM functions on spreads will be valuable instead.
var merge = a.merge;
var reductions = a.reductions;
var accumulatable = a.accumulatable;
var accumulate = a.accumulate;
var end = a.end;
var write = a.write;
var id = a.id;

var dom = require('dom');
var $ = dom.$;
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

function pluck(spread, key) {
  return map(spread, function toPluckedKey(object) {
    return object[key];
  });
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

// Write to a target as a side-effect of accumulating `spread`.
//
// `enter(target)` must return a value representing the target to be written
// to. This gives you a chance to create the target from a value, or modify
// the target when writing begins.
//
// `update(target, value)` describes how to write to the target. It is not
// required to return a value.
//
// `exit(target)` allows you to destroy or modify the target when spread has
// ended. It is not required to return a value.
//
// `update`, `enter` and `exit` are all optional.
//
// Returns an accumulatable that will begin writing when accumulated.
function view(target, spread, update, enter, exit) {
  update = update || id;
  enter = enter || id;
  exit = exit || id;

  return accumulatable(function accumulateView(next, initial) {
    // Prep target.
    target = enter(target);

    accumulate(spread, function nextWrite(accumulated, item) {
      // Write to target as side-effect of accumulation.
      if (item === end) exit(target);
      else update(target, item);

      // Accumulate with updated target. Note that this is simply a reference
      // to `target`. Target will mutate and can't be counted on as a value.
      return next(accumulated, target);
    }, initial);
  });
}

// Get value at `key` on `thing`, or null if `thing` is not an object or no
// value at key.
function get(thing, key) {
  return thing && !isNullish(thing[key]) ? thing[key] : null;
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
  // Use hub to ensure reduceDrag is called once per item.
  // This keeps it's `before` state correct for chaining.
  return hub(reject(reductions(events, reduceDrag, null), isNullish));
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

function haltEvent_(event) {
  event.stopPropagation();
  if (!event.defaultPrevented) event.preventDefault();
  return event;
}

function app(window) {
  // Listen for touch events.
  var touchstarts = on(window, 'touchstart');
  var touchmoves = on(window, 'touchmove');
  var touchends = on(window, 'touchend');
  var touchcancels = on(window, 'touchcancel');

  var rbStarts = filter(touchstarts, withTargetId('rb-rocketbar'));
  // We want all drags that begin in RocketBar and end wherever.
  var rbDrags = drags(rbStarts, touchmoves, touchcancels, touchends);
  var rbDragStops = filter(rbDrags, isTailEventStop);

  // Taps on RocketBar are any swipe that covers very little ground.
  var rbTaps = filter(rbDragStops, isTap);
  var rbSwipes = reject(rbDragStops, isTap);

  var rbCancelTouchstarts = filter(touchstarts, withTargetId('rb-cancel'));

  var rbOverlayTouchstarts = filter(touchstarts, withTargetId('rb-overlay'));

  var rbBlurs = merge([rbCancelTouchstarts, rbOverlayTouchstarts]);

  var setIconTouchstarts = filter(touchstarts, withTargetId('rb-icons'));
  var setOverlayTouchstarts = filter(touchstarts, withTargetId('set-overlay'));
  var setEvents = merge([setIconTouchstarts, setOverlayTouchstarts]);

  var keyboardEl = document.getElementById('sys-fake-keyboard');
  var rbOverlayEl = document.getElementById('rb-overlay');
  var rbRocketbarEl = document.getElementById('rb-rocketbar');
  var rbCancelEl = document.getElementById('rb-cancel');
  var activeSheet = $('.sh-head');
  var setPanelEl = document.getElementById('set-settings');
  var setOverlayEl = document.getElementById('set-overlay');

  var rbFocusWrites = view({
    keyboard: keyboardEl,
    overlay: rbOverlayEl,
    cancel: rbCancelEl,
    rocketbar: rbRocketbarEl
  }, rbTaps, function (els, event) {
    dom.addClass(els.rocketbar, 'js-expanded');
    dom.addClass(els.keyboard, 'js-activated');
    dom.removeClass(els.cancel, 'js-hide');
    dom.removeClass(els.overlay, 'js-hide');
  });

  var rbBlurWrites = view({
    keyboard: keyboardEl,
    overlay: rbOverlayEl,
    cancel: rbCancelEl,
    rocketbar: rbRocketbarEl
  }, rbBlurs, function (els, event) {
    event = haltEvent_(event);
    // @TODO collapse per current task manager status.
    dom.removeClass(els.rocketbar, 'js-expanded');
    dom.removeClass(els.keyboard, 'js-activated');
    dom.addClass(els.cancel, 'js-hide');
    dom.addClass(els.overlay, 'js-hide');
  });

  function updateSetPanelClose(target, event) {
    dom.addClass(target.panel, 'js-hide');
    dom.addClass(target.overlay, 'js-hide');
  }

  function updateSetPanelOpen(target, event) {
    dom.removeClass(target.panel, 'js-hide');
    dom.removeClass(target.overlay, 'js-hide');
  }

  var setPanelWrites = view({
    panel: setPanelEl,
    overlay: setOverlayEl
  }, setEvents, function (target, event) {
    event = haltEvent_(event);

    if (event.target.id === 'set-overlay') updateSetPanelClose(target, event);
    else if (!dom.hasClass(target.panel, 'js-hide')) updateSetPanelClose(target, event);
    else updateSetPanelOpen(target, event);
  });

  // Merge all accumulatable spreads so they will begin accumulation at same
  // moment.
  return merge([rbFocusWrites, rbBlurWrites, setPanelWrites]);
}

print(app(window));
