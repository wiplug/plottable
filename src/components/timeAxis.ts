///<reference path="../reference.ts" />

module Plottable {
export module Axis {
  export interface ITimeInterval {
      timeUnit: D3.Time.Interval;
      step: number;
      formatString: string;
  };

  export class Time extends Abstract.Axis {

    public _majorTickLabels: D3.Selection;
    public _minorTickLabels: D3.Selection;
    public _scale: Scale.Time;

    // default intervals
    // these are for minor tick labels
    public static minorIntervals: ITimeInterval[] = [
      {timeUnit: d3.time.second, step: 1, formatString: "%I:%M:%S %p"},
      {timeUnit: d3.time.second, step: 5, formatString: "%I:%M:%S %p"},
      {timeUnit: d3.time.second, step: 10, formatString: "%I:%M:%S %p"},
      {timeUnit: d3.time.second, step: 15, formatString: "%I:%M:%S %p"},
      {timeUnit: d3.time.second, step: 30, formatString: "%I:%M:%S %p"},
      {timeUnit: d3.time.minute, step: 1, formatString: "%I:%M %p"},
      {timeUnit: d3.time.minute, step: 5, formatString: "%I:%M %p"},
      {timeUnit: d3.time.minute, step: 10, formatString: "%I:%M %p"},
      {timeUnit: d3.time.minute, step: 15, formatString: "%I:%M %p"},
      {timeUnit: d3.time.minute, step: 30, formatString: "%I:%M %p"},
      {timeUnit: d3.time.hour, step: 1, formatString: "%I %p"},
      {timeUnit: d3.time.hour, step: 3, formatString: "%I %p"},
      {timeUnit: d3.time.hour, step: 6, formatString: "%I %p"},
      {timeUnit: d3.time.hour, step: 12, formatString: "%I %p"},
      {timeUnit: d3.time.day, step: 1, formatString: "%a %e"},
      {timeUnit: d3.time.day, step: 1, formatString: "%e"},
      {timeUnit: d3.time.month, step: 1, formatString: "%B"},
      {timeUnit: d3.time.month, step: 1, formatString: "%b"},
      {timeUnit: d3.time.month, step: 3, formatString: "%B"},
      {timeUnit: d3.time.month, step: 6, formatString: "%B"},
      {timeUnit: d3.time.year, step: 1, formatString: "%Y"},
      {timeUnit: d3.time.year, step: 1, formatString: "%y"},
      {timeUnit: d3.time.year, step: 5, formatString: "%Y"},
      {timeUnit: d3.time.year, step: 25, formatString: "%Y"},
    ];

    // these are for major tick labels
    public static majorIntervals: ITimeInterval[] = [
      {timeUnit: d3.time.day, step: 1, formatString: "%B %e, %Y"},
      {timeUnit: d3.time.month, step: 1, formatString: "%B %Y"},
      {timeUnit: d3.time.year, step: 1, formatString: "%Y"}, 
      {timeUnit: d3.time.year, step: 100000, formatString: ""} // this is essentially blank
    ];

    // lowest index in minor that will map to index in major
    public static minorToMajor: number[] = [
      14, // [0, 13] -> days
      16, // [14, 15] -> months
      20, // [16, 19] -> years
      1000000, // [20, infinity) -> blank
    ];

    /**
     * Creates a TimeAxis
     * 
     * @constructor
     * @param {OrdinalScale} scale The scale to base the Axis on.
     * @param {string} orientation The orientation of the Axis (top/bottom/left/right)
     */
    constructor(scale: Scale.Time, orientation: string, formatter?: Abstract.Formatter) {
      super(scale, orientation, formatter);
      // going to ignore the formatter
      this.classed("time-axis", true);
      this.tickLength(40);
      this.tickLabelPadding(5);
     }

     public _requestedSpace(offeredWidth: number, offeredHeight: number): ISpaceRequest {
      var requestedWidth = this._width;
      var requestedHeight = this._height;

      if (this._computedHeight == null) {
          this._computedHeight = this.tickLength() + this._measureTextHeight();
      }
      requestedWidth = 0;
      requestedHeight = (this._height === "auto") ? this._computedHeight : this._height;

      return {
          width: Math.min(offeredWidth, requestedWidth),
          height: Math.min(offeredHeight, requestedHeight),
          wantsWidth: false,
          wantsHeight: offeredHeight < requestedHeight
      };
    }

