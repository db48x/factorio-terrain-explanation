// From http://www.redblobgames.com/making-of/line-drawing/
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
        this.root = d3.select(`#${containerId}`);
        this.scaleRichness = d3.scaleLinear().domain([-1, 1]).range([10*scale, 0]).clamp(true);
        this.scaleX = d3.scaleLinear().domain([-3, 3]).range([0, 25*scale]);
        this.parent = this.root.select("svg");
        this._updateFunctions = [];
    }

    onUpdate(f) {
        this._updateFunctions.push(f);
        this.update();
    }

    update() {
        this._updateFunctions.forEach((f) => f());
    }

    addGrid() {
        let g = this.parent.append('g').attr('class', "grid");
        for (let x = 0; x < 25; x++) {
            for (let y = 0; y < 10; y++) {
                g.append('rect')
                    .attr('transform', `translate(${x*scale}, ${y*scale})`)
                    .attr('width', scale)
                    .attr('height', scale);
            }
        }
        return this;
    }

    addNoise() {
        let g = this.parent.append('g').attr('class', "noise");
        let line = d3.line()
                     .x((d) => this.scaleX(d[0]))
                     .y((d) => this.scaleRichness(d[1]));
        let self = this;
        let path = g.append("svg:path");
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
            function heightClipped(x) {
                let h = height(x);
                return h < 0 ? 0 : h;
            }
            let noiseFunc = this.clipped ? heightClipped : height;
            path.attr("d", d => line(this.scaleX.ticks(550).map((x) => [ x, noiseFunc(x) ])));
        });
        return this;
    }

    addZeroLine() {
        let g = this.parent.append('g').attr('class', "zero");
        let line = g.append('line');
        this.onUpdate(() => {
            line.attr('x1', this.scaleX(this.scaleX.domain()[0]))
                .attr('y1', this.scaleRichness(0))
                .attr('x2', this.scaleX(this.scaleX.domain()[1]))
                .attr('y2', this.scaleRichness(0));
        });
        return this;
    }

    addThreshold() {
        this.clipped = true;
        this.makeCheckbox('clipped', true);
        return this;
    }

    addSize() {
        this.size = -.3;
        this.makeScrubbableNumber('size', -1, 1, 2);
        return this;
    }

    addRichness() {
        this.richness = 1;
        this.makeScrubbableNumber('richness', 0, 10, 1);
        return this;
    }

    addFrequency() {
        this.frequency = 1;
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
}

let diagram1 = new Diagram('noise')
    .addGrid()
    .addNoise();

let diagram2 = new Diagram('threshold')
    .addGrid()
    .addNoise()
    .addZeroLine()
    .addThreshold();

let diagram3 = new Diagram('size')
    .addGrid()
    .addNoise()
    .addZeroLine()
    .addThreshold()
    .addSize();

let diagram4 = new Diagram('richness')
    .addGrid()
    .addNoise()
    .addZeroLine()
    .addThreshold()
    .addRichness();

let diagram5 = new Diagram('frequency')
    .addGrid()
    .addNoise()
    .addZeroLine()
    .addThreshold()
    .addFrequency();

let diagram6 = new Diagram('seed')
    .addGrid()
    .addNoise()
    .addZeroLine()
    .addThreshold()
    .addSeed();

let diagram7 = new Diagram('everything')
    .addGrid()
    .addNoise()
    .addZeroLine()
    .addThreshold()
    .addSize()
    .addRichness()
    .addFrequency()
    .addSeed();
