import React from 'react';
import {spring} from '../src/react-motion';
import createMockRaf from './createMockRaf';
import TestUtils from 'react-addons-test-utils';

const injector = require('inject!../src/makeTransitionMotion');

describe('TransitionMotion', () => {
  let TransitionMotion;
  let mockRaf;

  beforeEach(() => {
    mockRaf = createMockRaf();
    TransitionMotion = injector({
      raf: mockRaf.raf,
      'performance-now': mockRaf.now,
    })(React);
  });

  it('should allow returning null from children function', () => {
    const App = React.createClass({
      render() {
        // shouldn't throw here
        return <TransitionMotion styles={[{key: 1, style: {}}]}>{() => null}</TransitionMotion>;
      },
    });
    TestUtils.renderIntoDocument(<App />);
  });

  it('should not throw on unmount', () => {
    spyOn(console, 'error');
    let kill = () => {};
    const App = React.createClass({
      getInitialState() {
        return {kill: false};
      },
      componentWillMount() {
        kill = () => this.setState({kill: true});
      },
      render() {
        return this.state.kill
          ? null
          : <TransitionMotion
              defaultStyles={[{key: 1, style: {x: 0}}]}
              styles={[{key: 1, style: {x: spring(10)}}]}>
              {() => null}
            </TransitionMotion>;
      },
    });
    TestUtils.renderIntoDocument(<App />);
    mockRaf.step(2);
    kill();
    mockRaf.step(3);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('should not throw on unmount with style function', () => {
    // similar as above test
    spyOn(console, 'error');
    let kill = () => {};
    const App = React.createClass({
      getInitialState() {
        return {kill: false};
      },
      componentWillMount() {
        kill = () => this.setState({kill: true});
      },
      render() {
        return this.state.kill
          ? null
          : <TransitionMotion
              defaultStyles={[{key: 1, style: {x: 0}}]}
              styles={() => [{key: 1, style: {x: spring(10)}}]}>
              {() => null}
            </TransitionMotion>;
      },
    });
    TestUtils.renderIntoDocument(<App />);
    mockRaf.step(2);
    kill();
    mockRaf.step(3);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('should allow a defaultStyles', () => {
    let count = [];
    const App = React.createClass({
      render() {
        return (
          <TransitionMotion
            defaultStyles={[{key: 1, style: {a: 0}}]}
            styles={[{key: 1, style: {a: spring(10)}}]}>
            {([{style}]) => {
              count.push(style);
              return null;
            }}
          </TransitionMotion>
        );
      },
    });

    TestUtils.renderIntoDocument(<App />);

    expect(count).toEqual([{a: 0}]);
    mockRaf.step(4);
    expect(count).toEqual([
      {a: 0},
      {a: 0.4722222222222222},
      {a: 1.1897376543209877},
      {a: 2.0123698988340193},
      {a: 2.8557218143909084},
    ]);
  });

  it('should accept different spring configs', () => {
    let count = [];
    const App = React.createClass({
      render() {
        return (
          <TransitionMotion
            defaultStyles={[{key: 1, style: {a: 0}}]}
            styles={[{key: 1, style: {a: spring(10, {stiffness: 100, damping: 50, precision: 16})}}]}>
            {([{style: {a}}]) => {
              count.push(a);
              return null;
            }}
          </TransitionMotion>
        );
      },
    });
    TestUtils.renderIntoDocument(<App />);

    mockRaf.step(99);
    expect(count).toEqual([
      0,
      0.2777777777777778,
      0.5941358024691358,
      0.9081361454046639,
      1.213021309632678,
      1.5079182450697726,
      1.7929588941684615,
      2.0684390330691236,
      10,
    ]);
  });

  it('should interpolate many values', () => {
    let count = [];
    const App = React.createClass({
      render() {
        return (
          <TransitionMotion
            defaultStyles={[
              {key: 1, style: {a: 0, b: 10}},
              {key: 2, style: {c: 20}},
            ]}
            styles={[
              {key: 1, style: {a: spring(10), b: spring(410)}},
              {key: 2, style: {c: spring(420)}},
            ]}>
            {a => {
              count.push(a);
              return null;
            }}
          </TransitionMotion>
        );
      },
    });

    TestUtils.renderIntoDocument(<App />);

    expect(count).toEqual([[
      {key: 1, style: {a: 0, b: 10}},
      {key: 2, style: {c: 20}},
    ]]);
    mockRaf.step(4);
    expect(count).toEqual([
      [{key: 1, style: {a: 0, b: 10}}, {key: 2, style: {c: 20}}],
      [{key: 1, style: {a: 0.4722222222222222, b: 28.888888888888886}}, {key: 2, style: {c: 38.888888888888886}}],
      [{key: 1, style: {a: 1.1897376543209877, b: 57.589506172839506}}, {key: 2, style: {c: 67.589506172839506}}],
      [{key: 1, style: {a: 2.0123698988340193, b: 90.49479595336075}}, {key: 2, style: {c: 100.49479595336075}}],
      [{key: 1, style: {a: 2.8557218143909084, b: 124.22887257563633}}, {key: 2, style: {c: 134.22887257563632}}],
    ]);
  });

  it('should work with nested TransitionMotions', () => {
    let count = [];
    const App = React.createClass({
      render() {
        return (
          <TransitionMotion
            defaultStyles={[{key: 'owner', style: {x: 0}}]}
            styles={[{key: 'owner', style: {x: spring(10)}}]}>
            {([{style}]) => {
              count.push(style);
              return (
                <TransitionMotion
                  defaultStyles={[{key: 'child', style: {a: 10}}]}
                  styles={[{key: 'child', style: {a: spring(400)}}]}>
                  {([{style: s}]) => {
                    count.push(s);
                    return null;
                  }}
                </TransitionMotion>
              );
            }}
          </TransitionMotion>
        );
      },
    });
    TestUtils.renderIntoDocument(<App />);

    expect(count).toEqual([
      {x: 0},
      {a: 10},
    ]);
    mockRaf.step();
    expect(count).toEqual([
      {x: 0},
      {a: 10},
      {a: 28.416666666666668}, // child
      {x: 0.4722222222222222}, // owner
      {a: 28.416666666666668}, // child
    ]);
    mockRaf.step(2);
    expect(count).toEqual([
      {x: 0},
      {a: 10},
      {a: 28.416666666666668},
      {x: 0.4722222222222222},
      {a: 28.416666666666668},

      {a: 56.39976851851852}, // child
      {x: 1.1897376543209877}, // owner
      {a: 56.39976851851852}, // child

      {a: 88.48242605452674}, // child
      {x: 2.0123698988340193}, // owner
      {a: 88.48242605452674}, // child
    ]);
  });

  it('should reach destination value', () => {
    let count = [];
    const App = React.createClass({
      render() {
        return (
          <TransitionMotion
            defaultStyles={[{key: 1, style: {a: 0}}]}
            styles={[{key: 1, style: {a: spring(400)}}]}>
            {([{style: {a}}]) => {
              count.push(a);
              return null;
            }}
          </TransitionMotion>
        );
      },
    });
    TestUtils.renderIntoDocument(<App />);

    expect(count).toEqual([0]);
    // Move "time" until we reach the final styles value
    mockRaf.step(111);
    expect(count.slice(0, 5)).toEqual([
      0,
      18.888888888888886,
      47.589506172839506,
      80.49479595336075,
      114.22887257563633,
    ]);
    expect(count[count.length - 1]).toEqual(400);
  });

  it('should support jumping to value', () => {
    let count = [];
    let setState = () => {};
    const App = React.createClass({
      getInitialState() {
        return {p: false};
      },
      componentWillMount() {
        setState = this.setState.bind(this);
      },
      render() {
        return (
          <TransitionMotion
            styles={[{key: 1, style: {x: this.state.p ? 400 : spring(0)}}]}>
            {([{style}]) => {
              count.push(style);
              return null;
            }}
          </TransitionMotion>
        );
      },
    });
    TestUtils.renderIntoDocument(<App />);

    expect(count).toEqual([{x: 0}]);
    setState({p: true});
    expect(count).toEqual([
      {x: 0},
      {x: 0}, // this new 0 comes from owner update, causing TransitionMotion to re-render
    ]);
    mockRaf.step(10);
    // jumped to end, will only have two renders no matter how much we step
    expect(count).toEqual([
      {x: 0},
      {x: 0},
      {x: 400},
    ]);
    setState({p: false});
    mockRaf.step(3);
    expect(count).toEqual([
      {x: 0},
      {x: 0},
      {x: 400},
      {x: 400}, // redundant 0 comes from owner update again
      {x: 381.1111111111111},
      {x: 352.4104938271605},
      {x: 319.5052040466392},
    ]);
  });

  it('should behave well when many owner updates come in-between rAFs', () => {
    let count = [];
    let setState = () => {};
    const App = React.createClass({
      getInitialState() {
        return {
          val: [{key: 1, style: {x: spring(0)}}],
        };
      },
      componentWillMount() {
        setState = this.setState.bind(this);
      },
      render() {
        return (
          <TransitionMotion
            styles={this.state.val}
            willEnter={() => ({y: 0})}
            willLeave={() => ({y: spring(0)})}>
            {a => {
              count.push(a);
              return null;
            }}
          </TransitionMotion>
        );
      },
    });
    TestUtils.renderIntoDocument(<App />);

    expect(count).toEqual([[{key: 1, style: {x: 0}}]]);
    setState({
      val: [{key: 1, style: {x: 400}}, {key: 2, style: {y: 10}}],
    });
    setState({
      val: [{key: 1, style: {x: spring(100)}}],
    });
    mockRaf.step(2);
    setState({
      val: [{key: 1, style: {x: spring(400)}}],
    });
    mockRaf.step(2);
    expect(count).toEqual([
      [{key: 1, style: {x: 0}}],
      [{key: 1, style: {x: 0}}], // this new 0 comes from owner update, causing TransitionMotion to re-render
      [{key: 1, style: {x: 400}}, {key: 2, style: {y: 10}}],
      [{key: 1, style: {x: 385.8333333333333}}, {key: 2, style: {y: 9.527777777777779}}],
      [{key: 1, style: {x: 364.3078703703703}}, {key: 2, style: {y: 8.810262345679014}}],
      [{key: 1, style: {x: 364.3078703703703}}, {key: 2, style: {y: 8.810262345679014}}],
      [{key: 1, style: {x: 353.79556970164606}}, {key: 2, style: {y: 7.9876301011659825}}],
      [{key: 1, style: {x: 350.02047519790233}}, {key: 2, style: {y: 7.144278185609093}}],
    ]);
  });

  it('should behave well when many owner styles function updates come in-between rAFs', () => {
    let count = [];
    let setState = () => {};
    const App = React.createClass({
      getInitialState() {
        return {
          val: [{key: 1, style: {x: spring(0)}}],
        };
      },
      componentWillMount() {
        setState = this.setState.bind(this);
      },
      render() {
        return (
          <TransitionMotion
            styles={() => this.state.val}
            willEnter={() => ({y: 0})}
            willLeave={() => ({y: spring(0)})}>
            {a => {
              count.push(a);
              return null;
            }}
          </TransitionMotion>
        );
      },
    });
    TestUtils.renderIntoDocument(<App />);

    expect(count).toEqual([[{key: 1, style: {x: 0}}]]);
    setState({
      val: [{key: 1, style: {x: 400}}, {key: 2, style: {y: 10}}],
    });
    setState({
      val: [{key: 1, style: {x: spring(100)}}],
    });
    mockRaf.step(2);
    setState({
      val: [{key: 1, style: {x: spring(400)}}],
    });
    mockRaf.step(2);
    expect(count).toEqual([
      [{key: 1, style: {x: 0}}],
      [{key: 1, style: {x: 0}}], // this new 0 comes from owner update, causing TransitionMotion to re-render
      [{key: 1, style: {x: 400}}, {key: 2, style: {y: 10}}],
      [{key: 1, style: {x: 385.8333333333333}}, {key: 2, style: {y: 9.527777777777779}}],
      [{key: 1, style: {x: 364.3078703703703}}, {key: 2, style: {y: 8.810262345679014}}],
      [{key: 1, style: {x: 364.3078703703703}}, {key: 2, style: {y: 8.810262345679014}}],
      [{key: 1, style: {x: 353.79556970164606}}, {key: 2, style: {y: 7.9876301011659825}}],
      [{key: 1, style: {x: 350.02047519790233}}, {key: 2, style: {y: 7.144278185609093}}],
    ]);
  });

  it('should transition things in/out at the beginning', () => {
    let count = [];
    const App = React.createClass({
      render() {
        return (
          <TransitionMotion
            willLeave={() => ({c: spring(0)})}
            willEnter={() => ({d: 0})}
            defaultStyles={[{key: 1, style: {a: 0, b: 10}}, {key: 2, style: {c: 20}}]}
            styles={[
              {key: 1, style: {a: spring(10), b: spring(410)}},
              {key: 3, style: {d: spring(10)}},
            ]}>
            {a => {
              count.push(a);
              return null;
            }}
          </TransitionMotion>
        );
      },
    });

    TestUtils.renderIntoDocument(<App />);

    expect(count).toEqual([
      [{key: 1, style: {a: 0, b: 10}}, {key: 2, style: {c: 20}}, {key: 3, style: {d: 0}}],
    ]);
    mockRaf.step(2);
    expect(count).toEqual([
      [{key: 1, style: {a: 0, b: 10}}, {key: 2, style: {c: 20}}, {key: 3, style: {d: 0}}],
      [{key: 1, style: {a: 0.4722222222222222, b: 28.888888888888886}}, {key: 2, style: {c: 19.055555555555557}}, {key: 3, style: {d: 0.4722222222222222}}],
      [{key: 1, style: {a: 1.1897376543209877, b: 57.589506172839506}}, {key: 2, style: {c: 17.62052469135803}}, {key: 3, style: {d: 1.1897376543209877}}],
    ]);
    mockRaf.step(999);
    expect(count.length).toBe(106);
    expect(count[count.length - 1]).toEqual([{key: 1, style: {a: 10, b: 410}}, {key: 3, style: {d: 10}}]);
  });

  it('should eliminate things in/out at the beginning', () => {
    // similar to previous test, but without willEnter/leave
    let count = [];
    const App = React.createClass({
      render() {
        return (
          <TransitionMotion
            defaultStyles={[{key: 1, style: {a: 0, b: 10}}, {key: 2, style: {c: 20}}]}
            styles={[{key: 1, style: {a: spring(10), b: spring(410)}}, {key: 3, style: {d: spring(10)}}]}>
            {a => {
              count.push(a);
              return null;
            }}
          </TransitionMotion>
        );
      },
    });

    TestUtils.renderIntoDocument(<App />);

    expect(count).toEqual([[{key: 1, style: {a: 0, b: 10}}, {key: 3, style: {d: 10}}]]);
    mockRaf.step(2);
    expect(count).toEqual([
      [{key: 1, style: {a: 0, b: 10}}, {key: 3, style: {d: 10}}],
      [{key: 1, style: {a: 0.4722222222222222, b: 28.888888888888886}}, {key: 3, style: {d: 10}}],
      [{key: 1, style: {a: 1.1897376543209877, b: 57.589506172839506}}, {key: 3, style: {d: 10}}],
    ]);
  });
});
