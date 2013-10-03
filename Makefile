all:  data/voronoi.topo.json data/ocean.json

TOPOJSON = node --max_old_space_size=8192 ./node_modules/.bin/topojson

sources/SA1_2011_AUST.shp: sources/2011_SA1_shape.zip
	unzip $^
	touch $@

data/sa1.json: sources/SA1_2011_AUST.shp
	$(TOPOJSON) --id-property SA1_7DIGIT -o $@ -- sa1=$^

sources/pollingbooths.csv:
	curl http://vtr.aec.gov.au/Downloads/GeneralPollingPlacesDownload-17496.csv | tail --lines=+2 > $@

data/booths.csv: sources/pollingbooths.csv
	node parse_booths.js

data/voronoi.json: data/booths.csv data/sa1.json
	node dusty-yard.js

data/voronoi.topo.json: data/voronoi.json
	topojson -q 1e7 -o $@ -- voronoi=$^

sources/ne_10m_ocean.shp: sources/ne_10m_ocean.zip
	unzip $^
	touch $@

data/ocean.json: sources/ne_10m_ocean.shp
	#[[95.56988170482968, -53.314907539193854], [173.63318020307952, 0.7332575653006259]]
	ogr2ogr -clipsrc 95.6 -53.3 174.6 0.8 sources/ocean.shp $^
	$(TOPOJSON) -q 1e5 --simplify-proportion 0.8 --force-clockwise false -o $@ -- ocean=sources/ocean.shp
