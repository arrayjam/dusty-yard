var d3 = require("d3"),
  fs = require("fs"),
  queue = require("queue-async"),
  topojson = require("topojson"),
  sphereKnn = require("sphere-knn");

queue()
  .defer(fs.readFile, __dirname + "/data/sa1.json", { encoding: "utf-8" })
  .defer(fs.readFile, __dirname + "/data/booths.csv", { encoding: "utf-8" })
  .await(ready);

// voronoi -> clustered booths + long/lap point + sa1 codes
//booth.projected = projection([booth.Longitude, booth.Latitude]);

// In meters
var clusteringThreshold = 500;

function ready(error, sa1, boothdata) {
  sa1 = JSON.parse(sa1);
  boothdata = d3.csv.parse(boothdata);

  var geo = topojson.feature(sa1, sa1.objects.sa1).features;

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

  var clustered = d3.map();
  unclustered.forEach(function(id, booth) {
    var points = lookup(booth.latitude, booth.longitude, Infinity, clusteringThreshold);
    points.forEach(function(point) {
      point.position = [point.longitude, point.latitude];
      delete point.longitude, delete point.latitude;
      unclustered.remove(point.id);
    });

    clustered.set(id, {
      position: booth.position,
      id: booth.id,
      booths: points,
      tracts: []
    });
  });

  var polygons = d3.geom.voronoi()
    .x(function(d) { return d.position[0]; })
    .y(function(d) { return d.position[1]; })
    (clustered.values());

  // Transform the polygons into a map
  var result = d3.map();
  polygons.forEach(function(polygon) {
    var point = polygon.point;
    point.voronoi = [];
    polygon.forEach(function(p) { point.voronoi.push(p); });
    result.set(point.id, point);
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
        console.log("Booth " + result.id + " matches tract " + point.id);
        result.tracts.push(point.id);
      }
    });
  });

  var geojson = {
    "type": "FeatureCollection",
    "features": []
  };

  result.values().forEach(function(result) {
    var feature = polygonFeature(result.id, {
      booths: result.booths,
      tracts: result.tracts
    }, result.voronoi);
    geojson.features.push(feature);
    console.log(feature);

  });

  fs.writeFile("data/result.json", JSON.stringify(result, null, 2));
  fs.writeFile("data/geo.json", JSON.stringify(geojson));
}

function polygonFeature (id, properties, coordinates) {
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

