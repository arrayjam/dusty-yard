var d3 = require("d3"),
  queue = require("queue-async"),
  fs = require("fs"),
  topojson = require("topojson"),
  sphereKnn = require("sphere-knn");

queue()
  .defer(fs.readFile, __dirname + "/data/sa1.json",       { encoding: "utf-8" })
  .defer(fs.readFile, __dirname + "/data/australia.json", { encoding: "utf-8" })
  .defer(fs.readFile, __dirname + "/data/booths.csv",     { encoding: "utf-8" })
  .defer(fs.readFile, __dirname + "/data/votes.csv",      { encoding: "utf-8" })
  .defer(fs.readFile, __dirname + "/data/tpp.csv",        { encoding: "utf-8" })
  .defer(fs.readFile, __dirname + "/data/sa1.csv",        { encoding: "utf-8" })
  .await(ready);

// voronoi -> clustered booths + long/lap point + sa1 codes
//booth.projected = projection([booth.Longitude, booth.Latitude]);

// In meters
var clusteringThreshold = 2000;

function ready(error, sa1, australia, boothdata, votes, tpp, sa1data) {
  sa1 = JSON.parse(sa1);
  australia = JSON.parse(australia);
  boothdata = d3.csv.parse(boothdata);
  votes = d3.csv.parse(votes);
  tpp = d3.csv.parse(tpp);
  sa1data = d3.csv.parse(sa1data);

  var geo = topojson.feature(sa1, sa1.objects.sa1).features;
  var ausGeo = topojson.feature(australia, australia.objects.australia);
  var xExtent = d3.extent(geo, function(d) { return (d.geometry.coordinates[0][0][0]); });
  var yExtent = d3.extent(geo, function(d) { return (d.geometry.coordinates[0][0][1]); });
  var extent = [[ xExtent[0] - 10, yExtent[0] - 10 ], [ xExtent[1] + 20, yExtent[1] + 10 ]];

  var ausPolygons = [];
  unwrapToPolygon(ausGeo, ausPolygons);
  ausPolygons.map(d3.geom.polygon);

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
      votes: {party: {}, tpp: {}}
    });

  });

  votes.forEach(function(vote) {
    var id = +vote.PollingPlaceID;

    // If we don't have it, it's a mobile booth
    if (!boothsToCluster.has(id)) return;

    var cluster = clustered.get(boothsToCluster.get(id));
    ////candidate, bpos, elected, helected, party, votes, swing
    ////party, votes, swing
    var party = vote.PartyAb || "Informal";
    cluster.votes.party[party] = cluster.votes[party] || 0;
    cluster.votes.party[party] += +vote.OrdinaryVotes;
  });

  tpp.forEach(function(vote) {
    var id = +vote.PollingPlaceID;

    if (!boothsToCluster.has(id)) return;

    var cluster = clustered.get(boothsToCluster.get(id));

    cluster.votes.tpp.labor = +vote["Australian Labor Party Votes"];
    cluster.votes.tpp.coalition = +vote["Liberal/National Coalition Votes"];
  });

  //clustered.values().forEach(function(d) {
    //console.log(d);
    //var nest = d3.nest()
      //.key(function(d) { return d.party; })
      //.rollup(function(d) { return d3.sum(d, function(d) { return d.votes; }); })
      //.entries(d.votes);

    //d.votes = nest.map(function(d) { var o = {}; o[d.key] = d.values; return o; });
  //});

  var polygons = d3.geom.voronoi()
    .x(function(d) { return d.position[0]; })
    .y(function(d) { return d.position[1]; })
    .clipExtent(extent)
    (clustered.values());


  var copyPolygon = function(original) {
    var copy = [];
    original.forEach(function(d) { copy.push(d); });
    copy = d3.geom.polygon(copy);
    return copy;
  };

  var getBounds = function(polygon) {
    var x1 = Infinity,
        y1 = Infinity,
        x2 = -Infinity,
        y2 = -Infinity;

    polygon.forEach(function(point) {
      x1 = Math.min(x1, point[0]);
      y1 = Math.min(y1, point[1]);
      x2 = Math.max(x2, point[0]);
      y2 = Math.max(y2, point[1]);
    });

    return [[x1, y1], [x2, y2]];
  };

  var boundsOverlap = function(a, b) {
    return (a[0][0] < b[1][0] &&
            a[1][0] > b[0][0] &&
            a[0][1] < b[1][1] &&
            a[1][1] > b[0][1]);
  };

  // We need to use our voronoi areas as clipping planes, since d3 uses the
  // Weiler-Atherton polygon clipping algorithm, and geographic geometry will
  // not be convex.  In this way, we'll cut up Australia into our
  // voronoi-shaped bits. This kind of reverses our representation. Previously
  // we had a map of australia with a voronoi overlay. When we clip australia
  // to the voronoi, we'll end up with voronoi-shaped pieces of Australia.
  ausPolygons.forEach(function(d) { d.bounds = getBounds(d); });

  var clipped = d3.map();
  polygons.forEach(function(voronoi) {

    // Turn the voronoi polygon into a d3.geom.polygon
    var clip_plane = d3.geom.polygon(voronoi);

    // We'll use this to pick up the pieces of the australian features
    var clip_plane_id = voronoi.point.id;

    // The clipped features
    var features = [];

    var clip_bounds = getBounds(voronoi);

    ausPolygons.forEach(function(feature) {
      var feature_bounds = feature.bounds;

      if (!boundsOverlap(clip_bounds, feature_bounds)) return;
      // Clone the feature so we don't destroy the original
      var subject = copyPolygon(feature);

      clip_plane.clip(subject);

      // If we have an element in the clipped polygon, we should be good
      if (subject[0]) features.push(subject);
    });

    // Associate voronoi ID with features
    clipped.set(clip_plane_id, features);
  });


  // Transform the polygons into a map
  var result = d3.map();
  polygons.forEach(function(polygon) {
    var point = polygon.point;
    point.voronoi = [];
    //polygon = d3.geom.polygon(polygon);
    //ausPolygons.forEach(function(feature) {
      //var copy = [];
      //feature.forEach(function(d) { copy.push(d); });
      //copy = d3.geom.polygon(copy);
      //polygon.clip(copy);
      //console.log(polygon.area(), copy.area());
    //});
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
        var age_18_34 = d3.sum(d, function(d) { return +d.Age_yr_18_P + d.Age_yr_19_P + d.Age_yr_20_P + d.Age_yr_21_P + d.Age_yr_22_P + d.Age_yr_23_P + d.Age_yr_24_P + d.Total_25_34_yr; });
        var age_35_54 = d3.sum(d, function(d) { return +d.Total_35_44_yr + d.Total_45_54_yr; });
        var age_55_ov = d3.sum(d, function(d) { return +d.Total_55_64_yr + d.Total_65_74_yr + d.Total_75_84_yr + d.Total_85ov; });
        return {
          voting_population:    age_18_34 + age_35_54 + age_55_ov,
          age_18_34:            age_18_34,
          age_35_54:            age_35_54,
          age_55_ov:            age_55_ov,
          population:           d3.sum(d, function(d) { return +d.Tot_P_P; }),
          migrants:             d3.sum(d, function(d) { return +d.Birthplace_Elsewhere_P; }),
          other_lang:           d3.sum(d, function(d) { return +d.Lang_spoken_home_Oth_Lang_P; }),
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
      var partyVotes = d3.sum(d3.values(result.votes.party)) - result.votes.party.Informal;
      var tppVotes = d3.sum(d3.values(result.votes.tpp));
      var population = result.demographics.population;
      //console.log({partyVotes: partyVotes, tpp: tppVotes, population: population});
    });
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

function unwrapToPolygon(geometry, polygons) {
  if (geometry.type === "FeatureCollection") geometry.features.forEach(function(feature) { unwrapToPolygon(feature, polygons); });
  if (geometry.type === "Feature") unwrapToPolygon(geometry.geometry, polygons);
  if (geometry.type === "MultiPolygon") geometry.coordinates.forEach(function(coord) { coord.forEach(function(polygon) { polygon.id = geometry.id; polygons.push(polygon); }); });
  if (geometry.type === "Polygon") geometry.coordinates.forEach(function(polygon) { polygons.push(polygon); });
}

