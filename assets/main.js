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

  function $$(selector) {
    return document.getElementById(selector);
  }
  exports.$$ = $$;

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

  // Set/remove a single attribute on a single element.
  function setSingleStyle(element, key, value) {
    // Otherwise, set the attribute.
    element.style[key] = value;
    return element;
  }

  var setStyle = multisetter(function setStyleOn(styles, element) {
    for (var key in styles) setSingleStyle(element, key, styles[key]);
    return styles;
  });
  exports.setStyle = setStyle;

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

define('view', function (require, exports) {
  var a = require('accumulators');
  var accumulatable = a.accumulatable;
  var end = a.end;
  var accumulate = a.accumulate;
  var isNullish = a.isNullish;

  // Write to `target` every time `spread` updates.
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
  //
  // @TODO it would probably behoove composability to make write a typical
  // accumulator, allowing it to end sources as well as consume them.
  function write(target, spread, update, enter, exit) {
    update = update || id;
    enter = enter || id;
    exit = exit || id;

    target = enter(target);
    accumulate(spread, function nextWrite(_, item) {
      if (item === end) exit(target);
      else update(target, item);
    });
  }
  exports.write = write;

  // Write to a target as a side-effect of accumulating `spread`.
  function writes(target, spread, update, enter, exit) {
    update = update || id;
    enter = enter || id;
    exit = exit || id;
    return accumulatable(function accumulatewrite(next, initial) {
      target = enter(target);
      accumulate(spread, function nextWrite(accumulated, item) {
        if (item === end) exit(target);
        else update(target, item);
        // Accumulate with updated target. Note that this is simply a reference
        // to `target`. Target will mutate and can't be counted on as a value.
        return next(accumulated, item);
      }, initial);
    });
  }
  exports.writes = writes;

  function model(spread, derive, state) {
    return hub(accumulatable(function accumulateModel(next, initial) {
      accumulate(spread, function (accumulated, item) {
        var derived = derive(state, item);
        // If derived state is empty, skip accumulation.
        return !isNullish(derived) ? next(accumulated, derived) : accumulated;
      }, initial);
    }));
  }
  exports.model = model;

  // Transform a spread using on/off state.
  function modal(spread, open, close, update, enter, exit) {
    // Make sure to hub returned accumulatable! This is state-based, so we need
    // to make sure multiple accumulation doesn't mess state up.
    return hub(accumulatable(function accumulateMovement(next, initial) {
      var accumulated = initial;

      accumulate(spread, function (isOpen, item) {
        if (!isOpen) {
          isOpen = open(item);
          if (!isOpen) return false;
          item = enter(item);
        }
        else {
          isOpen = !close(item);
          item = isOpen ? update(item) : exit(item);
        }

        accumulate(item, function (_, item) {
          if (item !== end) accumulated = next(accumulated, item);
        });

        return isOpen;
      }, false);
    }));
  }
  exports.modal = modal;

  function enterMovement() {
    return 0;
  }

  function movement(touches, threshold, calc, vel) {
    function isClosed(event) {
      // If event is stop, event is closed.
      if (isEventStop(event)) return true;
      // Has distance passed threshold? finish movement.
      return calc(event) > threshold;
    }

    function exit(event) {
      // Extrapolate the remaining distance into animation frames containing
      // coords.
      // The the fraction of the screen we've traversed from bottom.
      var f = calc(event);
      var v = vel(event);
      // Find the number of `v` we'll need to add to `f` in order to go from
      // `f` to 1.
      // Divide by zero error?
      var n = Math.ceil((1 - f) / v);

      // @TODO should reductions be passed through hub()?
      return reductions(frames(n), function (f) {
        var t = f + v;
        return (t > 1) ? 1 : t;
      }, f);
    }

    return modal(
      touches,
      isEventMove,
      isClosed,
      calc,
      enterMovement,
      exit
    );
  }
  exports.movement = movement;

  return exports;
});

