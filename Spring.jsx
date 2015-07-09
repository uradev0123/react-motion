import React, {PropTypes} from 'react';
import {range, mapTree, clone} from './utils';
import stepper from './stepper';

// ---------
let FRAME_RATE = 1 / 60;

function zero() {
  return 0;
}

// TODO: test
function mergeDiff(collA, collB, onRemove, accum) {
  let [a, ...aa] = collA;
  let [b, ...bb] = collB;

  if (collA.length === 0 && collB.length === 0) {
    return accum;
  }
  if (collA.length === 0) {
    return accum.concat(collB);
  }
  if (collB.length === 0) {
    if (onRemove(a)) {
      return mergeDiff(aa, collB, onRemove, accum);
    }
    return mergeDiff(aa, collB, onRemove, accum.concat(a));
  }
  if (a === b) { // fails for ([undefined], [], () => true). but don't do that
    return mergeDiff(aa, bb, onRemove, accum.concat(a));
  }
  if (collB.indexOf(a) === -1) {
    if (onRemove(a)) {
      return mergeDiff(aa, collB, onRemove, accum);
    }
    return mergeDiff(aa, collB, onRemove, accum.concat(a));
  }
  return mergeDiff(aa, collB, onRemove, accum);
}

function mergeDiffObj(a, b, onRemove) {
  let keys = mergeDiff(Object.keys(a), Object.keys(b), a => !onRemove(a), []);
  let ret = {};
  keys.forEach(key => {
    if (b.hasOwnProperty(key)) {
      ret[key] = b[key];
    } else {
      ret[key] = onRemove(key);
    }
  });

  return ret;
}

// TODO: refactor common logic with updateCurrV
// TODO: tests
function updateCurrVals(frameRate, currVals, currV, endValue, k = 170, b = 26) {
  if (endValue === null) {
    return null;
  }
  if (typeof endValue === 'number') {
    // TODO: do something to stepper to make this not allocate (2 steppers?)
    return stepper(frameRate, currVals, currV, endValue, k, b)[0];
  }
  if (endValue.val != null && endValue.config && endValue.config.length === 0) {
    return endValue;
  }
  if (endValue.val != null) {
    const [_k, _b] = endValue.config || [170, 26];
    return {
      val: updateCurrVals(frameRate, currVals.val, currV.val, endValue.val, _k, _b),
      config: endValue.config,
    };
  }
  if (Object.prototype.toString.call(endValue) === '[object Array]') {
    return endValue.map((_, i) => updateCurrVals(frameRate, currVals[i], currV[i], endValue[i], k, b));
  }
  if (Object.prototype.toString.call(endValue) === '[object Object]') {
    let ret = {};
    Object.keys(endValue).forEach(key => {
      ret[key] = updateCurrVals(frameRate, currVals[key], currV[key], endValue[key], k, b);
    });
    return ret;
  }
  return endValue;
}

function updateCurrV(frameRate, currVals, currV, endValue, k = 170, b = 26) {
  if (endValue === null) {
    return null;
  }
  if (typeof endValue === 'number') {
    return stepper(frameRate, currVals, currV, endValue, k, b)[1];
  }
  if (endValue.val != null && endValue.config && endValue.config.length === 0) {
    return mapTree(zero, currV);
  }
  if (endValue.val != null) {
    const [_k, _b] = endValue.config || [170, 26];
    return {
      val: updateCurrV(frameRate, currVals.val, currV.val, endValue.val, _k, _b),
      config: endValue.config,
    };
  }
  if (Object.prototype.toString.call(endValue) === '[object Array]') {
    return endValue.map((_, i) => updateCurrV(frameRate, currVals[i], currV[i], endValue[i], k, b));
  }
  if (Object.prototype.toString.call(endValue) === '[object Object]') {
    let ret = {};
    Object.keys(endValue).forEach(key => {
      ret[key] = updateCurrV(frameRate, currVals[key], currV[key], endValue[key], k, b);
    });
    return ret;
  }
  return mapTree(zero, currV);
}


function noSpeed(coll) {
  if (Object.prototype.toString.call(coll) === '[object Array]') {
    return coll.every(noSpeed);
  }
  if (Object.prototype.toString.call(coll) === '[object Object]') {
    return Object.keys(coll).every(key => key === 'config' ? true : noSpeed(coll[key]));
  }
  return coll === 0;
}


