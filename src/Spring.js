import React, {PropTypes} from 'react';
import mapTree from './mapTree';
import isPlainObject from 'lodash.isplainobject';
import stepper from './stepper';
import noVelocity from './noVelocity';
import mergeDiff from './mergeDiff';
import configAnimation from './animationLoop';
import zero from './zero';

const startAnimation = configAnimation();

// TODO: refactor common logic with updateCurrValue and updateCurrVelocity
function interpolateValue(alpha, nextValue, prevValue) {
  if (nextValue == null) {
    return null;
  }
  if (prevValue == null) {
    return nextValue;
  }
  if (typeof nextValue === 'number') {
    // https://github.com/chenglou/react-motion/pull/57#issuecomment-121924628
    return nextValue * alpha + prevValue * (1 - alpha);
  }
  if (nextValue.val != null && nextValue.config && nextValue.config.length === 0) {
    return nextValue;
  }
  if (nextValue.val != null) {
    let ret = {
      val: interpolateValue(alpha, nextValue.val, prevValue.val),
    };
    if (nextValue.config) {
      ret.config = nextValue.config;
    }
    return ret;
  }
  if (Array.isArray(nextValue)) {
    return nextValue.map((_, i) => interpolateValue(alpha, nextValue[i], prevValue[i]));
  }
  if (isPlainObject(nextValue)) {
    return Object.keys(nextValue).reduce((ret, key) => {
      ret[key] = interpolateValue(alpha, nextValue[key], prevValue[key]);
      return ret;
    }, {});
  }
  return nextValue;
}

// TODO: refactor common logic with updateCurrVelocity
export function updateCurrValue(frameRate, currValue, currVelocity, endValue, k, b) {
  if (endValue == null) {
    return null;
  }
  if (typeof endValue === 'number') {
    if (k == null || b == null) {
      return endValue;
    }
    // TODO: do something to stepper to make this not allocate (2 steppers?)
    return stepper(frameRate, currValue, currVelocity, endValue, k, b)[0];
  }
  if (endValue.val != null && endValue.config && endValue.config.length === 0) {
    return endValue;
  }
  if (endValue.val != null) {
    const [_k, _b] = endValue.config || [170, 26];
    let ret = {
      val: updateCurrValue(frameRate, currValue.val, currVelocity.val, endValue.val, _k, _b),
    };
    if (endValue.config) {
      ret.config = endValue.config;
    }
    return ret;
  }
  if (Array.isArray(endValue)) {
    return endValue.map((_, i) => updateCurrValue(frameRate, currValue[i], currVelocity[i], endValue[i], k, b));
  }
  if (isPlainObject(endValue)) {
    return Object.keys(endValue).reduce((ret, key) => {
      ret[key] = updateCurrValue(frameRate, currValue[key], currVelocity[key], endValue[key], k, b);
      return ret;
    }, {});
  }
  return endValue;
}

export function updateCurrVelocity(frameRate, currValue, currVelocity, endValue, k, b) {
  if (endValue == null) {
    return null;
  }
  if (typeof endValue === 'number') {
    if (k == null || b == null) {
      return mapTree(zero, currVelocity);
    }
    // TODO: do something to stepper to make this not allocate (2 steppers?)
    return stepper(frameRate, currValue, currVelocity, endValue, k, b)[1];
  }
  if (endValue.val != null && endValue.config && endValue.config.length === 0) {
    return mapTree(zero, currVelocity);
  }
  if (endValue.val != null) {
    const [_k, _b] = endValue.config || [170, 26];
    let ret = {
      val: updateCurrVelocity(frameRate, currValue.val, currVelocity.val, endValue.val, _k, _b),
    };
    if (endValue.config) {
      ret.config = endValue.config;
    }
    return ret;
  }
  if (Array.isArray(endValue)) {
    return endValue.map((_, i) => updateCurrVelocity(frameRate, currValue[i], currVelocity[i], endValue[i], k, b));
  }
  if (isPlainObject(endValue)) {
    return Object.keys(endValue).reduce((ret, key) => {
      ret[key] = updateCurrVelocity(frameRate, currValue[key], currVelocity[key], endValue[key], k, b);
      return ret;
    }, {});
  }
  return mapTree(zero, currVelocity);
}

function animationStep(shouldMerge, stopAnimation, getProps, timestep, state) {
  let {currValue, currVelocity} = state;
  let {willEnter, willLeave, endValue} = getProps();

  if (typeof endValue === 'function') {
    endValue = endValue(currValue);
  }

  let mergedValue = endValue; // set mergedValue to endValue as the default
  let hasNewKey = false;

  if (shouldMerge) {
    mergedValue = mergeDiff(
      currValue,
      endValue,
      // TODO: stop allocating like crazy in this whole code path
      key => willLeave(key, currValue[key], endValue, currValue, currVelocity)
    );

    Object.keys(mergedValue)
      .filter(key => !currValue.hasOwnProperty(key))
      .forEach(key => {
        hasNewKey = true;
        const enterValue = willEnter(key, mergedValue[key], endValue, currValue, currVelocity);
        currValue[key] = enterValue;
        mergedValue[key] = enterValue;
        currVelocity[key] = mapTree(zero, currValue[key]);
      });
  }

  const newCurrValue = updateCurrValue(timestep, currValue, currVelocity, mergedValue);
  const newCurrVelocity = updateCurrVelocity(timestep, currValue, currVelocity, mergedValue);

  if (!hasNewKey && noVelocity(currVelocity) && noVelocity(newCurrVelocity)) {
    // check explanation in `Spring.animationRender`
    stopAnimation(); // Nasty side effects....
  }

  return {
    currValue: newCurrValue,
    currVelocity: newCurrVelocity,
  };
}

