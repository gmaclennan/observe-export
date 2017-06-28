# observe-export


TODO: Put badges here.

> Export observations and new OSM nodes from an osm-p2p-db used by field-data-collector

**Under development and API is likely to change**

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

const osmOrgdb = osmdb()
const obsDb = osmdb()
const obsIndex = OBS({ db: memdb(), log: osm.log })

const observeExport = new ObserveExport(osmOrgDb, obsDb, obsIndex)

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

<a name="ObserveExport"></a>

## ObserveExport(osmOrgDb, obsDb, obsIndex)
Create an object for export of data from an Observe database

**Kind**: global function

| Param | Type | Description |
| --- | --- | --- |
| osmOrgDb | `osm-p2p-db` | An osm-p2p-db instance with existing nodes from osm.org |
| obsDb | `osm-p2p-db` | An osm-p2p-db instance with observations and any newly created nodes |
| obsIndex | `osm-p2p-observations` | An osm-p2p-observations instance with links between observations and nodes |


* [ObserveExport(osmOrgDb, obsDb, obsIndex)](#ObserveExport)
    * [.osmObjects(observationOsmIds, opts, cb)](#ObserveExport+osmObjects) ⇒ `undefined`
    * [.osmChange(observationOsmIds, opts, cb)](#ObserveExport+osmChange) ⇒ `undefined`
    * [.osmChangeXml(observationOsmIds, opts, cb)](#ObserveExport+osmChangeXml) ⇒ `undefined`

<a name="ObserveExport+osmObjects"></a>

### observeExport.osmObjects(observationOsmIds, opts, cb) ⇒ `undefined`
Given a list of OSM IDs of 'observation'-type documents, return a mapping of
these IDs to the actual observation documents, with a 'links' property added
to each document, that is a list of 'node' OSM IDs that the observation is
linked to.
If 'opts.linkedNodes' is truthy, the 'node' OSM documents that are linked to
will also be included in the results. The linked nodes can either be existing
osm.org nodes from the `osmOrgDb`, or newly created nodes from the `obsDb`

**Kind**: instance method of [`ObserveExport`](#ObserveExport)

| Param | Type | Description |
| --- | --- | --- |
| observationOsmIds | `Array.&lt;String&gt;` | Array of string ids of osm-p2p-observations |
| opts | `Object` |  |
| opts.linkedNodes | `Boolean` | Include linked nodes in the export |
| cb | `function` | Called with an array of OSM documents |

<a name="ObserveExport+osmChange"></a>

### observeExport.osmChange(observationOsmIds, opts, cb) ⇒ `undefined`
Export a osmChange document as an array of OSM objects.
Each object has the property `action` which is one of
`create|modify|delete`. Created nodes are nodes from the
observationDb with a negative (placeholder) id. Modified
nodes are constructed from the original node in the osmOrgDb
and then merging the tags from linked observations in
chronological order.
Created nodes also have their placeholder ids replaced with
an decremental index from `-1` - this is to avoid issues with
importing the osmChange document into existing tools since osm-p2p
ids can be > 64 bits.
Finally version numbers are stripped from created nodes, since
existing tools do not expect these.

**Kind**: instance method of [`ObserveExport`](#ObserveExport)

| Param | Type | Description |
| --- | --- | --- |
| observationOsmIds | `Array.&lt;String&gt;` | Array of string ids of osm-p2p-observations |
| opts | `Object` | No options yet |
| cb | `function` | Called with an array of OSM objects with an `action` property |

<a name="ObserveExport+osmChangeXml"></a>

### observeExport.osmChangeXml(observationOsmIds, opts, cb) ⇒ `undefined`
Export an [OsmChange XML document](http://wiki.openstreetmap.org/wiki/OsmChange)
for changes related to the observations with `ids` in the passed
`observationOsmIds` array. See docs for `osmChange` for more details
on the export process

**Kind**: instance method of [`ObserveExport`](#ObserveExport)

| Param | Type | Description |
| --- | --- | --- |
| observationOsmIds | `Array.&lt;String&gt;` | Array of string ids of osm-p2p-observations |
| opts | `Object` | No options yet |
| cb | `function` | Called with OsmChange XML document |


## Contribute

PRs accepted.

Small note: If editing the Readme, please conform to the [standard-readme](https://github.com/RichardLitt/standard-readme) specification.

## License

MIT © Digital Democracy