export default React.createClass({
  propTypes: {
    endValue: PropTypes.oneOfType([
      PropTypes.func,
      PropTypes.object,
      PropTypes.array,
    ]).isRequired,
  },

  getInitialState() {
    let {endValue} = this.props;
    if (typeof endValue === 'function') {
      endValue = endValue();
    }
    return {
      currVals: endValue,
      currV: mapTree(zero, endValue),
      now: null,
    };
  },

  componentDidMount() {
    this.raf(true, false);
  },

  componentWillReceiveProps() {
    this.raf(true, false);
  },

  componentWillUnmount() {
    cancelAnimationFrame(this._rafID);
  },

  _rafID: null,

  raf(justStarted, isLastRaf) {
    if (justStarted && this._rafID != null) {
      // already rafing
      return;
    }
    this._rafID = requestAnimationFrame(() => {
      let {currVals, currV, now} = this.state;
      let {endValue} = this.props;

      if (typeof endValue === 'function') {
        endValue = endValue(currVals);
      }
      let frameRate = now && !justStarted ? (Date.now() - now) / 1000 : FRAME_RATE;

      let newCurrVals = updateCurrVals(frameRate, currVals, currV, endValue);
      let newCurrV = updateCurrV(frameRate, currVals, currV, endValue);

      this.setState(() => {
        return {
          currVals: newCurrVals,
          currV: newCurrV,
          now: Date.now(),
        };
      });

      let stop = noSpeed(newCurrV);
      if (stop && !justStarted) {
        // this flag is necessary, because in `endValue` callback, the user
        // might check that the current value has reached the destination, and
        // decide to return a new destination value. However, since s/he's
        // accessing the last tick's current value, and if we stop rafing after
        // speed is 0, the next `endValue` is never called and we never detect
        // the new chained animation. isLastRaf ensures that we raf a single
        // more time in case the user wants to chain another animation at the
        // end of this one
        if (isLastRaf) {
          this._rafID = null;
        } else {
          this.raf(false, true);
        }
      } else {
        this.raf(false, false);
      }
    });
  },

  render() {
    const {currVals} = this.state;

    return (
      <div {...this.props}>
        {this.props.children(currVals)}
      </div>
    );
  }
});


export let TransitionSpring = React.createClass({
  propTypes: {
    endValue: PropTypes.oneOfType([
      PropTypes.func,
      PropTypes.object,
      // coming soon
      // PropTypes.arrayOf(PropTypes.shape({
      //   key: PropTypes.any.isRequired,
      // })),
      // PropTypes.arrayOf(PropTypes.element),
    ]).isRequired,
    willLeave: PropTypes.oneOfType([
      PropTypes.func,
      PropTypes.object,
      PropTypes.array,
      // TODO: numbers? strings?
    ]),
    willEnter: PropTypes.oneOfType([
      PropTypes.func,
      PropTypes.object,
      PropTypes.array,
    ]),
  },

  getDefaultProps() {
    return {
      willEnter: (key, endValue) => endValue[key],
      willLeave: () => null,
    };
  },

  getInitialState() {
    let {endValue} = this.props;
    if (typeof endValue === 'function') {
      endValue = endValue();
    }
    return {
      currVals: endValue,
      currV: mapTree(zero, endValue),
      now: null,
    };
  },

  componentDidMount() {
    this.raf(true, false);
  },

  componentWillReceiveProps() {
    this.raf(true, false);
  },

  componentWillUnmount() {
    cancelAnimationFrame(this._rafID);
  },

  _rafID: null,

  raf(justStarted, isLastRaf) {
    if (justStarted && this._rafID != null) {
      // already rafing
      return;
    }
    this._rafID = requestAnimationFrame(() => {
      let {currVals, currV, now} = this.state;
      let {endValue, willEnter, willLeave} = this.props;

      if (typeof endValue === 'function') {
        endValue = endValue(currVals);
      }

      let mergedVals = mergeDiffObj(
        currVals,
        endValue,
        key => willLeave(key, endValue, currVals, currV)
      );

      currVals = clone(currVals);
      currV = clone(currV);
      Object.keys(mergedVals)
        .filter(key => !currVals.hasOwnProperty(key))
        .forEach(key => {
          currVals[key] = willEnter(key, endValue, currVals, currV);
          currV[key] = mapTree(zero, currVals[key]);
        });

      let frameRate = now && !justStarted ? (Date.now() - now) / 1000 : FRAME_RATE;

      let newCurrVals = updateCurrVals(frameRate, currVals, currV, mergedVals);
      let newCurrV = updateCurrV(frameRate, currVals, currV, mergedVals);

      this.setState(() => {
        return {
          currVals: newCurrVals,
          currV: newCurrV,
          now: Date.now(),
        };
      });

      let stop = noSpeed(newCurrV);
      if (stop && !justStarted) {
        if (isLastRaf) {
          this._rafID = null;
        } else {
          this.raf(false, true);
        }
      } else {
        this.raf(false, false);
      }
    });
  },

  render() {
    let {currVals} = this.state;
    return (<div {...this.props}>
      {this.props.children(currVals)}
    </div>);
  },
});

function reorderKeys(obj, f) {
  let ret = {};
  f(Object.keys(obj)).forEach(key => {
    ret[key] = obj[key];
  });
  return ret;
}

export let utils = {
  reorderKeys,
};
