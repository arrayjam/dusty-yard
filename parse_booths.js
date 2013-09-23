#!/usr/bin/env node

var fs = require("fs"),
    dsv = require("dsv"),
    queue = require("queue-async"),
    d3 = require("d3");

fs.readFile("sources/pollingbooths.csv", "utf8", function(error, text) {
  if (error) return;


  var filteredRows = [];
  dsv.csv.parse(text).forEach(function(row) {
    if (row.Latitude !== "" && row.Longitude !== ""
        && row.Latitude != 0 && row.Longitude != 0) {
      filteredRows.push({
        PollingPlaceID: row.PollingPlaceID,
        Latitude: row.Latitude,
        Longitude: row.Longitude
      });
    }
  });

  fs.writeFile("data/booths.csv", dsv.csv.format(filteredRows), function(err) {
    if(err) {
      console.log(err);
    } else {
      console.log("booths.csv saved.");
    }
  });
});

