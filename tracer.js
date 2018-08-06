String.prototype.times = function(count) {
    return count < 1 ? '' : new Array(count + 1).join(this);
};

var tracer = {
    nativeCodeEx: /\[native code\]/,
    indentCount: -4,
    tracing: [],

    traceMe: function(func, methodName) {
        var traceOn = function() {
            var startTime = +new Date;
            var indentString = " ".times(tracer.indentCount += 4);
            console.info(indentString + methodName + '(', arguments, ')');
            var result = func.apply(this, arguments);
            console.info(indentString + methodName, '-> ', result, "(", new Date - startTime, 'ms', ")");
            tracer.indentCount -= 4;
            return result;
        };
        traceOn.traceOff = func;
        for (var prop in func) {
            traceOn[prop] = func[prop];
        }
        console.log("tracing " + methodName);
        return traceOn;
    },

    traceAll: function(root, recurse) {
        if ((root == window) || !((typeof root == 'object') || (typeof root == 'function'))) {return;}
        for (var key in root) {
            if ((root.hasOwnProperty(key)) && (root[key] != root)) {
                var thisObj = root[key];
                if (typeof thisObj == 'function') {
                    if ((this != root) && !thisObj.traceOff && !this.nativeCodeEx.test(thisObj)) {
                        root[key] = this.traceMe(root[key], key);
                        this.tracing.push({obj:root,methodName:key});
                    }
                }
                recurse && this.traceAll(thisObj, true);
             }
        }
    },

    untraceAll: function() {
        for (var i=0; i<this.tracing.length; ++i) {
            var thisTracing = this.tracing[i];
            thisTracing.obj[thisTracing.methodName] =
                thisTracing.obj[thisTracing.methodName].traceOff;
        }
        console.log("tracing disabled");
        tracer.tracing = [];
    }
};
