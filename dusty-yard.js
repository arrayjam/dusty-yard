queue()
  .defer(d3.json, "sa1.json")
  .defer(d3.csv, "booths.csv")
  .await(ready);

function ready(error, sa1, boothdata) {
  var path = d3.geo.path()
      .projection(null);

  console.log(sa1);
  console.log(boothdata);

  var centroids = {};
  var geo = topojson.feature(sa1, sa1.objects.sa1).features;

  geo.forEach(function(feature) {
    centroids[feature.id] = path.centroid(feature);
  });

  boothdata.forEach(function(booth) {
    booth.Longitude = +booth.Longitude;
    booth.Latitude = +booth.Latitude;
  });

  var quadtree = d3.geom.quadtree()
    .x(function(d) { return d.Longitude; })
    .y(function(d) { return d.Latitude; });

  var nodes = quadtree(boothdata);

  var closeRoot = [];
  var normalPoints = [];

  var threshold = 0.001;
  nodes.visit(function(point, x1, y1, x2, y2) {
    if (x2 - x1 <= threshold || y2 - y1 <= threshold) {
      closeRoot.push(point);
      return true;
    } else if (point.x !== null && point.y !== null) {
      normalPoints.push(point);
    }
  });

  closeRoot.forEach(function(d) {
    d.visit = function(f) {
      d3_geom_quadtreeVisit(f, d, d.x1, d.y1, d.x2, d.y2);
    };
  });

  var closePoints = [];
  closeRoot.forEach(function(point) {
    var cluster = [];
    point.visit(function(d) {
      if (d.x !== null && d.y !== null) {
        cluster.push(d.point);
      }
    });
    closePoints.push(cluster);
  });

  console.log(closeRoot);
  console.log(closePoints);
  console.log(normalPoints);

  console.log("totals");
  console.log(boothdata.length);
  console.log(normalPoints.length);
  console.log(closePoints.reduce(function(total, d) { return total += d.length; }, 0));

//  window.booths = [];
//  boothdata.forEach(function(booth) {
//    window.booths.push([+booth.Longitude, +booth.Latitude]);
//    //window.booths[+booth.PollingPlaceID] = [+booth.Longitude, +booth.Latitude];
//  });


}

function d3_geom_quadtreeVisit(f, node, x1, y1, x2, y2) {
  if (!f(node, x1, y1, x2, y2)) {
    var sx = (x1 + x2) * .5,
    sy = (y1 + y2) * .5,
    children = node.nodes;
    if (children[0]) d3_geom_quadtreeVisit(f, children[0], x1, y1, sx, sy);
    if (children[1]) d3_geom_quadtreeVisit(f, children[1], sx, y1, x2, sy);
    if (children[2]) d3_geom_quadtreeVisit(f, children[2], x1, sy, sx, y2);
    if (children[3]) d3_geom_quadtreeVisit(f, children[3], sx, sy, x2, y2);
  }
}