define('animation', function (require, exports) {
  var a = require('accumulators');
  var on = a.on;
  var accumulatable = a.accumulatable;
  var accumulate = a.accumulate;
  var merge = a.merge;
  var end = a.end;

  var writes = require('view').writes;

  function setAnimation_(element, name, duration, easing, iterations) {
    // Set up animation styles.
    element.style.animationName = name;
    element.style.animationDuration = duration + 'ms';
    element.style.animationIterationCount = (iterations === Infinity) ? 'infinite' : iterations;
    element.style.animationEasing = easing;
    return element;
  }

  function exitAnimation_(element) {
    // Tear down animation styles.
    element.style.animationName = '';
    element.style.animationDuration = '';
    element.style.animationIterationCount = '';
    element.style.animationEasing = '';
    return element;
  }

  function onAnimationEvents(element) {
    return accumulatable(function accumulateAnimationEvents(next, initial) {
      var events = on(element, 'animationend');

      accumulate(events, function nextAnimationEvent(accumulated, event) {
        accumulated = next(accumulated, event);
        // End listener as soon as animationend event comes through.
        next(accumulated, end);
        return end;
      }, initial);
    });
  }

  // Animate an element using a CSS keyframe animation. Returns an accumulatable
  // spread good for the start, update and end events of the animation.
  function animation(element, name, duration, easing, iterations) {
    // Default number of iterations is 1.
    iterations = iterations > 1 ? iterations : 1;
    duration = duration > 0 ? duration : 0;
    easing = easing || 'linear';

    // create spread of animation events.
    var anim = onAnimationEvents(element);

    function enterAnimation_(element) {
      // Set animation on element, kicking it off.
      return setAnimation_(element, name, duration, easing, iterations);
    }

    return writes(element, anim, null, enterAnimation_, exitAnimation_);
  }
  exports.animation = animation;

  function build(name, enter, exit) {
    function animateBuild(element, duration, easing) {
      var anim = animation(element, name, duration, easing);
      return writes(element, anim, null, enter, exit);
    }
    return animateBuild;
  }
  exports.build = build;

  function enterScaleIn(target) {
    target.style.display = 'block';
    target.style.opacity = '0';
    return target;
  }

  function exitScaleIn(target) {
    target.style.opacity = '1';
    return target;
  }

  var scaleIn = build('scale-in', enterScaleIn, exitScaleIn);
  exports.scaleIn = scaleIn;

  function exitScaleOut(target) {
    target.style.display = 'none';
    return target;
  }

  var scaleOut = build('scale-out', null, exitScaleOut);
  exports.scaleOut = scaleOut;

  function enterFadeIn(element) {
    element.style.display = 'block';
    element.style.opacity = '0';
    return element;
  }

  function exitFadeIn(element) {
    element.style.opacity = '1';
    return element;
  }

  var fadeIn = build('fade-in', enterFadeIn, exitFadeIn);
  exports.fadeIn = fadeIn;

  function enterFadeOut(element) {
    element.style.display = 'block';
    element.style.opacity = '1';
    return element;
  }

  function exitFadeOut(element) {
    element.style.display = 'none';
    return element;
  }

  var fadeOut = build('fade-out', enterFadeOut, exitFadeOut);
  exports.fadeOut = fadeOut;

  return exports;
});

