var d3 = require("d3"),
  fs = require("fs"),
  queue = require("queue-async"),
  topojson = require("topojson");

queue()
  .defer(fs.readFile, __dirname + "/data/sa1.json", { encoding: "utf-8" })
  .defer(fs.readFile, __dirname + "/data/booths.csv", { encoding: "utf-8" })
  .await(ready);

// voronoi -> clustered booths + long/lap point + sa1 codes

function ready(error, sa1, boothdata) {
  sa1 = JSON.parse(sa1);
  boothdata = d3.csv.parse(boothdata);

  var geo = topojson.feature(sa1, sa1.objects.sa1).features;

  boothdata.forEach(function(booth) {
    booth.Longitude = +booth.Longitude;
    booth.Latitude = +booth.Latitude;
    booth.PollingPlaceID = +booth.PollingPlaceID;
    booth.cluster = [];
    booth.sa1 = [];
    //booth.projected = projection([booth.Longitude, booth.Latitude]);
  });

  var clustered = [],
  threshold = 0.0007;
  boothdata.forEach(function(booth) {
    var c = false;
    for (var i = 0; i < clustered.length; i++) {
      var cluster = clustered[i];
      if (Math.abs(booth.Longitude - cluster.Longitude) <= threshold &&
          Math.abs(booth.Latitude - cluster.Latitude) <= threshold) {
        c = true;
      cluster.cluster.push(booth);
      break;
      }
    }
    if (!c) {
      clustered.push(booth);
    }
  });

  var polygons = d3.geom.voronoi()
  .x(function(d) { return d.Longitude; })
  .y(function(d) { return d.Latitude; })
  (clustered);

  var centroids = d3.map();
  geo.forEach(function(d) {
    centroids.set(d.id, d3.geo.centroid(d));
  });

  var result = d3.map();
  polygons.forEach(function(polygon) {
    var id = polygon.point.PollingPlaceID;
    centroids.forEach(function(centroid_id, centroid) {
      if (pointInPolygon(centroid, polygon)) {
        var sa1s = result.get(id) || [];
        sa1s.push(centroid_id);
        result.set(id, sa1s);
      }
    });
  });

  var geojson = {
    "type": "FeatureCollection",
    "features": []
  };

  var feature = {
    "type": "Feature",
    "geometry": {
      "type": "Polygon",
      "coordinates": [[
        [100.0, 0.0], [101.0, 0.0], [101.0, 1.0], [100.0, 1.0], [100.0, 0.0]
      ]]
    },
    "properties": { "prop0": "value0" },
    "id": "xxxx"
  };

  fs.writeFile("result.json", JSON.stringify(result));
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

