/* eslint-disable no-cond-assign */

// Avoid `console` errors in browsers that lack a console.
(() => {
  let method;
  const noop = () => {};
  const methods = [
    'assert', 'clear', 'count', 'debug', 'dir', 'dirxml', 'error',
    'exception', 'group', 'groupCollapsed', 'groupEnd', 'info', 'log',
    'markTimeline', 'profile', 'profileEnd', 'table', 'time', 'timeEnd',
    'timeline', 'timelineEnd', 'timeStamp', 'trace', 'warn',
  ];
  let { length } = methods;
  window.console = window.console || {};

  while (length -= 1) {
    method = methods[length];

    // Only stub undefined methods.
    if (!window.console[method]) {
      window.console[method] = noop;
    }
  }
})();

// Place any jQuery/helper plugins in here.
