"use strict";
module.exports = function(Promise, PromiseArray, apiRejection, cast) {
var util = require("./util.js");
var tryCatch3 = util.tryCatch3;
var errorObj = util.errorObj;
var PENDING = {};

function MappingPromiseArray(promises, fn, shouldPreserveValues) {
    this.constructor$(promises);
    this._callback = fn;
    this._preservedValues = shouldPreserveValues
                                        ? new Array(this.length())
                                        : null;
    this._init$(void 0, RESOLVE_ARRAY);
}
util.inherits(MappingPromiseArray, PromiseArray);

// The following hack is required because the super constructor
// might call promiseFulfilled before this.callback = fn is set
//
// The super constructor call must always be first so that fields
// are initialized in the same order so that the sub-class instances
// will share same memory layout as the super class instances

// Override
MappingPromiseArray.prototype._init = function MappingPromiseArray$_init() {};

// Override
MappingPromiseArray.prototype._promiseFulfilled =
function MappingPromiseArray$_promiseFulfilled(value, index) {
    var values = this._values;
    if (values === null) return;

    var length = this.length();
    if (values[index] === PENDING) {
        values[index] = value;
    }
    else {
        var preservedValues = this._preservedValues;
        if (preservedValues !== null) preservedValues[index] = value;

        var callback = this._callback;
        var receiver = this._promise._boundTo;
        var ret = tryCatch3(callback, receiver, value, index, length);
        if (ret === errorObj) return this._reject(ret.e);

        // If the mapper function returned a promise we simply reuse
        // The MappingPromiseArray as a PromiseArray for round 2.
        // To mark an index as "round 2" (where the callback must not be called
        // anymore), the marker PENDING is put at that index
        var maybePromise = cast(ret, void 0);
        if (maybePromise instanceof Promise) {
            if (maybePromise.isPending()) {
                values[index] = PENDING;
                return maybePromise._proxyPromiseArray(this, index);
            }
            else if (maybePromise.isFulfilled()) {
                ret = maybePromise.value();
            }
            else {
                return this._reject(maybePromise.reason());
            }
        }
        values[index] = ret;
    }
    var totalResolved = ++this._totalResolved;
    if (totalResolved >= length) {
        this._resolve(values);
    }
};

MappingPromiseArray.prototype.preservedValues =
function MappingPromiseArray$preserveValues() {
    return this._preservedValues;
};

function map(promises, fn, shouldPreserveValues) {
    return new MappingPromiseArray(promises, fn, shouldPreserveValues);
}

Promise.prototype.map = function Promise$map(fn) {
    if (typeof fn !== "function") return apiRejection(NOT_FUNCTION_ERROR);
    return map(this, fn, false).promise();
};

Promise.map = function Promise$Map(promises, fn) {
    if (typeof fn !== "function") return apiRejection(NOT_FUNCTION_ERROR);
    return map(promises, fn, false).promise();
};

Promise._map = map;
};
