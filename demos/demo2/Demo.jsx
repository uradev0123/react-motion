import React from 'react';
import {Motion, spring} from '../../src/Spring';
import range from 'lodash.range';

function reinsert(arr, from, to) {
  const _arr = arr.slice(0);
  const val = _arr[from];
  _arr.splice(from, 1);
  _arr.splice(to, 0, val);
  return _arr;
}

function clamp(n, min, max) {
  return Math.max(Math.min(n, max), min);
}

const allColors = [
  '#EF767A', '#456990', '#49BEAA', '#49DCB1', '#EEB868', '#EF767A', '#456990',
  '#49BEAA', '#49DCB1', '#EEB868', '#EF767A',
];
const [count, width, height] = [11, 70, 90];
// indexed by visual position
const layout = range(count).map(n => {
  const row = Math.floor(n / 3);
  const col = n % 3;
  return [width * col, height * row];
});

const Demo = React.createClass({
  getInitialState() {
    return {
      mouse: [0, 0],
      delta: [0, 0], // difference between mouse and circle pos, for dragging
      lastPress: null, // key of the last pressed component
      isPressed: false,
      order: range(count), // index: visual position. value: component key/id
    };
  },

  componentDidMount() {
    window.addEventListener('touchmove', this.handleTouchMove);
    window.addEventListener('touchend', this.handleMouseUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
  },

  handleTouchStart(key, pressLocation, e) {
    this.handleMouseDown(key, pressLocation, e.touches[0]);
  },

  handleTouchMove(e) {
    e.preventDefault();
    this.handleMouseMove(e.touches[0]);
  },

  handleMouseMove({pageX, pageY}) {
    const {order, lastPress, isPressed, delta: [dx, dy]} = this.state;
    if (isPressed) {
      const mouse = [pageX - dx, pageY - dy];
      const col = clamp(Math.floor(mouse[0] / width), 0, 2);
      const row = clamp(Math.floor(mouse[1] / height), 0, Math.floor(count / 3));
      const index = row * 3 + col;
      const newOrder = reinsert(order, order.indexOf(lastPress), index);
      this.setState({mouse: mouse, order: newOrder});
    }
  },

  handleMouseDown(key, [pressX, pressY], {pageX, pageY}) {
    this.setState({
      lastPress: key,
      isPressed: true,
      delta: [pageX - pressX, pageY - pressY],
      mouse: [pressX, pressY],
    });
  },

  handleMouseUp() {
    this.setState({isPressed: false, delta: [0, 0]});
  },

  render() {
    const {order, lastPress, isPressed, mouse} = this.state;
    return (
      <div className="demo2">
        {order.map((_, key) => {
          let style;
          let x;
          let y;
          const visualPosition = order.indexOf(key);
          if (key === lastPress && isPressed) {
            [x, y] = mouse;
            style = {
              translateX: spring(x),
              translateY: spring(y),
              scale: spring(1.2, [180, 10]),
            };
          } else {
            [x, y] = layout[visualPosition];
            style = {
              translateX: spring(x, [120, 17]),
              translateY: spring(y, [120, 17]),
              scale: spring(1, [180, 10]),
            };
          }
          return (
            <Motion
              key={key}
              style={{
                ...style,
                backgroundColor: allColors[key],
                zIndex: key === lastPress ? 99 : visualPosition,
                boxShadow: spring((x - (3 * width - 50) / 2) / 15, [180, 10]),
              }}>
              {({translateX, translateY, scale, zIndex, boxShadow}) => {
                return (
                  <div
                    onMouseDown={this.handleMouseDown.bind(null, key, [x, y])}
                    onTouchStart={this.handleTouchStart.bind(null, key, [x, y])}
                    className="demo2-ball"
                    style={{
                      backgroundColor: allColors[key],
                      WebkitTransform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`,
                      transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`,
                      zIndex: zIndex,
                      boxShadow: `${boxShadow}px 5px 5px rgba(0,0,0,0.5)`,
                    }}
                  />
                );
              }}
            </Motion>
          );
        })}
      </div>
    );
  },
});

export default Demo;
