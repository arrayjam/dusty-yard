var d3 = require("d3"),
  queue = require("queue-async"),
  fs = require("fs"),
  topojson = require("topojson"),
  sphereKnn = require("sphere-knn");

queue()
  .defer(fs.readFile, __dirname + "/data/sa1.json", { encoding: "utf-8" })
  .defer(fs.readFile, __dirname + "/data/booths.csv", { encoding: "utf-8" })
  .defer(fs.readFile, __dirname + "/data/votes.csv", { encoding: "utf-8" })
  .defer(fs.readFile, __dirname + "/data/sa1.csv", { encoding: "utf-8" })
  .await(ready);

// voronoi -> clustered booths + long/lap point + sa1 codes
//booth.projected = projection([booth.Longitude, booth.Latitude]);

// In meters
var clusteringThreshold = 1000;

function ready(error, sa1, boothdata, votes, sa1data) {
  sa1 = JSON.parse(sa1);
  boothdata = d3.csv.parse(boothdata);
  votes = d3.csv.parse(votes);
  sa1data = d3.csv.parse(sa1data);

  var geo = topojson.feature(sa1, sa1.objects.sa1).features;
  var xExtent = d3.extent(geo, function(d) { return (d.geometry.coordinates[0][0][0]); });
  var yExtent = d3.extent(geo, function(d) { return (d.geometry.coordinates[0][0][1]); });
  var extent = [[ xExtent[0] - 10, yExtent[0] - 10 ], [ xExtent[1] + 20, yExtent[1] + 10 ]];

  boothdata = boothdata.map(function(booth) {
    return {
      longitude: +booth.Longitude,
      latitude: +booth.Latitude,
      id: +booth.PollingPlaceID
    };
  });

  var unclustered = d3.map();
  boothdata.forEach(function(d) { unclustered.set(d.id, d); });

  // sphereKnn expects accessors named latitude and longitude
  var lookup = sphereKnn(unclustered.values());

  var boothsToCluster = d3.map();
  var clustered = d3.map();
  unclustered.forEach(function(id, booth) {
    if (boothsToCluster.has(booth.id)) return;
    var points = lookup(booth.latitude, booth.longitude, Infinity, clusteringThreshold);
    points.forEach(function(point) {
      point.position = [point.longitude, point.latitude];
      boothsToCluster.set(point.id, booth.id);
    });

    // Average clustered points
    booth.position[0] = points.reduce(function(prev, cur) { return prev + cur.position[0]; }, 0) / points.length;
    booth.position[1] = points.reduce(function(prev, cur) { return prev + cur.position[1]; }, 0) / points.length;

    clustered.set(id, {
      position: booth.position,
      id: booth.id,
      booths: points,
      tracts: [],
      votes: []
    });

  });

  votes.forEach(function(vote) {
    var id = +vote.PollingPlaceID;

    // If we don't have it, it's a mobile booth
    if (!boothsToCluster.has(id)) return;

    var cluster = clustered.get(boothsToCluster.get(id));
    ////candidate, bpos, elected, helected, party, votes, swing
    ////party, votes, swing
    cluster.votes.push({
      party: vote.PartyAb || "Informal",
      votes: +vote.OrdinaryVotes
    });
  });

  clustered.values().forEach(function(d) {
    var nest = d3.nest()
      .key(function(d) { return d.party; })
      .rollup(function(d) { return d3.sum(d, function(d) { return d.votes; }); })
      .entries(d.votes);

    d.votes = nest.map(function(d) { var o = {}; o[d.key] = d.values; return o; });
  });

  var polygons = d3.geom.voronoi()
    .x(function(d) { return d.position[0]; })
    .y(function(d) { return d.position[1]; })
    .clipExtent(extent)
    (clustered.values());

  // Transform the polygons into a map
  var result = d3.map();
  polygons.forEach(function(polygon) {
    var point = polygon.point;
    point.voronoi = [];
    polygon.forEach(function(p) { point.voronoi.push(p); });
    result.set(point.id, point);
  });

  result.values().forEach(function(d) {
    d.booths.forEach(function(booth) {
      delete booth.longitude;
      delete booth.latitude;
    });
    // Just how many booths
    //d.booths = d.booths.length;
  });

  var centroidPoints = geo.map(function(d) {
    return {id: d.id, position: d3.geo.centroid(d)};
  });

  var centroidQuadtree = d3.geom.quadtree()
    .x(function(d) { return d.position[0]; })
    .y(function(d) { return d.position[1]; })
    (centroidPoints);

  result.values().forEach(function(result) {
    var xExtent = d3.extent(result.voronoi, function(d) { return d[0]; });
    var yExtent = d3.extent(result.voronoi, function(d) { return d[1]; });

    search(centroidQuadtree, xExtent[0], yExtent[0], xExtent[1], yExtent[1], function(point) {
      if (pointInPolygon(point.position, result.voronoi)) {
        result.tracts.push(point.id);
      }
    });
  });

  var sa1Map = d3.map();
  sa1data.forEach(function(d) {
    sa1Map.set(d.region_id, d);
    for (var i in d) { d[i] = +d[i]; }
  });


  result.values().forEach(function(result) {
    var tracts = result.tracts;
    var sa1s = tracts.map(function(d) { return sa1Map.get(d); });
    result.demographics = d3.nest()
      .rollup(function(d) {
        return {
          population:           d3.sum(d, function(d) { return +d.Tot_P_P; }),
          migrants:             d3.sum(d, function(d) { return +d.Birthplace_Elsewhere_P; }),
          other_lang:           d3.sum(d, function(d) { return +d.Lang_spoken_home_Oth_Lang_P; }),
          age_18_34:            d3.sum(d, function(d) { return +d.Age_yr_18_P + d.Age_yr_19_P + d.Age_yr_20_P + d.Age_yr_21_P + d.Age_yr_22_P + d.Age_yr_23_P + d.Age_yr_24_P + d.Total_25_34_yr; }),
          age_35_54:            d3.sum(d, function(d) { return +d.Total_35_44_yr + d.Total_45_54_yr; }),
          age_55_ov:            d3.sum(d, function(d) { return +d.Total_55_64_yr + d.Total_65_74_yr + d.Total_75_84_yr + d.Total_85ov; }),
          christians:           d3.sum(d, function(d) { return +d.Christianity_Tot_P; }),
          non_religious:        d3.sum(d, function(d) { return +d.No_Religion_P; }),
          year_12_equivalent:   d3.sum(d, function(d) { return +d.P_Y12e_Tot; }),
          couple_childless:     d3.sum(d, function(d) { return +d.Tot_cple_fam_no_child; }),
          couple_child:         d3.sum(d, function(d) { return +d.Tot_cple_fam_wth_chld; }),
          single_child:         d3.sum(d, function(d) { return +d.Tot_One_parent_fam; }),
          no_internet:          d3.sum(d, function(d) { return +d.No_IC_Total; }),
          median_age:        ~~d3.mean(d, function(d) { return +d.Median_age_persons; }),
          median_income:     ~~d3.mean(d, function(d) { return +d.Median_Tot_fam_inc_weekly; })
        };
      })
      .entries(sa1s);
  });

  var voronoi = geojson();
  result.values().forEach(function(result) {
    voronoi.features.push(polygonFeature(result.id, {
      booths: result.booths,
      votes: result.votes,
      tracts: result.tracts,
      demographics: result.demographics,
    }, result.voronoi));
  });

  function analyseVotesToPopulation () {
    var stats = result.values().map(function(result) {
      var votes = d3.sum(result.votes, function(d) { return d[1]; });
      var population = d3.sum([result.demographics.age_18_34, result.demographics.age_35_54, result.demographics.age_55_ov]);
      return {votes: votes, population: population, ratio: (population && votes) ? population/votes : 0};
    });
    console.log(d3.median(stats, function(d) { return d.ratio; }));
  }
  //analyseVotesToPopulation();

  fs.writeFile("data/result.json", JSON.stringify(result, null, 2));
  fs.writeFile("data/voronoi.json", JSON.stringify(voronoi, null, 2));
}

function polygonFeature (id, properties, coordinates) {
  coordinates.push(coordinates[0]);

  return {
    "type": "Feature",
    "geometry": {
      "type": "Polygon",
      "coordinates": [coordinates],
    },
    "properties": properties,
    "id": id
  };
}

function geojson() {
  return {
    "type": "FeatureCollection",
    "features": [],
  };
}

function search(quadtree, x0, y0, x3, y3, callback) {
  quadtree.visit(function(node, x1, y1, x2, y2) {
    var p = node.point;
    if (p && (p.position[0] >= x0) && (p.position[0] < x3) && (p.position[1] >= y0) && (p.position[1] < y3)) callback(p);
    return x1 >= x3 || y1 >= y3 || x2 < x0 || y2 < y0;
  });
}

function pointInPolygon (point, vs) {
  // ray-casting algorithm based on
  // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html
  var xi, xj, yi, yj, i, j, intersect,
  x = point[0],
  y = point[1],
  inside = false;
  for (i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    xi = vs[i][0],
    yi = vs[i][1],
    xj = vs[j][0],
    yj = vs[j][1],
    intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

