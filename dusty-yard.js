queue()
  .defer(d3.json, "australia.json")
  .defer(d3.csv, "booths.csv")
  .await(ready);

function ready(error, sa1, boothdata) {
  //var path = d3.geo.path()
      //.projection(null);


  var width = 960,
    height = 500;

  var ausCenter = [132.5, -26.5];
  var parallels = [-36, -18];

  var projection = d3.geo.albers()
    .translate([width / 2, height / 2])
    .scale(1100)
    .rotate([-ausCenter[0], 0])
    .center([0, ausCenter[1]])
    .parallels(parallels)
    .precision(0);
  console.log(sa1);
  console.log(boothdata);

  //var centroids = [];
  var geo = topojson.feature(sa1, sa1.objects.SED_2011_AUST).features;

  //geo.forEach(function(feature) {
    //centroids.push({id: feature.id, coords: path.centroid(feature)});
  //});

  boothdata.forEach(function(booth) {
    booth.Longitude = +booth.Longitude;
    booth.Latitude = +booth.Latitude;
    booth.cluster = [];
    booth.projected = projection([booth.Longitude, booth.Latitude]);
  });

  var clustered = [],
  threshold = 0.0007;
  boothdata.forEach(function(booth) {
    var c = false;
    clustered.forEach(function(clustered) {
      if (Math.abs(booth.Longitude - clustered.Longitude) <= threshold &&
          Math.abs(booth.Latitude - clustered.Latitude) <= threshold) {
        c = true;
        clustered.cluster.push(booth);
      }
    });
    if (!c) {
      clustered.push(booth);
    }
  });


  window.c = clustered;

  var projected = clustered.map(function(d) { return d.projected;});
  var polygons = d3.geom.voronoi()
    (projected);

  console.log(polygons);

  var svg = d3.select("body").append("svg")
    .attr("width", width)
    .attr("height", height);

  var path = d3.geo.path()
    .projection(projection);

  var g = svg.append("g");

  g.selectAll("path.land")
    .data(geo)
    .enter().append("path")
    .attr("class", "land")
    .attr("d", path);

  g.selectAll("path.voronoi")
    .data(polygons)
    .enter().append("path")
    .attr("class", "voronoi")
    .attr("d", function(d) { return "M" + d.join("L") + "Z"; });
  g.selectAll("circle.booth")
    .data(clustered)
    .enter().append("circle")
    .attr("class", "booth")
    .attr("r", 1)
    .attr("cx", function(d) { return d.projected[0]; })
    .attr("cy", function(d) { return d.projected[1]; });


  // zoom and pan
  var zoom = d3.behavior.zoom()
  .on("zoom",function() {
    g.attr("transform","translate("+
           d3.event.translate.join(",")+")scale("+d3.event.scale+")");
    g.selectAll("path.land")
      .attr("d", path.projection(projection))
      .style("stroke-width", 1 / d3.event.scale);
    g.selectAll("path.voronoi")
      .attr("d", function(d) { return "M" + d.join("L") + "Z"; })
      .style("stroke-width", 1 / d3.event.scale);

    g.selectAll("circle.booth")
      .attr("r", 1 / d3.event.scale);

  });

  svg.call(zoom);


//    //window.booths[+booth.PollingPlaceID] = [+booth.Longitude, +booth.Latitude];

}