export const Spring = React.createClass({
  propTypes: {
    defaultValue: PropTypes.oneOfType([
      PropTypes.object,
      PropTypes.array,
    ]),
    endValue: PropTypes.oneOfType([
      PropTypes.func,
      PropTypes.object,
      PropTypes.array,
    ]).isRequired,
    children: PropTypes.func.isRequired,
  },

  getInitialState() {
    const {endValue, defaultValue} = this.props;
    let currValue;
    if (defaultValue == null) {
      if (typeof endValue === 'function') {
        currValue = endValue();
      } else {
        currValue = endValue;
      }
    } else {
      currValue = defaultValue;
    }
    return {
      currValue: currValue,
      currVelocity: mapTree(zero, currValue),
    };
  },

  componentDidMount() {
    this.animationStep = animationStep.bind(null, false, () => this.stopAnimation(), () => this.props);
    this.startAnimating();
  },

  componentWillReceiveProps() {
    this.startAnimating();
  },

  stopAnimation: null,

  // used in animationRender
  hasUnmounted: false,

  animationStep: null,

  componentWillUnmount() {
    this.stopAnimation();
    this.hasUnmounted = true;
  },

  startAnimating() {
    // Is smart enough to not start it twice
    this.stopAnimation = startAnimation(
      this.state,
      this.animationStep,
      this.animationRender,
    );
  },

  animationRender(alpha, nextState, prevState) {
    // `this.hasUnmounted` might be true in the following condition:
    // user does some checks in `endValue` and calls an owner handler
    // owner sets state in the callback, triggering a re-render
    // re-render unmounts the Spring
    if (!this.hasUnmounted) {
      this.setState({
        currValue: interpolateValue(alpha, nextState.currValue, prevState.currValue),
        currVelocity: nextState.currVelocity,
      });
    }
  },

  render() {
    const renderedChildren = this.props.children(this.state.currValue);
    return renderedChildren && React.Children.only(renderedChildren);
  },
});

export const TransitionSpring = React.createClass({
  propTypes: {
    defaultValue: PropTypes.objectOf(PropTypes.any),
    endValue: PropTypes.oneOfType([
      PropTypes.func,
      PropTypes.objectOf(PropTypes.any.isRequired),
      // coming soon
      // PropTypes.arrayOf(PropTypes.shape({
      //   key: PropTypes.any.isRequired,
      // })),
      // PropTypes.arrayOf(PropTypes.element),
    ]).isRequired,
    willLeave: PropTypes.oneOfType([
      PropTypes.func,
      // PropTypes.object,
      // PropTypes.array,
      // TODO: numbers? strings?
    ]),
    willEnter: PropTypes.oneOfType([
      PropTypes.func,
      // PropTypes.object,
      // PropTypes.array,
    ]),
    children: PropTypes.func.isRequired,
  },

  getDefaultProps() {
    return {
      willEnter: (key, value) => value,
      willLeave: () => null,
    };
  },

  getInitialState() {
    const {endValue, defaultValue} = this.props;
    let currValue;
    if (defaultValue == null) {
      if (typeof endValue === 'function') {
        currValue = endValue();
      } else {
        currValue = endValue;
      }
    } else {
      currValue = defaultValue;
    }
    return {
      currValue: currValue,
      currVelocity: mapTree(zero, currValue),
    };
  },

  componentDidMount() {
    this.animationStep = animationStep.bind(null, true, () => this.stopAnimation(), () => this.props);
    this.startAnimating();
  },

  componentWillReceiveProps() {
    this.startAnimating();
  },

  stopAnimation: null,

  // used in animationRender
  hasUnmounted: false,

  animationStep: null,

  componentWillUnmount() {
    this.stopAnimation();
  },

  startAnimating() {
    this.stopAnimation = startAnimation(
      this.state,
      this.animationStep,
      this.animationRender,
    );
  },

  animationRender(alpha, nextState, prevState) {
    // See comment in Spring.
    if (!this.hasUnmounted) {
      this.setState({
        currValue: interpolateValue(alpha, nextState.currValue, prevState.currValue),
        currVelocity: nextState.currVelocity,
      });
    }
  },

  render() {
    const renderedChildren = this.props.children(this.state.currValue);
    return renderedChildren && React.Children.only(renderedChildren);
  },
});
