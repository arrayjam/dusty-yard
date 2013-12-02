function ex(v, name) { window[name] = v; }

var foo = {};
var ractive = new Ractive({
  el: "ractive",
  template: "#template",
  data: { tpp: false, informal: false },
  complete: function() {
    var self = this;

    d3.json("data/result.json", function(err, data) {
      data = d3.values(data)
        .filter(function(d) { return d.demographics.population > 0; });
      ex(data, "data");

      cf = crossfilter(data);
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
              p.coalition += d.votes.tpp.coalition || 0;
              p.labor += d.votes.tpp.labor || 0;
            } else {
              p.coalition += (d.votes.party.LP || 0) + (d.votes.party.LNP || 0) + (d.votes.party.NP || 0);
              p.labor += d.votes.party.ALP || 0;
              p.greens += d.votes.party.GRN || 0;
              p.pup += d.votes.party.PUP || 0;
              p.kap += d.votes.party.KAP || 0;
            }

            if (informal) p.informal += d.votes.party.Informal || 0;

            return p;
          },
          function (p, d) {
            if (tpp) {
              p.coalition -= d.votes.tpp.coalition || 0;
              p.labor -= d.votes.tpp.labor || 0;
            } else {
              p.coalition -= (d.votes.party.LP || 0) + (d.votes.party.LNP || 0) + (d.votes.party.NP || 0);
              p.labor -= d.votes.party.ALP || 0;
              p.greens -= d.votes.party.GRN || 0;
              p.pup -= d.votes.party.PUP || 0;
              p.kap -= d.votes.party.KAP || 0;
            }

            if (informal) p.informal -= d.votes.party.Informal || 0;

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

      age = cf.dimension(function(d) { return d.demographics.median_age; }),
      ageGroup = age.group(),

      income = cf.dimension(function(d) { return d.demographics.median_income; }),
      incomeGroup = income.group(function(d) { return Math.floor(d / 20) * 20; }),

      christians = cf.dimension(function(d) { return d.demographics.christians / d.demographics.population * 100; });
      christiansGroup = christians.group(function(d) { return Math.floor(d); }).reduceSum(function(d) { return d.demographics.christians; });

      greens = cf.dimension(function(d) { return (d.votes.party.GRN || 0) / d.demographics.population * 100; });
      greensGroup = greens.group(function(d) { return Math.floor(d); }).reduceSum(function(d) { return d.votes.party.GRN; });

      migrants = cf.dimension(function(d) { return d.demographics.migrants / d.demographics.population * 100; })
      migrantsGroup = migrants.group(function(d) { return Math.floor(d); }).reduceSum(function(d) { return d.demographics.migrants; });

      internet = cf.dimension(function(d) { return 100 - (d.demographics.no_internet / d.demographics.population * 100); });
      internetGroup = internet.group(function(d) { return Math.floor(d); }).reduceSum(function(d) { return d.demographics.population - d.demographics.no_internet; });

      young = cf.dimension(function(d) { return d.demographics.age_18_34 / d.demographics.population * 100; });
      youngGroup = young.group(function(d) { return Math.floor(d); });

      var atheist = cf.dimension(function(d) { return d.demographics.non_religious / d.demographics.population * 100; });
      atheistGroup = atheist.group(function(d) { return Math.floor(d); }).reduceSum(function(d) { return d.demographics.non_religious; });


      greensChart = dc.barChart("#greens")
        .margins({left: 50, top: 50, right: 50, bottom: 50})
        .elasticY(true)
        .width(500)
        .dimension(greens)
        .group(greensGroup)
        .centerBar(false)
        .gap(1)
        .colors(d3.range(20).map(d3.scale.linear().domain([0,19]).range(["#00cc00", "#a60000"])))
        .colorAccessor(function(d, i){ return i; })
        .x(d3.scale.linear().domain([0, 100]))
        .y(d3.scale.pow().domain([0, 150]))
        .xAxis().tickFormat(function(v) {return v + "%"; });


      christiansChart = dc.barChart("#christians");

      christiansChart
        .margins({left: 50, top: 50, right: 50, bottom: 50})
        .elasticY(true)
        .width(500)
        .dimension(christians)
        .group(christiansGroup)
        .centerBar(false)
        .gap(1)
        .colors(d3.range(20).map(d3.scale.linear().domain([0,19]).range(["#00cc00", "#a60000"])))
        .colorAccessor(function(d, i){ return i; })
        .x(d3.scale.linear().domain([0, 100]))
        .xAxis().tickFormat(function(v) {return v + "%"; });

      atheistChart = dc.barChart("#atheist")
      .margins({left: 50, top: 50, right: 50, bottom: 50})
      .elasticY(true)
      .width(500)
      .dimension(atheist)
      .group(atheistGroup)
      .centerBar(false)
      .gap(1)
      .colors(d3.range(20).map(d3.scale.linear().domain([0,19]).range(["#00cc00", "#a60000"])))
      .colorAccessor(function(d, i){ return i; })
      .x(d3.scale.linear().domain([0, 100]))
      .y(d3.scale.pow().domain([0, 150]));

      incomeChart = dc.barChart("#income")
      .margins({left: 50, top: 50, right: 50, bottom: 50})
      .elasticY(true)
      .width(500)
      .dimension(income)
      .group(incomeGroup)
      .centerBar(false)
      .gap(1)
      .colors(d3.range(20).map(d3.scale.linear().domain([0,19]).range(["#00cc00", "#a60000"])))
      .colorAccessor(function(d, i){ return i; })
      .x(d3.scale.linear().domain([500, 4000]))
      .y(d3.scale.pow().domain([0, 40]));

      migrantsChart = dc.barChart("#migrants")
      .margins({left: 50, top: 50, right: 50, bottom: 50})
      .elasticY(true)
      .width(500)
      .dimension(migrants)
      .group(migrantsGroup)
      .centerBar(false)
      .gap(1)
      .colors(d3.range(20).map(d3.scale.linear().domain([0,19]).range(["#00cc00", "#a60000"])))
      .colorAccessor(function(d, i){ return i; })
      .x(d3.scale.linear().domain([0, 100]))
      .y(d3.scale.pow().domain([0, 150]));

      internetChart = dc.barChart("#internet")
      .margins({left: 100, top: 50, right: 50, bottom: 50})
      .elasticY(true)
      .width(500)
      .dimension(internet)
      .group(internetGroup)
      .centerBar(false)
      .gap(1)
      .colors(d3.range(20).map(d3.scale.linear().domain([0,19]).range(["#00cc00", "#a60000"])))
      .colorAccessor(function(d, i){ return i; })
      .x(d3.scale.linear().domain([0, 100]))
      .y(d3.scale.pow().domain([0, 150]));

      youngChart = dc.barChart("#young")
      .margins({left: 50, top: 50, right: 50, bottom: 50})
      .elasticY(true)
      .width(500)
      .dimension(young)
      .group(youngGroup)
      .centerBar(false)
      .gap(1)
      .colors(d3.range(20).map(d3.scale.linear().domain([0,19]).range(["#00cc00", "#a60000"])))
      .colorAccessor(function(d, i){ return i; })
      .x(d3.scale.linear().domain([0, 100]))
      .y(d3.scale.pow().domain([0, 150]));

      var svg = d3.select("#votes").append("svg").style("height", 200);
      var totalPopulation = data.reduce(function(p, v) { return p + v.demographics.population; }, 0);
      var count = function() {
        return all.reduceSum(function(d) { return d.demographics.population; }).value() / totalPopulation * 100;
      };

      ageChart = dc.barChart("#age")
      .margins({left: 50, top: 50, right: 50, bottom: 50})
      .elasticY(true)
      .width(500)
      .dimension(age)
      .group(ageGroup)
      .centerBar(false)
      .gap(1)
      .colors(d3.range(20).map(d3.scale.linear().domain([0,19]).range(["#00cc00", "#a60000"])))
      .colorAccessor(function(d, i){ return i; })
      .x(d3.scale.linear().domain([0, 100]))
      .y(d3.scale.pow().domain([0, 150]))
      .on("postRedraw", function() {
        var rep = count();
        var data = d3.entries(votesGroup.all()[0].value).filter(function(d) { return d.value > 1e-5; });
        window.v = data;
        var scale = d3.scale.pow().domain([0, 1000000]).range([0, 100]);

        var color = d3.scale.ordinal().domain(["greens", "coalition", "labor", "informal", "pup", "kap"]).range(["#10C25B", "#080CAB", "#990000", "#000", "#ff0", "#f00"]);

        console.log(rep);
        var arc = d3.svg.arc()
          .innerRadius(70)
          .outerRadius(100);

        var pie = d3.layout.pie()
        .sort(function(a, b) { if (a.key === "coalition") return 1; })
        .value(function(d) { return d.value; });

        console.log(data);

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

      });
      dc.chartRegistry.list().forEach(function(chart) { chart.transitionDuration(0); });
      dc.constants.EVENT_DELAY = 0;

      dc.renderAll();
      dc.redrawAll();
    });
  }
});
