var d3 = require("d3"),
  queue = require("queue-async"),
  fs = require("fs"),
  topojson = require("topojson"),
  sphereKnn = require("sphere-knn");

queue()
  .defer(fs.readFile, __dirname + "/data/sa1.json", { encoding: "utf-8" })
  .defer(fs.readFile, __dirname + "/data/booths.csv", { encoding: "utf-8" })
  .defer(fs.readFile, __dirname + "/data/votes.csv", { encoding: "utf-8" })
  .await(ready);

// voronoi -> clustered booths + long/lap point + sa1 codes
//booth.projected = projection([booth.Longitude, booth.Latitude]);

// In meters
var clusteringThreshold = 1000;

function ready(error, sa1, boothdata, votes) {
  sa1 = JSON.parse(sa1);
  boothdata = d3.csv.parse(boothdata);
  votes = d3.csv.parse(votes);

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

    d.votes = nest.map(function(d) { return [d.key, d.values]; });
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

  var centroidPoints = [];
  geo.forEach(function(d) {
    centroidPoints.push({id: d.id, position: d3.geo.centroid(d)});
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

  var voronoi = geojson();

  result.values().forEach(function(result) {
    voronoi.features.push(polygonFeature(result.id, {
      booths: result.booths,
      tracts: result.tracts,
      votes: result.votes
    }, result.voronoi));
  });

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

function pointFeature (id, coordinates) {
  return {
    "type": "Feature",
    "geometry": {
      "type": "Point",
      "coordinates": coordinates
    },
    "properties": {},
    "id": id
  };
}

function geojson() {
  return {
    "type": "FeatureCollection",
    "features": [],
    "crs": {
      "type": "name",
      "properties": {
        "name": "urn:ogc:def:crs:OGC:1.3:CRS84"
      }
    }
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

