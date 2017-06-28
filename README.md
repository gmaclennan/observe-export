# observe-export


TODO: Put badges here.

> Export observations and new OSM nodes from an osm-p2p-db used by field-data-collector

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [API](#api)
- [Contribute](#contribute)
- [License](#license)

## Install

```
npm install observe-export
```

## Usage

```js
const osmdb = require('osm-p2p-mem')
const memdb = require('memdb')
const OBS = require('osm-p2p-observations')
const ObserveExport = require('../')

const osm = osmdb()
const obs = OBS({ db: memdb(), log: osm.log })

const observeExport = new ObserveExport(osm, obs)

const ids = ['12345', '54321']

observeExport.osmJson(ids, function (err, data) {
  // data is array of OSM objects for observations with `ids`
})

observeExport.osmJson(ids, {linkedNodes: true}, function (err, data) {
  // data is array of OSM objects for observations with `ids`
  // as well as any linked nodes in the p2p db.
})

```

## API

### var observeExport = new ObserveExport(osm, obs)

### observeExport.osmObjects(observationIds, [opts], [cb])

### observationIds.osmChangeJson(observationIds, [opts], [cb])

### observationIds.osmChangeXml(observationIds, [opts], [cb])

## Contribute

PRs accepted.

Small note: If editing the Readme, please conform to the [standard-readme](https://github.com/RichardLitt/standard-readme) specification.

## License

MIT © Digital Democracy
