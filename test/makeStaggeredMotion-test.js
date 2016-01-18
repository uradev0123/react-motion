import React from 'react';
import {spring} from '../src/react-motion';
import createMockRaf from './createMockRaf';
import {default as TestUtils} from 'react-addons-test-utils';

const injector = require('inject!../src/makeStaggeredMotion');

describe('StaggeredMotion', () => {
  let StaggeredMotion;
  let mockRaf;

  beforeEach(() => {
    mockRaf = createMockRaf();
    StaggeredMotion = injector({
      raf: mockRaf.raf,
      'performance-now': mockRaf.now,
    })(React);
  });

  it('should allow returning null from children function', () => {
    const App = React.createClass({
      render() {
        // shouldn't throw here
        return (
          <StaggeredMotion styles={() => [{a: 0}]}>
            {() => null}
          </StaggeredMotion>
        );
      },
    });
    TestUtils.renderIntoDocument(<App />);
  });

  // TODO: assert on console.warn/error
  it('should not throw on unmount', () => {
    const App = React.createClass({
      render() {
        return (
          <StaggeredMotion defaultStyles={[{a: 0}]} styles={() => [{a: 10}]}>
            {() => null}
          </StaggeredMotion>
        );
      },
    });
    TestUtils.renderIntoDocument(<App />);
    mockRaf.step(3);
    TestUtils.renderIntoDocument(<div />);
    mockRaf.step(3);
  });

  it('should allow a defaultStyles', () => {
    let count = [];
    const App = React.createClass({
      render() {
        return (
          <StaggeredMotion
            defaultStyles={[{a: 0}]}
            styles={() => [{a: spring(10)}]}>
            {([{a}]) => {
              count.push(a);
              return null;
            }}
          </StaggeredMotion>
        );
      },
    });
    TestUtils.renderIntoDocument(<App />);

    expect(count).toEqual([0]);
    mockRaf.step(4);
    expect(count).toEqual([
      0,
      0.4722222222222222,
      1.1897376543209877,
      2.0123698988340193,
      2.8557218143909084,
    ]);
  });

  it('should accept different spring configs', () => {
    let count = [];
    const App = React.createClass({
      render() {
        return (
          <StaggeredMotion
            defaultStyles={[{a: 0}]}
            styles={() => [{a: spring(10, [100, 50])}]}>
            {([{a}]) => {
              count.push(a);
              return null;
            }}
          </StaggeredMotion>
        );
      },
    });
    TestUtils.renderIntoDocument(<App />);

    expect(count).toEqual([0]);
    mockRaf.step(2);
    expect(count).toEqual([
      0,
      0.2777777777777778,
      0.5941358024691358,
    ]);
  });

  it('should interpolate many values while staggering', () => {
    let count = [];
    const App = React.createClass({
      render() {
        return (
          <StaggeredMotion
            defaultStyles={[{a: 0, b: 10}, {a: 0, b: 10}]}
            styles={prevStyles => {
              return prevStyles.map((_, i) => i === 0
                ? {a: spring(10), b: spring(410)}
                : {a: spring(prevStyles[i - 1].a), b: spring(prevStyles[i - 1].b)});
            }}>
            {([{a, b}, {a: a2, b: b2}]) => {
              count.push([a, b, a2, b2]);
              return null;
            }}
          </StaggeredMotion>
        );
      },
    });

    TestUtils.renderIntoDocument(<App />);

    expect(count).toEqual([[0, 10, 0, 10]]);
    mockRaf.step(4);
    expect(count).toEqual([
      [0, 10, 0, 10],
      [0.4722222222222222, 28.888888888888886, 0, 10],
      [1.1897376543209877, 57.589506172839506, 0.02229938271604938, 10.891975308641975],
      [2.0123698988340193, 90.49479595336075, 0.09006472908093276, 13.602589163237312],
      [2.8557218143909084, 124.22887257563633, 0.18039409126848038, 17.215763650739216],
    ]);
  });

  it('should work with nested Motions', () => {
    let count = [];
    const App = React.createClass({
      render() {
        return (
          <StaggeredMotion defaultStyles={[{owner: 0}]} styles={() => [{owner: spring(10)}]}>
            {([{owner}]) => {
              count.push(owner);
              return (
                <StaggeredMotion defaultStyles={[{child: 10}]} styles={() => [{child: spring(400)}]}>
                  {([{child}]) => {
                    count.push(child);
                    return null;
                  }}
                </StaggeredMotion>
              );
            }}
          </StaggeredMotion>
        );
      },
    });
    TestUtils.renderIntoDocument(<App />);

    expect(count).toEqual([0, 10]);
    mockRaf.step();
    expect(count).toEqual([
      0,
      10,
      28.416666666666668, // child
      0.4722222222222222, // owner
      28.416666666666668, // child
    ]);
    mockRaf.step(2);
    expect(count).toEqual([
      0,
      10,
      28.416666666666668,
      0.4722222222222222,
      28.416666666666668,

      56.39976851851852, // child
      1.1897376543209877, // owner
      56.39976851851852, // child

      88.48242605452674, // child
      2.0123698988340193, // owner
      88.48242605452674, // child
    ]);
  });

  // TODO: should animate one last time to reach true destination
  // maybe shouldStopAnimation logic has a flaw
  it('should reach destination value', () => {
    let count = [];
    const App = React.createClass({
      render() {
        return (
          <StaggeredMotion
            defaultStyles={[{a: 0, b: 10}, {a: 0, b: 10}]}
            styles={prevStyles => {
              return prevStyles.map((_, i) => i === 0
                ? {a: spring(10), b: spring(410)}
                : {a: spring(prevStyles[i - 1].a), b: spring(prevStyles[i - 1].b)});
            }}>
            {([{a, b}, {a: a2, b: b2}]) => {
              count.push([a, b, a2, b2]);
              return null;
            }}
          </StaggeredMotion>
        );
      },
    });
    TestUtils.renderIntoDocument(<App />);

    expect(count).toEqual([[0, 10, 0, 10]]);
    mockRaf.step(111);
    expect(count.slice(0, 5)).toEqual([
      [0, 10, 0, 10],
      [0.4722222222222222, 28.888888888888886, 0, 10],
      [1.1897376543209877, 57.589506172839506, 0.02229938271604938, 10.891975308641975],
      [2.0123698988340193, 90.49479595336075, 0.09006472908093276, 13.602589163237312],
      [2.8557218143909084, 124.22887257563633, 0.18039409126848038, 17.215763650739216],
    ]);
    expect(count.length).toBe(112);
    expect(count[count.length - 1]).toEqual([10, 410, 10, 409.9989743401555]);
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
          <StaggeredMotion styles={() => [{a: this.state.p ? 400 : spring(0)}]}>
            {([{a}]) => {
              count.push(a);
              return null;
            }}
          </StaggeredMotion>
        );
      },
    });
    TestUtils.renderIntoDocument(<App />);

    expect(count).toEqual([0]);
    setState({p: true});
    expect(count).toEqual([
      0,
      0, // this new 0 comes from owner update, causing StaggeredMotion to re-render
    ]);
    mockRaf.step(10);
    // jumped to end, will only have two renders no matter how much we step
    expect(count).toEqual([
      0,
      0,
      400,
    ]);
    setState({p: false});
    mockRaf.step(3);
    expect(count).toEqual([
      0,
      0,
      400,
      400, // redundant 0 comes from owner update again
      381.1111111111111,
      352.4104938271605,
      319.5052040466392,
    ]);
  });

  it('should behave well when many owner updates come in-between rAFs', () => {
    let count = [];
    let setState = () => {};
    const App = React.createClass({
      getInitialState() {
        return {a: spring(0)};
      },
      componentWillMount() {
        setState = this.setState.bind(this);
      },
      render() {
        return (
          <StaggeredMotion styles={() => [this.state]}>
            {([{a}]) => {
              count.push(a);
              return null;
            }}
          </StaggeredMotion>
        );
      },
    });
    TestUtils.renderIntoDocument(<App />);

    expect(count).toEqual([0]);
    setState({a: 400});
    setState({a: spring(100)});
    mockRaf.step(2);
    setState({a: spring(400)});
    mockRaf.step(2);
    expect(count).toEqual([
      0,
      0, // this new 0 comes from owner update, causing StaggeredMotion to re-render
      400,
      385.8333333333333,
      364.3078703703703,
      364.3078703703703,
      353.79556970164606,
      350.02047519790233,
    ]);
  });
});
