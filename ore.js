// Derived from http://www.redblobgames.com/making-of/line-drawing/
// Copyright 2017 Red Blob Games <redblobgames@gmail.com>
// License: Apache v2.0 <http://www.apache.org/licenses/LICENSE-2.0.html>

const set_seed = noise.seed;
const scale = 22;

function octave(n, weight) {
    return function (xi) {
        let amp = Math.pow(2, n);
        return (weight/amp) * noise.perlin2(xi*amp, 0);
    };
}
function octaves(weights) {
    let os = weights.map((weight, n) => octave(n, weight));
    return function (xi) {
        return os.reduce(function (acc, func) { return acc + func(xi); }, 0);
    };
}

class Diagram {
    constructor(containerId) {
        this._updateFunctions = [
            () => {
                this.width = this.parent.property("width").baseVal.value;
                this.height = this.parent.property("height").baseVal.value;
                this.scaleRichness.range([this.height, 0]);
                this.scaleRichnessClipped.range([this.height/2, 0]);
                this.scaleX.range([0, this.width]);
            }
        ];
        this.root = d3.select(`#${containerId}`);
        this.parent = this.root.select("svg");
        this.scaleRichness = d3.scaleLinear().domain([-1, 1]).range([this.height, 0]).clamp(true);
        this.scaleRichnessClipped = d3.scaleLinear().domain([0, 1]).range([this.height, this.height/2]).clamp(true);
        this.scaleX = d3.scaleLinear().domain([-3, 3]).range([0, this.width]);
        setTimeout(() => this.update(), 0);
    }

    onUpdate(f) {
        this._updateFunctions.push(f);
    }

    update() {
        this._updateFunctions.forEach((f) => f());
    }

    addGrid() {
        let g = this.parent.append('g').attr('class', "grid");
        this.onUpdate(() => {
            g.selectAll('rect').remove();
            g.selectAll('line').remove();
            let left = this.scaleX.range()[0],
                right = this.scaleX.range()[1],
                top = this.scaleRichness.range()[0],
                bottom = this.scaleRichness.range()[1];
            g.append('rect')
             .attr('x', left)
             .attr('y', bottom)
             .attr('width', right - left)
             .attr('height', top - bottom);
            this.scaleX.ticks(this.width/scale).forEach((t) => {
                g.append('line')
                 .attr('x1', this.scaleX(t))
                 .attr('y1', top)
                 .attr('x2', this.scaleX(t))
                 .attr('y2', bottom);
            });
            this.scaleRichness.ticks(this.height/scale).forEach((t) => {
                g.append('line')
                 .attr('x1', left)
                 .attr('y1', this.scaleRichness(t))
                 .attr('x2', right)
                 .attr('y2', this.scaleRichness(t));
            });
        });
        return this;
    }

    addNoise(g, richness) {
        this.onUpdate(() => {
            let seed = "seed" in this ? this.seed : 0,
                richness = "richness" in this ? this.richness : 1,
                size = "size" in this ? this.size : -0.3,
                frequency = "frequency" in this ? this.frequency : 1;
            set_seed(seed);
            let noise = octaves([1,1,2,1,1,1,1,1,1,1,1]);
            function height(x) {
                return richness * noise(x * frequency) + size;
            }
            this.values = this.scaleX.ticks(this.width).map((x) => [ x, height(x) ]);
        });
        return this;
    }

    _drawNoise(className, yscale) {
        let g = this.parent.append('g').attr('class', className);
        let line = d3.line()
                     .x((d) => this.scaleX(d[0]))
                     .y(yscale);
        let path = g.append("svg:path");
        this.onUpdate(() => {
            if (this.values) {
                path.attr("d", d => line(this.values));
            }
        });
        return this;
    }

    drawNoise() {
        return this._drawNoise("noise", (d) => this.scaleRichness(d[1]));
    }
    drawClippedNoise() {
        return this._drawNoise("clippednoise", (d) => this.scaleRichnessClipped(d[1]));
    }