define('helpers', function (require, exports) {
  var a = require('accumulators');
  var accumulate = a.accumulate;
  var id = a.id;
  var hub = a.hub;

  // Cause a spread to begin accumulation. Log each item along the way.
  // Returns no value.
  function print(spread) {
    accumulate(spread, function nextPrint(_, item) {
      console.log(item);
    });
  }
  exports.print = print;

  // Cause a spread to begin accumulation. Returns no value.
  function go(spread) {
    accumulate(spread, id);
  }
  exports.go = go;

  function pluck(spread, key) {
    return map(spread, function toPluckedKey(object) {
      return object[key];
    });
  }
  exports.pluck = pluck;

  // Filter items in stream by comparing adjacent items using using function
  // `assert` to compare.
  //
  // Returns a new spread of items that pass `assert`.
  function asserts(spread, assert) {
    return hub(accumulatable(function accumulateFilterAdjacent(next, initial) {
      var accumulated = initial;
      accumulate(spread, function nextAssert(left, right) {
        if (right === end) next(accumulated, end);
        else if (assert(left, right)) accumulated = next(accumulated, right);

        // Right becomes new left for nextAssert.
        return right;
      }, null);
    }));
  }
  exports.asserts = asserts;

  // Are 2 things not equal?
  function isDifferent(thing0, thing1) {
    return thing0 !== thing1;
  }
  exports.isDifferent = isDifferent;

  // Drop adjacent repeats from spread.
  function dropRepeats(spread) {
    return asserts(spread, isDifferent);
  }
  exports.dropRepeats = dropRepeats;

  function sync(spread, trigger) {
    return dropRepeats(sample(spread, trigger));
  }
  exports.sync = sync;

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
var concat = a.concat;
var reductions = a.reductions;
var accumulatable = a.accumulatable;
var accumulate = a.accumulate;
var end = a.end;
var id = a.id;
var isNullish = a.isNullish;
var frames = a.frames;

var helpers = require('helpers');
var print = helpers.print;
var go = helpers.go;
var asserts = helpers.asserts;

var dom = require('dom');
var $ = dom.$;
var $$ = dom.$$;
var hasClass = dom.hasClass;
var addClass = dom.addClass;
var removeClass = dom.removeClass;
var hasTouches = dom.hasTouches;
var withTargetId = dom.withTargetId;
var withId = dom.withId;
var withClass = dom.withClass;
var withTargetClass = dom.withTargetClass;

var v = require('view');
var write = v.write;
var movement = v.movement;
var model = v.model;

var anim = require('animation');
var animation = anim.animation;
var scaleOut = anim.scaleOut;
var fadeIn = anim.fadeIn;
var scaleIn = anim.scaleIn;
var fadeOut = anim.fadeOut;

function withValue(v) {
  function isValue(thing) {
    return thing === v;
  }
  return isValue;
}

function withRange(a, b) {
  function between(thing) {
    return thing > a && thing < b;
  }
  return between;
}

// Normalize a number `x` such that if less than `a`, will return `a`, and
// if greater than `b`, `b`.
function bound(x, a, b) {
  return Math.max(Math.min(x, b), a);
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

// Iterate over an indexed object using `length`, returning the reduced value.
function reduceIndexed(indexed, next, initial) {
  var accumulated = initial;
  for (var i = 0; i < indexed.length; i += 1)
    accumulated = next(accumulated, indexed[i]);
  return accumulated;
}

// Return x if x is not nullish, y otherwise.
// Useful for fallback values.
function maybe(x, y) {
  return isNullish(x) ? y : x;
}

function getTouchById(touchList, touch) {
  return touchList && touchList.identifiedTouch ?
    touchList.identifiedTouch(touch.identifier) : null;
}

// Augment a single touch object, determined by the `indentifier` of
// `prevTouch`. Used by `augmentTouches_`.
function augmentTouch_(currTouchEvent, prevTouch) {
  var currTimeStamp = currTouchEvent.timeStamp;
  // Get current touch from `changedTouches`. This ensures we only mutate
  // touches that need to be updated.
  var changedTouch = getTouchById(currTouchEvent.changedTouches, prevTouch);

  if (changedTouch && isEventStart(currTouchEvent)) {
    // Previous position is same as current position for start events.
    changedTouch.prevScreenX = changedTouch.screenX;
    changedTouch.origScreenX = changedTouch.screenX;

    changedTouch.prevScreenY = changedTouch.screenY;
    changedTouch.origScreenY = changedTouch.screenY;

    changedTouch.timeStamp = currTimeStamp;
    changedTouch.prevTimeStamp = currTimeStamp;
    changedTouch.origTimeStamp = currTimeStamp;
  }
  // For move events, update coords via prev.
  else if (changedTouch && isEventMove(currTouchEvent)) {
    // prevScreenX is screenX of prevTouch. Fall back to current screenX,
    // in case we don't have a previous (can happen when augmenting moves w/o
    // start events).
    changedTouch.prevScreenX = maybe(prevTouch.screenX, changedTouch.screenX);
    changedTouch.origScreenX = maybe(prevTouch.origScreenX, changedTouch.screenX);

    changedTouch.prevScreenY = maybe(prevTouch.screenY, changedTouch.screenY);
    changedTouch.origScreenY = maybe(prevTouch.origScreenY, changedTouch.screenY);

    changedTouch.timeStamp = currTimeStamp;
    changedTouch.prevTimeStamp = maybe(prevTouch.timeStamp, currTimeStamp);
    changedTouch.origTimeStamp = maybe(prevTouch.origTimeStamp, currTimeStamp);
  }
  // In the case of "stop" events, `changedTouches` means touches that have
  // left the screen.
  else if (changedTouch && isEventStop(currTouchEvent)) {
    // Because the screen coords will be the same for these
    // touches as the touches of the last touch event, we want to grab prev coords
    // from the previous touch.
    //
    // prevScreenX is prevScreenX of prevTouch. Fall back to current screenX.
    changedTouch.prevScreenX = maybe(prevTouch.prevScreenX, changedTouch.screenX);
    changedTouch.origScreenX = maybe(prevTouch.origScreenX, changedTouch.screenX);

    changedTouch.prevScreenY = maybe(prevTouch.prevScreenY, changedTouch.screenY);
    changedTouch.origScreenY = maybe(prevTouch.origScreenY, changedTouch.screenY);

    changedTouch.timeStamp = currTimeStamp;
    changedTouch.prevTimeStamp = maybe(prevTouch.prevTimeStamp, currTimeStamp);
    changedTouch.origTimeStamp = maybe(prevTouch.origTimeStamp, currTimeStamp);
  }

  return currTouchEvent;
}

// Augment a list of touches in `currTouchEvent`. Used by `augmentTouchEvents`.
function augmentTouches_(prevTouchEvent, currTouchEvent) {
  // Pick touchlist we're going to iterate over. If we have no previous touch
  // event, we'll iterate over the current set of touches, so they have
  // initial values. In all other cases, we want to iterate over the
  // previous touches so as to compare them with current touches and derive
  // what has changed.
  var touches = isNullish(prevTouchEvent) ?
    currTouchEvent.touches : prevTouchEvent.touches;

  // Mutate current touch events, then return list of touches to become next
  // `prevTouchEvent`.
  return reduceIndexed(touches, augmentTouch_, currTouchEvent);
}

// Mutate touches in a spread of touch events, adding properties that allow
// for velocity verlet calculations.
//
// * prevScreenX
// * prevScreenY
//
// @TODO augment with prevTimeStamp to allow for velocity verlet calculation.
// @TODO augment touch with uniqueIdentifier
function augmentTouchEvents(touchEvents) {
  // It is important that reductions() use hub() here, or multiple reductions
  // of source will cause `prevTouchEvent` to be incorrect.
  return hub(reductions(touchEvents, augmentTouches_, null));
}

// Filter tap cycles, determining if a swipe distance was moved during cycle.
function isTap(event) {
  var firstTouch = event.changedTouches[0];
  return (
    (firstTouch.screenX - firstTouch.prevScreenX) === 0 &&
    (firstTouch.screenY - firstTouch.prevScreenY) === 0
  );
}

// Create a predicate function to determine if given event has `n` changed
// touches.
function withFingers(n) {
  function isTouchEventWithNFingers(event) {
    return event && event.changedTouches && event.changedTouches.length === n;
  }
  return isTouchEventWithNFingers;
}

function haltEvent_(event) {
  event.stopPropagation();
  if (!event.defaultPrevented) event.preventDefault();
  return event;
}

function isTruthy(thing) {
  return !!thing;
}

var is0 = withValue(0);
var is1 = withValue(1);
var isBetween0And1 = withRange(0, 1);

function app(window) {
  // Contains references to elements we'll be writing to. Also a repository
  // for shared state.
  var state = {
    sys_keyboard: $$('sys-fake-keyboard'),
    rb_overlay: $$('rb-overlay'),
    rb_rocketbar: $$('rb-rocketbar'),
    rb_cancel: $$('rb-cancel'),
    tm_task_manager: $$('tm-task-manager'),
    sh_head: $$('sh-sheet-000000'),
    set_panel: $$('set-settings'),
    set_overlay: $$('set-overlay'),
    body: $$('sys-screen'),
    hs_homescreen: $$('hs-homescreen'),
    sys_bottom_edge: $$('sys-gesture-panel-bottom')
  };

  // Listen for touch events.
  var touchstarts = on(window, 'touchstart');
  var touchmoves = on(window, 'touchmove');
  var touchends = on(window, 'touchend');
  var touchcancels = on(window, 'touchcancel');
  var touchEvents = merge([touchstarts, touchmoves, touchcancels, touchends]);
  var augTouchEvents = augmentTouchEvents(touchEvents);
  var augTouchstops = filter(augmentTouchEvents, isEventStop);

  var bottomEdgeTouchEvents = filter(augTouchEvents, withTargetId('sys-gesture-panel-bottom'));
  var bottomEdgeSingleTouchEvents = filter(bottomEdgeTouchEvents, withFingers(1));
  var bottomEdgeSingleDrags = reject(bottomEdgeSingleTouchEvents, isEventStart);

  var bottomEdgeMovements = movement(bottomEdgeSingleDrags, 0.8, function (event) {
    var n = event.changedTouches[0].screenY;
    return (screen.height - n) / screen.height;
  }, function (event) {
    var touch = event.changedTouches[0];
    var dist = Math.abs(touch.screenY - touch.prevScreenY);
    // Our fractional velocity.
    return bound(dist / screen.height, 0.02, 0.05);
  });

  var toHomeMoveEnters = filter(bottomEdgeMovements, is0);
  var toHomeMoveUpdates = filter(bottomEdgeMovements, isBetween0And1);
  var toHomeMoveExits = filter(bottomEdgeMovements, is1);

  var rbTouchEvents = filter(augTouchEvents, withTargetId('rb-rocketbar'));
  var rbDrags = reject(rbTouchEvents, isEventStart);

  var toRbDrags = model(rbDrags, function (rbEl, event) {
    // If rocketbar is expanded, skip this drag. Otherwise, halt event, we're
    // going to handle it as a drag.
    return (hasClass(rbEl, 'js-expanded')) ?
      null : haltEvent_(event);
  }, state.rb_rocketbar);

  var rbTouchstops = filter(rbTouchEvents, isEventStop);
  // Taps on RocketBar are any swipe that covers very little ground.
  var rbTaps = filter(rbTouchstops, isTap);

  var rbMovements = movement(toRbDrags, 0.8, function (event) {
    var n = event.changedTouches[0].screenY;
    return n / screen.height;
  }, function (event) {
    var touch = event.changedTouches[0];
    var dist = Math.abs(touch.screenY - touch.prevScreenY);
    // Our fractional velocity.
    return bound(dist / screen.height, 0.03, 0.05);
  });
  var toModeTaskManagerEnters = filter(rbMovements, is0);
  var toModeTaskManagerExits = filter(rbMovements, is1);
  var toModeTaskManagerUpdates = filter(rbMovements, isBetween0And1);

  var rbCancelTouchstarts = filter(touchstarts, withTargetId('rb-cancel'));

  var rbOverlayTouchstarts = filter(touchstarts, withTargetId('rb-overlay'));

  var rbBlurs = merge([rbCancelTouchstarts, rbOverlayTouchstarts]);

  var setIconTouchstops = filter(touchstarts, withTargetId('rb-icons'));
  var setOverlayTouchstarts = filter(touchstarts, withTargetId('set-overlay'));
  var setEvents = merge([setIconTouchstops, setOverlayTouchstarts]);
  // Derive settings panel state.
  var setToggles = model(setEvents, function (setPanelEl, event) {
    haltEvent_(event);
    return setPanelEl.style.display === 'none';
  }, state.set_panel);
  var setClose = reject(setToggles, isTruthy);
  var setOpen = filter(setToggles, isTruthy);

  var hsKitTouchstarts = filter(touchstarts, withTargetId('hs-kitsilano-hotzone'));

  // @TODO this obviously only works when we only have one sheet in task
  // manager.
  var headSheetTouchstarts = filter(touchstarts, withTargetClass('sh-cover'));

  write(state, rbTaps, function (els, event) {
    addClass(els.rb_rocketbar, 'js-expanded');
    addClass(els.sys_keyboard, 'js-activated');
    removeClass(els.rb_cancel, 'js-hide');
    removeClass(els.rb_overlay, 'js-hide');
  });

  write(state, rbBlurs, function updateBlurRocketbar(els, event) {
    event = haltEvent_(event);
    removeClass(els.sys_keyboard, 'js-activated');
    addClass(els.rb_cancel, 'js-hide');
    addClass(els.rb_overlay, 'js-hide');

    // Collapse (or not) per current task manager status.
    if (els.body.dataset.mode !== 'tm_task_manager')
      removeClass(els.rb_rocketbar, 'js-expanded');
  });

  write(state, toModeTaskManagerEnters, function (els, f) {
    addClass(els.rb_rocketbar, 'js-transition');
    addClass(els.sh_head, 'js-transition');
  });

  write(state, toModeTaskManagerExits, function (els, f) {
    removeClass(els.rb_rocketbar, 'js-transition');
    addClass(els.rb_rocketbar, 'js-expanded');
    els.rb_rocketbar.style.height = '';
    // @TODO could probably do this via a modal class on the body element.
    // One less element to manage.
    removeClass(els.sh_head, 'js-transition');
    addClass(els.sh_head, 'sh-scaled');
    els.sh_head.style.transform = '';
    els.body.dataset.mode = 'tm_task_manager';
  });

  write(state, toModeTaskManagerUpdates, function (els, f) {
    var translate = -40 * f;
    var height = 30 * f;
    els.sh_head.style.transform = 'translateZ(' + translate + 'px)';
    els.rb_rocketbar.style.height = (20 + height) + 'px';
  });

  write(state, headSheetTouchstarts, function (els, event) {
    els.body.dataset.mode = 'sh_sheet';
    removeClass(els.sh_head, 'sh-scaled');
    removeClass(els.rb_rocketbar, 'js-expanded');
  });

  write(state, setClose, function updateSetPanelClose(els, event) {
    els.set_panel.style.display = 'none';
    els.set_overlay.style.display = 'none';
  });

  write(state, setOpen, function updateSetPanelOpen(els, event) {
    els.set_panel.style.display = 'block';
    els.set_overlay.style.display = 'block';
  });

  write(state, toHomeMoveEnters, function (els, f) {
    els.hs_homescreen.style.display = 'block';
    addClass(els.tm_task_manager, 'js-transition');
  });

  write(state, toHomeMoveExits, function (els, f) {
    els.body.dataset.mode = 'hs_homescreen';
    els.tm_task_manager.style.transform = '';
    els.tm_task_manager.style.opacity = '';
    els.tm_task_manager.style.display = 'none';
    els.sys_bottom_edge.display = 'none';
    removeClass(els.tm_task_manager, 'js-transition');
  });

  write(state, toHomeMoveUpdates, function (els, f) {
    var translate = -1500 * (f * f);
    var opacity = 1 - f;
    els.tm_task_manager.style.transform = 'translateZ(' + translate + 'px)';
    els.tm_task_manager.style.opacity = opacity;
  });

  write(state, hsKitTouchstarts, function (els, event) {
    haltEvent_(event);

    els.body.dataset.mode = 'sh_sheet';

    els.sys_bottom_edge.display = 'block';

    go(concat([
      fadeOut(els.hs_homescreen, 600, 'linear'),
      scaleIn(els.tm_task_manager, 800, 'ease-out')
    ]));
  });
}

app(window);
