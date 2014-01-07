// Accumulators
// =============================================================================
//
// A tiny library for reactive programming that offers blazing fast generic
// collection manipulation, asyncronous flow control and the ability to
// represent infinitely large collections.
//
// Copyright Gordon Brander, 2013. Released under the terms of the [MIT license](http://opensource.org/licenses/MIT).
//
// Background:
//
// * [Reducers - A Library and Model for Collection Processing](http://clojure.com/blog/2012/05/08/reducers-a-library-and-model-for-collection-processing.html)
// * [Anatomy of a Reducer](http://clojure.com/blog/2012/05/15/anatomy-of-reducer.html)
//
// Prior art:
//
// * https://github.com/Gozala/reducers/
// * https://github.com/Gozala/reducible/
//
// What & How
// ----------
//
// This file is just a tiny JavaScript implementation of [Clojure Reducers](http://clojure.com/blog/2012/05/08/reducers-a-library-and-model-for-collection-processing.html).
//
// Reducers are an answer to the question: "what is the minimum necessary
// interface for a collection?". A collection is anything that can be
// `reduce`d, because `reduce` can produce any other value from a collection.
// In JS, we might say a collection is any object with a `reduce` method.
// This simple idea has _awesome_ consequences...
//
// With such a small interface, custom collection types can be created simply by
// defining a method called `reduce` that describes how to step through the
// collection and accumulate a value. Want to mix a typed array and a linked
// list? No problem. Simply define a `reduce` for each and mix away.
//
// What about `map`, `filter`, `concat` and friends? We can define them
// as function transformations of the _reducer_ function (the function you
// give to `reduce` describing the recipe for reduction). `map`, `filter`, et al
// will actually return a transformed function instead of an array. The work is
// done when we pass the resulting function to `reduce`. This has the happy
// effect of making large collection manipulations very fast because no
// intermediate representation of the collection is created in memory.
//
// The _reducer_ function can be called at any time by `reduce`, so if we take
// away the requirement for `reduce` to return a value, we can even represent
// _asyncronous_ collections. In this library, we call a `reduce` that returns
// no value `accumulate`.
//
// Why would we want to do this?
//
// * If items can appear during multiple turns of the event loop, you can
//   represent _infinitely long streams_.
// * An async collection can be used to control a flow of events, because
//   after all, events are just a sequence of "things over time". So:
//   we can program in the 4th dimension, mapping, filtering
//   and transforming events over time.
//
// Pretty useful. So an accumulable is any object that implements a special
// `accumulate()` method, which is the same as `reduce()`, but is not required
// to return a value. If the object doesn't have an accumulate method, we fall
// back to `reduce` (e.g. arrays or Backbone collections).