    addZeroLine() {
        let g = this.parent.append('g').attr('class', "zero");
        let line = g.append('line');
        this.onUpdate(() => {
            line.attr('x1', this.scaleX.range()[0])
                .attr('y1', this.scaleRichness(0))
                .attr('x2', this.scaleX.range()[1])
                .attr('y2', this.scaleRichness(0));
        });
        return this;
    }

    addSize(defaultValue) {
        this.size = defaultValue || -.3;
        this.makeScrubbableNumber('size', -1, 1, 2);
        return this;
    }

    addRichness(defaultValue) {
        this.richness = defaultValue || 1;
        this.makeScrubbableNumber('richness', 0, 10, 1);
        return this;
    }

    addFrequency(defaultValue) {
        this.frequency = defaultValue || 1;
        this.makeScrubbableNumber('frequency', 0.1, 10, 1);
        return this;
    }

    addSeed() {
        this.seed = 0;
        this.makeScrubbableNumber('seed', 0, 100, 0);
        return this;
    }

    makeScrubbableNumber(name, low, high, precision) {
        let diagram = this;
        let elements = diagram.root.selectAll(`[data-name='${name}']`);
        let positionToValue = d3.scaleLinear()
            .clamp(true)
            .domain([-100, +100])
            .range([low, high]);
        let formatter = d3.format(`.${precision}f`);

        function updateNumbers() {
            elements.text(formatter(diagram[name]));
        }

        updateNumbers();

        elements.call(
            d3.drag()
                .subject(() => ({x: positionToValue.invert(diagram[name]), y: 0}))
                .on('drag', () => {
                    diagram[name] = parseFloat(formatter(positionToValue(d3.event.x)));
                    updateNumbers();
                    diagram.update();
                }));
    }

    makeCheckbox(name, defaultValue) {
        let diagram = this;
        let elements = diagram.root.selectAll(`[data-name='${name}']`);
        elements.property('checked', defaultValue);
        diagram.update();
        elements.on('change',
                    () => {
                        diagram[name] = d3.event.target.checked;
                        elements.property('checked', this.checked);
                        diagram.update();
                    });
    }

    makeDebugPoint(name, location, color) {
        let diagram = this;
        let element = diagram.root.select(`.${name}`);
        let g = this.parent.append('g').attr('class', `debugPoint debug ${name}`);
        let point = g.append('circle').attr('class', 'debug');
        point.attr('cx', location.x);
        point.attr('cy', location.y);
        point.attr('r', 3);
        point.attr('fill', color || "red");
        this.onUpdate(() => {
            point.attr('cx', location.x);
            point.attr('cy', location.y);
            point.attr('r', 3);
        });
        return this;
    }

    makeCurve(name, element, a, ac, bc, b) {
        let diagram = this;
        diagram.makeDebugPoint(name, a, "red");
        diagram.makeDebugPoint(name, ac, "orange");
        diagram.makeDebugPoint(name, b, "green");
        diagram.makeDebugPoint(name, bc, "blue");
        return `M ${a.x} ${a.y} C ${ac.x} ${ac.y} ${bc.x} ${bc.y} ${b.x} ${b.y}`;
    }

