# orwell

> `orwell` is a higher-order component that can listen to [Probe](https://github.com/Dashed/probe) cursors for changes, and re-renders the wrapped component whenever any cursor emits a change.

## Usage

```
$ npm install --save orwell
```

```js
const OrwellWrapped = orwell(Component, {

    // any of these orwell lifecycle functions are optional

    watchCursors(props, manual, context) {

        const {cursor, otherCursor} = props;

        // add validation step to decide to re-render OrwellWrapped
        manual(function(update) {
            const unsubscribe = otherCursor.on(event, function(newValue, oldValue) {

                if(condition) {
                    update();
                }
            });

            // return a cleanup step; this will be called whenever OrwellWrapped unmounts
            return unsubscribe;
        });

        // return an array of cursors to be observed.
        // whenever these cursors emit an event, OrwellWrapped will re-render.
        return [cursor];

        // or return a single cursor directly; sugar to [cursor]
        return cursor;
    },

    shouldRewatchCursors(props, context) {

        // this is called whenever a subscribed cursor emits an event, or when the parent component renders.
        // 
        // in the former case: props === this.props and context === this.context
        // in the latter case: props === nextProps and context === nextContext (passed via parent component)
        //
        // these props and context are then passed to watchCursors(props, manual, context)

        // return false by default
        
        // if return true, then watchCursors(props, manual, context) is called with appropriate props and context.
    },

    assignNewProps(props, context) {

        const {valueCursor} = props;

        // return a plain object which will be merged with this.props (whenever a subscribed cursor emits)
        // or nextProps (when the parent component renders).
        return {
            value: valueCursor.deref()
        };
    },

    shouldAssignNewProps(props, context) {

        // this is called whenever a subscribed cursor emits an event, or when the parent component renders.
        // 
        // in the former case: props === this.props and context === this.context
        // in the latter case: props === nextProps and context === nextContext (passed via parent component)
        // 
        // these props and context are then passed to assignNewProps(props, context)

        // returns true by default
        
        // if return true, then watchCursors(props, manual, context) is called with appropriate props and context.
    }

});

// static methods

// set custom shouldComponentUpdate(nextProps, nextState).
// returns same wrapped component
const OrwellWrapped2 = OrwellWrapped.shouldComponentUpdate(customShouldComponentUpdate);

// sets shouldComponentUpdate(nextProps, nextState) to perform shallow equal on props. 
// any two Probe cursors it compares are compared as currentProbe.deref() === nextProbe.deref()
// returns same wrapped component
const OrwellWrapped3 = OrwellWrapped.shallow();

// sets shouldComponentUpdate(nextProps, nextState) to perform deep equal on props.
// any two Probe cursors it compares are compared as currentProbe.deref() === nextProbe.deref()
// returns same wrapped component
const OrwellWrapped4 = OrwellWrapped.deep();

// inject object to be merged with component spec of the OrwellWrapped component
// returns newly wrapped component
const OrwellWrapped4 = OrwellWrapped.inject({
    // the only time to do this is passing `contextTypes` to access `context` from the orwell lifecycle methods
    contextTypes: {
        context: React.PropTypes.object.isRequired
    }
});

// enable debug mode
// returns same wrapped component
const OrwellWrapped5 = OrwellWrapped.debug();
const OrwellWrapped6 = OrwellWrapped.debug(true); // enable
const OrwellWrapped7 = OrwellWrapped.debug(false); // disable
```

### `shouldComponentUpdate`

By default, `orwell` uses a `shouldComponentUpdate()` that is equivalent to React's [`PureRenderMixin`](https://facebook.github.io/react/docs/pure-render-mixin.html), but compares [Probe](https://github.com/Dashed/probe) different by doing something like:

```js
!(currentProbe.deref() === nextProbe.deref())
```

The props passed to `shouldComponentUpdate(nextProps, nextState)` is equivalent to `Object.assign({}, props, assignNewProps(props, context))`.

## Inspiration

`orwell` has been inspired by `connectToStores` code written by [@gaearon](https://github.com/gaearon) in his article promoting usage of Higher-order components: https://medium.com/@dan_abramov/mixins-are-dead-long-live-higher-order-components-94a0d2f9e750

## License

MIT
