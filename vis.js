var suite = Benchmark.Suite();

// add tests
suite.add("Push", function() {
  var a = [];
  d3.range(10000).forEach(function(d) { a.push(d); });
})
// add listeners
.on('complete', function() {
  dc.constants.EVENT_DELAY = ~~(d3.scale.linear().domain([1e-3, 1e-5]).range([100, 0]))(this[0].stats.mean);
  transitionSpeed(dc.constants.EVENT_DELAY);
  console.log(dc.constants.EVENT_DELAY);
  console.log(this);
})
// run async
.run({async: true});

var transitionSpeed = function(speed) {
  dc.chartRegistry.list().forEach(function(chart) { chart.transitionDuration(dc.constants.EVENT_DELAY); });
};


d3.json("data/result.json", function(err, data) {
  data = d3.values(data).filter(function(d) { return d.demographics.population > 0; });
  window.data = data;

  cf = crossfilter(data),
  all = cf.groupAll(),
  //    coalition = cf.dimension(function(d) { return ((d.votes.LP || 0) + (d.votes.LNP || 0) + (d.votes.NP || 0) + (d.votes.CLR || 0)); }),
  //    coalitionGroup = coalition.group(function(d) { return d; }),

  votes = cf.dimension(function(d) { return d; }),
  votesGroup = votes.group().reduce(
    function (p, d) {
    p.coalition += ((d.votes.LP || 0) + (d.votes.LNP || 0) + (d.votes.NP || 0)) / d.demographics.population;
    p.labour += (d.votes.ALP || 0) / d.demographics.population;
    p.greens += (d.votes.GRN || 0) / d.demographics.population;
    p.informal += (d.votes.Informal || 0) / d.demographics.population;
    p.pup += (d.votes.PUP || 0) / d.demographics.population;
    p.kap += (d.votes.KAP || 0) / d.demographics.population;
    return p;
  },
  function (p, d) {
    p.coalition -= ((d.votes.LP || 0) + (d.votes.LNP || 0) + (d.votes.NP || 0)) / d.demographics.population;
    p.labour -= (d.votes.ALP || 0) / d.demographics.population;
    p.greens -= (d.votes.GRN || 0) / d.demographics.population;
    p.informal -= (d.votes.Informal || 0) / d.demographics.population;
    p.pup -= (d.votes.PUP || 0) / d.demographics.population;
    p.kap -= (d.votes.KAP || 0) / d.demographics.population;
    return p;
  },
  function () {
    return {coalition: 0, labour: 0, greens: 0, informal: 0, pup: 0, kap: 0};
  }
  ),

  age = cf.dimension(function(d) { return d.demographics.median_age; }),
  ageGroup = age.group(),

  income = cf.dimension(function(d) { return d.demographics.median_income; }),
  incomeGroup = income.group(function(d) { return Math.floor(d / 20) * 20; }),

  christians = cf.dimension(function(d) { return d.demographics.christians / d.demographics.population * 100; });
  christiansGroup = christians.group(function(d) { return Math.floor(d); }).reduceSum(function(d) { return d.demographics.christians; });

  greens = cf.dimension(function(d) { return (d.votes.GRN || 0) / d.demographics.population * 100; });
  greensGroup = greens.group(function(d) { return Math.floor(d); }).reduceSum(function(d) { return d.votes.GRN; });

  migrants = cf.dimension(function(d) { return d.demographics.migrants / d.demographics.population * 100; })
  migrantsGroup = migrants.group(function(d) { return Math.floor(d); }).reduceSum(function(d) { return d.demographics.migrants; });

  internet = cf.dimension(function(d) { return 100 - (d.demographics.no_internet / d.demographics.population * 100); });
  internetGroup = internet.group(function(d) { return Math.floor(d); }).reduceSum(function(d) { return d.demographics.population - d.demographics.no_internet; });

  young = cf.dimension(function(d) { return d.demographics.age_18_34 / d.demographics.population * 100; });
  youngGroup = young.group(function(d) { return Math.floor(d); }),

  atheist = cf.dimension(function(d) { return d.demographics.non_religious / d.demographics.population * 100; });
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
    .y(d3.scale.pow().domain([0, 150]))
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
    return "Australians represented: " + (all.reduceSum(function(d) { return d.demographics.population; }).value() / totalPopulation) * 100 + "%";
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
    var data = d3.entries(votesGroup.top(1)[0].value).filter(function(d) { return d.value > 1e-5; });
    window.v = data;
    var scale = d3.scale.pow().domain([0, 1000000]).range([0, 100]);

    var color = d3.scale.ordinal().domain(["greens", "coalition", "labour", "informal", "pup", "kap"]).range(["#10C25B", "#080CAB", "#990000", "#fff", "#ff0", "#f00"]);

    var arc = d3.svg.arc()
    .outerRadius(100 - 10)
    .innerRadius(0);

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

    d3.select(".count").text(count());

  });
  transitionSpeed(0);

  dc.renderAll();
  dc.redrawAll();
});
