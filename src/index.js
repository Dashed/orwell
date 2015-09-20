/**
 * orwell is a higher-order component that can listen to Probe cursors for changes,
 * and update the component whenever any cursor emit a change.
 *
 * orwell(Component, watchCursors, assignNewProps)
 *
 * A component may receive Probe cursors as props, and it's sometimes useful to intercept
 * those cursors and subscribe to them such that whenever they change, the component would
 * re-render.
 *
 * orwell takes the following parameters:
 * - Component: the component that depend on cursors which usually are recevied as props
 *              or somewhere else
 *
 * - watchCursors: a function that receives two parameters: props and manual
 *                 watchCursors may return an array of Probe cursors indicating
 *                 that the Component depends on them.
 *                 watchCursors may return a single Probe cursor, which is sugar
 *                 to an array containing that cursor.
 *                 Any other return value is ignored.
 *                 manual is a function that takes a function, say subscriber, with input update.
 *                 In the body of subscriber, the user can manually subscribe to a Probe cursor,
 *                 and call update to induce a re-render of the Component. This allows the user
 *                 to call update conditionally (e.g. validation step).
 *
 * - assignNewProps: a function to generate props that will be merged to props that orwell
 *                   receives.
 *                   this function will be called whenever:
 *                   1. subscribed Probe cursor has changed, or
 *                   2. orwell wrapped Component will receive new props
 *
 * Inspired by `connectToStores` function: https://medium.com/@dan_abramov/mixins-are-dead-long-live-higher-order-components-94a0d2f9e750
 */

const React = require('react');
const Probe = require('probe');

const shallowEqual = require('shallowequal');
const isFunction = require('lodash.isfunction');
const isArray = require('lodash.isarray');
const isPlainObject = require('lodash.isplainobject');
const assign = require('lodash.assign');
const isEqual = require('lodash.isequal');

const WATCH_CURSORS = function() {
    return void 0;
};

const SHOULD_REWATCH_CURSORS = function() {
    return false;
};

const ASSIGN_NEW_PROPS = function() {
    return {};
};

const SHOULD_ASSIGN_NEW_PROPS = function() {
    return true;
};

function cursorCompare(valueA, valueB) {
    if(!(valueA instanceof Probe) || !(valueB instanceof Probe)) {
        return void 0;
    }

    return valueA.deref() === valueB.deref();
}

function __shouldComponentUpdateShallow(nextProps, nextState) {
    return !shallowEqual(this.state.currentProps, nextState.currentProps, cursorCompare);
}

function __shouldComponentUpdateDeep(nextProps, nextState) {
    return !isEqual(this.state.currentProps, nextState.currentProps, cursorCompare);
}

let __shouldComponentUpdateGlobal = __shouldComponentUpdateShallow;