    public isEnoughSpace(container: D3.Selection, interval: ITimeInterval) {
      // do a simple heuristic first based on number of ticks
      var domain = this._scale.domain();
      var totalLength = domain[1] - domain[0];
      // if there are more than 50 ticks, we probably don't want this
      if (interval.timeUnit.offset(domain[0], interval.step * 50) < domain[1]) {
        return false;
      }
      // now measure the slow way
      // should probably speed this up with caching
      var tickLabels = this._scale.tickInterval(interval.timeUnit, interval.step);
      // add start/end points just in case we have zero ticks from our call
      tickLabels.push(domain[0]);
      tickLabels.push(domain[1]);
      var formatter = d3.time.format(interval.formatString);
      var maxLabelWidth = d3.max(tickLabels, (d: Date) => 
        Util.Text.getTextWidth(container, formatter(d)));
      return (2 * this.tickLabelPadding() + maxLabelWidth) * (tickLabels.length + 1) < this.availableWidth;
    }

    public _setup() {
      super._setup();
      this._majorTickLabels = this.content.append("g").classed("major-tick-labels", true);
      this._minorTickLabels = this.content.append("g").classed("minor-tick-labels", true);
      return this;
    }

    // returns a pair of indices [minor, major] to index into the arrays
    public getTickLevels(): number[] {
      // could also probably cache this
      var i = 0;
      for(; i < Time.minorIntervals.length; i++) {
        if (this.isEnoughSpace(this._minorTickLabels, Time.minorIntervals[i])) {
          break;
        }
      }
      var j = 0;
      while (Time.minorToMajor[j] <= i) {
        j++;
      }

      return [i, j];
    }

    public _getTickValues(): any[] {
      var levels = this.getTickLevels();
      var set = d3.set();
      set = Util.Methods.union(set, d3.set(this._scale.tickInterval
        (Time.minorIntervals[levels[0]].timeUnit, Time.minorIntervals[levels[0]].step)));
      set = Util.Methods.union(set, d3.set(this._scale.tickInterval
        (Time.majorIntervals[levels[1]].timeUnit, Time.majorIntervals[levels[1]].step)));
      return set.values().map((d) => new Date(d));
    }

    public _measureTextHeight(): number {
      var fakeTickLabel = this._majorTickLabels.append("g").classed("major-tick-label", true);
      var textHeight = Util.Text.getTextHeight(fakeTickLabel.append("text"));
      fakeTickLabel.remove();
      return textHeight;
    }

    public _renderTickLabels(container: D3.Selection, interval: ITimeInterval, height: number) {
      container.selectAll("." + Abstract.Axis.TICK_LABEL_CLASS).remove();
      var tickPos = this._scale.tickInterval(interval.timeUnit,
                                              interval.step);
      tickPos.splice(0, 0, this._scale.domain()[0]);
      tickPos.push(this._scale.domain()[1]);
      var center = interval.step === 1;
      var labelPos: Date[] = [];
      if (center) {
        for (var i = 0; i < tickPos.length - 1; i++) {
          labelPos.push(new Date((tickPos[i + 1].valueOf() - tickPos[i].valueOf()) / 2 + tickPos[i].valueOf()));
        }
      } else {
        labelPos = tickPos;
      }

      var tickLabels = container.selectAll("." + Abstract.Axis.TICK_LABEL_CLASS).data(labelPos, (d) => d.valueOf());
      var tickLabelsEnter = tickLabels.enter().append("g").classed(Abstract.Axis.TICK_LABEL_CLASS, true);
      tickLabelsEnter.append("text");
      var xTranslate = center ? 0 : this.tickLabelPadding();
      tickLabels.selectAll("text").attr("transform", "translate(" + xTranslate + "," + (this._orientation === "bottom" ?
          (this.tickLength() / (2 - height + 1)) :
          (this.availableHeight - this.tickLength() / (2 - height + 1))) + ")");
      tickLabels.exit().remove();
      tickLabels.attr("transform", (d: any) => "translate(" + this._scale._d3Scale(d) + ",0)");
      var anchor = center ? "middle" : "left";
      tickLabels.selectAll("text").text((d: any) => d3.time.format(interval.formatString)(d))
                                  .style("text-anchor", anchor);
    }

    public _doRender() {
      super._doRender();
      var levels = this.getTickLevels();
      this._renderTickLabels(this._minorTickLabels, Time.minorIntervals[levels[0]], 1);
      this._renderTickLabels(this._majorTickLabels, Time.majorIntervals[levels[1]], 2);
      for (var index = 0; index < 2; index++) {
          var v = index == 0 ? Time.minorIntervals[levels[index]] : Time.majorIntervals[levels[index]];
          var tickValues = this._scale.tickInterval(v.timeUnit, v.step);
          var selection = this._tickMarkContainer.selectAll("." + Abstract.Axis.TICK_MARK_CLASS).filter((d) =>
              tickValues.map((x) => x.valueOf()).indexOf(d.valueOf()) >= 0
          );
          selection.attr("y2", this.tickLength() / (2 - index));
        }
      return this;
    }
  }
}
}
