/* @flow */
import noVelocity from './noVelocity';
import hasReachedStyle from './hasReachedStyle';
import mergeDiff from './mergeDiff';
import * as animationLoop from './animationLoop';
import zero from './zero';
import {interpolateValue, updateCurrentStyle, updateCurrentVelocity} from './updateTree';
import deprecatedSprings from './deprecatedSprings';
import stripStyle from './stripStyle';
import stepper from './stepper';
import {default as defaultNow} from 'performance-now';
import {default as defaultRaf} from 'raf';

import type {CurrentStyle, Style, Velocity} from './Types';
const startAnimation = animationLoop.configAnimation();
const msPerFrame = 1000 / 60;

function mapObject(f, obj: Object): Object {
  let ret = {};
  for (const key in obj) {
    if (!obj.hasOwnProperty(key)) {
      continue;
    }
    ret[key] = f(obj[key], key);
  }
  return ret;
}

function everyObj(f: (_: any) => boolean, obj: Object): boolean {
  for (const key in obj) {
    if (!obj.hasOwnProperty(key)) {
      continue;
    }
    if (!f(obj[key], key)) {
      return false;
    }
  }
  return true;
}

export default function components(React: Object): Object {
  const {PropTypes} = React;

  type CurrentStyles = Array<CurrentStyle>;
  type Styles = Array<Style>;
  type Velocities = Array<Velocity>;

  type StaggerMotionState = {
    currentStyles: CurrentStyles,
    currentVelocities: Velocities,
    previousIdealStyles: CurrentStyles,
    previousIdealVelocities: Velocities,
    nextIdealStyles: CurrentStyles,
    nextIdealVelocities: Velocities,
  };

  type DestStylesFunc = (_: ?CurrentStyles) => Styles;

  const StaggeredMotion = React.createClass({
    propTypes: {
      defaultStyle: (prop, propName) => {
        if (prop[propName]) {
          return new Error(
            'You forgot the "s" for `StaggeredMotion`\'s `defaultStyles`.'
          );
        }
      },
      style: (prop, propName) => {
        if (prop[propName]) {
          return new Error(
            'You forgot the "s" for `StaggeredMotion`\'s `styles`.'
          );
        }
      },
      // TOOD: warn against putting configs in here
      defaultStyles: PropTypes.arrayOf(PropTypes.object),
      styles: PropTypes.func.isRequired,
      children: PropTypes.func.isRequired,
    },

    getInitialState() {
      const {styles, defaultStyles} = this.props;
      const currentStyles = defaultStyles ? defaultStyles : styles();
      return {
        currentStyles: currentStyles,
        currentVelocities: currentStyles.map(s => mapObject(zero, s)),
      };
    },

    componentDidMount() {
      this.startAnimating();
    },

    componentWillReceiveProps() {
      this.startAnimating();
    },

    animationStep(timestep, state) {
      const {currentStyles, currentVelocities} = state;
      const styles = this.props.styles(currentStyles.map(stripStyle));

      const newCurrentStyles = currentStyles.map((currentStyle, i) => {
        return updateCurrentStyle(timestep, currentStyle, currentVelocities[i], styles[i]);
      });
      const newCurrentVelocities = currentStyles.map((currentStyle, i) => {
        return updateCurrentVelocity(timestep, currentStyle, currentVelocities[i], styles[i]);
      });

      // TODO: is this right?
      if (currentVelocities.every((v, k) => noVelocity(v, currentStyles[k])) &&
          newCurrentVelocities.every((v, k) => noVelocity(v, newCurrentStyles[k]))) {
        this.stopAnimation();
      }

      return {
        currentStyles: newCurrentStyles,
        currentVelocities: newCurrentVelocities,
      };
    },

    stopAnimation: null,

    // used in animationRender
    hasUnmounted: false,

    componentWillUnmount() {
      this.stopAnimation();
      this.hasUnmounted = true;
    },

    startAnimating() {
      this.stopAnimation = startAnimation(
        this.state,
        this.animationStep,
        this.animationRender,
      );
    },

    animationRender(alpha, nextState, prevState) {
      // See comment in Motion.
      if (!this.hasUnmounted) {
        const currentStyles = nextState.currentStyles.map((style, i) => {
          return interpolateValue(alpha, style, prevState.currentStyles[i]);
        });
        this.setState({
          currentStyles,
          currentVelocities: nextState.currentVelocities,
        });
      }
    },

    render() {
      const strippedStyle = this.state.currentStyles.map(stripStyle);
      const renderedChildren = this.props.children(strippedStyle);
      return renderedChildren && React.Children.only(renderedChildren);
    },
  });

  const TransitionMotion = React.createClass({
    propTypes: {
      defaultValue: (prop, propName) => {
        if (prop[propName]) {
          return new Error(
            'TransitionSpring\'s `defaultValue` has been changed to ' +
            '`defaultStyles`. Its format received a few (easy to update!) ' +
            'changes as well.'
          );
        }
      },
      endValue: (prop, propName) => {
        if (prop[propName]) {
          return new Error(
            'TransitionSpring\'s `endValue` has been changed to `styles`. ' +
            'Its format received a few (easy to update!) changes as well.'
          );
        }
      },
      defaultStyle: (prop, propName) => {
        if (prop[propName]) {
          return new Error(
            'You forgot the "s" for `TransitionMotion`\'s `defaultStyles`.'
          );
        }
      },
      style: (prop, propName) => {
        if (prop[propName]) {
          return new Error(
            'You forgot the "s" for `TransitionMotion`\'s `styles`.'
          );
        }
      },
      // TOOD: warn against putting configs in here
      defaultStyles: PropTypes.objectOf(PropTypes.any),
      styles: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.objectOf(PropTypes.any.isRequired),
      ]).isRequired,
      willLeave: PropTypes.oneOfType([
        PropTypes.func,
      ]),
      // TOOD: warn against putting configs in here
      willEnter: PropTypes.oneOfType([
        PropTypes.func,
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
      const {styles, defaultStyles} = this.props;
      let currentStyles;
      if (defaultStyles == null) {
        if (typeof styles === 'function') {
          currentStyles = styles();
        } else {
          currentStyles = styles;
        }
      } else {
        currentStyles = defaultStyles;
      }
      return {
        currentStyles: currentStyles,
        currentVelocities: mapObject(s => mapObject(zero, s), currentStyles),
      };
    },

    componentDidMount() {
      this.startAnimating();
    },

    componentWillReceiveProps() {
      this.startAnimating();
    },

    animationStep(timestep, state) {
      let {currentStyles, currentVelocities} = state;
      const {willEnter, willLeave} = this.props;

      let styles = this.props.styles;
      if (typeof styles === 'function') {
        styles = styles(currentStyles);
      }

      // TODO: huh?
      let mergedStyles = styles; // set mergedStyles to styles as the default
      let hasNewKey = false;

      mergedStyles = mergeDiff(
        currentStyles,
        styles,
        // TODO: stop allocating like crazy in this whole code path
        key => {
          const res = willLeave(key, currentStyles[key], styles, currentStyles, currentVelocities);
          if (res == null) {
            // For legacy reason. We won't allow returning null soon
            // TODO: remove, after next release
            return null;
          }

          if (noVelocity(currentVelocities[key], currentStyles[key]) &&
              hasReachedStyle(currentStyles[key], res)) {
            return null;
          }
          return res;
        }
      );

      Object.keys(mergedStyles)
        .filter(key => !currentStyles.hasOwnProperty(key))
        .forEach(key => {
          hasNewKey = true;
          const enterStyle = willEnter(key, mergedStyles[key], styles, currentStyles, currentVelocities);

          // We can mutate this here because mergeDiff returns a new Obj
          mergedStyles[key] = enterStyle;

          currentStyles = {
            ...currentStyles,
            [key]: enterStyle,
          };
          currentVelocities = {
            ...currentVelocities,
            [key]: mapObject(zero, enterStyle),
          };
        });

      const newCurrentStyles = mapObject((mergedStyle, key) => {
        return updateCurrentStyle(timestep, currentStyles[key], currentVelocities[key], mergedStyle);
      }, mergedStyles);
      const newCurrentVelocities = mapObject((mergedStyle, key) => {
        return updateCurrentVelocity(timestep, currentStyles[key], currentVelocities[key], mergedStyle);
      }, mergedStyles);

      if (!hasNewKey &&
          everyObj((v, k) => noVelocity(v, currentStyles[k]), currentVelocities) &&
          everyObj((v, k) => noVelocity(v, newCurrentStyles[k]), newCurrentVelocities)) {
        // check explanation in `Motion.animationRender`
        this.stopAnimation(); // Nasty side effects....
      }

      return {
        currentStyles: newCurrentStyles,
        currentVelocities: newCurrentVelocities,
      };
    },

    stopAnimation: null,

    // used in animationRender
    hasUnmounted: false,

    componentWillUnmount() {
      this.stopAnimation();
      this.hasUnmounted = true;
    },

    startAnimating() {
      this.stopAnimation = startAnimation(
        this.state,
        this.animationStep,
        this.animationRender,
      );
    },

    animationRender(alpha, nextState, prevState) {
      // See comment in Motion.
      if (!this.hasUnmounted) {
        const currentStyles = mapObject((style, key) => {
          return interpolateValue(alpha, style, prevState.currentStyles[key]);
        }, nextState.currentStyles);
        this.setState({
          currentStyles,
          currentVelocities: nextState.currentVelocities,
        });
      }
    },

    render() {
      const strippedStyle = mapObject(stripStyle, this.state.currentStyles);
      const renderedChildren = this.props.children(strippedStyle);
      return renderedChildren && React.Children.only(renderedChildren);
    },
  });

  const {Spring, TransitionSpring} = deprecatedSprings(React);

  return {Spring, TransitionSpring, StaggeredMotion, TransitionMotion};
}