const orwell = function(Component, orwellSpec) {

    let watchCursors = orwellSpec.watchCursors || null;
    let shouldRewatchCursors = orwellSpec.shouldRewatchCursors || null;
    let assignNewProps = orwellSpec.assignNewProps || null;
    let shouldAssignNewProps = orwellSpec.shouldAssignNewProps || null;

    // Check for optional static methods.
    if (isFunction(Component.watchCursors)) {
        watchCursors = Component.watchCursors;
    }

    if (isFunction(Component.assignNewProps)) {
        assignNewProps = Component.assignNewProps;
    }

    // fallbacks
    if (!isFunction(watchCursors)) {
        watchCursors = WATCH_CURSORS;
    }

    if (!isFunction(shouldRewatchCursors)) {
        shouldRewatchCursors = SHOULD_REWATCH_CURSORS;
    }

    if (!isFunction(assignNewProps)) {
        assignNewProps = ASSIGN_NEW_PROPS;
    }

    if (!isFunction(shouldAssignNewProps)) {
        shouldAssignNewProps = SHOULD_ASSIGN_NEW_PROPS;
    }

    // globals
    let debug = false;
    let __shouldComponentUpdate = __shouldComponentUpdateGlobal;
    let OrwellContainer;

    let classSpec = {
        assignNewProps(props, context) {
            const ret = assignNewProps.call(null, props, context);
            return isPlainObject(ret) ? ret : {};
        },

        watchCursors(props, context) {
            let numberSubscribers = 0;
            let unsubs = [];

            /**
             * usage:
             *
             * manual(function(update) {
             *
             *   const unsubscribe = cursor.on(event, function() {
             *     // ...
             *     update();
             *   });
             *   return unsubscribe;
             * });
             *
             * user call manual function with a function that take in an update function.
             * The provided function will allow a custom validation step whenever some
             * cursor has changed. If this validation passes, user would call the update
             * function to induce a re-render.
             */
            const manual = (fn) => {

                numberSubscribers++;

                const cleanup = fn.call(null, this.handleCursorChanged);
                if(cleanup && isFunction(cleanup)) {
                    unsubs.push(cleanup);
                }
            };

            // watchCursors may return either a single cursor or an array of cursors.
            // These cursors are designated to be observed, and when an event change
            // has occured at these cursors, this component shall update.
            let cursorsToWatch = watchCursors.call(null, props, manual, context);

            // TODO: support cursorsToWatch that may be a promise.

            // watchCursors may return a single cursor
            if(cursorsToWatch instanceof Probe) {
                cursorsToWatch = [cursorsToWatch];
            }

            if(isArray(cursorsToWatch)) {

                numberSubscribers += cursorsToWatch.length;

                const listener = _ => {
                    this.handleCursorChanged();
                };

                for(const cursor of cursorsToWatch) {
                    const unsub = cursor.observe(listener);
                    unsubs.push(unsub);
                }
            }

            if(debug && unsubs.length < numberSubscribers) {
                console.warn(`Expected to have at least ${numberSubscribers} cleanup functions for observers. But only received ${unsubs.length} cleanup functions.`);
            }

            // NOTE: `render()` will see the updated state and will be executed
            // only once despite the state change.
            this.setState({
                unsubs: unsubs
            });
        },

        cleanWatchers() {
            const unsubs = this.state.unsubs || [];
            for(const unsub of unsubs) {
                unsub.call(null);
            }
        },

        // this function is subscribed to all given cursors, and is called whenever
        // any of those cursors change in some way.
        handleCursorChanged() {

            const ctx = {
                currentProps: this.state.currentProps
            };

            if(shouldRewatchCursors.call(ctx, this.props, this.context)) {
                this.cleanWatchers();
                this.watchCursors(this.props, this.context);
            }

            if(!shouldAssignNewProps.call(ctx, this.props, this.context)) {
                return;
            }
            this.setState({
                currentProps: assign({}, this.props, this.assignNewProps(this.props, this.context))
            });
        },

        /* React API */

        displayName: `${Component.displayName}.OrwellContainer`,

        statics: {
            shouldComponentUpdate: function(scu) {
                __shouldComponentUpdate = scu === 'shallow' ? __shouldComponentUpdateShallow :
                                          scu === 'deep' ? __shouldComponentUpdateDeep :
                                          scu;
                return OrwellContainer;
            },
            shallow: function() {
                __shouldComponentUpdate = __shouldComponentUpdateShallow;
                return OrwellContainer;
            },
            deep: function() {
                __shouldComponentUpdate = __shouldComponentUpdateDeep;
                return OrwellContainer;
            },
            inject: function(spec = {}) {

                if(isFunction(spec)) {
                    spec = spec(assign({}, classSpec));
                }

                classSpec = assign({}, classSpec, spec);
                OrwellContainer = React.createClass(classSpec);
                return OrwellContainer;
            },
            debug: function(val = true) {
                debug = val;
                return OrwellContainer;
            }
        },

        getInitialState() {
            return {
                // array of functions to be called when OrwellContainer unmounts.
                // these functions, when called, handle the cleanup step in removing
                // listeners from Probe cursors.
                unsubs: [],
                currentProps: assign({}, this.props, this.assignNewProps(this.props, this.context))
            };
        },

        shouldComponentUpdate(nextProps, nextState) {
            return __shouldComponentUpdate.call(this, nextProps, nextState);
        },

        componentWillReceiveProps(nextProps, nextContext) {

            const ctx = {
                currentProps: this.state.currentProps
            };

            if(shouldRewatchCursors.call(ctx, nextProps, nextContext)) {
                this.cleanWatchers();
                this.watchCursors(nextProps, nextContext);
            }

            if(!shouldAssignNewProps.call(ctx, nextProps, nextContext)) {
                return;
            }
            this.setState({
                currentProps: assign({}, nextProps, this.assignNewProps(nextProps, nextContext))
            });
        },

        componentWillMount() {
            this.watchCursors(this.props, this.context);
        },

        componentWillUnmount() {
            this.cleanWatchers();
        },

        render() {
            return (<Component {...this.state.currentProps} />);
        }
    };

    OrwellContainer = React.createClass(classSpec);

    return OrwellContainer;
};

orwell.shouldComponentUpdate = function(fn) {
    __shouldComponentUpdateGlobal = fn;
};

module.exports = orwell;