// Define a closure to contain our module.
function accumulators(_, exports) {
  // The basics
  // ----------
  //
  // The base implementation: helpers for defining and
  // duck-typing accumulatables, and an `accumulate` function.
  //
  // ---

  // An `accumulatable` is any object with an `accumulate()` method.
  // Creates a new accumulatable by assigning the `accumulate()` method to
  // an object `o`.
  //
  // The mechanics of _how_ the accumulation happens are left up to the
  // `accumulate` method.
  //
  // `accumulate` takes the same arguments as `reduce` method, but it is not
  // expected to return a value.
  //
  //     function accumulate(next, initial) { ... }
  //
  // ...where `next` is a reducer function -- a function with shape:
  //
  //     function next(accumulated, item) { ... }
  //
  // Accumulatables are just a series of calls to `next` within
  // `accumulate` method.
  //
  // Because `accumulate` is not expected to return a value, calls to `next` by
  // accumulate may happen over multiple turns of the event loop, allowing
  // accumulation of async sources to happen.
  //
  // Since accumulate does not return a value, we use a special `end` token to
  // denote the end of a sequence (see below).
  function accumulatable(accumulate, o) {
    // Use optional provided object, or create a new one.
    o = o || {};
    // Assign accumulate function to the `accumulate` field.
    o.accumulate = accumulate;
    return o;
  }
  exports.accumulatable = accumulatable;


  // Determine if `thing` has a function at `key`.
  // Returns boolean.
  function isMethodAt(thing, key) {
    return thing && typeof thing[key] === 'function';
  }
  exports.isMethodAt = isMethodAt;


  // Determine if `thing` is null-ish (uses non-strict comparison).
  function isNullish(thing) {
    return thing == null;
  }
  exports.isNullish = isNullish;


  // End is our token that represents the end of an accumulatable.
  // `accumulatable`s can pass this token as the last item to denote they are
  // finished sending values. Accumulating `next` functions may also return `end`
  // to denote they are finished consuming, and that no further values should
  // be sent.
  var end = 'Token for end of accumulation';
  exports.end = end;


  // Accumulate any value with a `next` accumulating function and
  // `initial` value.
  //
  // Any value type can be accumulated with `accumulate` function:
  // accumulatables, arrays, primitive values... We use the general nickname
  // `spread` to mean 0 or more values that are ended with `end` token.
  //
  // Accumulate does not return any value, meaning spreads may yield values at
  // any turn of the event loop.
  function accumulate(spread, next, initial) {
    // If spread is accumulatable, call accumulate method.
    if(isMethodAt(spread, 'accumulate')) spread.accumulate(next, initial);
    // ...otherwise, if spread has a reduce method, fall back to accumulation
    // with reduce, then call `next` with `end` token and result of reduction.
    // Reducible spreads are expected to return a value for `reduce`.
    else if (isMethodAt(spread, 'reduce')) next(spread.reduce(next, initial), end);
    // ...otherwise, if spread is nullish, end. `null` is considered to be
    // an empty spread (akin to an empty array). This approach takes
    // inspiration from Lisp dialects, where `null` literally _is_ an empty
    // list. It also just makes sense: `null` is a non-value, and should
    // not accumulate.
    else if (isNullish(spread)) next(initial, end);
    // ...otherwise, call `next` with value, then `end`. I.e, values
    // without a `reduce`/`accumulate` method are treated as a spread
    // containing one item.
    else next(next(initial, spread), end);
  }
  exports.accumulate = accumulate;


  // Transformations: map, filter, et al
  // -----------------------------------


  // Convenience function to simplify definitions of transformation function, to
  // avoid manual definition of `accumulatable` results and currying transformation
  // function.
  //
  // From a pure data `xf` function that is called on each value for a
  // collection with following arguments:
  //
  // 1. `additional` - Options passed to the resulting transformation function
  // most commonly that's a function like in `map(spread, f)`.
  // 2. `next` - Function which needs to be invoked with transformed value,
  // or simply not called to skip the value.
  // 3. `accumulated` - Accumulate value.
  // 4. `item` - Last value emitted by a collection being accumulated.
  //
  // Function is supposed to return new, accumulated `result`. It may either
  // pass mapped transformed `value` and `result` to the `next` continuation
  // or skip it.
  //
  // For example see `map` and `filter` functions.
  //
  // A riff on reducer in https://github.com/clojure/clojure/blob/master/src/clj/clojure/core/reducers.clj.
  function accumulator(xf) {
    function xformed(spread, additional) {
      // Return a new accumulatable object who's accumulate method transforms the `next`
      // accumulating function.
      return accumulatable(function accumulateXform(next, initial) {
        // `next` is the accumulating function we are transforming. 
        accumulate(spread, function nextInSpread(accumulated, item) {
          // We are essentially wrapping next with `xf` provided the `item` is
          // not `end`.
          return item === end ? next(accumulated, item) :
                                xf(additional, next, accumulated, item);
        }, initial);
      });
    }

    return xformed;
  }
  exports.accumulator = accumulator;


  // Returns an accumulatable transformed version of given `spread` where each
  // item in spread is mapped using `f`.
  //
  //     var data = [{ name: "foo" }, { name: "bar" }]
  //     map(data, function(item) { return item.name })
  //     >> <"foo", "bar", end>
  var map = accumulator(function mapTransform(mapper, next, accumulated, item) {
    return next(accumulated, mapper(item));
  });
  exports.map = map;


  // Composes filtered version of given `spread`, such that only items contained
  // will be once on which `predicate(item)` was `true`.
  //
  //     filter([ 10, 23, 2, 7, 17 ], function(value) {
  //       return value >= 0 && value <= 9
  //     })
  //     >> <2, 7, end>
  var filter = accumulator(function filterTransform(predicate, next, accumulated, item) {
    return predicate(item) ? next(accumulated, item) : accumulated;
  });
  exports.filter = filter;


  // The opposite of `filter()`. Returns a filtered accumulatable that contains
  // only items for which `predicate(item)` was `false`. Useful for splitting
  // a spread into 2 parts with the same predicate function.
  var reject = accumulator(function rejectTransform(predicate, next, accumulated, item) {
    return !predicate(item) ? next(accumulated, item) : accumulated;
  });
  exports.reject = reject;


  function take(spread, n) {
    // Returns sequence of first `n` items of the given `spread`.
    //
    //     take([ 1, 2, 3, 4, 5 ], 2))
    //     >> <1, 2, end>
    //
    //     take([ 1, 2, 3 ], 5))
    //     >> <1, 2, 3, end>

    // Bypass hot code path if we're not taking any items.
    // This takes advantage of the rather dubious type casting
    // that `<` does. Any falsey value will compare as less than 1.
    // `null` is considered to be an empty spread by `accumulate()`.
    if (n < 1) return null;

    return accumulatable(function accumulateTake(next, initial) {
      // Capture `n`. We're about to mutate it.
      var count = n;

      accumulate(spread, function nextTake(accumulated, item) {
        // Decrement count.
        count = count - 1;

        // For cases where take has ended spread, but spread is still sending
        // values, keep returning `end` token and bypass accumulation.
        // Necessary for arrays. Most other spreads should know to `end` when
        // told to.
        if (count < 0) return end;

        // Accumulate with value.
        accumulated = next(accumulated, item);

        // Return accumulated value, or `end` spread if we've reached the limit.
        return count === 0 ? next(accumulated, end) : accumulated;
      }, initial);
    });
  }
  exports.take = take;


  function drop(spread, n) {
    // Returns sequence of all `spread`'s items after `n`-th one. If spread
    // contains less then `n` items empty sequence is returned.

    // Don't need to do anything if n is less than one.
    if (n < 1) return spread;

    // Don't forget to drop everything if `n` is infinity.
    // `null` is considered to be an empty spread by `accumulate()`.
    if (n === Infinity) return null;

    return accumulatable(function accumulateDrop(next, initial) {
      // Capture `n`. We're about to mutate it.
      var  count = n;

      accumulate(spread, function nextDrop(accumulated, item) {
        // If we've dropped enough items, or spread is ended, call next with
        // accumulation and item.
        if (count === 0 || item === end) return next(accumulated, item);

        count = count - 1;

        // Otherwise return accumulation for later (drop this iteration).
        return accumulated;
      }, initial);
    });
  }
  exports.drop = drop;


  // Transform a spread, reducing values from the spread's `item`s using `xf`, a
  // reducer function. Returns a new accumulatable spread containing the
  // reductions for each step.
  //
  // @TODO return accumulatable for reductions should probably always be
  // transformed with `hub()`.
  function reductions(spread, xf, initial) {
    var reduction = initial;

    return accumulatable(function accumulateReductions(next, initial) {
      // Define a `next` function for accumulation.
      function nextReduction(accumulated, item) {
        return item === end ?
          next(accumulated, end) :
          // If item is not `end`, update state of reduction and accumulate
          // with it.
          next(accumulated, reduction = xf(reduction, item));
      }

      accumulate(spread, nextReduction, initial);
    });
  }
  exports.reductions = reductions;


  // Combining spreads
  // -----------------


  // Given 2 spreads, `left` and `right`, return a new accumulatable which will
  // first accumulate `left`, then `right`. Used by `concat`.
  function append(left, right) {
    return accumulatable(function accumulateAppend(next, initial) {
      function nextLeft(accumulated, item) {
        return item === end ? accumulate(right, next, accumulated) : next(accumulated, item);
      }

      accumulate(left, nextLeft, initial);
    });
  }
  exports.append = append;


  // Concatenate a 2D spread of spreads, returning a new accumulatable 1D spread
  // where items are ordered by source order.
  //
  //     concat([[1, 2, 3], ['a', 'b', 'c']])
  //     >> <1, 2, 3, 'a', 'b', 'c', end>
  //
  // @TODO if consumer returns end, concat should end current spread and stop
  // accumulating future spreads.
  function concat(spread) {
    return accumulatable(function accumulateConcat(next, initial) {
      function nextAppend(a, b) {
        if(b === end) return accumulate(a, next, initial);

        return a === null ? b : append(a, b);
      }

      accumulate(spread, nextAppend, null);
    });
  }
  exports.concat = concat;


  // Merge a 2D spread of spreads, returning a new accumulatable 1D spread,
  // where items are ordered by time. In pseudo-code:
  //
  //     merge(<<1, 2, 3>, <'a', 'b', 'c'>>)
  //     >> <1, 'a' 2, 3, 'b', 'c', end>
  //
  // @TODO if consumer returns end, merge should end all spreads it subsumes.
  function merge(spread) {
    return accumulatable(function accumulateMerge(next, initial) {
      // We use a closure variable to keep track of accumulation because
      // multiple spreads will be accumulated using the same
      // accumulator.
      var accumulated = initial;
      var open = 1;

      function forward(_, item) {
        if (item === end) {
          open = open - 1;
          if (open === 0) return next(accumulated, end);
        }
        else {
          accumulated = next(accumulated, item);
        }
        return accumulated;
      }

      accumulate(spread, function nextMerge(_, nested) {
        // If we have reached the end of the spreads, reduce our open count by
        // one (the spread of spreads is no longer open).
        if (nested === end) {
          open = open - 1;
        }
        else {
          // If `nested` item is not end, accumulate it via `forward` and record
          // that we have opened another spread.
          open = open + 1;
          accumulate(nested, forward, null);
        }
      }, null);
    });
  }
  exports.merge = merge;


  // Given any `thing`, returns `thing`. Useful for fallback.
  function id(thing) {
    return thing;
  }
  exports.id = id;


  // Sample the most recent item from `spread` every time an item appears in
  // `triggers` spread. For example, sampling mousemove events that coencide
  // with click events looks like this:
  //
  //     sample(on(el, 'mousemove'), on(el, 'click'))
  //
  // Useful for accumulatable spreads where items appear over multiple turns of
  // the event loop.
  //
  // Returns an accumulatable spread of sampled values.
  function sample(spread, triggers, assemble) {
    return accumulatable(function accumulateSamples(next, initial) {
      // Assemble is a function that will be called with sample and trigger item.
      // You may specify a sample function. If you don't it will fall back to `id`
      // which will return the value of the sampled item.
      assemble = assemble || id;

      // Create closure variable to keep most recent sample.
      var sampled;

      function nextInSpread(_, item) {
        // Assign most recent item to closure variable.
        if(item !== end) sampled = item;
      }

      function nextTrigger(accumulated, item) {
        // Assemble sampled value with item and accumulate with `next()`.
        return next(accumulated, assemble(sampled, item));
      }

      // Begin accumulation of both spreads.
      accumulate(spread, nextInSpread);
      accumulate(triggers, nextTrigger, initial);
    });
  }
  exports.sample = sample;


  // Other helpers
  // -------------


  // Internal helper function that mutates a consumer object.
  // Used in `hub()` (see below).
  function dispatchToConsumer_(item, consumer) {
    // If consumer has not ended of its own accord, accumulate with
    // latest item.
    if (consumer.accumulated !== end)
      consumer.accumulated = consumer.next(consumer.accumulated, item);

    return item;
  }


  // Internal helper tallies the total number of closed consumer objects.
  function tallyClosedConsumers(count, consumer) {
    return consumer.accumulated === end ? count + 1 : count;
  }


  // Some spreads, like event streams, can only be accumulated once. Events in
  // the spread happen, but no reference is kept in memory by the spread. `hub()`
  // allows you to transform a spread of this type so it can be accumulated
  // multiple times. It does this by keeping a list of consumers and dispatching
  // items in spread to each of them. Usage:
  //
  //     hub(accumulatable(function (next, initial) { ... }))
  function hub(spread) {
    // Create array to keep track of consumers.
    var consumers = [];
    var state = 'initial';

    return accumulatable(function accumulateHub(next, initial) {
      // If spread has already ended, this accumulating function is late to
      // the party. Send `end` to let it know the spread no longer
      // contains values.
      if (state === 'ended') return accumulate(null, next, initial);

      // If accumulatable is not ended, add consumer to list.
      consumers.push({ next: next, accumulated: initial });

      // If hub is already open, return early. We don't need to reopen it.
      if (state === 'open') return;

      // Mark hub open.
      state = 'open';

      function nextDispatch(_, item) {
        // Since hub enables multiple accumulation on time-based spreads,
        // you should only use hub on accumulatable spreads that know how to
        // end themselves when all accumulating sources request it 
        //
        // If the spread has already ended or been ended by the consumers,
        // it shouldn't be sending any more values to `nextDispatch`.
        // Throw an error.
        if (state === 'ended') throw Error('Item sent after source ended');

        // When item comes from spread, dispatch it to all consumers.
        consumers.reduce(dispatchToConsumer_, item);

        // Then tally the consumers that have ended of their own volition.
        var closed = consumers.reduce(tallyClosedConsumers, 0);

        // As long as `item` is not `end` and the number of closed consumers
        // is less than the total number of consumers, return.
        if (item !== end && closed < consumers.length) return null;

        // Otherwise, we end the hub. Remove reference to consumers (@TODO
        // is this necessary to trigger GC?), set state to ended, return `end`.
        consumers = null;
        state = 'ended';
        return end;
      }

      // Begin accumulation of spread.
      accumulate(spread, nextDispatch, initial);
    });
  }
  exports.hub = hub;


  // Create an accumulator function from 2 functions: `next()`, an accumulator
  // that will be called for every value except `end`, and `last()`, another
  // accmulator that will only be called for `end`.
  function handleEnd(next, last) {
    // `last()` is optional. If no `last()` is specified, fall back to `id()`.
    last = last || id;
    function nextHandleEnd(accumulated, item) {
      return (item !== end) ? next(accumulated, item) : last(accumulated, end);
    }
    return nextHandleEnd;
  }
  exports.handleEnd = handleEnd;


  // Write to a target using `spread`. `update(target, value)`, `enter(target)`
  // and `exit(target)` describe how the target should be updated, as well as
  // how it should enter and exit the "stage".
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
  // Write has no return value.
  function write(target, spread, update, enter, exit) {
    update = update || id;
    enter = enter || id;
    exit = exit || id;

    target = enter(target);

    accumulate(spread, function nextWrite(_, item) {
      return item === end ? exit(target) : update(target, item);
    });
  }
  exports.write = write;


  // Create a write function with `update`, `enter`, `exit` functions partially
  // applied. Useful if you need to use many of the same kind of writes.
  //
  //     var html = writer(setInnerHtml, $);
  //     html('.foo', htmls);
  function writer(update, enter, exit) {
    function writeTo(target, spread) {
      write(target, spread, update, enter, exit);
    }
    return writeTo;
  }
  exports.writer = writer;


  // Browser helpers: animation, DOM events, etc
  // -------------------------------------------


  // A wrapper for [requestAnimationFrame][raf], patching up browser support and
  // preventing exceptions in non-browser environments (node).
  //
  // [raf]: https://developer.mozilla.org/en-US/docs/Web/API/window.requestAnimationFrame
  function requestAnimationFrame(callback) {
    // Use any available requestAnimationFrame.
    return (window.requestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            window.msRequestAnimationFrame)(callback);
  }


  // Get a stream of animation frames over time.
  // Returns an accumulatable for a stream of animation frames over time.
  // Each frame is represented by a framecount.
  function frames(ms) {
    return hub(accumulatable(function accumulateFrames(next, initial) {
      var accumulated = initial;
      var start = Date.now();

      function onFrame(now) {
        accumulated = next(accumulated, now);

        // If we have reached the ms count for frames, end the spread.
        if (ms && ((now - start) >= ms)) return next(accumulated, end);
        // If consumer ends spread, stop requesting frames.
        if (accumulated !== end) return requestAnimationFrame(onFrame);
      }

      requestAnimationFrame(onFrame);
    }));
  }
  exports.frames = frames;


  // Open a spread representing events over time on an element.
  // Returns an accumulatable spread.
  function on(element, type, useCapture) {
    // Since we want to avoid opening up multiple event listeners on the element,
    // we use `hub()` to allow for multiple reductions of one spread.
    return hub(accumulatable(function accumulateEventListener(next, initial) {
      // coerce useCapture to boolean. useCapture defaults to false when not
      // defined, per standard behavior.
      useCapture = !!useCapture;
      var accumulated = initial;

      function listener(event) {
        accumulated = next(accumulated, event);

        if (accumulated === end)
          // Remove event listener if consumer says its finished. Make sure
          // to include useCapture, because different values for useCapture
          // are considered different listeners.
          element.removeEventListener(type, listener, useCapture);
      }

      element.addEventListener(type, listener, useCapture);
    }));
  }
  exports.on = on;


  // An accumulatable wrapper for XHR requests. Handles all the ugly machinery
  // of making XMLHttpRequests. All parameters except `url` and `method` are
  // optional. Returns an accumulatable spread.
  //
  //     request('http://foo.com/x.json', 'GET');
  //     > <httpStatusCode, headers, body, end>
  //
  // Tip: use with drop to skip response code/headers, returning a spread
  // containing only response body:
  //
  //     drop(request('y.json', 'GET'), 2);
  //     > <body, end>
  //
  // <https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest>
  function request(url, method, body, headers, timeout, responseType, mimeType, credentials) {
    return hub(accumulatable(function accumulateXhr(next, initial) {
      var accumulated = initial;

      var req = new XMLHttpRequest();

      // Configure request properties.
      if (responseType) req.responseType = responseType;
      if (mimeType) req.overrideMimeType(mimeType);
      if (timeout) req.timeout = timeout;

      // Set any request headers. Headers are described using an object where key
      // is the header key and value is the header value.
      if (headers) for (var key in headers) req.setRequestHeader(key, headers[key]);

      function readyStateListener() {
        // readyState 2: 'send()' has been called, and headers and status are
        // available. Accumulate headers and status.
        if (this.readyState === 2) {
          accumulated = next(accumulated, this.status);
          accumulated = next(accumulated, this.getAllResponseHeaders());
        }
        // Otherwise, if accumulator ended spread during readyState 2, abort
        // request and clean up.
        else if (accumulated === end) {
          this.onreadystatechange = null;
          this.abort();
        }
        // readyState 4: response is complete. Handle our 2 end-of-spread
        // scenarios. If request was received and finished response, clean up.
        else if (this.readyState === 4) {
          // Remove pointer to callback.
          this.onreadystatechange = null;

          accumulated = next(accumulated, this.responseText);

          // Accumulate error if there was one.
          if (this.error) accumulated = next(accumulated, this.error);

          // End the spread.
          next(accumulated, end);
        }
      }

      // Attach listener. Note that all listeners must be attached before
      // issuing request.
      req.onreadystatechange = readyStateListener;

      // Make sure method is ALL CAPS to avoid browser bug footgun where lowercase
      // HTTP verbs prevent XHR success.
      method = method.toUpperCase();

      // Open request. If username and password were specified, configure xhr
      // object and pass those along.
      if (credentials) {
        req.withCredentials = true;
        req.open(method, url, true, credentials.username, credentials.password);
      }
      // Otherwise, open a request sans credentials.
      else {
        req.open(method, url, true);
      }

      // Send any data to the server.
      req.send(body);
    }));
  }
  exports.request = request;

  return exports;
}

var __modules__ = {};

function require(id) {
  var module = __modules__[id];

  if(!module) throw new Error('Module not yet defined');

  // Get the module's exports lazily (allows registration in any order as long
  // as main script entry point comes last).
  return __modules__[id] = (typeof(module) === 'function') ?
    module(require, {}) : module;
}

function define(id, factory) {
  if (__modules__[id]) throw new Error('Another module already has this name');
  __modules__[id] = factory;
}

define('accumulators', accumulators);

