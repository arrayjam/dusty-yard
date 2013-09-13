queue()
  .defer(d3.json, "sa1.json")
  .defer(d3.csv, "booths.csv")
  .await(ready);

function ready(error, sa1) {
  console.log(sa1);
  //console.log(booths);
}
