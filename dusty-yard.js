queue()
  .defer(d3.json, "sa1.json")
  .defer(d3.csv, "booths.csv")
  .await(ready);

function ready(error, sa1, boothdata) {
  var path = d3.geo.path()
      .projection(null);

  console.log(sa1);
  console.log(boothdata);

  var centroids = [];
  var geo = topojson.feature(sa1, sa1.objects.sa1).features;

  geo.forEach(function(feature) {
    centroids.push({id: feature.id, coords: path.centroid(feature)});
  });

  boothdata.forEach(function(booth) {
    booth.Longitude = +booth.Longitude;
    booth.Latitude = +booth.Latitude;
    booth.cluster = [];
  });

  var clustered = [],
  threshold = 0.0001;
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

  var polygons = d3.geom.voronoi()
    .x(function(d) { return d.Longitude; })
    .y(function(d) { return d.Latitude; })
    (clustered);

  console.log(polygons);

  window.c = clustered;


//    //window.booths[+booth.PollingPlaceID] = [+booth.Longitude, +booth.Latitude];

}

