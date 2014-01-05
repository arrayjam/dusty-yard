function ex(v, name) { window[name] = v; }

var foo = {};
var ractive = new Ractive({
  el: "ractive",
  template: "#template",
  data: { tpp: false, informal: false, map: true },
  complete: function() {
    var self = this;

    d3.json("data/combined.topo.json", function(err, data) {
      ex(data, "data");
      electorates = topojson.feature(data, data.objects.electorates);
      mesh = topojson.mesh(data, data.objects.electorates, function(a, b) { return a === b; });
      //mesh = topojson.mesh(data, data.objects.electorates);
      data = topojson.feature(data, data.objects.voronoi);
      data.features = data.features
        .filter(function(d) { return d.properties.demographics.population > 0; });

      cf = crossfilter(data.features);
      all = cf.groupAll();
      //    coalition = cf.dimension(function(d) { return ((d.votes.party.LP || 0) + (d.votes.party.LNP || 0) + (d.votes.party.NP || 0) + (d.votes.party.CLR || 0)); }),
      //    coalitionGroup = coalition.group(function(d) { return d; }),

      var votes, votesGroup;
      function calcVotes(tpp, informal) {
        if (votes) votes.dispose();
        if (votesGroup) votesGroup.dispose();

        votes = cf.dimension(function(d) { return d; });
        votesGroup = votes.group().reduce(
          function (p, d) {
            if (tpp) {
              p.coalition += d.properties.votes.tpp.coalition || 0;
              p.labor += d.properties.votes.tpp.labor || 0;
            } else {
              p.coalition += (d.properties.votes.party.LP || 0) + (d.properties.votes.party.LNP || 0) + (d.properties.votes.party.NP || 0);
              p.labor += d.properties.votes.party.ALP || 0;
              p.greens += d.properties.votes.party.GRN || 0;
              p.pup += d.properties.votes.party.PUP || 0;
              p.kap += d.properties.votes.party.KAP || 0;
            }

            if (informal) p.informal += d.properties.votes.party.Informal || 0;
            var fe = featuresMap.get(d.id);
            fe.style.fill = "white";

            return p;
          },
          function (p, d) {
            if (tpp) {
              p.coalition -= d.properties.votes.tpp.coalition || 0;
              p.labor -= d.properties.votes.tpp.labor || 0;
            } else {
              p.coalition -= (d.properties.votes.party.LP || 0) + (d.properties.votes.party.LNP || 0) + (d.properties.votes.party.NP || 0);
              p.labor -= d.properties.votes.party.ALP || 0;
              p.greens -= d.properties.votes.party.GRN || 0;
              p.pup -= d.properties.votes.party.PUP || 0;
              p.kap -= d.properties.votes.party.KAP || 0;
            }

            var fe = featuresMap.get(d.id);
            fe.style.fill = "black";

            if (informal) p.informal -= d.properties.votes.party.Informal || 0;

            return p;
          },
          function () {
            var o;
            if (tpp) {
              o = {coalition: 0, labor: 0};
            } else {
              o = {coalition: 0, labor: 0, greens: 0, informal: 0, pup: 0, kap: 0};
            }

            if (informal) o.informal = 0;

            return o;
          }
        );
        dc.renderAll();
        dc.redrawAll();
      }
      calcVotes(true, true);
      self.observe({
        tpp: function() { calcVotes(self.get("tpp"), self.get("informal")); },
        informal: function() { calcVotes(self.get("tpp"), self.get("informal")); }
      });


      ex(votesGroup, "votesGroup");
      ex(calcVotes, "calcVotes");

      var medianChart = function() {
        var crossfilter,
            key,
            dimension,
            groupFunction = function(d) { return Math.floor(d); },
            group,
            reduceFunction = function(d) { return d.properties.demographics.population; },
            dimensionFunction = function(d) { return key(d); },
            chartInstance;

        var chart = function(div) {
          div.each(function() {
            var div = d3.select(this);

            dimension = crossfilter.dimension(dimensionFunction);
            group = dimension.group(groupFunction).reduceSum(key);

            chartInstance = dc.barChart(div.node());

            var domain = [0, 100];
            var domainExtent = Math.abs(domain[0] - domain[1]);

            chartInstance
              .margins({left: 50, top: 50, right: 50, bottom: 50})
              .elasticY(true)
              .width(500)
              .dimension(dimension)
              .group(group)
              .centerBar(false)
              .gap(1)
              .colors(d3.range(domainExtent).map(d3.scale.linear().domain(domain).range(["red", "yellow"])))
              .colorAccessor(function(d, i){ return i; })
              .x(d3.scale.linear().domain(domain))
              .y(d3.scale.pow().domain([0, 150]));
          });
        };

        chart.key = function(_) {
          if (!arguments.length) return key;
          key = _;
          return chart;
        };

        chart.crossfilter = function(_) {
          if (!arguments.length) return crossfilter;
          crossfilter = _;
          return chart;
        };

        return chart;
      };

      var percentageChart = function() {
        var crossfilter,
            key,
            dimension,
            groupFunction = function(d) { return Math.floor(d); },
            group,
            reduceFunction = function(d) { return d.properties.demographics.population; },
            dimensionFunction = function(d) { return (key(d) || 0) / reduceFunction(d) * 100; },
            chartInstance;

        var chart = function(div) {
          div.each(function() {
            var div = d3.select(this);

            dimension = crossfilter.dimension(dimensionFunction);
            group = dimension.group(groupFunction).reduceSum(key);

            chartInstance = dc.barChart(div.node());

            var domain = [0, 100];
            var domainExtent = Math.abs(domain[0] - domain[1]);

            chartInstance
              .margins({left: 50, top: 50, right: 50, bottom: 50})
              .elasticY(true)
              .width(500)
              .dimension(dimension)
              .group(group)
              .centerBar(false)
              .gap(1)
              .colors(d3.range(domainExtent).map(d3.scale.linear().domain(domain).range(["steelblue", "red"])))
              .colorAccessor(function(d, i){ return i; })
              .x(d3.scale.linear().domain(domain))
              .y(d3.scale.pow().domain([0, 150]))
              .xAxis().tickFormat(function(v) {return v + "%"; });
          });
        };

        chart.key = function(_) {
          if (!arguments.length) return key;
          key = _;
          return chart;
        };

        chart.crossfilter = function(_) {
          if (!arguments.length) return crossfilter;
          crossfilter = _;
          return chart;
        };

        chart.chartInstance = function(_) {
          if (!arguments.length) return chartInstance;
          chartInstance = _;
          return chart;
        };

        return chart;
      };

      d3.select("#labor")
        .call(percentageChart()
              .crossfilter(cf)
              .key(function(d) { return d.properties.votes.tpp.labor; }));

      d3.select("#year12")
        .call(percentageChart()
              .crossfilter(cf)
              .key(function(d) { return d.properties.demographics.year_12_equivalent; }));

      d3.select("#age")
        .call(medianChart()
              .crossfilter(cf)
              .key(function(d) { return d.properties.demographics.median_age; }));



      var svg = d3.select("#votes").append("svg").style("height", 200);
      var totalPopulation = data.features.reduce(function(p, v) { return p + v.properties.demographics.population; }, 0);
      var count = function() {
        return all.reduceSum(function(d) { return d.properties.demographics.population; }).value() / totalPopulation * 100;
      };
      console.log(electorates);

      var map = d3.select("#map").append("svg").append("defs").append("mask").attr("id", "voronoi");
      //var clip = d3.select("#map").append("defs").append("mask").attr("id", "aus");
      //var projection = d3.geo.albers().rotate([-132.5, 0]).center([0, -26.5]).parallels([-36, -18]);
      var projection = null;
      var path = d3.geo.path().projection(projection);
      ex(path, "path");

      //clip.selectAll("rect").data([0]).enter().append("rect")
        //.attr({
          //x: 0,
          //y: 0,
          //width: 1000,
          //height: 1000
        //})
        //.style("fill", "white");
      //clip.selectAll("path").data(electorates.features).enter().append("path").attr("d", path).style("fill", "black").style("stroke", "black");
    //clip.append("path").datum(mesh).attr("d", path).style("fill", "white");
    //d3.select("svg").append("rect")
      //.attr({
        //x: 0,
        //y: 0,
        //width: 1000,
        //height: 1000
      //})
      //.style("fill", "white")
      //.attr("mask", "url(#aus)");


      d3.select("#map svg").append("g").attr("mask", "url(#voronoi)").selectAll("path.electorates").data(electorates.features).enter().append("path").attr("class", "electorates").attr("d", path);
      d3.select("#map svg").append("path").datum(mesh).attr("class", "outline").attr("d", path);
      featuresMap = d3.map();
      var f = map.selectAll("path").data(votes.top(Infinity), function(d) { return d.id; });
      f.exit().remove();
      f.enter().append("path").attr("class", "land").attr("d", path);
      f.each(function(d) { featuresMap.set(d.id, this); });
      dc._renderlet = function() {




        var rep = count();
        var data = d3.entries(votesGroup.all()[0].value).filter(function(d) { return d.value > 1e-5; });
        var scale = d3.scale.pow().domain([0, 1000000]).range([0, 100]);

        var color = d3.scale.ordinal().domain(["greens", "coalition", "labor", "informal", "pup", "kap"]).range(["#10C25B", "#080CAB", "#990000", "#000", "#ff0", "#f00"]);

        var arc = d3.svg.arc()
          .innerRadius(70)
          .outerRadius(100);

        var pie = d3.layout.pie()
        .sort(function(a, b) { if (a.key === "coalition") return 1; })
        .value(function(d) { return d.value; });


        var g = svg.selectAll(".arc")
          .data(pie(data), function(d) { return d.data.key; });


        g.exit().remove();

        g
        .select("path")
        .attr("d", arc)
        .style("fill", function(d) { return color(d.data.key);});

        g.enter().append("g")
        .attr("class", "arc")
        .append("path");



        g.attr("transform", "translate(100, 100)");

        var rect = svg.selectAll("rect.fill").data([rep]);
        rect.enter().append("rect").attr("class", "fill");
        rect.attr({
          width: rep,
          height: 20,
          x: 320,
          y: 85
        }).style("fill", "steelblue");

        var outline = svg.selectAll("rect.stroke").data([rep]);
        outline.enter().append("rect").attr("class", "stroke");
        outline.attr({
          width: 100,
          height: 20,
          x: 320.5,
          y: 85.5
        })
        .style("fill", "none")
        .style("stroke", "#222")
        .style("stroke-width", 1);


        d3.select(".count").text("Australians represented: " + rep + "%");
      };

      dc.chartRegistry.list().forEach(function(chart) { chart.transitionDuration(0); });
      dc.constants.EVENT_DELAY = 0;

      dc.renderAll();
      dc.redrawAll();
    });
  }
});
