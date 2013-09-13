queue()
  .defer(d3.json, "sa1.json")
  .defer(d3.csv, "booths.csv")
  .await(ready);

function ready(error, sa1, booths) {
  var path = d3.geo.path()
      .projection(null);

  console.log(sa1);
  console.log(booths);

  var centroids = {};
  var geo = topojson.feature(sa1, sa1.objects.sa1).features;

  geo.forEach(function(feature) {
    centroids[feature.id] = path.centroid(feature);
  });

  var boothLocations = {};
  booths.forEach(function(booth) {
    boothLocations[+booth.PollingPlaceID] = [+booth.Longitude, +booth.Latitude];
  });

  var locationHashes = {};
  d3.keys(boothLocations).forEach(function(key) {
    var booth = boothLocations[key];
    var hash = booth.join("|");
    locationHashes[hash] = locationHashes[hash] || [];
    locationHashes[hash].push(key);
  });

  var filteredLocations = d3.keys(locationHashes).map(function(d) { return d.split("|"); }).map(function(d) { return [+d[0], +d[1]]; });
  console.log(filteredLocations);

  var voronoi = d3.geom.voronoi();

  //console.log(d3.values(centroids)[30]);
  //console.log(d3.values(boothLocations)[30]);
  //window.b = d3.values(boothLocations);
  console.log(d3.geom.voronoi(filteredLocations));

}
