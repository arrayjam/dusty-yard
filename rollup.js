var fs = require("fs"),
  d3 = require("d3"),
  queue = require("queue-async");

var boothQueue = queue();
["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"]
  .map(function(d) {
    boothQueue.defer(fs.readFile, __dirname + "/sources/" + d + "-booths.csv", { encoding: "utf-8" });
  });

boothQueue.await(ready);

function ready() {
  var states =
    d3.merge(Array.prototype.slice.call(arguments, 1).map(function(d) { return d3.csv.parse(d); }));

  var booths = d3.map();
  states.forEach(function(d) {
    var id = d.PollingPlaceID;
    if (!booths.has(id)) booths.set(id, d3.map());
    var booth = booths.get(id);
    var abbrev = d.PartyAb || "Informal";
    booth.set(abbrev, [d.OrdinaryVotes, d.Swing]);
  });

  console.log(booths);
  console.log(states.length);
}



