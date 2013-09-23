all: data/sa1.json data/booths.csv

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

