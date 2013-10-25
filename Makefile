TOPOJSON = node --max_old_space_size=8192 ./node_modules/.bin/topojson

STATES = NSW VIC QLD WA SA TAS ACT NT
#http://vtr.aec.gov.au/Downloads/HouseStateFirstPrefsByPollingPlaceDownload-17496-VIC.csv

all: \
	data/voronoi.topo.json \
	data/ocean.json \
	$(addprefix sources/,$(addsuffix -booths.csv,$(STATES))) \
	data/sa1.csv

sources/SA1_2011_AUST.shp: sources/2011_SA1_shape.zip
	unzip $^
	touch $@

data/sa1.json: sources/SA1_2011_AUST.shp
	$(TOPOJSON) --id-property SA1_7DIGIT -o $@ -- sa1=$^

sources/pollingbooths.csv:
	curl 'http://vtr.aec.gov.au/Downloads/GeneralPollingPlacesDownload-17496.csv' \
		| tail --lines=+2 > $@

data/booths.csv: sources/pollingbooths.csv
	node parse_booths.js

data/voronoi.json: data/booths.csv data/sa1.json data/votes.csv
	node valanalys.js

data/voronoi.topo.json: data/voronoi.json
	topojson -p -q 1e7 -o $@ -- voronoi=$^

sources/ne_10m_ocean.shp: sources/ne_10m_ocean.zip
	unzip $^
	touch $@

data/ocean.json: sources/ne_10m_ocean.shp
	#[[95.56988170482968, -53.314907539193854], [173.63318020307952, 0.7332575653006259]]
	ogr2ogr -clipsrc 95.6 -53.3 174.6 0.8 sources/ocean.shp $^
	$(TOPOJSON) -q 1e5 --simplify-proportion 0.8 --force-clockwise false -o $@ -- ocean=sources/ocean.shp

sources/%-booths.csv:
	curl 'http://vtr.aec.gov.au/Downloads/HouseStateFirstPrefsByPollingPlaceDownload-17496-$*.csv' \
		| tail --lines=+2 > $@

data/votes.csv: $(addprefix sources/,$(addsuffix -booths.csv,$(STATES)))
	touch $@
	head -q -n 1 $^ | uniq >> $@
	tail -q -n +2 $^ >> $@

data/sa1.csv:
	sh csv_extract
	mv result.csv $@