    makePointer(name, location, side) {
        let diagram = this;
        let element = diagram.root.select(`.${name}`);
        let g = this.parent.append('g').attr('class', `pointer ${name}`);
        let path = g.append('path');
        this.onUpdate(() => {
            diagram.root.selectAll('.debug').remove();
            let tipPosition = { x: this.scaleX(location.x)
                              , y: this.scaleRichness(location.y)
                              };
            let diagramRect = diagram.root.select('svg').node().getBoundingClientRect();
            let diagramPosition = { x: diagramRect.left + window.pageXOffset
                                  , y: diagramRect.top + window.pageYOffset
                                  };
            let elemRect = element.node().getBoundingClientRect();
            let elementOffsetTL = { x: elemRect.left + window.pageXOffset - diagramPosition.x
                                  , y: elemRect.top + window.pageYOffset - diagramPosition.y
                                  };
            let elementOffsetTR = { x: elemRect.right + window.pageXOffset - diagramPosition.x
                                  , y: elemRect.top + window.pageYOffset - diagramPosition.y
                                  };
            if (side === 'left') {
                path.attr('d',
                          [ this.makeCurve(name, g,
                                           tipPosition,
                                           {x: tipPosition.x - 75, y: tipPosition.y + 60},
                                           {x: elementOffsetTR.x, y: elementOffsetTR.y - 60},
                                           elementOffsetTR)
                          , `L ${elementOffsetTR.x} ${elementOffsetTR.y + elemRect.height}`
                          , `L ${elementOffsetTL.x} ${elementOffsetTR.y + elemRect.height}`
                          , `L ${elementOffsetTL.x} ${elementOffsetTL.y}`
                          , this.makeCurve(name, g,
                                           elementOffsetTL,
                                           {x: elementOffsetTL.x, y: elementOffsetTL.y - 60},
                                           {x: tipPosition.x - 50, y: tipPosition.y + 10},
                                           tipPosition)
                          ].join(" "));
            } else {
                path.attr('d',
                          [ this.makeCurve(name, g,
                                           tipPosition,
                                           {x: tipPosition.x + 50, y: tipPosition.y + 1},
                                           {x: elementOffsetTR.x, y: elementOffsetTR.y - 60},
                                           elementOffsetTR)
                          , `L ${elementOffsetTR.x} ${elementOffsetTR.y + elemRect.height}`
                          , `L ${elementOffsetTL.x} ${elementOffsetTR.y + elemRect.height}`
                          , `L ${elementOffsetTL.x} ${elementOffsetTL.y}`
                          , this.makeCurve(name, g,
                                           elementOffsetTL,
                                           {x: elementOffsetTL.x, y: elementOffsetTL.y - 80},
                                           {x: tipPosition.x + 75, y: tipPosition.y + 30},
                                           tipPosition)
                          ].join(" "));
            }
        });
        return this;
    }
}

let diagram1 = new Diagram('noise')
    .addGrid()
    .addNoise()
    .drawNoise();

let diagram2 = new Diagram('threshold')
    .addGrid()
    .addNoise()
    .drawNoise()
    .drawClippedNoise()
    .addZeroLine();

let diagram3 = new Diagram('pause')
    .addGrid()
    .addNoise()
    .drawNoise()
    .drawClippedNoise()
    .addZeroLine()
    .makePointer("small-patch", {x: -1.9, y: .03}, 'left')
    .makePointer("large-patch", {x: -.05, y: .07}, 'right');

let diagram4 = new Diagram('size')
    .addGrid()
    .addNoise()
    .drawNoise()
    .drawClippedNoise()
    .addZeroLine()
    .addSize(-0.20)
    .makePointer("new-patch", {x: 1.575, y: .03}, 'right');

let diagram5 = new Diagram('richness')
    .addGrid()
    .addNoise()
    .drawNoise()
    .drawClippedNoise()
    .addZeroLine()
    .addRichness(2)
    .makePointer("new-patch", {x: 1.575, y: .1}, 'right');

let diagram6 = new Diagram('frequency')
    .addGrid()
    .addNoise()
    .drawNoise()
    .drawClippedNoise()
    .addZeroLine()
    .addFrequency(0.7);

let diagram7 = new Diagram('seed')
    .addGrid()
    .addNoise()
    .drawNoise()
    .drawClippedNoise()
    .addZeroLine()
    .addSeed();

let diagram8 = new Diagram('everything')
    .addGrid()
    .addNoise()
    .drawNoise()
    .drawClippedNoise()
    .addZeroLine()
    .addSize()
    .addRichness()
    .addFrequency()
    .addSeed();
